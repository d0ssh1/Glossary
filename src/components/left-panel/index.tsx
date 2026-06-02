// ============================================================
// LEFT PANEL — Glossary + Addition tabs
// ============================================================
import { useApp } from '@/store/AppContext';
import GlossaryTab from './GlossaryTab';
import AdditionTab from './AdditionTab';

export default function LeftPanel() {
  const { state, dispatch } = useApp();
  const { leftTab, readOnly } = state;

  // In the published SCORM view there's no term creation — only the glossary.
  const tabs = readOnly ? (['glossary'] as const) : (['glossary', 'addition'] as const);
  const activeTab = readOnly ? 'glossary' : leftTab;

  return (
    <div
      className="flex h-full w-full flex-col border-r"
      style={{ backgroundColor: 'var(--lw-bg-panel)', borderColor: 'var(--lw-border-primary)' }}
    >
      <div className="flex border-b" style={{ borderColor: 'var(--lw-border-primary)' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => dispatch({ type: 'SET_LEFT_TAB', tab })}
            className="flex-1 px-4 py-2.5 text-xs font-medium transition-all duration-200"
            style={{
              borderBottom: activeTab === tab ? '2px solid var(--lw-accent-graphite)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--lw-text-primary)' : 'var(--lw-text-muted)',
            }}
          >
            {tab === 'glossary' ? 'Глоссарий' : 'Добавление'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'glossary' ? <GlossaryTab /> : <AdditionTab />}
      </div>
    </div>
  );
}
