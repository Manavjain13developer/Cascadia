import argparse
import json
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BENCHMARK_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BENCHMARK_DIR.parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app


DATASETS = (
    ("simple", "simple_queries.json"),
    ("medium", "medium_queries.json"),
    ("complex", "complex_queries.json"),
)
SMALL_MODEL = "qwen2.5:3b"
LARGE_MODEL = "qwen2.5:7b"


def load_queries(
    limit_per_category: int | None = None, category_filter: str | None = None
) -> list[dict[str, Any]]:
    queries = []
    for category, filename in DATASETS:
        if category_filter and category != category_filter:
            continue
        dataset = json.loads((BENCHMARK_DIR / filename).read_text(encoding="utf-8"))
        if limit_per_category is not None:
            dataset = dataset[:limit_per_category]
        queries.extend({**item, "category": category} for item in dataset)
    return queries


def run_query(client, item: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        response = client.post("/api/query", json={"query": item["query"]})
        elapsed = round(time.perf_counter() - started, 3)
        payload = response.get_json(silent=True) or {}
        if response.status_code >= 400:
            return {
                **item,
                "status": "error",
                "error": payload.get("error", f"Request failed with HTTP {response.status_code}"),
                "response_time_seconds": elapsed,
            }

        required_fields = (
            "response",
            "model",
            "confidence",
            "escalated",
            "timing",
        )
        missing_fields = [field for field in required_fields if field not in payload]
        if missing_fields:
            raise ValueError(f"API response is missing fields: {', '.join(missing_fields)}")

        return {
            **item,
            "status": "success",
            "model": payload["model"],
            "confidence": payload["confidence"],
            "escalated": payload["escalated"],
            "timing": payload.get("timing"),
            "response_time_seconds": elapsed,
        }
    except Exception as error:
        return {
            **item,
            "status": "error",
            "error": str(error),
            "response_time_seconds": round(time.perf_counter() - started, 3),
        }


def _average(values: list[float]) -> float:
    return round(sum(values) / len(values), 3) if values else 0.0


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    successful = [result for result in results if result["status"] == "success"]
    failed_count = len(results) - len(successful)
    model_counts = Counter(result["model"] for result in successful)
    category_counts = Counter(result["category"] for result in results)
    successful_times = [result["response_time_seconds"] for result in successful]
    escalated_count = sum(bool(result["escalated"]) for result in successful)
    success_count = len(successful)
    timing_metrics = (
        "ollama_total_ms",
        "model_loading_ms",
        "prompt_processing_ms",
        "token_generation_ms",
        "other_ms",
    )

    return {
        "successful_queries": success_count,
        "failed_queries": failed_count,
        "category_counts": dict(category_counts),
        "3b_count": model_counts[SMALL_MODEL],
        "7b_count": model_counts[LARGE_MODEL],
        "3b_percentage": round(model_counts[SMALL_MODEL] / success_count * 100, 2)
        if success_count
        else 0.0,
        "7b_percentage": round(model_counts[LARGE_MODEL] / success_count * 100, 2)
        if success_count
        else 0.0,
        "escalated_queries": escalated_count,
        "escalation_rate": round(escalated_count / success_count * 100, 2)
        if success_count
        else 0.0,
        "average_response_time": _average(successful_times),
        "average_timing_seconds": {
            metric: _average(
                [
                    result["timing"][metric] / 1000
                    for result in successful
                    if isinstance(result.get("timing"), dict)
                    and isinstance(result["timing"].get(metric), (int, float))
                ]
            )
            for metric in timing_metrics
        },
        "average_generation_metrics": {
            metric: _average(
                [
                    result["timing"][metric]
                    for result in successful
                    if isinstance(result.get("timing"), dict)
                    and isinstance(result["timing"].get(metric), (int, float))
                ]
            )
            for metric in ("generated_tokens", "tokens_per_second")
        },
        "category_average_response_time": {
            category: _average(
                [
                    result["response_time_seconds"]
                    for result in successful
                    if result["category"] == category
                ]
            )
            for category, _ in DATASETS
        },
        "model_usage_by_category": {
            category: {
                "3b": sum(
                    result["category"] == category and result["model"] == SMALL_MODEL
                    for result in successful
                ),
                "7b": sum(
                    result["category"] == category and result["model"] == LARGE_MODEL
                    for result in successful
                ),
            }
            for category, _ in DATASETS
        },
    }


def print_summary(results: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    categories = summary["category_counts"]
    category_averages = summary["category_average_response_time"]
    usage = summary["model_usage_by_category"]
    print("\n========================================")
    print("        CASCADIA BENCHMARK")
    print("========================================")
    print(f"\nTotal Queries: {len(results)}")
    print(f"Successful Queries: {summary['successful_queries']}")
    print(f"Failed Queries: {summary['failed_queries']}")
    print(f"\nSimple:   {categories.get('simple', 0)}")
    print(f"Medium:   {categories.get('medium', 0)}")
    print(f"Complex:  {categories.get('complex', 0)}")
    print("\n----------------------------------------")
    print("MODEL USAGE")
    print("----------------------------------------")
    print(f"{SMALL_MODEL} -> {summary['3b_count']} queries")
    print(f"{LARGE_MODEL} -> {summary['7b_count']} queries")
    print(f"\n3B Usage: {summary['3b_percentage']:.2f}%")
    print(f"7B Usage: {summary['7b_percentage']:.2f}%")
    print("\n----------------------------------------")
    print("ESCALATION")
    print("----------------------------------------")
    print(f"Escalated Queries: {summary['escalated_queries']}")
    print(f"Escalation Rate: {summary['escalation_rate']:.2f}%")
    print("\n----------------------------------------")
    print("RESPONSE TIME")
    print("----------------------------------------")
    print(f"Average Response Time: {summary['average_response_time']:.3f} sec")
    print("\nAverage timing breakdown:")
    for metric, average in summary["average_timing_seconds"].items():
        print(f"  {metric.replace('_', ' ').title()}: {average:.3f} sec")
    print("\nAverage generation metrics:")
    print(
        f"  Generated Tokens: "
        f"{summary['average_generation_metrics']['generated_tokens']:.2f}"
    )
    print(
        f"  Tokens Per Second: "
        f"{summary['average_generation_metrics']['tokens_per_second']:.2f}"
    )
    for category in ("simple", "medium", "complex"):
        print(f"{category.title()} Average: {category_averages[category]:.3f} sec")
    print("\nMODEL USAGE BY CATEGORY")
    for category in ("simple", "medium", "complex"):
        print(f"\n{category.title()}:")
        print(f"  3B: {usage[category]['3b']}")
        print(f"  7B: {usage[category]['7b']}")
    print("\n========================================")


def save_results(results: list[dict[str, Any]]) -> None:
    summary = summarize(results)
    output = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_queries": len(results),
        "summary": summary,
        "results": results,
    }
    output_path = BENCHMARK_DIR / "results.json"
    temporary_path = output_path.with_suffix(".json.tmp")
    temporary_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark Cascadia's local routing API.")
    parser.add_argument(
        "--limit-per-category",
        type=int,
        help="Run only the first N queries in each category (for a smoke test).",
    )
    parser.add_argument(
        "--category",
        choices=[category for category, _ in DATASETS],
        help="Run one category only; useful for sequential batches.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Keep matching completed records already present in results.json.",
    )
    args = parser.parse_args()
    if args.limit_per_category is not None and args.limit_per_category < 1:
        parser.error("--limit-per-category must be at least 1")

    all_queries = load_queries()
    queries = load_queries(args.limit_per_category, args.category)
    existing_results = []
    output_path = BENCHMARK_DIR / "results.json"
    if args.resume and output_path.exists():
        try:
            previous = json.loads(output_path.read_text(encoding="utf-8"))
            expected_queries = {
                (item["category"], item["id"]): item["query"]
                for item in all_queries
            }
            existing_results = [
                item
                for item in previous.get("results", [])
                if (item.get("category"), item.get("id")) in expected_queries
                and item.get("query")
                == expected_queries[(item.get("category"), item.get("id"))]
                and item.get("status") in ("success", "error")
            ]
        except (OSError, json.JSONDecodeError, AttributeError, TypeError):
            existing_results = []

    results_by_key = {
        (item["category"], item["id"]): item for item in existing_results
    }
    results = list(results_by_key.values())
    client = app.test_client()
    for index, item in enumerate(queries, start=1):
        key = (item["category"], item["id"])
        if key in results_by_key:
            print(f"[{index}/{len(queries)}] {item['category']} #{item['id']}: resumed")
            continue
        result = run_query(client, item)
        results.append(result)
        results_by_key[key] = result
        save_results(results)
        if result["status"] == "success":
            print(
                f"[{index}/{len(queries)}] {item['category']} #{item['id']}: "
                f"{result['model']} confidence={result['confidence']} "
                f"escalated={result['escalated']} "
                f"time={result['response_time_seconds']:.3f}s",
                flush=True,
            )
        else:
            print(
                f"[{index}/{len(queries)}] {item['category']} #{item['id']}: "
                f"FAILED: {result['error']} "
                f"time={result['response_time_seconds']:.3f}s",
                flush=True,
            )

    save_results(results)
    summary = summarize(results)
    print_summary(results, summary)
    print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()