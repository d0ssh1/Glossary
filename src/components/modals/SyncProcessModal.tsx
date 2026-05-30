import { useEffect, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function SyncProcessModal() {
  const { state, dispatch } = useApp();
  const { syncProgress, syncStatus } = state;

  // The backend import is one long blocking call: it can report `0` for a while
  // before real step-progress arrives. To avoid a frozen "0%" bar we run a local
  // crawl that always eases forward toward a ceiling, and show whichever is
  // larger — the real progress or the crawl. On completion (100) we snap to 100.
  const [crawl, setCrawl] = useState(2);
  useEffect(() => {
    const id = setInterval(() => {
      setCrawl(c => Math.min(c + Math.max(0.6, (92 - c) * 0.07), 92));
    }, 350);
    return () => clearInterval(id);
  }, []);

  const display = syncProgress >= 100 ? 100 : Math.max(syncProgress, crawl);

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-5 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Процесс синхронизации</h3>
      <div className="space-y-4">
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--lw-bg-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${display}%`, backgroundColor: 'var(--lw-accent-amber)' }}
          />
        </div>
        <p className="text-center text-sm" style={{ color: 'var(--lw-text-secondary)' }}>
          {syncStatus || 'Подключаемся к Stepik...'}
        </p>
        <button
          onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
          className="w-full rounded border py-2 text-sm font-medium transition-all duration-200"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
