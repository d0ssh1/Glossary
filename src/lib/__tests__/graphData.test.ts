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

const terms: Term[] = [
  { id: 't1', name: 'Алгоритм', status: 'ready', definition: 'd', moduleId: 'm1', lessonId: 'l1', occurrences: [], connections: [] },
  { id: 't2', name: 'База', status: 'no-trait', definition: '', moduleId: 'm1', lessonId: 'l1', occurrences: [], connections: [] },
  { id: 't3', name: 'Граф', status: 'in-progress', definition: '', moduleId: 'm2', lessonId: 'l3', occurrences: [], connections: [] },
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
  it('modules level produces one node per module + pairwise links', () => {
    const { nodes, links } = buildGraphData('modules', baseOpts());
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.id).sort()).toEqual(['m1', 'm2']);
    expect(links).toHaveLength(1);
    expect(links[0].source).toBe('m1');
    expect(links[0].target).toBe('m2');
  });

  it('lessons level shows lessons of drill module', () => {
    const { nodes, links } = buildGraphData('lessons', baseOpts({ drillModuleId: 'm1' }));
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.id)).toEqual(['l1', 'l2']);
    expect(links).toHaveLength(1);
  });

  it('terms level produces center + per-term nodes', () => {
    const { nodes, links } = buildGraphData('terms', baseOpts({ drillModuleId: 'm1', drillLessonId: 'l1' }));
    expect(nodes.find(n => n.type === 'lesson')).toBeDefined();
    const termNodes = nodes.filter(n => n.type === 'term');
    expect(termNodes).toHaveLength(2);
    expect(links).toHaveLength(2);
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

  it('frequency filter "first-appearance" drops mention-type term nodes', () => {
    const all = buildGraphData('terms', baseOpts({ drillModuleId: 'm1', drillLessonId: 'l1' }));
    const first = buildGraphData('terms', baseOpts({
      drillModuleId: 'm1',
      drillLessonId: 'l1',
      filters: { ...defaultGraphFilters, frequency: 'first-appearance' },
    }));
    expect(first.links.length).toBeLessThan(all.links.length);
    expect(first.links.every(l => l.type === 'first-appearance')).toBe(true);
  });

  it('logic NOT excludes modules containing selected terms', () => {
    const out = buildGraphData('modules', baseOpts({
      filters: { ...defaultGraphFilters, logic: 'not' },
      selectedTermIds: ['t1'],
    }));
    // t1 is in m1 → m1 must be excluded, only m2 remains
    expect(out.nodes.map(n => n.id)).toEqual(['m2']);
  });

  it('logic AND keeps only modules containing every selected term', () => {
    const out = buildGraphData('modules', baseOpts({
      filters: { ...defaultGraphFilters, logic: 'and' },
      selectedTermIds: ['t1', 't3'],
    }));
    // No module has both — result must be empty
    expect(out.nodes).toHaveLength(0);
  });

  it('logic XOR keeps modules with exactly one selected term', () => {
    const out = buildGraphData('modules', baseOpts({
      filters: { ...defaultGraphFilters, logic: 'xor' },
      selectedTermIds: ['t1', 't3'],
    }));
    // m1 has t1 (count=1), m2 has t3 (count=1) — both kept
    expect(out.nodes.map(n => n.id).sort()).toEqual(['m1', 'm2']);
  });
});
