# Vector & Embedding Layer

> **⚠️ POST-MVP — Vector embeddings and semantic search are post-MVP per GLOSSARY.md > MVP Scope Summary. MVP — Foundation installs the pgvector extension and creates empty tables as extension points, but embedding generation and semantic retrieval activate post-MVP.**
>
> What gets embedded, schema, computation triggers, provider abstraction, AI context retrieval, hybrid search, embedding cost model, and phasing.
> Cross-references: `cockroachdb-readiness.md` (pgvector → CockroachDB C-SPANN vector index migration, HNSW → C-SPANN syntax translation), `gaps/knowledge-base-live-chat-ai.md` (knowledge_embeddings table — chunked Smart Doc content for Live Chat AI retrieval; heading-aware semantic chunking strategy; hybrid search via RRF identical to Command Bar pattern; extends "What Gets Embedded" with KB articles), `personal-notes-capture.md` (personal notes > 500 tokens use chunked embeddings via `knowledge_embeddings` table, same chunking strategy as KB articles, scoped by `table_id` to personal tables)
> Last updated: 2026-02-27 — Batch re-verification against GLOSSARY.md: all terminology confirmed aligned (Command Bar, SDS, Record View, App Designer annotations all correct); no naming drift; post-MVP scope correctly tagged throughout; cross-references to cockroachdb-readiness.md, gaps/knowledge-base-live-chat-ai.md, and personal-notes-capture.md verified current. Prior reconciliation (2026-02-27): added post-MVP banner per GLOSSARY.md MVP scope (vector embeddings / semantic search = post-MVP); annotated portal embeddings as post-MVP App Designer portal content (MVP Quick Portals share a Record View layout, not page/block structures); annotated Phase implementation with post-MVP notes. Prior: 2026-02-22 — Added `personal-notes-capture.md` cross-reference. Prior: `gaps/knowledge-base-live-chat-ai.md` cross-reference.

---

## Why Embeddings

As tenants grow to 30+ tables with 200+ fields, the AI Context Builder cannot include all schema in every prompt. Keyword search (`tsvector`) misses semantic matches — "overdue projects" won't find records where the field is `delivery_status` with value `at_risk`. The platform needs a semantic retrieval layer.

**Solution:** `pgvector` on existing PostgreSQL. Same database, same partitioning, same tenant isolation, same backups. No new infrastructure.

---

## What Gets Embedded

| Entity                                                                                                                           | Source Text                                                              | Table                        | Updated When                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Table schema                                                                                                                     | Name + description + all field names/types/descriptions                  | `table_embeddings`           | Table or field created/renamed/deleted                                                                                                                                                     |
| Field definitions                                                                                                                | Name + type + description + sample values                                | `field_embeddings`           | Field created/renamed/reconfigured                                                                                                                                                         |
| Record summaries                                                                                                                 | Primary field + display fields (first 500 tokens)                        | `record_embeddings`          | Record created/updated, inbound sync                                                                                                                                                       |
| Portal content **(post-MVP — App Designer portals only; MVP Quick Portals are Record View shares without page/block structure)** | Page title + block labels + static text                                  | `portal_embeddings`          | App published/updated                                                                                                                                                                      |
| Prompt templates                                                                                                                 | Description + system instruction summary                                 | `prompt_template_embeddings` | Template version updated                                                                                                                                                                   |
| Knowledge base articles                                                                                                          | Article title + heading path + section content (chunked, 400–500 tokens) | `knowledge_embeddings`       | Smart Doc content field saved (published articles only). See `gaps/knowledge-base-live-chat-ai.md`.                                                                                        |
| Personal notes (long)                                                                                                            | Note title + heading path + section content (chunked, 400–500 tokens)    | `knowledge_embeddings`       | Personal note saved (when content > 500 tokens). Same chunking strategy as KB articles, scoped by `table_id` to personal tables. See `personal-notes-capture.md` > Full-Content Embedding. |

**NOT embedded:** Raw JSONB cell values, full rich text bodies (except knowledge base articles and long personal notes, which are chunked and embedded via `knowledge_embeddings`), audit logs, conversation history.

**File attachments:** Embedded via separate `file_embeddings` table — extracted text, AI descriptions, and AI tags are embedded for content search. See `document-intelligence.md` > Content Search Integration.

---

## Schema

```sql
CREATE TABLE record_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  record_id UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  table_id UUID NOT NULL,
  content_hash VARCHAR(64) NOT NULL,   -- SHA-256; skip re-embedding if unchanged
  embedding vector(1024) NOT NULL,
  source_text TEXT NOT NULL,            -- For debugging/re-embedding
  model_id VARCHAR(100) NOT NULL,       -- For re-embedding on model change
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY HASH (tenant_id);

-- HNSW index for approximate nearest neighbor
CREATE INDEX idx_record_embeddings_vector ON record_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Dimension:** Set by active embedding model's output. Stored in config alongside model ID. Model change triggers background re-embedding — `model_id` identifies current vs stale.

**Tenant isolation:** All tables include `tenant_id`, hash-partitioned identically to `records`. Vector searches always include `WHERE tenant_id = $1` — partition pruning before index scan.

---

## When Embeddings Are Computed

**Never in the request path.** All embedding generation runs asynchronously via BullMQ:

| Trigger                      | Job                       | Priority               |
| ---------------------------- | ------------------------- | ---------------------- |
| Record created/updated       | `embedding.record.upsert` | Low                    |
| Inbound sync batch completes | `embedding.records.batch` | Low                    |
| Table/field schema changed   | `embedding.schema.upsert` | Medium                 |
| App published (post-MVP)     | `embedding.portal.upsert` | Low                    |
| Embedding model changed      | `embedding.recompute.all` | Background (throttled) |

**Content hash deduplication:** SHA-256 of source text computed before generating. If hash matches existing `content_hash`, embedding is skipped. Prevents redundant API calls when non-display fields change.

**Batch efficiency:** Embedding APIs support batch requests. Worker accumulates jobs and dispatches in batches of 50–100.

---

## Embedding Provider Abstraction

```typescript
// packages/shared/ai/embeddings/provider.ts
interface EmbeddingProvider {
  readonly providerId: string; // 'anthropic', 'openai', 'self-hosted'
  readonly modelId: string; // 'text-embedding-3-small', 'voyage-3', etc.
  readonly dimensions: number;

  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
  estimateCost(tokenCount: number): number;
}
```

**Current plan:** OpenAI `text-embedding-3-small` (1536 dims, ~$0.02/1M tokens) or Anthropic's embedding offering. Provider choice independent of LLM provider.

**Self-hosted (future):** Small models (`all-MiniLM-L6-v2`, `nomic-embed-text`) run on CPU. Fixed infrastructure cost, zero per-token cost. Adapter targets internal HTTP endpoint.

---

## AI Context Retrieval

The Context Builder uses embeddings to select the most relevant schema and records per prompt:

```
User query: "Show me all projects that are behind schedule"

1. Embed query → query_vector
2. Schema retrieval: Top 5 tables by cosine similarity
   → Returns: "Projects", "Deliverables", "Milestones"
   → Skips: "Invoices", "Contacts", "Marketing Materials"
3. Field retrieval: Top 20 fields within selected tables
   → Returns: "delivery_status", "due_date", "project_name"
   → Skips: "internal_notes", "thumbnail_url"
4. Sample records: Top 10 records by similarity
5. Assemble prompt with only retrieved context
   → 3 tables, 20 fields, 10 samples vs 30 tables, 200 fields
```

**Context budget:** Configurable token budget per prompt (e.g., 4,000 tokens). Semantic retrieval ensures budget spent on relevant information.

**Schema Descriptor Service:** The SDS (`schema-descriptor-service.md`) provides the structured, permission-filtered schema that the Context Builder operates on. The SDS handles schema discovery and token budget condensation; embeddings handle semantic relevance ranking within that schema. The SDS's `condenseDescriptor()` and this layer's cosine-similarity retrieval are complementary — SDS for structure, embeddings for relevance.

**Graceful fallback:** When embeddings unavailable (new tenant, jobs processing), Context Builder falls back to heuristic selection: tables in current view, recently accessed, most records. AI features work from day one.

---

## Command Bar Search Pipeline

The Command Bar is the primary search surface. When a user types a query, four search channels execute in parallel and results are merged, ranked, and grouped.

### Search Channels

| Channel                       | Source                                                               | Method                                                     | Latency Budget | Max Results           |
| ----------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | -------------- | --------------------- |
| **1. Commands & Navigation**  | Static command registry + recently visited pages                     | In-memory prefix match (client-side, no server call)       | <5ms           | 5                     |
| **2. Entity Search**          | Table names, view names, field names, automation names, portal names | ILIKE query per entity type (5 parallel queries)           | <10ms          | 5 per type (25 total) |
| **3. Record Keyword Search**  | `records.search_vector` (tsvector)                                   | `to_tsquery` with prefix matching across all tenant tables | <50ms          | 20                    |
| **4. Record Semantic Search** | `record_embeddings` (pgvector)                                       | Cosine similarity on query embedding                       | <100ms         | 20                    |

**Knowledge base articles in search:** Channel 4 also queries `knowledge_embeddings` — KB articles surface in Command Bar search for internal workspace users, alongside regular record results. See `gaps/knowledge-base-live-chat-ai.md`.

**Total latency target: <200ms** for the merged result set. Channels 1–3 return near-instantly; channel 4 (embedding) is the long pole.

### Result Merging via Reciprocal Rank Fusion (RRF)

Records from channels 3 and 4 are merged using RRF:

```
For each record appearing in either result set:
  combined_score = 1/(k + keyword_rank) + 1/(k + semantic_rank)

If a record appears in both sets → boosted (dual signal)
If a record appears in only one set → still included (single signal)
```

**RRF constant `k`:** Default 60. Tunable globally or per-tenant. Higher k reduces the advantage of top-ranked results; lower k makes top results dominate.

**Why RRF, not weighted score combination:** tsvector and pgvector return fundamentally different score types (BM25-like rank vs cosine distance). RRF uses rank positions, not raw scores, making it score-agnostic and robust.

### Result Grouping in UI

Results are displayed in groups, not a flat list:

```
┌─────────────────────────────────────────────┐
│ 🔍 "overdue proj"                           │
├─────────────────────────────────────────────┤
│ ⌨️ Commands                                 │
│   → Go to Projects table                    │
│   → Create new Project                      │
│                                             │
│ 📋 Tables & Views                           │
│   → Projects (table)                        │
│   → Project Milestones (table)              │
│   → Overdue Items (My View)              │
│                                             │
│ 📝 Records                              (RRF merged) │
│   → "Project Alpha" — at risk, due Jan 15   │
│   → "Q1 Deliverable" — overdue, due Feb 1   │
│   → "Project Beta Kickoff" — planning        │
│                                             │
│ 🤖 Ask AI                                   │
│   → "Show me all overdue projects"          │
└─────────────────────────────────────────────┘
```

**Group ordering:** Commands → Entities → Records → AI suggestion. Within each group, results are ordered by relevance (RRF score for records, match quality for entities, recency for commands).

**AI suggestion:** Always shown as the last item. Clicking it opens the Command Bar's conversational AI mode with the query pre-filled.

### Graceful Degradation

| Condition                                             | Behavior                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Embeddings not yet generated (new tenant, processing) | Skip channel 4 (semantic). Return only keyword + entity results. No visible error. |
| Query too short (<2 characters)                       | Show recent items + top commands only. No search executed.                         |
| pgvector query timeout (>200ms)                       | Return results from channels 1–3. Semantic results omitted silently.               |
| Empty results across all channels                     | Show "No results" + AI suggestion: "Ask AI about {query}"                          |

### Performance at Scale

| Tenant Size  | Record Keyword (ch 3) | Record Semantic (ch 4) | Total  |
| ------------ | --------------------- | ---------------------- | ------ |
| 10K records  | <10ms                 | <30ms                  | <50ms  |
| 100K records | <25ms                 | <60ms                  | <100ms |
| 500K records | <50ms                 | <100ms                 | <150ms |
| 1M+ records  | <80ms                 | <150ms                 | <200ms |

Partition pruning (by `tenant_id`) ensures these times hold regardless of total platform size. A tenant with 100K records in a 100M-record database still gets <100ms search.

---

## Embedding Cost & Credits

Embedding generation does **not** consume workspace AI credits — it's platform infrastructure. Costs absorbed by EveryStack, tracked internally.

**Estimated costs (OpenAI text-embedding-3-small):**

- ~$0.02 per 1M tokens
- Average record: ~50 tokens → $0.001 per 1,000 records
- 50K-record tenant: ~$1 total — negligible

**Self-hosted embeddings eliminate this cost entirely** — strong motivation for the self-hosted path at scale.

---

## Phase Implementation

> **Note:** All phases below are post-MVP per GLOSSARY.md. MVP — Foundation work (installing pgvector, creating empty tables) is a clean extension point — no active embedding generation until post-MVP activation.

| Phase                                  | Embedding Work                                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation (MVP extension point) | Install pgvector extension. Create embedding tables (empty). `EmbeddingProvider` interface. Embedding job definitions (no-op until post-MVP activation). |
| Post-MVP MVP — Core UX                 | Activate: schema + record embedding generation, Context Builder semantic retrieval, Command Bar hybrid search with RRF.                                  |
| Post-MVP Post-MVP — Documents+         | App content embeddings. Prompt template embeddings. Self-hosted evaluation.                                                                              |
