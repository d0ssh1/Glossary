import { describe, it, expect } from 'vitest';
import { mapCourseFull, stringIdToNumeric, numericToId, mapTerm } from '../apiAdapter';
import type { ApiCourseFull, ApiGlossaryFull } from '../apiTypes';

const sampleCourse: ApiCourseFull = {
  id: 1, title: 'Demo', url: 'http://x', is_parsed: true, import_date: '2026-01-01T00:00:00Z',
  sections: [
    {
      id: 10, course_id: 1, title: 'Section A', position: 0, is_indexed: true,
      lessons: [
        {
          id: 100, section_id: 10, title: 'Lesson A', position: 0, is_indexed: true,
          steps: [
            { id: 1000, lesson_id: 100, position: 0, step_url: 'u', name: 'Step 1' },
          ],
        },
      ],
    },
  ],
};

const sampleGloss: ApiGlossaryFull = {
  id: 20, course_id: 1, title: 'Glossary', text_content: '',
  terms: [
    {
      id: 200, glossary_id: 20, name: 'Term1', definition: 'def',
      bindings: [{ id: 300, term_id: 200, step_id: 1000, is_primary: true, is_created_by_user: false }],
    },
    {
      id: 201, glossary_id: 20, name: 'Term2', definition: '',
      bindings: [],
    },
    {
      id: 202, glossary_id: 20, name: 'Term3', definition: '',
      bindings: [{ id: 301, term_id: 202, step_id: 1000, is_primary: true, is_created_by_user: false }],
    },
  ],
};

describe('apiAdapter', () => {
  it('stringIdToNumeric ↔ numericToId round-trips', () => {
    expect(stringIdToNumeric(numericToId('t', 42))).toBe(42);
    expect(stringIdToNumeric('c123')).toBe(123);
    expect(stringIdToNumeric('st9999')).toBe(9999);
  });

  it('mapCourseFull builds the full frontend tree with prefixed ids', () => {
    const course = mapCourseFull(sampleCourse, [sampleGloss]);
    expect(course.id).toBe('c1');
    expect(course.name).toBe('Demo');
    expect(course.modules).toHaveLength(1);
    expect(course.modules[0].id).toBe('m10');
    expect(course.modules[0].lessons[0].id).toBe('l100');
    expect(course.modules[0].lessons[0].steps[0].id).toBe('st1000');
    expect(course.modules[0].lessons[0].steps[0].moduleId).toBe('m10');
    expect(course.glossaries).toHaveLength(1);
    expect(course.glossaries[0].id).toBe('g20');
    expect(course.glossaries[0].terms).toHaveLength(3);
  });

  it('derives term status correctly', () => {
    const course = mapCourseFull(sampleCourse, [sampleGloss]);
    const terms = course.glossaries[0].terms;
    expect(terms[0].status).toBe('ready');       // def + binding
    expect(terms[1].status).toBe('no-trait');    // neither
    expect(terms[2].status).toBe('in-progress'); // binding only
  });

  it('mapTerm assigns moduleId/lessonId from caller', () => {
    const t = mapTerm(sampleGloss.terms[0], 'm10', 'l100');
    expect(t.moduleId).toBe('m10');
    expect(t.lessonId).toBe('l100');
    expect(t.id).toBe('t200');
  });
});
