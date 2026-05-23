import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import HierarchicalFilter from './HierarchicalFilter';

export default function FiltersTab() {
  const [weightEnabled, setWeightEnabled] = useState(false);
  const [weightFrom, setWeightFrom] = useState('0');
  const [weightTo, setWeightTo] = useState('100');
  const [freqExpanded, setFreqExpanded] = useState(true);
  const [logicExpanded, setLogicExpanded] = useState(true);
  const [hierExpanded, setHierExpanded] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(true);

  return (
    <div className="px-4 py-4">
      <p className="mb-3 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Фильтры:</p>

      {/* Weight */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={weightEnabled}
          onChange={e => setWeightEnabled(e.target.checked)}
          className="accent-[var(--lw-accent-graphite)]"
        />
        <span className="text-xs" style={{ color: 'var(--lw-text-secondary)' }}>вес связи от</span>
        <input
          type="number"
          value={weightFrom}
          onChange={e => setWeightFrom(e.target.value)}
          disabled={!weightEnabled}
          className="w-12 rounded border px-1.5 py-0.5 text-xs outline-none disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
        />
        <span className="text-xs" style={{ color: 'var(--lw-text-muted)' }}>до</span>
        <input
          type="number"
          value={weightTo}
          onChange={e => setWeightTo(e.target.value)}
          disabled={!weightEnabled}
          className="w-12 rounded border px-1.5 py-0.5 text-xs outline-none disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
        />
      </div>

      {/* Frequency */}
      <FilterGroup label="частота термина" expanded={freqExpanded} onToggle={() => setFreqExpanded(!freqExpanded)}>
        {['первое появление', 'упоминания'].map(label => (
          <label key={label} className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
            <input type="radio" name="freq" className="accent-[var(--lw-accent-graphite)]" />
            {label}
          </label>
        ))}
      </FilterGroup>

      {/* Logic */}
      <FilterGroup label="Логические функции" expanded={logicExpanded} onToggle={() => setLogicExpanded(!logicExpanded)}>
        {['И', 'ИЛИ', 'НЕ', 'ИСКЛЮЧАЮЩЕЕ ИЛИ'].map(label => (
          <label key={label} className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
            <input type="radio" name="logic" className="accent-[var(--lw-accent-graphite)]" />
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
