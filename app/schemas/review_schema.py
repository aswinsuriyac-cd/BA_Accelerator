from typing import List, Literal

from pydantic import BaseModel, Field

from app.schemas.generator_schema import GeneratorOutput


class CriticOutput(BaseModel):
    verdict: Literal["pass", "fail"] = Field(
        ...,
        description="Whether the generated story package is acceptable for BA review."
    )
    summary: str = Field(
        ...,
        description="Short assessment of the generated story package."
    )
    issues: List[str] = Field(
        default_factory=list,
        description="Specific coverage, accuracy, ambiguity, or completeness problems."
    )
    revision_instructions: List[str] = Field(
        default_factory=list,
        description="Concrete instructions for the generator to address on the next pass."
    )


class WorkflowReviewOutput(BaseModel):
    review_status: Literal["pending_ba_review", "needs_manual_review"] = Field(
        ...,
        description="Final machine-review status after critic review and any retries."
    )
    refine_attempts: int = Field(
        ...,
        description="Number of refinement retries performed after critic failures."
    )
    max_refine_attempts: int = Field(
        ...,
        description="Configured maximum number of refinement retries."
    )
    generator_output: GeneratorOutput = Field(
        ...,
        description="Latest generated user story package."
    )
    latest_critic_output: CriticOutput = Field(
        ...,
        description="Most recent critic assessment."
    )
    critic_history: List[CriticOutput] = Field(
        default_factory=list,
        description="History of critic assessments across retries."
    )
    recommended_next_steps: List[str] = Field(
        default_factory=list,
        description="Best-practice next steps when manual intervention is needed."
    )
