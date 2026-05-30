import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApp, defaultGraphFilters } from '@/store/AppContext';
import type { FrequencyMode, LogicMode, GraphFilters } from '@/store/AppContext';
import HierarchicalFilter from './HierarchicalFilter';

/**
 * Filters tab — Anton's spec:
 *  1. Hierarchical filter on top (pick which modules/lessons participate).
 *  2. Frequency radio (all / first-appearance / mention).
 *  3. Logic radio (or / and / not / xor).
 *  4. Weight range.
 *  5. "Применить" + "Сбросить" buttons — changes are held as a *pending draft*
 *     and only commit to AppState on Apply, so the graph doesn't thrash while
 *     the user is still configuring.
 *  6. Legend.
 *
 * The hierarchical filter is the exception — it commits live because that's
 * the existing UX (and the term list in the left panel needs to react
 * immediately for its "select-all from this module" workflow).
 */
export default function FiltersTab() {
  const { state, dispatch } = useApp();

  // Draft — what the user has staged but not applied yet.
  const [draft, setDraft] = useState<GraphFilters>(state.graphFilters);
  useEffect(() => { setDraft(state.graphFilters); }, [state.graphFilters]);

  const [freqExpanded, setFreqExpanded] = useState(true);
  const [logicExpanded, setLogicExpanded] = useState(true);
  const [hierExpanded, setHierExpanded] = useState(true);
  const [legendExpanded, setLegendExpanded] = useState(false);

  const patch = (p: Partial<GraphFilters>) => setDraft(d => ({ ...d, ...p }));

  const dirty =
    draft.weightEnabled !== state.graphFilters.weightEnabled ||
    draft.weightFrom !== state.graphFilters.weightFrom ||
    draft.weightTo !== state.graphFilters.weightTo ||
    draft.frequency !== state.graphFilters.frequency ||
    draft.logic !== state.graphFilters.logic;

  const handleApply = () => {
    dispatch({ type: 'SET_GRAPH_FILTERS', filters: draft });
  };
  const handleReset = () => {
    setDraft(defaultGraphFilters);
    dispatch({ type: 'SET_GRAPH_FILTERS', filters: defaultGraphFilters });
    dispatch({ type: 'SET_HIER_FILTER', ids: null });
  };

  return (
    // The whole tab scrolls so the Apply / Reset buttons stay reachable even
    // when every section is expanded (previously they fell off the bottom).
    <div className="h-full overflow-y-auto lw-scrollbar px-4 py-4">
      <p className="mb-3 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Фильтры:</p>

      {/* 1. Hierarchy — defines the scope the filters below apply to. */}
      <div className="mb-3">
        <button
          onClick={() => setHierExpanded(!hierExpanded)}
          className="flex w-full items-center gap-1 py-1 text-xs font-medium"
          style={{ color: 'var(--lw-text-primary)' }}
        >
          {hierExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Иерархия модулей и уроков
        </button>
        {hierExpanded && (
          <>
            <p className="ml-4 mb-1 mt-1 text-[10px] italic" style={{ color: 'var(--lw-text-muted)' }}>
              Отметьте модули и уроки, в пределах которых считаются связи. Узлы
              остаются на схеме, меняется только область действия фильтров.
            </p>
            <HierarchicalFilter />
          </>
        )}
      </div>

      {/* 2. Frequency */}
      <FilterGroup label="Частота термина" expanded={freqExpanded} onToggle={() => setFreqExpanded(!freqExpanded)}>
        {([
          ['all', 'Все упоминания'],
          ['first-appearance', 'Только первое появление'],
          ['mention', 'Только повторные упоминания'],
        ] as [FrequencyMode, string][]).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
            <input
              type="radio"
              name="freq"
              checked={draft.frequency === value}
              onChange={() => patch({ frequency: value })}
              className="accent-[var(--lw-accent-graphite)]"
            />
            {label}
          </label>
        ))}
      </FilterGroup>

      {/* 3. Logic */}
      <FilterGroup label="Логические функции" expanded={logicExpanded} onToggle={() => setLogicExpanded(!logicExpanded)}>
        <p className="mb-1 text-[10px] italic" style={{ color: 'var(--lw-text-muted)' }}>
          Действует, когда выделены термины (чекбоксами). Узел остаётся, если он
          связан с выделенными согласно операции. «И» оставит только узлы, где
          есть сразу все выбранные термины — если их нет в одном узле, схема
          будет пустой; для объединения используйте «ИЛИ».
        </p>
        {([
          ['or', 'ИЛИ — связан хотя бы с одним'],
          ['and', 'И — связан со всеми сразу'],
          ['not', 'НЕ — не связан ни с одним'],
          ['xor', 'ИСКЛЮЧАЮЩЕЕ ИЛИ — ровно с одним'],
        ] as [LogicMode, string][]).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
            <input
              type="radio"
              name="logic"
              checked={draft.logic === value}
              onChange={() => patch({ logic: value })}
              className="accent-[var(--lw-accent-graphite)]"
            />
            {label}
          </label>
        ))}
      </FilterGroup>

      {/* 4. Weight range */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={draft.weightEnabled}
          onChange={e => patch({ weightEnabled: e.target.checked })}
          className="accent-[var(--lw-accent-graphite)]"
        />
        <span className="text-xs" style={{ color: 'var(--lw-text-secondary)' }}>Вес связи от</span>
        <input
          type="number"
          value={draft.weightFrom}
          onChange={e => patch({ weightFrom: Number(e.target.value) || 0 })}
          disabled={!draft.weightEnabled}
          className="w-12 rounded border px-1.5 py-0.5 text-xs outline-none disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
        />
        <span className="text-xs" style={{ color: 'var(--lw-text-muted)' }}>до</span>
        <input
          type="number"
          value={draft.weightTo}
          onChange={e => patch({ weightTo: Number(e.target.value) || 0 })}
          disabled={!draft.weightEnabled}
          className="w-12 rounded border px-1.5 py-0.5 text-xs outline-none disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
        />
      </div>

      {/* 5. Apply / Reset */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={handleApply}
          disabled={!dirty}
          className="flex-1 rounded py-2 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
        >
          Применить
        </button>
        <button
          onClick={handleReset}
          className="flex-1 rounded border py-2 text-xs font-medium transition-colors duration-200"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Сбросить
        </button>
      </div>

      {/* 6. Legend */}
      <div className="mt-4">
        <button
          onClick={() => setLegendExpanded(!legendExpanded)}
          className="flex w-full items-center gap-1 py-1 text-xs font-medium"
          style={{ color: 'var(--lw-text-primary)' }}
        >
          {legendExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Легенда:
        </button>
        {legendExpanded && (
          <div className="mt-1 space-y-2 rounded border p-2.5"
            style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)' }}>
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>На уровне блоков/курса:</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--lw-text-muted)' }}>
                чем больше смежных терминов — тем жирнее и ярче связь, а названия модулей/блоков ближе
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>На уровне уроков:</p>
              <div className="space-y-0.5 text-xs" style={{ color: 'var(--lw-text-muted)' }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--lw-warning)]" />
                  Оранжевый — нет определения
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--lw-success)]" />
                  Зелёный — готов
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-4 bg-[#C0C0B8]" />
                  Серое ребро — термин упоминается повторно
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-4 bg-[#2C2C2C]" />
                  Чёрное ребро — первое появление термина
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label, expanded, onToggle, children,
}: {
  label: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1 py-1 text-xs font-medium"
        style={{ color: 'var(--lw-text-primary)' }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
      </button>
      {expanded && <div className="ml-4 space-y-1">{children}</div>}
    </div>
  );
}
