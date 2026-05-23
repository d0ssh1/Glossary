import { useState } from 'react';
import { useApp, useApi } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function AddCourseModal() {
  const { dispatch } = useApp();
  const { apiCreateCourse } = useApi();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await apiCreateCourse({ name: name.trim(), url: url.trim() });
    } catch (err) {
      console.error('[AddCourseModal] create failed', err);
      return;
    }
    dispatch({ type: 'CLOSE_MODAL' });
  };

  return (
    <div className="relative p-6">
      <ModalClose />
      <h3 className="mb-5 text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>Добавить курс</h3>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Название курса:</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder="Введите название"
            className="w-full rounded border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-panel)', color: 'var(--lw-text-primary)' }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>Ссылка на курс (URL):</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://..."
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
          Подключить курс
        </button>
      </div>
    </div>
  );
}
