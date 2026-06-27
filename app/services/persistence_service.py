import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.workflow import Artifact, Document, ExportedFile, ReviewAttempt, Workflow
from app.schemas.review_schema import WorkflowReviewOutput
from app.services.storage_service import save_export, save_upload
from app.workflows.brd_graph import WorkflowState, build_review_output


def create_document_record(
    db: Session,
    *,
    source_type: str,
    original_filename: str | None,
    media_type: str | None,
    file_bytes: bytes | None,
    parsed_text: str,
) -> Document:
    storage_path = save_upload(original_filename or "input.txt", file_bytes) if file_bytes is not None else None
    document = Document(
        source_type=source_type,
        original_filename=original_filename,
        media_type=media_type,
        storage_path=storage_path,
        parsed_text=parsed_text,
    )
    db.add(document)
    db.flush()
    return document


def create_workflow_record(
    db: Session,
    *,
    document: Document | None,
    target_stage: str,
    refine_attempts: int = 0,
    max_refine_attempts: int = 3,
    status: str = "draft",
) -> Workflow:
    workflow = Workflow(
        document=document,
        target_stage=target_stage,
        refine_attempts=refine_attempts,
        max_refine_attempts=max_refine_attempts,
        status=status,
    )
    db.add(workflow)
    db.flush()
    return workflow


def persist_workflow_state(db: Session, workflow: Workflow, state: WorkflowState) -> Workflow:
    artifact_payloads: list[tuple[str, str]] = []

    if state.get("router_output") is not None:
        artifact_payloads.append(("router_output", state["router_output"].model_dump_json(indent=2)))
    if state.get("specialist_output") is not None:
        artifact_payloads.append(("specialist_output", state["specialist_output"].model_dump_json(indent=2)))
    if state.get("generator_output") is not None:
        artifact_payloads.append(("generator_output", state["generator_output"].model_dump_json(indent=2)))
    if state.get("critic_output") is not None:
        artifact_payloads.append(("critic_output", state["critic_output"].model_dump_json(indent=2)))

    for artifact_type, content_json in artifact_payloads:
        db.add(Artifact(workflow=workflow, artifact_type=artifact_type, content_json=content_json))

    for index, review in enumerate(state.get("critic_history", []), start=1):
        db.add(
            ReviewAttempt(
                workflow=workflow,
                attempt_number=index,
                verdict=review.verdict,
                summary=review.summary,
                issues_json=json.dumps(review.issues),
                revision_instructions_json=json.dumps(review.revision_instructions),
            )
        )

    workflow.refine_attempts = state.get("refine_attempts", workflow.refine_attempts)
    workflow.max_refine_attempts = state.get("max_refine_attempts", workflow.max_refine_attempts)
    workflow.status = state.get("review_status") or state.get("target_stage") or workflow.status
    db.commit()
    db.refresh(workflow)
    return workflow


def persist_export_record(
    db: Session,
    workflow: Workflow,
    *,
    output_format: str,
    file_name: str,
    content: bytes,
) -> ExportedFile:
    export_path = save_export(workflow.id, file_name, content)
    exported = ExportedFile(
        workflow=workflow,
        export_format=output_format,
        storage_path=export_path,
    )
    db.add(exported)
    db.commit()
    db.refresh(exported)
    return exported


def build_persisted_review(
    db: Session,
    *,
    raw_text: str,
    state: WorkflowState,
    original_filename: str | None = None,
    media_type: str | None = None,
    file_bytes: bytes | None = None,
    source_type: str = "text",
) -> tuple[WorkflowReviewOutput, Workflow]:
    document = create_document_record(
        db,
        source_type=source_type,
        original_filename=original_filename,
        media_type=media_type,
        file_bytes=file_bytes,
        parsed_text=raw_text,
    )
    review_output = build_review_output(state)
    workflow = create_workflow_record(
        db,
        document=document,
        target_stage=state["target_stage"],
        refine_attempts=review_output.refine_attempts,
        max_refine_attempts=review_output.max_refine_attempts,
        status=review_output.review_status,
    )
    workflow = persist_workflow_state(db, workflow, state)
    return review_output, workflow


def build_persisted_generation(
    db: Session,
    *,
    raw_text: str,
    state: WorkflowState,
    original_filename: str | None = None,
    media_type: str | None = None,
    file_bytes: bytes | None = None,
    source_type: str = "text",
) -> Workflow:
    document = create_document_record(
        db,
        source_type=source_type,
        original_filename=original_filename,
        media_type=media_type,
        file_bytes=file_bytes,
        parsed_text=raw_text,
    )
    workflow = create_workflow_record(
        db,
        document=document,
        target_stage=state["target_stage"],
        refine_attempts=state.get("refine_attempts", 0),
        max_refine_attempts=state.get("max_refine_attempts", 3),
        status=state.get("review_status") or "generated",
    )
    return persist_workflow_state(db, workflow, state)
