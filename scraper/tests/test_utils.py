"""Tests for scraper utility modules: dedup, classifier, rate_limiter, quality."""

from __future__ import annotations

import time
import pytest


# ---------------------------------------------------------------------------
# dedup tests
# ---------------------------------------------------------------------------

class TestDedup:
    def test_content_hash_is_deterministic(self):
        from scraper.utils.dedup import content_hash
        assert content_hash("hello world") == content_hash("hello world")

    def test_content_hash_different_inputs(self):
        from scraper.utils.dedup import content_hash
        assert content_hash("foo") != content_hash("bar")

    def test_content_hash_returns_hex_string(self):
        from scraper.utils.dedup import content_hash
        h = content_hash("test")
        assert isinstance(h, str)
        assert len(h) == 64  # SHA-256 hex digest is 64 chars

    def test_doi_hash_prefix(self):
        from scraper.utils.dedup import doi_hash
        result = doi_hash("10.1000/XYZ123")
        assert result.startswith("doi:")

    def test_doi_hash_lowercases_and_strips(self):
        from scraper.utils.dedup import doi_hash
        assert doi_hash("  10.1000/XYZ  ") == doi_hash("10.1000/xyz")

    def test_doi_hash_format(self):
        from scraper.utils.dedup import doi_hash
        assert doi_hash("10.1000/xyz") == "doi:10.1000/xyz"

    def test_url_hash_prefix(self):
        from scraper.utils.dedup import url_hash
        result = url_hash("https://example.com/paper")
        assert result.startswith("url:")

    def test_url_hash_deterministic(self):
        from scraper.utils.dedup import url_hash
        url = "https://example.com/paper"
        assert url_hash(url) == url_hash(url)

    def test_url_hash_different_inputs(self):
        from scraper.utils.dedup import url_hash
        assert url_hash("https://a.com") != url_hash("https://b.com")

    def test_title_author_hash_prefix(self):
        from scraper.utils.dedup import title_author_hash
        result = title_author_hash("Some Title", "Some Author")
        assert result.startswith("ta:")

    def test_title_author_hash_deterministic(self):
        from scraper.utils.dedup import title_author_hash
        assert title_author_hash("Title", "Author") == title_author_hash("Title", "Author")

    def test_title_author_hash_case_insensitive(self):
        from scraper.utils.dedup import title_author_hash
        assert title_author_hash("TITLE", "AUTHOR") == title_author_hash("title", "author")

    def test_title_author_hash_different_inputs(self):
        from scraper.utils.dedup import title_author_hash
        assert title_author_hash("Title A", "Author A") != title_author_hash("Title B", "Author B")


# ---------------------------------------------------------------------------
# classifier tests
# ---------------------------------------------------------------------------

class TestClassifier:
    def test_classify_hypertrophy(self):
        from scraper.utils.classifier import classify
        text = "resistance training and progressive overload leads to muscle hypertrophy"
        assert classify(text) == "hypertrophy"

    def test_classify_nutrition(self):
        from scraper.utils.classifier import classify
        text = "protein intake and caloric deficit are key macronutrient considerations for cutting"
        assert classify(text) == "nutrition"

    def test_classify_supplements(self):
        from scraper.utils.classifier import classify
        text = "creatine and caffeine are popular ergogenic supplements for pre-workout use"
        assert classify(text) == "supplements"

    def test_classify_peptides(self):
        from scraper.utils.classifier import classify
        text = "BPC-157 and TB-500 are peptides used for tissue repair and growth hormone secretagogue effects"
        assert classify(text) == "peptides"

    def test_classify_endurance(self):
        from scraper.utils.classifier import classify
        text = "VO2max and lactate threshold are critical for marathon and triathlon endurance training"
        assert classify(text) == "endurance"

    def test_classify_recovery(self):
        from scraper.utils.classifier import classify
        text = "sleep and HRV heart rate variability monitoring help prevent overtraining and manage cortisol"
        assert classify(text) == "recovery"

    def test_classify_body_composition(self):
        from scraper.utils.classifier import classify
        text = "DEXA scan measures body fat and lean mass body composition accurately"
        assert classify(text) == "body_composition"

    def test_classify_injury_prevention(self):
        from scraper.utils.classifier import classify
        text = "tendinopathy rehabilitation and rotator cuff injury prevention prehab mobility"
        assert classify(text) == "injury_prevention"

    def test_classify_returns_best_match(self):
        from scraper.utils.classifier import classify
        # Text strongly about endurance - should pick endurance not hypertrophy
        text = "zone 2 training and polarized training improve aerobic capacity for triathlon ironman"
        result = classify(text)
        assert result == "endurance"

    def test_classify_default_fallback(self):
        from scraper.utils.classifier import classify
        # Completely unrelated text - should fall back to hypertrophy
        result = classify("the quick brown fox jumps over the lazy dog")
        assert result == "hypertrophy"

    def test_get_subcategories_supplements(self):
        from scraper.utils.classifier import get_subcategories
        text = "creatine monohydrate is one of the best studied supplements along with caffeine"
        subs = get_subcategories(text, "supplements")
        assert isinstance(subs, list)
        assert len(subs) > 0

    def test_get_subcategories_returns_list(self):
        from scraper.utils.classifier import get_subcategories
        result = get_subcategories("some text", "hypertrophy")
        assert isinstance(result, list)

    def test_get_subcategories_empty_for_unknown_category(self):
        from scraper.utils.classifier import get_subcategories
        result = get_subcategories("some text", "nonexistent_category")
        assert result == []

    def test_category_keywords_exists(self):
        from scraper.utils.classifier import CATEGORY_KEYWORDS
        expected_categories = {
            "hypertrophy", "nutrition", "supplements", "peptides",
            "endurance", "recovery", "body_composition", "injury_prevention"
        }
        assert set(CATEGORY_KEYWORDS.keys()) == expected_categories


# ---------------------------------------------------------------------------
# rate_limiter tests
# ---------------------------------------------------------------------------

class TestRateLimiter:
    def test_rate_limiter_enforces_delay(self):
        from scraper.utils.rate_limiter import RateLimiter
        limiter = RateLimiter("test_source", requests_per_second=10)
        limiter.wait()  # first call - no sleep
        start = time.time()
        limiter.wait()  # second call - should sleep
        elapsed = time.time() - start
        # At 10 req/s, delay should be ~0.1s, allow some tolerance
        assert elapsed >= 0.09

    def test_rate_limiter_no_delay_on_first_call(self):
        from scraper.utils.rate_limiter import RateLimiter
        limiter = RateLimiter("new_source", requests_per_second=1)
        start = time.time()
        limiter.wait()
        elapsed = time.time() - start
        # First call should not sleep more than 0.05s
        assert elapsed < 0.05

    def test_get_limiter_reads_config(self):
        from scraper.utils.rate_limiter import get_limiter
        from scraper.config import RATE_LIMITS
        limiter = get_limiter("papers")
        assert limiter is not None
        expected_rps = RATE_LIMITS["papers"]["requests_per_second"]
        assert limiter.requests_per_second == expected_rps

    def test_get_limiter_singleton(self):
        from scraper.utils.rate_limiter import get_limiter
        limiter1 = get_limiter("youtube")
        limiter2 = get_limiter("youtube")
        assert limiter1 is limiter2

    def test_rate_limiter_has_source_attribute(self):
        from scraper.utils.rate_limiter import RateLimiter
        limiter = RateLimiter("papers", 0.5)
        assert limiter.source == "papers"
        assert limiter.requests_per_second == 0.5


# ---------------------------------------------------------------------------
# quality tests
# ---------------------------------------------------------------------------

class TestQuality:
    def test_score_paper_returns_positive(self):
        from scraper.utils.quality import score_paper
        result = score_paper(citations=100, year=2020, paper_type="research_paper")
        assert result > 0

    def test_score_paper_meta_analysis_boost(self):
        from scraper.utils.quality import score_paper
        meta = score_paper(citations=100, year=2020, paper_type="meta_analysis")
        regular = score_paper(citations=100, year=2020, paper_type="research_paper")
        assert meta > regular

    def test_score_paper_review_boost(self):
        from scraper.utils.quality import score_paper
        review = score_paper(citations=100, year=2020, paper_type="review")
        regular = score_paper(citations=100, year=2020, paper_type="research_paper")
        assert review > regular

    def test_score_paper_position_stand_boost(self):
        from scraper.utils.quality import score_paper
        ps = score_paper(citations=100, year=2020, paper_type="position_stand")
        regular = score_paper(citations=100, year=2020, paper_type="research_paper")
        assert ps > regular

    def test_score_paper_rct_boost(self):
        from scraper.utils.quality import score_paper
        rct = score_paper(citations=100, year=2020, paper_type="rct")
        regular = score_paper(citations=100, year=2020, paper_type="research_paper")
        assert rct > regular

    def test_score_paper_case_study_lower(self):
        from scraper.utils.quality import score_paper
        case = score_paper(citations=100, year=2020, paper_type="case_study")
        regular = score_paper(citations=100, year=2020, paper_type="research_paper")
        assert case < regular

    def test_score_paper_zero_citations(self):
        from scraper.utils.quality import score_paper
        result = score_paper(citations=0, year=2024, paper_type="research_paper")
        assert result == 0.0

    def test_score_youtube_returns_positive(self):
        from scraper.utils.quality import score_youtube
        result = score_youtube(views=100000, likes=5000, duration_sec=600)
        assert result > 0

    def test_score_youtube_capped_at_100(self):
        from scraper.utils.quality import score_youtube
        result = score_youtube(views=10000000, likes=9000000, duration_sec=7200)
        assert result <= 100

    def test_score_youtube_zero_views(self):
        from scraper.utils.quality import score_youtube
        result = score_youtube(views=0, likes=0, duration_sec=600)
        assert result == 0

    def test_score_reddit_returns_positive(self):
        from scraper.utils.quality import score_reddit
        result = score_reddit(upvotes=100, num_comments=50)
        assert result > 0

    def test_score_reddit_formula(self):
        from scraper.utils.quality import score_reddit
        result = score_reddit(upvotes=100, num_comments=50)
        expected = 100 * 0.5 + 50 * 1.0
        assert result == expected

    def test_score_article_short(self):
        from scraper.utils.quality import score_article
        result = score_article(word_count=300)
        assert result == 1

    def test_score_article_medium(self):
        from scraper.utils.quality import score_article
        result = score_article(word_count=1000)
        assert result == 3

    def test_score_article_long(self):
        from scraper.utils.quality import score_article
        result = score_article(word_count=3000)
        assert result == 5

    def test_score_article_very_long(self):
        from scraper.utils.quality import score_article
        result = score_article(word_count=6000)
        assert result == 7

    def test_score_podcast_very_short(self):
        from scraper.utils.quality import score_podcast
        result = score_podcast(duration_sec=600)  # 10 minutes
        assert result == 2

    def test_score_podcast_normal(self):
        from scraper.utils.quality import score_podcast
        result = score_podcast(duration_sec=3600)  # 60 minutes
        assert result == 5

    def test_score_podcast_long(self):
        from scraper.utils.quality import score_podcast
        result = score_podcast(duration_sec=6000)  # 100 minutes
        assert result == 4
