import re


COMPLEXITY_PATTERNS = (
    re.compile(r"\b(analy[sz]e|compare|contrast|derive|evaluate|prove)\b", re.I),
    re.compile(r"\b(step[- ]by[- ]step|multiple constraints|trade[- ]offs?)\b", re.I),
    re.compile(r"\b(architecture|optimization|optimize|algorithmic complexity)\b", re.I),
)
UNCERTAINTY_PHRASES = (
    "i don't know",
    "i am not sure",
    "i'm not sure",
    "cannot determine",
    "unable to determine",
    "i cannot answer",
    "i can't answer",
)


def evaluate_confidence(query: str, response: str) -> float:
    """Estimate confidence deterministically from prompt complexity and answer signals.

    This first-version heuristic is intentionally transparent, not calibrated:
    it starts at 0.92 for a non-empty answer, subtracts for explicit complexity
    cues or long prompts, and lowers the score further when the answer signals
    uncertainty. Replace this function when a stronger evaluator is available.
    """
    answer = response.strip().lower()
    if not answer:
        return 0.0

    score = 0.92
    prompt = query.strip()
    complexity_cues = sum(
        bool(pattern.search(prompt)) for pattern in COMPLEXITY_PATTERNS
    )
    score -= min(0.66, complexity_cues * 0.22)

    word_count = len(prompt.split())
    if word_count > 35:
        score -= 0.12
    if word_count > 70:
        score -= 0.15
    if any(phrase in answer for phrase in UNCERTAINTY_PHRASES):
        score -= 0.35

    return round(max(0.0, min(1.0, score)), 2)