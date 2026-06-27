from typing import List

from pydantic import BaseModel, Field


class SpecialistOutput(BaseModel):
    actors: List[str] = Field(
        default_factory=list,
        description="Primary users, roles, or systems involved in the requirement."
    )
    goals: List[str] = Field(
        default_factory=list,
        description="Core business or user goals extracted from the BRD."
    )
    constraints: List[str] = Field(
        default_factory=list,
        description="Technical, business, compliance, or scope constraints that shape the solution."
    )
    acceptance_criteria: List[str] = Field(
        default_factory=list,
        description="Testable acceptance criteria derived from the requirements."
    )
    edge_cases: List[str] = Field(
        default_factory=list,
        description="Edge cases, exceptions, risks, or notable failure scenarios mentioned or implied by the BRD."
    )
