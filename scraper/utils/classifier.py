"""Keyword-based content classifier for fitness/sports-science categories."""

from __future__ import annotations

import re
from typing import Dict, List

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "hypertrophy": [
        "hypertrophy", "muscle growth", "resistance training", "strength training",
        "progressive overload", "training volume", "rep range", "periodization",
        "compound exercise", "isolation exercise", "muscle fiber", "mechanical tension",
        "training frequency", "muscle protein synthesis", "lifting", "powerlifting",
        "bodybuilding", "squat", "bench press", "deadlift", "workout split",
    ],
    "nutrition": [
        "protein intake", "caloric deficit", "caloric surplus", "macronutrient",
        "carb cycling", "reverse diet", "meal timing", "protein timing",
        "body recomposition", "contest prep", "bulking", "cutting",
        "intermittent fasting", "dietary protein", "energy balance", "micronutrient",
        "calorie", "diet plan", "macro",
    ],
    "supplements": [
        "creatine", "caffeine", "beta-alanine", "citrulline", "ashwagandha",
        "omega-3", "fish oil", "vitamin d", "magnesium", "zinc", "pre-workout",
        "ergogenic", "supplement", "nutraceutical", "collagen", "probiotic",
        "whey protein", "casein",
    ],
    "peptides": [
        "bpc-157", "tb-500", "peptide", "sarm", "sarms", "growth hormone",
        "igf-1", "mk-677", "ibutamoren", "ghk-cu", "cjc-1295", "thymosin",
        "secretagogue", "anabolic", "testosterone", "performance enhancing", "PED",
    ],
    "endurance": [
        "vo2max", "vo2 max", "endurance training", "aerobic capacity", "marathon",
        "triathlon", "cycling", "swimming", "running", "zone 2", "lactate threshold",
        "polarized training", "concurrent training", "interference effect",
        "hybrid athlete", "cardio", "cardiovascular", "ironman",
    ],
    "recovery": [
        "sleep", "hrv", "heart rate variability", "overtraining", "recovery",
        "deload", "rest day", "cortisol", "fatigue", "cold water immersion",
        "ice bath", "massage", "foam rolling", "active recovery", "stress management",
    ],
    "body_composition": [
        "dexa", "body fat", "body composition", "lean mass", "fat mass",
        "visceral fat", "skinfold", "bioimpedance", "bmi", "waist circumference",
        "body weight",
    ],
    "injury_prevention": [
        "tendinopathy", "tendinitis", "rotator cuff", "acl", "injury prevention",
        "rehabilitation", "mobility", "flexibility", "joint health", "low back pain",
        "prehab", "physical therapy", "return to sport",
    ],
}

SUBCATEGORY_KEYWORDS: Dict[str, Dict[str, List[str]]] = {
    "supplements": {
        "creatine": ["creatine"],
        "stimulants": ["caffeine", "pre-workout"],
        "amino_acids": ["beta-alanine", "citrulline", "whey protein", "casein"],
        "adaptogens": ["ashwagandha"],
        "micronutrients": ["omega-3", "fish oil", "vitamin d", "magnesium", "zinc"],
        "gut_health": ["probiotic", "collagen"],
    },
    "peptides": {
        "healing_peptides": ["bpc-157", "tb-500", "ghk-cu", "thymosin"],
        "growth_peptides": ["growth hormone", "igf-1", "mk-677", "ibutamoren", "cjc-1295", "secretagogue"],
        "sarms": ["sarm", "sarms"],
        "hormones": ["testosterone", "anabolic", "performance enhancing", "PED"],
    },
    "hypertrophy": {
        "volume": ["training volume", "rep range", "workout split"],
        "programming": ["periodization", "progressive overload", "training frequency"],
        "mechanics": ["mechanical tension", "muscle fiber", "muscle protein synthesis"],
        "exercises": ["squat", "bench press", "deadlift", "compound exercise", "isolation exercise"],
    },
}


def classify(text: str) -> str:
    """Classify *text* into one of the 8 fitness categories.

    Counts keyword matches per category using whole-word regex matching and
    returns the category with the highest count. Falls back to "hypertrophy"
    when no keywords are found.
    """
    lower = text.lower()
    scores: Dict[str, int] = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        count = 0
        for keyword in keywords:
            count += len(re.findall(r"\b" + re.escape(keyword) + r"\b", lower, re.IGNORECASE))
        scores[category] = count

    best_category = max(scores, key=lambda c: scores[c])
    if scores[best_category] == 0:
        return "hypertrophy"
    return best_category


def get_subcategories(text: str, category: str) -> List[str]:
    """Return matching subcategory names for *text* within *category*.

    Returns an empty list if the category has no subcategory definitions or
    no keywords match.
    """
    if category not in SUBCATEGORY_KEYWORDS:
        return []

    lower = text.lower()
    matched: List[str] = []

    for subcat, keywords in SUBCATEGORY_KEYWORDS[category].items():
        for keyword in keywords:
            if re.search(r"\b" + re.escape(keyword) + r"\b", lower, re.IGNORECASE):
                matched.append(subcat)
                break  # only add subcat once even if multiple keywords match

    return matched
