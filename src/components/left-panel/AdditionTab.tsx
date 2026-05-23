import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp, useApi } from '@/store/AppContext';

export default function AdditionTab() {
  const { state } = useApp();
  const { apiBulkAddTerms } = useApi();
  const [singleTerm, setSingleTerm] = useState('');
  const [multiTerms, setMultiTerms] = useState('');

  const handleAddSingle = async () => {
    if (!singleTerm.trim() || !state.activeGlossaryId) return;
    await apiBulkAddTerms(state.activeGlossaryId, [singleTerm.trim()]);
    setSingleTerm('');
  };

  const handleAddMultiple = async () => {
    if (!multiTerms.trim() || !state.activeGlossaryId) return;
    const names = multiTerms.split(/[,;|.\s]+/).map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    await apiBulkAddTerms(state.activeGlossaryId, names);
    setMultiTerms('');
  };

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <p className="mb-3 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
        Вы можете добавить термин введя его:
      </p>

      <input
        value={singleTerm}
        onChange={e => setSingleTerm(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAddSingle()}
        placeholder="Введите термин"
        className="mb-3 w-full rounded border px-3 py-2 text-xs outline-none"
        style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
      />

      <div className="mb-3 flex items-center gap-3">
        <div className="h-px flex-1" style={{ backgroundColor: 'var(--lw-border-primary)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--lw-text-muted)' }}>ИЛИ</span>
        <div className="h-px flex-1" style={{ backgroundColor: 'var(--lw-border-primary)' }} />
      </div>

      <p className="mb-2 text-xs" style={{ color: 'var(--lw-text-secondary)' }}>
        вставить список через разделитель (&quot;,&quot; &quot; &quot; &quot;;&quot; &quot;.&quot; &quot;|&quot;)
      </p>

      <textarea
        value={multiTerms}
        onChange={e => setMultiTerms(e.target.value)}
        placeholder="Термин1, Термин2, Термин3"
        rows={6}
        className="mb-3 w-full resize-none rounded border px-3 py-2 text-xs outline-none"
        style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
      />

      <button
        onClick={multiTerms.trim() ? handleAddMultiple : handleAddSingle}
        disabled={!singleTerm.trim() && !multiTerms.trim()}
        className="flex w-full items-center justify-center gap-1.5 rounded py-2 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
      >
        <Plus size={13} />
        Добавить термин(ы)
      </button>
    </div>
  );
}
