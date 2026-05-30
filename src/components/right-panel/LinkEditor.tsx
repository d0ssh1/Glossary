import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Sparkles, User } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import { apiEnabled, createBinding, deleteBinding, ApiError } from '@/lib/api';
import { stringIdToNumeric, numericToId } from '@/lib/apiAdapter';
import type { Term } from '@/types';

interface LinkEditorProps {
  term: Term;
  onClose: () => void;
}

/**
 * Tri-state checkbox. `state` ∈ {'on','off','partial'}:
 *  - 'on'      → checked
 *  - 'off'     → unchecked
 *  - 'partial' → checked + DOM `indeterminate=true`
 * Clicking it calls `onToggle(targetValue)` where `targetValue` is true unless
 * the box was fully on (then false), matching the usual "click to clear" UX.
 */
function TriCheckbox({
  state, onToggle,
}: { state: 'on' | 'off' | 'partial'; onToggle: (next: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'partial';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="mr-1 accent-[var(--lw-accent-graphite)]"
      checked={state === 'on'}
      onChange={() => onToggle(state !== 'on')}
      onClick={e => e.stopPropagation()}
    />
  );
}

export default function LinkEditor({ term, onClose }: LinkEditorProps) {
  const { state, dispatch } = useApp();
  const course = state.courses.find(c => c.id === state.activeCourseId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // The set of currently-selected step IDs (frontend "st-N" form).
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(
    new Set(term.connections.map(c => c.stepId)),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStep = (stepId: string) => {
    setSelectedLinks(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  /** Apply a batch on/off to every step under `stepIds` at once. */
  const setManySteps = (stepIds: string[], on: boolean) => {
    setSelectedLinks(prev => {
      const next = new Set(prev);
      for (const sid of stepIds) {
        if (on) next.add(sid);
        else next.delete(sid);
      }
      return next;
    });
  };

  /** "on" | "off" | "partial" for a parent (module or lesson) given its step ids. */
  const groupState = (stepIds: string[]): 'on' | 'off' | 'partial' => {
    if (stepIds.length === 0) return 'off';
    let hits = 0;
    for (const sid of stepIds) if (selectedLinks.has(sid)) hits += 1;
    if (hits === 0) return 'off';
    if (hits === stepIds.length) return 'on';
    return 'partial';
  };

  /**
   * Persist the selection. Diff against the connections we knew at mount time
   * (`term.connections` from props) — create new bindings for newly-ticked
   * steps, delete bindings that were unticked. Optimistic local state update
   * happens via `apiSetFtsIndexed`-style refetch: we just rely on the existing
   * Term in props for the original state. After all calls succeed, we close.
   */
  /** Resolve a step id to its human-readable location in the course tree, so a
   *  freshly-created binding shows real names instead of blank rows (that was
   *  the "empty cards" bug — connections were stitched with empty strings). */
  const locateStep = (stepId: string) => {
    for (const m of course?.modules ?? []) {
      for (const l of m.lessons) {
        const s = l.steps.find(st => st.id === stepId);
        if (s) {
          return {
            stepName: s.name,
            moduleId: m.id, moduleName: m.name,
            lessonId: l.id, lessonName: l.name,
          };
        }
      }
    }
    return { stepName: '', moduleId: '', moduleName: '', lessonId: '', lessonName: '' };
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const originalByStepId = new Map<string, string>(); // stepId → connectionId
    for (const c of term.connections) originalByStepId.set(c.stepId, c.id);

    const toCreate: string[] = []; // stepIds to add
    const toDelete: string[] = []; // connectionIds to remove

    for (const sid of selectedLinks) {
      if (!originalByStepId.has(sid)) toCreate.push(sid);
    }
    for (const [stepId, connId] of originalByStepId) {
      if (!selectedLinks.has(stepId)) toDelete.push(connId);
    }

    try {
      if (apiEnabled()) {
        // Run deletes first so we don't trip uniqueness on the backend.
        for (const cid of toDelete) {
          await deleteBinding(stringIdToNumeric(cid));
        }
        const newConns: typeof term.connections = [];
        for (const sid of toCreate) {
          try {
            const created = await createBinding({
              term_id: stringIdToNumeric(term.id),
              step_id: stringIdToNumeric(sid),
              is_primary: false,
              is_created_by_user: true,
            });
            // Stitch a Connection record (with real names) so the read-only
            // "Связи" list shows it immediately instead of a blank row.
            newConns.push({
              id: numericToId('b', created.id),
              stepId: sid,
              ...locateStep(sid),
              type: 'editor',
            });
          } catch (err) {
            // 409 is fine — backend says the binding already exists; treat the
            // save as a no-op for this step. Any other status bubbles up.
            if (!(err instanceof ApiError) || err.status !== 409) throw err;
          }
        }
        // Apply locally — survivors + freshly-added ones.
        const survivors = term.connections.filter(c => !toDelete.includes(c.id));
        dispatch({
          type: 'UPDATE_TERM',
          termId: term.id,
          updates: { connections: [...survivors, ...newConns] },
        });
      } else {
        // Mock mode: just rebuild the connections array from selectedLinks.
        const conns = Array.from(selectedLinks).map(sid => {
          const existing = term.connections.find(c => c.stepId === sid);
          if (existing) return existing;
          return {
            id: `b-${crypto.randomUUID()}`,
            stepId: sid, ...locateStep(sid), type: 'editor' as const,
          };
        });
        dispatch({ type: 'UPDATE_TERM', termId: term.id, updates: { connections: conns } });
      }
      onClose();
    } catch (err) {
      console.error('[LinkEditor] save failed', err);
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить связи');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded border p-2"
      style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)' }}>
      <p className="mb-2 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
        Выберите места вхождения термина. Выбрано: {selectedLinks.size}
      </p>
      <p className="mb-2 text-xs" style={{ color: 'var(--lw-text-muted)' }}>
        <User size={9} className="inline" style={{ color: 'var(--lw-accent-amber)' }} /> — редактором,
        <Sparkles size={9} className="ml-1 inline" style={{ color: 'var(--lw-success)' }} /> — системой
      </p>

      <div className="max-h-48 overflow-y-auto lw-scrollbar">
        {course?.modules.map(mod => {
          const moduleStepIds = mod.lessons.flatMap(l => l.steps.map(s => s.id));
          return (
            <div key={mod.id}>
              <button
                onClick={() => toggleExpand(mod.id)}
                className="flex w-full items-center gap-1 px-1 py-0.5 text-left text-xs font-medium"
                style={{ color: 'var(--lw-text-primary)' }}
              >
                {expanded[mod.id] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <TriCheckbox
                  state={groupState(moduleStepIds)}
                  onToggle={(next) => setManySteps(moduleStepIds, next)}
                />
                {mod.name}
              </button>
              {expanded[mod.id] && mod.lessons.map(lesson => {
                const lessonStepIds = lesson.steps.map(s => s.id);
                return (
                  <div key={lesson.id} className="ml-3">
                    <button
                      onClick={() => toggleExpand(lesson.id)}
                      className="flex w-full items-center gap-1 px-1 py-0.5 text-left text-xs"
                      style={{ color: 'var(--lw-text-secondary)' }}
                    >
                      {expanded[lesson.id] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                      <TriCheckbox
                        state={groupState(lessonStepIds)}
                        onToggle={(next) => setManySteps(lessonStepIds, next)}
                      />
                      {lesson.name}
                    </button>
                    {expanded[lesson.id] && lesson.steps.map(step => {
                      const isLinked = term.connections.some(c => c.stepId === step.id);
                      return (
                        <div key={step.id} className="ml-5 flex items-center gap-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={selectedLinks.has(step.id)}
                            onChange={() => toggleStep(step.id)}
                            className="accent-[var(--lw-accent-graphite)]"
                          />
                          {isLinked ? (
                            <User size={9} style={{ color: 'var(--lw-accent-amber)' }} />
                          ) : (
                            <Sparkles size={9} style={{ color: 'var(--lw-success)' }} />
                          )}
                          <span className="text-xs" style={{ color: 'var(--lw-text-primary)' }}>{step.name}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {saveError && (
        <p className="mt-2 text-xs" style={{ color: 'var(--lw-error)' }}>{saveError}</p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 rounded border py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-40"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-40"
          style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
        >
          {saving ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
