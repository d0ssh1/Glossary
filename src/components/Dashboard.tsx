// ============================================================
// SCREEN 1 — Dashboard (Course Manager)
// ============================================================
import { Plus, Upload, FileText, ChevronRight } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { Glossary } from '@/types';

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const { courses } = state;

  const handleAddCourse = () => {
    dispatch({ type: 'OPEN_MODAL', modal: 'add-course' });
  };

  const handleImportCourse = (courseId: string) => {
    dispatch({ type: 'SET_ACTIVE_COURSE', courseId });
    dispatch({ type: 'OPEN_MODAL', modal: 'connection-settings' });
  };

  const handleAddGlossary = (courseId: string) => {
    dispatch({ type: 'SET_ACTIVE_COURSE', courseId });
    dispatch({ type: 'OPEN_MODAL', modal: 'create-glossary' });
  };

  const handleOpenGlossary = (courseId: string, glossaryId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    dispatch({ type: 'SET_ACTIVE_COURSE', courseId });
    dispatch({ type: 'SET_ACTIVE_GLOSSARY', glossaryId });
    dispatch({
      type: 'SET_GRAPH_LEVEL',
      level: 'modules',
      breadcrumbs: [{ id: courseId, name: course.name, level: 'modules' }],
    });
    dispatch({ type: 'NAVIGATE', screen: 'editor' });
  };

  const handleExportScorm = (courseId: string, glossaryId: string) => {
    const course = courses.find(c => c.id === courseId);
    const glossary = course?.glossaries.find(g => g.id === glossaryId);
    if (!glossary || glossary.terms.length === 0) return;
    dispatch({ type: 'SET_ACTIVE_COURSE', courseId });
    dispatch({ type: 'SET_ACTIVE_GLOSSARY', glossaryId });
    dispatch({ type: 'OPEN_MODAL', modal: 'export-settings' });
  };

  const getStatusColor = (glossary: Glossary) => {
    if (glossary.terms.length === 0) return 'bg-[var(--lw-text-muted)]';
    const allReady = glossary.terms.every(t => t.status === 'ready');
    if (allReady) return 'bg-[var(--lw-success)]';
    const anyInProgress = glossary.terms.some(t => t.status === 'in-progress');
    if (anyInProgress) return 'bg-[var(--lw-warning)]';
    return 'bg-[var(--lw-error)]';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--lw-bg-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: 'var(--lw-bg-panel)', borderColor: 'var(--lw-border-primary)' }}>
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded" style={{ backgroundColor: 'var(--lw-accent-graphite)' }}>
              <FileText size={16} style={{ color: 'var(--lw-bg-primary)' }} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--lw-text-primary)', letterSpacing: '-0.02em' }}>
              Lexicon Weaver
            </h1>
          </div>
          <div className="text-xs font-medium" style={{ color: 'var(--lw-text-muted)' }}>
            SCORM Glossary Editor
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-[960px] px-4 sm:px-6 pb-16 pt-12">
        {/* Section Title */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-semibold" style={{ color: 'var(--lw-text-primary)', letterSpacing: '-0.02em' }}>
            Текущие курсы
          </h2>
          <button
            onClick={handleAddCourse}
            className="flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-all duration-200"
            style={{ backgroundColor: 'var(--lw-accent-graphite)', color: 'var(--lw-bg-primary)' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <Plus size={14} />
            добавить
          </button>
        </div>

        {/* Course Cards */}
        <div className="space-y-6">
          {courses.map(course => (
            <div
              key={course.id}
              className="overflow-hidden rounded border"
              style={{ backgroundColor: 'var(--lw-bg-panel)', borderColor: 'var(--lw-border-primary)' }}
            >
              {/* Course Header */}
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--lw-border-primary)' }}>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--lw-text-primary)' }}>
                    {course.name}
                  </h3>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--lw-text-muted)' }}>
                    {course.lastImportDate
                      ? `Последний импорт: ${course.lastImportDate}`
                      : 'еще не импортирован'}
                  </p>
                </div>
                <button
                  onClick={() => handleImportCourse(course.id)}
                  className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition-all duration-200"
                  style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Upload size={13} />
                  Импорт курса
                </button>
              </div>

              {/* Glossaries Section */}
              <div className="px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
                    глоссарии:
                  </span>
                  <button
                    onClick={() => handleAddGlossary(course.id)}
                    className="flex items-center gap-1 text-xs font-medium transition-colors duration-200"
                    style={{ color: 'var(--lw-accent-amber)' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                  >
                    <Plus size={12} />
                    добавить
                  </button>
                </div>

                {/* Glossary List */}
                <div className="space-y-1">
                  {course.glossaries.map(glossary => (
                    <div
                      key={glossary.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded px-3 py-2.5 transition-colors duration-200"
                      style={{ backgroundColor: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(glossary)}`} />
                        <button
                          onClick={() => handleOpenGlossary(course.id, glossary.id)}
                          className="text-sm font-medium transition-colors duration-200"
                          style={{ color: 'var(--lw-text-primary)' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--lw-accent-amber)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--lw-text-primary)'; }}
                        >
                          {glossary.name}
                        </button>
                        <span className="text-xs" style={{ color: 'var(--lw-text-muted)' }}>
                          {glossary.terms.length} терминов
                        </span>
                      </div>
                      <button
                        onClick={() => handleExportScorm(course.id, glossary.id)}
                        disabled={glossary.terms.length === 0}
                        className="flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
                        onMouseEnter={e => {
                          if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)';
                        }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        перевести в scorm
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  ))}
                  {course.glossaries.length === 0 && (
                    <div className="px-3 py-3 text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>
                      Нет глоссариев
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
