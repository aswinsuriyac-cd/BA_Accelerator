from functools import lru_cache
from typing import Literal, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph
from langsmith import traceable

from app.agents.critic import CriticAgent
from app.agents.generator import GeneratorAgent
from app.agents.router import RouterAgent
from app.agents.specialist import SpecialistAgent
from app.parser.brd_parser import parse_document
from app.schemas.generator_schema import GeneratorOutput
from app.schemas.review_schema import CriticOutput, WorkflowReviewOutput
from app.schemas.router_schema import RouterOutput
from app.schemas.specialist_schema import SpecialistOutput


class WorkflowState(TypedDict):
    target_stage: Literal["parse", "route", "specialist", "generate", "review"]
    filename: NotRequired[str | None]
    file_bytes: NotRequired[bytes | None]
    raw_text: NotRequired[str | None]
    router_output: NotRequired[RouterOutput | None]
    specialist_output: NotRequired[SpecialistOutput | None]
    generator_output: NotRequired[GeneratorOutput | None]
    critic_output: NotRequired[CriticOutput | None]
    critic_history: NotRequired[list[CriticOutput]]
    refine_attempts: NotRequired[int]
    max_refine_attempts: NotRequired[int]
    review_status: NotRequired[Literal["pending_ba_review", "needs_manual_review"] | None]
    recommended_next_steps: NotRequired[list[str]]
    errors: NotRequired[list[str]]


@traceable(name="ingest_input_node")
def ingest_input_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    if raw_text:
        return {"raw_text": raw_text}

    return parse_document_node(state)


@traceable(name="parse_document_node")
def parse_document_node(state: WorkflowState) -> dict:
    filename = state.get("filename")
    file_bytes = state.get("file_bytes")

    if not filename:
        raise ValueError("A filename is required to parse the uploaded document.")
    if file_bytes is None:
        raise ValueError("File content is required to parse the uploaded document.")

    raw_text = parse_document(filename, file_bytes)
    return {"raw_text": raw_text}


@traceable(name="route_brd_node")
def route_brd_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    if not raw_text:
        raise ValueError("Raw BRD text is required before routing.")

    agent = RouterAgent()
    router_output = agent.route(raw_text)
    return {"router_output": router_output}


@traceable(name="specialize_brd_node")
def specialize_brd_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    router_output = state.get("router_output")

    if not raw_text:
        raise ValueError("Raw BRD text is required before specialist analysis.")
    if router_output is None:
        raise ValueError("Router output is required before specialist analysis.")

    agent = SpecialistAgent()
    specialist_output = agent.analyze(raw_text, router_output)
    return {"specialist_output": specialist_output}


@traceable(name="generate_user_story_node")
def generate_user_story_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    router_output = state.get("router_output")
    specialist_output = state.get("specialist_output")
    critic_output = state.get("critic_output")
    refine_attempts = state.get("refine_attempts", 0)

    if not raw_text:
        raise ValueError("Raw BRD text is required before user story generation.")
    if router_output is None:
        raise ValueError("Router output is required before user story generation.")
    if specialist_output is None:
        raise ValueError("Specialist output is required before user story generation.")

    revision_instructions = critic_output.revision_instructions if critic_output else None

    agent = GeneratorAgent()
    generator_output = agent.generate(
        raw_text,
        router_output,
        specialist_output,
        revision_instructions=revision_instructions,
        refine_attempts=refine_attempts,
    )
    return {"generator_output": generator_output}


@traceable(name="critic_review_node")
def critic_review_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    router_output = state.get("router_output")
    specialist_output = state.get("specialist_output")
    generator_output = state.get("generator_output")

    if not raw_text:
        raise ValueError("Raw BRD text is required before critic review.")
    if router_output is None:
        raise ValueError("Router output is required before critic review.")
    if specialist_output is None:
        raise ValueError("Specialist output is required before critic review.")
    if generator_output is None:
        raise ValueError("Generated story package is required before critic review.")

    agent = CriticAgent()
    critic_output = agent.review(raw_text, router_output, specialist_output, generator_output)

    critic_history = list(state.get("critic_history", []))
    critic_history.append(critic_output)

    updates: dict = {
        "critic_output": critic_output,
        "critic_history": critic_history,
    }

    if critic_output.verdict == "pass":
        updates["review_status"] = "pending_ba_review"
        updates["recommended_next_steps"] = ["Submit the reviewed story package to the BA for final approval."]
        return updates

    refine_attempts = state.get("refine_attempts", 0) + 1
    updates["refine_attempts"] = refine_attempts

    if refine_attempts >= state.get("max_refine_attempts", 3):
        updates["review_status"] = "needs_manual_review"
        updates["recommended_next_steps"] = build_manual_review_steps(critic_output)

    return updates


def build_manual_review_steps(critic_output: CriticOutput) -> list[str]:
    steps = []
    for instruction in critic_output.revision_instructions[:4]:
        steps.append(instruction)

    if not steps:
        steps.extend(
            [
                "Split the BRD into smaller requirement groups and regenerate the story package.",
                "Clarify ambiguous requirements, business rules, and dependencies in the source BRD.",
                "Manually review the latest generated draft and adjust the unsupported or missing items.",
            ]
        )
    return steps


def build_review_output(state: WorkflowState) -> WorkflowReviewOutput:
    generator_output = state.get("generator_output")
    critic_output = state.get("critic_output")

    if generator_output is None:
        raise ValueError("Generator output is missing from the workflow state.")
    if critic_output is None:
        raise ValueError("Critic output is missing from the workflow state.")

    return WorkflowReviewOutput(
        review_status=state.get("review_status") or "needs_manual_review",
        refine_attempts=state.get("refine_attempts", 0),
        max_refine_attempts=state.get("max_refine_attempts", 3),
        generator_output=generator_output,
        latest_critic_output=critic_output,
        critic_history=state.get("critic_history", []),
        recommended_next_steps=state.get("recommended_next_steps", []),
    )


def decide_after_routing(state: WorkflowState) -> str:
    return "specialize_brd" if state.get("target_stage") in {"specialist", "generate", "review"} else END


def decide_after_ingest(state: WorkflowState) -> str:
    return END if state.get("target_stage") == "parse" else "route_brd"


def decide_after_specialist(state: WorkflowState) -> str:
    return "generate_user_story" if state.get("target_stage") in {"generate", "review"} else END


def decide_after_generation(state: WorkflowState) -> str:
    return "critic_review" if state.get("target_stage") == "review" else END


def decide_after_critic(state: WorkflowState) -> str:
    critic_output = state.get("critic_output")
    if critic_output is None:
        raise ValueError("Critic output is required for review branching.")

    if critic_output.verdict == "pass":
        return END

    if state.get("refine_attempts", 0) >= state.get("max_refine_attempts", 3):
        return END

    return "generate_user_story"


@lru_cache(maxsize=1)
def get_brd_graph():
    workflow = StateGraph(WorkflowState)
    workflow.add_node("ingest_input", ingest_input_node)
    workflow.add_node("route_brd", route_brd_node)
    workflow.add_node("specialize_brd", specialize_brd_node)
    workflow.add_node("generate_user_story", generate_user_story_node)
    workflow.add_node("critic_review", critic_review_node)

    workflow.add_edge(START, "ingest_input")
    workflow.add_conditional_edges(
        "ingest_input",
        decide_after_ingest,
        {
            "route_brd": "route_brd",
            END: END,
        },
    )
    workflow.add_conditional_edges(
        "route_brd",
        decide_after_routing,
        {
            "specialize_brd": "specialize_brd",
            END: END,
        },
    )
    workflow.add_conditional_edges(
        "specialize_brd",
        decide_after_specialist,
        {
            "generate_user_story": "generate_user_story",
            END: END,
        },
    )
    workflow.add_conditional_edges(
        "generate_user_story",
        decide_after_generation,
        {
            "critic_review": "critic_review",
            END: END,
        },
    )
    workflow.add_conditional_edges(
        "critic_review",
        decide_after_critic,
        {
            "generate_user_story": "generate_user_story",
            END: END,
        },
    )

    return workflow.compile()


@traceable(name="run_graph_for_file")
def run_graph_for_file(
    filename: str,
    file_bytes: bytes,
    target_stage: Literal["parse", "route", "specialist", "generate", "review"],
    max_refine_attempts: int = 3,
) -> WorkflowState:
    graph = get_brd_graph()
    return graph.invoke(
        {
            "filename": filename,
            "file_bytes": file_bytes,
            "target_stage": target_stage,
            "critic_history": [],
            "refine_attempts": 0,
            "max_refine_attempts": max_refine_attempts,
            "errors": [],
        }
    )


@traceable(name="run_graph_for_text")
def run_graph_for_text(
    raw_text: str,
    target_stage: Literal["parse", "route", "specialist", "generate", "review"],
    max_refine_attempts: int = 3,
) -> WorkflowState:
    graph = get_brd_graph()
    return graph.invoke(
        {
            "raw_text": raw_text,
            "target_stage": target_stage,
            "critic_history": [],
            "refine_attempts": 0,
            "max_refine_attempts": max_refine_attempts,
            "errors": [],
        }
    )
