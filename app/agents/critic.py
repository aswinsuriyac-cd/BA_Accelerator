from google.genai import types

from app.config import settings
from app.schemas.generator_schema import GeneratorOutput
from app.schemas.review_schema import CriticOutput
from app.schemas.router_schema import RouterOutput
from app.schemas.specialist_schema import SpecialistOutput
from app.services.gemini_service import generate_content_with_fallback


class CriticAgent:
    def review(
        self,
        raw_brd_text: str,
        router_output: RouterOutput,
        specialist_output: SpecialistOutput,
        generator_output: GeneratorOutput,
    ) -> CriticOutput:
        """
        Compare the generated story package against the original BRD and upstream analysis.
        """
        if not raw_brd_text.strip():
            raise ValueError("The provided BRD text is empty.")

        prompt = (
            "You are reviewing a generated user story package against the original BRD.\n\n"
            "Check these dimensions carefully:\n"
            "- Coverage: every important BRD requirement should appear in some story, rule, dependency, or acceptance criterion\n"
            "- Accuracy: do not allow hallucinated actors, constraints, durations, or scope items\n"
            "- Completeness of acceptance criteria: important edge cases and constraints should be represented where appropriate\n"
            "- Ambiguity: flag vague, non-actionable, or untestable wording\n\n"
            "Return JSON with exactly these fields:\n"
            "- verdict: pass or fail\n"
            "- summary: short overall assessment\n"
            "- issues: array of specific issues found\n"
            "- revision_instructions: array of concrete fixes for the generator; keep them actionable\n\n"
            "Rules:\n"
            "- Use verdict=pass only when the package is ready for BA review\n"
            "- Use verdict=fail if any meaningful coverage gap, hallucination, or vague acceptance criteria remains\n"
            "- Keep issues and revision instructions specific and evidence-based\n\n"
            f"Router classification:\n{router_output.model_dump_json(indent=2)}\n\n"
            f"Specialist output:\n{specialist_output.model_dump_json(indent=2)}\n\n"
            f"Generated story package:\n{generator_output.model_dump_json(indent=2)}\n\n"
            f"--- RAW BRD START ---\n{raw_brd_text}\n--- RAW BRD END ---"
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CriticOutput,
            temperature=0.1,
            system_instruction=(
                "You are a strict senior business analyst and QA reviewer. "
                "Your job is to catch missing coverage, unsupported details, weak acceptance criteria, "
                "and vague wording before anything reaches BA review."
            )
        )

        response = generate_content_with_fallback(
            model=settings.model_name,
            contents=prompt,
            config=config
        )

        if not response.text:
            raise RuntimeError("Received empty response from Gemini API.")

        return CriticOutput.model_validate_json(response.text)
