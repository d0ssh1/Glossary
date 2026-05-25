// ============================================================
// GLOBAL STATE — Lexicon Weaver
// ============================================================
import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import type {
  Course, Glossary, Term, GraphLevel, BreadcrumbItem,
  ModalType, FilterStatus, TabLeft, TabRight, SyncReport,
} from '@/types';
import { mockCourses } from '@/data/mock';
import {
  apiEnabled, listCourses, getCourse, listGlossaries, getGlossary,
  createCourse as apiCreateCourseRaw, createGlossary as apiCreateGlossaryRaw,
  updateTerm as apiUpdateTermRaw, deleteTerm as apiDeleteTermRaw,
  bulkCreateTerms as apiBulkCreateTermsRaw,
  importCourse as apiImportCourseRaw, downloadScorm as apiDownloadScormRaw,
  collectBindings as apiCollectBindingsRaw, getImportStatus as apiGetImportStatus,
  patchSection as apiPatchSection, patchLesson as apiPatchLesson,
} from '@/lib/api';
import { mapCourseFull, stringIdToNumeric, numericToId } from '@/lib/apiAdapter';

/** Filter set lifted out of FiltersTab so the graph renderer can react to it. */
export type FrequencyMode = 'all' | 'first-appearance' | 'mention';
export type LogicMode = 'and' | 'or' | 'not' | 'xor';
export interface GraphFilters {
  weightEnabled: boolean;
  weightFrom: number;
  weightTo: number;
  frequency: FrequencyMode;
  logic: LogicMode;
}

export const defaultGraphFilters: GraphFilters = {
  weightEnabled: false,
  weightFrom: 0,
  weightTo: 100,
  frequency: 'all',
  logic: 'or',
};

// --- State ---
interface AppState {
  screen: 'dashboard' | 'editor';
  courses: Course[];
  activeCourseId: string | null;
  activeGlossaryId: string | null;
  activeTermId: string | null;
  activeNodeId: string | null;
  /** Selected edge id (format: "<sourceId>__<targetId>"). Mutually exclusive with activeNodeId/activeTermId. */
  activeLinkId: string | null;
  graphLevel: GraphLevel;
  breadcrumbs: BreadcrumbItem[];
  modal: ModalType;
  modalData: Record<string, unknown>;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftTab: TabLeft;
  rightTab: TabRight;
  filterStatus: FilterStatus;
  searchTerm: string;
  selectedTermIds: string[];
  /** Module/lesson IDs included by the hierarchical filter. `null` = "everything". */
  hierFilterIds: string[] | null;
  graphFilters: GraphFilters;
  hasUnsavedChanges: boolean;
  pendingNavigation: (() => void) | null;
  syncProgress: number;
  syncStatus: string;
  syncReport: SyncReport | null;
}

const initialState: AppState = {
  screen: 'dashboard',
  courses: apiEnabled() ? [] : mockCourses,
  activeCourseId: null,
  activeGlossaryId: null,
  activeTermId: null,
  activeNodeId: null,
  activeLinkId: null,
  graphLevel: 'modules',
  breadcrumbs: [],
  modal: null,
  modalData: {},
  leftPanelOpen: true,
  rightPanelOpen: true,
  leftTab: 'glossary',
  rightTab: 'context',
  filterStatus: 'all',
  searchTerm: '',
  selectedTermIds: [],
  hierFilterIds: null,
  graphFilters: defaultGraphFilters,
  hasUnsavedChanges: false,
  pendingNavigation: null,
  syncProgress: 0,
  syncStatus: '',
  syncReport: null,
};

// --- Actions ---
type Action =
  | { type: 'NAVIGATE'; screen: 'dashboard' | 'editor' }
  | { type: 'SET_ACTIVE_COURSE'; courseId: string | null }
  | { type: 'SET_ACTIVE_GLOSSARY'; glossaryId: string | null }
  | { type: 'SET_ACTIVE_TERM'; termId: string | null }
  | { type: 'SET_ACTIVE_NODE'; nodeId: string | null }
  | { type: 'SET_ACTIVE_LINK'; linkId: string | null }
  | { type: 'SET_FTS_INDEXED'; nodeType: 'module' | 'lesson'; nodeId: string; value: boolean }
  | { type: 'SET_GRAPH_LEVEL'; level: GraphLevel; breadcrumbs: BreadcrumbItem[] }
  | { type: 'DRILL_DOWN'; nodeId: string; nodeName: string; level: GraphLevel }
  | { type: 'BREADCRUMB_NAV'; index: number }
  | { type: 'OPEN_MODAL'; modal: ModalType; data?: Record<string, unknown> }
  | { type: 'CLOSE_MODAL' }
  | { type: 'TOGGLE_LEFT_PANEL' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'SET_LEFT_TAB'; tab: TabLeft }
  | { type: 'SET_RIGHT_TAB'; tab: TabRight }
  | { type: 'SET_FILTER_STATUS'; status: FilterStatus }
  | { type: 'SET_SEARCH_TERM'; term: string }
  | { type: 'TOGGLE_TERM_SELECTION'; termId: string }
  | { type: 'SELECT_ALL_TERMS'; termIds: string[] }
  | { type: 'DESELECT_ALL_TERMS' }
  | { type: 'SET_HIER_FILTER'; ids: string[] | null }
  | { type: 'SET_GRAPH_FILTERS'; filters: Partial<GraphFilters> }
  | { type: 'SET_UNSAVED_CHANGES'; value: boolean }
  | { type: 'SET_PENDING_NAVIGATION'; fn: (() => void) | null }
  | { type: 'SET_SYNC_PROGRESS'; progress: number; status: string }
  | { type: 'SET_SYNC_REPORT'; report: SyncReport | null }
  | { type: 'SET_COURSES'; courses: Course[] }
  | { type: 'ADD_COURSE'; course: Course }
  | { type: 'REPLACE_COURSE'; course: Course }
  | { type: 'ADD_GLOSSARY'; courseId: string; glossary: Glossary }
  | { type: 'UPDATE_TERM'; termId: string; updates: Partial<Term> }
  | { type: 'DELETE_TERM'; termId: string }
  | { type: 'ADD_TERMS'; glossaryId: string; terms: Term[] };

// --- Reducer ---
export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, screen: action.screen };
    case 'SET_ACTIVE_COURSE':
      return { ...state, activeCourseId: action.courseId };
    case 'SET_ACTIVE_GLOSSARY':
      return { ...state, activeGlossaryId: action.glossaryId, activeTermId: null, activeNodeId: null, activeLinkId: null };
    case 'SET_ACTIVE_TERM': {
      if (state.hasUnsavedChanges && action.termId !== state.activeTermId) {
        return { ...state, modal: 'unsaved-changes', pendingNavigation: () => ({ type: 'SET_ACTIVE_TERM', termId: action.termId }) };
      }
      return { ...state, activeTermId: action.termId, activeNodeId: null, activeLinkId: null, hasUnsavedChanges: false };
    }
    case 'SET_ACTIVE_NODE': {
      if (state.hasUnsavedChanges && action.nodeId !== state.activeNodeId) {
        return { ...state, modal: 'unsaved-changes', pendingNavigation: () => ({ type: 'SET_ACTIVE_NODE', nodeId: action.nodeId }) };
      }
      return { ...state, activeNodeId: action.nodeId, activeTermId: null, activeLinkId: null, hasUnsavedChanges: false };
    }
    case 'SET_ACTIVE_LINK':
      return { ...state, activeLinkId: action.linkId, activeNodeId: null, activeTermId: null };
    case 'SET_FTS_INDEXED': {
      // Mirror backend semantics: flag lives on Section (Module) or Lesson directly.
      const courses = state.courses.map(c => ({
        ...c,
        modules: c.modules.map(m => {
          if (action.nodeType === 'module') {
            if (m.id !== action.nodeId) return m;
            return { ...m, isIndexed: action.value };
          }
          // Lesson-level toggle: find the host module.
          return {
            ...m,
            lessons: m.lessons.map(l =>
              l.id === action.nodeId ? { ...l, isIndexed: action.value } : l,
            ),
          };
        }),
      }));
      return { ...state, courses };
    }
    case 'SET_GRAPH_LEVEL':
      return { ...state, graphLevel: action.level, breadcrumbs: action.breadcrumbs };
    case 'DRILL_DOWN': {
      const newItem: BreadcrumbItem = { id: action.nodeId, name: action.nodeName, level: action.level };
      const existingIdx = state.breadcrumbs.findIndex(b => b.id === action.nodeId);
      let newBreadcrumbs: BreadcrumbItem[];
      if (existingIdx >= 0) {
        newBreadcrumbs = state.breadcrumbs.slice(0, existingIdx + 1);
      } else {
        newBreadcrumbs = [...state.breadcrumbs, newItem];
      }
      return { ...state, graphLevel: action.level, breadcrumbs: newBreadcrumbs, activeNodeId: action.nodeId };
    }
    case 'BREADCRUMB_NAV': {
      const target = state.breadcrumbs[action.index];
      if (!target) return state;
      return {
        ...state,
        graphLevel: target.level,
        breadcrumbs: state.breadcrumbs.slice(0, action.index + 1),
        activeNodeId: target.id,
        activeTermId: null,
      };
    }
    case 'OPEN_MODAL':
      return { ...state, modal: action.modal, modalData: action.data || {} };
    case 'CLOSE_MODAL':
      return { ...state, modal: null, modalData: {} };
    case 'TOGGLE_LEFT_PANEL':
      return { ...state, leftPanelOpen: !state.leftPanelOpen };
    case 'TOGGLE_RIGHT_PANEL':
      return { ...state, rightPanelOpen: !state.rightPanelOpen };
    case 'SET_LEFT_TAB':
      return { ...state, leftTab: action.tab };
    case 'SET_RIGHT_TAB':
      return { ...state, rightTab: action.tab };
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.status };
    case 'SET_SEARCH_TERM':
      return { ...state, searchTerm: action.term };
    case 'TOGGLE_TERM_SELECTION': {
      const ids = state.selectedTermIds.includes(action.termId)
        ? state.selectedTermIds.filter(id => id !== action.termId)
        : [...state.selectedTermIds, action.termId];
      return { ...state, selectedTermIds: ids };
    }
    case 'SELECT_ALL_TERMS':
      return { ...state, selectedTermIds: action.termIds };
    case 'DESELECT_ALL_TERMS':
      return { ...state, selectedTermIds: [] };
    case 'SET_HIER_FILTER':
      return { ...state, hierFilterIds: action.ids };
    case 'SET_GRAPH_FILTERS':
      return { ...state, graphFilters: { ...state.graphFilters, ...action.filters } };
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.value };
    case 'SET_PENDING_NAVIGATION':
      return { ...state, pendingNavigation: action.fn };
    case 'SET_SYNC_PROGRESS':
      return { ...state, syncProgress: action.progress, syncStatus: action.status };
    case 'SET_SYNC_REPORT':
      return { ...state, syncReport: action.report };
    case 'SET_COURSES':
      return { ...state, courses: action.courses };
    case 'ADD_COURSE':
      return { ...state, courses: [...state.courses, action.course] };
    case 'REPLACE_COURSE':
      return {
        ...state,
        courses: state.courses.map(c => (c.id === action.course.id ? action.course : c)),
      };
    case 'ADD_GLOSSARY': {
      const updated = state.courses.map(c =>
        c.id === action.courseId
          ? { ...c, glossaries: [...c.glossaries, action.glossary] }
          : c
      );
      return { ...state, courses: updated };
    }
    case 'UPDATE_TERM': {
      const courses = state.courses.map(c => ({
        ...c,
        glossaries: c.glossaries.map(g => ({
          ...g,
          terms: g.terms.map(t => t.id === action.termId ? { ...t, ...action.updates } : t),
        })),
      }));
      return { ...state, courses };
    }
    case 'DELETE_TERM': {
      const courses = state.courses.map(c => ({
        ...c,
        glossaries: c.glossaries.map(g => ({
          ...g,
          terms: g.terms.filter(t => t.id !== action.termId),
        })),
      }));
      return { ...state, courses, activeTermId: null, hasUnsavedChanges: false };
    }
    case 'ADD_TERMS': {
      const courses = state.courses.map(c => ({
        ...c,
        glossaries: c.glossaries.map(g =>
          g.id === action.glossaryId
            ? { ...g, terms: [...g.terms, ...action.terms] }
            : g
        ),
      }));
      return { ...state, courses };
    }
    default:
      return state;
  }
}

// --- Context ---
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    if (!apiEnabled()) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await listCourses();
        const full = await Promise.all(raw.map(async c => {
          const [course, gloss] = await Promise.all([
            getCourse(c.id),
            listGlossaries(c.id),
          ]);
          const fullGlossaries = await Promise.all(gloss.map(g => getGlossary(g.id)));
          return mapCourseFull(course, fullGlossaries);
        }));
        if (!cancelled) dispatch({ type: 'SET_COURSES', courses: full });
      } catch (err) {
        console.error('[AppContext] failed to load courses from API', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// --- API helper hook ---
// When the API is enabled, helpers optimistically dispatch then sync with the
// backend (logging failures). When disabled, they fall back to local-only
// dispatch with generated string IDs.
export function useApi() {
  const { state, dispatch } = useApp();

  const apiCreateCourse = useCallback(async (input: { name: string; url: string }) => {
    if (apiEnabled()) {
      try {
        const created = await apiCreateCourseRaw({ title: input.name, url: input.url });
        const course: Course = {
          id: numericToId('c', created.id),
          name: created.title,
          url: created.url,
          lastImportDate: created.import_date,
          modules: [],
          glossaries: [],
        };
        dispatch({ type: 'ADD_COURSE', course });
        return course;
      } catch (err) {
        console.error('[useApi] createCourse failed', err);
        throw err;
      }
    }
    const course: Course = {
      id: `c-${crypto.randomUUID()}`,
      name: input.name,
      url: input.url,
      lastImportDate: null,
      modules: [],
      glossaries: [],
    };
    dispatch({ type: 'ADD_COURSE', course });
    return course;
  }, [dispatch]);

  const apiCreateGlossary = useCallback(async (courseId: string, name: string) => {
    if (apiEnabled()) {
      try {
        const created = await apiCreateGlossaryRaw(stringIdToNumeric(courseId), { title: name, text_content: '' });
        const glossary: Glossary = {
          id: numericToId('g', created.id),
          name: created.title,
          courseId,
          terms: [],
        };
        dispatch({ type: 'ADD_GLOSSARY', courseId, glossary });
        return glossary;
      } catch (err) {
        console.error('[useApi] createGlossary failed', err);
        throw err;
      }
    }
    const glossary: Glossary = {
      id: `g-${crypto.randomUUID()}`,
      name,
      courseId,
      terms: [],
    };
    dispatch({ type: 'ADD_GLOSSARY', courseId, glossary });
    return glossary;
  }, [dispatch]);

  const findGlossaryId = useCallback((termId: string): string | null => {
    for (const c of state.courses) {
      for (const g of c.glossaries) {
        if (g.terms.some(t => t.id === termId)) return g.id;
      }
    }
    return null;
  }, [state.courses]);

  const apiUpdateTerm = useCallback(async (termId: string, updates: Partial<Term>) => {
    dispatch({ type: 'UPDATE_TERM', termId, updates });
    if (apiEnabled()) {
      const gid = findGlossaryId(termId);
      if (!gid) return;
      try {
        await apiUpdateTermRaw(
          stringIdToNumeric(gid),
          stringIdToNumeric(termId),
          {
            ...(updates.name !== undefined ? { name: updates.name } : {}),
            ...(updates.definition !== undefined ? { definition: updates.definition } : {}),
          },
        );
      } catch (err) {
        console.error('[useApi] updateTerm failed', err);
      }
    }
  }, [dispatch, findGlossaryId]);

  const apiDeleteTerm = useCallback(async (termId: string) => {
    const gid = findGlossaryId(termId);
    dispatch({ type: 'DELETE_TERM', termId });
    if (apiEnabled() && gid) {
      try {
        await apiDeleteTermRaw(stringIdToNumeric(gid), stringIdToNumeric(termId));
      } catch (err) {
        console.error('[useApi] deleteTerm failed', err);
      }
    }
  }, [dispatch, findGlossaryId]);

  const apiBulkAddTerms = useCallback(async (glossaryId: string, names: string[]) => {
    if (apiEnabled()) {
      try {
        const created = await apiBulkCreateTermsRaw(stringIdToNumeric(glossaryId), names);
        const terms: Term[] = created.map(t => ({
          id: numericToId('t', t.id),
          name: t.name,
          definition: t.definition,
          status: 'no-trait',
          moduleId: '',
          lessonId: '',
          occurrences: [],
          connections: [],
        }));
        dispatch({ type: 'ADD_TERMS', glossaryId, terms });
        return terms;
      } catch (err) {
        console.error('[useApi] bulkAddTerms failed', err);
        throw err;
      }
    }
    const terms: Term[] = names.map(name => ({
      id: `t-${crypto.randomUUID()}`,
      name,
      definition: '',
      status: 'no-trait',
      moduleId: '',
      lessonId: '',
      occurrences: [],
      connections: [],
    }));
    dispatch({ type: 'ADD_TERMS', glossaryId, terms });
    return terms;
  }, [dispatch]);

  /** Pull a fresh course tree + glossaries from the backend and reseat it in state. */
  const apiRefetchCourse = useCallback(async (courseId: string) => {
    if (!apiEnabled()) return;
    try {
      const numId = stringIdToNumeric(courseId);
      const full = await getCourse(numId);
      const glossariesRaw = await listGlossaries(numId);
      const glossaries = await Promise.all(
        glossariesRaw.map(g => getGlossary(g.id)),
      );
      const mapped = mapCourseFull(full, glossaries);
      dispatch({ type: 'REPLACE_COURSE', course: mapped });
    } catch (err) {
      console.error('[useApi] refetchCourse failed', err);
    }
  }, [dispatch]);

  /** Trigger a course import; returns a promise that resolves when the backend
   *  reports `done` / `error`. Polls `/import-status` every 1.5 s. */
  const apiImportCourse = useCallback(async (
    courseId: string,
    body: import('@/lib/api').ImportBody,
    onProgress?: (status: import('@/lib/api').ImportStatus) => void,
  ) => {
    if (!apiEnabled()) throw new Error('API mode not enabled');
    const numId = stringIdToNumeric(courseId);
    await apiImportCourseRaw(numId, body);
    // Poll until terminal status. Bail out after ~10 minutes as a safety net
    // so the modal can't hang forever if the backend disappears.
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500));
      const st = await apiGetImportStatus(numId);
      onProgress?.(st);
      if (st.status === 'done' || st.status === 'error') {
        if (st.status === 'done') await apiRefetchCourse(courseId);
        return st;
      }
    }
    throw new Error('Import polling timed out after 10 minutes');
  }, [apiRefetchCourse]);

  const apiDownloadScorm = useCallback(async (
    glossaryId: string, scormId: string, version: '1.2' | '2004',
  ) => {
    if (!apiEnabled()) return null;
    const numId = stringIdToNumeric(glossaryId);
    return apiDownloadScormRaw(numId, scormId, version);
  }, []);

  const apiCollectBindings = useCallback(async (
    glossaryId: string, termIds: string[],
  ) => {
    if (!apiEnabled()) return { terms_processed: 0, bindings_created: 0 };
    const gNumId = stringIdToNumeric(glossaryId);
    const tNumIds = termIds.map(stringIdToNumeric);
    const report = await apiCollectBindingsRaw(gNumId, tNumIds);
    // Refresh the parent course so the new bindings show up in the graph.
    const course = state.courses.find(c => c.glossaries.some(g => g.id === glossaryId));
    if (course) await apiRefetchCourse(course.id);
    return report;
  }, [state.courses, apiRefetchCourse]);

  const apiSetFtsIndexed = useCallback(async (
    nodeType: 'module' | 'lesson', nodeId: string, value: boolean,
  ) => {
    // Optimistic local update first — UI snaps immediately.
    dispatch({ type: 'SET_FTS_INDEXED', nodeType, nodeId, value });
    if (!apiEnabled()) return;
    // We need the parent course's numeric id for the PATCH path.
    const course = state.courses.find(c =>
      c.modules.some(m =>
        (nodeType === 'module' && m.id === nodeId) ||
        (nodeType === 'lesson' && m.lessons.some(l => l.id === nodeId)),
      ),
    );
    if (!course) return;
    const cNum = stringIdToNumeric(course.id);
    try {
      if (nodeType === 'module') {
        await apiPatchSection(cNum, stringIdToNumeric(nodeId), { is_indexed: value });
      } else {
        await apiPatchLesson(cNum, stringIdToNumeric(nodeId), { is_indexed: value });
      }
    } catch (err) {
      console.error('[useApi] setFtsIndexed failed', err);
      // Rollback on failure.
      dispatch({ type: 'SET_FTS_INDEXED', nodeType, nodeId, value: !value });
    }
  }, [dispatch, state.courses]);

  return {
    apiCreateCourse, apiCreateGlossary,
    apiUpdateTerm, apiDeleteTerm, apiBulkAddTerms,
    apiImportCourse, apiDownloadScorm, apiCollectBindings, apiRefetchCourse,
    apiSetFtsIndexed,
  };
}
