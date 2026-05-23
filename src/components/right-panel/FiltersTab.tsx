import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { FrequencyMode, LogicMode } from '@/store/AppContext';
import HierarchicalFilter from './HierarchicalFilter';

export default function FiltersTab() {
  const { state, dispatch } = useApp();
  const f = state.graphFilters;

  const [freqExpanded, setFreqExpanded] = useState(true);
  const [logicExpanded, setLogicExpanded] = useState(true);
  const [hierExpanded, setHierExpanded] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(true);

  const set = (patch: Partial<typeof f>) =>
    dispatch({ type: 'SET_GRAPH_FILTERS', filters: patch });

  return (
    <div className="px-4 py-4">
      <p className="mb-3 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Фильтры:</p>

      {/* Weight */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={f.weightEnabled}
          onChange={e => set({ weightEnabled: e.target.checked })}
          className="accent-[var(--lw-accent-graphite)]"
        />
        <span className="text-xs" style={{ color: 'var(--lw-text-secondary)' }}>вес связи от</span>
        <input
          type="number"
          value={f.weightFrom}
          onChange={e => set({ weightFrom: Number(e.target.value) || 0 })}
          disabled={!f.weightEnabled}
          className="w-12 rounded border px-1.5 py-0.5 text-xs outline-none disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
        />
        <span className="text-xs" style={{ color: 'var(--lw-text-muted)' }}>до</span>
        <input
          type="number"
          value={f.weightTo}
          onChange={e => set({ weightTo: Number(e.target.value) || 0 })}
          disabled={!f.weightEnabled}
          className="w-12 rounded border px-1.5 py-0.5 text-xs outline-none disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
        />
      </div>

      {/* Frequency */}
      <FilterGroup label="частота термина" expanded={freqExpanded} onToggle={() => setFreqExpanded(!freqExpanded)}>
        {([
          ['all', 'все упоминания'],
          ['first-appearance', 'только первое появление'],
          ['mention', 'только повторные упоминания'],
        ] as [FrequencyMode, string][]).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
            <input
              type="radio"
              name="freq"
              checked={f.frequency === value}
              onChange={() => set({ frequency: value })}
              className="accent-[var(--lw-accent-graphite)]"
            />
            {label}
          </label>
        ))}
      </FilterGroup>

      {/* Logic */}
      <FilterGroup label="Логические функции" expanded={logicExpanded} onToggle={() => setLogicExpanded(!logicExpanded)}>
        <p className="mb-1 text-[10px] italic" style={{ color: 'var(--lw-text-muted)' }}>
          Действует только когда выделены термины (чекбоксами). Узел остаётся,
          если он связан с выделенными согласно выбранной операции.
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
              checked={f.logic === value}
              onChange={() => set({ logic: value })}
              className="accent-[var(--lw-accent-graphite)]"
            />
            {label}
          </label>
        ))}
      </FilterGroup>

      {/* Hierarchical */}
      <div className="mb-2">
        <button
          onClick={() => setHierExpanded(!hierExpanded)}
          className="flex w-full items-center gap-1 py-1 text-xs font-medium"
          style={{ color: 'var(--lw-text-primary)' }}
        >
          {hierExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Иерархический фильтр
        </button>
        {hierExpanded && <HierarchicalFilter />}
      </div>

      {/* Legend */}
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
                  оранжевый — нет определения
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--lw-success)]" />
                  зелёный — готов
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-4 bg-[#C0C0B8]" />
                  серое ребро — упоминается
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-4 bg-[#2C2C2C]" />
                  чёрное — первое появление
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
