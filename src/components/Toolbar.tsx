// ============================================================
// TOOLBAR — Top bar on Editor screen
// ============================================================
import { Home, PanelLeft, PanelRight, ChevronRight } from 'lucide-react';
import { useApp } from '@/store/AppContext';

export default function Toolbar() {
  const { state, dispatch } = useApp();
  const { breadcrumbs } = state;

  const handleBreadcrumbClick = (index: number) => {
    dispatch({ type: 'BREADCRUMB_NAV', index });
  };

  const handleHome = () => {
    dispatch({ type: 'NAVIGATE', screen: 'dashboard' });
    dispatch({ type: 'SET_ACTIVE_GLOSSARY', glossaryId: null });
    dispatch({ type: 'SET_ACTIVE_COURSE', courseId: null });
  };

  // A crumb's `level` is the level it leads INTO, so its own noun is the parent
  // of that level: modules→course, lessons→module, steps→lesson, terms→step.
  const levelLabels: Record<string, string> = {
    modules: 'Курс',
    lessons: 'Модуль',
    steps: 'Урок',
    terms: 'Шаг',
  };

  const activeGlossary = state.courses
    .flatMap(c => c.glossaries)
    .find(g => g.id === state.activeGlossaryId);

  return (
    <div
      className="flex h-12 items-center border-b px-4"
      style={{ backgroundColor: 'var(--lw-bg-panel)', borderColor: 'var(--lw-border-primary)' }}
    >
      {/* Home — hidden in the read-only SCORM view (there's no dashboard there). */}
      {!state.readOnly && (
        <button
          onClick={handleHome}
          className="mr-3 shrink-0 rounded p-1.5 transition-colors duration-200"
          style={{ color: 'var(--lw-text-secondary)' }}
          title="Возвращает на главный экран"
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; e.currentTarget.style.color = 'var(--lw-text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--lw-text-secondary)'; }}
        >
          <Home size={18} />
        </button>
      )}

      {/* Left toggle */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_LEFT_PANEL' })}
        className="mr-2 shrink-0 rounded p-1.5 transition-colors duration-200"
        style={{ color: state.leftPanelOpen ? 'var(--lw-accent-amber)' : 'var(--lw-text-muted)' }}
        title="Скрывает/раскрывает левую панель"
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <PanelLeft size={18} />
      </button>

      {/* Separator */}
      <div className="mx-2 h-5 w-px" style={{ backgroundColor: 'var(--lw-border-primary)' }} />

      {/* Breadcrumbs */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-base">
        <span className="hidden truncate font-semibold sm:inline" style={{ color: 'var(--lw-text-primary)' }}>
          {activeGlossary?.name || 'Глоссарий'}
        </span>
        {breadcrumbs.length > 0 && (
          <>
            <span className="hidden sm:inline" style={{ color: 'var(--lw-text-muted)' }}>/</span>
            {/* On mobile only show the last (active) crumb to save space */}
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span
                  key={crumb.id}
                  className={`flex min-w-0 items-center gap-1 ${isLast ? '' : 'hidden sm:flex'}`}
                >
                  {i > 0 && <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--lw-text-muted)' }} />}
                  <button
                    onClick={() => handleBreadcrumbClick(i)}
                    className="truncate rounded px-1.5 py-0.5 text-sm font-medium transition-colors duration-200"
                    style={{
                      color: isLast ? 'var(--lw-accent-amber)' : 'var(--lw-text-secondary)',
                      backgroundColor: 'transparent',
                      maxWidth: '60vw',
                    }}
                    onMouseEnter={e => {
                      if (!isLast) e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)';
                    }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {levelLabels[crumb.level] || crumb.level}: {crumb.name.length > 35 ? crumb.name.slice(0, 35) + '...' : crumb.name}
                  </button>
                </span>
              );
            })}
          </>
        )}
      </div>

      {/* Right toggle */}
      <button
        onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
        className="ml-2 shrink-0 rounded p-1.5 transition-colors duration-200"
        style={{ color: state.rightPanelOpen ? 'var(--lw-accent-amber)' : 'var(--lw-text-muted)' }}
        title="Скрывает/раскрывает правую панель"
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <PanelRight size={18} />
      </button>
    </div>
  );
}
