// ============================================================
// TYPES — Lexicon Weaver
// ============================================================

export type TermStatus = 'no-trait' | 'in-progress' | 'ready';
export type LinkType = 'first-appearance' | 'mention';
export type ScormVersion = '1.2' | '2004';
export type GraphLevel = 'modules' | 'lessons' | 'terms';
export type FilterStatus = 'all' | 'no-trait' | 'in-progress' | 'ready';
export type TabLeft = 'glossary' | 'addition';
export type TabRight = 'context' | 'filters';
export type ModalType =
  | 'add-course'
  | 'create-glossary'
  | 'connection-settings'
  | 'sync-process'
  | 'sync-report'
  | 'export-settings'
  | 'confirm-delete'
  | 'unsaved-changes'
  | 'occurrences'
  | null;

export interface Term {
  id: string;
  name: string;
  status: TermStatus;
  definition: string;
  occurrences: Occurrence[];
  connections: Connection[];
  moduleId: string;
  lessonId: string;
}

export interface Occurrence {
  id: string;
  snippet: string;
  highlightedTerm: string;
  moduleId: string;
  lessonId: string;
  stepId: string;
  stepName: string;
}

export interface Connection {
  id: string;
  moduleId: string;
  moduleName: string;
  lessonId: string;
  lessonName: string;
  stepId: string;
  stepName: string;
  type: 'editor' | 'system';
}

export interface Glossary {
  id: string;
  name: string;
  courseId: string;
  terms: Term[];
}

export interface Course {
  id: string;
  name: string;
  url: string;
  lastImportDate: string | null;
  glossaries: Glossary[];
  modules: Module[];
}

export interface Module {
  id: string;
  name: string;
  courseId: string;
  lessons: Lesson[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface Lesson {
  id: string;
  name: string;
  moduleId: string;
  steps: Step[];
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface Step {
  id: string;
  name: string;
  lessonId: string;
  moduleId: string;
  content: string;
  ftsIndexed: boolean;
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'module' | 'lesson' | 'term';
  status?: TermStatus;
  parentId?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: LinkType;
  weight?: number;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  level: GraphLevel;
}

export interface SyncReport {
  courseName: string;
  modulesCount: number;
  lessonsCount: number;
  stepsCount: number;
  /** Populated when the import failed; surfaces the backend's error message. */
  error?: string;
}
