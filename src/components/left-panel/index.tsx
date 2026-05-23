// ============================================================
// LEFT PANEL — Glossary + Addition tabs
// ============================================================
import { useApp } from '@/store/AppContext';
import GlossaryTab from './GlossaryTab';
import AdditionTab from './AdditionTab';

export default function LeftPanel() {
  const { state, dispatch } = useApp();
  const { leftTab } = state;

  return (
    <div
      className="flex h-full w-full flex-col border-r"
      style={{ backgroundColor: 'var(--lw-bg-panel)', borderColor: 'var(--lw-border-primary)' }}
    >
      <div className="flex border-b" style={{ borderColor: 'var(--lw-border-primary)' }}>
        {(['glossary', 'addition'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => dispatch({ type: 'SET_LEFT_TAB', tab })}
            className="flex-1 px-4 py-2.5 text-xs font-medium transition-all duration-200"
            style={{
              borderBottom: leftTab === tab ? '2px solid var(--lw-accent-graphite)' : '2px solid transparent',
              color: leftTab === tab ? 'var(--lw-text-primary)' : 'var(--lw-text-muted)',
            }}
          >
            {tab === 'glossary' ? 'Глоссарий' : 'добавление'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {leftTab === 'glossary' ? <GlossaryTab /> : <AdditionTab />}
      </div>
    </div>
  );
}
