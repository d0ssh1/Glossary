import { Copy, ExternalLink } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { ModalClose } from './ModalShell';

export default function OccurrencesModal() {
  const { state, dispatch } = useApp();
  const termId = (state.modalData as { termId?: string }).termId;
  const term = state.courses
    .flatMap(c => c.glossaries)
    .flatMap(g => g.terms)
    .find(t => t.id === termId);

  if (!term) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text.replace(/<[^>]*>/g, ''));
  };

  return (
    <div className="relative">
      <ModalClose />
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--lw-border-primary)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--lw-text-primary)' }}>
          Найдено в курсе: {term.name}
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--lw-text-muted)' }}>
          вхождений: {term.occurrences.length}
        </p>
      </div>
      <div className="lw-scrollbar max-h-[70vh] overflow-y-auto px-5 py-4">
        {term.occurrences.length === 0 && (
          <p className="py-6 text-center text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>Нет вхождений</p>
        )}
        {term.occurrences.map(occ => (
          <div
            key={occ.id}
            className="mb-2.5 rounded border p-3"
            style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)' }}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>{occ.stepName}</p>
              <button
                onClick={() => handleCopy(occ.snippet)}
                className="rounded p-1 transition-colors duration-200"
                style={{ color: 'var(--lw-text-muted)' }}
                title="Копировать"
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--lw-accent-amber)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--lw-text-muted)'; }}
              >
                <Copy size={12} />
              </button>
            </div>
            <p
              className="mb-2 text-xs leading-relaxed"
              style={{ color: 'var(--lw-text-primary)' }}
              dangerouslySetInnerHTML={{ __html: occ.snippet }}
            />
            <button
              className="flex items-center gap-1 text-xs font-medium transition-opacity duration-200"
              style={{ color: 'var(--lw-accent-amber)' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              Перейти к шагу <ExternalLink size={10} />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t px-5 py-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
        <button
          onClick={() => dispatch({ type: 'CLOSE_MODAL' })}
          className="ml-auto block rounded border px-4 py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
