from google.genai import types

from app.config import settings
from app.schemas.generator_schema import GeneratorOutput
from app.schemas.router_schema import RouterOutput
from app.schemas.specialist_schema import SpecialistOutput
from app.services.gemini_service import generate_content_with_fallback


class GeneratorAgent:
    def generate(
        self,
        raw_brd_text: str,
        router_output: RouterOutput,
        specialist_output: SpecialistOutput,
        revision_instructions: list[str] | None = None,
        refine_attempts: int = 0,
        existing_generator_output: GeneratorOutput | None = None,
        ba_comments: str | None = None,
    ) -> GeneratorOutput:
        """
        Transform structured requirements into a user story package ready for review.
        """
        if not raw_brd_text.strip():
            raise ValueError("The provided BRD text is empty.")

        rework_context = ""
        if existing_generator_output is not None or ba_comments:
            rework_context = (
                "Rework context:\n"
                "- Treat this as a revision of the existing story package, not a fresh unrelated draft.\n"
                "- Preserve existing story IDs and useful accepted content unless a BA comment or critic instruction requires a change.\n"
                "- Add, remove, or split stories only when the BRD, BA comments, or critic feedback clearly requires it.\n"
                f"BA comments: {ba_comments or 'None'}\n"
                f"Existing story package:\n{existing_generator_output.model_dump_json(indent=2) if existing_generator_output else 'None'}\n\n"
            )

        prompt = (
            "You are given a raw BRD, the router classification, and structured specialist output.\n\n"
            "Generate a rich user story package aligned to BA tracking spreadsheets.\n"
            "Create a separate story row for each major requirement, feature, page, workflow, or integration that deserves independent implementation tracking.\n"
            "Do not collapse unrelated requirements into one story when they should be tracked separately.\n"
            "Return JSON with exactly these fields:\n"
            "- document_title: human-readable title for the story package\n"
            "- story_id_prefix: stable prefix such as US-BRD or US-AUTH\n"
            "- stories: array of rows, where each row contains:\n"
            "  - serial_number: 1-based sequential integer\n"
            "  - epic: high-level workstream label\n"
            "  - feature: feature, page, module, or requirement name\n"
            "  - us_id: unique story id using the prefix and a zero-padded number such as US-BRD-001\n"
            "  - us_summary: short title-style summary\n"
            "  - user_story_description: expanded user story text that includes who wants what and why\n"
            "  - acceptance_criteria: array of testable acceptance criteria\n"
            "  - business_rules: array of rules, policies, constraints, or scope boundaries\n"
            "  - dependencies: array of prerequisites, systems, content, approvals, credentials, or external dependencies\n"
            "  - state: use Draft unless the BRD strongly implies a better state\n"
            "  - comments: optional note, otherwise null\n"
            "  - reference_link: optional source label or artifact link, otherwise null\n\n"
            "Quality requirements:\n"
            "- Cover the major in-scope items from the BRD, not just one primary story\n"
            "- Keep story rows implementation-trackable and suitable for spreadsheet review\n"
            "- Acceptance criteria should be concrete and testable\n"
            "- Put constraints like out-of-scope notes, compliance mandates, or rollout limitations into business_rules when relevant\n"
            "- Put prerequisites like credentials, third-party integrations, stakeholder approvals, or design assets into dependencies when relevant\n"
            "- Do not invent links or IDs beyond the requested story IDs\n\n"
            f"Current refinement attempt: {refine_attempts}\n"
            f"Revision instructions from critic: {revision_instructions or []}\n\n"
            f"{rework_context}"
            f"Router classification:\n{router_output.model_dump_json(indent=2)}\n\n"
            f"Specialist output:\n{specialist_output.model_dump_json(indent=2)}\n\n"
            f"--- RAW BRD START ---\n{raw_brd_text}\n--- RAW BRD END ---"
        )

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeneratorOutput,
            temperature=0.2,
            system_instruction=(
                "You are a senior business analyst producing delivery-ready user story sheets. "
                "Convert structured requirements into clear, implementation-ready story rows for engineering, QA, and BA review. "
                "Prefer specific, trackable wording, split independent requirements into separate rows, "
                "and keep all criteria, rules, and dependencies within the scope implied by the BRD. "
                "If revision instructions are present, address them explicitly in the regenerated package."
            )
        )

        response = generate_content_with_fallback(
            model=settings.model_name,
            contents=prompt,
            config=config
        )

        if not response.text:
            raise RuntimeError("Received empty response from Gemini API.")

        return GeneratorOutput.model_validate_json(response.text)
