"""
Flask application with camera control and frame processing API endpoints.
"""

from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import numpy as np

from camera_capture import (
    start_camera, stop_camera, get_frame, get_frame_base64,
    is_camera_active, get_fps
)
from frame_preprocessor import preprocess_for_inference
from inference_bridge import process_frame as inference_process_frame, get_bounding_boxes

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Store IMU data
imu_data = {"roll": 0.0, "pitch": 0.0, "yaw": 0.0}


@app.route('/')
def index():
    """Serve debug overlay page."""
    return render_template('debug_overlay.html')


@app.route('/api/camera/start', methods=['POST'])
def api_camera_start():
    """Start camera capture."""
    camera_index = request.json.get('camera_index', 0) if request.is_json else 0
    success, message = start_camera(camera_index)
    return jsonify({
        "success": success,
        "message": message
    }), 200 if success else 400


@app.route('/api/camera/stop', methods=['POST'])
def api_camera_stop():
    """Stop camera capture."""
    success, message = stop_camera()
    return jsonify({
        "success": success,
        "message": message
    }), 200 if success else 400


@app.route('/api/camera/status', methods=['GET'])
def api_camera_status():
    """Get camera status."""
    active = is_camera_active()
    fps = get_fps()
    return jsonify({
        "active": active,
        "fps": fps
    })


@app.route('/api/frame', methods=['GET'])
def api_get_frame():
    """Get current frame as base64 encoded image."""
    frame_base64 = get_frame_base64()
    if frame_base64 is None:
        return jsonify({
            "success": False,
            "message": "No frame available"
        }), 404
    
    return jsonify({
        "success": True,
        "frame": frame_base64,
        "format": "jpeg"
    })


@app.route('/api/frame/process', methods=['POST'])
def api_process_frame():
    """Process frame and return preprocessed tensor."""
    # Get current frame
    frame = get_frame()
    if frame is None:
        return jsonify({
            "success": False,
            "message": "No frame available"
        }), 404
    
    # Get parameters from request
    data = request.json if request.is_json else {}
    target_size = tuple(data.get('target_size', [224, 224]))
    rotation_angle = data.get('rotation_angle', imu_data.get('yaw', 0.0))
    normalize = data.get('normalize', True)
    
    try:
        # Preprocess frame
        tensor = preprocess_for_inference(
            frame,
            target_size=target_size,
            rotation_angle=rotation_angle,
            normalize=normalize,
            add_batch_dim=True
        )
        
        # Run inference
        inference_result = inference_process_frame(tensor)
        
        return jsonify({
            "success": True,
            "tensor_shape": list(tensor.shape),
            "tensor_dtype": str(tensor.dtype),
            "tensor_min": float(np.min(tensor)),
            "tensor_max": float(np.max(tensor)),
            "inference": inference_result
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Processing error: {str(e)}"
        }), 500


@app.route('/api/fps', methods=['GET'])
def api_get_fps():
    """Get current FPS."""
    fps = get_fps()
    return jsonify({
        "fps": fps
    })


@app.route('/api/imu', methods=['POST'])
def api_receive_imu():
    """Receive IMU data (rotation angles)."""
    global imu_data
    
    if not request.is_json:
        return jsonify({
            "success": False,
            "message": "JSON data required"
        }), 400
    
    data = request.json
    
    # Update IMU data
    if 'roll' in data:
        imu_data['roll'] = float(data['roll'])
    if 'pitch' in data:
        imu_data['pitch'] = float(data['pitch'])
    if 'yaw' in data:
        imu_data['yaw'] = float(data['yaw'])
    
    return jsonify({
        "success": True,
        "imu_data": imu_data
    })


@app.route('/api/imu', methods=['GET'])
def api_get_imu():
    """Get current IMU data."""
    return jsonify({
        "imu_data": imu_data
    })


@app.route('/api/bounding_boxes', methods=['GET'])
def api_get_bounding_boxes():
    """Get latest bounding boxes."""
    boxes = get_bounding_boxes()
    return jsonify({
        "bounding_boxes": boxes
    })


if __name__ == '__main__':
    print("Starting Flask server...")
    print("Open http://localhost:5000 in your browser")
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)

