 # Text-to-speech conversion using ElevenLabs API (fixed PCM output)
import os
import tempfile
import wave
import simpleaudio as sa
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

api_key = os.getenv("ELEVENLABS_API_KEY")
if not api_key:
    raise ValueError("ELEVENLABS_API_KEY environment variable is not set")

elevenlabs = ElevenLabs(api_key=api_key)

def text_to_speech(text: str, voice_id: str = "Qggl4b0xRMiqOwhPtVWT") -> bytes:
    """Generate speech from text using ElevenLabs and play it via simpleaudio."""
    # Get raw PCM data from ElevenLabs
    audio = elevenlabs.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    audio = b"".join(audio)
    return audio
