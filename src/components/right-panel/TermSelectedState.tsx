import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, ExternalLink, Pencil, Sparkles, User } from 'lucide-react';
import { useApp, useApi } from '@/store/AppContext';
import { statusLabel } from '@/lib/constants';
import LinkEditor from './LinkEditor';
import type { Term } from '@/types';

interface Props { term: Term }

export default function TermSelectedState({ term }: Props) {
  const { dispatch } = useApp();
  const { apiUpdateTerm } = useApi();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(term.name);
  const [definition, setDefinition] = useState(term.definition);
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  // Independent of the editor: lets the user collapse/expand the read-only
  // connections list by clicking the "связи:" label/chevron.
  const [connectionsCollapsed, setConnectionsCollapsed] = useState(false);

  const handleSave = async () => {
    await apiUpdateTerm(term.id, { definition, name: nameValue });
    dispatch({ type: 'SET_UNSAVED_CHANGES', value: false });
  };

  const handleDelete = () => {
    dispatch({
      type: 'OPEN_MODAL',
      modal: 'confirm-delete',
      data: { termId: term.id, linkCount: term.connections.length },
    });
  };

  const hasChanges = definition !== term.definition || nameValue !== term.name;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
        <div className="flex items-center justify-between gap-2">
          {editingName ? (
            <input
              value={nameValue}
              onChange={e => {
                setNameValue(e.target.value);
                dispatch({ type: 'SET_UNSAVED_CHANGES', value: true });
              }}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              autoFocus
              className="flex-1 rounded border px-2 py-1 text-sm font-semibold outline-none"
              style={{ borderColor: 'var(--lw-accent-amber)', color: 'var(--lw-text-primary)', backgroundColor: 'var(--lw-bg-panel)' }}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex-1 truncate text-left text-sm font-semibold transition-colors duration-200"
              style={{ color: 'var(--lw-text-primary)' }}
              title="Редактировать название"
            >
              {term.name}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="rounded p-1 transition-colors duration-200"
            style={{ color: 'var(--lw-error)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            aria-label="Удалить термин"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--lw-text-muted)' }}>
          {statusLabel[term.status]}
        </p>
      </div>

      {/* Definition */}
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
        <p className="mb-1.5 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>определение:</p>
        <textarea
          value={definition}
          onChange={e => {
            setDefinition(e.target.value);
            dispatch({ type: 'SET_UNSAVED_CHANGES', value: true });
          }}
          rows={4}
          className="w-full resize-none rounded border px-2.5 py-2 text-xs outline-none"
          style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)', color: 'var(--lw-text-primary)' }}
          placeholder="Введите определение термина..."
        />
      </div>

      {/* Occurrences button + connections */}
      <div className="flex-1 overflow-y-auto lw-scrollbar px-4 py-3">
        <button
          onClick={() => dispatch({ type: 'OPEN_MODAL', modal: 'occurrences', data: { termId: term.id } })}
          disabled={term.occurrences.length === 0}
          className="mb-4 flex w-full items-center justify-between rounded border px-3 py-2 text-xs font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <span>найдено в курсе ({term.occurrences.length})</span>
          <ExternalLink size={11} />
        </button>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={() => setConnectionsCollapsed(v => !v)}
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--lw-text-secondary)' }}
              title={connectionsCollapsed ? 'Раскрыть список связей' : 'Свернуть список связей'}
            >
              {connectionsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              связи:
            </button>
            <button
              onClick={() => setShowLinkEditor(v => !v)}
              className="rounded p-1 transition-colors duration-200"
              style={{ color: showLinkEditor ? 'var(--lw-accent-amber)' : 'var(--lw-text-muted)' }}
              title={showLinkEditor ? 'Закрыть редактор связей' : 'Редактировать связи'}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--lw-accent-amber)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = showLinkEditor ? 'var(--lw-accent-amber)' : 'var(--lw-text-muted)'; }}
            >
              <Pencil size={12} />
            </button>
          </div>

          {showLinkEditor && (
            <LinkEditor term={term} onClose={() => setShowLinkEditor(false)} />
          )}
          {!showLinkEditor && !connectionsCollapsed && (
            <div className="space-y-1">
              {term.connections.map(conn => (
                <div key={conn.id} className="rounded px-2 py-1.5 text-xs" style={{ backgroundColor: 'var(--lw-bg-primary)' }}>
                  <div className="flex items-center gap-1.5">
                    {conn.type === 'editor'
                      ? <User size={10} style={{ color: 'var(--lw-accent-amber)' }} />
                      : <Sparkles size={10} style={{ color: 'var(--lw-success)' }} />}
                    <span style={{ color: 'var(--lw-text-secondary)' }}>{conn.moduleName}</span>
                  </div>
                  <div className="ml-4 mt-0.5">
                    <span style={{ color: 'var(--lw-text-muted)' }}>{conn.lessonName}</span>
                  </div>
                  <div className="ml-6 mt-0.5 flex items-center gap-1">
                    <span style={{ color: 'var(--lw-text-primary)' }}>{conn.stepName}</span>
                    <ExternalLink size={9} style={{ color: 'var(--lw-accent-amber)' }} />
                  </div>
                </div>
              ))}
              {term.connections.length === 0 && (
                <p className="py-1 text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>Нет связей</p>
              )}
            </div>
          )}
        </div>
      </div>

      {hasChanges && (
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--lw-border-primary)' }}>
          <button
            onClick={handleSave}
            className="w-full rounded py-2 text-xs font-medium transition-all duration-200"
            style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
          >
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
