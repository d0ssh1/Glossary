import { useState } from 'react';
import { useApp, useApi } from '@/store/AppContext';
import { apiEnabled, type ImportStatus } from '@/lib/api';
import { ModalClose } from './ModalShell';

/** Extract the numeric Stepik course id from a URL like
 *  ``https://stepik.org/course/63054/promo`` or ``stepik.org/course/63054``. */
function parseStepikCourseId(url: string): number | null {
  const m = /\/course\/(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
}

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

/** Persist the last-used OAuth keys in localStorage so the user doesn't have
 *  to retype them across imports. Stored only on the user's own machine. */
const LS_KEY = 'lw.stepik.creds';
function loadCreds(): { clientId: string; clientSecret: string } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { clientId: '', clientSecret: '' };
    return JSON.parse(raw);
  } catch { return { clientId: '', clientSecret: '' }; }
}
function saveCreds(c: { clientId: string; clientSecret: string }) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch { /* quota etc — ignore */ }
}

export default function ConnectionSettingsModal() {
  const { state, dispatch } = useApp();
  const { apiImportCourse } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialCreds = loadCreds();
  const [clientId, setClientId] = useState(initialCreds.clientId);
  const [clientSecret, setClientSecret] = useState(initialCreds.clientSecret);

  const course = state.courses.find(c => c.id === state.activeCourseId);
  const stepikId = course ? parseStepikCourseId(course.url) : null;
  const live = apiEnabled() && !!state.activeCourseId;

  const runLiveImport = async (body: Parameters<typeof apiImportCourse>[1]) => {
    if (!state.activeCourseId) return;
    setError(null);
    setBusy(true);
    dispatch({ type: 'CLOSE_MODAL' });
    dispatch({ type: 'OPEN_MODAL', modal: 'sync-process' });
    dispatch({ type: 'SET_SYNC_PROGRESS', progress: 1, status: 'Запуск импорта...' });
    try {
      const finalStatus = await apiImportCourse(state.activeCourseId, body, (s: ImportStatus) => {
        const done = s.steps_done ?? s.steps_count ?? 0;
        const total = s.steps_total ?? 0;
        const pct = total > 0
          ? Math.min(99, Math.round((done / total) * 100))
          : Math.min(95, 5 + s.sections_count * 5 + s.lessons_count);
        const label = total > 0
          ? `Шаги: ${done} / ${total}`
          : `Структура: ${s.sections_count} секций, ${s.lessons_count} уроков...`;
        dispatch({ type: 'SET_SYNC_PROGRESS', progress: pct, status: label });
      });
      if (finalStatus.status === 'error') {
        throw new Error(finalStatus.error || 'Импорт завершился ошибкой');
      }
      dispatch({ type: 'SET_SYNC_PROGRESS', progress: 100, status: 'Завершено!' });
      setTimeout(() => {
        dispatch({ type: 'CLOSE_MODAL' });
        dispatch({
          type: 'SET_SYNC_REPORT',
          report: {
            courseName: course?.name || 'Курс',
            modulesCount: finalStatus.sections_count,
            lessonsCount: finalStatus.lessons_count,
            stepsCount: finalStatus.steps_count,
          },
        });
        dispatch({ type: 'OPEN_MODAL', modal: 'sync-report' });
      }, 400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      dispatch({ type: 'CLOSE_MODAL' });
      dispatch({
        type: 'SET_SYNC_REPORT',
        report: {
          courseName: course?.name || 'Курс',
          modulesCount: 0,
          lessonsCount: 0,
          stepsCount: 0,
          error: msg,
        },
      });
      dispatch({ type: 'OPEN_MODAL', modal: 'sync-report' });
    } finally {
      setBusy(false);
    }
  };

  const startApiSync = () => {
    if (live) {
      if (!stepikId) {
        setError('В URL курса не найден Stepik ID (ожидается ".../course/<id>/...")');
        return;
      }
      saveCreds({ clientId, clientSecret });
      void runLiveImport({
        source: 'stepik',
        stepik_course_id: stepikId,
        ...(clientId.trim() ? { client_id: clientId.trim() } : {}),
        ...(clientSecret.trim() ? { client_secret: clientSecret.trim() } : {}),
      });
      return;
    }
    // Mock fallback
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
    if (live) {
      void runLiveImport({ source: 'mock' });
      return;
    }
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
        {live ? (
          <>
            <div className="rounded border p-3 text-xs leading-relaxed"
              style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-secondary)' }}>
              {stepikId
                ? <p>Будет импортирован курс Stepik <strong>#{stepikId}</strong>. Если ключи ниже пусты, используются значения из <code>backend/.env</code>.</p>
                : <p style={{ color: 'var(--lw-warning)' }}>В URL курса нет Stepik ID — доступен только JSON-импорт.</p>}
            </div>

            <div className="space-y-2">
              <label className="block">
                <span className="block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Client ID</span>
                <input
                  type="text"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="напр. 51a37dfc8d2c4ed4..."
                  className="mt-1 w-full rounded border px-2.5 py-1.5 text-xs outline-none"
                  style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Client Secret</span>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded border px-2.5 py-1.5 text-xs outline-none"
                  style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
                />
              </label>
            </div>
          </>
        ) : (
          <p className="text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>
            Демо-режим: используются моковые данные. Чтобы импортировать реальный курс, поднимите бэкенд
            и поставьте <code>VITE_USE_API=1</code>.
          </p>
        )}

        {error && <p className="text-xs" style={{ color: 'var(--lw-error)' }}>{error}</p>}

        <button
          onClick={startApiSync}
          disabled={busy || (live && !stepikId)}
          className="mt-2 w-full rounded py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
        >
          {live ? 'Импорт с Stepik' : 'Начать загрузку (демо)'}
        </button>
        <button
          onClick={startJsonSync}
          disabled={busy}
          className="w-full rounded border py-2 text-sm font-medium transition-all duration-200 disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {live ? 'Импорт из локального JSON' : 'Загрузить JSON-структуру курса (оффлайн)'}
        </button>
      </div>
    </div>
  );
}
