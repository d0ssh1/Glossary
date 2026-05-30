import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '@/store/AppContext';

/**
 * Tree of modules/lessons with tri-state checkboxes.
 * Selecting a module includes/excludes all its lessons.
 * Stored as flat array of selected IDs; `null` means "no filter" (everything).
 */
export default function HierarchicalFilter() {
  const { state, dispatch } = useApp();
  const course = state.courses.find(c => c.id === state.activeCourseId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // All ids that would represent "everything selected"
  const allIds = useMemo(() => {
    if (!course) return [] as string[];
    const ids: string[] = [];
    course.modules.forEach(m => {
      ids.push(m.id);
      m.lessons.forEach(l => ids.push(l.id));
    });
    return ids;
  }, [course]);

  const selected = state.hierFilterIds ?? allIds;
  const selectedSet = new Set(selected);

  const isSelected = (id: string) => selectedSet.has(id);

  const setSelection = (next: Set<string>) => {
    // If everything selected, store null to mean "no filter"
    if (next.size === allIds.length) dispatch({ type: 'SET_HIER_FILTER', ids: null });
    else dispatch({ type: 'SET_HIER_FILTER', ids: [...next] });
  };

  const toggleLesson = (lessonId: string, moduleId: string) => {
    const next = new Set(selectedSet);
    if (next.has(lessonId)) next.delete(lessonId);
    else next.add(lessonId);
    // Sync module: included only if at least one lesson selected
    const mod = course?.modules.find(m => m.id === moduleId);
    const anyLessonSelected = mod?.lessons.some(l => next.has(l.id));
    if (anyLessonSelected) next.add(moduleId);
    else next.delete(moduleId);
    setSelection(next);
  };

  const toggleModule = (moduleId: string) => {
    const mod = course?.modules.find(m => m.id === moduleId);
    if (!mod) return;
    const next = new Set(selectedSet);
    const allLessonIds = mod.lessons.map(l => l.id);
    const fullySelected = next.has(moduleId) && allLessonIds.every(id => next.has(id));
    if (fullySelected) {
      next.delete(moduleId);
      allLessonIds.forEach(id => next.delete(id));
    } else {
      next.add(moduleId);
      allLessonIds.forEach(id => next.add(id));
    }
    setSelection(next);
  };

  const selectAll = () => dispatch({ type: 'SET_HIER_FILTER', ids: null });
  const clearAll = () => dispatch({ type: 'SET_HIER_FILTER', ids: [] });

  if (!course || course.modules.length === 0) {
    return (
      <p className="ml-4 py-1 text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>
        Нет модулей в курсе
      </p>
    );
  }

  return (
    <div className="ml-1 mt-1 rounded border p-2"
      style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)' }}>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={selectAll} className="text-xs font-medium" style={{ color: 'var(--lw-accent-amber)' }}>
          Выбрать всё
        </button>
        <button onClick={clearAll} className="text-xs" style={{ color: 'var(--lw-text-muted)' }}>
          Снять
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto lw-scrollbar">
        {course.modules.map(mod => {
          const allLessons = mod.lessons.map(l => l.id);
          const selectedLessons = allLessons.filter(id => selectedSet.has(id)).length;
          const fully = selectedLessons === allLessons.length && allLessons.length > 0;
          const partially = selectedLessons > 0 && !fully;
          const isExpanded = expanded[mod.id] !== false;

          return (
            <div key={mod.id} className="mb-0.5">
              <div className="flex items-center gap-1 rounded px-1 py-0.5">
                <button
                  onClick={() => setExpanded(p => ({ ...p, [mod.id]: !isExpanded }))}
                  className="shrink-0 p-0"
                  style={{ color: 'var(--lw-text-muted)' }}
                  aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                >
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </button>
                <input
                  type="checkbox"
                  checked={fully}
                  ref={el => { if (el) el.indeterminate = partially; }}
                  onChange={() => toggleModule(mod.id)}
                  className="accent-[var(--lw-accent-graphite)]"
                />
                <button
                  onClick={() => toggleModule(mod.id)}
                  className="flex-1 truncate text-left text-xs font-medium"
                  style={{ color: 'var(--lw-text-primary)' }}
                  title={mod.name}
                >
                  {mod.name}
                </button>
                <span className="shrink-0 text-[10px]" style={{ color: 'var(--lw-text-muted)' }}>
                  {selectedLessons}/{allLessons.length}
                </span>
              </div>

              {isExpanded && mod.lessons.map(lesson => (
                <label
                  key={lesson.id}
                  className="ml-6 flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 transition-colors"
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected(lesson.id)}
                    onChange={() => toggleLesson(lesson.id, mod.id)}
                    className="accent-[var(--lw-accent-graphite)]"
                  />
                  <span className="truncate text-xs" style={{ color: 'var(--lw-text-secondary)' }} title={lesson.name}>
                    {lesson.name}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>

      {state.hierFilterIds !== null && (
        <p className="mt-2 text-[10px]" style={{ color: 'var(--lw-accent-amber)' }}>
          Область задана — выбрано: {selected.length}/{allIds.length}
        </p>
      )}
    </div>
  );
}
