// ============================================================
// API TYPES — raw backend response shapes
// ============================================================

export interface ApiCourse {
  id: number;
  title: string;
  url: string;
  is_parsed: boolean;
  import_date: string | null;
}

export interface ApiStep {
  id: number;
  lesson_id: number;
  position: number;
  step_url: string;
  name: string;
}

export interface ApiLesson {
  id: number;
  section_id: number;
  title: string;
  position: number;
  is_indexed: boolean;
  steps: ApiStep[];
}

export interface ApiSection {
  id: number;
  course_id: number;
  title: string;
  position: number;
  is_indexed: boolean;
  lessons: ApiLesson[];
}

export interface ApiCourseFull extends ApiCourse {
  sections: ApiSection[];
}

export interface ApiBinding {
  id: number;
  term_id: number;
  step_id: number;
  is_primary: boolean;
  is_created_by_user: boolean;
}

export interface ApiTerm {
  id: number;
  glossary_id: number;
  name: string;
  definition: string;
  bindings: ApiBinding[];
  /** Only present in the SCORM export payload, which bakes occurrences in so
   *  the offline player can show contexts without a backend round-trip. */
  occurrences?: ApiOccurrence[];
}

export interface ApiGlossary {
  id: number;
  course_id: number;
  title: string;
  text_content: string;
}

export interface ApiGlossaryFull extends ApiGlossary {
  terms: ApiTerm[];
}

export interface ApiOccurrence {
  step_id: number;
  step_name: string;
  step_url: string;
  lesson_id: number;
  lesson_name: string;
  section_id: number;
  section_name: string;
  snippet: string;
}

export interface ImportReport {
  course_id: number;
  sections_created: number;
  lessons_created: number;
  steps_created: number;
  steps_indexed: number;
}

export interface CollectReport {
  terms_processed: number;
  bindings_created: number;
}
