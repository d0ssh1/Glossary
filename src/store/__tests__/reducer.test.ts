import { describe, it, expect } from 'vitest';
import { appReducer } from '../AppContext';
import type { Course, Term } from '@/types';

function emptyState() {
  return appReducer(undefined as never, { type: '__INIT__' } as never);
}

const baseCourse: Course = {
  id: 'c1', name: 'C', url: '', lastImportDate: null, modules: [],
  glossaries: [
    {
      id: 'g1', name: 'G', courseId: 'c1',
      terms: [
        { id: 't1', name: 'A', definition: '', status: 'no-trait', moduleId: '', lessonId: '', occurrences: [], connections: [] },
      ],
    },
  ],
};

describe('appReducer', () => {
  it('SET_COURSES replaces the entire array', () => {
    const start = appReducer(emptyState(), { type: 'SET_COURSES', courses: [baseCourse] });
    expect(start.courses).toHaveLength(1);
    const cleared = appReducer(start, { type: 'SET_COURSES', courses: [] });
    expect(cleared.courses).toHaveLength(0);
  });

  it('ADD_COURSE appends', () => {
    const start = appReducer(emptyState(), { type: 'SET_COURSES', courses: [] });
    const next = appReducer(start, { type: 'ADD_COURSE', course: baseCourse });
    expect(next.courses).toHaveLength(1);
    expect(next.courses[0].id).toBe('c1');
  });

  it('UPDATE_TERM merges partial updates on the matching term', () => {
    const start = appReducer(emptyState(), { type: 'SET_COURSES', courses: [baseCourse] });
    const updates: Partial<Term> = { definition: 'new def', status: 'in-progress' };
    const next = appReducer(start, { type: 'UPDATE_TERM', termId: 't1', updates });
    const term = next.courses[0].glossaries[0].terms[0];
    expect(term.definition).toBe('new def');
    expect(term.status).toBe('in-progress');
    expect(term.name).toBe('A'); // untouched
  });

  it('DELETE_TERM removes term and resets activeTermId', () => {
    const start = appReducer(emptyState(), { type: 'SET_COURSES', courses: [baseCourse] });
    const focused = appReducer(start, { type: 'SET_ACTIVE_TERM', termId: 't1' });
    const next = appReducer(focused, { type: 'DELETE_TERM', termId: 't1' });
    expect(next.courses[0].glossaries[0].terms).toHaveLength(0);
    expect(next.activeTermId).toBeNull();
  });
});
