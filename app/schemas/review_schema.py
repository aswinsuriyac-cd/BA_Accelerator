from typing import List, Literal

from pydantic import BaseModel, Field

from app.schemas.generator_schema import GeneratorOutput


class StoryReview(BaseModel):
    us_id: str = Field(
        ...,
        description="User story identifier being reviewed, such as US-BRD-001."
    )
    status: Literal["pass", "needs_clarification", "regenerate"] = Field(
        ...,
        description="Story-level review outcome used for selective rework."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Critic confidence that the story is accurate, complete, and actionable."
    )
    summary: str = Field(
        ...,
        description="Short explanation of the critic's judgment for this story."
    )
    issues: List[str] = Field(
        default_factory=list,
        description="Story-specific coverage, hallucination, ambiguity, or completeness issues."
    )
    clarification_questions: List[str] = Field(
        default_factory=list,
        description="Targeted BA clarification questions required before this story can be trusted."
    )
    revision_instructions: List[str] = Field(
        default_factory=list,
        description="Concrete instructions for selectively regenerating this story."
    )


class CriticOutput(BaseModel):
    verdict: Literal["pass", "fail"] = Field(
        ...,
        description="Whether the generated story package is acceptable for BA review."
    )
    package_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Overall critic confidence in the full generated package."
    )
    summary: str = Field(
        ...,
        description="Short assessment of the generated story package."
    )
    issues: List[str] = Field(
        default_factory=list,
        description="Specific coverage, accuracy, ambiguity, or completeness problems."
    )
    clarification_questions: List[str] = Field(
        default_factory=list,
        description="Package-level or aggregated BA clarification questions."
    )
    revision_instructions: List[str] = Field(
        default_factory=list,
        description="Concrete instructions for the generator to address on the next pass."
    )
    story_reviews: List[StoryReview] = Field(
        default_factory=list,
        description="Story-by-story critic results used for targeted regeneration."
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
