"""
MiDaS Positioner Service
Processes depth maps to get relative depth information for detected objects
Used by LLM to provide spatial context
"""
import sys
import os
from pathlib import Path
import numpy as np
from PIL import Image

# Try to import MiDaS handler if available
try:
    # Check if we're in the main backend directory
    backend_path = Path(__file__).parent.parent
    handler_path = backend_path / 'app' / 'models' / 'midas_lite_handler.py'
    
    if handler_path.exists():
        sys.path.insert(0, str(backend_path))
        from app.models.midas_lite_handler import MiDaSLiteHandler
        midas_handler = MiDaSLiteHandler()
        MIDAS_AVAILABLE = True
    else:
        MIDAS_AVAILABLE = False
        midas_handler = None
except Exception as e:
    print(f"Warning: MiDaS handler not available: {e}")
    MIDAS_AVAILABLE = False
    midas_handler = None


def positioner(image_path: str, detections: list) -> dict:
    """
    Get relative depth information for detected objects using MiDaS
    
    Args:
        image_path: Path to image file
        detections: List of detected objects from YOLO
            Format: [{"class": "person", "confidence": 0.9, "position": {"x1": 100, "y1": 100, "x2": 200, "y2": 300}}, ...]
    
    Returns:
        dict: {
            "objects_with_depth": [
                {"label": "person", "relative_depth": 0.45, "relation": "in front of"},
                ...
            ]
        }
    """
    try:
        # Check if image file exists
        if not os.path.exists(image_path):
            return {"objects_with_depth": []}
        
        # Load image
        image = Image.open(image_path)
        image_width, image_height = image.size
        
        # Get depth map
        depth_map = None
        if MIDAS_AVAILABLE and midas_handler:
            try:
                # Read image as bytes for handler
                with open(image_path, 'rb') as f:
                    image_bytes = f.read()
                
                # Convert detections to bbox format for handler
                object_bboxes = []
                for i, det in enumerate(detections):
                    pos = det.get('position', {})
                    object_bboxes.append({
                        'object_id': f"{det.get('class', 'object')}_{i}",
                        'bbox': [
                            int(pos.get('x1', 0)),
                            int(pos.get('y1', 0)),
                            int(pos.get('x2', 0)),
                            int(pos.get('y2', 0))
                        ]
                    })
                
                # Get depth estimation
                result = midas_handler.estimate_depth(image_bytes, object_bboxes)
                
                if result.get('success') and result.get('depth_map'):
                    depth_map = result['depth_map']
            except Exception as e:
                print(f"Warning: MiDaS depth estimation failed: {e}")
                depth_map = None
        
        # If MiDaS not available or failed, generate relative depth from positions
        if depth_map is None:
            return _generate_relative_depth_from_positions(detections, image_width, image_height)
        
        # Process depth map to get relative depths for objects
        return _process_depth_map_for_objects(depth_map, detections, image_width, image_height)
        
    except Exception as e:
        print(f"Error in positioner: {e}")
        # Fallback to position-based relative depth
        return _generate_relative_depth_from_positions(detections, image_width, image_height)


def _process_depth_map_for_objects(depth_map, detections, image_width, image_height):
    """
    Process depth map to extract relative depth information for each object
    """
    if not detections or len(detections) == 0:
        return {"objects_with_depth": []}
    
    depth_array = np.array(depth_map)
    if depth_array.size == 0:
        return _generate_relative_depth_from_positions(detections, image_width, image_height)
    
    depth_height, depth_width = depth_array.shape
    
    # Scale factors to map from image coordinates to depth map coordinates
    scale_x = depth_width / image_width
    scale_y = depth_height / image_height
    
    objects_with_depth = []
    
    # Collect all depth values for normalization
    all_depths = depth_array.flatten()
    min_depth = float(np.min(all_depths))
    max_depth = float(np.max(all_depths))
    depth_range = max_depth - min_depth if max_depth > min_depth else 1.0
    
    for det in detections:
        label = det.get('class', 'unknown')
        pos = det.get('position', {})
        
        x1 = int(pos.get('x1', 0))
        y1 = int(pos.get('y1', 0))
        x2 = int(pos.get('x2', 0))
        y2 = int(pos.get('y2', 0))
        
        # Scale bbox to depth map coordinates
        d_x1 = max(0, min(depth_width - 1, int(x1 * scale_x)))
        d_y1 = max(0, min(depth_height - 1, int(y1 * scale_y)))
        d_x2 = max(0, min(depth_width - 1, int(x2 * scale_x)))
        d_y2 = max(0, min(depth_height - 1, int(y2 * scale_y)))
        
        # Sample depth values in the bbox
        if d_x2 > d_x1 and d_y2 > d_y1:
            samples = depth_array[d_y1:d_y2+1, d_x1:d_x2+1].flatten()
            if len(samples) > 0:
                # Use median for robustness
                median_depth = float(np.median(samples))
                
                # Normalize to [0, 1] for relative depth
                relative_depth = (median_depth - min_depth) / depth_range if depth_range > 0 else 0.5
                
                # Determine spatial relation (simplified)
                center_y = (y1 + y2) / 2
                if center_y < image_height * 0.3:
                    relation = "in front of"
                elif center_y > image_height * 0.7:
                    relation = "behind"
                else:
                    relation = "at"
                
                objects_with_depth.append({
                    "label": label,
                    "relative_depth": round(relative_depth, 3),
                    "relation": relation
                })
    
    return {
        "objects_with_depth": objects_with_depth
    }


def _generate_relative_depth_from_positions(detections, image_width, image_height):
    """
    Fallback: Generate relative depth based on object positions
    Objects higher in image (lower y) are closer
    """
    if not detections or len(detections) == 0:
        return {"objects_with_depth": []}
    
    objects_with_depth = []
    
    for det in detections:
        label = det.get('class', 'unknown')
        pos = det.get('position', {})
        
        y1 = pos.get('y1', image_height // 2)
        y2 = pos.get('y2', image_height // 2)
        center_y = (y1 + y2) / 2
        
        # Normalize y position to [0, 1] depth
        # Lower y (higher in image) = closer (lower relative_depth)
        relative_depth = center_y / image_height
        
        # Determine spatial relation
        if center_y < image_height * 0.3:
            relation = "in front of"
        elif center_y > image_height * 0.7:
            relation = "behind"
        else:
            relation = "at"
        
        objects_with_depth.append({
            "label": label,
            "relative_depth": round(relative_depth, 3),
            "relation": relation
        })
    
    return {
        "objects_with_depth": objects_with_depth
    }
