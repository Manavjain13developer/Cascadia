import unittest
from concurrent.futures import ThreadPoolExecutor
import json
import time
from unittest.mock import Mock, call, patch

from backend.app import app
from backend.core.router import (
    LARGE_MODEL,
    OLLAMA_URL,
    RESPONSE_SYSTEM_PROMPT,
    SMALL_MODEL,
    OllamaInvalidResponse,
    OllamaModelNotFound,
    OllamaTimeout,
    OllamaUnavailable,
    generate_response,
    generate_response_with_metrics,
    route_query,
    stream_response,
    stream_cascaded_response,
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
                "generated_tokens": 17,
            }),
            ("Detailed 7B response.", {
                "ollama_total_ms": 20.0,
                "model_loading_ms": 3.0,
                "prompt_processing_ms": 5.0,
                "token_generation_ms": 12.0,
                "generated_tokens": 37,
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
        self.assertEqual(result["timing"]["generated_tokens"], 37)
        self.assertEqual(result["timing"]["tokens_per_second"], 3083.33)
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
            "eval_count": 21,
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
                "generated_tokens": 21,
            },
        )
        post.assert_called_once()

    @patch("backend.core.router.requests.post")
    def test_stream_response_reads_ollama_output_token_count(self, post):
        response = Mock()
        response.iter_lines.return_value = iter([
            '{"response":"A concise answer."}',
            json.dumps({
                "done": True,
                "total_duration": 1_000_000_000,
                "load_duration": 100_000_000,
                "prompt_eval_duration": 200_000_000,
                "eval_duration": 700_000_000,
                "eval_count": 21,
            }),
        ])
        post.return_value = response

        events = list(stream_response(SMALL_MODEL, "What is 2 + 2?"))

        self.assertEqual(events[0], {"token": "A concise answer."})
        self.assertEqual(events[1]["metrics"]["generated_tokens"], 21)
        self.assertEqual(events[1]["metrics"]["token_generation_ms"], 700.0)

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

    @patch("backend.app.stream_cascaded_response")
    def test_stream_endpoint_delivers_tokens_before_completion(self, cascade):
        finished = []

        def response_events(query, started):
            yield {"phase": "routing"}
            yield {"routing": {
                "model": SMALL_MODEL,
                "confidence": 0.92,
                "escalated": False,
            }}
            yield {"token": "First "}
            yield {"token": "answer."}
            finished.append(True)
            time.sleep(0.01)
            yield {"complete": {"timing": {
                "total_ms": 15.0,
                "ollama_total_ms": 10.0,
                "model_loading_ms": 1.0,
                "prompt_processing_ms": 2.0,
                "token_generation_ms": 7.0,
                "other_ms": 5.0,
            }}}

        cascade.side_effect = response_events
        response = self.client.post(
            "/api/query/stream",
            json={"query": "What is 2 + 2?"},
            buffered=False,
        )
        events = response.response

        self.assertIn("event: progress", next(events).decode())
        self.assertIn("event: progress", next(events).decode())
        self.assertIn("event: routing", next(events).decode())
        first_token = next(events).decode()
        self.assertIn('"token":"First "', first_token)
        self.assertFalse(finished)
        remaining = b"".join(events).decode()
        self.assertIn('"token":"answer."', remaining)
        self.assertIn("event: complete", remaining)
        complete_event = next(
            frame for frame in remaining.split("\n\n") if "event: complete" in frame
        )
        timing = json.loads(complete_event.split("data:", 1)[1])["timing"]
        self.assertEqual(timing["model_loading_ms"], 1.0)
        self.assertGreaterEqual(timing["total_ms"], 15)
        cascade.assert_called_once()

    @patch("backend.app.stream_cascaded_response")
    def test_stream_endpoint_uses_escalated_model(self, cascade):
        cascade.return_value = iter([
            {"phase": "routing"},
            {"routing": {
                "model": LARGE_MODEL,
                "confidence": 0.48,
                "escalated": True,
                "response_mode": "live",
            }},
            {"token": "Escalated answer."},
            {"complete": {"timing": {
                "total_ms": 20.0,
                "ollama_total_ms": 20.0,
                "model_loading_ms": 3.0,
                "prompt_processing_ms": 5.0,
                "token_generation_ms": 12.0,
                "other_ms": 0.0,
            }}},
        ])

        response = self.client.post(
            "/api/query/stream",
            json={"query": "Analyze and compare approaches."},
        )
        body = response.get_data(as_text=True)

        self.assertIn('"model":"qwen2.5:7b","confidence":0.48,"escalated":true', body)
        self.assertIn('"token":"Escalated answer."', body)
        cascade.assert_called_once()

    @patch("backend.app.stream_cascaded_response")
    def test_stream_endpoint_labels_buffered_response_replay(self, cascade):
        cascade.return_value = iter([
            {"routing": {
                "model": SMALL_MODEL,
                "confidence": 0.92,
                "escalated": False,
                "response_mode": "buffered",
            }},
            {"buffered": "Buffered answer."},
            {"complete": {"timing": {"total_ms": 10.0}}},
        ])

        response = self.client.post(
            "/api/query/stream",
            json={"query": "What is 2 + 2?"},
        )
        body = response.get_data(as_text=True)

        self.assertIn("event: buffered", body)
        self.assertIn('"text":"Buffered answer."', body)
        self.assertNotIn("event: token", body)
        cascade.assert_called_once()

    @patch("backend.app.stream_cascaded_response", side_effect=OllamaModelNotFound)
    def test_stream_endpoint_reports_missing_model(self, cascade):
        response = self.client.post(
            "/api/query/stream",
            json={"query": "What is 2 + 2?"},
        )
        body = response.get_data(as_text=True)

        self.assertEqual(response.status_code, 200)
        self.assertIn("event: error", body)
        self.assertIn("model is not installed", body)
        cascade.assert_called_once()

    @patch("backend.app.stream_cascaded_response", side_effect=OllamaTimeout)
    def test_stream_endpoint_reports_timeout(self, cascade):
        response = self.client.post(
            "/api/query/stream",
            json={"query": "What is 2 + 2?"},
        )
        body = response.get_data(as_text=True)

        self.assertEqual(response.status_code, 200)
        self.assertIn("event: error", body)
        self.assertIn("timed out", body)
        cascade.assert_called_once()

    @patch("backend.app.stream_cascaded_response")
    def test_stream_interruption_emits_error_after_partial_tokens(self, cascade):
        def interrupted_events(query, started):
            yield {"routing": {
                "model": SMALL_MODEL,
                "confidence": 0.92,
                "escalated": False,
            }}
            yield {"token": "Partial"}
            raise OllamaUnavailable

        cascade.side_effect = interrupted_events
        response = self.client.post(
            "/api/query/stream",
            json={"query": "What is 2 + 2?"},
        )
        body = response.get_data(as_text=True)

        self.assertIn('"token":"Partial"', body)
        self.assertIn("event: error", body)
        self.assertIn("interrupted", body)

    @patch("backend.core.router.stream_response")
    def test_cascade_stream_selects_small_model_without_escalation(self, stream):
        metrics = {
            "ollama_total_ms": 10.0,
            "model_loading_ms": 1.0,
            "prompt_processing_ms": 2.0,
            "token_generation_ms": 7.0,
            "generated_tokens": 21,
        }
        stream.side_effect = [
            iter([
                {"token": "A concise "},
                {"token": "answer."},
                {"metrics": metrics},
            ]),
        ]

        events = list(stream_cascaded_response("What is 2 + 2?", time.perf_counter()))

        self.assertIn(
            {"routing": {
                "model": SMALL_MODEL,
                "confidence": 0.92,
                "escalated": False,
                "response_mode": "buffered",
            }},
            events,
        )
        self.assertEqual(
            [event["buffered"] for event in events if "buffered" in event],
            ["A concise ", "answer."],
        )
        stream.assert_called_once_with(SMALL_MODEL, "What is 2 + 2?")
        timing = next(
            event["complete"]["timing"] for event in events if "complete" in event
        )
        self.assertEqual(timing["ollama_total_ms"], 10.0)
        self.assertEqual(timing["generated_tokens"], 21)
        self.assertEqual(timing["tokens_per_second"], 3000.0)
        self.assertIsInstance(timing["time_to_first_token_ms"], float)
        self.assertEqual(len([event for event in events if "buffered" in event]), 2)

    @patch("backend.core.router.stream_response")
    def test_cascade_stream_escalates_to_large_model(self, stream):
        metrics = {
            "ollama_total_ms": 10.0,
            "model_loading_ms": 1.0,
            "prompt_processing_ms": 2.0,
            "token_generation_ms": 7.0,
            "generated_tokens": 21,
        }
        stream.side_effect = [
            iter([{"token": "Initial analysis."}, {"metrics": metrics}]),
            iter([{"token": "Large model answer."}, {"metrics": metrics}]),
        ]

        events = list(stream_cascaded_response(
            "Analyze and compare approaches with trade-offs.", time.perf_counter()
        ))

        self.assertIn(
            {"routing": {
                "model": LARGE_MODEL,
                "confidence": 0.48,
                "escalated": True,
                "response_mode": "live",
            }},
            events,
        )
        self.assertEqual(
            [event["token"] for event in events if "token" in event],
            ["Large model answer."],
        )
        self.assertEqual(
            [call.args[0] for call in stream.call_args_list],
            [SMALL_MODEL, LARGE_MODEL],
        )
        timing = next(
            event["complete"]["timing"] for event in events if "complete" in event
        )
        self.assertEqual(timing["ollama_total_ms"], 20.0)

    @patch("backend.core.router.requests.post")
    def test_closing_stream_closes_ollama_generation(self, post):
        response = Mock()
        response.iter_lines.return_value = iter([
            '{"response":"First token"}',
            '{"response":"Second token"}',
        ])
        post.return_value = response
        generator = stream_response(SMALL_MODEL, "What is 2 + 2?")

        self.assertEqual(next(generator), {"token": "First token"})
        generator.close()

        response.close.assert_called_once()
        self.assertTrue(post.call_args.kwargs["stream"])

    @patch("backend.core.router.requests.post")
    def test_closing_sse_response_cancels_preflight_ollama_stream(self, post):
        ollama_response = Mock()
        ollama_response.iter_lines.return_value = iter([
            '{"response":"First candidate token"}',
            '{"response":"Second candidate token"}',
        ])
        post.return_value = ollama_response

        response = self.client.post(
            "/api/query/stream",
            json={"query": "What is 2 + 2?"},
            buffered=False,
        )
        events = response.response
        self.assertIn("event: progress", next(events).decode())
        self.assertIn("event: progress", next(events).decode())
        self.assertTrue(post.call_args.kwargs["stream"])

        response.close()

        ollama_response.close.assert_called_once()

    @patch("backend.app.stream_cascaded_response")
    def test_concurrent_streams_do_not_mix_tokens(self, cascade):
        def response_events(query, started):
            yield {"routing": {
                "model": SMALL_MODEL,
                "confidence": 0.92,
                "escalated": False,
            }}
            yield {"token": query}
            yield {"complete": {"timing": {
                "total_ms": 20.0,
                "ollama_total_ms": 10.0,
                "model_loading_ms": 1.0,
                "prompt_processing_ms": 2.0,
                "token_generation_ms": 7.0,
                "other_ms": 10.0,
            }}}

        cascade.side_effect = response_events

        def request(query):
            with app.test_client() as client:
                return client.post(
                    "/api/query/stream",
                    json={"query": query},
                ).get_data(as_text=True)

        queries = ["first request", "second request"]
        with ThreadPoolExecutor(max_workers=2) as executor:
            bodies = list(executor.map(request, queries))

        for query, body in zip(queries, bodies):
            self.assertIn(json.dumps({"token": query}, separators=(",", ":")), body)
            self.assertNotIn(
                json.dumps(
                    {"token": queries[1] if query == queries[0] else queries[0]},
                    separators=(",", ":"),
                ),
                body,
            )
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