// ============================================================
// RIGHT PANEL — Context + Filters tabs
// ============================================================
import { useApp } from '@/store/AppContext';
import ContextTab from './ContextTab';
import FiltersTab from './FiltersTab';

export default function RightPanel() {
  const { state, dispatch } = useApp();
  const { rightTab } = state;

  return (
    <div
      className="flex h-full w-full flex-col border-l"
      style={{ backgroundColor: 'var(--lw-bg-panel)', borderColor: 'var(--lw-border-primary)' }}
    >
      <div className="flex border-b" style={{ borderColor: 'var(--lw-border-primary)' }}>
        {(['context', 'filters'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => dispatch({ type: 'SET_RIGHT_TAB', tab })}
            className="flex-1 px-4 py-2.5 text-xs font-medium transition-all duration-200"
            style={{
              borderBottom: rightTab === tab ? '2px solid var(--lw-accent-graphite)' : '2px solid transparent',
              color: rightTab === tab ? 'var(--lw-text-primary)' : 'var(--lw-text-muted)',
            }}
          >
            {tab === 'context' ? 'Контекст' : 'Фильтры'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {rightTab === 'context' ? <ContextTab /> : <FiltersTab />}
      </div>
    </div>
  );
}
