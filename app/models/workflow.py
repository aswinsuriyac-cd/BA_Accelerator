import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_type: Mapped[str] = mapped_column(String(20), default="upload")
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    parsed_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    workflows: Mapped[list["Workflow"]] = relationship(back_populates="document")


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="draft")
    target_stage: Mapped[str] = mapped_column(String(40), default="generate")
    refine_attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_refine_attempts: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    document: Mapped[Document | None] = relationship(back_populates="workflows")
    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    reviews: Mapped[list["ReviewAttempt"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")
    exports: Mapped[list["ExportedFile"]] = relationship(back_populates="workflow", cascade="all, delete-orphan")


class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"))
    artifact_type: Mapped[str] = mapped_column(String(40))
    content_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    workflow: Mapped[Workflow] = relationship(back_populates="artifacts")


class ReviewAttempt(Base):
    __tablename__ = "review_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"))
    attempt_number: Mapped[int] = mapped_column(Integer)
    verdict: Mapped[str] = mapped_column(String(20))
    summary: Mapped[str] = mapped_column(Text)
    issues_json: Mapped[str] = mapped_column(Text)
    revision_instructions_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    workflow: Mapped[Workflow] = relationship(back_populates="reviews")


class ExportedFile(Base):
    __tablename__ = "exported_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"))
    export_format: Mapped[str] = mapped_column(String(20))
    storage_path: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    workflow: Mapped[Workflow] = relationship(back_populates="exports")
