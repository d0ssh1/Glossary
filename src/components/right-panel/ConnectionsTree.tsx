import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Sparkles, User } from 'lucide-react';
import type { Connection } from '@/types';

/**
 * Read-only hierarchical view of a term's connections: module → lesson → step,
 * collapsible, no checkboxes. Replaces the old flat card list which became an
 * unreadable wall when a term appeared in 50+ places (Anton's feedback). Each
 * module/lesson groups its children and shows a count; steps are the leaves,
 * tagged with who created the binding (editor vs system).
 */
interface StepLeaf { id: string; stepName: string; type: 'editor' | 'system' }
interface LessonGroup { key: string; lessonName: string; steps: StepLeaf[] }
interface ModuleGroup { key: string; moduleName: string; lessons: LessonGroup[]; count: number }

function buildTree(connections: Connection[]): ModuleGroup[] {
  const modules: ModuleGroup[] = [];
  const modIndex = new Map<string, ModuleGroup>();
  for (const c of connections) {
    const mKey = c.moduleId || c.moduleName || '—';
    let mod = modIndex.get(mKey);
    if (!mod) {
      mod = { key: mKey, moduleName: c.moduleName || 'Без модуля', lessons: [], count: 0 };
      modIndex.set(mKey, mod);
      modules.push(mod);
    }
    const lKey = c.lessonId || c.lessonName || '—';
    let lesson = mod.lessons.find(l => l.key === lKey);
    if (!lesson) {
      lesson = { key: lKey, lessonName: c.lessonName || 'Без урока', steps: [] };
      mod.lessons.push(lesson);
    }
    lesson.steps.push({ id: c.id, stepName: c.stepName || 'Шаг', type: c.type });
    mod.count += 1;
  }
  return modules;
}

export default function ConnectionsTree({ connections }: { connections: Connection[] }) {
  const tree = useMemo(() => buildTree(connections), [connections]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  if (connections.length === 0) {
    return <p className="py-1 text-xs italic" style={{ color: 'var(--lw-text-muted)' }}>Нет связей</p>;
  }

  return (
    <div className="space-y-0.5">
      {tree.map(mod => {
        const modCollapsed = collapsed[mod.key];
        return (
          <div key={mod.key}>
            <button
              onClick={() => toggle(mod.key)}
              className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-xs font-medium transition-colors"
              style={{ color: 'var(--lw-text-primary)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {modCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              <span className="truncate">{mod.moduleName}</span>
              <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--lw-text-muted)' }}>{mod.count}</span>
            </button>

            {!modCollapsed && mod.lessons.map(lesson => {
              const lessonKey = `${mod.key}/${lesson.key}`;
              const lessonCollapsed = collapsed[lessonKey];
              return (
                <div key={lessonKey} className="ml-3">
                  <button
                    onClick={() => toggle(lessonKey)}
                    className="flex w-full items-center gap-1 rounded px-1.5 py-0.5 text-left text-xs transition-colors"
                    style={{ color: 'var(--lw-text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--lw-bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {lessonCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                    <span className="truncate">{lesson.lessonName}</span>
                    <span className="ml-auto shrink-0 text-[10px]" style={{ color: 'var(--lw-text-muted)' }}>{lesson.steps.length}</span>
                  </button>

                  {!lessonCollapsed && lesson.steps.map(step => (
                    <div key={step.id} className="ml-5 flex items-center gap-1.5 px-1.5 py-0.5">
                      {step.type === 'editor'
                        ? <User size={9} style={{ color: 'var(--lw-accent-amber)' }} />
                        : <Sparkles size={9} style={{ color: 'var(--lw-success)' }} />}
                      <span className="truncate text-xs" style={{ color: 'var(--lw-text-primary)' }}>{step.stepName}</span>
                      <ExternalLink size={9} className="shrink-0" style={{ color: 'var(--lw-accent-amber)' }} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
