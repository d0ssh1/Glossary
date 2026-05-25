import { useMemo } from 'react';
import { useApp } from '@/store/AppContext';
import { statusDotClass } from '@/lib/constants';
import type { Term } from '@/types';

/** Normalize term names the same way buildGraphData does, for consistent matching. */
function norm(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Right-panel state shown when the user clicks an edge in the graph.
 * Title: "Смежные термины «A» и «B»" — A and B are the names of the two endpoints.
 * Body: terms that appear in BOTH endpoints (by normalized name).
 *
 * "Appears in" depends on the current graph level:
 *   - modules: term.moduleId === endpoint.id
 *   - lessons: term.lessonId === endpoint.id
 *   - terms:   the edge connects a lesson hub to a term — show that single term.
 */
export default function LinkSelectedState() {
  const { state, dispatch } = useApp();
  const { activeLinkId, graphLevel, courses, activeCourseId, activeGlossaryId } = state;

  const activeCourse = courses.find(c => c.id === activeCourseId);
  const activeGlossary = courses.flatMap(c => c.glossaries).find(g => g.id === activeGlossaryId);
  const allTerms = activeGlossary?.terms || [];

  const { titleA, titleB, sharedTerms } = useMemo(() => {
    if (!activeLinkId || !activeCourse) {
      return { titleA: '', titleB: '', sharedTerms: [] as Term[] };
    }
    const [aId, bId] = activeLinkId.split('__');

    // Helpers to resolve endpoint name + the terms that "live" inside it.
    const resolve = (nodeId: string): { name: string; terms: Term[] } => {
      if (graphLevel === 'modules') {
        const m = activeCourse.modules.find(x => x.id === nodeId);
        const name = m?.name ?? nodeId;
        const terms = allTerms.filter(t => t.moduleId === nodeId);
        return { name, terms };
      }
      if (graphLevel === 'lessons') {
        for (const m of activeCourse.modules) {
          const l = m.lessons.find(x => x.id === nodeId);
          if (l) return { name: l.name, terms: allTerms.filter(t => t.lessonId === nodeId) };
        }
        return { name: nodeId, terms: [] };
      }
      // terms level: the source is a "center-<lessonId>" hub; the target is a term.
      if (nodeId.startsWith('center-')) {
        const lessonId = nodeId.replace(/^center-/, '');
        for (const m of activeCourse.modules) {
          const l = m.lessons.find(x => x.id === lessonId);
          if (l) return { name: l.name, terms: allTerms.filter(t => t.lessonId === lessonId) };
        }
        return { name: nodeId, terms: [] };
      }
      const t = allTerms.find(x => x.id === nodeId);
      return { name: t?.name ?? nodeId, terms: t ? [t] : [] };
    };

    const a = resolve(aId);
    const b = resolve(bId);

    // Shared = terms whose normalized name appears in both endpoints. Dedup by name.
    const namesB = new Set(b.terms.map(t => norm(t.name)));
    const seen = new Set<string>();
    const shared: Term[] = [];
    for (const t of a.terms) {
      const k = norm(t.name);
      if (namesB.has(k) && !seen.has(k)) {
        shared.push(t);
        seen.add(k);
      }
    }

    return { titleA: a.name, titleB: b.name, sharedTerms: shared };
  }, [activeLinkId, activeCourse, graphLevel, allTerms]);

  if (!activeLinkId) return null;

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="mb-3 border-b pb-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
        <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--lw-text-primary)' }}>
          Смежные термины: «{titleA}» и «{titleB}»
        </h3>
      </div>

      <p className="mb-2 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
        Общих терминов: {sharedTerms.length}
      </p>

      <div className="flex-1 overflow-y-auto lw-scrollbar">
        {sharedTerms.length === 0 ? (
          <p className="text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>
            Нет общих терминов.
          </p>
        ) : (
          sharedTerms.map(term => (
            <button
              key={term.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TERM', termId: term.id })}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors duration-200"
              style={{ color: 'var(--lw-text-primary)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <span className={`h-2 w-2 rounded-full ${statusDotClass[term.status]}`} />
              <span className="text-xs">{term.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
