"""SQLAlchemy ORM models.

Mirrors the schema described in info.md:
    Course -> Section -> Lesson -> Step
    Course -> Glossary -> Term
    Term <-> Step via TermStepBinding (many-to-many)

The ``course_search_fts`` virtual table is managed via raw SQL — see database.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, Integer, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    __tablename__ = "course"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(500), default="")
    stepik_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, unique=True)
    is_parsed: Mapped[bool] = mapped_column(Boolean, default=False)
    import_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    import_status: Mapped[str] = mapped_column(String(20), default="idle")
    import_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    import_steps_total: Mapped[int] = mapped_column(Integer, default=0)
    import_steps_done: Mapped[int] = mapped_column(Integer, default=0)

    sections: Mapped[list["Section"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="Section.position",
    )
    glossaries: Mapped[list["Glossary"]] = relationship(
        back_populates="course", cascade="all, delete-orphan",
    )


class Section(Base):
    __tablename__ = "section"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("course.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(500))
    stepik_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=True)

    course: Mapped[Course] = relationship(back_populates="sections")
    lessons: Mapped[list["Lesson"]] = relationship(
        back_populates="section", cascade="all, delete-orphan", order_by="Lesson.position",
    )


class Lesson(Base):
    __tablename__ = "lesson"

    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("section.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(500))
    stepik_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=True)

    section: Mapped[Section] = relationship(back_populates="lessons")
    steps: Mapped[list["Step"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan", order_by="Step.position",
    )


class Step(Base):
    __tablename__ = "step"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lesson.id", ondelete="CASCADE"))
    stepik_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    step_url: Mapped[str] = mapped_column(String(500), default="")
    content_text: Mapped[str] = mapped_column(Text, default="")
    raw_html: Mapped[str] = mapped_column(Text, default="")

    lesson: Mapped[Lesson] = relationship(back_populates="steps")
    bindings: Mapped[list["TermStepBinding"]] = relationship(
        back_populates="step", cascade="all, delete-orphan",
    )


class Glossary(Base):
    __tablename__ = "glossary"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("course.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(500))
    text_content: Mapped[str] = mapped_column(Text, default="")

    course: Mapped[Course] = relationship(back_populates="glossaries")
    terms: Mapped[list["Term"]] = relationship(
        back_populates="glossary", cascade="all, delete-orphan",
    )


class Term(Base):
    __tablename__ = "term"

    id: Mapped[int] = mapped_column(primary_key=True)
    glossary_id: Mapped[int] = mapped_column(ForeignKey("glossary.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(500))
    definition: Mapped[str] = mapped_column(Text, default="")

    glossary: Mapped[Glossary] = relationship(back_populates="terms")
    bindings: Mapped[list["TermStepBinding"]] = relationship(
        back_populates="term", cascade="all, delete-orphan",
    )


class TermStepBinding(Base):
    __tablename__ = "term_step_binding"
    __table_args__ = (
        UniqueConstraint("term_id", "step_id", name="uq_term_step"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    term_id: Mapped[int] = mapped_column(ForeignKey("term.id", ondelete="CASCADE"))
    step_id: Mapped[int] = mapped_column(ForeignKey("step.id", ondelete="CASCADE"))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_created_by_user: Mapped[bool] = mapped_column(Boolean, default=True)

    term: Mapped[Term] = relationship(back_populates="bindings")
    step: Mapped[Step] = relationship(back_populates="bindings")
