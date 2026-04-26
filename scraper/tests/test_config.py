"""Tests for scraper/config.py"""
import json
import pytest
from scraper.config import (
    CATEGORIES,
    SOURCE_TYPES,
    YOUTUBE_CHANNELS,
    PODCAST_FEEDS,
    ARTICLE_SITES,
    TARGET_BOOKS,
    REDDIT_SUBREDDITS,
    RATE_LIMITS,
    SCIHUB_MIRRORS,
    LIBGEN_MIRRORS,
    NCBI_BASE,
    BIORXIV_API,
    ScraperConfig,
)


# ---------------------------------------------------------------------------
# CATEGORIES
# ---------------------------------------------------------------------------

class TestCategories:
    def test_category_weights_sum_to_one(self):
        total = sum(v["weight"] for v in CATEGORIES.values())
        assert abs(total - 1.0) < 1e-9, f"Category weights sum to {total}, expected 1.0"

    def test_all_expected_categories_present(self):
        expected = {
            "hypertrophy", "nutrition", "supplements", "peptides",
            "endurance", "recovery", "body_composition", "injury_prevention",
        }
        assert set(CATEGORIES.keys()) == expected

    def test_all_categories_have_search_terms(self):
        for name, data in CATEGORIES.items():
            assert "search_terms" in data, f"Category {name!r} missing 'search_terms'"
            assert len(data["search_terms"]) > 0, f"Category {name!r} has empty search_terms"

    def test_hypertrophy_weight(self):
        assert CATEGORIES["hypertrophy"]["weight"] == 0.25

    def test_nutrition_weight(self):
        assert CATEGORIES["nutrition"]["weight"] == 0.20

    def test_supplements_weight(self):
        assert CATEGORIES["supplements"]["weight"] == 0.15

    def test_peptides_weight(self):
        assert CATEGORIES["peptides"]["weight"] == 0.15

    def test_endurance_weight(self):
        assert CATEGORIES["endurance"]["weight"] == 0.10

    def test_recovery_weight(self):
        assert CATEGORIES["recovery"]["weight"] == 0.07

    def test_body_composition_weight(self):
        assert CATEGORIES["body_composition"]["weight"] == 0.05

    def test_injury_prevention_weight(self):
        assert CATEGORIES["injury_prevention"]["weight"] == 0.03

    def test_hypertrophy_search_term_count(self):
        assert len(CATEGORIES["hypertrophy"]["search_terms"]) >= 10

    def test_nutrition_search_term_count(self):
        assert len(CATEGORIES["nutrition"]["search_terms"]) >= 10

    def test_supplements_search_term_count(self):
        assert len(CATEGORIES["supplements"]["search_terms"]) >= 10

    def test_peptides_search_term_count(self):
        assert len(CATEGORIES["peptides"]["search_terms"]) >= 10

    def test_endurance_search_term_count(self):
        assert len(CATEGORIES["endurance"]["search_terms"]) >= 10

    def test_recovery_search_term_count(self):
        assert len(CATEGORIES["recovery"]["search_terms"]) >= 8

    def test_body_composition_search_term_count(self):
        assert len(CATEGORIES["body_composition"]["search_terms"]) >= 6

    def test_injury_prevention_search_term_count(self):
        assert len(CATEGORIES["injury_prevention"]["search_terms"]) >= 6


# ---------------------------------------------------------------------------
# SOURCE_TYPES
# ---------------------------------------------------------------------------

class TestSourceTypes:
    def test_source_weights_sum_to_one(self):
        total = sum(v["weight"] for v in SOURCE_TYPES.values())
        assert abs(total - 1.0) < 1e-9, f"Source weights sum to {total}, expected 1.0"

    def test_all_expected_sources_present(self):
        expected = {"papers", "youtube", "articles", "podcasts", "books", "reddit"}
        assert set(SOURCE_TYPES.keys()) == expected

    def test_papers_weight(self):
        assert SOURCE_TYPES["papers"]["weight"] == 0.40

    def test_youtube_weight(self):
        assert SOURCE_TYPES["youtube"]["weight"] == 0.20

    def test_articles_weight(self):
        assert SOURCE_TYPES["articles"]["weight"] == 0.15

    def test_podcasts_weight(self):
        assert SOURCE_TYPES["podcasts"]["weight"] == 0.10

    def test_books_weight(self):
        assert SOURCE_TYPES["books"]["weight"] == 0.10

    def test_reddit_weight(self):
        assert SOURCE_TYPES["reddit"]["weight"] == 0.05

    def test_priorities_are_unique(self):
        priorities = [v["queue_priority"] for v in SOURCE_TYPES.values()]
        assert len(priorities) == len(set(priorities)), "Priorities are not unique"

    def test_papers_priority_is_one(self):
        assert SOURCE_TYPES["papers"]["queue_priority"] == 1

    def test_reddit_priority_is_six(self):
        assert SOURCE_TYPES["reddit"]["queue_priority"] == 6


# ---------------------------------------------------------------------------
# YOUTUBE_CHANNELS
# ---------------------------------------------------------------------------

class TestYoutubeChannels:
    def test_minimum_channel_count(self):
        assert len(YOUTUBE_CHANNELS) >= 10

    def test_all_entries_are_strings(self):
        for ch in YOUTUBE_CHANNELS:
            assert isinstance(ch, str), f"Expected string, got {type(ch)}"

    def test_all_entries_are_urls(self):
        for ch in YOUTUBE_CHANNELS:
            assert ch.startswith("https://"), f"Channel URL missing https://: {ch}"


# ---------------------------------------------------------------------------
# PODCAST_FEEDS
# ---------------------------------------------------------------------------

class TestPodcastFeeds:
    def test_minimum_feed_count(self):
        assert len(PODCAST_FEEDS) >= 9

    def test_each_feed_has_name_and_url(self):
        for feed in PODCAST_FEEDS:
            assert "name" in feed, f"Feed missing 'name': {feed}"
            assert "url" in feed, f"Feed missing 'url': {feed}"

    def test_feed_urls_are_strings(self):
        for feed in PODCAST_FEEDS:
            assert isinstance(feed["url"], str)


# ---------------------------------------------------------------------------
# ARTICLE_SITES
# ---------------------------------------------------------------------------

class TestArticleSites:
    def test_minimum_site_count(self):
        assert len(ARTICLE_SITES) >= 11

    def test_each_site_has_required_fields(self):
        for site in ARTICLE_SITES:
            assert "name" in site, f"Site missing 'name': {site}"
            assert "base_url" in site, f"Site missing 'base_url': {site}"
            assert "sitemap" in site, f"Site missing 'sitemap': {site}"

    def test_base_urls_are_strings(self):
        for site in ARTICLE_SITES:
            assert isinstance(site["base_url"], str)


# ---------------------------------------------------------------------------
# TARGET_BOOKS
# ---------------------------------------------------------------------------

class TestTargetBooks:
    def test_minimum_book_count(self):
        assert len(TARGET_BOOKS) >= 20

    def test_each_book_has_required_fields(self):
        for book in TARGET_BOOKS:
            assert "title" in book, f"Book missing 'title': {book}"
            assert "author" in book, f"Book missing 'author': {book}"
            assert "isbn" in book, f"Book missing 'isbn': {book}"

    def test_book_titles_are_non_empty_strings(self):
        for book in TARGET_BOOKS:
            assert isinstance(book["title"], str) and book["title"]


# ---------------------------------------------------------------------------
# REDDIT_SUBREDDITS
# ---------------------------------------------------------------------------

class TestRedditSubreddits:
    def test_minimum_subreddit_count(self):
        assert len(REDDIT_SUBREDDITS) >= 7

    def test_all_entries_are_strings(self):
        for sub in REDDIT_SUBREDDITS:
            assert isinstance(sub, str)

    def test_expected_subreddits_present(self):
        expected = {
            "weightroom", "naturalbodybuilding", "bodybuilding",
            "advancedfitness", "steroids", "Supplements", "strength_training",
        }
        assert expected.issubset(set(REDDIT_SUBREDDITS))


# ---------------------------------------------------------------------------
# RATE_LIMITS
# ---------------------------------------------------------------------------

class TestRateLimits:
    def test_rate_limits_defined_for_all_sources(self):
        for source in SOURCE_TYPES:
            assert source in RATE_LIMITS, f"No rate limit for source {source!r}"

    def test_each_rate_limit_has_requests_per_second(self):
        for source, limits in RATE_LIMITS.items():
            assert "requests_per_second" in limits, f"Missing requests_per_second for {source}"

    def test_each_rate_limit_has_delay(self):
        for source, limits in RATE_LIMITS.items():
            assert "delay" in limits, f"Missing delay for {source}"

    def test_requests_per_second_are_positive(self):
        for source, limits in RATE_LIMITS.items():
            assert limits["requests_per_second"] > 0, f"requests_per_second <= 0 for {source}"


# ---------------------------------------------------------------------------
# Mirror / API constants
# ---------------------------------------------------------------------------

class TestConstants:
    def test_scihub_mirrors_minimum_count(self):
        assert len(SCIHUB_MIRRORS) >= 4

    def test_libgen_mirrors_minimum_count(self):
        assert len(LIBGEN_MIRRORS) >= 3

    def test_scihub_mirrors_are_urls(self):
        for url in SCIHUB_MIRRORS:
            assert url.startswith("https://") or url.startswith("http://")

    def test_libgen_mirrors_are_urls(self):
        for url in LIBGEN_MIRRORS:
            assert url.startswith("https://") or url.startswith("http://")

    def test_ncbi_base_is_string(self):
        assert isinstance(NCBI_BASE, str) and NCBI_BASE

    def test_biorxiv_api_is_string(self):
        assert isinstance(BIORXIV_API, str) and BIORXIV_API


# ---------------------------------------------------------------------------
# ScraperConfig dataclass
# ---------------------------------------------------------------------------

class TestScraperConfig:
    def test_default_duration_hours(self):
        cfg = ScraperConfig()
        assert cfg.duration_hours == 12

    def test_default_num_workers(self):
        cfg = ScraperConfig()
        assert cfg.num_workers == 4

    def test_default_sources_enabled_contains_all_sources(self):
        cfg = ScraperConfig()
        for source in SOURCE_TYPES:
            assert source in cfg.sources_enabled

    def test_categories_attribute_is_categories_dict(self):
        cfg = ScraperConfig()
        assert cfg.categories is CATEGORIES

    def test_source_types_attribute_is_source_types_dict(self):
        cfg = ScraperConfig()
        assert cfg.source_types is SOURCE_TYPES

    def test_ncbi_api_key_defaults_to_none(self):
        cfg = ScraperConfig()
        assert cfg.ncbi_api_key is None

    def test_ncbi_email_defaults_to_none(self):
        cfg = ScraperConfig()
        assert cfg.ncbi_email is None

    def test_reddit_credentials_default_to_none(self):
        cfg = ScraperConfig()
        assert cfg.reddit_client_id is None
        assert cfg.reddit_client_secret is None
        assert cfg.reddit_user_agent is None

    # --- get_time_budgets ---

    def test_get_time_budgets_returns_dict(self):
        cfg = ScraperConfig()
        budgets = cfg.get_time_budgets()
        assert isinstance(budgets, dict)

    def test_get_time_budgets_keys_match_sources_enabled(self):
        cfg = ScraperConfig()
        budgets = cfg.get_time_budgets()
        assert set(budgets.keys()) == set(cfg.sources_enabled)

    def test_get_time_budgets_sum_to_total_seconds(self):
        cfg = ScraperConfig()
        budgets = cfg.get_time_budgets()
        total_seconds = cfg.duration_hours * 3600
        assert abs(sum(budgets.values()) - total_seconds) < 1e-6

    def test_get_time_budgets_proportional_to_weights(self):
        cfg = ScraperConfig()
        budgets = cfg.get_time_budgets()
        total_seconds = cfg.duration_hours * 3600
        for source in cfg.sources_enabled:
            expected = SOURCE_TYPES[source]["weight"] * total_seconds
            assert abs(budgets[source] - expected) < 1e-6

    def test_get_time_budgets_custom_sources_enabled(self):
        cfg = ScraperConfig(sources_enabled=["papers", "youtube"])
        budgets = cfg.get_time_budgets()
        assert set(budgets.keys()) == {"papers", "youtube"}
        total_seconds = cfg.duration_hours * 3600
        # weights are re-normalised to only enabled sources
        papers_weight = SOURCE_TYPES["papers"]["weight"]
        youtube_weight = SOURCE_TYPES["youtube"]["weight"]
        combined = papers_weight + youtube_weight
        assert abs(budgets["papers"] - papers_weight / combined * total_seconds) < 1e-6
        assert abs(budgets["youtube"] - youtube_weight / combined * total_seconds) < 1e-6

    # --- to_json ---

    def test_to_json_returns_string(self):
        cfg = ScraperConfig()
        result = cfg.to_json()
        assert isinstance(result, str)

    def test_to_json_is_valid_json(self):
        cfg = ScraperConfig()
        parsed = json.loads(cfg.to_json())
        assert isinstance(parsed, dict)

    def test_to_json_contains_duration_hours(self):
        cfg = ScraperConfig()
        parsed = json.loads(cfg.to_json())
        assert "duration_hours" in parsed
        assert parsed["duration_hours"] == 12

    def test_to_json_contains_num_workers(self):
        cfg = ScraperConfig()
        parsed = json.loads(cfg.to_json())
        assert "num_workers" in parsed
        assert parsed["num_workers"] == 4

    def test_to_json_contains_sources_enabled(self):
        cfg = ScraperConfig()
        parsed = json.loads(cfg.to_json())
        assert "sources_enabled" in parsed

    def test_to_json_custom_values(self):
        cfg = ScraperConfig(duration_hours=6, num_workers=2, sources_enabled=["papers"])
        parsed = json.loads(cfg.to_json())
        assert parsed["duration_hours"] == 6
        assert parsed["num_workers"] == 2
        assert parsed["sources_enabled"] == ["papers"]
