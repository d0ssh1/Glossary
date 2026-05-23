"""Pydantic v2 schemas — request/response models for the REST API."""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Course
# --------------------------------------------------------------------------- #
class CourseBase(BaseModel):
    title: str
    url: str = ""


class CourseCreate(CourseBase):
    pass


class CourseRead(CourseBase):
    id: int
    is_parsed: bool
    import_date: Optional[datetime]
    import_status: str = "idle"
    import_error: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Section / Lesson / Step
# --------------------------------------------------------------------------- #
class StepRead(BaseModel):
    id: int
    lesson_id: int
    position: int
    step_url: str
    name: str = Field(default="")  # convenience field, populated by router

    model_config = ConfigDict(from_attributes=True)


class LessonRead(BaseModel):
    id: int
    section_id: int
    title: str
    position: int
    is_indexed: bool
    steps: list[StepRead] = []

    model_config = ConfigDict(from_attributes=True)


class SectionRead(BaseModel):
    id: int
    course_id: int
    title: str
    position: int
    is_indexed: bool
    lessons: list[LessonRead] = []

    model_config = ConfigDict(from_attributes=True)


class CourseFullRead(CourseRead):
    sections: list[SectionRead] = []


# --------------------------------------------------------------------------- #
# Glossary / Term
# --------------------------------------------------------------------------- #
class TermBase(BaseModel):
    name: str
    definition: str = ""


class TermCreate(TermBase):
    pass


class TermBulkCreate(BaseModel):
    names: list[str]


class TermUpdate(BaseModel):
    name: Optional[str] = None
    definition: Optional[str] = None


class BindingRead(BaseModel):
    id: int
    term_id: int
    step_id: int
    is_primary: bool
    is_created_by_user: bool

    model_config = ConfigDict(from_attributes=True)


class TermRead(TermBase):
    id: int
    glossary_id: int
    bindings: list[BindingRead] = []

    model_config = ConfigDict(from_attributes=True)


class GlossaryBase(BaseModel):
    title: str
    text_content: str = ""


class GlossaryCreate(GlossaryBase):
    pass


class GlossaryUpdate(BaseModel):
    title: Optional[str] = None
    text_content: Optional[str] = None


class GlossaryRead(GlossaryBase):
    id: int
    course_id: int

    model_config = ConfigDict(from_attributes=True)


class GlossaryFullRead(GlossaryRead):
    terms: list[TermRead] = []


# --------------------------------------------------------------------------- #
# Bindings & occurrences
# --------------------------------------------------------------------------- #
class BindingCreate(BaseModel):
    term_id: int
    step_id: int
    is_primary: bool = False
    is_created_by_user: bool = True


class BindingUpdate(BaseModel):
    is_primary: Optional[bool] = None
    is_created_by_user: Optional[bool] = None


class OccurrenceRead(BaseModel):
    step_id: int
    step_name: str
    step_url: str
    lesson_id: int
    lesson_name: str
    section_id: int
    section_name: str
    snippet: str


# --------------------------------------------------------------------------- #
# Import / SCORM
# --------------------------------------------------------------------------- #
class ImportRequest(BaseModel):
    source: Literal["mock", "json", "stepik"] = "mock"
    # For "mock"/"json": path inside `mock_data_dir`. For "stepik": ignored.
    filename: Optional[str] = None
    # For "stepik": ID of the course on stepik.org.
    stepik_course_id: Optional[int] = None


class ImportReport(BaseModel):
    course_id: int
    course_title: str
    sections_count: int
    lessons_count: int
    steps_count: int


class ImportAccepted(BaseModel):
    course_id: int
    status: str
    message: str


class ImportStatus(BaseModel):
    status: str
    error: Optional[str] = None
    sections_count: int = 0
    lessons_count: int = 0
    steps_count: int = 0


class CollectRequest(BaseModel):
    """Body for POST /glossaries/{id}/collect."""
    term_ids: list[int] = Field(default_factory=list, description="Empty = all glossary terms.")


class CollectReport(BaseModel):
    terms_processed: int
    bindings_created: int
