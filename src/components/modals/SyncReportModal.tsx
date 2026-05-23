import { useApp } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function SyncReportModal() {
  const { state, dispatch } = useApp();
  const { syncReport } = state;
  const failed = !!syncReport?.error;

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>
        {failed ? 'Ошибка импорта' : 'Отчет о завершении'}
      </h3>
      <div
        className="mb-5 rounded border p-4 text-sm leading-relaxed"
        style={{
          backgroundColor: 'var(--lw-bg-primary)',
          borderColor: failed ? 'var(--lw-error)' : 'var(--lw-border-primary)',
          color: 'var(--lw-text-primary)',
        }}
      >
        {failed ? (
          <>
            <p className="mb-2 font-medium" style={{ color: 'var(--lw-error)' }}>
              Не удалось завершить импорт курса.
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--lw-text-secondary)' }}>
              {syncReport!.error}
            </p>
          </>
        ) : syncReport ? (
          <>
            Курс <strong>&quot;{syncReport.courseName}&quot;</strong> успешно загружен.<br />
            Скачано: {syncReport.modulesCount} модулей, {syncReport.lessonsCount} уроков, {syncReport.stepsCount} шагов
          </>
        ) : (
          'Синхронизация завершена успешно.'
        )}
      </div>
      <button
        onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
        className="w-full rounded py-2 text-sm font-medium transition-all duration-200"
        style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
      >
        закрыть
      </button>
    </div>
  );
}
