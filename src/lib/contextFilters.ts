// ============================================================
// CONTEXT-TAB FILTERS — apply the graph's frequency/logic filters to the
// term lists shown in the right "Контекст" panel.
//
// The graph already filters term *nodes* at the terms level, but the modules/
// lessons/steps levels list their terms in the side panel without honouring the
// filters. Anton's example: with "Только первое появление", the term «тег» must
// disappear from the HTML→JS/CSS modules where it isn't first seen. These
// helpers compute a term's first-appearance location (in course reading order)
// and prune the list accordingly.
// ============================================================
import type { Course, Term, GraphLevel } from '@/types';
import type { FrequencyMode, LogicMode } from '@/store/AppContext';

export interface OrderIndex {
  module: Map<string, number>;
  lesson: Map<string, number>;
  step: Map<string, number>;
}

/** Reading-order index of every module/lesson/step id in the course. */
export function buildOrderIndex(course: Course | undefined): OrderIndex {
  const module = new Map<string, number>();
  const lesson = new Map<string, number>();
  const step = new Map<string, number>();
  let mi = 0, li = 0, si = 0;
  for (const m of course?.modules ?? []) {
    module.set(m.id, mi++);
    for (const l of m.lessons) {
      lesson.set(l.id, li++);
      for (const s of l.steps) step.set(s.id, si++);
    }
  }
  return { module, lesson, step };
}

// The terms level lives inside a step, so it shares the step granularity.
function effectiveLevel(level: GraphLevel): 'modules' | 'lessons' | 'steps' {
  if (level === 'modules') return 'modules';
  if (level === 'lessons') return 'lessons';
  return 'steps';
}

/** Location ids (at the given granularity) where the term appears, via real
 *  bindings with a home-field fallback. */
function termLocations(t: Term, level: GraphLevel): string[] {
  const eff = effectiveLevel(level);
  if (eff === 'modules') {
    const ids = t.connections.map(c => c.moduleId).filter(Boolean);
    if (ids.length === 0 && t.moduleId) ids.push(t.moduleId);
    return ids;
  }
  if (eff === 'lessons') {
    const ids = t.connections.map(c => c.lessonId).filter(Boolean);
    if (ids.length === 0 && t.lessonId) ids.push(t.lessonId);
    return ids;
  }
  return t.connections.map(c => c.stepId).filter(Boolean);
}

function orderMap(idx: OrderIndex, level: GraphLevel): Map<string, number> {
  const eff = effectiveLevel(level);
  return eff === 'modules' ? idx.module : eff === 'lessons' ? idx.lesson : idx.step;
}

/** The id (at this level) where the term first appears in course reading order. */
export function firstAppearanceId(t: Term, level: GraphLevel, idx: OrderIndex): string | undefined {
  const order = orderMap(idx, level);
  let best: string | undefined;
  let bestPos = Number.MAX_SAFE_INTEGER;
  for (const id of termLocations(t, level)) {
    const pos = order.get(id);
    if (pos !== undefined && pos < bestPos) { bestPos = pos; best = id; }
  }
  return best;
}

/**
 * Keep only terms consistent with the frequency filter, relative to the
 * location(s) currently in view (one node, or an edge's two endpoints):
 *   - 'first-appearance' → the term's first appearance is one of these ids
 *   - 'mention'          → the term appears here but first appeared elsewhere
 */
export function applyFrequencyToContextTerms(
  terms: Term[],
  level: GraphLevel,
  currentIds: string[],
  frequency: FrequencyMode,
  idx: OrderIndex,
): Term[] {
  if (frequency === 'all' || currentIds.length === 0) return terms;
  const here = new Set(currentIds.filter(Boolean));
  if (here.size === 0) return terms;
  return terms.filter(t => {
    const first = firstAppearanceId(t, level, idx);
    const isFirstHere = first !== undefined && here.has(first);
    return frequency === 'first-appearance' ? isFirstHere : !isFirstHere;
  });
}

/**
 * Mirror the graph's logical filter on the context list. When terms are ticked
 * in the left panel and a boolean op is active, the list narrows to the terms
 * the operation is about:
 *   - 'or'  → no change (default)
 *   - 'and'/'xor' → only the selected terms present here
 *   - 'not' → only the non-selected terms present here
 */
export function applyLogicToContextTerms(
  terms: Term[],
  selectedTermIds: string[],
  logic: LogicMode,
): Term[] {
  if (selectedTermIds.length === 0 || logic === 'or') return terms;
  const sel = new Set(selectedTermIds);
  if (logic === 'not') return terms.filter(t => !sel.has(t.id));
  return terms.filter(t => sel.has(t.id));
}
