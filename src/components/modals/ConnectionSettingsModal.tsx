import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

function runSyncSimulation(
  dispatch: ReturnType<typeof useApp>['dispatch'],
  statuses: string[],
  report: { courseName: string; modulesCount: number; lessonsCount: number; stepsCount: number },
  tickMs: number,
) {
  let progress = 0;
  dispatch({ type: 'SET_SYNC_PROGRESS', progress: 0, status: statuses[0] });
  const interval = setInterval(() => {
    progress += Math.random() * 20 + 10;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      dispatch({ type: 'SET_SYNC_PROGRESS', progress: 100, status: 'Завершено!' });
      setTimeout(() => {
        dispatch({ type: 'CLOSE_MODAL' });
        dispatch({ type: 'SET_SYNC_REPORT', report });
        dispatch({ type: 'OPEN_MODAL', modal: 'sync-report' });
      }, 600);
    } else {
      const idx = Math.min(Math.floor((progress / 100) * statuses.length), statuses.length - 1);
      dispatch({ type: 'SET_SYNC_PROGRESS', progress, status: statuses[idx] });
    }
  }, tickMs);
}

export default function ConnectionSettingsModal() {
  const { dispatch } = useApp();
  const [clientId, setClientId] = useState('');
  const [clientServer, setClientServer] = useState('');

  const startApiSync = () => {
    dispatch({ type: 'CLOSE_MODAL' });
    dispatch({ type: 'OPEN_MODAL', modal: 'sync-process' });
    runSyncSimulation(
      dispatch,
      ['Авторизация...', 'Получение структуры...', 'Загрузка модулей...', 'Загрузка уроков...', 'Обработка шагов...', 'Финализация...'],
      { courseName: 'Основы SQL', modulesCount: 5, lessonsCount: 42, stepsCount: 185 },
      400,
    );
  };

  const startJsonSync = () => {
    dispatch({ type: 'CLOSE_MODAL' });
    dispatch({ type: 'OPEN_MODAL', modal: 'sync-process' });
    runSyncSimulation(
      dispatch,
      ['Чтение JSON...', 'Парсинг структуры...', 'Импорт модулей...', 'Финализация...'],
      { courseName: 'Основы SQL', modulesCount: 3, lessonsCount: 18, stepsCount: 76 },
      350,
    );
  };

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-5 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Настройка подключения</h3>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Client ID</label>
          <input
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            placeholder="your-client-id"
            className="w-full rounded border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-panel)', color: 'var(--lw-text-primary)' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Client Server</label>
          <input
            value={clientServer}
            onChange={e => setClientServer(e.target.value)}
            placeholder="https://api.stepik.org"
            className="w-full rounded border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-panel)', color: 'var(--lw-text-primary)' }}
          />
        </div>
        <button
          onClick={startApiSync}
          className="mt-2 w-full rounded py-2 text-sm font-medium transition-all duration-200"
          style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
        >
          Начать загрузку
        </button>
        <button
          onClick={startJsonSync}
          className="w-full rounded border py-2 text-sm font-medium transition-all duration-200"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Загрузить JSON-структуру курса (оффлайн)
        </button>
      </div>
    </div>
  );
}
