import { useState } from 'react';
import { useApp, useApi } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function CreateGlossaryModal() {
  const { state, dispatch } = useApp();
  const { apiCreateGlossary } = useApi();
  const [name, setName] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !state.activeCourseId) return;
    try {
      await apiCreateGlossary(state.activeCourseId, name.trim());
    } catch (err) {
      console.error('[CreateGlossaryModal] create failed', err);
      return;
    }
    dispatch({ type: 'CLOSE_MODAL' });
  };

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-5 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Создать глоссарий</h3>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Название:</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Введите название глоссария"
            className="w-full rounded border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-panel)', color: 'var(--lw-text-primary)' }}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="mt-2 w-full rounded py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
        >
          Создать
        </button>
      </div>
    </div>
  );
}
