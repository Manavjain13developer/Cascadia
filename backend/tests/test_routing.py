import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock, call, patch

from backend.app import app
from backend.core.router import (
    LARGE_MODEL,
    OLLAMA_URL,
    RESPONSE_SYSTEM_PROMPT,
    SMALL_MODEL,
    OllamaUnavailable,
    generate_response,
    generate_response_with_metrics,
    route_query,
)


class RoutingApiTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    @patch(
        "backend.core.router.generate_response_with_metrics",
        return_value=("2 + 2 is 4.", {
            "ollama_total_ms": 10.0,
            "model_loading_ms": 1.0,
            "prompt_processing_ms": 2.0,
            "token_generation_ms": 7.0,
        }),
    )
    def test_simple_query_stays_on_small_model(self, generate_response):
        response = self.client.post("/api/query", json={"query": "What is 2 + 2?"})

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["response"], "2 + 2 is 4.")
        self.assertEqual(result["model"], "qwen2.5:3b")
        self.assertEqual(result["confidence"], 0.92)
        self.assertFalse(result["escalated"])
        self.assertGreaterEqual(result["timing"]["total_ms"], 0)
        self.assertEqual(result["timing"]["model_loading_ms"], 1.0)
        generate_response.assert_called_once_with("qwen2.5:3b", "What is 2 + 2?")

    @patch(
        "backend.core.router.generate_response_with_metrics",
        side_effect=[
            ("Initial analysis.", {
                "ollama_total_ms": 10.0,
                "model_loading_ms": 1.0,
                "prompt_processing_ms": 2.0,
                "token_generation_ms": 7.0,
            }),
            ("Detailed 7B response.", {
                "ollama_total_ms": 20.0,
                "model_loading_ms": 3.0,
                "prompt_processing_ms": 5.0,
                "token_generation_ms": 12.0,
            }),
        ],
    )
    def test_complex_query_escalates_to_large_model(self, generate_response):
        query = "Analyze and compare two approaches, then derive their trade-offs."
        response = self.client.post("/api/query", json={"query": query})

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["response"], "Detailed 7B response.")
        self.assertEqual(result["model"], "qwen2.5:7b")
        self.assertEqual(result["confidence"], 0.48)
        self.assertTrue(result["escalated"])
        self.assertEqual(result["timing"]["model_loading_ms"], 4.0)
        self.assertEqual(result["timing"]["prompt_processing_ms"], 7.0)
        self.assertEqual(result["timing"]["token_generation_ms"], 19.0)
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
                        "keep_alive": "10m",
                        "options": {
                            "num_predict": 256,
                            "num_ctx": 4096,
                        },
                    },
                    timeout=300,
                )

    @patch("backend.core.router.requests.post")
    def test_generation_metrics_are_read_from_ollama_response(self, post):
        response = Mock()
        response.json.return_value = {
            "response": "A concise answer.",
            "total_duration": 1_000_000_000,
            "load_duration": 100_000_000,
            "prompt_eval_duration": 200_000_000,
            "eval_duration": 700_000_000,
        }
        post.return_value = response

        text, metrics = generate_response_with_metrics(
            SMALL_MODEL, "What is 2 + 2?"
        )

        self.assertEqual(text, "A concise answer.")
        self.assertEqual(
            metrics,
            {
                "ollama_total_ms": 1000.0,
                "model_loading_ms": 100.0,
                "prompt_processing_ms": 200.0,
                "token_generation_ms": 700.0,
            },
        )
        post.assert_called_once()

    @patch("backend.core.router.requests.post")
    def test_complex_prompt_gets_a_larger_generation_budget(self, post):
        response = Mock()
        response.json.return_value = {"response": "A detailed answer."}
        post.return_value = response

        generate_response(
            LARGE_MODEL,
            "Design and compare a scalable architecture with multiple trade-offs.",
        )

        self.assertEqual(
            post.call_args.kwargs["json"]["options"],
            {"num_predict": 1536, "num_ctx": 4096},
        )

    @patch(
        "backend.core.router.generate_response_with_metrics",
        return_value=("A concise answer.", {
            "ollama_total_ms": 10.0,
            "model_loading_ms": 1.0,
            "prompt_processing_ms": 2.0,
            "token_generation_ms": 7.0,
        }),
    )
    def test_concurrent_queries_keep_per_request_state_isolated(self, generate_response):
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(
                executor.map(
                    route_query,
                    ["What is 2 + 2?", "What is the capital of France?"],
                )
            )

        self.assertEqual([result["response"] for result in results], [
            "A concise answer.",
            "A concise answer.",
        ])
        self.assertEqual(generate_response.call_count, 2)
        self.assertTrue(all(result["timing"]["total_ms"] >= 0 for result in results))

    @patch("backend.core.router.generate_response_with_metrics")
    def test_empty_query_is_rejected_without_calling_ollama(self, generate_response):
        response = self.client.post("/api/query", json={"query": "  "})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "A non-empty query is required."})
        generate_response.assert_not_called()

    @patch("backend.core.router.generate_response_with_metrics")
    def test_non_object_json_payload_is_rejected_without_calling_ollama(
        self, generate_response
    ):
        response = self.client.post("/api/query", json=["not", "a", "dict"])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "A non-empty query is required."})
        generate_response.assert_not_called()

    @patch(
        "backend.core.router.generate_response_with_metrics",
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