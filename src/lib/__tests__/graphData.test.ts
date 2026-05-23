import { describe, it, expect } from 'vitest';
import { buildGraphData } from '../graphData';
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

describe('buildGraphData', () => {
  it('modules level produces one node per module + pairwise links', () => {
    const { nodes, links } = buildGraphData('modules', mkCourse(), terms, undefined, undefined, null);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.id).sort()).toEqual(['m1', 'm2']);
    expect(links).toHaveLength(1);
    expect(links[0].source).toBe('m1');
    expect(links[0].target).toBe('m2');
  });

  it('lessons level shows lessons of drill module', () => {
    const { nodes, links } = buildGraphData('lessons', mkCourse(), terms, 'm1', undefined, null);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.id)).toEqual(['l1', 'l2']);
    expect(links).toHaveLength(1);
  });

  it('terms level produces center + per-term nodes', () => {
    const { nodes, links } = buildGraphData('terms', mkCourse(), terms, 'm1', 'l1', null);
    expect(nodes.find(n => n.type === 'lesson')).toBeDefined();
    const termNodes = nodes.filter(n => n.type === 'term');
    expect(termNodes).toHaveLength(2);
    expect(links).toHaveLength(2);
  });

  it('returns empty for missing course', () => {
    const { nodes, links } = buildGraphData('modules', undefined, terms, undefined, undefined, null);
    expect(nodes).toHaveLength(0);
    expect(links).toHaveLength(0);
  });
});
