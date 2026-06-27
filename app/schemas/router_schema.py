from typing import List

from pydantic import BaseModel, Field

class RouterOutput(BaseModel):
    brd_type: str = Field(
        ...,
        description="The classified type of the BRD. e.g., 'feature_request', 'bug_fix', 'refactor', 'integration', 'migration', or 'other'."
    )
    confidence: float = Field(
        ...,
        description="Confidence score for this classification, between 0.0 and 1.0."
    )
    extracted_intent: str = Field(
        ...,
        description="A concise summary of the primary intent and purpose of the requirement document."
    )
    ambiguities: List[str] = Field(
        default_factory=list,
        description="List of vague statements, conflicting details, or missing information in the raw BRD."
    )
    suggested_specialist: str = Field(
        ...,
        description="The downstream specialist agent that should handle this BRD next. Usually aligned to the classified BRD type."
    )
