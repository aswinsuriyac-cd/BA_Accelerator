from typing import List
from pydantic import BaseModel


class BRDModel(BaseModel):

    title: str = ""

    project_name: str = ""

    business_objective: str = ""

    scope: str = ""

    stakeholders: List[str] = []

    functional_requirements: List[str] = []

    non_functional_requirements: List[str] = []

    constraints: List[str] = []

    assumptions: List[str] = []

    dependencies: List[str] = []

    risks: List[str] = []