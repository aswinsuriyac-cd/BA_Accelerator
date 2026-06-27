from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class DocumentRecord(BaseModel):
    id: str
    source_type: str
    original_filename: str | None = None
    media_type: str | None = None
    storage_path: str | None = None
    parsed_text: str
    created_at: datetime


class ArtifactRecord(BaseModel):
    id: str
    artifact_type: str
    content_json: str
    created_at: datetime


class ReviewAttemptRecord(BaseModel):
    id: str
    attempt_number: int
    verdict: str
    summary: str
    issues: List[str] = Field(default_factory=list)
    revision_instructions: List[str] = Field(default_factory=list)
    created_at: datetime


class ExportRecord(BaseModel):
    id: str
    export_format: str
    storage_path: str
    created_at: datetime


class WorkflowSummary(BaseModel):
    id: str
    status: str
    target_stage: str
    refine_attempts: int
    max_refine_attempts: int
    document_id: str | None = None
    created_at: datetime
    updated_at: datetime


class WorkflowDetail(WorkflowSummary):
    document: DocumentRecord | None = None
    artifacts: List[ArtifactRecord] = Field(default_factory=list)
    reviews: List[ReviewAttemptRecord] = Field(default_factory=list)
    exports: List[ExportRecord] = Field(default_factory=list)


class WorkflowDecisionRequest(BaseModel):
    comments: str | None = Field(default=None, description="Optional BA note for the decision.")


class WorkflowDecisionResponse(BaseModel):
    workflow_id: str
    status: str
    comments: str | None = None
