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
  /** Step the user drilled into (terms level lives inside a step). */
  drillStepId?: string | undefined;
  hierFilterIds: string[] | null;
  filters: GraphFilters;
  /** Glossary term IDs the user ticked in the left panel (used by logic-mode filtering). */
  selectedTermIds: string[];
}

export function buildGraphData(
  level: GraphLevel,
  opts: BuildOptions,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const { course, allTerms, drillModuleId, drillLessonId, drillStepId, hierFilterIds, filters, selectedTermIds } = opts;
  if (!course) return { nodes: [], links: [] };

  // Hierarchy is a *scope*, not a delete: all module/lesson nodes stay on the
  // canvas, but a term only "counts" toward edges/membership when its binding
  // lives in a lesson the user kept ticked. This is what Anton asked for —
  // picking items changes WHERE the other filters apply, instead of chopping
  // the picture. `null` means "everything in scope".
  const scope = hierFilterIds === null ? null : new Set(hierFilterIds);

  // Navigation hierarchy: modules → lessons → steps → terms.
  let result: { nodes: GraphNode[]; links: GraphLink[] };
  if (level === 'modules') result = buildModulesGraph(course, allTerms, scope);
  else if (level === 'lessons') result = buildLessonsGraph(course, allTerms, drillModuleId, scope);
  else if (level === 'steps') result = buildStepsGraph(course, allTerms, drillModuleId, drillLessonId, scope);
  else result = buildTermsGraph(course, allTerms, drillModuleId, drillLessonId, drillStepId, filters.frequency);

  // Weight filter — drop edges outside [from, to], then drop orphaned non-center nodes.
  if (filters.weightEnabled) {
    const { weightFrom, weightTo } = filters;
    result.links = result.links.filter(l => {
      const w = l.weight ?? 1;
      return w >= weightFrom && w <= weightTo;
    });
    result.nodes = dropOrphans(result.nodes, result.links);
  }

  // Logical filter (requires selected terms in the left panel). Honour the
  // hierarchy scope so membership matches what the rest of the view shows.
  if (selectedTermIds.length > 0 && filters.logic !== 'or') {
    result = applyLogicFilter(result, allTerms, selectedTermIds, filters.logic, level, scope);
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
  // Keep centre hubs (lesson at terms level, step at steps/terms level) even
  // if their edges were filtered out.
  return nodes.filter(n => touched.has(n.id) || n.type === 'lesson' || n.type === 'step');
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
  scope: Set<string> | null,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const selectedTerms = allTerms.filter(t => selectedTermIds.includes(t.id));

  const isConnected = (node: GraphNode): number => {
    if (level === 'terms') return selectedTermIds.includes(node.id) ? 1 : 0;
    const check = (t: Term) =>
      level === 'modules' ? termInModule(t, node.id, scope)
        : level === 'steps' ? termInStep(t, node.id)
        : termInLesson(t, node.id, scope);
    return selectedTerms.reduce((acc, t) => acc + (check(t) ? 1 : 0), 0);
  };

  const keep = (node: GraphNode): boolean => {
    // Don't filter the centre hub at the terms level — it's the anchor.
    if (level === 'terms' && (node.type === 'lesson' || node.type === 'step')) return true;
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

/**
 * Is the term "present" in the given module? Uses the real bindings
 * (`term.connections[]`) first — a single term can be bound to steps across
 * many modules. Falls back to `term.moduleId` (the legacy single-home field)
 * when connections haven't been populated (e.g. before "Собрать данные").
 */
function termInModule(t: Term, moduleId: string, scope?: Set<string> | null): boolean {
  if (t.connections.some(c => c.moduleId === moduleId && (!scope || scope.has(c.lessonId)))) return true;
  return t.moduleId === moduleId && (!scope || (!!t.lessonId && scope.has(t.lessonId)));
}

/** Same idea, scoped to a single lesson. */
function termInLesson(t: Term, lessonId: string, scope?: Set<string> | null): boolean {
  if (!scope || scope.has(lessonId)) {
    if (t.connections.some(c => c.lessonId === lessonId)) return true;
    if (t.lessonId === lessonId) return true;
  }
  return false;
}

/** Is the term bound to a specific step? Step-level membership relies purely on
 *  real bindings (`connections[].stepId`) — there's no legacy single-home step. */
function termInStep(t: Term, stepId: string): boolean {
  return t.connections.some(c => c.stepId === stepId);
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
 * Heavier edges → thicker line; d3/vis-network naturally pulls hubs toward
 * the centre.
 */
function buildModulesGraph(course: Course, allTerms: Term[], scope: Set<string> | null) {
  const nodes: GraphNode[] = course.modules.map(m => ({
    id: m.id, name: m.name, type: 'module',
  }));

  const termsByModule = new Map<string, Term[]>();
  for (const m of course.modules) termsByModule.set(m.id, []);
  for (const t of allTerms) {
    for (const m of course.modules) {
      if (termInModule(t, m.id, scope)) termsByModule.get(m.id)!.push(t);
    }
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
 * by shared terms between each pair of lessons in that module.
 */
function buildLessonsGraph(course: Course, allTerms: Term[], drillModuleId: string | undefined, scope: Set<string> | null) {
  const mod = course.modules.find(m => m.id === drillModuleId) || course.modules[0];
  if (!mod) return { nodes: [], links: [] };

  const nodes: GraphNode[] = mod.lessons.map(l => ({
    id: l.id, name: l.name, type: 'lesson', parentId: mod.id,
  }));

  const termsByLesson = new Map<string, Term[]>();
  for (const l of mod.lessons) termsByLesson.set(l.id, []);
  for (const t of allTerms) {
    if (!termInModule(t, mod.id, scope)) continue;
    for (const l of mod.lessons) {
      if (termInLesson(t, l.id, scope)) termsByLesson.get(l.id)!.push(t);
    }
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
 * Steps level (drilled into one lesson): one node per step, edges weighted by
 * shared terms between each pair of steps. Same convention as the lessons
 * level — thicker/brighter edge means more shared terms.
 */
function buildStepsGraph(
  course: Course,
  allTerms: Term[],
  drillModuleId: string | undefined,
  drillLessonId: string | undefined,
  scope: Set<string> | null,
) {
  const mod = course.modules.find(m => m.id === drillModuleId) || course.modules[0];
  const lesson = mod?.lessons.find(l => l.id === drillLessonId) || mod?.lessons[0];
  if (!lesson) return { nodes: [], links: [] };

  const nodes: GraphNode[] = lesson.steps.map(s => ({
    id: s.id, name: s.name, type: 'step', parentId: lesson.id,
  }));

  // Bucket terms per step via real bindings (respecting the hierarchy scope at
  // the lesson granularity).
  const inScope = !scope || scope.has(lesson.id);
  const termsByStep = new Map<string, Term[]>();
  for (const s of lesson.steps) termsByStep.set(s.id, []);
  if (inScope) {
    for (const t of allTerms) {
      for (const s of lesson.steps) {
        if (termInStep(t, s.id)) termsByStep.get(s.id)!.push(t);
      }
    }
  }

  const links: GraphLink[] = [];
  const steps = lesson.steps;
  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length; j++) {
      const a = steps[i].id, b = steps[j].id;
      const shared = sharedTermCount(termsByStep.get(a) || [], termsByStep.get(b) || []);
      if (shared === 0) continue;
      links.push({ id: `${a}__${b}`, source: a, target: b, type: 'first-appearance', weight: shared });
    }
  }
  return { nodes, links };
}

/**
 * Terms level (drilled into one step, or a lesson when no step is selected):
 * central hub + a node per term bound there. Link colour distinguishes
 * first-appearance (black) vs later mention (grey), decided by the earliest
 * lesson in the course where the term shows up.
 */
function buildTermsGraph(
  course: Course,
  allTerms: Term[],
  drillModuleId: string | undefined,
  drillLessonId: string | undefined,
  drillStepId: string | undefined,
  frequency: 'all' | 'first-appearance' | 'mention',
) {
  const mod = course.modules.find(m => m.id === drillModuleId);
  const lesson = mod?.lessons.find(l => l.id === drillLessonId) || mod?.lessons[0];
  if (!lesson) return { nodes: [], links: [] };

  // Prefer scoping to the drilled step; fall back to the whole lesson (legacy
  // path / direct deep-link without a step in the breadcrumb).
  const step = drillStepId ? lesson.steps.find(s => s.id === drillStepId) : undefined;

  const lessonOrder = buildLessonOrder(course);
  const currentPos = lessonOrder.get(lesson.id) ?? Number.MAX_SAFE_INTEGER;
  const scopedTerms = step
    ? allTerms.filter(t => termInStep(t, step.id))
    : allTerms.filter(t => termInLesson(t, lesson.id));
  const centerNode = step
    ? { id: `center-${step.id}`, name: step.name, type: 'step' as const, parentId: step.id }
    : { id: `center-${lesson.id}`, name: lesson.name, type: 'lesson' as const, parentId: lesson.id };
  const centerId = centerNode.id;
  const lessonTerms = scopedTerms;

  // Earliest course position where a term with the same (normalized) name
  // first appears in the course. We consider every place we know about:
  //  - the term's "home" lesson field (legacy primary-binding pointer)
  //  - every binding/connection lessonId (true cross-module presence)
  //  - any populated occurrences[] (after the modal lazy-fetches them)
  const earliestByName = new Map<string, number>();
  for (const t of allTerms) {
    const key = norm(t.name);
    const positions: number[] = [];
    const homePos = lessonOrder.get(t.lessonId);
    if (homePos !== undefined) positions.push(homePos);
    for (const c of t.connections) {
      const p = lessonOrder.get(c.lessonId);
      if (p !== undefined) positions.push(p);
    }
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
    // Weight = occurrences in this scope (step if drilled into one, else lesson).
    const localOccs = step
      ? (t.occurrences || []).filter(o => o.stepId === step.id).length
      : (t.occurrences || []).filter(o => o.lessonId === lesson.id).length;
    return { term: t, linkType, weight: Math.max(1, localOccs) };
  });

  const visible = frequency === 'all'
    ? enriched
    : enriched.filter(e => e.linkType === frequency);

  const nodes: GraphNode[] = [
    centerNode,
    ...visible.map(({ term: t }) => ({
      id: t.id, name: t.name, type: 'term' as const, status: t.status, parentId: centerNode.parentId,
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
