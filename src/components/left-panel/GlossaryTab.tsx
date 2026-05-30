import { useState, useMemo } from 'react';
import { Search, ChevronRight, ChevronDown } from 'lucide-react';
import { useApp, useApi } from '@/store/AppContext';
import { apiEnabled } from '@/lib/api';
import { statusDotClass } from '@/lib/constants';
import type { FilterStatus } from '@/types';

const STATUS_FILTERS: { value: FilterStatus; label: string; color?: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'no-trait', label: 'Без признака', color: 'var(--lw-error)' },
  { value: 'in-progress', label: 'В работе', color: 'var(--lw-warning)' },
  { value: 'ready', label: 'Готово', color: 'var(--lw-success)' },
];

export default function GlossaryTab() {
  const { state, dispatch } = useApp();
  const { filterStatus, searchTerm, selectedTermIds, hierFilterIds } = state;
  const [expandedLetters, setExpandedLetters] = useState<Record<string, boolean>>({});
  const { apiCollectBindings } = useApi();
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);

  const handleCollect = async () => {
    if (!state.activeGlossaryId || selectedTermIds.length === 0) return;
    setCollecting(true);
    setCollectMsg(null);
    try {
      if (apiEnabled()) {
        const report = await apiCollectBindings(state.activeGlossaryId, selectedTermIds);
        setCollectMsg(
          `Обработано ${report.terms_processed} терминов, создано ${report.bindings_created} связей.`,
        );
      } else {
        setCollectMsg('Демо-режим: для реального сбора нужен бэкенд (VITE_USE_API=1).');
      }
    } catch (err) {
      setCollectMsg(err instanceof Error ? err.message : 'Ошибка сбора данных');
    } finally {
      setCollecting(false);
      setTimeout(() => setCollectMsg(null), 4000);
    }
  };

  const activeGlossary = state.courses
    .flatMap(c => c.glossaries)
    .find(g => g.id === state.activeGlossaryId);
  const terms = activeGlossary?.terms || [];

  const groupedTerms = useMemo(() => {
    let filtered = terms;
    if (filterStatus !== 'all') filtered = filtered.filter(t => t.status === filterStatus);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(q));
    }
    if (hierFilterIds !== null) {
      filtered = filtered.filter(t =>
        (!t.moduleId || hierFilterIds.includes(t.moduleId)) &&
        (!t.lessonId || hierFilterIds.includes(t.lessonId))
      );
    }
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(t => {
      const letter = t.name[0]?.toUpperCase() || '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [terms, filterStatus, searchTerm, hierFilterIds]);

  const allFilteredIds = useMemo(
    () => groupedTerms.flatMap(([, items]) => items.map(t => t.id)),
    [groupedTerms],
  );
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedTermIds.includes(id));
  const hasSelection = selectedTermIds.length > 0;

  const toggleLetter = (letter: string) => {
    setExpandedLetters(prev => ({ ...prev, [letter]: !prev[letter] }));
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Total count */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
          Всего терминов: {terms.length}
        </p>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded border px-2.5 py-1.5"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)' }}>
          <Search size={13} style={{ color: 'var(--lw-text-muted)' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => dispatch({ type: 'SET_SEARCH_TERM', term: e.target.value })}
            placeholder="Поиск..."
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--lw-text-primary)' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-2">
        <p className="mb-1.5 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Фильтры:</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <label key={f.value} className="flex cursor-pointer items-center gap-1 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
              <input
                type="radio"
                name="filter-status"
                checked={filterStatus === f.value}
                onChange={() => dispatch({ type: 'SET_FILTER_STATUS', status: f.value })}
                className="accent-[var(--lw-accent-graphite)]"
              />
              {f.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />}
              {f.label}
            </label>
          ))}
        </div>
      </div>

      {/* Term list */}
      <div className={`flex-1 overflow-y-auto lw-scrollbar px-2 py-2 ${hasSelection ? 'pb-28' : ''}`}>
        {groupedTerms.map(([letter, items]) => {
          const isExpanded = expandedLetters[letter] !== false;
          const letterIds = items.map(t => t.id);
          const isLetterSelected = letterIds.every(id => selectedTermIds.includes(id));

          return (
            <div key={letter} className="mb-1">
              <button
                onClick={() => toggleLetter(letter)}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs font-semibold transition-colors duration-200"
                style={{ color: 'var(--lw-text-primary)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <input
                  type="checkbox"
                  checked={isLetterSelected}
                  onChange={e => {
                    e.stopPropagation();
                    if (isLetterSelected) {
                      dispatch({ type: 'SELECT_ALL_TERMS', termIds: selectedTermIds.filter(id => !letterIds.includes(id)) });
                    } else {
                      dispatch({ type: 'SELECT_ALL_TERMS', termIds: [...new Set([...selectedTermIds, ...letterIds])] });
                    }
                  }}
                  onClick={e => e.stopPropagation()}
                  className="mr-1 accent-[var(--lw-accent-graphite)]"
                />
                {letter}
              </button>
              {isExpanded && items.map(term => (
                <div
                  key={term.id}
                  className="ml-5 flex items-center gap-2 rounded px-2 py-1 transition-colors duration-200"
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTermIds.includes(term.id)}
                    onChange={() => dispatch({ type: 'TOGGLE_TERM_SELECTION', termId: term.id })}
                    className="accent-[var(--lw-accent-graphite)]"
                  />
                  <span className={`h-2 w-2 rounded-full ${statusDotClass[term.status]}`} />
                  <button
                    onClick={() => dispatch({ type: 'SET_ACTIVE_TERM', termId: term.id })}
                    className="flex-1 text-left text-xs transition-colors duration-200"
                    style={{ color: 'var(--lw-text-primary)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--lw-accent-amber)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--lw-text-primary)'; }}
                  >
                    {term.name}
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {groupedTerms.length === 0 && (
          <p className="px-4 py-4 text-center text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>
            Нет терминов
          </p>
        )}
      </div>

      {/* Floating action bar — only when selection exists */}
      {hasSelection && (
        <div
          className="absolute bottom-0 left-0 right-0 border-t px-4 py-3 backdrop-blur"
          style={{
            borderColor: 'var(--lw-border-primary)',
            backgroundColor: 'color-mix(in srgb, var(--lw-bg-panel) 92%, transparent)',
            animation: 'slideUp 0.2s cubic-bezier(0.25,0.1,0.25,1)',
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => {
                  if (isAllSelected) dispatch({ type: 'DESELECT_ALL_TERMS' });
                  else dispatch({ type: 'SELECT_ALL_TERMS', termIds: allFilteredIds });
                }}
                className="accent-[var(--lw-accent-graphite)]"
              />
              Выбрать всё
            </label>
            <span className="text-xs" style={{ color: 'var(--lw-text-muted)' }}>
              Выбрано: {selectedTermIds.length}
            </span>
          </div>
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="w-full rounded py-2 text-xs font-medium transition-all duration-200 disabled:opacity-50"
            style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
          >
            {collecting ? 'Сбор данных...' : 'Собрать данные для глоссария'}
          </button>
          {collectMsg && (
            <p className="mt-2 text-[11px] leading-relaxed"
              style={{ color: 'var(--lw-text-secondary)' }}>
              {collectMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
