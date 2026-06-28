// ============================================================
// API ADAPTER — map raw backend shapes to frontend types
// ============================================================
import type {
  ApiCourseFull, ApiGlossaryFull, ApiTerm, ApiOccurrence, ApiBinding,
} from './apiTypes';
import type {
  Course, Module, Lesson, Step, Glossary, Term, Occurrence, TermStatus, Connection,
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

export function mapTerm(
  api: ApiTerm,
  moduleId: string,
  lessonId: string,
  stepLocations: Map<number, StepLocationFull> = new Map(),
): Term {
  // Materialise backend bindings into the frontend Connection[] shape so the
  // LinkEditor knows which step IDs are currently bound and can compute a
  // proper diff on save.
  const connections: Connection[] = api.bindings.map(b => {
    const loc = stepLocations.get(b.step_id);
    return {
      id: numericToId('b', b.id),
      moduleId: loc?.moduleId ?? '',
      moduleName: loc?.moduleName ?? '',
      lessonId: loc?.lessonId ?? '',
      lessonName: loc?.lessonName ?? '',
      stepId: numericToId('st', b.step_id),
      stepName: loc?.stepName ?? '',
      type: b.is_created_by_user ? 'editor' : 'system',
      stepUrl: loc?.stepUrl,
    };
  });
  return {
    id: numericToId('t', api.id),
    name: api.name,
    definition: api.definition,
    status: deriveStatus(api),
    moduleId,
    lessonId,
    // Occurrences are normally lazy-loaded, but the SCORM export bakes them
    // into the term payload so the published player can show contexts offline.
    occurrences: api.occurrences ? mapOccurrences(api.occurrences) : [],
    connections,
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
    stepUrl: o.step_url,
  }));
}

interface StepLocation { moduleId: string; lessonId: string; }

interface StepLocationFull extends StepLocation {
  moduleName: string;
  lessonName: string;
  stepName: string;
  stepUrl: string;
}

function indexSteps(course: ApiCourseFull): Map<number, StepLocationFull> {
  const map = new Map<number, StepLocationFull>();
  for (const section of course.sections) {
    const moduleId = numericToId('m', section.id);
    for (const lesson of section.lessons) {
      const lessonId = numericToId('l', lesson.id);
      for (const step of lesson.steps) {
        map.set(step.id, {
          moduleId, lessonId,
          moduleName: section.title,
          lessonName: lesson.title,
          stepName: step.name,
          stepUrl: step.step_url,
        });
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
        url: step.step_url,
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
      return mapTerm(t, loc?.moduleId ?? '', loc?.lessonId ?? '', stepIndex);
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
