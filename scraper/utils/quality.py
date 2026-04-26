"""Quality scoring functions for various content source types."""

from __future__ import annotations

# Multipliers applied to base paper scores based on study type
_PAPER_TYPE_MULTIPLIERS = {
    "meta_analysis": 2.0,
    "review": 1.5,
    "position_stand": 1.8,
    "rct": 1.3,
    "research_paper": 1.0,
    "case_study": 0.7,
}


def score_paper(citations: int = 0, year: int = 2024, paper_type: str = "research_paper") -> float:
    """Score an academic paper.

    Formula: (citations / age_years) * 10 * type_multiplier
    Age is computed relative to 2026.
    """
    age = max(2026 - year, 1)
    multiplier = _PAPER_TYPE_MULTIPLIERS.get(paper_type, 1.0)
    return (citations / age) * 10 * multiplier


def score_youtube(views: int = 0, likes: int = 0, duration_sec: int = 0) -> float:
    """Score a YouTube video.

    Formula: like_ratio * (views / 10_000) * duration_score, capped at 100.
    - like_ratio = likes / views (0 if no views)
    - duration_score: <300s -> 1, <600s -> 2, <1800s -> 3, else -> 4
    """
    if views == 0:
        return 0.0

    like_ratio = likes / views

    if duration_sec < 300:
        duration_score = 1
    elif duration_sec < 600:
        duration_score = 2
    elif duration_sec < 1800:
        duration_score = 3
    else:
        duration_score = 4

    score = like_ratio * (views / 10_000) * duration_score
    return min(score, 100.0)


def score_reddit(upvotes: int = 0, num_comments: int = 0) -> float:
    """Score a Reddit post.

    Formula: upvotes * 0.5 + num_comments * 1.0
    """
    return upvotes * 0.5 + num_comments * 1.0


def score_article(word_count: int = 0) -> float:
    """Score an article by word count.

    Tiers: <500 -> 1, <1500 -> 3, <5000 -> 5, else -> 7
    """
    if word_count < 500:
        return 1
    elif word_count < 1500:
        return 3
    elif word_count < 5000:
        return 5
    else:
        return 7


def score_podcast(duration_sec: int = 0) -> float:
    """Score a podcast episode by duration.

    Tiers (in minutes): <15 -> 2, <90 -> 5, else -> 4
    """
    minutes = duration_sec / 60
    if minutes < 15:
        return 2
    elif minutes < 90:
        return 5
    else:
        return 4
