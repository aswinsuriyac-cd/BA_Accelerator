import os
import sys
from dotenv import load_dotenv

# Ensure the root folder is in the python search path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.parser.brd_parser import parse_document
from app.agents.router import RouterAgent

def test_pipeline():
    print("=== Step 1: Testing Document Parser ===")
    brd_path = "sample_brd.md"
    if not os.path.exists(brd_path):
        print(f"Error: {brd_path} not found.")
        sys.exit(1)
        
    with open(brd_path, "rb") as f:
        file_bytes = f.read()
        
    try:
        parsed_text = parse_document(brd_path, file_bytes)
        print(f"Successfully parsed {brd_path}!")
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
        agent = RouterAgent()
        result = agent.route(parsed_text)
        print("\n=== Router Agent Response (Structured Output) ===")
        print(f"BRD Type: {result.brd_type}")
        print(f"Confidence: {result.confidence}")
        print(f"Extracted Intent: {result.extracted_intent}")
        print("Ambiguities found:")
        for idx, amb in enumerate(result.ambiguities, 1):
            print(f"  {idx}. {amb}")
        print("-" * 40)
        print("Full structured pipeline verification: PASSED")
    except Exception as e:
        print(f"Router Agent test FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_pipeline()
