import json
import math
import os
import re
import time
from collections.abc import Iterator

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


class OllamaModelNotFound(Exception):
    """Ollama does not have the requested model installed."""


class OllamaTimeout(Exception):
    """Ollama did not complete a request before the configured timeout."""


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
        _raise_ollama_request_error(error)

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


def _raise_ollama_request_error(error: requests.RequestException) -> None:
    if isinstance(error, requests.Timeout):
        raise OllamaTimeout from error
    response = error.response
    if response is not None and response.status_code == 404:
        try:
            payload = response.json()
            detail = payload.get("error", "") if isinstance(payload, dict) else ""
        except (AttributeError, ValueError):
            detail = ""
        if (
            isinstance(detail, str)
            and "model" in detail.lower()
            and "not found" in detail.lower()
        ):
            raise OllamaModelNotFound from error
    raise OllamaUnavailable from error


def stream_response(model: str, prompt: str) -> Iterator[dict[str, object]]:
    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "system": RESPONSE_SYSTEM_PROMPT,
                "stream": True,
                "keep_alive": MODEL_KEEP_ALIVE,
                "options": _generation_options(prompt),
            },
            timeout=OLLAMA_TIMEOUT,
            stream=True,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        _raise_ollama_request_error(error)

    text_received = False
    completed = False
    try:
        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue
            if isinstance(line, bytes):
                line = line.decode("utf-8")
            try:
                payload = json.loads(line)
            except (TypeError, ValueError) as error:
                raise OllamaInvalidResponse from error
            if not isinstance(payload, dict):
                raise OllamaInvalidResponse
            if payload.get("error"):
                message = str(payload["error"])
                if "model" in message.lower() and "not found" in message.lower():
                    raise OllamaModelNotFound(message)
                raise OllamaUnavailable(message)

            token = payload.get("response")
            if token is not None:
                if not isinstance(token, str):
                    raise OllamaInvalidResponse
                if token:
                    text_received = True
                    yield {"token": token}

            if payload.get("done") is True:
                completed = True
                if not text_received:
                    raise OllamaInvalidResponse
                yield {
                    "metrics": {
                        "ollama_total_ms": _duration_ms(payload.get("total_duration")),
                        "model_loading_ms": _duration_ms(payload.get("load_duration")),
                        "prompt_processing_ms": _duration_ms(
                            payload.get("prompt_eval_duration")
                        ),
                        "token_generation_ms": _duration_ms(
                            payload.get("eval_duration")
                        ),
                    }
                }
                break

        if not completed:
            raise OllamaInvalidResponse
    except requests.RequestException as error:
        _raise_ollama_request_error(error)
    finally:
        response.close()


def stream_cascaded_response(
    query: str, started: float
) -> Iterator[dict[str, object]]:
    generation_metrics: list[dict[str, float | None]] = []
    small_response_parts = []
    preflight_stream = stream_response(SMALL_MODEL, query)
    try:
        for part in preflight_stream:
            if "token" in part:
                small_response_parts.append(part["token"])
                yield {"phase": "routing"}
            elif "metrics" in part:
                generation_metrics.append(part["metrics"])
    finally:
        close_stream = getattr(preflight_stream, "close", None)
        if callable(close_stream):
            close_stream()

    confidence = evaluate_confidence(query, "".join(small_response_parts))
    escalated = confidence < CONFIDENCE_THRESHOLD
    model = LARGE_MODEL if escalated else SMALL_MODEL
    yield {
        "routing": {
            "model": model,
            "confidence": confidence,
            "escalated": escalated,
        }
    }

    answer_stream = stream_response(model, query)
    try:
        for part in answer_stream:
            if "token" in part:
                yield part
            elif "metrics" in part:
                generation_metrics.append(part["metrics"])
    finally:
        close_stream = getattr(answer_stream, "close", None)
        if callable(close_stream):
            close_stream()

    yield {"complete": {"timing": build_timing(started, generation_metrics)}}


def _sum_metric(
    metrics: list[dict[str, float | None]], name: str
) -> float | None:
    values = [item[name] for item in metrics]
    if any(value is None for value in values):
        return None
    return round(sum(value for value in values if value is not None), 2)


def build_timing(
    started: float, generation_metrics: list[dict[str, float | None]]
) -> dict[str, float | None]:
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
    return timing


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

    result["timing"] = build_timing(started, generation_metrics)
    return result