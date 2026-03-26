# Knowledge Base — Live Chat AI Blind Spot

> **📋 Reconciliation Note (2026-02-27):** Reconciled with `GLOSSARY.md` (source of truth).
> **Changes made:**
>
> - Marked **entire document as POST-MVP**. Per glossary MVP Scope Summary, both "Wiki / Knowledge Base" and "Commerce embeds, live chat widget" are explicitly post-MVP
> - Renamed "Comms Hub" / "Communications Hub" → **thread model** / **communications model** (glossary: don't use "Communications Hub"; use **Record Thread** for record-level or **Chat** for personal DMs)
> - Renamed "base-level" → **workspace-level** throughout (glossary term: Workspace, not Base)
> - Clarified "Website Mode" → post-MVP **App** type (Website) built in the **App Designer** per glossary
> - Added post-MVP labels to all phase references (Post-MVP — Documents wiki, Post-MVP — Custom Apps/9b)
> - Updated cross-reference language to use glossary terms
> - Vector embeddings / semantic search explicitly tagged as post-MVP per glossary
> - AI Agents references tagged as post-MVP per glossary

> **⚠️ ENTIRE DOCUMENT IS POST-MVP.** Per `GLOSSARY.md` MVP Scope Summary, the following features referenced in this document are all post-MVP:
>
> - Wiki / Knowledge Base (post-MVP)
> - Commerce embeds, live chat widget (post-MVP)
> - Vector embeddings / semantic search (post-MVP)
> - AI Agents (autonomous multi-step) (post-MVP)
> - Full communications hub (post-MVP)
> - App Designer and all App types including Website (post-MVP)
>
> This document specifies the integration between these post-MVP systems. It remains valuable as a future roadmap spec, but **none of this should be built during MVP**. Build clean extension points, but don't build the extensions.

> **Gap document (post-MVP).** The embeddable-extensions spec promises "AI auto-responses from knowledge base" for Live Chat, but no knowledge base concept is defined. This document specifies a lightweight knowledge base layer that connects existing Smart Docs wiki content to the Live Chat AI pipeline — and simultaneously serves as a public help center (Website App type in the App Designer) and internal team reference (Smart Docs wiki view). Three surfaces, one content source, almost entirely built from existing pieces.
> Cross-references: `smart-docs.md` (wiki table_type, wiki_table_config, Smart Doc content field, TipTap JSON storage — **post-MVP**), `vector-embeddings.md` (embedding pipeline, EmbeddingProvider, content-hash dedup, Command Bar hybrid search — **post-MVP**), `embeddable-extensions.md` (Website App type "Documentation / Knowledge Base" template, Live Chat AI auto-responses — **post-MVP**), `document-intelligence.md` (file_embeddings pattern, content search integration), `agent-architecture.md` (workspace_knowledge — distinct concept, agent-to-agent memory, not customer-facing — **post-MVP**), `communications.md` (thread model, thread_messages), `ai-architecture.md` (provider abstraction, capability tiers), `ai-metering.md` (credit costs for Live Chat AI Responses — standard tier, 1–3 credits), `personal-notes-capture.md` (knowledge_embeddings table shared with personal note chunked embeddings — same schema, scoped by table_id to personal tables; same chunking strategy from flattenTipTapToSections — **post-MVP**)
> Last updated: 2026-02-27 — Glossary reconciliation (naming, MVP scope tagging). Prior: 2026-02-22 — Added `personal-notes-capture.md` cross-reference. Prior: Initial specification.

---

## The Problem (Post-MVP Context)

> **⚠️ POST-MVP:** All features described in this section are post-MVP per `GLOSSARY.md`.

Five docs reference "knowledge base" in different contexts, but none define a unified concept:

| Doc                                 | Reference                                                                                 | What It Describes                                                            | What's Missing                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `embeddable-extensions.md` line 450 | "AI auto-responses from knowledge base" (**post-MVP**)                                    | Live Chat AI answering visitor questions                                     | No spec for what "knowledge base" is, where content lives, how retrieval works     |
| `embeddable-extensions.md` line 91  | Website App type template: "Documentation / Knowledge Base" (**post-MVP** — App Designer) | A rendering surface — sidebar nav + rich text pages                          | No spec connecting this template to a specific data source                         |
| `smart-docs.md` line 12–14          | Wiki table_type as "workspace-level knowledge base" (**post-MVP**)                        | Content authoring — records as pages, Smart Doc body, nesting, status        | No spec connecting published wiki content to AI retrieval or Live Chat             |
| `vector-embeddings.md` line 26–27   | "NOT embedded: full rich text bodies" (**post-MVP**)                                      | Record embeddings use only display fields (first 500 tokens)                 | Wiki article bodies — the actual content that answers questions — are not embedded |
| `agent-architecture.md` line 281    | `workspace_knowledge` table (**post-MVP** — AI Agents)                                    | Agent-to-agent institutional memory ("invoices over $10k need CFO approval") | Different purpose entirely — not customer-facing help content                      |

The result: three existing pieces (content authoring, rendering surface, AI retrieval pipeline) that don't know about each other, and a deliverable with a phantom dependency.

---

## Design Principle: One Content Source, Three Surfaces

> **⚠️ POST-MVP:** All three surfaces described here are post-MVP per `GLOSSARY.md`.

A knowledge base article is a **wiki record with a Smart Doc content field**. The wiki table_type already provides everything needed for content management: hierarchical page nesting via parent field, Draft/Published status, tags for categorization, author tracking, version history, backlinks, collaboration. No new content model required.

The three surfaces:

| Surface                     | Mechanism                                                                                                                                 | Phase                   | New Work                                                                                               | MVP Status                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| **Public help center**      | Website App type (App Designer) "Documentation / Knowledge Base" template, data-bound to the wiki table, filtered by `status = Published` | Post-MVP (App Designer) | Template wiring — connect the template name to wiki table_type as default data source                  | **Post-MVP** — App Designer and Website App type are post-MVP per glossary |
| **Internal team reference** | Smart Docs wiki view — the default Table View for wiki table_type                                                                         | Post-MVP (wiki)         | None — already fully specified                                                                         | **Post-MVP** — Wiki / Knowledge Base is post-MVP per glossary              |
| **Live Chat AI source**     | Semantic retrieval from chunked embeddings of published article content                                                                   | Post-MVP (Live Chat)    | **This is the new work** — chunking strategy, embedding schema, retrieval pipeline, confidence routing | **Post-MVP** — Commerce embeds, live chat widget are post-MVP per glossary |

---

## Knowledge Base Designation

Covers Configuration, Admin UX (Settings > Channels > Live Chat > AI Responses).
Touches `kb_sources`, `chat_widgets` tables.

> **⚠️ POST-MVP**

Not every wiki table is a Live Chat AI source. An admin explicitly designates which wiki table(s) feed the Live Chat AI.

### Configuration

Add `kb_sources` to the existing Live Chat widget configuration (extends `chat_widgets` table from embeddable-extensions.md):

```typescript
// Extension to chat_widgets configuration (post-MVP)
interface ChatWidgetConfig {
  // ... existing fields from embeddable-extensions.md ...

  kb_config: {
    enabled: boolean; // Master toggle for AI auto-responses
    source_table_ids: UUID[]; // Wiki table(s) to use as knowledge sources
    confidence_threshold: number; // 0.0–1.0, default 0.72 — below this, route to human
    max_chunks_per_response: number; // Default 5 — context budget for LLM
    auto_reply_enabled: boolean; // If false, AI suggests answers to agents instead of auto-replying
    fallback_message: string; // Shown when confidence is below threshold
    // Default: "Let me connect you with someone who can help."
    source_citation: boolean; // Include "Learn more: [article title](url)" in auto-replies
    status_filter: string[]; // Which record statuses to include. Default: ['Published']
  };
}
```

### Admin UX (Settings > Channels > Live Chat > AI Responses)

> **⚠️ POST-MVP**

The configuration lives in the existing Live Chat widget settings panel. A new "AI Responses" tab:

- **Toggle:** "Enable AI auto-responses" (maps to `kb_config.enabled`)
- **Source picker:** "Knowledge base tables" — multi-select from workspace wiki tables. Shows table name + article count + last updated. If no wiki tables exist, prompt: "Create a Knowledge Base table to get started" with a one-click wiki table creation.
- **Confidence slider:** "Auto-reply confidence" — 0% to 100%, default 72%. Below threshold → route to human. Tooltip: "Higher = fewer but more accurate auto-replies. Lower = more auto-replies but some may be wrong."
- **Mode toggle:** "Auto-reply to visitors" vs "Suggest answers to agents" — the former sends the AI response directly; the latter pre-populates the agent's sidebar with suggested answers + source articles.
- **Fallback message:** Editable text for when confidence is too low.
- **Citation toggle:** "Include source article link in replies"

---

## Smart Doc Content Embedding (The New Piece)

Covers Why Record Embeddings Are Insufficient, Chunking Strategy, Schema, Embedding Triggers, TipTap JSON Flattening.
Touches `record_embeddings`, `file_embeddings`, `content_hash`, `model_id`, `knowledge_embeddings` tables. See `personal-notes-capture.md`.

> **⚠️ POST-MVP:** Both vector embeddings / semantic search and Wiki / Knowledge Base are post-MVP per `GLOSSARY.md`.

### Why Record Embeddings Are Insufficient

The existing `record_embeddings` table (vector-embeddings.md) embeds "Primary field + display fields (first 500 tokens)." For a wiki article titled "How to Reset Your Password," this captures the title and maybe a status field — not the 1,500-word step-by-step guide that actually contains the answer.

Knowledge base retrieval needs the **full article body** embedded, and it needs **chunked** embeddings so the system can retrieve the specific paragraph that answers a visitor's question rather than matching an entire article by vague topic similarity.

### Chunking Strategy

TipTap JSON is a tree of nodes (paragraphs, headings, lists, code blocks, etc.). The chunking algorithm operates on the flattened plain-text representation but uses the document's heading structure to find natural break points.

**Algorithm: Heading-Aware Semantic Chunking**

```
1. Flatten TipTap JSON → plain text with heading markers
2. Split on heading boundaries (H1, H2, H3) → sections
3. For each section:
   a. If ≤ 500 tokens → single chunk (prepend heading hierarchy as context)
   b. If > 500 tokens → split on paragraph boundaries at ~400–500 token windows
      - Each sub-chunk inherits the heading hierarchy prefix
4. Prepend article metadata to every chunk: "[Article: {title}] [Section: {heading path}] {content}"
5. Content-hash each chunk for dedup
```

**Why heading-aware, not fixed-window:** A 500-token window that straddles two sections ("...click Save. ## Billing Questions\nTo update your payment method...") produces a chunk about two unrelated topics. Heading boundaries are natural semantic break points — the same way a human would divide an FAQ.

**Heading hierarchy prefix:** Every chunk carries its position in the article structure. A chunk from "How to Reset Your Password > Step 3: Verification" includes that path so the embedding captures section context even for a chunk that only says "Enter the 6-digit code sent to your email."

**Target chunk size:** 400–500 tokens. This is the sweet spot for embedding model performance — small enough for specificity, large enough for context. Matches the ~500-token window already used for record embeddings.

### Schema

```sql
-- POST-MVP: knowledge_embeddings table
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  record_id UUID NOT NULL,              -- The wiki record (article)
  table_id UUID NOT NULL,               -- The wiki table
  field_id UUID NOT NULL,               -- The Smart Doc content field
  chunk_index SMALLINT NOT NULL,         -- 0-based, ordering within article
  chunk_text TEXT NOT NULL,              -- Plain text with heading prefix (for debugging/re-embedding)
  heading_path TEXT,                     -- e.g. "Billing > Payment Methods > Updating Card"
  content_hash VARCHAR(64) NOT NULL,     -- SHA-256 of chunk_text; skip re-embedding if unchanged
  embedding vector(1024) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (record_id, field_id, chunk_index)
) PARTITION BY HASH (tenant_id);

-- HNSW index for approximate nearest neighbor
CREATE INDEX idx_knowledge_embeddings_vector ON knowledge_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- For efficient article-level operations (delete all chunks when article changes)
CREATE INDEX idx_knowledge_embeddings_record ON knowledge_embeddings (tenant_id, record_id);

-- For scoping retrieval to designated KB tables
CREATE INDEX idx_knowledge_embeddings_table ON knowledge_embeddings (tenant_id, table_id);
```

Follows the same patterns as `record_embeddings` and `file_embeddings`: same partition strategy, same HNSW parameters, same `content_hash` dedup, same `model_id` for re-embedding on model change.

**Shared with personal notes (post-MVP):** The `knowledge_embeddings` table is also used for chunked embeddings of personal notes that exceed 500 tokens. Personal note chunks are scoped by `table_id` (which is a personal table with `is_personal = true` and `owner_user_id`), ensuring they're only searchable by the owning user. This reuse avoids creating a parallel embedding infrastructure. See `personal-notes-capture.md` > Full-Content Embedding for Personal Notes.

### Embedding Triggers

| Trigger                                                   | Job                          | Behavior                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wiki Smart Doc field saved (auto-save debounce completes) | `embedding.knowledge.upsert` | Flatten TipTap JSON → chunk → hash-compare each chunk → embed only changed/new chunks. Delete orphaned chunks (article shortened).                          |
| Article status changed to non-published                   | `embedding.knowledge.delete` | Remove all chunks for this record. Unpublished articles should not be retrievable.                                                                          |
| Article deleted                                           | CASCADE                      | `ON DELETE CASCADE` from `record_id` handles this automatically.                                                                                            |
| Wiki table removed from `kb_config.source_table_ids`      | No action needed             | Retrieval query filters by `table_id IN (source_table_ids)` — embeddings persist but are excluded from search. Re-adding the table instantly restores them. |
| Embedding model changed                                   | `embedding.recompute.all`    | Existing job from vector-embeddings.md already handles this. `knowledge_embeddings` included in the sweep via `model_id` mismatch detection.                |

**Priority:** Medium — same as schema embeddings. Not blocking request path (async via BullMQ), but more important than low-priority record embeddings because KB content directly affects customer-facing AI quality.

**Batch efficiency:** Same accumulation pattern as record embeddings. A single article producing 8 chunks dispatches one batch embedding API call, not 8 individual calls.

### TipTap JSON Flattening

The flattener walks the TipTap document tree and produces plain text with structural markers:

```typescript
// packages/shared/ai/knowledge/flatten-tiptap.ts

interface FlattenedSection {
  headingPath: string[]; // ["Billing", "Payment Methods"]
  content: string; // Plain text of section body
  tokenEstimate: number; // Rough count (chars / 4)
}

function flattenTipTapToSections(doc: TipTapDocument): FlattenedSection[] {
  // Walk nodes in order
  // On heading node: start new section, push heading text to path stack
  // On paragraph/list/code/etc: append plain text to current section
  // On blockquote/callout: append with "Note: " prefix
  // On table: flatten to "| cell | cell |" rows
  // On image: append "[Image: alt text]" if alt text exists, skip otherwise
  // On embed: skip (not searchable content)
  // Strip all formatting (bold, italic, etc.) — embedding models don't need it
}
```

**What gets flattened:** Paragraphs, headings, lists (with "- " prefix per item), code blocks (with "Code: " prefix), tables (pipe-delimited), callouts/blockquotes ("Note: " prefix). This covers all standard TipTap nodes from smart-docs.md.

**What gets skipped:** Images (unless alt text exists), embeds, horizontal rules, table of contents blocks (meta-content, not article content).

---

## Live Chat AI Retrieval Pipeline

Covers Flow: Visitor Message → AI Response (or Human Routing), LLM Prompt Template, AI Credit Cost, Thread Message Integration, Agent-Assist Mode.
Touches `thread_messages`, `external_contact`, `author_type`, `scope_type` tables. See `ai-metering.md`.

> **⚠️ POST-MVP:** Live Chat widget and AI auto-responses are post-MVP per `GLOSSARY.md`.

### Flow: Visitor Message → AI Response (or Human Routing)

```
Visitor sends message in Live Chat widget
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. GATE CHECK                           │
│    - kb_config.enabled == true?          │
│    - source_table_ids non-empty?         │
│    - Any knowledge_embeddings exist for  │
│      those tables?                       │
│    If any false → skip to human routing  │
└────────────────┬────────────────────────┘
                 │ yes
                 ▼
┌─────────────────────────────────────────┐
│ 2. EMBED VISITOR MESSAGE                │
│    Same EmbeddingProvider.embedSingle() │
│    as Command Bar Channel 4             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 3. RETRIEVE TOP CHUNKS                  │
│    Cosine similarity on                 │
│    knowledge_embeddings                 │
│    WHERE tenant_id = $1                 │
│      AND table_id IN (source_table_ids) │
│    ORDER BY similarity DESC             │
│    LIMIT kb_config.max_chunks_per_resp  │
│                                         │
│    Also: keyword search on article      │
│    title + chunk_text via tsvector       │
│    Merge via RRF (same as Command Bar)  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ 4. CONFIDENCE CHECK                     │
│    Top chunk similarity score           │
│    ≥ confidence_threshold?              │
│                                         │
│    If no → route to human with:         │
│      - fallback_message to visitor      │
│      - top chunks as "Suggested KB      │
│        articles" in agent sidebar       │
└───────┬─────────────────┬───────────────┘
        │ yes             │ no
        ▼                 ▼
┌───────────────┐  ┌──────────────────────┐
│ 5a. GENERATE  │  │ 5b. ROUTE TO HUMAN   │
│  AI RESPONSE  │  │   Send fallback_msg  │
│               │  │   Pre-populate agent │
│  LLM prompt:  │  │   sidebar with top   │
│  system +     │  │   KB matches         │
│  chunks +     │  └──────────────────────┘
│  visitor msg  │
│               │
│  Grounding    │
│  instruction: │
│  answer ONLY  │
│  from provided│
│  context      │
└───────┬───────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ 6. DELIVER                              │
│    - Send AI response as chat message   │
│      (author_type: 'ai_assistant')      │
│    - If source_citation enabled:        │
│      append "Learn more: [title](url)"  │
│    - Append: "Was this helpful? 👍 👎"  │
│    - 👎 → auto-route to human agent    │
└─────────────────────────────────────────┘
```

### LLM Prompt Template

```typescript
const systemPrompt = `You are a helpful support assistant for ${workspaceName}. 
Answer the visitor's question using ONLY the knowledge base content provided below. 
If the provided content does not contain enough information to answer confidently, 
say so briefly and indicate you'll connect them with a team member.

Do not make up information. Do not reference internal details not present in the 
provided content. Keep your response concise and conversational — this is a live chat, 
not a document.`;

const contextBlock = retrievedChunks
  .map(
    (chunk, i) =>
      `[Source ${i + 1}: ${chunk.articleTitle} > ${chunk.headingPath}]\n${chunk.chunkText}`,
  )
  .join('\n\n');

const userPrompt = `Knowledge base content:\n${contextBlock}\n\nVisitor question: ${visitorMessage}`;
```

### AI Credit Cost

Live Chat AI auto-responses consume workspace AI credits like any other AI feature:

| Component                        | Tier       | Estimated Credits | Notes                                                           |
| -------------------------------- | ---------- | ----------------- | --------------------------------------------------------------- |
| Embed visitor message            | —          | 0                 | Embedding is platform infrastructure (vector-embeddings.md)     |
| LLM response generation          | `standard` | 1–3               | Short responses from grounded context; standard tier sufficient |
| Confidence too low (no response) | —          | 0                 | No LLM call if chunks don't meet threshold                      |

Metered via existing `ai-metering.md` pipeline. Usage appears in Settings > AI Usage as "Live Chat AI Responses."

### Thread Message Integration

AI auto-responses are stored as `thread_messages` with `author_type: 'ai_assistant'` (new enum value alongside `user`, `system`, `external_contact` from communications.md). This means:

- AI responses appear in the conversation thread history alongside human messages
- Agents taking over can see what the AI already told the visitor
- AI messages are searchable, auditable, and included in conversation exports
- The existing `thread_messages` model requires no structural changes — just a new `author_type` value

> **Note on terminology:** Per `GLOSSARY.md`, "Communications Hub" is not a valid term. The thread model uses `threads` + `thread_messages` tables. **Record Thread** refers to record-scoped communication (comments, @mentions tied to a specific record). **Chat / DMs** refers to personal messaging via Quick Panels. Live Chat with external visitors is a distinct post-MVP surface that uses the same underlying `thread_messages` model but with `scope_type` distinguishing it from Record Threads and DMs.

### Agent-Assist Mode

When `kb_config.auto_reply_enabled = false`, the AI doesn't message visitors directly. Instead:

- Visitor message triggers the same retrieval pipeline
- Top chunks + a draft response appear in the **agent's sidebar** (communications right panel)
- Agent can: send the draft as-is, edit and send, or ignore and write their own response
- This is a lower-risk deployment path — admins can validate AI quality before enabling auto-reply

Agent-assist uses the same retrieval flow and LLM generation, but routes the output to the agent UI instead of the visitor WebSocket.

---

## Keyword Search Extension

Defines `tsvector`, `records.search_vector`, `display_fields`, `search_vector`, `knowledge_embeddings`, `knowledge_search`.

> **⚠️ POST-MVP**

Beyond semantic (embedding) search, knowledge base articles should also be keyword-searchable. Add a generated `tsvector` column to wiki records:

**Option A (no schema change):** The existing `records.search_vector` tsvector already indexes the primary field (article title) and display fields. If the Smart Doc content field is included in `display_fields`, extracted plain text gets indexed. However, `search_vector` uses only the first 500 tokens of display fields — insufficient for long articles.

**Option B (recommended):** Extend the existing flattening pipeline to also produce a full-text `tsvector` for KB articles. Store in a new column on `knowledge_embeddings` or in a lightweight `knowledge_search` table:

```sql
-- POST-MVP: Lightweight keyword search index for KB articles
-- One row per article (not per chunk)
CREATE TABLE knowledge_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  record_id UUID NOT NULL UNIQUE,
  table_id UUID NOT NULL,
  full_text TEXT NOT NULL,                    -- Complete flattened article text
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', full_text)
  ) STORED,
  updated_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY HASH (tenant_id);

CREATE INDEX idx_knowledge_search_tsv ON knowledge_search USING gin (search_vector);
CREATE INDEX idx_knowledge_search_table ON knowledge_search (tenant_id, table_id);
```

Live Chat retrieval runs both keyword (tsvector on `knowledge_search`) and semantic (cosine on `knowledge_embeddings`) in parallel, merged via RRF — identical pattern to Command Bar hybrid search.

---

## Website App Type Help Center Wiring

> **⚠️ POST-MVP:** The App Designer and all App types (including Website) are post-MVP per `GLOSSARY.md`.

The Website App type "Documentation / Knowledge Base" template (embeddable-extensions.md) needs one clarification: its default data source is a wiki table_type.

When a user selects this template in the App creation flow:

**Step 1 (Choose a Starting Point):** User selects "Documentation / Knowledge Base"

**Step 2 (Connect to Data):** Instead of showing an open table picker, the wizard:

- Lists existing wiki tables in the workspace: "Connect to an existing knowledge base"
- If none exist: "Create a new Knowledge Base table" (one-click creates a wiki table_type with default fields: Title, Content, Status, Parent, Tags)
- The selected wiki table becomes the data source. Filter: `status = Published`. Sort: page tree order (parent hierarchy).

**Rendering:** The Documentation template renders as:

- **Sidebar:** Page tree from parent field hierarchy (collapsible, matches wiki view structure)
- **Content area:** Smart Doc content rendered as HTML via the existing `generateHTML()` pipeline from app-designer.md
- **URL structure:** `/{app-slug}/{page-slug}` where page-slug derives from article title (auto-generated URL Slug field on wiki table)

**Search (Website App):** If the help center has >20 articles, show a search bar. Client-side search against the app's pre-rendered content (no server round-trip for public pages). For larger deployments, server-side search via the `knowledge_search` tsvector table.

This is the public face of the same content that the Live Chat AI retrieves from. A visitor reads an article on the help center, doesn't find their answer, opens the Live Chat widget, and asks a question — the AI searches the same articles the visitor was just reading. Seamless.

---

## Cross-Reference Updates Required

> **Note:** All referenced documents below describe post-MVP features. Cross-reference updates should be made when those documents are reconciled with the glossary.

| Doc                        | Section                                                    | Change                                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vector-embeddings.md`     | "What Gets Embedded" table                                 | Add row: `Knowledge base articles` / `Article title + heading path + section content (chunked)` / `knowledge_embeddings` / `Smart Doc content field saved (published articles only)` — **post-MVP**                                                                  |
| `vector-embeddings.md`     | "NOT embedded" note                                        | Remove "full rich text bodies" from the exclusion list, or qualify: "full rich text bodies (except knowledge base articles, which are chunked and embedded via `knowledge_embeddings` — post-MVP)"                                                                   |
| `vector-embeddings.md`     | "Command Bar Search Pipeline"                              | Note that Channel 4 also queries `knowledge_embeddings` — KB articles surface in Command Bar search for internal users — **post-MVP**                                                                                                                                |
| `embeddable-extensions.md` | Live Chat AI description                                   | Replace with reference to this spec: "AI-powered auto-responses — see `gaps/knowledge-base-live-chat-ai.md` for full pipeline: knowledge base designation, Smart Doc content chunking, embedding schema, confidence-based routing, agent-assist mode" — **post-MVP** |
| `embeddable-extensions.md` | Website App type "Documentation / Knowledge Base" template | Add note: "Default data source: wiki table_type. See `gaps/knowledge-base-live-chat-ai.md` > Website App Type Help Center Wiring" — **post-MVP**                                                                                                                     |
| `smart-docs.md`            | Wiki Architecture section                                  | Add: "Wiki tables can be designated as Live Chat AI knowledge sources via the Live Chat widget's KB configuration. Published articles are automatically chunked and embedded for semantic retrieval. See `gaps/knowledge-base-live-chat-ai.md`" — **post-MVP**       |
| `smart-docs.md`            | Wiki Table Config                                          | Note optional extension: wiki tables designated as KB sources gain `kb_enabled` visibility in the Smart Doc view toolbar — "This table is a Live Chat AI source" badge, with link to Live Chat settings — **post-MVP**                                               |
| `agent-architecture.md`    | workspace_knowledge section                                | Add disambiguation: "workspace_knowledge is agent-to-agent institutional memory — distinct from the customer-facing knowledge base in `gaps/knowledge-base-live-chat-ai.md`, which serves Live Chat AI auto-responses and public help centers" — **post-MVP**        |
| `communications.md`        | thread_messages model                                      | Add `'ai_assistant'` to `author_type` enum documentation — **post-MVP**                                                                                                                                                                                              |
| `ai-metering.md`           | Credit usage table                                         | Add row for Live Chat AI Responses: standard tier, 1–3 credits per response — **post-MVP**                                                                                                                                                                           |

---

## Phase Mapping

> **⚠️ ALL PHASES BELOW ARE POST-MVP** per `GLOSSARY.md` MVP Scope Summary.

| Phase                                             | Knowledge Base Work                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Glossary MVP Status                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Post-MVP — Documents** (post-MVP)               | Wiki table_type operational (existing scope). Smart Doc content field with TipTap JSON storage. `knowledge_embeddings` and `knowledge_search` tables created (empty — schema only). TipTap flattener utility (`flattenTipTapToSections`) implemented and unit tested.                                                                                                                                                                                                       | **Post-MVP** — Wiki / Knowledge Base                            |
| **Post-MVP — Custom Apps** (post-MVP)             | Website App type "Documentation / Knowledge Base" template wired to wiki table_type. Help center rendering operational via App Designer pipeline. Live Chat widget operational (existing scope). `kb_config` fields added to `chat_widgets` table. Admin UX for "AI Responses" tab in Live Chat settings (configuration only — pipeline not yet active).                                                                                                                    | **Post-MVP** — App Designer, Website App type, Live Chat widget |
| **Post-MVP — Native App & Tap to Pay** (post-MVP) | **Activate:** `embedding.knowledge.upsert` BullMQ job processes published wiki articles → chunk → embed → store in `knowledge_embeddings`. `knowledge_search` tsvector populated. Live Chat AI retrieval pipeline operational: embed visitor message → hybrid search (semantic + keyword via RRF) → confidence check → LLM response or human routing. Agent-assist sidebar. Auto-reply delivery via thread_messages. AI credit metering. "Was this helpful?" feedback loop. | **Post-MVP** — Vector embeddings, Live Chat AI                  |

---

## Cost & Scale

> **⚠️ POST-MVP estimates** — included for future planning.

**Embedding cost per article:** Average help center article ≈ 1,000 words ≈ 1,300 tokens ≈ 3 chunks. At $0.02/1M tokens (OpenAI text-embedding-3-small): ~$0.00008 per article. A 200-article knowledge base: ~$0.016 total. Negligible — same conclusion as record embeddings in vector-embeddings.md.

**Storage:** 3 chunks × 4KB per embedding vector (1024 × float32) = 12KB per article. 200 articles = 2.4MB. Trivial.

**Retrieval latency:** Single cosine similarity query against `knowledge_embeddings` filtered by `tenant_id` + `table_id IN (...)`. With HNSW index and typical KB sizes (50–500 articles, 150–1,500 chunks), expected latency: <30ms. Well within the Live Chat response time budget — the LLM generation step (~1–3 seconds) is the bottleneck, not retrieval.

**Scale ceiling:** A 10,000-article knowledge base (enterprise, unlikely for SMB target) produces ~30,000 chunks. HNSW handles this effortlessly — it's orders of magnitude smaller than the `record_embeddings` table for a tenant with 100K+ records.
