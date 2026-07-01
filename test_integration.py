import requests
import json

url = "http://localhost:8000/api/v1/analyze/generate/file"
file_path = "sample_brd.md"

try:
    with open(file_path, "rb") as f:
        files = {"file": (file_path, f, "text/markdown")}
        response = requests.post(url, files=files)
        
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        workflow_id = response.headers.get("X-Workflow-Id")
        print(f"Workflow ID: {workflow_id}")
        
        # Test fetch workflow detail
        detail_url = f"http://localhost:8000/api/v1/analyze/workflows/{workflow_id}"
        detail_response = requests.get(detail_url)
        print(f"Detail Status: {detail_response.status_code}")
        
        if detail_response.status_code == 200:
            data = detail_response.json()
            print(f"Artifacts count: {len(data.get('artifacts', []))}")
            generator = next((a for a in data.get('artifacts', []) if a['artifact_type'] == 'generator_output'), None)
            if generator:
                content = json.loads(generator['content_json'])
                stories = content.get('stories', [])
                print(f"Generated {len(stories)} stories.")
                for s in stories[:3]:
                    print(f" - [{s.get('us_id')}] {s.get('us_summary')}")
        else:
            print("Failed to fetch workflow detail.")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
