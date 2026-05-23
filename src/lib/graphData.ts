// ============================================================
// GRAPH DATA — build nodes/links for each drill-down level
// ============================================================
import type { Course, Term, GraphLevel, GraphNode, GraphLink, LinkType } from '@/types';
import type { GraphFilters } from '@/store/AppContext';

interface BuildOptions {
  course: Course | undefined;
  allTerms: Term[];
  drillModuleId: string | undefined;
  drillLessonId: string | undefined;
  hierFilterIds: string[] | null;
  filters: GraphFilters;
  /** Glossary term IDs the user ticked in the left panel (used by logic-mode filtering). */
  selectedTermIds: string[];
}

export function buildGraphData(
  level: GraphLevel,
  opts: BuildOptions,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const { course, allTerms, drillModuleId, drillLessonId, hierFilterIds, filters, selectedTermIds } = opts;
  if (!course) return { nodes: [], links: [] };

  // Hierarchical filter — drop modules / lessons not in the include set.
  const filtered = hierFilterIds === null
    ? course
    : {
        ...course,
        modules: course.modules
          .filter(m => hierFilterIds.includes(m.id))
          .map(m => ({ ...m, lessons: m.lessons.filter(l => hierFilterIds.includes(l.id)) })),
      };

  let result: { nodes: GraphNode[]; links: GraphLink[] };
  if (level === 'modules') result = buildModulesGraph(filtered, allTerms);
  else if (level === 'lessons') result = buildLessonsGraph(filtered, drillModuleId);
  else result = buildTermsGraph(filtered, allTerms, drillModuleId, drillLessonId, filters.frequency);

  // Weight filter — drop edges outside [from, to], then drop orphaned non-center nodes.
  if (filters.weightEnabled) {
    const { weightFrom, weightTo } = filters;
    result.links = result.links.filter(l => {
      const w = l.weight ?? 1;
      return w >= weightFrom && w <= weightTo;
    });
    result.nodes = dropOrphans(result.nodes, result.links);
  }

  // Logical filter (requires selected terms in left panel).
  if (selectedTermIds.length > 0 && filters.logic !== 'or') {
    result = applyLogicFilter(result, allTerms, selectedTermIds, filters.logic, level);
  }

  return result;
}

function dropOrphans(nodes: GraphNode[], links: GraphLink[]): GraphNode[] {
  if (links.length === 0) return nodes;
  const touched = new Set<string>();
  for (const l of links) {
    touched.add(typeof l.source === 'string' ? l.source : l.source.id);
    touched.add(typeof l.target === 'string' ? l.target : l.target.id);
  }
  // Keep "center" / lesson hubs even if their edges were filtered out.
  return nodes.filter(n => touched.has(n.id) || n.type === 'lesson');
}

/**
 * Reduces the rendered nodes according to the chosen boolean operation against
 * the selected glossary terms.
 *
 * Semantics:
 *   - AND : node remains only if it is connected to every selected term
 *   - OR  : node remains if connected to at least one (no-op — default render)
 *   - NOT : node remains only if connected to none of the selected terms
 *   - XOR : node remains only if connected to exactly one selected term
 *
 * "Connected" depends on graph level:
 *   - modules level: module contains the term (via term.moduleId)
 *   - lessons level: lesson contains the term (via term.lessonId)
 *   - terms   level: the node IS the term, i.e. n.id in selectedTermIds
 */
function applyLogicFilter(
  graph: { nodes: GraphNode[]; links: GraphLink[] },
  allTerms: Term[],
  selectedTermIds: string[],
  logic: 'and' | 'not' | 'xor',
  level: GraphLevel,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const selectedTerms = allTerms.filter(t => selectedTermIds.includes(t.id));

  const isConnected = (node: GraphNode): number => {
    if (level === 'terms') return selectedTermIds.includes(node.id) ? 1 : 0;
    const fieldVal = (t: Term) => (level === 'modules' ? t.moduleId : t.lessonId);
    return selectedTerms.reduce(
      (acc, t) => acc + (fieldVal(t) === node.id ? 1 : 0),
      0,
    );
  };

  const keep = (node: GraphNode): boolean => {
    // Don't filter lesson hubs at the terms level — they're the centre.
    if (level === 'terms' && node.type === 'lesson') return true;
    const hits = isConnected(node);
    switch (logic) {
      case 'and': return hits === selectedTerms.length && hits > 0;
      case 'not': return hits === 0;
      case 'xor': return hits === 1;
    }
  };

  const keptNodes = graph.nodes.filter(keep);
  const keptIds = new Set(keptNodes.map(n => n.id));
  const keptLinks = graph.links.filter(l => {
    const s = typeof l.source === 'string' ? l.source : l.source.id;
    const t = typeof l.target === 'string' ? l.target : l.target.id;
    return keptIds.has(s) && keptIds.has(t);
  });
  return { nodes: keptNodes, links: keptLinks };
}

function buildModulesGraph(course: Course, allTerms: Term[]) {
  const nodes: GraphNode[] = course.modules.map(m => ({
    id: m.id, name: m.name, type: 'module',
  }));

  const links: GraphLink[] = [];
  const mods = course.modules;
  for (let i = 0; i < mods.length; i++) {
    for (let j = i + 1; j < mods.length; j++) {
      const a = mods[i].id, b = mods[j].id;
      const shared = allTerms
        .filter(t => t.moduleId === a)
        .filter(ta => allTerms.some(tb => tb.moduleId === b && tb.name === ta.name))
        .length;
      const weight = shared || (Math.abs(i - j) === 1 ? 2 : 1);
      links.push({
        source: a,
        target: b,
        type: (Math.abs(i - j) === 1 ? 'first-appearance' : 'mention') as LinkType,
        weight: Math.max(1, weight),
      });
    }
  }
  return { nodes, links };
}

function buildLessonsGraph(course: Course, drillModuleId: string | undefined) {
  const mod = course.modules.find(m => m.id === drillModuleId) || course.modules[0];
  if (!mod) return { nodes: [], links: [] };

  const nodes: GraphNode[] = mod.lessons.map(l => ({
    id: l.id, name: l.name, type: 'lesson', parentId: mod.id,
  }));

  const links: GraphLink[] = [];
  for (let i = 0; i < mod.lessons.length - 1; i++) {
    links.push({
      source: mod.lessons[i].id,
      target: mod.lessons[i + 1].id,
      type: 'first-appearance',
      weight: 3,
    });
  }
  if (mod.lessons.length >= 4) {
    links.push({ source: mod.lessons[0].id, target: mod.lessons[3].id, type: 'mention', weight: 2 });
  }
  return { nodes, links };
}

function buildTermsGraph(
  course: Course,
  allTerms: Term[],
  drillModuleId: string | undefined,
  drillLessonId: string | undefined,
  frequency: 'all' | 'first-appearance' | 'mention',
) {
  const mod = course.modules.find(m => m.id === drillModuleId);
  const lesson = mod?.lessons.find(l => l.id === drillLessonId) || mod?.lessons[0];
  if (!lesson) return { nodes: [], links: [] };

  const lessonTerms = allTerms.filter(t => t.lessonId === lesson.id);
  const centerId = `center-${lesson.id}`;

  // Synthesize link type from index parity (mirrors previous behaviour),
  // then apply the frequency filter to drop terms whose link doesn't match.
  const enriched = lessonTerms.map((t, i) => ({
    term: t,
    linkType: (i % 2 === 0 ? 'first-appearance' : 'mention') as LinkType,
    weight: 1 + (i % 3),
  }));
  const visible = frequency === 'all'
    ? enriched
    : enriched.filter(e => e.linkType === frequency);

  const nodes: GraphNode[] = [
    { id: centerId, name: lesson.name, type: 'lesson', parentId: lesson.id },
    ...visible.map(({ term: t }) => ({
      id: t.id, name: t.name, type: 'term' as const, status: t.status, parentId: lesson.id,
    })),
  ];

  const links: GraphLink[] = visible.map(e => ({
    source: centerId,
    target: e.term.id,
    type: e.linkType,
    weight: e.weight,
  }));

  return { nodes, links };
}
