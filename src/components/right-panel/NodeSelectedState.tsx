import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { statusDotClass } from '@/lib/constants';
import type { Term } from '@/types';

export default function NodeSelectedState() {
  const { state, dispatch } = useApp();
  const { activeNodeId, graphLevel, courses, activeGlossaryId } = state;
  const [nodeSearch, setNodeSearch] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeGlossary = courses.flatMap(c => c.glossaries).find(g => g.id === activeGlossaryId);
  const terms = activeGlossary?.terms || [];

  const nodeTerms = useMemo(() => {
    return terms
      .filter(t => {
        if (graphLevel === 'modules') return t.moduleId === activeNodeId;
        if (graphLevel === 'lessons') return t.lessonId === activeNodeId;
        return true;
      })
      .filter(t => !nodeSearch.trim() || t.name.toLowerCase().includes(nodeSearch.toLowerCase()));
  }, [terms, graphLevel, activeNodeId, nodeSearch]);

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

  return (
    <div className="flex h-full flex-col px-4 py-4">
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
