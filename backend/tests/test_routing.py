import unittest
from unittest.mock import Mock, call, patch

from backend.app import app
from backend.core.router import (
    LARGE_MODEL,
    OLLAMA_URL,
    RESPONSE_SYSTEM_PROMPT,
    SMALL_MODEL,
    OllamaUnavailable,
    generate_response,
)


class RoutingApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    @patch("backend.core.router.generate_response", return_value="2 + 2 is 4.")
    def test_simple_query_stays_on_small_model(self, generate_response):
        response = self.client.post("/api/query", json={"query": "What is 2 + 2?"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {
                "response": "2 + 2 is 4.",
                "model": "qwen2.5:3b",
                "confidence": 0.92,
                "escalated": False,
            },
        )
        generate_response.assert_called_once_with("qwen2.5:3b", "What is 2 + 2?")

    @patch(
        "backend.core.router.generate_response",
        side_effect=["Initial analysis.", "Detailed 7B response."],
    )
    def test_complex_query_escalates_to_large_model(self, generate_response):
        query = "Analyze and compare two approaches, then derive their trade-offs."
        response = self.client.post("/api/query", json={"query": query})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {
                "response": "Detailed 7B response.",
                "model": "qwen2.5:7b",
                "confidence": 0.48,
                "escalated": True,
            },
        )
        self.assertEqual(
            generate_response.call_args_list,
            [
                call("qwen2.5:3b", query),
                call("qwen2.5:7b", query),
            ],
        )

    @patch("backend.core.router.requests.post")
    def test_generate_response_uses_formatting_system_prompt(self, post):
        response = Mock()
        response.json.return_value = {"response": "A concise answer."}
        post.return_value = response

        for model in (SMALL_MODEL, LARGE_MODEL):
            with self.subTest(model=model):
                self.assertEqual(
                    generate_response(model, "Explain binary search in Java"),
                    "A concise answer.",
                )
                post.assert_called_with(
                    OLLAMA_URL,
                    json={
                        "model": model,
                        "prompt": "Explain binary search in Java",
                        "system": RESPONSE_SYSTEM_PROMPT,
                        "stream": False,
                    },
                    timeout=300,
                )

    @patch("backend.core.router.generate_response")
    def test_empty_query_is_rejected_without_calling_ollama(self, generate_response):
        response = self.client.post("/api/query", json={"query": "  "})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "A non-empty query is required."})
        generate_response.assert_not_called()

    @patch("backend.core.router.generate_response")
    def test_non_object_json_payload_is_rejected_without_calling_ollama(
        self, generate_response
    ):
        response = self.client.post("/api/query", json=["not", "a", "dict"])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "A non-empty query is required."})
        generate_response.assert_not_called()

    @patch(
        "backend.core.router.generate_response",
        side_effect=OllamaUnavailable,
    )
    def test_ollama_unavailable_returns_service_error(self, generate_response):
        response = self.client.post("/api/query", json={"query": "hello"})

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.get_json(),
            {"error": "Ollama is unavailable. Check that it is running locally."},
        )
        generate_response.assert_called_once_with("qwen2.5:3b", "hello")


if __name__ == "__main__":
    unittest.main()