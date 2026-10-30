import math
import os
import re
import time

import requests

from .confidence import evaluate_confidence


SMALL_MODEL = "qwen2.5:3b"
LARGE_MODEL = "qwen2.5:7b"
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_TIMEOUT = 300
MODEL_KEEP_ALIVE = "10m"
MAX_CONTEXT_SIZE = 32768
RESPONSE_SYSTEM_PROMPT = """You are Cascadia. Give clear, concise, useful answers in Markdown and follow the user's requested format.
- Answer directly: no filler openings and no repetitive conclusion.
- Match the structure to the task: short facts use a short paragraph; explanations use meaningful headings and brief bullets; procedures use numbered steps; code answers use a brief explanation and a complete fenced code block with a language label.
- For comparisons, use a compact Markdown table with an item/name column and only the requested criteria.
- Use blank lines between sections, bold key terms sparingly, and avoid long paragraphs.
- Do not add unrequested examples, categories, or sections. Do not force headings on short answers."""

COMPLEX_QUERY_PATTERN = re.compile(
    r"\b(analy[sz]e|compare|contrast|derive|evaluate|prove|design|architecture|"
    r"optimization|optimize|algorithm|trade[- ]offs?|step[- ]by[- ]step|"
    r"implement|plan)\b",
    re.I,
)


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


def _generation_options(prompt: str) -> dict[str, int]:
    word_count = len(prompt.split())
    is_complex = word_count > 35 or bool(COMPLEX_QUERY_PATTERN.search(prompt))
    if is_complex:
        num_predict = 1536
    elif word_count <= 12:
        num_predict = 256
    else:
        num_predict = 768

    estimated_prompt_tokens = math.ceil(
        (len(RESPONSE_SYSTEM_PROMPT) + len(prompt)) / 3
    )
    required_context = estimated_prompt_tokens + num_predict + 256
    num_ctx = min(
        MAX_CONTEXT_SIZE,
        max(4096, 1 << (required_context - 1).bit_length()),
    )
    return {
        "num_predict": num_predict,
        "num_ctx": num_ctx,
    }


def _duration_ms(value: object) -> float | None:
    if (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value >= 0
    ):
        return round(value / 1_000_000, 2)
    return None


def generate_response_with_metrics(
    model: str, prompt: str
) -> tuple[str, dict[str, float | None]]:
    options = _generation_options(prompt)
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "system": RESPONSE_SYSTEM_PROMPT,
                "stream": False,
                "keep_alive": MODEL_KEEP_ALIVE,
                "options": options,
            },
            timeout=OLLAMA_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        raise OllamaUnavailable from error

    try:
        payload = response.json()
        response_text = payload.get("response")
    except (AttributeError, ValueError) as error:
        raise OllamaInvalidResponse from error
    if not isinstance(response_text, str):
        raise OllamaInvalidResponse

    metrics = {
        "ollama_total_ms": _duration_ms(payload.get("total_duration")),
        "model_loading_ms": _duration_ms(payload.get("load_duration")),
        "prompt_processing_ms": _duration_ms(payload.get("prompt_eval_duration")),
        "token_generation_ms": _duration_ms(payload.get("eval_duration")),
    }
    return response_text, metrics


def generate_response(model: str, prompt: str) -> str:
    response_text, _ = generate_response_with_metrics(model, prompt)
    return response_text


def _sum_metric(
    metrics: list[dict[str, float | None]], name: str
) -> float | None:
    values = [item[name] for item in metrics]
    if any(value is None for value in values):
        return None
    return round(sum(value for value in values if value is not None), 2)


def route_query(query: str) -> dict[str, object]:
    started = time.perf_counter()
    generation_metrics = []

    # The smaller model handles the first pass quickly; only uncertain cases use more resources.
    small_response, small_metrics = generate_response_with_metrics(SMALL_MODEL, query)
    generation_metrics.append(small_metrics)
    confidence = evaluate_confidence(query, small_response)

    # A score below the configured threshold triggers a second pass on the larger model.
    if confidence < CONFIDENCE_THRESHOLD:
        response, large_metrics = generate_response_with_metrics(LARGE_MODEL, query)
        generation_metrics.append(large_metrics)
        result = {
            "response": response,
            "model": LARGE_MODEL,
            "confidence": confidence,
            "escalated": True,
        }
    else:
        result = {
            "response": small_response,
            "model": SMALL_MODEL,
            "confidence": confidence,
            "escalated": False,
        }

    ollama_total_ms = _sum_metric(generation_metrics, "ollama_total_ms")
    timing: dict[str, float | None] = {
        "total_ms": round((time.perf_counter() - started) * 1000, 2),
        "ollama_total_ms": ollama_total_ms,
        "model_loading_ms": _sum_metric(generation_metrics, "model_loading_ms"),
        "prompt_processing_ms": _sum_metric(
            generation_metrics, "prompt_processing_ms"
        ),
        "token_generation_ms": _sum_metric(
            generation_metrics, "token_generation_ms"
        ),
    }
    if ollama_total_ms is not None:
        timing["other_ms"] = round(
            max(0, timing["total_ms"] - ollama_total_ms), 2
        )
    result["timing"] = timing
    return result