import base64
import tempfile
from flask import Blueprint, jsonify, request, Response
from flask_cors import CORS
import sys, os, traceback

from services.orchestrator import process_query, process_auto_detect

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from prompt_responder.text_to_speech import text_to_speech as tts

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
    text_query = data.get('text')
    if not text_query or not isinstance(text_query, str):
        return jsonify({"error": "Query must be a non-empty string"}), 400

    base64_image = data.get('image')
    if not base64_image or not isinstance(base64_image, str):
        return jsonify({"error": "Image must be a base64-encoded string"}), 400

    image_path = decode_base64_image(base64_image)
    result = process_query(text_query, image_path)
    if image_path and os.path.exists(image_path):
        os.unlink(image_path)
    return jsonify({"result": result["response_text"]}), 200


@routes.route('/auto-detect', methods=['POST'])
def handle_auto_detect():
    data = request.get_json()
    base64_image = data.get('image')
    if not base64_image or not isinstance(base64_image, str):
        return jsonify({"error": "Image must be a base64-encoded string"}), 400
    image_path = decode_base64_image(base64_image)

    result = process_auto_detect(image_path)

    if image_path and os.path.exists(image_path):
        os.unlink(image_path)

    return jsonify({"result": result["response_text"]}), 200


@routes.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy"}), 200


@routes.route("/text-to-speech", methods=["POST"])
def text_to_speech():
    try:
        data = request.get_json()
        text = data.get("text", "")
        print(f"[TTS] Request text: {text}")

        # Generate MP3 bytes from ElevenLabs
        audio_bytes = tts(text)

        # ✅ Return MP3 binary response
        return Response(audio_bytes, mimetype="audio/mpeg")

    except Exception as e:
        print(f"[TTS ERROR] {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

