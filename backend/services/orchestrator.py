import sys
from pathlib import Path

# Add project root to path to import prompt_responder
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from .midas_positioner import positioner
from .yolo_detector import yolo_detect
from .azure_ai_responder import azure_respond, azure_auto_detect

def process_query(text_query: str, image_path: str) -> dict:
    # Run YOLO detection
    yolo_results = yolo_detect(image_path)
    detections = yolo_results.get("detections", [])

    # Get depth data from MiDaS
    depth_data = positioner(image_path, detections)
    # Example structure:
    # depth_data = {
    #   "objects_with_depth": [
    #       {"label": "keys", "relative_depth": 0.45, "relation": "on top of table"},
    #       {"label": "table", "relative_depth": 0.60}
    #   ]
    # }

    # Get LLM response
    response_text = azure_respond(
        query=text_query,
        detections=detections,
        depth_data=depth_data
    )
    
    return {"response_text": response_text}


def process_auto_detect(image_path: str) -> dict:
    # Run YOLO detection
    yolo_results = yolo_detect(image_path)
    detections = yolo_results.get("detections", [])
    
    # Get depth data from MiDaS
    depth_data = positioner(image_path, detections)
    
    # Get LLM alert response
    response_text = azure_auto_detect(
        detections=detections,
        depth_data=depth_data
    )
    
    return {"response_text": response_text}
