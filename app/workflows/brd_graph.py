from functools import lru_cache
from typing import Literal, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.generator import GeneratorAgent
from app.agents.router import RouterAgent
from app.agents.specialist import SpecialistAgent
from app.schemas.generator_schema import GeneratorOutput
from app.parser.brd_parser import parse_document
from app.schemas.router_schema import RouterOutput
from app.schemas.specialist_schema import SpecialistOutput


class WorkflowState(TypedDict):
    target_stage: Literal["parse", "route", "specialist", "generate"]
    filename: NotRequired[str | None]
    file_bytes: NotRequired[bytes | None]
    raw_text: NotRequired[str | None]
    router_output: NotRequired[RouterOutput | None]
    specialist_output: NotRequired[SpecialistOutput | None]
    generator_output: NotRequired[GeneratorOutput | None]
    errors: NotRequired[list[str]]


def ingest_input_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    if raw_text:
        return {"raw_text": raw_text}

    return parse_document_node(state)


def parse_document_node(state: WorkflowState) -> dict:
    filename = state.get("filename")
    file_bytes = state.get("file_bytes")

    if not filename:
        raise ValueError("A filename is required to parse the uploaded document.")
    if file_bytes is None:
        raise ValueError("File content is required to parse the uploaded document.")

    raw_text = parse_document(filename, file_bytes)
    return {"raw_text": raw_text}


def route_brd_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    if not raw_text:
        raise ValueError("Raw BRD text is required before routing.")

    agent = RouterAgent()
    router_output = agent.route(raw_text)
    return {"router_output": router_output}


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


def generate_user_story_node(state: WorkflowState) -> dict:
    raw_text = state.get("raw_text")
    router_output = state.get("router_output")
    specialist_output = state.get("specialist_output")

    if not raw_text:
        raise ValueError("Raw BRD text is required before user story generation.")
    if router_output is None:
        raise ValueError("Router output is required before user story generation.")
    if specialist_output is None:
        raise ValueError("Specialist output is required before user story generation.")

    agent = GeneratorAgent()
    generator_output = agent.generate(raw_text, router_output, specialist_output)
    return {"generator_output": generator_output}


def decide_after_routing(state: WorkflowState) -> str:
    return "specialize_brd" if state.get("target_stage") in {"specialist", "generate"} else END


def decide_after_ingest(state: WorkflowState) -> str:
    return END if state.get("target_stage") == "parse" else "route_brd"


def decide_after_specialist(state: WorkflowState) -> str:
    return "generate_user_story" if state.get("target_stage") == "generate" else END


@lru_cache(maxsize=1)
def get_brd_graph():
    workflow = StateGraph(WorkflowState)
    workflow.add_node("ingest_input", ingest_input_node)
    workflow.add_node("route_brd", route_brd_node)
    workflow.add_node("specialize_brd", specialize_brd_node)
    workflow.add_node("generate_user_story", generate_user_story_node)

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
    workflow.add_edge("generate_user_story", END)

    return workflow.compile()


def run_graph_for_file(
    filename: str,
    file_bytes: bytes,
    target_stage: Literal["parse", "route", "specialist", "generate"],
) -> WorkflowState:
    graph = get_brd_graph()
    return graph.invoke(
        {
            "filename": filename,
            "file_bytes": file_bytes,
            "target_stage": target_stage,
            "errors": [],
        }
    )


def run_graph_for_text(
    raw_text: str,
    target_stage: Literal["parse", "route", "specialist", "generate"],
) -> WorkflowState:
    graph = get_brd_graph()
    return graph.invoke(
        {
            "raw_text": raw_text,
            "target_stage": target_stage,
            "errors": [],
        }
    )
