from typing import List, Optional

from pydantic import BaseModel


class JiraIssue(BaseModel):

    issue_key: str

    summary: str

    description: Optional[str] = None

    priority: Optional[str] = None

    labels: List[str] = []

    components: List[str] = []