import re
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response, status
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.generator_schema import GeneratorOutput
from app.schemas.review_schema import WorkflowReviewOutput
from app.schemas.router_schema import RouterOutput
from app.schemas.specialist_schema import SpecialistOutput
from app.schemas.workflow_schema import (
    WorkflowDecisionRequest,
    WorkflowDecisionResponse,
    WorkflowDetail,
    WorkflowSummary,
)
from app.services.persistence_service import (
    build_persisted_generation,
    build_persisted_review,
    get_export_or_404,
    get_workflow_or_404,
    list_workflows,
    persist_export_record,
    update_workflow_status,
    workflow_to_detail,
    workflow_to_summary,
)
from app.services.export_service import build_export_bytes, export_media_type
from app.workflows.brd_graph import build_review_output
from app.workflows.brd_graph import run_graph_for_file, run_graph_for_text

router = APIRouter(prefix="/api/v1/analyze", tags=["analysis"])

class TextAnalysisRequest(BaseModel):
    raw_text: str = Field(..., description="The raw BRD text content to analyze")


def _safe_export_basename(name: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return normalized or "user_stories"


def _build_export_response(
    output: GeneratorOutput,
    output_format: Literal["xlsx", "docx", "pdf"],
    base_name: str,
    payload: bytes | None = None,
    workflow_id: str | None = None,
):
    payload = payload or build_export_bytes(output, output_format)
    file_name = f"{_safe_export_basename(base_name)}.{output_format}"
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
    if workflow_id:
        headers["X-Workflow-Id"] = workflow_id
    return StreamingResponse(iter([payload]), media_type=export_media_type(output_format), headers=headers)

@router.post("/route/text", response_model=RouterOutput)
async def analyze_text(request: TextAnalysisRequest):
    """
    Analyze raw BRD text directly from a JSON payload.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="route")
        return result["router_output"]
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during routing analysis: {str(e)}"
        )

@router.post("/route/file", response_model=RouterOutput)
async def analyze_file(file: UploadFile = File(...)):
    """
    Upload a BRD file (.txt, .md, .pdf, or .docx) to parse and analyze it.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="route")
        return result["router_output"]
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while parsing or analyzing the file: {str(e)}"
        )


@router.post("/specialist/text", response_model=SpecialistOutput)
async def analyze_specialist_text(request: TextAnalysisRequest):
    """
    Analyze raw BRD text through the router and specialist stages.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="specialist")
        return result["specialist_output"]
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during specialist analysis: {str(e)}"
        )


@router.post("/specialist/file", response_model=SpecialistOutput)
async def analyze_specialist_file(file: UploadFile = File(...)):
    """
    Upload a BRD file to parse it, classify it, and convert it into structured requirements.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="specialist")
        return result["specialist_output"]
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while parsing or running specialist analysis: {str(e)}"
        )


@router.post("/generate/text", response_model=GeneratorOutput)
async def generate_user_story_text(request: TextAnalysisRequest, response: Response, db: Session = Depends(get_db)):
    """
    Analyze raw BRD text through router, specialist, and generator stages.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="generate")
        workflow = build_persisted_generation(
            db,
            raw_text=request.raw_text,
            state=result,
            source_type="text",
        )
        response.headers["X-Workflow-Id"] = workflow.id
        return result["generator_output"]
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during user story generation: {str(e)}"
        )


@router.post("/generate/file", response_model=GeneratorOutput)
async def generate_user_story_file(
    file: UploadFile = File(...),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """
    Upload a BRD file to parse it, classify it, structure it, and generate a user story.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="generate")
        workflow = build_persisted_generation(
            db,
            raw_text=result["raw_text"],
            state=result,
            original_filename=file.filename,
            media_type=file.content_type,
            file_bytes=content,
            source_type="upload",
        )
        if response is not None:
            response.headers["X-Workflow-Id"] = workflow.id
        return result["generator_output"]
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while generating the user story: {str(e)}"
        )


@router.post("/generate/text/export")
async def export_user_story_text(
    request: TextAnalysisRequest,
    output_format: Literal["xlsx", "docx", "pdf"] = "xlsx",
    db: Session = Depends(get_db),
):
    """
    Generate user stories from raw BRD text and return them as a downloadable file.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="generate")
        workflow = build_persisted_generation(
            db,
            raw_text=request.raw_text,
            state=result,
            source_type="text",
        )
        payload = build_export_bytes(result["generator_output"], output_format)
        file_name = f"generated_user_stories.{output_format}"
        persist_export_record(
            db,
            workflow,
            output_format=output_format,
            file_name=file_name,
            content=payload,
        )
        return _build_export_response(
            result["generator_output"],
            output_format,
            "generated_user_stories",
            payload=payload,
            workflow_id=workflow.id,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while exporting the generated user stories: {str(e)}"
        )


@router.post("/generate/file/export")
async def export_user_story_file(
    file: UploadFile = File(...),
    output_format: Literal["xlsx", "docx", "pdf"] = "xlsx",
    db: Session = Depends(get_db),
):
    """
    Generate user stories from an uploaded BRD file and return them as a downloadable file.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="generate")
        base_name = Path(file.filename or "generated_user_stories").stem
        workflow = build_persisted_generation(
            db,
            raw_text=result["raw_text"],
            state=result,
            original_filename=file.filename,
            media_type=file.content_type,
            file_bytes=content,
            source_type="upload",
        )
        payload = build_export_bytes(result["generator_output"], output_format)
        file_name = f"{base_name}.{output_format}"
        persist_export_record(
            db,
            workflow,
            output_format=output_format,
            file_name=file_name,
            content=payload,
        )
        return _build_export_response(
            result["generator_output"],
            output_format,
            base_name,
            payload=payload,
            workflow_id=workflow.id,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while exporting the generated user stories: {str(e)}"
        )


@router.post("/review/text", response_model=WorkflowReviewOutput)
async def review_user_story_text(request: TextAnalysisRequest, response: Response, db: Session = Depends(get_db)):
    """
    Run the full pipeline through critic review with capped refinements.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="review")
        review_output, workflow = build_persisted_review(
            db,
            raw_text=request.raw_text,
            state=result,
            source_type="text",
        )
        response.headers["X-Workflow-Id"] = workflow.id
        return review_output
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during critic review: {str(e)}"
        )


@router.post("/review/file", response_model=WorkflowReviewOutput)
async def review_user_story_file(
    file: UploadFile = File(...),
    response: Response = None,
    db: Session = Depends(get_db),
):
    """
    Upload a BRD file and run the full pipeline through critic review with capped refinements.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="review")
        review_output, workflow = build_persisted_review(
            db,
            raw_text=result["raw_text"],
            state=result,
            original_filename=file.filename,
            media_type=file.content_type,
            file_bytes=content,
            source_type="upload",
        )
        if response is not None:
            response.headers["X-Workflow-Id"] = workflow.id
        return review_output
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during file-based critic review: {str(e)}"
        )


@router.get("/workflows", response_model=list[WorkflowSummary])
async def get_workflows(limit: int = 50, db: Session = Depends(get_db)):
    workflows = list_workflows(db, limit=limit)
    return [workflow_to_summary(workflow) for workflow in workflows]


@router.get("/workflows/{workflow_id}", response_model=WorkflowDetail)
async def get_workflow(workflow_id: str, db: Session = Depends(get_db)):
    workflow = get_workflow_or_404(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")
    return workflow_to_detail(workflow)


@router.post("/workflows/{workflow_id}/approve", response_model=WorkflowDecisionResponse)
async def approve_workflow(
    workflow_id: str,
    request: WorkflowDecisionRequest,
    db: Session = Depends(get_db),
):
    workflow = get_workflow_or_404(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    updated = update_workflow_status(db, workflow, "ba_approved", request.comments)
    return WorkflowDecisionResponse(workflow_id=updated.id, status=updated.status, comments=request.comments)


@router.post("/workflows/{workflow_id}/manual-review", response_model=WorkflowDecisionResponse)
async def mark_manual_review(
    workflow_id: str,
    request: WorkflowDecisionRequest,
    db: Session = Depends(get_db),
):
    workflow = get_workflow_or_404(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    updated = update_workflow_status(db, workflow, "needs_manual_review", request.comments)
    return WorkflowDecisionResponse(workflow_id=updated.id, status=updated.status, comments=request.comments)


@router.get("/workflows/{workflow_id}/exports/{export_id}")
async def download_saved_export(workflow_id: str, export_id: str, db: Session = Depends(get_db)):
    export = get_export_or_404(db, workflow_id, export_id)
    if export is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export not found.")

    export_path = Path(export.storage_path)
    if not export_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file missing from storage.")

    return FileResponse(
        path=export_path,
        media_type=export_media_type(export.export_format),  # type: ignore[arg-type]
        filename=export_path.name,
    )
