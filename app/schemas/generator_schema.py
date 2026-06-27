from typing import List

from pydantic import BaseModel, Field


class UserStoryRow(BaseModel):
    serial_number: int = Field(
        ...,
        description="1-based sequence number for the generated story row."
    )
    epic: str = Field(
        ...,
        description="High-level workstream or epic for the story."
    )
    feature: str = Field(
        ...,
        description="Feature, page, module, or requirement bucket represented by the story."
    )
    us_id: str = Field(
        ...,
        description="Stable user story identifier such as US-BRD-001."
    )
    us_summary: str = Field(
        ...,
        description="Short title-style summary of the user story."
    )
    user_story_description: str = Field(
        ...,
        description="Expanded user story description, typically including the classic 'I want ... so that ...' phrasing."
    )
    acceptance_criteria: List[str] = Field(
        default_factory=list,
        description="Testable acceptance criteria for the story."
    )
    business_rules: List[str] = Field(
        default_factory=list,
        description="Business rules, constraints, or policies that govern the story."
    )
    dependencies: List[str] = Field(
        default_factory=list,
        description="External inputs, systems, approvals, or prerequisites required by the story."
    )
    state: str = Field(
        default="Draft",
        description="Workflow state for the generated story, such as Draft or Sprint 1."
    )
    comments: str | None = Field(
        default=None,
        description="Optional implementation or BA notes for the story."
    )
    reference_link: str | None = Field(
        default=None,
        description="Optional source reference, Figma link, or supporting artifact link."
    )


class GeneratorOutput(BaseModel):
    document_title: str = Field(
        ...,
        description="Human-readable title for the generated user story package."
    )
    story_id_prefix: str = Field(
        ...,
        description="Prefix used for story IDs in the output package."
    )
    stories: List[UserStoryRow] = Field(
        default_factory=list,
        description="Generated user story rows formatted for BA review and export."
    )
