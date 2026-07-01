import requests
from requests.auth import HTTPBasicAuth

from app.models.jira_issue import JiraIssue
from app.utils.config import settings
from app.services.adf_parser import ADFParser


class JiraService:

    def __init__(self):
        self.base_url = settings.JIRA_URL

        self.auth = HTTPBasicAuth(
            settings.JIRA_EMAIL,
            settings.JIRA_API_TOKEN
        )

        self.headers = {
            "Accept": "application/json"
        }

        self.parser = ADFParser()

    def fetch_issue(self, issue_key: str):

        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"

        response = requests.get(
            url,
            headers=self.headers,
            auth=self.auth
        )

        if response.status_code == 401:
            raise Exception("Authentication failed.")

        if response.status_code == 403:
            raise Exception("Permission denied.")

        if response.status_code == 404:
            raise Exception(f"Issue '{issue_key}' not found.")

        if response.status_code != 200:
            raise Exception(response.text)

        issue = response.json()

        fields = issue["fields"]

        description = ""

        if fields.get("description"):
            description = self.parser.parse(
                fields["description"]
            )

        priority = None

        if fields.get("priority"):
            priority = fields["priority"]["name"]

        labels = fields.get("labels", [])

        components = [
            component["name"]
            for component in fields.get("components", [])
        ]

        return JiraIssue(
            issue_key=issue["key"],
            summary=fields.get("summary", ""),
            description=description,
            priority=priority,
            labels=labels,
            components=components
        )