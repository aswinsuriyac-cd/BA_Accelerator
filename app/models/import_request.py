from pydantic import BaseModel


class ImportRequest(BaseModel):
    issue_key: str