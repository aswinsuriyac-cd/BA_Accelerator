from google.genai import types
from app.config import settings
from app.schemas.router_schema import RouterOutput
from app.services.gemini_service import generate_content_with_fallback

class RouterAgent:
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
            "any logical ambiguities or missing details in the description. Also choose the best downstream "
            "specialist agent for the next step.\n\n"
            "Return JSON with exactly these fields:\n"
            "- brd_type: short snake_case label such as feature_request, bug_fix, refactor, integration, migration, or other\n"
            "- confidence: number from 0.0 to 1.0\n"
            "- extracted_intent: concise summary of the main business need\n"
            "- ambiguities: array of unresolved questions, conflicts, or missing details\n"
            "- suggested_specialist: downstream specialist label; usually the same as brd_type unless a more specific specialist is justified\n\n"
            f"--- RAW BRD START ---\n{raw_brd_text}\n--- RAW BRD END ---"
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RouterOutput,
            temperature=0.1,
            system_instruction=(
                "You are an expert technical product manager and business analyst. "
                "You meticulously parse requirement documents, identify what they are asking for (e.g. features, bug fixes), "
                "and find any missing requirements, ambiguities, or contradictions that need clarification. "
                "Your output is consumed by downstream agents, so the JSON must be concise, deterministic, and actionable."
            )
        )

        response = generate_content_with_fallback(
            model=settings.model_name,
            contents=prompt,
            config=config
        )

        if not response.text:
            raise RuntimeError("Received empty response from Gemini API.")

        return RouterOutput.model_validate_json(response.text)
