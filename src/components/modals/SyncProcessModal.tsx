import { useApp } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function SyncProcessModal() {
  const { state, dispatch } = useApp();
  const { syncProgress, syncStatus } = state;

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-5 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Процесс синхронизации</h3>
      <div className="space-y-4">
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--lw-bg-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${syncProgress}%`, backgroundColor: 'var(--lw-accent-amber)' }}
          />
        </div>
        <p className="text-center text-sm" style={{ color: 'var(--lw-text-secondary)' }}>{syncStatus}</p>
        <button
          onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
          className="w-full rounded border py-2 text-sm font-medium transition-all duration-200"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          отмена
        </button>
      </div>
    </div>
  );
}
