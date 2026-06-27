import os
import sys
from dotenv import load_dotenv

# Ensure the root folder is in the python search path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.workflows.brd_graph import run_graph_for_file, run_graph_for_text

def test_pipeline():
    print("=== Step 1: Testing Document Parser ===")
    brd_path = "sample_brd.md"
    if not os.path.exists(brd_path):
        print(f"Error: {brd_path} not found.")
        sys.exit(1)
        
    with open(brd_path, "rb") as f:
        file_bytes = f.read()
        
    try:
        parse_state = run_graph_for_file(brd_path, file_bytes, target_stage="parse")
        parsed_text = parse_state["raw_text"]
        print(f"Successfully parsed {brd_path} through LangGraph!")
        print(f"Parsed Content Length: {len(parsed_text)} characters.")
        print("First 150 characters of parsed output:")
        print("-" * 40)
        print(parsed_text[:150] + "...")
        print("-" * 40)
    except Exception as e:
        print(f"Parser test FAILED: {e}")
        sys.exit(1)
        
    print("\n=== Step 2: Testing Router Agent ===")
    # Load environment variables from .env if present
    load_dotenv()
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("WARNING: GEMINI_API_KEY environment variable not found in .env or system environment.")
        print("Skipping Router Agent API call. (Set GEMINI_API_KEY to test the full agent flow).")
        print("\nParser verification: PASSED")
        sys.exit(0)
        
    print("GEMINI_API_KEY found. Initializing Router Agent...")
    try:
        route_state = run_graph_for_text(parsed_text, target_stage="route")
        router_result = route_state["router_output"]
        print("\n=== Router Agent Response (Structured Output) ===")
        print(f"BRD Type: {router_result.brd_type}")
        print(f"Confidence: {router_result.confidence}")
        print(f"Extracted Intent: {router_result.extracted_intent}")
        print(f"Suggested Specialist: {router_result.suggested_specialist}")
        print("Ambiguities found:")
        for idx, amb in enumerate(router_result.ambiguities, 1):
            print(f"  {idx}. {amb}")
        print("-" * 40)
        print("\n=== Step 3: Testing Specialist Agent ===")
        specialist_state = run_graph_for_text(parsed_text, target_stage="specialist")
        specialist_result = specialist_state["specialist_output"]
        print("Actors:", specialist_result.actors)
        print("Goals:", specialist_result.goals)
        print("Constraints:", specialist_result.constraints)
        print("Acceptance Criteria:", specialist_result.acceptance_criteria)
        print("Edge Cases:", specialist_result.edge_cases)
        print("-" * 40)
        print("\n=== Step 4: Testing Generator Agent ===")
        generator_state = run_graph_for_text(parsed_text, target_stage="generate")
        generator_result = generator_state["generator_output"]
        print("Document Title:", generator_result.document_title)
        print("Story ID Prefix:", generator_result.story_id_prefix)
        print("Total Stories:", len(generator_result.stories))
        for story in generator_result.stories[:3]:
            print("-" * 20)
            print("US ID:", story.us_id)
            print("Summary:", story.us_summary)
            print("Epic:", story.epic)
            print("Feature:", story.feature)
            print("Description:", story.user_story_description)
            print("Acceptance Criteria:", story.acceptance_criteria)
            print("Business Rules:", story.business_rules)
            print("Dependencies:", story.dependencies)
        print("-" * 40)
        print("Full structured pipeline verification: PASSED")
    except Exception as e:
        print(f"Router Agent test FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_pipeline()
