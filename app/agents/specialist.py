import os

from google import genai
from google.genai import types

from app.config import settings
from app.schemas.router_schema import RouterOutput
from app.schemas.specialist_schema import SpecialistOutput


class SpecialistAgent:
    def __init__(self):
        self.api_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY")
        self._client = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            if not self.api_key:
                raise ValueError(
                    "GEMINI_API_KEY is not set. Please create a `.env` file with your "
                    "GEMINI_API_KEY or export the GEMINI_API_KEY environment variable."
                )
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def analyze(self, raw_brd_text: str, router_output: RouterOutput) -> SpecialistOutput:
        """
        Convert the raw BRD and router classification into structured requirements
        for downstream story generation.
        """
        if not raw_brd_text.strip():
            raise ValueError("The provided BRD text is empty.")

        prompt = (
            "You are given a raw Business Requirement Document and the router agent classification.\n\n"
            "Produce structured requirements for the next generation stage.\n"
            "Return JSON with exactly these fields:\n"
            "- actors: array of people, teams, or systems involved\n"
            "- goals: array of explicit user or business goals\n"
            "- constraints: array of technical, compliance, scope, dependency, or rollout constraints\n"
            "- acceptance_criteria: array of specific, testable acceptance criteria\n"
            "- edge_cases: array of edge cases, unanswered questions, rollout risks, or exception scenarios\n\n"
            f"Router classification:\n{router_output.model_dump_json(indent=2)}\n\n"
            f"--- RAW BRD START ---\n{raw_brd_text}\n--- RAW BRD END ---"
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SpecialistOutput,
            temperature=0.1,
            system_instruction=(
                "You are a specialist business analyst who turns requirement documents into "
                "clean, implementation-ready structured requirements. Be concrete, avoid fluff, "
                "and preserve unresolved ambiguities as edge cases or acceptance criteria gaps."
            )
        )

        response = self.client.models.generate_content(
            model=settings.model_name,
            contents=prompt,
            config=config
        )

        if not response.text:
            raise RuntimeError("Received empty response from Gemini API.")

        return SpecialistOutput.model_validate_json(response.text)
