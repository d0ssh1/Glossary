import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp, useApi } from '@/store/AppContext';
import { statusDotClass } from '@/lib/constants';
import { buildOrderIndex, applyFrequencyToContextTerms, applyLogicToContextTerms } from '@/lib/contextFilters';
import type { Term } from '@/types';

export default function NodeSelectedState() {
  const { state, dispatch } = useApp();
  const { apiSetFtsIndexed } = useApi();
  const { activeNodeId, graphLevel, courses, activeGlossaryId, activeCourseId, breadcrumbs, graphFilters, selectedTermIds, readOnly } = state;
  // On the terms-level the "selected node" is actually the centre hub (a step,
  // or a lesson when no step was drilled into) — derived from the breadcrumb
  // that initiated this drill-down. Used to scope title and the term list.
  const stepDrillId = breadcrumbs.find(b => b.level === 'terms')?.id ?? null;
  const [nodeSearch, setNodeSearch] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeGlossary = courses.flatMap(c => c.glossaries).find(g => g.id === activeGlossaryId);
  const terms = activeGlossary?.terms || [];
  const activeCourse = courses.find(c => c.id === activeCourseId);

  // Resolve the selected node — title + FTS-indexed flag. Only module/lesson
  // expose an FTS toggle (`togglable`); steps/terms don't.
  const nodeInfo = useMemo(() => {
    if (!activeCourse) return null;
    if (graphLevel === 'modules' && activeNodeId) {
      const m = activeCourse.modules.find(x => x.id === activeNodeId);
      return m ? { name: m.name, toggleType: 'module' as const, indexed: m.isIndexed ?? true, togglable: true } : null;
    }
    if (graphLevel === 'lessons' && activeNodeId) {
      for (const m of activeCourse.modules) {
        const l = m.lessons.find(x => x.id === activeNodeId);
        if (l) return { name: l.name, toggleType: 'lesson' as const, indexed: l.isIndexed ?? true, togglable: true };
      }
    }
    // steps-level: the selected node is a step (no FTS toggle).
    if (graphLevel === 'steps' && activeNodeId) {
      for (const m of activeCourse.modules)
        for (const l of m.lessons) {
          const s = l.steps.find(x => x.id === activeNodeId);
          if (s) return { name: s.name, toggleType: null, indexed: true, togglable: false };
        }
    }
    // terms-level: title comes from the drilled step (or lesson) in breadcrumbs.
    if (graphLevel === 'terms' && stepDrillId) {
      for (const m of activeCourse.modules) {
        for (const l of m.lessons) {
          const s = l.steps.find(x => x.id === stepDrillId);
          if (s) return { name: s.name, toggleType: null, indexed: true, togglable: false };
        }
        const l = m.lessons.find(x => x.id === stepDrillId);
        if (l) return { name: l.name, toggleType: null, indexed: true, togglable: false };
      }
    }
    return null;
  }, [activeCourse, activeNodeId, graphLevel, stepDrillId]);

  const orderIdx = useMemo(() => buildOrderIndex(activeCourse), [activeCourse]);

  const nodeTerms = useMemo(() => {
    // Match against real bindings (term.connections). Fall back to the legacy
    // moduleId/lessonId home-field when bindings haven't been collected yet.
    const inModule = (t: typeof terms[number], mid: string) =>
      t.connections.some(c => c.moduleId === mid) || t.moduleId === mid;
    const inLesson = (t: typeof terms[number], lid: string) =>
      t.connections.some(c => c.lessonId === lid) || t.lessonId === lid;
    const inStep = (t: typeof terms[number], sid: string) =>
      t.connections.some(c => c.stepId === sid);
    const membership = terms.filter(t => {
      if (graphLevel === 'modules' && activeNodeId) return inModule(t, activeNodeId);
      if (graphLevel === 'lessons' && activeNodeId) return inLesson(t, activeNodeId);
      if (graphLevel === 'steps' && activeNodeId) return inStep(t, activeNodeId);
      // terms-level: scope to the drilled step (or lesson fallback).
      if (graphLevel === 'terms' && stepDrillId) return inStep(t, stepDrillId) || inLesson(t, stepDrillId);
      return true;
    });
    // Honour the frequency/logic filters here too, so e.g. "первое появление"
    // hides a term from every node except the one it first appears in.
    const currentId = graphLevel === 'terms' ? stepDrillId : activeNodeId;
    let visible = applyFrequencyToContextTerms(
      membership, graphLevel, currentId ? [currentId] : [], graphFilters.frequency, orderIdx,
    );
    visible = applyLogicToContextTerms(visible, selectedTermIds, graphFilters.logic);
    return visible.filter(t => !nodeSearch.trim() || t.name.toLowerCase().includes(nodeSearch.toLowerCase()));
  }, [terms, graphLevel, activeNodeId, stepDrillId, nodeSearch, graphFilters.frequency, graphFilters.logic, selectedTermIds, orderIdx]);

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
    if (!nodeInfo || !activeNodeId || !nodeInfo.togglable || !nodeInfo.toggleType) return;
    apiSetFtsIndexed(nodeInfo.toggleType, activeNodeId, !nodeInfo.indexed);
  };

  return (
    <div className="flex h-full flex-col px-4 py-4">
      {/* Node title + FTS-indexed toggle (hidden on terms level — handled elsewhere). */}
      {nodeInfo && (
        <div className="mb-3 border-b pb-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
          <h3 className="text-sm font-semibold leading-snug" style={{ color: 'var(--lw-text-primary)' }}>
            {nodeInfo.name}
          </h3>
          {nodeInfo.togglable && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
              <input
                type="checkbox"
                checked={nodeInfo.indexed}
                onChange={handleToggleIndexed}
                className="h-3.5 w-3.5 cursor-pointer accent-[var(--lw-accent-amber)]"
              />
              <span>Участвует в поиске FTS (Индексировать)</span>
            </label>
          )}
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
          placeholder="Поиск..."
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
                  {!readOnly && <span className={`h-2 w-2 rounded-full ${statusDotClass[term.status]}`} />}
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
