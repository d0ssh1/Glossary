// ============================================================
// SCORM PLAYER MODE
// ============================================================
// The exported SCORM package ships the *same* built app. The backend injects a
// classic <script> before the app bundle that sets `window.__LW_GLOSSARY__`
// (and `window.__LW_SCORM__`). When present, the app boots straight into the
// read-only editor for that glossary — no dashboard, no editing — instead of
// hitting the API.
import type { ApiCourseFull, ApiGlossaryFull } from './apiTypes';

export interface ScormPayload {
  course: ApiCourseFull;
  glossaries: ApiGlossaryFull[];
  /** Numeric id of the glossary to open. */
  activeGlossaryId: number;
}

export function getScormPayload(): ScormPayload | null {
  const w = window as unknown as { __LW_GLOSSARY__?: ScormPayload };
  return w.__LW_GLOSSARY__ ?? null;
}

export function isScormMode(): boolean {
  return getScormPayload() !== null;
}
