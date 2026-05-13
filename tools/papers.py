#!/usr/bin/env python3
"""Research paper discovery, ingestion, and search pipeline."""

import argparse
import json
import os
import sys
import time
import re
from pathlib import Path
from xml.etree import ElementTree as ET

import requests
from dotenv import load_dotenv
from tqdm import tqdm

# Load env from project root .env.local
ENV_PATH = Path(__file__).parent.parent / ".env.local"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PUBMED_API_KEY = os.getenv("PUBMED_API_KEY")

DATA_DIR = Path(__file__).parent / "data"
MANIFEST_PATH = DATA_DIR / "papers.json"
PDF_DIR = DATA_DIR / "pdfs"

PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
OPENALEX_BASE = "https://api.openalex.org"
UNPAYWALL_BASE = "https://api.unpaywall.org/v2"
UNPAYWALL_EMAIL = "s21sharan@gmail.com"

# ---------------------------------------------------------------------------
# Search queries by topic
# ---------------------------------------------------------------------------

QUERIES = {
    "concurrent_training": [
        '"concurrent training" AND (strength OR endurance)',
        '"interference effect" AND (strength OR endurance)',
        '"combined resistance endurance training"',
    ],
    "supplements": [
        '"creatine supplementation" AND (strength OR "muscle mass")',
        '"protein timing" AND (anabolic OR "muscle protein synthesis")',
        '"caffeine" AND "exercise performance"',
        '"beta-alanine" AND "exercise performance"',
        '"dietary supplements" AND "athletic performance"',
    ],
    "lifting": [
        '"resistance training" AND hypertrophy',
        '"training volume" AND "muscle hypertrophy"',
        '"progressive overload" AND "resistance training"',
        '"periodization" AND "resistance training" AND strength',
    ],
}

REVIEW_FILTER = " AND (review[pt] OR meta-analysis[pt])"

# ---------------------------------------------------------------------------
# PubMed search and fetch
# ---------------------------------------------------------------------------


def pubmed_search(query: str, max_results: int = 500) -> list[str]:
    """Search PubMed and return list of PMIDs."""
    params = {
        "db": "pubmed",
        "term": query + REVIEW_FILTER,
        "retmax": max_results,
        "retmode": "json",
        "api_key": PUBMED_API_KEY,
    }
    resp = requests.get(f"{PUBMED_BASE}/esearch.fcgi", params=params)
    resp.raise_for_status()
    data = resp.json()
    return data.get("esearchresult", {}).get("idlist", [])


def pubmed_fetch(pmids: list[str]) -> list[dict]:
    """Fetch metadata for a list of PMIDs. Returns parsed article dicts."""
    if not pmids:
        return []
    papers = []
    # Batch in groups of 200
    for i in range(0, len(pmids), 200):
        batch = pmids[i : i + 200]
        params = {
            "db": "pubmed",
            "id": ",".join(batch),
            "rettype": "xml",
            "api_key": PUBMED_API_KEY,
        }
        resp = requests.get(f"{PUBMED_BASE}/efetch.fcgi", params=params)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        for article in root.findall(".//PubmedArticle"):
            paper = parse_pubmed_article(article)
            if paper:
                papers.append(paper)
        time.sleep(0.2)  # respect rate limits
    return papers


def parse_pubmed_article(article) -> dict | None:
    """Extract metadata from a PubmedArticle XML element."""
    medline = article.find(".//MedlineCitation")
    if medline is None:
        return None

    pmid_el = medline.find("PMID")
    pmid = pmid_el.text if pmid_el is not None else None
    if not pmid:
        return None

    art = medline.find("Article")
    if art is None:
        return None

    title_el = art.find("ArticleTitle")
    title = title_el.text if title_el is not None else "Unknown"

    # Authors
    author_list = art.find("AuthorList")
    authors = []
    if author_list is not None:
        for author in author_list.findall("Author"):
            last = author.find("LastName")
            init = author.find("Initials")
            if last is not None:
                name = last.text
                if init is not None:
                    name += f" {init.text}"
                authors.append(name)
    authors_str = ", ".join(authors) if authors else "Unknown"

    # Year
    pub_date = art.find(".//PubDate")
    year = None
    if pub_date is not None:
        year_el = pub_date.find("Year")
        if year_el is not None:
            year = int(year_el.text)
        else:
            medline_date = pub_date.find("MedlineDate")
            if medline_date is not None and medline_date.text:
                match = re.search(r"(\d{4})", medline_date.text)
                if match:
                    year = int(match.group(1))
    if year is None:
        year = 0

    # Journal
    journal_el = art.find(".//Journal/Title")
    journal = journal_el.text if journal_el is not None else None

    # Abstract
    abstract_parts = []
    abstract_el = art.find("Abstract")
    if abstract_el is not None:
        for abs_text in abstract_el.findall("AbstractText"):
            if abs_text.text:
                label = abs_text.get("Label", "")
                if label:
                    abstract_parts.append(f"{label}: {abs_text.text}")
                else:
                    abstract_parts.append(abs_text.text)
    abstract = " ".join(abstract_parts) if abstract_parts else None

    # DOI
    doi = None
    for eid in article.findall(".//ArticleIdList/ArticleId"):
        if eid.get("IdType") == "doi":
            doi = eid.text
            break

    # PMCID
    pmcid = None
    for eid in article.findall(".//ArticleIdList/ArticleId"):
        if eid.get("IdType") == "pmc":
            pmcid = eid.text
            break

    return {
        "pmid": pmid,
        "pmcid": pmcid,
        "doi": doi,
        "title": title,
        "authors": authors_str,
        "year": year,
        "journal": journal,
        "abstract": abstract,
        "citation_count": 0,
        "topics": [],
        "full_text_url": None,
        "source": None,
    }


# ---------------------------------------------------------------------------
# Enrichment (OpenAlex + Unpaywall)
# ---------------------------------------------------------------------------


def enrich_with_openalex(paper: dict) -> None:
    """Add citation count from OpenAlex. Mutates paper in place."""
    if not paper.get("doi"):
        return
    try:
        resp = requests.get(
            f"{OPENALEX_BASE}/works/doi:{paper['doi']}",
            params={"mailto": UNPAYWALL_EMAIL},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            paper["citation_count"] = data.get("cited_by_count", 0)
    except requests.RequestException:
        pass  # Keep default citation_count=0


def enrich_with_unpaywall(paper: dict) -> None:
    """Find open access PDF URL via Unpaywall. Mutates paper in place."""
    if not paper.get("doi"):
        return
    if paper.get("pmcid"):
        paper["full_text_url"] = (
            f"https://www.ncbi.nlm.nih.gov/pmc/articles/{paper['pmcid']}/"
        )
        paper["source"] = "pmc"
        return
    try:
        resp = requests.get(
            f"{UNPAYWALL_BASE}/{paper['doi']}",
            params={"email": UNPAYWALL_EMAIL},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            best = data.get("best_oa_location") or {}
            pdf_url = best.get("url_for_pdf") or best.get("url")
            if pdf_url:
                paper["full_text_url"] = pdf_url
                paper["source"] = "unpaywall"
    except requests.RequestException:
        pass


# ---------------------------------------------------------------------------
# Discovery command
# ---------------------------------------------------------------------------


def discover(count: int) -> None:
    """Search PubMed, enrich, rank, and write manifest."""
    print(
        f"Searching PubMed for reviews and meta-analyses (target: {count} papers)..."
    )

    # Collect PMIDs from all queries, tracking topic tags
    pmid_topics: dict[str, set[str]] = {}
    for topic, queries in QUERIES.items():
        for query in queries:
            print(f"  [{topic}] {query}")
            pmids = pubmed_search(query)
            print(f"    -> {len(pmids)} results")
            for pmid in pmids:
                if pmid not in pmid_topics:
                    pmid_topics[pmid] = set()
                pmid_topics[pmid].add(topic)
            time.sleep(0.15)

    all_pmids = list(pmid_topics.keys())
    print(f"\nTotal unique papers: {len(all_pmids)}")

    # Fetch metadata
    print("Fetching metadata from PubMed...")
    papers = pubmed_fetch(all_pmids)
    print(f"  Fetched {len(papers)} papers")

    # Assign topic tags
    for paper in papers:
        paper["topics"] = sorted(pmid_topics.get(paper["pmid"], set()))

    # Enrich with citation counts and OA URLs
    print("Enriching with OpenAlex citation counts...")
    for paper in tqdm(papers, desc="OpenAlex"):
        enrich_with_openalex(paper)
        time.sleep(0.05)

    print("Checking Unpaywall for open access PDFs...")
    for paper in tqdm(papers, desc="Unpaywall"):
        enrich_with_unpaywall(paper)
        time.sleep(0.05)

    # Rank by citation count, take top N
    papers.sort(key=lambda p: p["citation_count"], reverse=True)
    papers = papers[:count]

    # Set source for papers without full text
    for paper in papers:
        if not paper["source"]:
            paper["source"] = "abstract_only"

    # Stats
    full_text = sum(1 for p in papers if p["source"] in ("pmc", "unpaywall"))
    abstract_only = sum(1 for p in papers if p["source"] == "abstract_only")
    print(f"\nTop {len(papers)} papers by citation count:")
    print(f"  Full text available: {full_text}")
    print(f"  Abstract only: {abstract_only}")
    print(
        f"  Median citations: {papers[len(papers)//2]['citation_count'] if papers else 0}"
    )
    print(
        f"  Top cited: {papers[0]['citation_count'] if papers else 0} — {papers[0]['title'][:80] if papers else 'N/A'}"
    )

    # Write manifest
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Convert sets to lists for JSON serialization
    for paper in papers:
        if isinstance(paper["topics"], set):
            paper["topics"] = sorted(paper["topics"])

    with open(MANIFEST_PATH, "w") as f:
        json.dump(papers, f, indent=2)
    print(f"\nManifest written to {MANIFEST_PATH}")
    print(
        "Review the file and remove any unwanted papers, then run: python papers.py ingest"
    )


# ---------------------------------------------------------------------------
# Ingestion — download, parse, chunk, embed, insert
# ---------------------------------------------------------------------------


def download_pmc_xml(pmcid: str) -> str | None:
    """Download full text XML from PMC."""
    params = {
        "db": "pmc",
        "id": pmcid,
        "rettype": "xml",
        "api_key": PUBMED_API_KEY,
    }
    try:
        resp = requests.get(f"{PUBMED_BASE}/efetch.fcgi", params=params, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        print(f"  Failed to download PMC {pmcid}: {e}")
        return None


def extract_sections_from_pmc(xml_text: str) -> list[dict]:
    """Parse PMC XML into sections with heading and text."""
    sections = []
    root = ET.fromstring(xml_text)

    # Try to get abstract
    abstract_el = root.find(".//abstract")
    if abstract_el is not None:
        text = " ".join(abstract_el.itertext()).strip()
        if text:
            sections.append({"heading": "Abstract", "content": text})

    # Body sections
    body = root.find(".//body")
    if body is not None:
        for sec in body.findall(".//sec"):
            title_el = sec.find("title")
            heading = title_el.text if title_el is not None else "Body"
            # Get text from paragraphs, skip nested secs
            paragraphs = []
            for p in sec.findall("p"):
                text = " ".join(p.itertext()).strip()
                if text:
                    paragraphs.append(text)
            if paragraphs:
                sections.append({"heading": heading, "content": " ".join(paragraphs)})

    return sections


def download_pdf(url: str, dest: Path) -> bool:
    """Download a PDF file."""
    try:
        resp = requests.get(url, timeout=60, stream=True)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except requests.RequestException as e:
        print(f"  Failed to download PDF: {e}")
        return False


def extract_sections_from_pdf(pdf_path: Path) -> list[dict]:
    """Parse a PDF using Docling and extract sections."""
    try:
        from docling.document_converter import DocumentConverter

        converter = DocumentConverter()
        result = converter.convert(str(pdf_path))
        doc = result.document

        sections = []
        current_heading = "Body"
        current_text = []

        for item in doc.iterate_items():
            element = item[1] if isinstance(item, tuple) else item
            # Check for section headers
            label = getattr(element, "label", None) or ""
            text = getattr(element, "text", None) or ""

            if not text.strip():
                continue

            if "heading" in str(label).lower() or "title" in str(label).lower():
                # Save previous section
                if current_text:
                    sections.append(
                        {
                            "heading": current_heading,
                            "content": " ".join(current_text),
                        }
                    )
                current_heading = text.strip()
                current_text = []
            else:
                current_text.append(text.strip())

        # Save last section
        if current_text:
            sections.append(
                {
                    "heading": current_heading,
                    "content": " ".join(current_text),
                }
            )

        return sections
    except Exception as e:
        print(f"  Docling parsing failed: {e}")
        return []


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------


def estimate_tokens(text: str) -> int:
    """Rough token count (~0.75 words per token for English)."""
    return int(len(text.split()) / 0.75)


def chunk_text(
    text: str, max_tokens: int = 512, overlap_tokens: int = 50
) -> list[str]:
    """Split text into chunks of ~max_tokens with overlap."""
    words = text.split()
    max_words = int(max_tokens * 0.75)
    overlap_words = int(overlap_tokens * 0.75)

    if len(words) <= max_words:
        return [text]

    chunks = []
    start = 0
    while start < len(words):
        end = start + max_words
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start = end - overlap_words
        if start >= len(words):
            break
    return chunks


def build_chunks(paper: dict, sections: list[dict]) -> list[dict]:
    """Build chunks from paper sections with metadata prefix."""
    first_author = paper["authors"].split(",")[0].strip()
    prefix = f"[{first_author} et al. ({paper['year']})"

    chunks = []
    chunk_idx = 0

    for section in sections:
        section_prefix = f"{prefix} — {section['heading']}]"
        section_chunks = chunk_text(section["content"])
        for text in section_chunks:
            chunks.append(
                {
                    "chunk_index": chunk_idx,
                    "section": section["heading"].lower(),
                    "content": f"{section_prefix}\n{text}",
                }
            )
            chunk_idx += 1

    # If no sections extracted, use abstract as single chunk
    if not chunks and paper.get("abstract"):
        chunks.append(
            {
                "chunk_index": 0,
                "section": "abstract",
                "content": f"{prefix} — Abstract]\n{paper['abstract']}",
            }
        )

    return chunks


# ---------------------------------------------------------------------------
# Embedding and Supabase insertion
# ---------------------------------------------------------------------------


def embed_chunks(texts: list[str]) -> list[list[float]]:
    """Embed texts using OpenAI text-embedding-3-small."""
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY)

    all_embeddings = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        resp = client.embeddings.create(
            model="text-embedding-3-small",
            input=batch,
        )
        all_embeddings.extend([e.embedding for e in resp.data])
        if i + batch_size < len(texts):
            time.sleep(0.5)
    return all_embeddings


def insert_paper(
    paper: dict, chunks: list[dict], embeddings: list[list[float]]
) -> bool:
    """Insert a paper and its chunks into Supabase."""
    from supabase import create_client

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Check if paper already exists
    if paper.get("doi"):
        existing = (
            sb.table("research_papers").select("id").eq("doi", paper["doi"]).execute()
        )
        if existing.data:
            print(f"  Skipping (already exists): {paper['title'][:60]}")
            return False

    # Determine source_type
    source_map = {
        "pmc": "full_text_pmc",
        "unpaywall": "full_text_pdf",
        "abstract_only": "abstract_only",
    }
    source_type = source_map.get(paper.get("source", ""), "abstract_only")

    # Insert paper
    paper_row = {
        "pmid": paper.get("pmid"),
        "doi": paper.get("doi"),
        "title": paper["title"],
        "authors": paper["authors"],
        "year": paper["year"],
        "journal": paper.get("journal"),
        "abstract": paper.get("abstract"),
        "citation_count": paper.get("citation_count", 0),
        "topics": paper.get("topics", []),
        "source_type": source_type,
    }
    result = sb.table("research_papers").insert(paper_row).execute()
    paper_id = result.data[0]["id"]

    # Insert chunks with embeddings
    for chunk, embedding in zip(chunks, embeddings):
        chunk_row = {
            "paper_id": paper_id,
            "chunk_index": chunk["chunk_index"],
            "section": chunk["section"],
            "content": chunk["content"],
            "embedding": embedding,
        }
        sb.table("research_chunks").insert(chunk_row).execute()

    return True


# ---------------------------------------------------------------------------
# Ingest command
# ---------------------------------------------------------------------------


def ingest() -> None:
    """Read manifest, download full text, parse, chunk, embed, insert."""
    if not MANIFEST_PATH.exists():
        print(f"No manifest found at {MANIFEST_PATH}. Run 'discover' first.")
        sys.exit(1)

    with open(MANIFEST_PATH) as f:
        papers = json.load(f)

    print(f"Ingesting {len(papers)} papers...")

    total_chunks = 0
    inserted = 0
    skipped = 0
    errors = 0

    for paper in tqdm(papers, desc="Papers"):
        try:
            # Step 1: Get sections
            sections = []

            if paper.get("source") == "pmc" and paper.get("pmcid"):
                xml = download_pmc_xml(paper["pmcid"])
                if xml:
                    sections = extract_sections_from_pmc(xml)
                    time.sleep(0.2)

            elif paper.get("source") == "unpaywall" and paper.get("full_text_url"):
                pdf_path = PDF_DIR / f"{paper['pmid'] or paper['doi'].replace('/', '_')}.pdf"
                if not pdf_path.exists():
                    download_pdf(paper["full_text_url"], pdf_path)
                if pdf_path.exists():
                    sections = extract_sections_from_pdf(pdf_path)

            # Fall back to abstract
            if not sections and paper.get("abstract"):
                sections = [{"heading": "Abstract", "content": paper["abstract"]}]

            if not sections:
                print(f"  No content for: {paper['title'][:60]}")
                errors += 1
                continue

            # Step 2: Chunk
            chunks = build_chunks(paper, sections)
            if not chunks:
                errors += 1
                continue

            # Step 3: Embed
            texts = [c["content"] for c in chunks]
            embeddings = embed_chunks(texts)

            # Step 4: Insert
            if insert_paper(paper, chunks, embeddings):
                inserted += 1
                total_chunks += len(chunks)
            else:
                skipped += 1

        except Exception as e:
            print(
                f"  Error processing {paper.get('title', 'unknown')[:60]}: {e}"
            )
            errors += 1

    print(f"\nDone!")
    print(f"  Inserted: {inserted} papers, {total_chunks} chunks")
    print(f"  Skipped (already in DB): {skipped}")
    print(f"  Errors: {errors}")


# ---------------------------------------------------------------------------
# Stats command
# ---------------------------------------------------------------------------


def stats() -> None:
    """Show knowledge base statistics."""
    from supabase import create_client

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    papers = (
        sb.table("research_papers")
        .select("id, source_type, topics, citation_count")
        .execute()
    )
    chunks = sb.table("research_chunks").select("id, paper_id").execute()

    if not papers.data:
        print("Knowledge base is empty. Run 'discover' then 'ingest' first.")
        return

    total_papers = len(papers.data)
    total_chunks = len(chunks.data)

    by_source = {}
    by_topic = {}
    for p in papers.data:
        src = p["source_type"]
        by_source[src] = by_source.get(src, 0) + 1
        for t in p.get("topics") or []:
            by_topic[t] = by_topic.get(t, 0) + 1

    citations = [p["citation_count"] or 0 for p in papers.data]
    citations.sort(reverse=True)

    print(f"Research Knowledge Base")
    print(f"{'='*40}")
    print(f"Papers: {total_papers}")
    print(f"Chunks: {total_chunks}")
    print(f"Avg chunks/paper: {total_chunks / total_papers:.1f}")
    print(f"\nBy source type:")
    for src, count in sorted(by_source.items()):
        print(f"  {src}: {count}")
    print(f"\nBy topic:")
    for topic, count in sorted(by_topic.items()):
        print(f"  {topic}: {count}")
    print(f"\nCitation stats:")
    print(f"  Max: {citations[0]}")
    print(f"  Median: {citations[len(citations)//2]}")
    print(f"  Min: {citations[-1]}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Research paper pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    discover_cmd = sub.add_parser("discover", help="Search PubMed and rank papers")
    discover_cmd.add_argument(
        "--count", type=int, default=80, help="Number of papers to output"
    )

    sub.add_parser("ingest", help="Ingest approved papers into Supabase")
    sub.add_parser("stats", help="Show knowledge base stats")

    args = parser.parse_args()

    if args.command == "discover":
        discover(args.count)
    elif args.command == "ingest":
        ingest()
    elif args.command == "stats":
        stats()


if __name__ == "__main__":
    main()
