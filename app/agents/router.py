import os
from google import genai
from google.genai import types
from app.config import settings
from app.schemas.router_schema import RouterOutput

class RouterAgent:
    def __init__(self):
        # Retrieve the key from settings first, then fall back to direct environment
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

    def route(self, raw_brd_text: str) -> RouterOutput:
        """
        Analyze the raw BRD content and route it to the correct downstream agent,
        returning structured classifications and potential ambiguities.
        """
        if not raw_brd_text.strip():
            raise ValueError("The provided BRD text is empty.")

        prompt = (
            "Analyze the following raw Business Requirement Document (BRD) and classify its core intent, "
            "determine the type of request, assess your confidence in the classification, and identify "
            "any logical ambiguities or missing details in the description.\n\n"
            f"--- RAW BRD START ---\n{raw_brd_text}\n--- RAW BRD END ---"
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RouterOutput,
            temperature=0.1,
            system_instruction=(
                "You are an expert technical product manager and business analyst. "
                "You meticulously parse requirement documents, identify what they are asking for (e.g. features, bug fixes), "
                "and find any missing requirements, ambiguities, or contradictions that need clarification."
            )
        )

        response = self.client.models.generate_content(
            model=settings.model_name,
            contents=prompt,
            config=config
        )

        if not response.text:
            raise RuntimeError("Received empty response from Gemini API.")

        return RouterOutput.model_validate_json(response.text)
