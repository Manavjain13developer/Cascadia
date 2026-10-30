from flask import Flask, jsonify, request

if __package__:
    from backend.core.router import (
        OllamaInvalidResponse,
        OllamaUnavailable,
        route_query,
    )
else:
    from core.router import OllamaInvalidResponse, OllamaUnavailable, route_query


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
    except OllamaUnavailable:
        return jsonify({"error": "Ollama is unavailable. Check that it is running locally."}), 503
    except OllamaInvalidResponse:
        return jsonify({"error": "Ollama returned an invalid response."}), 502

    return jsonify(result)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)