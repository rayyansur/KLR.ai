# Create prompt, ask Azure OpenAI, and return response
import json
import os
from typing import Any, Dict, List, Optional

from openai import AzureOpenAI
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("AZURE_OPENAI_API_KEY")
deployment = os.getenv("MODEL_DEPLOYMENT_NAME")

# Initialize client only if credentials are available
if api_key and deployment:
    client = AzureOpenAI(
        api_version="2024-12-01-preview",
        azure_endpoint="https://samjswag-6951-resource.cognitiveservices.azure.com/",
        api_key=api_key
    )
    AZURE_AVAILABLE = True
else:
    client = None
    AZURE_AVAILABLE = False
    print("Warning: Azure OpenAI credentials not set. LLM features will be disabled.")

# Assistant IDs for different modes
ASSISTANT_ID_REGULAR = os.getenv("AGENT_REGULAR_ID")
ASSISTANT_ID_AUTO_DETECT = os.getenv("AGENT_AUTO_DETECT_ID")


def create_prompt(detections, depth_data, query, is_auto_detect):
    detections_json = json.dumps(detections, indent=2)
    depth_json = json.dumps(depth_data, indent=2)

    if is_auto_detect:
        prompt = f"""
        ### DETECTED OBJECTS:
        {detections_json}

        ### DEPTH / SPATIAL DATA:
        {depth_json}
        """
    else:
        if not query:
            raise ValueError("Query is required for regular mode")
        prompt = f"""
        Respond based on the context and data provided below.

        ### USER QUERY:
        {query}

        ### DETECTED OBJECTS:
        {detections_json}

        ### DEPTH / SPATIAL DATA:
        {depth_json}
        """
    
    return prompt

def ask_azure(prompt, assistant_id):
    if not AZURE_AVAILABLE or not client:
        return "LLM service is not configured. Please set AZURE_OPENAI_API_KEY and MODEL_DEPLOYMENT_NAME environment variables."
    
    messages = [
        {"role": "system", "content": f"Assistant ID: {assistant_id}"},
        {"role": "user", "content": prompt}
    ]

    response = client.chat.completions.create(
        messages=messages,
        max_completion_tokens=1024,
        model=deployment,
    )
    try:
        return response.choices[0].message.content
    except Exception:
        try:
            return response["choices"][0]["message"]["content"]
        except Exception:
            return str(response)


def get_response(detections, depth_data, query, is_auto_detect):
    assistant_id = ASSISTANT_ID_AUTO_DETECT if is_auto_detect else ASSISTANT_ID_REGULAR
    prompt = create_prompt(detections, depth_data, query, is_auto_detect)
    response = ask_azure(prompt, assistant_id)
    return response

