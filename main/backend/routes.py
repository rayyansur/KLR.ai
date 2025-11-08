import base64
import os
import tempfile
from flask import Blueprint, jsonify, request

from services.orchestrator import process_query, process_auto_detect


routes = Blueprint('routes', __name__)


def decode_base64_image(base64_string: str) -> str:
    # Decode base64 string
    image_data = base64.b64decode(base64_string)
        
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
        tmp_file.write(image_data)
        tmp_path = tmp_file.name
    
    return tmp_path

@routes.route('/query', methods=['POST'])
def handle_query():
    data = request.get_json()
    text_query = data.get('query')
    if not text_query or not isinstance(text_query, str):
        return jsonify({"error": "Query must be a non-empty string"}), 400
    
    base64_image = data.get('image')
    if not base64_image or not isinstance(base64_image, str):
        return jsonify({"error": "Image must be a base64-encoded string"}), 400
    
    image_path = decode_base64_image(base64_image)
    result = process_query(text_query, image_path)
    if image_path and os.path.exists(image_path):
        os.unlink(image_path)
    return jsonify({"result": result}), 200

@routes.route('/auto-detect', methods=['POST'])
def handle_auto_detect():
    data = request.get_json()
    base64_image = data.get('image')
    if not base64_image or not isinstance(base64_image, str):
        return jsonify({"error": "Image must be a base64-encoded string"}), 400
    image_path = decode_base64_image(base64_image)
    
    # Get YOLO detections
    from services.yolo_detector import yolo_detect
    yolo_results = yolo_detect(image_path)
    detections = yolo_results.get("Objects", [])
    
    # Get LLM response
    result = process_auto_detect(image_path)
    
    if image_path and os.path.exists(image_path):
        os.unlink(image_path)

    # Return both detections and LLM response for mobile app
    return jsonify({
        "result": {
            "response_text": result.get("response_text", ""),
            "detections": detections  # Include YOLO detections for mobile app
        }
    }), 200


@routes.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200