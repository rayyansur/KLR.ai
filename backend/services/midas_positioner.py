import base64
import io
import numpy as np
from PIL import Image
from typing import Dict, List

from .depth_estimator import depth_estimate
from .collision_detector import collision_analyze

def _clean_base64(data: str) -> str:
    """Clean base64 string by removing prefix and fixing padding."""
    if data.startswith("data:image"):
        data = data.split(",", 1)[1]  # remove "data:image/jpeg;base64,"
    # Fix padding if necessary
    missing_padding = len(data) % 4
    if missing_padding:
        data += "=" * (4 - missing_padding)
    return data

def positioner(image_path: str, detections: Dict) -> Dict:
    try:
        print("\n===== DEBUG: Incoming Base64 snippet =====")
        print(image_path[:80])   # first 80 chars
        print(f"(Length: {len(image_path)})")
        print("========================================\n")

        # === 1. Decode Base64 image ===
        clean_b64 = _clean_base64(image_path)
        image_bytes = base64.b64decode(clean_b64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")


        # === 2. Estimate depth map using MiDaS ===
        depth_result = depth_estimate(image)
        depth_map = depth_result["depthMap"]
        if not isinstance(depth_map, np.ndarray):
            raise ValueError("Depth map is not a numpy array.")

        # === 3. Format YOLO detections ===
        labeled_objects: List[Dict] = []
        for i, det in enumerate(detections.get("Objects", [])):
            pos = det.get("position", {})
            labeled_objects.append({
                "objectId": i,
                "label": det.get("class", "unknown"),
                "bbox": [
                    pos.get("x1", 0),
                    pos.get("y1", 0),
                    pos.get("x2", 0),
                    pos.get("y2", 0),
                ],
                "detectionConfidence": det.get("confidence", 0.0)
            })

        # === 4. Run collision detection ===
        collision_results = collision_analyze(depth_map, labeled_objects)

        # === 5. Build unified response ===
        return {
            "depthStats": depth_result.get("stats", {}),
            "inferenceTime": depth_result.get("inferenceTime", 0.0),
            "collisionAnalysis": collision_results
        }

    except Exception as e:
        print(f"[midas_positioner] Error: {e}")
        return {
            "error": str(e),
            "depthStats": {},
            "collisionAnalysis": []
        }
