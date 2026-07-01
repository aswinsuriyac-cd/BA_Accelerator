from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.models.import_request import ImportRequest

from app.services.jira_service import JiraService
from app.services.requirement_extractor import RequirementExtractor
from app.services.brd_builder import BRDBuilder
from app.services.word_generator import WordGenerator

router = APIRouter(
    prefix="/import",
    tags=["Jira Import"]
)

jira_service = JiraService()
extractor = RequirementExtractor()
builder = BRDBuilder()
generator = WordGenerator()


@router.post("/jira")
def import_jira(request: ImportRequest):

    issue = jira_service.fetch_issue(
        request.issue_key
    )

    extracted = extractor.extract(
        issue.summary,
        issue.description
    )

    brd = builder.build(
        extracted
    )

    file_path = generator.generate(
        brd
    )

    return FileResponse(
        path=file_path,
        filename=file_path.split("/")[-1],
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )