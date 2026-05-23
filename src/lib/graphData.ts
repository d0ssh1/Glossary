// ============================================================
// GRAPH DATA — build nodes/links for each drill-down level
// ============================================================
import type { Course, Term, GraphLevel, GraphNode, GraphLink, LinkType } from '@/types';

export function buildGraphData(
  level: GraphLevel,
  course: Course | undefined,
  allTerms: Term[],
  drillModuleId: string | undefined,
  drillLessonId: string | undefined,
  hierFilterIds: string[] | null,
): { nodes: GraphNode[]; links: GraphLink[] } {
  if (!course) return { nodes: [], links: [] };

  // Filter course in-place: only keep modules/lessons present in hierFilterIds.
  const filtered = hierFilterIds === null
    ? course
    : {
        ...course,
        modules: course.modules
          .filter(m => hierFilterIds.includes(m.id))
          .map(m => ({ ...m, lessons: m.lessons.filter(l => hierFilterIds.includes(l.id)) })),
      };

  if (level === 'modules') return buildModulesGraph(filtered, allTerms);
  if (level === 'lessons') return buildLessonsGraph(filtered, drillModuleId);
  return buildTermsGraph(filtered, allTerms, drillModuleId, drillLessonId);
}

function buildModulesGraph(course: Course, allTerms: Term[]) {
  const nodes: GraphNode[] = course.modules.map(m => ({
    id: m.id, name: m.name, type: 'module',
  }));

  const links: GraphLink[] = [];
  const mods = course.modules;
  for (let i = 0; i < mods.length; i++) {
    for (let j = i + 1; j < mods.length; j++) {
      const a = mods[i].id, b = mods[j].id;
      const shared = allTerms
        .filter(t => t.moduleId === a)
        .filter(ta => allTerms.some(tb => tb.moduleId === b && tb.name === ta.name))
        .length;
      const weight = shared || (Math.abs(i - j) === 1 ? 2 : 1);
      links.push({
        source: a,
        target: b,
        type: (Math.abs(i - j) === 1 ? 'first-appearance' : 'mention') as LinkType,
        weight: Math.max(1, weight),
      });
    }
  }
  return { nodes, links };
}

function buildLessonsGraph(course: Course, drillModuleId: string | undefined) {
  const mod = course.modules.find(m => m.id === drillModuleId) || course.modules[0];
  if (!mod) return { nodes: [], links: [] };

  const nodes: GraphNode[] = mod.lessons.map(l => ({
    id: l.id, name: l.name, type: 'lesson', parentId: mod.id,
  }));

  const links: GraphLink[] = [];
  for (let i = 0; i < mod.lessons.length - 1; i++) {
    links.push({
      source: mod.lessons[i].id,
      target: mod.lessons[i + 1].id,
      type: 'first-appearance',
      weight: 3,
    });
  }
  if (mod.lessons.length >= 4) {
    links.push({ source: mod.lessons[0].id, target: mod.lessons[3].id, type: 'mention', weight: 2 });
  }
  return { nodes, links };
}

function buildTermsGraph(
  course: Course,
  allTerms: Term[],
  drillModuleId: string | undefined,
  drillLessonId: string | undefined,
) {
  const mod = course.modules.find(m => m.id === drillModuleId);
  const lesson = mod?.lessons.find(l => l.id === drillLessonId) || mod?.lessons[0];
  if (!lesson) return { nodes: [], links: [] };

  const lessonTerms = allTerms.filter(t => t.lessonId === lesson.id);
  const centerId = `center-${lesson.id}`;

  const nodes: GraphNode[] = [
    { id: centerId, name: lesson.name, type: 'lesson', parentId: lesson.id },
    ...lessonTerms.map(t => ({
      id: t.id, name: t.name, type: 'term' as const, status: t.status, parentId: lesson.id,
    })),
  ];

  const links: GraphLink[] = lessonTerms.map((t, i) => ({
    source: centerId,
    target: t.id,
    type: (i % 2 === 0 ? 'first-appearance' : 'mention') as LinkType,
    weight: 1 + (i % 3),
  }));

  return { nodes, links };
}
