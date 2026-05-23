import { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles, User } from 'lucide-react';
import { useApp } from '@/store/AppContext';
import type { Term } from '@/types';

interface LinkEditorProps {
  term: Term;
  onClose: () => void;
}

export default function LinkEditor({ term, onClose }: LinkEditorProps) {
  const { state } = useApp();
  const course = state.courses.find(c => c.id === state.activeCourseId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(
    new Set(term.connections.map(c => c.stepId)),
  );

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLink = (stepId: string) => {
    setSelectedLinks(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  return (
    <div className="rounded border p-2"
      style={{ borderColor: 'var(--lw-border-primary)', backgroundColor: 'var(--lw-bg-primary)' }}>
      <p className="mb-2 text-xs font-medium" style={{ color: 'var(--lw-text-secondary)' }}>
        выберите места вхождения термина выбрано: {selectedLinks.size}
      </p>
      <p className="mb-2 text-xs" style={{ color: 'var(--lw-text-muted)' }}>
        <User size={9} className="inline" style={{ color: 'var(--lw-accent-amber)' }} /> — редактором,
        <Sparkles size={9} className="ml-1 inline" style={{ color: 'var(--lw-success)' }} /> — системой
      </p>

      <div className="max-h-48 overflow-y-auto lw-scrollbar">
        {course?.modules.map(mod => (
          <div key={mod.id}>
            <button
              onClick={() => toggleExpand(mod.id)}
              className="flex w-full items-center gap-1 px-1 py-0.5 text-left text-xs font-medium"
              style={{ color: 'var(--lw-text-primary)' }}
            >
              {expanded[mod.id] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <input
                type="checkbox"
                className="mr-1 accent-[var(--lw-accent-graphite)]"
                checked={mod.lessons.every(l => l.steps.every(s => selectedLinks.has(s.id)))}
                onChange={() => {}}
                onClick={e => e.stopPropagation()}
              />
              {mod.name}
            </button>
            {expanded[mod.id] && mod.lessons.map(lesson => (
              <div key={lesson.id} className="ml-3">
                <button
                  onClick={() => toggleExpand(lesson.id)}
                  className="flex w-full items-center gap-1 px-1 py-0.5 text-left text-xs"
                  style={{ color: 'var(--lw-text-secondary)' }}
                >
                  {expanded[lesson.id] ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                  <input
                    type="checkbox"
                    className="mr-1 accent-[var(--lw-accent-graphite)]"
                    checked={lesson.steps.every(s => selectedLinks.has(s.id))}
                    onChange={() => {}}
                    onClick={e => e.stopPropagation()}
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
                        onChange={() => toggleLink(step.id)}
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
            ))}
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded border py-1.5 text-xs font-medium"
          style={{ borderColor: 'var(--lw-border-primary)', color: 'var(--lw-text-secondary)' }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}
