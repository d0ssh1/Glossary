import { useState } from 'react';
import { useApp, useApi } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

/**
 * Rename a course or a glossary. Driven by modalData:
 *   { kind: 'course' | 'glossary', id: string, currentName: string }
 */
export default function RenameModal() {
  const { state, dispatch } = useApp();
  const { apiRenameCourse, apiRenameGlossary } = useApi();
  const { modalData } = state;
  const kind = (modalData?.kind as 'course' | 'glossary' | undefined) ?? 'course';
  const id = modalData?.id as string | undefined;
  const currentName = (modalData?.currentName as string | undefined) ?? '';
  const [name, setName] = useState(currentName);

  const heading = kind === 'course' ? 'Переименовать курс' : 'Переименовать глоссарий';

  const handleSubmit = async () => {
    const next = name.trim();
    if (!next || !id || next === currentName) {
      dispatch({ type: 'CLOSE_MODAL' });
      return;
    }
    if (kind === 'course') await apiRenameCourse(id, next);
    else await apiRenameGlossary(id, next);
    dispatch({ type: 'CLOSE_MODAL' });
  };

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-5 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>{heading}</h3>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
            Новое название:
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Введите название"
            autoFocus
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
          Сохранить
        </button>
      </div>
    </div>
  );
}
