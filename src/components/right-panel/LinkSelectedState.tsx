import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { statusDotClass } from '@/lib/constants';
import type { Term } from '@/types';

/** Normalize term names the same way buildGraphData does, for consistent matching. */
function norm(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Right-panel state shown when the user clicks an edge in the graph.
 * Title: "Смежные термины: «A» и «B»" — A and B are the names of the two endpoints.
 * Body: terms that appear in BOTH endpoints (by normalized name), grouped by
 *       first letter, searchable, with an expand/collapse-all control —
 *       mirrors the spec mockup and the layout of NodeSelectedState.
 *
 * "Appears in" depends on the current graph level:
 *   - modules: term.moduleId === endpoint.id
 *   - lessons: term.lessonId === endpoint.id
 *   - terms:   the edge connects a lesson hub to a term — show that single term.
 */
export default function LinkSelectedState() {
  const { state, dispatch } = useApp();
  const { activeLinkId, graphLevel, courses, activeCourseId, activeGlossaryId } = state;
  const [linkSearch, setLinkSearch] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeCourse = courses.find(c => c.id === activeCourseId);
  const activeGlossary = courses.flatMap(c => c.glossaries).find(g => g.id === activeGlossaryId);
  const allTerms = activeGlossary?.terms || [];

  const { titleA, titleB, sharedTerms } = useMemo(() => {
    if (!activeLinkId || !activeCourse) {
      return { titleA: '', titleB: '', sharedTerms: [] as Term[] };
    }
    const [aId, bId] = activeLinkId.split('__');

    const resolve = (nodeId: string): { name: string; terms: Term[] } => {
      if (graphLevel === 'modules') {
        const m = activeCourse.modules.find(x => x.id === nodeId);
        return { name: m?.name ?? nodeId, terms: allTerms.filter(t => t.moduleId === nodeId) };
      }
      if (graphLevel === 'lessons') {
        for (const m of activeCourse.modules) {
          const l = m.lessons.find(x => x.id === nodeId);
          if (l) return { name: l.name, terms: allTerms.filter(t => t.lessonId === nodeId) };
        }
        return { name: nodeId, terms: [] };
      }
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

  const filteredShared = useMemo(() => {
    if (!linkSearch.trim()) return sharedTerms;
    const q = linkSearch.toLowerCase();
    return sharedTerms.filter(t => t.name.toLowerCase().includes(q));
  }, [sharedTerms, linkSearch]);

  const grouped = useMemo(() => {
    const g: Record<string, Term[]> = {};
    filteredShared.forEach(t => {
      const letter = t.name[0]?.toUpperCase() || '#';
      if (!g[letter]) g[letter] = [];
      g[letter].push(t);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredShared]);

  const handleToggleAll = () => {
    const newVal = !allExpanded;
    setAllExpanded(newVal);
    const next: Record<string, boolean> = {};
    grouped.forEach(([letter]) => { next[letter] = newVal; });
    setExpanded(next);
  };

  if (!activeLinkId) return null;

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="mb-3 border-b pb-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
        <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--lw-text-primary)' }}>
          Смежные термины: «{titleA}» и «{titleB}»
        </h3>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
          Терминов: {sharedTerms.length}
        </p>
        {sharedTerms.length > 0 && (
          <button
            onClick={handleToggleAll}
            className="rounded px-2 py-0.5 text-xs font-medium transition-colors duration-200"
            style={{ color: 'var(--lw-accent-amber)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {allExpanded ? 'Скрыть всё' : 'Раскрыть всё'}
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded border px-2.5 py-1.5"
        style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)' }}>
        <Search size={13} style={{ color: 'var(--lw-text-muted)' }} />
        <input
          type="text"
          value={linkSearch}
          onChange={e => setLinkSearch(e.target.value)}
          placeholder="поиск..."
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--lw-text-primary)' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto lw-scrollbar">
        {grouped.length === 0 && (
          <p className="text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>
            Нет общих терминов.
          </p>
        )}
        {grouped.map(([letter, items]) => {
          const isExpanded = expanded[letter] !== false;
          return (
            <div key={letter} className="mb-1">
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [letter]: !prev[letter] }))}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs font-semibold"
                style={{ color: 'var(--lw-text-primary)' }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                ({items.length}) {letter}
              </button>
              {isExpanded && items.map(term => (
                <button
                  key={term.id}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TERM', termId: term.id })}
                  className="ml-5 flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors duration-200"
                  style={{ color: 'var(--lw-text-primary)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span className={`h-2 w-2 rounded-full ${statusDotClass[term.status]}`} />
                  <span className="text-xs">{term.name}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
