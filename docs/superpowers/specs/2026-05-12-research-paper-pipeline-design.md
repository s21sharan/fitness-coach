# Research Paper Pipeline — Design Spec

**Date:** 2026-05-12
**Status:** Approved

## Overview

Automated pipeline to collect, parse, and embed ~50-80 curated exercise science research papers into a Supabase pgvector knowledge base. The AI coach gains a `search_research` tool to cite real studies when making recommendations.

**Philosophy:** Greatest hits — reviews and meta-analyses ranked by citation count. User reviews the curated list before ingestion. Full text where available (PMC/Unpaywall), abstract fallback for paywalled papers.

## Architecture

```
discover             ingest                    coach
─────────           ────────                 ────────
PubMed API    →   PMC/Unpaywall PDF    →   User asks question
OpenAlex API  →   Docling parse        →   Claude calls search_research
                  Section chunking     →   Embed query → pgvector cosine search
                  OpenAI embed         →   Return top chunks + paper metadata
                  Supabase insert      →   Coach cites in "Sources:" footer
```

## Part 1: Discovery CLI

**Command:** `python tools/papers.py discover --count 80`

### Search Strategy

Queries PubMed E-utilities (`esearch` + `efetch`) for reviews and meta-analyses. Each query appends `AND (review[pt] OR meta-analysis[pt])`.

**Concurrent training queries:**
- `"concurrent training" AND (strength OR endurance)`
- `"interference effect" AND (strength OR endurance)`
- `"combined resistance endurance training"`

**Supplement queries:**
- `"creatine supplementation" AND (strength OR "muscle mass")`
- `"protein timing" AND (anabolic OR "muscle protein synthesis")`
- `"caffeine" AND "exercise performance"`
- `"beta-alanine" AND "exercise performance"`
- `"dietary supplements" AND "athletic performance"`

**Lifting science queries:**
- `"resistance training" AND hypertrophy`
- `"training volume" AND "muscle hypertrophy"`
- `"progressive overload" AND "resistance training"`
- `"periodization" AND "resistance training" AND strength`
- `"rep range" OR "repetition range" AND hypertrophy`

### Topic Tagging

Each paper is tagged based on which query category found it:
- Concurrent training queries → `"concurrent_training"`
- Supplement queries → `"supplements"`
- Lifting science queries → `"lifting"`

Papers found by multiple categories get multiple tags.

### Enrichment

For each unique paper (deduplicated by PMID):
1. Extract DOI from PubMed XML
2. Query OpenAlex (`GET /works?filter=doi:{doi}`) for `cited_by_count`
3. Check for PMCID via PubMed ELink
4. Check Unpaywall (`GET /v2/{doi}?email=s21sharan@gmail.com`) for open access PDF URL

### Output

Writes `tools/data/papers.json` — sorted by citation count descending, top N papers:

```json
[
  {
    "pmid": "28698222",
    "pmcid": "PMC5765787",
    "doi": "10.1519/JSC.0000000000002200",
    "title": "Dose-response relationship between weekly RT volume and...",
    "authors": "Schoenfeld BJ, Ogborn D, Krieger JW",
    "year": 2017,
    "journal": "J Strength Cond Res",
    "abstract": "...",
    "citation_count": 847,
    "topics": ["hypertrophy", "volume"],
    "full_text_url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5765787/",
    "source": "pmc"
  }
]
```

User reviews this file and removes any unwanted papers before running ingest.

## Part 2: Ingestion CLI

**Command:** `python tools/papers.py ingest`

### Step 1: Download Full Text

For each paper in the approved manifest:
1. If `pmcid` exists → fetch full text XML from PMC via `efetch` (`db=pmc`)
2. Else if `full_text_url` exists (from Unpaywall) → download PDF to `tools/data/pdfs/`
3. Else → abstract-only (no download)

### Step 2: Parse

- **PMC XML:** Parse directly — already has structured sections, tables, references
- **PDF files:** Parse with Docling → structured Markdown with sections
- **Abstract-only:** Use the abstract text from the manifest as a single chunk

### Step 3: Chunk

- Section-based chunking: split by paper sections (Abstract, Introduction, Methods, Results, Discussion, Conclusion)
- Sections exceeding 512 tokens → recursively split at paragraph boundaries
- 50-token overlap between chunks
- Each chunk prefixed with metadata: `[Author et al. (Year) — Section]`

### Step 4: Embed

- Batch embed all chunks with OpenAI `text-embedding-3-small` (1536 dimensions)
- Batches of 100 chunks per API call
- Respect rate limits

### Step 5: Insert

- Insert paper metadata into `research_papers`
- Insert chunks + embeddings into `research_chunks`
- Idempotent: skip papers already in DB (matched by DOI)
- Print progress and final stats

### Storage

- Downloaded PDFs: `tools/data/pdfs/` (gitignored)
- Manifest: `tools/data/papers.json` (committed)

## Part 3: Database Schema

Migration: `supabase/migrations/007_research_knowledge_base.sql`

### Tables

**`research_papers`**

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, gen_random_uuid() |
| pmid | text | nullable, unique |
| doi | text | nullable, unique |
| title | text | NOT NULL |
| authors | text | NOT NULL |
| year | integer | NOT NULL |
| journal | text | nullable |
| abstract | text | nullable |
| citation_count | integer | nullable |
| topics | text[] | nullable |
| source_type | text | 'full_text_pmc', 'full_text_pdf', 'abstract_only' |
| created_at | timestamptz | default now() |

**`research_chunks`**

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, gen_random_uuid() |
| paper_id | uuid | FK → research_papers(id) ON DELETE CASCADE |
| chunk_index | integer | NOT NULL |
| section | text | nullable ('abstract', 'results', etc.) |
| content | text | NOT NULL |
| embedding | halfvec(1536) | nullable |
| created_at | timestamptz | default now() |

**Unique constraint:** `(paper_id, chunk_index)`

### Indexes

- HNSW on `research_chunks.embedding` with `halfvec_cosine_ops`
- GIN on `to_tsvector('english', content)` for future hybrid search
- B-tree on `research_chunks.paper_id`

### RPC Function

`match_research_chunks(query_embedding, match_threshold, match_count)` — cosine similarity search joining chunks to paper metadata. Returns: paper title, authors, year, journal, doi, chunk content, section, similarity score.

No RLS policies — research papers are global, written by ingestion script using service role key.

## Part 4: Coach Integration

### New Tool: `search_research`

**File:** `src/lib/chat/tools/search-research.ts`

Follows the existing tool pattern (`tool()` from `ai`, `inputSchema` with zod):

- **Input:** `{ query: string, max_results?: number (default 5, max 10) }`
- **Execute:** Embed query with `text-embedding-3-small` via `@ai-sdk/openai` + AI SDK `embed()`, call `match_research_chunks` RPC
- **Returns:** `{ title, authors, year, journal, doi, excerpt, section, similarity }[]`

Registered in `src/lib/chat/tools/index.ts` and wired into `src/app/api/chat/route.ts`.

### System Prompt Updates

Added to guidelines in `buildSystemPrompt()`:

```
- You have access to a knowledge base of exercise science research papers via search_research
- When making training, nutrition, or recovery recommendations, search for supporting evidence
- Present your recommendation first, then add a "Sources:" section at the end with 1-3 citations
- Format citations as: Author et al. (Year) — "Paper Title", Journal
- Don't over-cite — only cite when the evidence meaningfully supports your advice
- Don't cite for obvious/basic advice
```

### New Dependencies

- `@ai-sdk/openai` — for `embed()` with `text-embedding-3-small`

### New Environment Variable

- `OPENAI_API_KEY` in `.env.local`

## Part 5: File Structure

### New Files

```
tools/
  papers.py              # Main CLI (discover, ingest, stats subcommands)
  requirements.txt       # Python: requests, docling, supabase, openai, tqdm, python-dotenv

tools/data/
  papers.json            # Generated manifest (committed after review)
  pdfs/                  # Downloaded PDFs (gitignored)
  .gitkeep

src/lib/chat/tools/
  search-research.ts     # New coach tool

supabase/migrations/
  007_research_knowledge_base.sql
```

### Updated Files

```
src/lib/chat/tools/index.ts        # Add search_research export
src/app/api/chat/route.ts          # Wire search_research into tools
src/lib/chat/system-prompt.ts      # Add citation guidelines
package.json                       # Add @ai-sdk/openai
.gitignore                         # Add tools/data/pdfs/
```

### CLI Usage

```bash
# Set up Python env
cd tools && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# Step 1: Discover papers
python papers.py discover --count 80

# Step 2: Review tools/data/papers.json, remove unwanted papers

# Step 3: Ingest into Supabase
python papers.py ingest

# Check what's in the DB
python papers.py stats
```

Environment variables read from `../.env.local` (project root).

## Out of Scope

- Hybrid search (BM25 + vector) — add later if pure vector search proves insufficient
- Automatic re-ingestion / paper updates — manual re-run for now
- User-specific paper bookmarks or preferences
- PDF text extraction for non-Latin scripts
- Citation graph traversal (finding papers that cite papers in the KB)
