import { describe, it, expect } from 'vitest';
import {
  buildOrderIndex,
  firstAppearanceId,
  applyFrequencyToContextTerms,
  applyLogicToContextTerms,
} from '@/lib/contextFilters';
import type { Course, Term, Connection } from '@/types';

function conn(moduleId: string, lessonId: string, stepId: string): Connection {
  return {
    id: `b-${stepId}`,
    moduleId, moduleName: moduleId,
    lessonId, lessonName: lessonId,
    stepId, stepName: stepId,
    type: 'system',
  };
}

/** Three modules in reading order: HTML → JS → CSS, one lesson/step each. */
function mkCourse(): Course {
  const mk = (m: string) => ({
    id: m, name: m, courseId: 'c1',
    lessons: [{
      id: `${m}-l`, name: `${m}-l`, moduleId: m,
      steps: [{ id: `${m}-s`, name: `${m}-s`, lessonId: `${m}-l`, moduleId: m, content: '', ftsIndexed: true }],
    }],
  });
  return {
    id: 'c1', name: 'C', url: '', lastImportDate: null, glossaries: [],
    modules: [mk('html'), mk('js'), mk('css')],
  };
}

function mkTerm(id: string, name: string, conns: Connection[]): Term {
  return { id, name, status: 'no-trait', definition: '', occurrences: [], connections: conns, moduleId: '', lessonId: '' };
}

describe('contextFilters — frequency', () => {
  const course = mkCourse();
  const idx = buildOrderIndex(course);
  // «тег» appears in all three modules.
  const tag = mkTerm('t1', 'тег', [
    conn('html', 'html-l', 'html-s'),
    conn('js', 'js-l', 'js-s'),
    conn('css', 'css-l', 'css-s'),
  ]);

  it('locates first appearance at the earliest module', () => {
    expect(firstAppearanceId(tag, 'modules', idx)).toBe('html');
  });

  it('"first-appearance" hides the term in later modules', () => {
    expect(applyFrequencyToContextTerms([tag], 'modules', ['js'], 'first-appearance', idx)).toEqual([]);
    expect(applyFrequencyToContextTerms([tag], 'modules', ['css'], 'first-appearance', idx)).toEqual([]);
  });

  it('"first-appearance" keeps the term in its origin module', () => {
    expect(applyFrequencyToContextTerms([tag], 'modules', ['html'], 'first-appearance', idx)).toEqual([tag]);
  });

  it('"mention" keeps it only in later modules', () => {
    expect(applyFrequencyToContextTerms([tag], 'modules', ['html'], 'mention', idx)).toEqual([]);
    expect(applyFrequencyToContextTerms([tag], 'modules', ['js'], 'mention', idx)).toEqual([tag]);
  });

  it('"all" is a no-op', () => {
    expect(applyFrequencyToContextTerms([tag], 'modules', ['js'], 'all', idx)).toEqual([tag]);
  });
});

describe('contextFilters — logic', () => {
  const a = mkTerm('t1', 'A', []);
  const b = mkTerm('t2', 'B', []);

  it('"or" leaves the list untouched', () => {
    expect(applyLogicToContextTerms([a, b], ['t1'], 'or')).toEqual([a, b]);
  });

  it('"and"/"xor" narrow to the selected terms', () => {
    expect(applyLogicToContextTerms([a, b], ['t1'], 'and')).toEqual([a]);
    expect(applyLogicToContextTerms([a, b], ['t2'], 'xor')).toEqual([b]);
  });

  it('"not" keeps only the non-selected terms', () => {
    expect(applyLogicToContextTerms([a, b], ['t1'], 'not')).toEqual([b]);
  });

  it('no selection is a no-op', () => {
    expect(applyLogicToContextTerms([a, b], [], 'and')).toEqual([a, b]);
  });
});
