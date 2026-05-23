import { X } from 'lucide-react';
import { useApp } from '@/store/AppContext';

/** Close (X) button shared across all modals. */
export function ModalClose() {
  const { dispatch } = useApp();
  return (
    <button
      onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
      className="absolute right-3 top-3 rounded p-1 transition-colors duration-200"
      style={{ color: 'var(--lw-text-muted)' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; e.currentTarget.style.color = 'var(--lw-text-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--lw-text-muted)'; }}
      aria-label="Закрыть"
    >
      <X size={16} />
    </button>
  );
}
