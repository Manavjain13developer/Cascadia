import json
import time

from flask import Flask, Response, jsonify, request, stream_with_context

if __package__:
    from backend.core.router import (
        OllamaIncompleteResponse,
        OllamaInvalidResponse,
        OllamaModelNotFound,
        OllamaTimeout,
        OllamaUnavailable,
        route_query,
        stream_cascaded_response,
    )
else:
    from core.router import (
        OllamaIncompleteResponse,
        OllamaInvalidResponse,
        OllamaModelNotFound,
        OllamaTimeout,
        OllamaUnavailable,
        route_query,
        stream_cascaded_response,
    )


app = Flask(__name__)

@app.post("/api/query")
def query_model():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A non-empty query is required."}), 400

    query = payload.get("query")
    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "A non-empty query is required."}), 400

    try:
        result = route_query(query.strip())
    except OllamaIncompleteResponse:
        return jsonify({"error": _stream_error_message(OllamaIncompleteResponse())}), 502
    except OllamaModelNotFound:
        return jsonify({"error": _stream_error_message(OllamaModelNotFound())}), 404
    except OllamaTimeout:
        return jsonify({"error": _stream_error_message(OllamaTimeout())}), 504
    except OllamaUnavailable:
        return jsonify({"error": "Ollama is unavailable. Check that it is running locally."}), 503
    except OllamaInvalidResponse:
        return jsonify({"error": "Ollama returned an invalid response."}), 502

    return jsonify(result)


def _sse_event(name: str, payload: dict[str, object]) -> str:
    return f"event: {name}\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"


def _stream_error_message(error: Exception) -> str:
    if isinstance(error, OllamaIncompleteResponse):
        return "Ollama reached its output-token limit before completing the response. Try a shorter prompt."
    if isinstance(error, OllamaModelNotFound):
        return "The selected Ollama model is not installed. Install qwen2.5:3b and qwen2.5:7b locally."
    if isinstance(error, OllamaTimeout):
        return "Ollama timed out while generating the response. Try again."
    if isinstance(error, OllamaUnavailable):
        return "Ollama became unavailable or the response stream was interrupted. Check that it is running locally and retry."
    if isinstance(error, OllamaInvalidResponse):
        return "Ollama returned an empty or invalid streamed response."
    return "The response stream failed unexpectedly. Please retry."


@app.post("/api/query/stream")
def stream_query_model():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "A non-empty query is required."}), 400

    query = payload.get("query")
    if not isinstance(query, str) or not query.strip():
        return jsonify({"error": "A non-empty query is required."}), 400

    def generate():
        started = time.perf_counter()
        yield _sse_event("progress", {"phase": "routing"})
        cascade_stream = None
        try:
            cascade_stream = stream_cascaded_response(query.strip(), started)
            for part in cascade_stream:
                if "token" in part:
                    yield _sse_event("token", {"token": part["token"]})
                elif "buffered" in part:
                    yield _sse_event("buffered", {"text": part["buffered"]})
                elif "routing" in part:
                    yield _sse_event("routing", part["routing"])
                elif "phase" in part:
                    yield _sse_event("progress", part)
                elif "complete" in part:
                    yield _sse_event("complete", part["complete"])
        except (
            OllamaIncompleteResponse,
            OllamaModelNotFound,
            OllamaTimeout,
            OllamaUnavailable,
            OllamaInvalidResponse,
        ) as error:
            yield _sse_event("error", {"error": _stream_error_message(error)})
        except Exception:
            app.logger.exception("Unexpected error while streaming an Ollama response")
            yield _sse_event(
                "error",
                {"error": _stream_error_message(Exception())},
            )
        finally:
            close_stream = getattr(cascade_stream, "close", None)
            if callable(close_stream):
                close_stream()

    response = Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
    return response


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)