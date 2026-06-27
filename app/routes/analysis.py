from fastapi import APIRouter, UploadFile, File, HTTPException, status
from pydantic import BaseModel, Field
from app.parser.brd_parser import parse_document
from app.agents.router import RouterAgent
from app.schemas.router_schema import RouterOutput

router = APIRouter(prefix="/api/v1/analyze", tags=["analysis"])

class TextAnalysisRequest(BaseModel):
    raw_text: str = Field(..., description="The raw BRD text content to analyze")

@router.post("/route/text", response_model=RouterOutput)
async def analyze_text(request: TextAnalysisRequest):
    """
    Analyze raw BRD text directly from a JSON payload.
    """
    try:
        agent = RouterAgent()
        result = agent.route(request.raw_text)
        return result
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
        raw_text = parse_document(file.filename, content)
        
        agent = RouterAgent()
        result = agent.route(raw_text)
        return result
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
