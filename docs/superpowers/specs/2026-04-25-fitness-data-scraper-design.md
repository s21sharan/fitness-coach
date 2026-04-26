# Fitness Data Scraper Agent — Design Spec

**Date:** 2026-04-25
**Status:** Approved
**Author:** Sharan + Claude

---

## 1. Overview

An autonomous web scraping agent that collects fitness coaching data from multiple sources for building a RAG knowledge base (and eventually fine-tuning an LLM). The agent runs locally on Mac, supports 12-hour scraping sessions with pause/resume capability, and stores data in SQLite with an optional JSONL export pipeline.

**Purpose:** Collect high-quality fitness, nutrition, supplement, and training data to power the AI coaching chatbot in the Hybrid Fitness Coach platform.

**Data usage:**
- **Immediate:** RAG knowledge base — SQLite serves as the source, content gets chunked and embedded into a vector store
- **Future:** Fine-tuning dataset — JSONL export pipeline generates coaching-tone Q&A pairs via Claude synthesis

---

## 2. Architecture

```
+--------------------------------------------------+
|           Node.js Backend (Railway)              |
|    POST /scraper/start|pause|resume|status       |
+--------------------------+-----------------------+
                           | HTTP
                           v
+--------------------------------------------------+
|         Python FastAPI (Local Mac)               |
|                                                   |
|  +------------+  +------------+  +--------------+ |
|  | API        |  | Celery     |  | Export       | |
|  | Endpoints  |  | Workers    |  | Pipeline     | |
|  |            |  | (x4)       |  | (SQLite->JSONL)| |
|  +-----+------+  +-----+------+  +--------------+ |
|        |               |                          |
|        v               v                          |
|  +-------------------------+                      |
|  |   Redis (local)         |                      |
|  |   Task queue + state    |                      |
|  +-------------------------+                      |
|        |                                          |
|        v                                          |
|  +-------------------------+                      |
|  |   SQLite                |                      |
|  |   fitness_data.db       |                      |
|  +-------------------------+                      |
+--------------------------------------------------+
```

### Key Architectural Decisions

- **Python FastAPI microservice:** Mirrors the Garmin microservice pattern from the main platform. Python has the best scraping ecosystem (yt-dlp, BeautifulSoup, trafilatura, Whisper, scholarly, PyMuPDF).
- **Celery + Redis for pause/resume:** Task queue allows pausing by stopping task consumption, resuming by restarting workers. Unfinished tasks stay in the queue. More robust than file-based checkpointing.
- **4 concurrent Celery workers:** Balances throughput against rate limits. Each worker handles one content item at a time.
- **SQLite primary store:** Single file, portable, queryable. RAG pipeline reads directly from it. No need for JSONL until fine-tuning.
- **Runs locally on Mac:** Simplest setup for a data collection phase. Machine needs to stay on during scraping sessions.
- **Node backend orchestration via HTTP:** The main Railway backend can trigger and monitor scraping sessions, but direct CLI control is also available.

---

## 3. Data Sources

### Source Priority & Access Methods

| Source | Platform | Method | Content Extracted |
|--------|----------|--------|-------------------|
| Research Papers | PMC | NCBI E-utilities API (free, 3 req/sec) | Full text (open-access) |
| Research Papers | JISSN | Open-access journal, DOI scrape | Full text |
| Research Papers | Frontiers in Physiology | Open-access, DOI scrape | Full text |
| Research Papers | ACSM | Position stands, open articles | Full text where available |
| Research Papers | NSCA / JSCR | Position statements, open articles | Full text where available |
| Research Papers | Paywalled journals | NCBI API metadata + Sci-Hub fallback | Full text via Sci-Hub |
| Research Papers | Google Scholar | `scholarly` Python library | Metadata + Sci-Hub for full text |
| Research Papers | bioRxiv / medRxiv | Preprint APIs | Full text (open-access) |
| Research Papers | ClinicalTrials.gov | API | Trial metadata + results summaries |
| YouTube | Fitness channels | `yt-dlp` (transcript only) | Auto-captions / manual subtitles |
| Podcasts | RSS feeds | Feed parser + Whisper transcription | Transcribed audio |
| Articles | Fitness blogs/sites | `trafilatura` / BeautifulSoup | Article body text |
| Books | LibGen | ISBN/title search | Full text from PDF/EPUB |
| Reddit | Fitness subreddits | Reddit API (OAuth, 60 req/min) | Posts + top comments |

### Target Channels, Feeds, and Sites

**YouTube channels:**
Renaissance Periodization, Jeff Nippard, Alex Bromley, Geoffrey Verity Schofield, Barbell Medicine, Stronger By Science, Nick Bare, CrossFit, Starting Strength, Precision Nutrition, Alan Aragon guest appearances

**Podcasts:**
Iron Culture, Stronger By Science, Revive Stronger, RP Strength Podcast, Barbell Medicine, Mind Pump, The Huberman Lab (fitness episodes), Sigma Nutrition Radio, The Drive (Peter Attia — longevity + performance episodes)

**Article sites:**
strongerbyscience.com, rippedbody.com, t-nation.com, elitefts.com, examine.com, renaissanceperiodization.com, barbellmedicine.com, precisionnutrition.com, trainingpeaks.com/blog, crossfit.com/journal, acsm.org (position stands), nsca.com (articles), startingstrength.com/articles

**Reddit subreddits:**
r/weightroom, r/naturalbodybuilding, r/bodybuilding, r/advancedfitness, r/steroids (peptide/compound research), r/Supplements, r/strength_training

**Target books (strength & hypertrophy):**
- Science and Practice of Strength Training (Zatsiorsky)
- Practical Programming for Strength Training (Rippetoe)
- Scientific Principles of Hypertrophy Training (Israetel)
- The Muscle & Strength Pyramid (Helms)
- NSCA's Essentials of Strength Training & Conditioning
- Periodization: Theory and Methodology of Training (Bompa)
- Supertraining (Verkhoshansky)
- The Renaissance Diet 2.0 (Israetel)
- Optimizing Strength Training (Kraemer)

**Target books (running & endurance):**
- 80/20 Running (Matt Fitzgerald)
- Daniels' Running Formula (Jack Daniels)
- Advanced Marathoning (Pfitzinger & Douglas)
- Hansons Marathon Method (Hansons)
- Run Less, Run Faster (FIRST method)
- The Science of Running (Steve Magness)
- Fast After 50 (Joe Friel)

**Target books (triathlon):**
- The Triathlete's Training Bible (Joe Friel)
- Training and Racing with a Power Meter (Allen & Coggan)
- Total Immersion Swimming (Terry Laughlin)
- Going Long: Training for Triathlon's Ultimate Challenge (Friel & Byrn)

### Time Allocation

**By source type:**

| Source Type | Weight | Time (~12h) | Rationale |
|------------|--------|-------------|-----------|
| Research papers | 40% | ~4.8h | Highest density of reliable information |
| YouTube transcripts | 20% | ~2.4h | Coaching tone, practical advice, huge volume |
| Articles/blogs | 15% | ~1.8h | Well-written, actionable, good for RAG |
| Podcasts | 10% | ~1.2h | Coaching Q&A gold, but transcription is slow |
| Books | 10% | ~1.2h | Foundational knowledge, dense |
| Reddit/forums | 5% | ~0.6h | Real coaching interactions, noisy but authentic |

**By category (applied within each source type):**

| Category | Weight | Example Search Terms |
|----------|--------|---------------------|
| Hypertrophy & resistance training | 25% | `muscle hypertrophy volume`, `resistance training frequency`, `periodization strength`, `progressive overload` |
| Nutrition & dieting | 20% | `protein synthesis muscle`, `caloric deficit lean mass`, `carb cycling performance`, `reverse dieting metabolism` |
| Supplements | 15% | `creatine performance meta-analysis`, `caffeine ergogenic`, `beta-alanine endurance`, `ashwagandha testosterone` |
| Peptides & performance compounds | 15% | `BPC-157 tendon healing`, `TB-500 tissue repair`, `growth hormone secretagogue`, `SARMs muscle mass` |
| Endurance & concurrent training | 10% | `concurrent training interference`, `VO2max improvement`, `zone 2 training adaptation`, `hybrid athlete performance` |
| Recovery & sleep | 7% | `sleep deprivation strength`, `HRV training readiness`, `overtraining syndrome markers`, `deload recovery` |
| Body composition | 5% | `DEXA body composition`, `body fat measurement accuracy`, `lean mass retention cutting` |
| Injury prevention & rehab | 3% | `tendinopathy loading protocol`, `rotator cuff prevention`, `return to training criteria` |

### Rate Limiting

| Source | Rate Limit |
|--------|-----------|
| PubMed/PMC | 3 req/sec (NCBI policy, requires email registration) |
| Google Scholar | 10-30 sec randomized delay (aggressive anti-bot) |
| Sci-Hub | 5 sec delay, rotate user agents |
| Frontiers/JISSN/ACSM/NSCA | 2 sec delay, polite scraping |
| YouTube (yt-dlp) | Built-in rate limiting |
| Reddit API | 60 req/min (OAuth free tier) |
| LibGen | 5 sec delay |

### Quality Filtering

- Minimum word count: 200 (skip thin content)
- Language detection: English only (`langdetect`)
- Dedup: content_hash checked before any processing begins
- Papers: prefer meta-analyses and reviews (quality_score boost)
- Reddit: minimum score > 20, skip removed/deleted posts
- YouTube: skip videos under 3 minutes

---

## 4. Data Schema

### SQLite Schema (`fitness_data.db`)

```sql
-- Unified content storage across all source types
content
  id              INTEGER PRIMARY KEY
  content_hash    TEXT UNIQUE           -- dedup key
  title           TEXT NOT NULL
  authors         TEXT                  -- JSON array
  source_type     TEXT NOT NULL         -- paper, youtube, podcast, article, book, reddit
  source_platform TEXT                  -- pmc, scihub, youtube, spotify, rss, t_nation,
                                        -- stronger_by_science, rippedbody, reddit, libgen, etc.
  source_url      TEXT
  source_id       TEXT                  -- DOI, video ID, episode GUID, post ID, ISBN

  -- Content
  abstract        TEXT                  -- paper abstract, video description, episode summary
  full_text       TEXT                  -- extracted/transcribed content (zlib compressed)

  -- Classification
  category        TEXT                  -- one of the 8 categories
  subcategories   TEXT                  -- JSON array
  content_format  TEXT                  -- research_paper, review, meta_analysis, position_stand,
                                        -- book_chapter, transcript, blog_post, forum_post,
                                        -- coaching_qa, interview

  -- Metadata
  year            INTEGER
  date_published  TEXT
  journal         TEXT                  -- NULL for non-papers
  channel_name    TEXT                  -- YouTube channel, podcast name, subreddit
  duration_sec    INTEGER               -- for video/podcast
  word_count      INTEGER
  quality_score   REAL                  -- citations for papers, views for YT, upvotes for reddit
  language        TEXT DEFAULT 'en'

  created_at      TIMESTAMP

-- Scrape session tracking
scrape_sessions
  id              INTEGER PRIMARY KEY
  started_at      TIMESTAMP
  paused_at       TIMESTAMP
  resumed_at      TIMESTAMP
  status          TEXT                  -- running, paused, completed, failed
  total_items     INTEGER DEFAULT 0
  config          TEXT                  -- JSON: weights, sources, time budget

-- Search task checkpoints
search_tasks
  id              INTEGER PRIMARY KEY
  session_id      INTEGER FK
  category        TEXT
  source_type     TEXT                  -- paper, youtube, podcast, article, book, reddit
  search_term     TEXT
  source_platform TEXT
  status          TEXT                  -- pending, in_progress, completed, failed
  results_found   INTEGER DEFAULT 0
  results_fetched INTEGER DEFAULT 0
  page_cursor     TEXT                  -- page number, next_page_token, after cursor, etc.
  error_message   TEXT
  updated_at      TIMESTAMP

-- Failed fetches for retry
failed_fetches
  id              INTEGER PRIMARY KEY
  session_id      INTEGER FK
  source_type     TEXT
  source_id       TEXT
  title           TEXT
  error_message   TEXT
  retry_count     INTEGER DEFAULT 0
  created_at      TIMESTAMP

-- Export tracking (for future JSONL exports)
export_log
  id              INTEGER PRIMARY KEY
  content_id      INTEGER FK
  export_type     TEXT                  -- rag, finetune
  exported_at     TIMESTAMP
```

### Key Storage Decisions

- `full_text` stored zlib-compressed in SQLite — cuts storage ~60-70%
- PDFs streamed, text-extracted in memory, PDF bytes never written to disk
- Podcast audio: download → transcribe with Whisper → delete audio immediately
- YouTube: transcripts only (~5KB per video vs 500MB for video)
- Articles: article body only, boilerplate HTML stripped
- Estimated total storage: ~2-4 GB for ~10,000-15,000 content items

---

## 5. Content Extraction Pipeline

### Research Papers (PMC, Sci-Hub, JISSN, Frontiers, ACSM, NSCA, preprints)

```
DOI/PMID → fetch PDF stream → PyMuPDF (fitz) extract text in memory
  → strip references section, headers/footers, page numbers
  → keep: title, abstract, introduction, methods, results, discussion, conclusion
  → detect content_format: meta_analysis, review, rct, position_stand, case_study
  → discard PDF bytes
```

### YouTube Transcripts

```
Search via yt-dlp --flat-playlist for channel playlists
  → for each video: yt-dlp --write-auto-sub --skip-download
  → parse .vtt transcript → clean timestamps, merge fragments
  → extract: title, channel, description, duration, view count, upload date
  → no audio/video downloaded at any point

Target channels: RP, Jeff Nippard, Alex Bromley, Geoffrey Verity Schofield,
  Barbell Medicine, Stronger By Science, Nick Bare, CrossFit,
  Starting Strength, Precision Nutrition, Alan Aragon
```

### Podcasts

```
RSS feed URL → parse episodes → download audio (mp3/m4a)
  → transcribe with Whisper (base.en model — fast, good enough)
  → store transcript → delete audio immediately
  → ~1 min transcription per 10 min audio on M-series Mac

Target: Iron Culture, Stronger By Science, Revive Stronger, RP Strength,
  Barbell Medicine, Mind Pump, Huberman Lab, Sigma Nutrition,
  The Drive (Peter Attia)
```

### Articles & Blogs

```
URL → trafilatura (main content extraction, strips boilerplate)
  → fallback: BeautifulSoup with site-specific selectors
  → extract: title, author, date, article body, tags/categories

Site-specific handling:
  - Examine.com: structured supplement pages → parse into sections
    (summary, research, dosing, side effects)
  - T-Nation: heavy ads/popups → trafilatura handles well
  - Examine/RP: may need Selenium for JS-rendered content
```

### Books (LibGen)

```
Title/ISBN search → download EPUB or PDF
  → EPUB: ebooklib extract chapters → plain text
  → PDF: PyMuPDF extract text
  → split into chapters, store each as separate content row
  → delete source file after extraction
```

### Reddit

```
Reddit API (free tier, 60 req/min with OAuth)
  → search subreddits for top posts by keyword
  → filter: score > 20, has substantive replies
  → extract: post title, body, top 10 comments
  → tag content_format as "coaching_qa" for Q&A threads
```

---

## 6. Celery Task Architecture & Pause/Resume

### Worker Setup

```
Redis (broker + result backend)
  |
  +-- Queue: papers        (priority 1 — highest)
  +-- Queue: youtube       (priority 2)
  +-- Queue: articles      (priority 3)
  +-- Queue: podcasts      (priority 4)
  +-- Queue: books         (priority 5)
  +-- Queue: reddit        (priority 6)

4 Celery workers (concurrency=4)
  - Workers pull from all queues weighted by priority
  - Each worker handles one content item at a time
```

### Task Hierarchy

```python
scrape_session_task(config)
  |
  +-- schedule_category_tasks(category, source_types, time_budget)
  |     |
  |     +-- search_source_task(category, source_type, platform, search_terms)
  |     |     |
  |     |     +-- fetch_paper_task(doi, source_url)
  |     |     +-- fetch_youtube_task(video_id)
  |     |     +-- fetch_podcast_task(episode_url)
  |     |     +-- fetch_article_task(url)
  |     |     +-- fetch_book_task(isbn_or_title)
  |     |     +-- fetch_reddit_task(post_id)
  |     |
  |     +-- ... (more search terms)
  |
  +-- ... (more categories)
```

### Pause/Resume Flow

```
START (POST /scraper/start)
  +-- Creates scrape_session row in SQLite (status: running)
  +-- Generates all search_task rows from config (status: pending)
  +-- Enqueues top-level orchestrator in Celery
  +-- Orchestrator fans out category -> source -> fetch tasks

PAUSE (POST /scraper/pause)
  +-- Sets session status to "paused" in SQLite
  +-- Celery workers check session status before picking next task
  +-- Active workers finish their current item, then idle
  +-- Remaining queued tasks stay in Redis untouched
  +-- Each search_task saves its page_cursor to SQLite

RESUME (POST /scraper/resume)
  +-- Sets session status to "running" in SQLite
  +-- Workers wake up and resume pulling from queues
  +-- search_tasks with status "in_progress" resume from page_cursor
  +-- Already-completed tasks skipped (checked via SQLite)

STOP (POST /scraper/stop) — or 12-hour timer expires
  +-- Revokes all remaining Celery tasks
  +-- Workers finish current item
  +-- Session marked "completed" in SQLite
```

### 12-Hour Time Management

- On start, each category gets a time budget based on its weight
- Each source type within a category gets a sub-budget based on source weights
- A background timer thread tracks elapsed time
- At 11h 45m, stops enqueuing new search tasks and lets active fetches complete
- At 12h, hard stop — revoke all, shut down

---

## 7. JSONL Export Pipeline (Dormant)

Built but not run until fine-tuning is needed.

### RAG Export (`rag_export.jsonl`)

```jsonl
{"id":"doi:10.1186/s12970-017-0177-8","title":"...","category":"supplements","subcategories":["creatine"],"source_type":"paper","content_format":"position_stand","chunk_index":0,"chunk_total":4,"content":"...chunked text...","metadata":{"authors":["Kreider et al."],"journal":"JISSN","year":2017,"word_count":2100}}
```

- Split at paragraph boundaries, ~1000 tokens per chunk
- 100-token overlap between chunks
- Title and metadata repeated on every chunk

### Fine-Tuning Export (`finetune_export.jsonl`)

Requires Claude synthesis step — sends raw content to Claude API to generate coaching-tone Q&A pairs:

```jsonl
{"messages":[{"role":"system","content":"You are an expert fitness coach specializing in hypertrophy and nutrition for serious lifters and hybrid athletes."},{"role":"user","content":"I've been taking 5g of creatine daily but I'm not sure if I should load it first. What do you think?"},{"role":"assistant","content":"You don't need to load. The loading phase (20g/day for 5-7 days) just saturates your muscles faster, but 5g daily gets you to the same place in about 3-4 weeks..."}]}
```

### Export Tracking

Idempotent — `export_log` table tracks which content IDs have been exported. Re-running only processes new content.

---

## 8. FastAPI Endpoints

```
POST /scraper/start       — start a new scraping session
POST /scraper/pause       — pause active session
POST /scraper/resume      — resume paused session
POST /scraper/stop        — stop session and finalize
GET  /scraper/status      — session stats (items, sources, categories, errors, rate)
GET  /scraper/history     — list all past sessions
GET  /scraper/errors      — list failed fetches for debugging
POST /scraper/export/jsonl — trigger JSONL export (dormant for now)
```

---

## 9. CLI Interface

```bash
python cli.py start --hours 12
python cli.py start --hours 12 --sources papers,youtube --categories hypertrophy,nutrition
python cli.py pause
python cli.py resume
python cli.py stop
python cli.py status --watch    # polls every 30 sec
python cli.py status            # one-shot
python cli.py errors --limit 20
python cli.py export --type finetune --output ./exports/
python cli.py stats
```

---

## 10. Project Structure

```
scraper/
+-- api.py                  # FastAPI endpoints
+-- cli.py                  # CLI wrapper
+-- config.py               # Default weights, search terms, target channels/feeds/sites
+-- celery_app.py           # Celery config + Redis connection
+-- db.py                   # SQLite schema, connection, queries
+-- tasks/
|   +-- orchestrator.py     # Top-level session task, time management
|   +-- papers.py           # PMC, Sci-Hub, JISSN, Frontiers, ACSM, NSCA, preprints
|   +-- youtube.py          # yt-dlp transcript extraction
|   +-- podcasts.py         # RSS + Whisper transcription
|   +-- articles.py         # trafilatura + site-specific scrapers
|   +-- books.py            # LibGen fetch + PDF/EPUB extraction
|   +-- reddit.py           # Reddit API scraping
+-- extractors/
|   +-- pdf.py              # PyMuPDF text extraction
|   +-- epub.py             # ebooklib chapter extraction
|   +-- transcript.py       # VTT/SRT cleaning
|   +-- audio.py            # Whisper transcription
|   +-- html.py             # trafilatura + BeautifulSoup
+-- utils/
|   +-- dedup.py            # Content hashing + SQLite dedup check
|   +-- classifier.py       # Category tagging (keyword + optional LLM)
|   +-- rate_limiter.py     # Per-source rate limiting
|   +-- quality.py          # Quality scoring
+-- exports/
|   +-- rag_export.py       # SQLite -> chunked RAG format
|   +-- finetune_export.py  # Claude synthesis -> JSONL (dormant)
+-- data/
|   +-- fitness_data.db     # SQLite database (created at runtime)
+-- requirements.txt
+-- Dockerfile              # For eventual Railway deployment
+-- README.md
```

---

## 11. Dependencies

```
# Core
fastapi
uvicorn
celery[redis]
redis

# Scraping & extraction
requests
trafilatura
beautifulsoup4
scholarly
yt-dlp
feedparser
PyMuPDF (fitz)
ebooklib
openai-whisper

# Utilities
langdetect
pydantic
click (CLI)
rich (terminal output)
```

---

## 12. Estimated Output

Per 12-hour session:

| Metric | Estimate |
|--------|----------|
| Total content items | 10,000-15,000 |
| Storage (SQLite) | 2-4 GB |
| Papers | ~4,000-6,000 |
| YouTube transcripts | ~2,000-3,000 |
| Articles | ~1,500-2,000 |
| Podcast transcripts | ~500-800 |
| Book chapters | ~500-700 |
| Reddit posts | ~500-800 |
| Error rate | < 1% |
| RAG chunks (post-export) | 50,000-80,000 |
| Fine-tune pairs (post-export) | 3,000-5,000 |
