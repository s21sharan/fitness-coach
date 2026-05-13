-- ============================================================
-- RESEARCH KNOWLEDGE BASE
-- ============================================================

-- Papers metadata
create table public.research_papers (
  id uuid primary key default gen_random_uuid(),
  pmid text unique,
  doi text unique,
  title text not null,
  authors text not null,
  year integer not null,
  journal text,
  abstract text,
  citation_count integer,
  topics text[],
  source_type text not null check (source_type in ('full_text_pmc', 'full_text_pdf', 'abstract_only')),
  created_at timestamptz not null default now()
);

-- Chunked content with embeddings
create table public.research_chunks (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.research_papers(id) on delete cascade,
  chunk_index integer not null,
  section text,
  content text not null,
  embedding halfvec(1536),
  created_at timestamptz not null default now(),
  unique (paper_id, chunk_index)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- HNSW index for vector similarity search
create index research_chunks_embedding_idx
  on public.research_chunks
  using hnsw (embedding halfvec_cosine_ops);

-- GIN index for full-text search (hybrid search)
create index research_chunks_content_fts_idx
  on public.research_chunks
  using gin (to_tsvector('english', content));

-- B-tree index for paper lookups
create index research_chunks_paper_id_idx
  on public.research_chunks (paper_id);

-- ============================================================
-- RPC: match_research_chunks
-- ============================================================

create or replace function match_research_chunks(
  query_embedding halfvec(1536),
  match_threshold float default 0.3,
  match_count int default 5
)
returns table (
  id uuid,
  paper_id uuid,
  paper_title text,
  authors text,
  year integer,
  journal text,
  doi text,
  content text,
  section text,
  similarity float
)
language sql stable
as $$
  select
    rc.id,
    rc.paper_id,
    rp.title as paper_title,
    rp.authors,
    rp.year,
    rp.journal,
    rp.doi,
    rc.content,
    rc.section,
    1 - (rc.embedding <=> query_embedding) as similarity
  from public.research_chunks rc
  join public.research_papers rp on rp.id = rc.paper_id
  where rc.embedding is not null
    and 1 - (rc.embedding <=> query_embedding) > match_threshold
  order by rc.embedding <=> query_embedding asc
  limit match_count;
$$;
