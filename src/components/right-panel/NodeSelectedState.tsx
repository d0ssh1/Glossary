import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp, useApi } from '@/store/AppContext';
import { statusDotClass } from '@/lib/constants';
import type { Term } from '@/types';

export default function NodeSelectedState() {
  const { state, dispatch } = useApp();
  const { apiSetFtsIndexed } = useApi();
  const { activeNodeId, graphLevel, courses, activeGlossaryId, activeCourseId, breadcrumbs } = state;
  // On the terms-level the "selected node" is actually the lesson hub —
  // derived from the breadcrumb that initiated this drill-down. Used to scope
  // both the title/FTS toggle and the term list.
  const lessonDrillId = breadcrumbs.find(b => b.level === 'terms')?.id ?? null;
  const [nodeSearch, setNodeSearch] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeGlossary = courses.flatMap(c => c.glossaries).find(g => g.id === activeGlossaryId);
  const terms = activeGlossary?.terms || [];
  const activeCourse = courses.find(c => c.id === activeCourseId);

  // Resolve the selected node — title and current FTS-indexed flag (the FTS
  // toggle isn't shown on terms-level since terms don't carry the flag).
  const nodeInfo = useMemo(() => {
    if (!activeCourse) return null;
    if (graphLevel === 'modules' && activeNodeId) {
      const m = activeCourse.modules.find(x => x.id === activeNodeId);
      return m ? { name: m.name, type: 'module' as const, indexed: m.isIndexed ?? true } : null;
    }
    if (graphLevel === 'lessons' && activeNodeId) {
      for (const m of activeCourse.modules) {
        const l = m.lessons.find(x => x.id === activeNodeId);
        if (l) return { name: l.name, type: 'lesson' as const, indexed: l.isIndexed ?? true };
      }
    }
    // terms-level: scope to the drilled lesson (kept in breadcrumbs, not activeNodeId
    // because activeNodeId on terms-level holds the *term* selection state).
    if (graphLevel === 'terms' && lessonDrillId) {
      for (const m of activeCourse.modules) {
        const l = m.lessons.find(x => x.id === lessonDrillId);
        if (l) return { name: l.name, type: 'lesson' as const, indexed: l.isIndexed ?? true };
      }
    }
    return null;
  }, [activeCourse, activeNodeId, graphLevel, lessonDrillId]);

  const nodeTerms = useMemo(() => {
    return terms
      .filter(t => {
        if (graphLevel === 'modules') return t.moduleId === activeNodeId;
        if (graphLevel === 'lessons') return t.lessonId === activeNodeId;
        // terms-level: list terms of the drilled lesson, not the whole glossary.
        if (graphLevel === 'terms' && lessonDrillId) return t.lessonId === lessonDrillId;
        return true;
      })
      .filter(t => !nodeSearch.trim() || t.name.toLowerCase().includes(nodeSearch.toLowerCase()));
  }, [terms, graphLevel, activeNodeId, lessonDrillId, nodeSearch]);

  const grouped = useMemo(() => {
    const g: Record<string, Term[]> = {};
    nodeTerms.forEach(t => {
      const letter = t.name[0]?.toUpperCase() || '#';
      if (!g[letter]) g[letter] = [];
      g[letter].push(t);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [nodeTerms]);

  const handleToggleAll = () => {
    const newVal = !allExpanded;
    setAllExpanded(newVal);
    const next: Record<string, boolean> = {};
    grouped.forEach(([letter]) => { next[letter] = newVal; });
    setExpanded(next);
  };

  const handleToggleIndexed = () => {
    if (!nodeInfo || !activeNodeId) return;
    apiSetFtsIndexed(nodeInfo.type, activeNodeId, !nodeInfo.indexed);
  };

  return (
    <div className="flex h-full flex-col px-4 py-4">
      {/* Node title + FTS-indexed toggle (hidden on terms level — handled elsewhere). */}
      {nodeInfo && (
        <div className="mb-3 border-b pb-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
          <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--lw-text-primary)' }}>
            {nodeInfo.name}
          </h3>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
            <input
              type="checkbox"
              checked={nodeInfo.indexed}
              onChange={handleToggleIndexed}
              className="h-3.5 w-3.5 cursor-pointer accent-[var(--lw-accent-amber)]"
            />
            <span>Участвует в поиске FTS (Индексировать)</span>
          </label>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
          Терминов: {nodeTerms.length}
        </p>
        {nodeTerms.length > 0 && (
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
          value={nodeSearch}
          onChange={e => setNodeSearch(e.target.value)}
          placeholder="поиск..."
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--lw-text-primary)' }}
        />
      </div>

      <div className="flex-1 overflow-y-auto lw-scrollbar">
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
