import os

import requests

from .confidence import evaluate_confidence


SMALL_MODEL = "qwen2.5:3b"
LARGE_MODEL = "qwen2.5:7b"
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_TIMEOUT = 300
RESPONSE_SYSTEM_PROMPT = """You are Cascadia. Give clear, concise, useful answers in Markdown and follow the user's requested format.
- Answer directly: no filler openings and no repetitive conclusion.
- Match the structure to the task: short facts use a short paragraph; explanations use meaningful headings and brief bullets; procedures use numbered steps; code answers use a brief explanation and a complete fenced code block with a language label.
- For comparisons, use a compact Markdown table with an item/name column and only the requested criteria.
- Use blank lines between sections, bold key terms sparingly, and avoid long paragraphs.
- Do not add unrequested examples, categories, or sections. Do not force headings on short answers."""


def _get_confidence_threshold() -> float:
    raw_value = os.getenv("CASCADIA_CONFIDENCE_THRESHOLD", "0.70")
    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        return 0.70

    if not 0.0 <= value <= 1.0:
        return 0.70
    return value


CONFIDENCE_THRESHOLD = _get_confidence_threshold()


class OllamaUnavailable(Exception):
    """Ollama could not be reached or returned an unsuccessful status."""


class OllamaInvalidResponse(Exception):
    """Ollama returned a body without a valid response string."""


def generate_response(model: str, prompt: str) -> str:
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "system": RESPONSE_SYSTEM_PROMPT,
                "stream": False,
            },
            timeout=OLLAMA_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        raise OllamaUnavailable from error

    try:
        response_text = response.json().get("response")
    except (AttributeError, ValueError) as error:
        raise OllamaInvalidResponse from error
    if not isinstance(response_text, str):
        raise OllamaInvalidResponse
    return response_text


def route_query(query: str) -> dict[str, object]:
    # The smaller model handles the first pass quickly; only uncertain cases use more resources.
    small_response = generate_response(SMALL_MODEL, query)
    confidence = evaluate_confidence(query, small_response)

    # A score below the configured threshold triggers a second pass on the larger model.
    if confidence < CONFIDENCE_THRESHOLD:
        return {
            "response": generate_response(LARGE_MODEL, query),
            "model": LARGE_MODEL,
            "confidence": confidence,
            "escalated": True,
        }

    return {
        "response": small_response,
        "model": SMALL_MODEL,
        "confidence": confidence,
        "escalated": False,
    }