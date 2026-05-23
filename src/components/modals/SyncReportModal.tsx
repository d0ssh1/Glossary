import { useApp } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function SyncReportModal() {
  const { state, dispatch } = useApp();
  const { syncReport } = state;

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Отчет о завершении</h3>
      <div className="mb-5 rounded border p-4 text-sm leading-relaxed" style={{ backgroundColor: 'var(--lw-bg-primary)', borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-primary)' }}>
        {syncReport ? (
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
