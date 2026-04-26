"""Scraper configuration: category weights, source weights, search terms,
target channels / feeds / sites / books, and rate limits."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Category definitions
# ---------------------------------------------------------------------------

CATEGORIES: Dict[str, dict] = {
    "hypertrophy": {
        "weight": 0.25,
        "search_terms": [
            "muscle hypertrophy volume",
            "resistance training frequency",
            "periodization strength training",
            "progressive overload muscle growth",
            "training volume landmarks",
            "mechanical tension hypertrophy",
            "rep range muscle growth",
            "compound vs isolation exercises",
            "muscle protein synthesis resistance",
            "training to failure hypertrophy",
        ],
    },
    "nutrition": {
        "weight": 0.20,
        "search_terms": [
            "protein synthesis muscle building",
            "caloric deficit lean mass retention",
            "carb cycling athletic performance",
            "reverse dieting metabolism",
            "protein timing distribution",
            "macronutrient ratios body composition",
            "contest prep bodybuilding diet",
            "bulking diet muscle gain",
            "intermittent fasting muscle mass",
            "recomposition calorie intake",
        ],
    },
    "supplements": {
        "weight": 0.15,
        "search_terms": [
            "creatine monohydrate performance meta-analysis",
            "caffeine ergogenic aid exercise",
            "beta-alanine endurance performance",
            "ashwagandha testosterone cortisol",
            "citrulline malate exercise performance",
            "omega-3 fatty acids muscle recovery",
            "vitamin D muscle function",
            "magnesium sleep athletic performance",
            "collagen peptides joint health",
            "probiotics gut health athletes",
        ],
    },
    "peptides": {
        "weight": 0.15,
        "search_terms": [
            "BPC-157 tendon healing",
            "TB-500 tissue repair regeneration",
            "growth hormone secretagogue",
            "SARMs muscle mass research",
            "IGF-1 muscle hypertrophy",
            "MK-677 ibutamoren growth hormone",
            "peptide therapy recovery",
            "GHK-Cu wound healing collagen",
            "CJC-1295 growth hormone releasing",
            "thymosin beta tissue regeneration",
        ],
    },
    "endurance": {
        "weight": 0.10,
        "search_terms": [
            "concurrent training interference effect",
            "VO2max improvement training",
            "zone 2 training metabolic adaptation",
            "hybrid athlete strength endurance",
            "marathon training periodization",
            "triathlon training program",
            "lactate threshold training",
            "polarized training endurance",
            "running economy biomechanics",
            "cycling power training zones",
        ],
    },
    "recovery": {
        "weight": 0.07,
        "search_terms": [
            "sleep deprivation strength performance",
            "HRV training readiness monitoring",
            "overtraining syndrome markers",
            "deload recovery adaptation",
            "cold water immersion recovery",
            "massage therapy muscle recovery",
            "active recovery exercise",
            "stress cortisol training adaptation",
        ],
    },
    "body_composition": {
        "weight": 0.05,
        "search_terms": [
            "DEXA body composition accuracy",
            "body fat measurement methods comparison",
            "lean mass retention caloric deficit",
            "body recomposition evidence",
            "weight loss muscle preservation",
            "visceral fat exercise reduction",
        ],
    },
    "injury_prevention": {
        "weight": 0.03,
        "search_terms": [
            "tendinopathy loading protocol rehabilitation",
            "rotator cuff injury prevention exercises",
            "return to training criteria injury",
            "ACL injury prevention program",
            "low back pain resistance training",
            "mobility flexibility injury prevention",
        ],
    },
}

# ---------------------------------------------------------------------------
# Source type definitions
# ---------------------------------------------------------------------------

SOURCE_TYPES: Dict[str, dict] = {
    "papers":   {"weight": 0.40, "priority": 1},
    "youtube":  {"weight": 0.20, "priority": 2},
    "articles": {"weight": 0.15, "priority": 3},
    "podcasts": {"weight": 0.10, "priority": 4},
    "books":    {"weight": 0.10, "priority": 5},
    "reddit":   {"weight": 0.05, "priority": 6},
}

# ---------------------------------------------------------------------------
# Target channels / feeds / sites / books / subreddits
# ---------------------------------------------------------------------------

YOUTUBE_CHANNELS: List[str] = [
    "https://www.youtube.com/@RenaissancePeriodization",
    "https://www.youtube.com/@JeffNippard",
    "https://www.youtube.com/@AlexBromley",
    "https://www.youtube.com/@GVS",
    "https://www.youtube.com/@BarbellMedicine",
    "https://www.youtube.com/@SBSfitness",
    "https://www.youtube.com/@NickBareOfficial",
    "https://www.youtube.com/@CrossFit",
    "https://www.youtube.com/@StartingStrength",
    "https://www.youtube.com/@PrecisionNutrition",
]

PODCAST_FEEDS: List[dict] = [
    {
        "name": "Iron Culture",
        "url": "https://feeds.buzzsprout.com/747123.rss",
    },
    {
        "name": "Stronger By Science",
        "url": "https://strongerbyscience.com/podcast/feed/",
    },
    {
        "name": "Revive Stronger",
        "url": "https://revivestronger.com/feed/podcast/",
    },
    {
        "name": "Renaissance Periodization",
        "url": "https://renaissanceperiodization.com/rp-radio/feed/",
    },
    {
        "name": "Barbell Medicine",
        "url": "https://www.barbellmedicine.com/feed/podcast/",
    },
    {
        "name": "Mind Pump",
        "url": "https://www.mindpumpradio.com/feed/podcast/",
    },
    {
        "name": "Huberman Lab",
        "url": "https://feeds.megaphone.fm/hubermanlab",
    },
    {
        "name": "Sigma Nutrition Radio",
        "url": "https://sigmanutrition.com/feed/podcast/",
    },
    {
        "name": "The Peter Attia Drive",
        "url": "https://peterattiamd.com/feed/podcast/",
    },
]

ARTICLE_SITES: List[dict] = [
    {
        "name": "Stronger By Science",
        "base_url": "https://www.strongerbyscience.com",
        "sitemap": "https://www.strongerbyscience.com/sitemap_index.xml",
    },
    {
        "name": "RippedBody",
        "base_url": "https://rippedbody.com",
        "sitemap": "https://rippedbody.com/sitemap_index.xml",
    },
    {
        "name": "T-Nation",
        "base_url": "https://www.t-nation.com",
        "sitemap": "https://www.t-nation.com/sitemap.xml",
    },
    {
        "name": "EliteFTS",
        "base_url": "https://www.elitefts.com",
        "sitemap": "https://www.elitefts.com/sitemap_index.xml",
    },
    {
        "name": "Examine",
        "base_url": "https://examine.com",
        "sitemap": "https://examine.com/sitemap.xml",
    },
    {
        "name": "Renaissance Periodization",
        "base_url": "https://renaissanceperiodization.com",
        "sitemap": "https://renaissanceperiodization.com/sitemap_index.xml",
    },
    {
        "name": "Barbell Medicine",
        "base_url": "https://www.barbellmedicine.com",
        "sitemap": "https://www.barbellmedicine.com/sitemap_index.xml",
    },
    {
        "name": "Precision Nutrition",
        "base_url": "https://www.precisionnutrition.com",
        "sitemap": "https://www.precisionnutrition.com/sitemap_index.xml",
    },
    {
        "name": "TrainingPeaks",
        "base_url": "https://www.trainingpeaks.com",
        "sitemap": "https://www.trainingpeaks.com/sitemap.xml",
    },
    {
        "name": "CrossFit Journal",
        "base_url": "https://journal.crossfit.com",
        "sitemap": "https://journal.crossfit.com/sitemap.xml",
    },
    {
        "name": "Starting Strength",
        "base_url": "https://startingstrength.com",
        "sitemap": "https://startingstrength.com/sitemap.xml",
    },
]

TARGET_BOOKS: List[dict] = [
    # Strength & Hypertrophy
    {
        "title": "Science and Practice of Strength Training",
        "author": "Vladimir M. Zatsiorsky",
        "isbn": "9780736056281",
    },
    {
        "title": "Starting Strength: Basic Barbell Training",
        "author": "Mark Rippetoe",
        "isbn": "9780982522738",
    },
    {
        "title": "The Renaissance Diet 2.0",
        "author": "Mike Israetel",
        "isbn": "9798685049872",
    },
    {
        "title": "Scientific Principles of Hypertrophy Training",
        "author": "Mike Israetel",
        "isbn": "9798837398858",
    },
    {
        "title": "The Muscle and Strength Pyramid: Training",
        "author": "Eric Helms",
        "isbn": "9781736093009",
    },
    {
        "title": "The Muscle and Strength Pyramid: Nutrition",
        "author": "Eric Helms",
        "isbn": "9781736093016",
    },
    {
        "title": "NSCA's Essentials of Strength Training and Conditioning",
        "author": "NSCA",
        "isbn": "9781492501626",
    },
    {
        "title": "Periodization: Theory and Methodology of Training",
        "author": "Tudor Bompa",
        "isbn": "9780736085472",
    },
    {
        "title": "Supertraining",
        "author": "Yuri Verkhoshansky",
        "isbn": "9788890403729",
    },
    {
        "title": "Designing Resistance Training Programs",
        "author": "William J. Kraemer",
        "isbn": "9781492572695",
    },
    # Running
    {
        "title": "80/20 Running",
        "author": "Matt Fitzgerald",
        "isbn": "9780451470881",
    },
    {
        "title": "Daniels' Running Formula",
        "author": "Jack Daniels",
        "isbn": "9781450431835",
    },
    {
        "title": "Advanced Marathoning",
        "author": "Pete Pfitzinger",
        "isbn": "9781492533900",
    },
    {
        "title": "Hansons Marathon Method",
        "author": "Luke Humphrey",
        "isbn": "9781937715144",
    },
    {
        "title": "Run Less Run Faster",
        "author": "Bill Pierce",
        "isbn": "9781609619121",
    },
    {
        "title": "Science of Running",
        "author": "Steve Magness",
        "isbn": "9780991250806",
    },
    {
        "title": "Fast After 50",
        "author": "Joe Friel",
        "isbn": "9781937715441",
    },
    # Triathlon
    {
        "title": "The Triathlete's Training Bible",
        "author": "Joe Friel",
        "isbn": "9781937715441",
    },
    {
        "title": "Training and Racing with a Power Meter",
        "author": "Hunter Allen",
        "isbn": "9781934030554",
    },
    {
        "title": "Total Immersion: The Revolutionary Way to Swim",
        "author": "Terry Laughlin",
        "isbn": "9780743253345",
    },
]

REDDIT_SUBREDDITS: List[str] = [
    "weightroom",
    "naturalbodybuilding",
    "bodybuilding",
    "advancedfitness",
    "steroids",
    "Supplements",
    "strength_training",
]

# ---------------------------------------------------------------------------
# Rate limits
# ---------------------------------------------------------------------------

RATE_LIMITS: Dict[str, dict] = {
    "papers":   {"requests_per_second": 0.5,  "delay": 2.0},
    "youtube":  {"requests_per_second": 1.0,  "delay": 1.0},
    "articles": {"requests_per_second": 0.5,  "delay": 2.0},
    "podcasts": {"requests_per_second": 1.0,  "delay": 1.0},
    "books":    {"requests_per_second": 0.25, "delay": 4.0},
    "reddit":   {"requests_per_second": 1.0,  "delay": 1.0},
}

# ---------------------------------------------------------------------------
# Mirror / API constants
# ---------------------------------------------------------------------------

SCIHUB_MIRRORS: List[str] = [
    "https://sci-hub.se",
    "https://sci-hub.st",
    "https://sci-hub.ru",
    "https://sci-hub.wf",
]

LIBGEN_MIRRORS: List[str] = [
    "https://libgen.is",
    "https://libgen.rs",
    "https://libgen.st",
]

NCBI_BASE: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
BIORXIV_API: str = "https://api.biorxiv.org/details/biorxiv/"

# ---------------------------------------------------------------------------
# ScraperConfig dataclass
# ---------------------------------------------------------------------------


@dataclass
class ScraperConfig:
    """Top-level configuration for a scraping run."""

    duration_hours: float = 12
    num_workers: int = 4
    sources_enabled: List[str] = field(
        default_factory=lambda: list(SOURCE_TYPES.keys())
    )
    categories: Dict[str, dict] = field(default_factory=lambda: CATEGORIES)
    source_types: Dict[str, dict] = field(default_factory=lambda: SOURCE_TYPES)

    # Optional credentials
    ncbi_api_key: Optional[str] = None
    ncbi_email: Optional[str] = None
    reddit_client_id: Optional[str] = None
    reddit_client_secret: Optional[str] = None
    reddit_user_agent: Optional[str] = None

    def get_time_budgets(self) -> Dict[str, float]:
        """Return seconds allocated to each enabled source, proportional to weights.

        When only a subset of sources is enabled, weights are re-normalised to
        sum to 1.0 across the enabled set so the total always equals
        ``duration_hours * 3600`` seconds.
        """
        total_seconds = self.duration_hours * 3600
        enabled_weights = {
            src: SOURCE_TYPES[src]["weight"] for src in self.sources_enabled
        }
        weight_sum = sum(enabled_weights.values())
        return {
            src: (w / weight_sum) * total_seconds
            for src, w in enabled_weights.items()
        }

    def to_json(self) -> str:
        """Serialise the config to a JSON string."""
        return json.dumps(
            {
                "duration_hours": self.duration_hours,
                "num_workers": self.num_workers,
                "sources_enabled": self.sources_enabled,
                "ncbi_api_key": self.ncbi_api_key,
                "ncbi_email": self.ncbi_email,
                "reddit_client_id": self.reddit_client_id,
                "reddit_client_secret": self.reddit_client_secret,
                "reddit_user_agent": self.reddit_user_agent,
            },
            indent=2,
        )
