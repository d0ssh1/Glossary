// ============================================================
// API CLIENT — thin typed fetch wrapper for the Lexicon Weaver backend
// ============================================================
import type {
  ApiCourse, ApiCourseFull, ApiGlossary, ApiGlossaryFull, ApiTerm,
  ApiBinding, ApiOccurrence, CollectReport,
} from './apiTypes';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function apiBaseUrl(): string {
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL;
  return fromEnv || 'http://localhost:8000';
}

export function apiEnabled(): boolean {
  const flag = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_USE_API;
  return flag === '1';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-json */ }
    throw new ApiError(res.status, `HTTP ${res.status} for ${path}`, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status} for ${path}`, null);
  return res.blob();
}

// --- Courses ---
export const listCourses = () => request<ApiCourse[]>('/courses/');
export const getCourse = (id: number) => request<ApiCourseFull>(`/courses/${id}`);
export const createCourse = (body: { title: string; url: string }) =>
  request<ApiCourse>('/courses/', { method: 'POST', body: JSON.stringify(body) });
export const updateCourse = (id: number, body: Partial<{ title: string; url: string }>) =>
  request<ApiCourse>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteCourse = (id: number) =>
  request<void>(`/courses/${id}`, { method: 'DELETE' });
export type ImportBody =
  | { source: 'mock'; filename?: string }
  | { source: 'json'; filename: string }
  | { source: 'stepik'; stepik_course_id: number; client_id?: string; client_secret?: string };
export const importCourse = (id: number, body: ImportBody) =>
  request<{ course_id: number; status: string; message: string }>(
    `/courses/${id}/import`,
    { method: 'POST', body: JSON.stringify(body) },
  );
export interface ImportStatus {
  status: 'idle' | 'running' | 'done' | 'error';
  error: string | null;
  sections_count: number;
  lessons_count: number;
  steps_count: number;
  steps_total?: number;
  steps_done?: number;
}
export const getImportStatus = (id: number) =>
  request<ImportStatus>(`/courses/${id}/import-status`);
export const patchSection = (cid: number, sid: number, body: { is_indexed: boolean }) =>
  request(`/courses/${cid}/sections/${sid}`, { method: 'PATCH', body: JSON.stringify(body) });
export const patchLesson = (cid: number, lid: number, body: { is_indexed: boolean }) =>
  request(`/courses/${cid}/lessons/${lid}`, { method: 'PATCH', body: JSON.stringify(body) });
export const searchCourse = (id: number, q: string, limit = 20) =>
  request<ApiOccurrence[]>(`/courses/${id}/search?q=${encodeURIComponent(q)}&limit=${limit}`);

// --- Glossaries ---
export const listGlossaries = (courseId: number) =>
  request<ApiGlossary[]>(`/glossaries/?course_id=${courseId}`);
export const createGlossary = (courseId: number, body: { title: string; text_content: string }) =>
  request<ApiGlossary>(`/glossaries/?course_id=${courseId}`, { method: 'POST', body: JSON.stringify(body) });
export const getGlossary = (id: number) => request<ApiGlossaryFull>(`/glossaries/${id}`);
export const updateGlossary = (id: number, body: Partial<{ title: string; text_content: string }>) =>
  request<ApiGlossary>(`/glossaries/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteGlossary = (id: number) =>
  request<void>(`/glossaries/${id}`, { method: 'DELETE' });
export const collectBindings = (glossaryId: number, termIds: number[]) =>
  request<CollectReport>(`/glossaries/${glossaryId}/collect`, {
    method: 'POST', body: JSON.stringify({ term_ids: termIds }),
  });

// --- Terms ---
export const listTerms = (gid: number) =>
  request<ApiTerm[]>(`/glossaries/${gid}/terms/`);
export const createTerm = (gid: number, body: { name: string; definition: string }) =>
  request<ApiTerm>(`/glossaries/${gid}/terms/`, { method: 'POST', body: JSON.stringify(body) });
export const bulkCreateTerms = (gid: number, names: string[]) =>
  request<ApiTerm[]>(`/glossaries/${gid}/terms/bulk`, { method: 'POST', body: JSON.stringify({ names }) });
export const updateTerm = (gid: number, tid: number, body: Partial<{ name: string; definition: string }>) =>
  request<ApiTerm>(`/glossaries/${gid}/terms/${tid}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteTerm = (gid: number, tid: number) =>
  request<void>(`/glossaries/${gid}/terms/${tid}`, { method: 'DELETE' });
export const getOccurrences = (gid: number, tid: number) =>
  request<ApiOccurrence[]>(`/glossaries/${gid}/terms/${tid}/occurrences`);

// --- Bindings ---
export const createBinding = (body: {
  term_id: number; step_id: number; is_primary: boolean; is_created_by_user: boolean;
}) => request<ApiBinding>('/bindings/', { method: 'POST', body: JSON.stringify(body) });
export const deleteBinding = (id: number) =>
  request<void>(`/bindings/${id}`, { method: 'DELETE' });
export const updateBinding = (id: number, body: Partial<{ is_primary: boolean; is_created_by_user: boolean }>) =>
  request<ApiBinding>(`/bindings/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

// --- SCORM ---
export const downloadScorm = (glossaryId: number, scormId: string, version: string) =>
  requestBlob(`/glossaries/${glossaryId}/scorm`, {
    method: 'POST', body: JSON.stringify({ scorm_id: scormId, version }),
  });
