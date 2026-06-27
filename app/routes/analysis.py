import re
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel, Field
from fastapi.responses import StreamingResponse

from app.schemas.generator_schema import GeneratorOutput
from app.schemas.review_schema import WorkflowReviewOutput
from app.schemas.router_schema import RouterOutput
from app.schemas.specialist_schema import SpecialistOutput
from app.services.export_service import build_export_bytes, export_media_type
from app.workflows.brd_graph import build_review_output
from app.workflows.brd_graph import run_graph_for_file, run_graph_for_text

router = APIRouter(prefix="/api/v1/analyze", tags=["analysis"])

class TextAnalysisRequest(BaseModel):
    raw_text: str = Field(..., description="The raw BRD text content to analyze")


def _safe_export_basename(name: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return normalized or "user_stories"


def _build_export_response(output: GeneratorOutput, output_format: Literal["xlsx", "docx", "pdf"], base_name: str):
    payload = build_export_bytes(output, output_format)
    file_name = f"{_safe_export_basename(base_name)}.{output_format}"
    headers = {"Content-Disposition": f'attachment; filename="{file_name}"'}
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
async def generate_user_story_text(request: TextAnalysisRequest):
    """
    Analyze raw BRD text through router, specialist, and generator stages.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="generate")
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
async def generate_user_story_file(file: UploadFile = File(...)):
    """
    Upload a BRD file to parse it, classify it, structure it, and generate a user story.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="generate")
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
):
    """
    Generate user stories from raw BRD text and return them as a downloadable file.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="generate")
        return _build_export_response(result["generator_output"], output_format, "generated_user_stories")
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
):
    """
    Generate user stories from an uploaded BRD file and return them as a downloadable file.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="generate")
        base_name = Path(file.filename or "generated_user_stories").stem
        return _build_export_response(result["generator_output"], output_format, base_name)
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
async def review_user_story_text(request: TextAnalysisRequest):
    """
    Run the full pipeline through critic review with capped refinements.
    """
    try:
        result = run_graph_for_text(request.raw_text, target_stage="review")
        return build_review_output(result)
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
async def review_user_story_file(file: UploadFile = File(...)):
    """
    Upload a BRD file and run the full pipeline through critic review with capped refinements.
    """
    try:
        content = await file.read()
        result = run_graph_for_file(file.filename, content, target_stage="review")
        return build_review_output(result)
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
