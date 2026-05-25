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
  else if (level === 'lessons') result = buildLessonsGraph(filtered, allTerms, drillModuleId);
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

/** Normalize term names for cross-module/lesson sharing comparison. */
function norm(name: string): string {
  return name.trim().toLowerCase();
}

/** Count shared terms (by normalized name) between two groups. */
function sharedTermCount(a: Term[], b: Term[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const namesB = new Set(b.map(t => norm(t.name)));
  let n = 0;
  const seen = new Set<string>();
  for (const t of a) {
    const k = norm(t.name);
    if (!seen.has(k) && namesB.has(k)) {
      n += 1;
      seen.add(k);
    }
  }
  return n;
}

/**
 * Build a global lesson ordering across the whole course (module.position →
 * lesson.position via the modules[] / lessons[] array order). Used to decide
 * whether a given lesson is the FIRST appearance of a term in the course.
 */
function buildLessonOrder(course: Course): Map<string, number> {
  const out = new Map<string, number>();
  let i = 0;
  for (const m of course.modules) {
    for (const l of m.lessons) {
      out.set(l.id, i++);
    }
  }
  return out;
}

/**
 * Modules level: one node per module, edges weighted by the number of shared
 * terms (by name) between each pair. Pairs with zero shared terms get no edge.
 * Heavier edges → thicker line (rendered by D3Graph via `weight`); d3-force
 * naturally pulls hubs (modules with many incident edges) toward the centre.
 */
function buildModulesGraph(course: Course, allTerms: Term[]) {
  const nodes: GraphNode[] = course.modules.map(m => ({
    id: m.id, name: m.name, type: 'module',
  }));

  // Pre-bucket terms by module for O(M^2) pair scan instead of O(M^2 * T).
  const termsByModule = new Map<string, Term[]>();
  for (const t of allTerms) {
    const arr = termsByModule.get(t.moduleId) || [];
    arr.push(t);
    termsByModule.set(t.moduleId, arr);
  }

  const links: GraphLink[] = [];
  const mods = course.modules;
  for (let i = 0; i < mods.length; i++) {
    for (let j = i + 1; j < mods.length; j++) {
      const a = mods[i].id, b = mods[j].id;
      const shared = sharedTermCount(
        termsByModule.get(a) || [],
        termsByModule.get(b) || [],
      );
      if (shared === 0) continue;
      links.push({
        id: `${a}__${b}`,
        source: a,
        target: b,
        type: 'first-appearance',
        weight: shared,
      });
    }
  }
  return { nodes, links };
}

/**
 * Lessons level (drilled into one module): one node per lesson, edges weighted
 * by shared terms between each pair of lessons in that module. Same colour
 * convention as modules level — thickness/intensity scales with the weight.
 */
function buildLessonsGraph(course: Course, allTerms: Term[], drillModuleId: string | undefined) {
  const mod = course.modules.find(m => m.id === drillModuleId) || course.modules[0];
  if (!mod) return { nodes: [], links: [] };

  const nodes: GraphNode[] = mod.lessons.map(l => ({
    id: l.id, name: l.name, type: 'lesson', parentId: mod.id,
  }));

  const termsByLesson = new Map<string, Term[]>();
  for (const t of allTerms) {
    if (t.moduleId !== mod.id) continue;
    const arr = termsByLesson.get(t.lessonId) || [];
    arr.push(t);
    termsByLesson.set(t.lessonId, arr);
  }

  const links: GraphLink[] = [];
  const lessons = mod.lessons;
  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i].id, b = lessons[j].id;
      const shared = sharedTermCount(
        termsByLesson.get(a) || [],
        termsByLesson.get(b) || [],
      );
      if (shared === 0) continue;
      links.push({
        id: `${a}__${b}`,
        source: a,
        target: b,
        type: 'first-appearance',
        weight: shared,
      });
    }
  }
  return { nodes, links };
}

/**
 * Terms level (drilled into one lesson): central lesson hub + a node per term
 * belonging to the lesson. Link colour distinguishes first-appearance (black)
 * vs later mention (grey) — derived from the term's `occurrences[]`. If the
 * current lesson is the earliest lesson in the course where the term shows up,
 * the link is 'first-appearance'; otherwise 'mention'. Terms with no
 * occurrences fall back to first-appearance (they're declared right here).
 */
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

  const lessonOrder = buildLessonOrder(course);
  const currentPos = lessonOrder.get(lesson.id) ?? Number.MAX_SAFE_INTEGER;
  const lessonTerms = allTerms.filter(t => t.lessonId === lesson.id);
  const centerId = `center-${lesson.id}`;

  // Earliest course position where any term with the same (normalized) name
  // first appears — accounting for cross-lesson declarations and occurrences.
  // Two terms with the same display name in different lessons are treated as
  // the same concept for "first appearance" purposes.
  const earliestByName = new Map<string, number>();
  for (const t of allTerms) {
    const key = norm(t.name);
    const positions: number[] = [];
    const homePos = lessonOrder.get(t.lessonId);
    if (homePos !== undefined) positions.push(homePos);
    for (const occ of t.occurrences || []) {
      const p = lessonOrder.get(occ.lessonId);
      if (p !== undefined) positions.push(p);
    }
    if (positions.length === 0) continue;
    const minPos = Math.min(...positions);
    const prev = earliestByName.get(key);
    earliestByName.set(key, prev === undefined ? minPos : Math.min(prev, minPos));
  }

  const enriched = lessonTerms.map(t => {
    const earliest = earliestByName.get(norm(t.name)) ?? currentPos;
    const linkType: LinkType = earliest >= currentPos ? 'first-appearance' : 'mention';
    // Weight = occurrences in THIS lesson (visual frequency cue), min 1.
    const localOccs = (t.occurrences || []).filter(o => o.lessonId === lesson.id).length;
    return { term: t, linkType, weight: Math.max(1, localOccs) };
  });

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
    id: `${centerId}__${e.term.id}`,
    source: centerId,
    target: e.term.id,
    type: e.linkType,
    weight: e.weight,
  }));

  return { nodes, links };
}
