import { useApp } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function UnsavedChangesModal() {
  const { state, dispatch } = useApp();

  const handleYes = () => {
    dispatch({ type: 'SET_UNSAVED_CHANGES', value: false });
    dispatch({ type: 'CLOSE_MODAL' });
    if (state.pendingNavigation) {
      const nav = state.pendingNavigation;
      // @ts-expect-error - dynamic dispatch shape stored as function
      dispatch(nav);
      dispatch({ type: 'SET_PENDING_NAVIGATION', fn: null });
    }
  };

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-3 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Несохраненные изменения</h3>
      <p className="mb-5 text-sm" style={{ color: 'var(--lw-text-secondary)' }}>
        У вас есть несохраненные изменения в текущем термине. Отменить их и перейти?
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleYes}
          className="flex-1 rounded py-2 text-sm font-medium transition-all duration-200"
          style={{ backgroundColor: 'var(--lw-error)', color: '#fff' }}
        >
          Да
        </button>
        <button
          onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
          className="flex-1 rounded py-2 text-sm font-medium transition-all duration-200"
          style={{ backgroundColor: 'var(--lw-success)', color: '#fff' }}
        >
          Нет
        </button>
      </div>
    </div>
  );
}
