// ============================================================
// API ADAPTER — map raw backend shapes to frontend types
// ============================================================
import type {
  ApiCourseFull, ApiGlossaryFull, ApiTerm, ApiOccurrence, ApiBinding,
} from './apiTypes';
import type {
  Course, Module, Lesson, Step, Glossary, Term, Occurrence, TermStatus,
} from '@/types';

export type IdPrefix = 'c' | 'm' | 's' | 'l' | 'st' | 'g' | 't' | 'b' | 'o';

export function numericToId(prefix: IdPrefix, n: number): string {
  return `${prefix}${n}`;
}

export function stringIdToNumeric(id: string): number {
  // Strip leading non-digit prefix
  const m = id.match(/(\d+)$/);
  if (!m) throw new Error(`Cannot extract numeric id from "${id}"`);
  return parseInt(m[1], 10);
}

function deriveStatus(term: ApiTerm): TermStatus {
  const hasDef = term.definition.trim() !== '';
  const hasBindings = term.bindings.length > 0;
  if (hasDef && hasBindings) return 'ready';
  if (hasDef || hasBindings) return 'in-progress';
  return 'no-trait';
}

export function mapTerm(api: ApiTerm, moduleId: string, lessonId: string): Term {
  return {
    id: numericToId('t', api.id),
    name: api.name,
    definition: api.definition,
    status: deriveStatus(api),
    moduleId,
    lessonId,
    occurrences: [],
    connections: [],
  };
}

export function mapOccurrences(arr: ApiOccurrence[]): Occurrence[] {
  return arr.map((o, i) => ({
    id: `o-${o.step_id}-${i}`,
    snippet: o.snippet,
    highlightedTerm: '',
    moduleId: numericToId('m', o.section_id),
    lessonId: numericToId('l', o.lesson_id),
    stepId: numericToId('st', o.step_id),
    stepName: o.step_name,
  }));
}

interface StepLocation { moduleId: string; lessonId: string; }

function indexSteps(course: ApiCourseFull): Map<number, StepLocation> {
  const map = new Map<number, StepLocation>();
  for (const section of course.sections) {
    const moduleId = numericToId('m', section.id);
    for (const lesson of section.lessons) {
      const lessonId = numericToId('l', lesson.id);
      for (const step of lesson.steps) {
        map.set(step.id, { moduleId, lessonId });
      }
    }
  }
  return map;
}

export function mapCourseFull(api: ApiCourseFull, glossaries: ApiGlossaryFull[]): Course {
  const courseId = numericToId('c', api.id);

  const modules: Module[] = api.sections.map(section => {
    const moduleId = numericToId('m', section.id);
    const lessons: Lesson[] = section.lessons.map(lesson => {
      const lessonId = numericToId('l', lesson.id);
      const steps: Step[] = lesson.steps.map(step => ({
        id: numericToId('st', step.id),
        name: step.name,
        lessonId,
        moduleId,
        content: '',
        ftsIndexed: lesson.is_indexed,
      }));
      return { id: lessonId, name: lesson.title, moduleId, steps, isIndexed: lesson.is_indexed };
    });
    return { id: moduleId, name: section.title, courseId, lessons, isIndexed: section.is_indexed };
  });

  const stepIndex = indexSteps(api);

  const mappedGlossaries: Glossary[] = glossaries.map(g => {
    const terms = g.terms.map(t => {
      // Pick first binding's step location for moduleId/lessonId, else ''.
      const primary: ApiBinding | undefined = t.bindings.find(b => b.is_primary) || t.bindings[0];
      const loc = primary ? stepIndex.get(primary.step_id) : undefined;
      return mapTerm(t, loc?.moduleId ?? '', loc?.lessonId ?? '');
    });
    return {
      id: numericToId('g', g.id),
      name: g.title,
      courseId,
      terms,
    };
  });

  return {
    id: courseId,
    name: api.title,
    url: api.url,
    lastImportDate: api.import_date,
    modules,
    glossaries: mappedGlossaries,
  };
}
