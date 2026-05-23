import { describe, it, expect } from 'vitest';
import { buildGraphData } from '../graphData';
import { defaultGraphFilters } from '@/store/AppContext';
import type { Course, Term } from '@/types';

function mkCourse(): Course {
  return {
    id: 'c1', name: 'C', url: '', lastImportDate: null, glossaries: [],
    modules: [
      {
        id: 'm1', name: 'M1', courseId: 'c1',
        lessons: [
          { id: 'l1', name: 'L1', moduleId: 'm1', steps: [] },
          { id: 'l2', name: 'L2', moduleId: 'm1', steps: [] },
        ],
      },
      {
        id: 'm2', name: 'M2', courseId: 'c1',
        lessons: [{ id: 'l3', name: 'L3', moduleId: 'm2', steps: [] }],
      },
    ],
  };
}

// Term fixture:
// - 'Алгоритм' lives in m1/l1 AND m2/l3 (same name) → creates a shared edge
//   between m1↔m2 (modules level) and gives the m2/l3 instance a 'mention' link
//   (l1 comes earlier than l3 in DFS order).
// - 'База' lives in m1/l1 AND m1/l2 → creates a shared edge between l1↔l2
//   inside m1 at the lessons level.
// - 'Граф' is unique to m2/l3.
const terms: Term[] = [
  { id: 't1', name: 'Алгоритм', status: 'ready', definition: 'd', moduleId: 'm1', lessonId: 'l1', occurrences: [], connections: [] },
  { id: 't2', name: 'База', status: 'no-trait', definition: '', moduleId: 'm1', lessonId: 'l1', occurrences: [], connections: [] },
  { id: 't3', name: 'Граф', status: 'in-progress', definition: '', moduleId: 'm2', lessonId: 'l3', occurrences: [], connections: [] },
  { id: 't4', name: 'Алгоритм', status: 'ready', definition: '', moduleId: 'm2', lessonId: 'l3', occurrences: [], connections: [] },
  { id: 't5', name: 'База', status: 'no-trait', definition: '', moduleId: 'm1', lessonId: 'l2', occurrences: [], connections: [] },
];

function baseOpts(overrides: Partial<Parameters<typeof buildGraphData>[1]> = {}) {
  return {
    course: mkCourse(),
    allTerms: terms,
    drillModuleId: undefined,
    drillLessonId: undefined,
    hierFilterIds: null,
    filters: defaultGraphFilters,
    selectedTermIds: [],
    ...overrides,
  } as Parameters<typeof buildGraphData>[1];
}

describe('buildGraphData', () => {
  it('modules level connects only pairs that share a term', () => {
    const { nodes, links } = buildGraphData('modules', baseOpts());
    expect(nodes.map(n => n.id).sort()).toEqual(['m1', 'm2']);
    expect(links).toHaveLength(1);
    expect(links[0].source).toBe('m1');
    expect(links[0].target).toBe('m2');
    expect(links[0].weight).toBe(1); // exactly one shared term: 'Алгоритм'
  });

  it('modules level: no edge when modules share zero terms', () => {
    const { links } = buildGraphData('modules', baseOpts({
      // Drop the bridge term so m1 and m2 have nothing in common.
      allTerms: terms.filter(t => t.id !== 't4'),
    }));
    expect(links).toHaveLength(0);
  });

  it('lessons level connects only lesson pairs that share a term', () => {
    const { nodes, links } = buildGraphData('lessons', baseOpts({ drillModuleId: 'm1' }));
    expect(nodes.map(n => n.id)).toEqual(['l1', 'l2']);
    expect(links).toHaveLength(1);
    expect(links[0].weight).toBe(1); // exactly one shared term: 'База'
  });

  it('terms level: link is mention when the term first appeared earlier in the course', () => {
    // l3 is in m2, AFTER m1.l1 (which also has 'Алгоритм'/t1). So at l3 the
    // 'Алгоритм' instance (t4) must be drawn as a mention.
    const { links } = buildGraphData('terms', baseOpts({ drillModuleId: 'm2', drillLessonId: 'l3' }));
    const alg = links.find(l => l.target === 't4');
    const graf = links.find(l => l.target === 't3');
    expect(alg?.type).toBe('mention');
    expect(graf?.type).toBe('first-appearance'); // unique to this lesson
  });

  it('terms level: first lesson with a term gets first-appearance link', () => {
    const { links } = buildGraphData('terms', baseOpts({ drillModuleId: 'm1', drillLessonId: 'l1' }));
    // l1 is the earliest lesson — both 'Алгоритм' (t1) and 'База' (t2) declared here.
    expect(links.every(l => l.type === 'first-appearance')).toBe(true);
  });

  it('returns empty for missing course', () => {
    const { nodes, links } = buildGraphData('modules', baseOpts({ course: undefined }));
    expect(nodes).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it('weight filter drops out-of-range edges', () => {
    const { links } = buildGraphData('modules', baseOpts({
      filters: { ...defaultGraphFilters, weightEnabled: true, weightFrom: 10, weightTo: 20 },
    }));
    expect(links).toHaveLength(0);
  });

  it('frequency filter "mention" keeps only mention-type terms', () => {
    const out = buildGraphData('terms', baseOpts({
      drillModuleId: 'm2',
      drillLessonId: 'l3',
      filters: { ...defaultGraphFilters, frequency: 'mention' },
    }));
    expect(out.links.every(l => l.type === 'mention')).toBe(true);
    expect(out.links.length).toBeGreaterThan(0);
  });

  it('logic NOT excludes modules containing selected terms', () => {
    const out = buildGraphData('modules', baseOpts({
      filters: { ...defaultGraphFilters, logic: 'not' },
      selectedTermIds: ['t1'],
    }));
    // t1 lives in m1 → only m2 should remain.
    expect(out.nodes.map(n => n.id)).toEqual(['m2']);
  });

  it('logic AND keeps only modules containing every selected term', () => {
    const out = buildGraphData('modules', baseOpts({
      filters: { ...defaultGraphFilters, logic: 'and' },
      selectedTermIds: ['t1', 't3'],
    }));
    // No single module hosts both t1 (m1) and t3 (m2).
    expect(out.nodes).toHaveLength(0);
  });

  it('logic XOR keeps modules with exactly one selected term', () => {
    const out = buildGraphData('modules', baseOpts({
      filters: { ...defaultGraphFilters, logic: 'xor' },
      selectedTermIds: ['t1', 't3'],
    }));
    // m1 hosts t1 (count=1), m2 hosts t3 (count=1) — both kept.
    expect(out.nodes.map(n => n.id).sort()).toEqual(['m1', 'm2']);
  });
});
