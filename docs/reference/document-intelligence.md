# Document Intelligence — File Content Extraction, Vision Analysis & Search

> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth).
> Changes: (1) Replaced "Editor+" with "Team Member+" throughout — glossary defines roles as Owner/Admin/Manager/Team Member/Viewer, no "Editor" role. (2) Capitalized "Record View" consistently per glossary standard. (3) Added post-MVP scope banner — glossary MVP for documents = merge-tag templates + PDF output + AI draft only; all Document Intelligence features (extraction, vision, content search, embeddings) are post-MVP (MVP — Core UX–8). (4) Tagged vector embeddings / semantic search sections as post-MVP per glossary. (5) No deprecated terms found (no "Interface Designer", "Communications Hub", etc.).

> ⚠️ **MVP Scope Note:** This entire document describes **post-MVP** capabilities (MVP — Core UX–8). The glossary's MVP scope for documents is limited to: merge-tag Document Templates, rich text editor, PDF output via Gotenberg, and AI Draft option. Document Intelligence features — file content extraction, vision analysis, document-to-record extraction, content search, and asset version comparison — are all post-MVP. Schema stubs (MVP — Foundation) may ship with MVP as extension points.

> Upload or photograph any document — invoice, receipt, business card, contract, image — and extract structured data into record fields. AI-generated descriptions, labels, and dates make every file searchable by content. Version-controlled assets get visual diff and comparison tools.
> Cross-references: `files.md` (upload pipeline, storage, thumbnails, metadata JSONB), `vector-embeddings.md` (embedding layer, hybrid search, RRF), `ai-architecture.md` (provider abstraction, capability tiers, vision support), `ai-data-contract.md` (aiToCanonical write path, canonicalToAIContext read path), `ai-field-agents-ref.md` (future extension #3: image/file analysis), `agency-features.md` (asset library, asset_versions, searchable_text, thumbnail pipeline), `mobile.md` (camera scanning & OCR, scan templates, field mapping UX), `ai-metering.md` (credit costs per tier), `command-bar.md` (search channels), `data-model.md` (files table, asset_versions, documents_table_config), `gaps/knowledge-base-live-chat-ai.md` (`knowledge_embeddings` table follows same patterns as `file_embeddings` — partition by tenant_id, HNSW index, content_hash dedup, model_id for re-embedding), `personal-notes-capture.md` (file-first notes trigger extraction pipeline automatically on creation; extracted text injected into note content as toggle block; image notes trigger vision analysis)
> Implements: `packages/shared/ai/CLAUDE.md` (vision pipeline), `packages/shared/storage/CLAUDE.md` (metadata extraction)
> Last updated: 2026-02-27 — Reconciled with GLOSSARY.md. Prior: 2026-02-22 — Added `personal-notes-capture.md` cross-reference (file-first notes auto-trigger extraction). Prior: `gaps/knowledge-base-live-chat-ai.md` cross-reference.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                                                                             | Lines   | Covers                                               |
| --------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------- |
| Problem Statement                                                                                   | 38–48   | Why document intelligence matters for the platform   |
| Architecture Overview                                                                               | 50–73   | Pipeline architecture, integration points            |
| 1. File Metadata Extraction _(MVP — Core UX)_                                                       | 75–147  | EXIF, file properties, auto-tagging                  |
| 2. File Content Extraction _(MVP — Core UX)_                                                        | 149–193 | PDF/DOCX/XLSX text extraction, OCR for scanned docs  |
| 3. Vision Analysis & Labeling _(Post-MVP — Comms & Polish)_                                         | 195–242 | Image analysis, auto-labeling, scene detection       |
| 4. Document-to-Record Extraction _(Post-MVP — Portals & Apps)_                                      | 244–391 | Structured data extraction from documents to records |
| 5. Asset Version Comparison _(Post-MVP — Verticals & Advanced)_                                     | 393–435 | 4 comparison modes, diff visualization               |
| 6. Content Search Integration _(MVP — Core UX–7; semantic search explicitly post-MVP per glossary)_ | 437–563 | Full-text + embedding search over file content       |
| 7. Extended File Detail Panel _(Post-MVP — Comms & Polish)_                                         | 565–607 | Rich file preview, metadata display, AI analysis     |
| 8. Data Model Additions                                                                             | 609–674 | file_embeddings, extraction_jobs tables              |
| 9. AI Credit Costs                                                                                  | 676–690 | Credit costs per extraction/analysis operation       |
| 10. Permissions                                                                                     | 692–707 | File access respects table and field permissions     |
| 11. Phase Implementation                                                                            | 709–734 | MVP — Core UX–8 delivery across capabilities         |
| Reconciliation with Existing Docs                                                                   | 736–748 | Cross-reference alignment notes                      |

---

## Problem Statement

Files are black boxes today. The platform stores them, thumbnails them, virus-scans them, and serves them — but never looks inside. A user uploads an invoice PDF and manually types vendor, date, line items, and total into record fields. A marketing agency uploads 500 campaign images and has no way to find "the beach sunset photo from the October shoot" without opening each one. Version 3 of a logo looks identical to version 2 and nobody can tell what changed.

Three capabilities close this gap:

1. **Document-to-Record Extraction** — AI reads a file and populates record fields (invoices, receipts, business cards, contracts, any structured document).
2. **Vision Analysis & Labeling** — AI describes images, generates tags, extracts dates and text, making every image searchable by what's in it.
3. **Content Search** — Extracted text and AI descriptions flow into the keyword and semantic search pipelines so users find files by content, not just filename.

---

## Architecture Overview

```
File uploaded (web, mobile, API, email, chat)
  │
  ├─ Existing pipeline (files.md):
  │    file.scan (virus)
  │    file.thumbnail (sharp/Gotenberg)
  │
  └─ NEW pipeline:
       file.extract_metadata    ← EXIF, PDF info, document properties (MVP — Core UX)
       file.extract_content     ← PDF text, DOCX text, XLSX text     (MVP — Core UX)
       file.vision_analyze      ← AI image description + tags         (Post-MVP — Portals & Apps)
       file.embed_content       ← Vector embedding of extracted text  (MVP — Core UX)

User triggers document extraction (manual action, not automatic):
  Record View → "Extract from file" button → file.extract_to_record
    → AI reads file + table schema → returns field mapping
    → User confirms/adjusts → fields populated via aiToCanonical()
```

**Key principle: extraction is always user-initiated for record population.** Auto-extraction on every upload would burn AI credits and produce unwanted data. But metadata extraction (EXIF), content extraction (PDF text), and vision labeling run automatically as background jobs — they're platform infrastructure, not AI features the user controls.

---

## 1. File Metadata Extraction _(MVP — Core UX)_

Covers Extended `files.metadata` JSONB, BullMQ Job: `file.extract_metadata`.

### Extended `files.metadata` JSONB

The existing `metadata` column stores dimensions, page count, duration, and blurhash. Extended schema:

```typescript
interface FileMetadata {
  // Existing (files.md)
  width?: number;
  height?: number;
  page_count?: number; // PDFs
  duration_seconds?: number; // audio/video
  blurhash?: string; // 10-char placeholder

  // NEW — EXIF / document properties
  captured_at?: string; // ISO 8601 — EXIF DateTimeOriginal or PDF CreationDate
  camera_make?: string; // "Canon", "Apple"
  camera_model?: string; // "EOS R5", "iPhone 15 Pro"
  gps_latitude?: number; // Decimal degrees
  gps_longitude?: number; // Decimal degrees
  gps_altitude?: number; // Meters
  orientation?: number; // EXIF orientation tag (1-8)
  color_space?: string; // "sRGB", "Adobe RGB", "P3"
  dpi?: number; // Dots per inch (print resolution)
  iso?: number; // ISO speed
  aperture?: string; // "f/2.8"
  shutter_speed?: string; // "1/250"
  focal_length?: string; // "50mm"
  lens_model?: string; // "EF 50mm f/1.4 USM"
  artist?: string; // EXIF Artist tag
  copyright?: string; // EXIF Copyright tag

  // NEW — document properties
  document_title?: string; // PDF title, DOCX title
  document_author?: string; // PDF author, DOCX author
  document_created?: string; // ISO 8601
  document_modified?: string; // ISO 8601

  // NEW — AI-generated (populated by file.vision_analyze)
  ai_description?: string; // Natural language description of image content
  ai_tags?: string[]; // Generated tags: ["sunset", "beach", "ocean", "warm tones"]
  ai_text_content?: string; // Any text visible in the image (signs, labels, etc.)
  ai_dominant_colors?: string[]; // Hex colors: ["#E8A444", "#2C5F8A", "#F5F0E8"]
  ai_model_id?: string; // Which model generated the analysis
  ai_analyzed_at?: string; // When analysis ran
}
```

### BullMQ Job: `file.extract_metadata`

**Trigger:** Enqueued alongside `file.scan` and `file.thumbnail` after upload completion.

**Library:** `exifr` (lightweight, handles EXIF/IPTC/XMP from JPEG/TIFF/HEIC/WebP), `pdf-lib` for PDF properties, `mammoth` or `JSZip` for DOCX properties.

**Process:**

1. Download first 256KB of file from R2/S3 via range request (EXIF is always in the header)
2. Parse by MIME type:
   - `image/*` → `exifr.parse()` for EXIF/IPTC/XMP data
   - `application/pdf` → `pdf-lib` for document info dictionary
   - `application/vnd.openxmlformats-*` → unzip, read `docProps/core.xml` for author/title/dates
3. Map parsed values into `FileMetadata` shape
4. **Strip GPS from thumbnails** — EXIF GPS is preserved on the original but stripped from generated thumbnails (privacy)
5. Update `files.metadata` JSONB (merge, don't replace — thumbnails may have already written blurhash)

**Cost:** Zero — no AI calls. Pure metadata parsing. Runs in <2 seconds for any file.

**Privacy:** GPS coordinates stored but only surfaced in UI to users with Team Member+ permission on the record. Portal clients never see GPS, camera, or artist metadata.

---

## 2. File Content Extraction _(MVP — Core UX)_

Covers New Column: `files.extracted_text`, BullMQ Job: `file.extract_content`.
Touches `note_file_capture` tables. See `mobile.md`, `personal-notes-capture.md`.

### New Column: `files.extracted_text`

```sql
ALTER TABLE files ADD COLUMN extracted_text TEXT;
ALTER TABLE files ADD COLUMN extracted_text_tsv TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(extracted_text, ''))) STORED;

CREATE INDEX idx_files_extracted_text_search
  ON files USING gin (extracted_text_tsv)
  WHERE extracted_text IS NOT NULL;
```

**Why a generated column for tsvector?** Same pattern as `records.search_vector` — zero-maintenance, always consistent, no trigger needed.

### BullMQ Job: `file.extract_content`

**Trigger:** Enqueued after upload completion, runs after `file.extract_metadata`.

**Extraction by MIME type:**

| MIME Type                                           | Method                                                      | Library                          | Output                                   |
| --------------------------------------------------- | ----------------------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `application/pdf`                                   | Text extraction from PDF content streams                    | `pdf-parse` (wraps `pdf.js`)     | Full text, max 50,000 chars              |
| `application/pdf` (scanned/image-only)              | Falls back to OCR if `pdf-parse` returns <50 chars per page | Gotenberg → image → vision model | OCR text, AI `standard` tier             |
| `application/vnd.openxmlformats-*.wordprocessingml` | XML text extraction                                         | `mammoth`                        | Full text, max 50,000 chars              |
| `application/vnd.openxmlformats-*.spreadsheetml`    | Cell values + sheet names                                   | `SheetJS`                        | Concatenated cell text, max 50,000 chars |
| `application/vnd.openxmlformats-*.presentationml`   | Slide text extraction                                       | `JSZip` + XML parse              | Slide text in order, max 50,000 chars    |
| `text/csv`                                          | Raw text                                                    | Direct read                      | First 50,000 chars                       |
| `text/plain`                                        | Raw text                                                    | Direct read                      | First 50,000 chars                       |
| `image/*` with text                                 | Vision OCR                                                  | Vision model, AI `standard` tier | Extracted visible text                   |

**Scanned PDF detection:** If `pdf-parse` returns fewer than 50 characters per page on average, the PDF is likely scanned images. In that case, render pages to images via Gotenberg and send to the vision model for OCR. This is the only content extraction path that costs AI credits — flagged in processing metadata.

**Text truncation:** All extracted text capped at 50,000 characters. This is sufficient for search indexing and embedding. Full text of massive documents is not stored — the original file is the source of truth.

**Cost:** Free for text-based documents (PDF, DOCX, XLSX, CSV, TXT). Scanned PDFs and image OCR consume AI `standard` tier credits (2-5 credits per page, same as mobile OCR in `mobile.md`).

**File-first notes:** When a file is dropped onto the Quick Capture popover or My Notes sidebar (context_type: `note_file_capture`), the extraction pipeline triggers automatically on note creation. Extracted text is injected into the note's Smart Doc content field as a collapsed "Extracted Content" toggle block, making the file's full text searchable via the note. See `personal-notes-capture.md` > File-First Notes.

---

## 3. Vision Analysis & Labeling _(Post-MVP — Comms & Polish)_

Covers BullMQ Job: `file.vision_analyze`, Manual Vision Analysis Trigger.
Touches `record_attachment`, `ai_description`, `ai_tags`, `ai_text_content`, `ai_dominant_colors` tables.

### BullMQ Job: `file.vision_analyze`

**Trigger:** Enqueued after upload completion for image files only. Runs after thumbnails are generated (uses the 800px preview to reduce token cost, not the full original).

**Scope:** All `image/*` uploads in the **asset library** (context_type = `record_attachment` on a documents-type table). NOT auto-triggered for casual attachments on regular tables — users can manually trigger analysis on any image via the Record View.

**Why scope to asset library by default?** A marketing agency's asset library is where searchable images live. A construction company attaching a job-site photo to a task record probably doesn't need AI labeling. But they can still trigger it manually. "AI capable, not AI obnoxious."

**Process:**

1. Load 800px WebP thumbnail (already generated by `file.thumbnail`)
2. Send to vision-capable model via LLM Router (`supportsVision: true` — already in provider interface)
3. System prompt:

```
Analyze this image and return a JSON object with:
- description: A natural language description (1-2 sentences) of what's in the image. Focus on subject, setting, mood, composition.
- tags: An array of 5-15 descriptive tags. Include: subjects, objects, colors, settings, moods, styles, seasons, activities. Use lowercase.
- text_content: Any readable text visible in the image (signs, labels, watermarks, etc.). Empty string if none.
- dominant_colors: Array of 3-5 hex color codes representing the dominant colors.
```

4. Parse structured response
5. Update `files.metadata` with `ai_description`, `ai_tags`, `ai_text_content`, `ai_dominant_colors`, `ai_model_id`, `ai_analyzed_at`

**Model tier:** `standard` — vision analysis needs good quality but not advanced reasoning. Sonnet-class models handle this well.

**Credit cost:** 1-2 AI credits per image (thumbnail is small, prompt is fixed). Shown in AI usage dashboard under "Vision Analysis" category. Cost absorbed as platform infrastructure for asset library auto-analysis; manual triggers on other tables consume workspace credits.

**Batch efficiency:** When multiple images upload simultaneously (bulk photo capture, drag-and-drop folder), jobs are batched — single model call with multiple images where the provider supports it.

### Manual Vision Analysis Trigger

Any image attachment on any table, not just the asset library:

```
Record View → file attachment → ⋮ menu → "Analyze Image"
  → Confirmation: "This will use ~2 AI credits to describe this image and generate search tags."
  → Runs file.vision_analyze for that specific file
  → Results appear in file detail panel: description, tags, visible text
```

---

## 4. Document-to-Record Extraction _(Post-MVP — Portals & Apps)_

This is the headline feature: upload an invoice PDF (or photograph it on mobile), and the AI reads it and populates your record fields.

### Extraction Flow

```
User is in a Record View (or creating a new record).

1. ATTACH: User uploads/photographs a file (any method: web upload, mobile camera,
   email attachment, drag-and-drop).

2. TRIGGER: User clicks "Extract from file" button on the file attachment chip
   (or in file detail panel, or via record toolbar dropdown).
   - If record has no file attachment, prompt to upload one first.
   - Credit cost shown: "This will use ~3-5 AI credits."

3. EXTRACT: file.extract_to_record job runs:
   a. Load file content:
      - PDF/DOCX/XLSX: Use already-extracted text from files.extracted_text
      - Image: Send to vision model for full OCR + entity extraction
      - If extracted_text empty and file is PDF: render to images, send to vision
   b. Load target table schema via Schema Descriptor Service:
      - All field names, types, descriptions, options (for select fields)
      - Current record values (to show what will be overwritten)
   c. Assemble extraction prompt:
      - System: "Extract structured data from this document into the given fields."
      - Document content (text or image)
      - Table schema with field types and constraints
      - Extraction template hints if one exists (see Extraction Templates below)
   d. AI returns structured JSON: { field_id: extracted_value, ... }
   e. Each value runs through aiToCanonical() for the target field type
   f. Return extraction result to client

4. REVIEW: Field Mapping UI appears (same UX as mobile scan mapping in mobile.md):
   ┌─────────────────────────────────────────────────┐
   │ Extracted from: invoice-acme-corp-2026-02.pdf   │
   ├─────────────────────────────────────────────────┤
   │                                                 │
   │ Vendor Name     "Acme Corporation"  → Vendor ▼  │
   │ Invoice Date    "2026-02-15"        → Date ▼    │
   │ Invoice #       "INV-2026-0042"     → Invoice # ▼│
   │ Subtotal        "$4,250.00"         → Subtotal ▼│
   │ Tax             "$382.50"           → Tax ▼     │
   │ Total           "$4,632.50"         → Total ▼   │
   │                                                 │
   │ Line Items (3 found):                           │
   │  1. Web Design - 10hrs @ $300  → [Line Items ▼] │
   │  2. SEO Audit - 5hrs @ $150   →                 │
   │  3. Hosting Setup - flat $200  →                 │
   │                                                 │
   │ ⚠ "Payment Terms: Net 30" — no matching field   │
   │   [+ Create field]  [Skip]                      │
   │                                                 │
   │ [Save as template: "Acme invoices"]             │
   │                                                 │
   │        [Cancel]              [Apply to Record]  │
   └─────────────────────────────────────────────────┘

5. APPLY: User confirms mapping → values written to record fields via standard
   Server Action (same write path as manual edits). Audit log entry:
   "Fields populated from file extraction (invoice-acme-corp-2026-02.pdf)".

6. TEMPLATE: If user clicks "Save as template", the field mapping is saved as an
   extraction template (see below). Future extractions from similar documents
   auto-apply the mapping.
```

### Line Item Handling

Invoices, purchase orders, and similar documents contain repeating line items. Two strategies, depending on table structure:

**Strategy A — Sub-items table (preferred):** If the target table has a sub-items field or a linked child table (e.g., "Invoice Line Items"), each extracted line becomes a child record. The extraction prompt knows about the child table schema and produces an array.

**Strategy B — JSON/text field:** If no sub-items structure exists, line items are formatted into a text_area or smart_doc field as a readable list. The mapping UI offers: "Create a linked table for line items?" which auto-creates the table and link field.

### Linked Record Resolution

When the AI extracts a value like "Acme Corporation" for a linked_record field (e.g., Vendor), the extraction pipeline searches the target table's primary field for matches:

1. Exact match → link to existing record
2. Fuzzy match (>80% similarity) → suggest match with confirmation: "Did you mean 'Acme Corp Inc.'?"
3. No match → offer to create new record in the target table

This uses the same resolution logic specified in `ai-data-contract.md` for the `linked_record` field type's `aiToCanonical()`.

### Extraction Templates

Templates save the field mapping for a document type so future extractions skip the review step (or pre-fill it).

```typescript
interface ExtractionTemplate {
  id: string;
  tenant_id: string;
  table_id: string;
  name: string; // "Acme Corp invoices", "Equipment receipts"
  document_type: string; // "invoice", "receipt", "business_card", "contract", "custom"
  field_mapping: Record<string, string>; // { extracted_key: field_id }
  line_item_config?: {
    target_table_id: string;
    field_mapping: Record<string, string>;
  };
  match_hints?: string[]; // ["Acme", "INV-"] — helps auto-select template
  auto_apply: boolean; // Skip review step when template matches
  created_by: string;
  created_at: string;
  usage_count: number; // Track popularity for template suggestions
}
```

**Storage:** `extraction_templates` table or `scan_templates` table if shared with mobile scan templates from `mobile.md` — same concept, different entry point. The mobile spec already describes scan templates; this extends them to work from web uploads too.

**Template matching:** When a user triggers extraction, the pipeline checks existing templates:

1. Match by `match_hints` against extracted text (vendor name, document ID patterns)
2. If match found and `auto_apply` is true → pre-fill mapping, show "Extracted using 'Acme invoices' template. [Edit mapping]"
3. If match found but `auto_apply` is false → pre-fill but show full review UI
4. No match → show blank mapping UI

### Supported Document Types

| Document Type               | Key Extracted Fields                                                               | Typical Target Table      |
| --------------------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| **Invoice**                 | Vendor, date, invoice #, line items, subtotal, tax, total, payment terms, due date | Invoices, Expenses, Bills |
| **Receipt**                 | Merchant, date, items, total, payment method, last 4 digits                        | Expenses, Receipts        |
| **Business card**           | Name, title, company, email, phone, address, website                               | Contacts, Leads           |
| **Contract**                | Parties, effective date, term, key clauses, signatures, renewal date               | Contracts, Agreements     |
| **Purchase order**          | PO #, vendor, items, quantities, unit prices, total, delivery date                 | Purchase Orders           |
| **Shipping label**          | Tracking #, carrier, origin, destination, weight                                   | Shipments, Orders         |
| **Bank statement**          | Account #, period, transactions (date, description, amount), balance               | Transactions              |
| **Any structured document** | AI determines structure from table schema context                                  | Any table                 |

The last row is important — the extraction is schema-driven, not template-driven. The AI sees the target table's fields and extracts whatever matches, even for document types not listed above.

### Mobile Integration

The mobile scanning flow in `mobile.md` (Camera Scanning & OCR section) already specifies this UX for camera captures. This spec **unifies** that flow so it works identically for:

- Mobile camera capture → extract
- Mobile gallery pick → extract
- Web file upload → extract
- Web drag-and-drop → extract
- Email attachment → extract (via "Extract from file" on the attached file)
- Chat attachment → extract (via context menu)

The extraction pipeline, field mapping UI, and template system are shared across all entry points. The mobile spec's scan templates and this spec's extraction templates are the same table.

---

## 5. Asset Version Comparison _(Post-MVP — Verticals & Advanced)_

Covers Visual Diff for Image Versions, Version Metadata.
Touches `asset_versions`, `ai_change_summary` tables.

### Visual Diff for Image Versions

When a documents-type table (asset library) has versioned files via `asset_versions`, the version history panel gains comparison tools:

**Comparison modes:**

| Mode               | UX                                                                                          | Use Case                           |
| ------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Side by side**   | Two versions rendered at same scale, synced zoom/pan                                        | Compare layouts, compositions      |
| **Overlay slider** | Single view with a draggable vertical divider — left shows version A, right shows version B | Spot subtle color/detail changes   |
| **Onion skin**     | Version B overlaid on version A with opacity slider (0-100%)                                | Alignment checks, logo refinements |
| **Highlight diff** | Pixel-level difference rendered as a heat map overlay                                       | Technical QA, print proofing       |

**Implementation:** Client-side only. Two `<canvas>` elements with synchronized transforms. Pixel diff computed via `ImageData` comparison in a Web Worker (no server cost). Available for `image/*` files only. PDF comparison uses side-by-side rendered pages.

### Version Metadata

Each `asset_versions` row is enhanced with AI-generated context:

```sql
-- New columns on asset_versions
ALTER TABLE asset_versions ADD COLUMN ai_description TEXT;
ALTER TABLE asset_versions ADD COLUMN ai_change_summary TEXT;  -- "Logo color changed from blue to teal, font weight increased"
```

**`ai_change_summary`** is generated when a new version is uploaded by sending both the previous and current thumbnails to the vision model:

```
System: Compare these two versions of a design asset. Describe what changed
between version {N-1} and version {N} in 1-2 sentences. Focus on visual
differences: color, layout, text, sizing, composition.
```

This means version history shows not just "Version 3 — uploaded by Sarah, Feb 15" but "Version 3 — Logo color changed from blue (#2E75B6) to teal (#0D9488), tagline font weight increased. Uploaded by Sarah, Feb 15."

**Credit cost:** 2-3 AI credits per version comparison (two images in one call). Only runs in asset library context, only when a new version is uploaded.

---

## 6. Content Search Integration _(MVP — Core UX–7; semantic search explicitly post-MVP per glossary)_

Covers Extending the Search Pipeline, Search Result Presentation, Date-Based Search.
Touches `record_embeddings`, `file_embeddings`, `captured_at` tables. See `vector-embeddings.md`, `command-bar.md`.

### Extending the Search Pipeline

All extracted content feeds into the existing search infrastructure from `vector-embeddings.md` and `command-bar.md`.

**Keyword search (tsvector):**

The `files.extracted_text_tsv` generated column enables full-text search on file content. The Command Bar's Channel 3 (Record Keyword Search) is extended:

```sql
-- Existing: search records.search_vector
-- New: also search files attached to records
SELECT r.id, ts_rank(r.search_vector, query) AS record_rank
FROM records r
WHERE r.tenant_id = $1 AND r.search_vector @@ query

UNION ALL

SELECT f.context_id AS record_id, ts_rank(f.extracted_text_tsv, query) AS file_rank
FROM files f
WHERE f.tenant_id = $1
  AND f.context_type = 'record_attachment'
  AND f.extracted_text_tsv @@ query
  AND f.deleted_at IS NULL;
```

Results from file content search are merged with record search results via the existing RRF pipeline. File-sourced results display with a file icon indicator: "📄 Found in: invoice-acme-2026.pdf".

**AI metadata search (tags, descriptions):**

A new generated tsvector column on files for AI-generated content:

```sql
ALTER TABLE files ADD COLUMN ai_search_tsv TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(metadata->>'ai_description', '') || ' ' ||
      COALESCE(array_to_string(ARRAY(SELECT jsonb_array_elements_text(metadata->'ai_tags')), ' '), '')
    )
  ) STORED;

CREATE INDEX idx_files_ai_search ON files USING gin (ai_search_tsv)
  WHERE ai_search_tsv IS NOT NULL;
```

Now searching "sunset beach" matches images that the AI tagged with those terms, even if the filename is `IMG_4872.jpg`.

**Semantic search (embeddings):** _(Post-MVP — vector embeddings / semantic search explicitly listed as post-MVP in glossary MVP scope summary)_

New embedding table extending the `vector-embeddings.md` schema:

```sql
CREATE TABLE file_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  record_id UUID NOT NULL,        -- denormalized for fast joins
  table_id UUID NOT NULL,         -- denormalized for scope filtering
  content_hash VARCHAR(64) NOT NULL,
  embedding vector(1024) NOT NULL,
  source_text TEXT NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY HASH (tenant_id);

CREATE INDEX idx_file_embeddings_vector ON file_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Source text for embedding:** Concatenation of: original filename + AI description + AI tags (joined) + first 400 tokens of extracted text. Content hash deduplication prevents re-embedding unchanged files.

**BullMQ job: `file.embed_content`** — Enqueued after `file.extract_content` and/or `file.vision_analyze` complete. Uses the same `EmbeddingProvider` interface and batch efficiency as record embeddings.

**Command Bar Channel 4 extension:** Semantic search queries both `record_embeddings` and `file_embeddings`, merging via RRF. A search for "overdue invoices from Acme" matches records by field content AND attached invoice PDFs by extracted text.

### Search Result Presentation

File content matches display with context in the Command Bar:

```
┌─────────────────────────────────────────────┐
│ 🔍 "beach sunset campaign"                  │
├─────────────────────────────────────────────┤
│ ⌨️ Commands                                 │
│   → Go to Campaign Assets table             │
│                                             │
│ 📝 Records                                  │
│   → "Summer Campaign 2026" — Creative table │
│                                             │
│ 🖼️ Files                                    │
│   → beach-hero-final.jpg                    │
│     "Golden sunset over ocean with palm     │
│      tree silhouettes, warm tones"          │
│     Tags: sunset, beach, tropical, golden   │
│     In: Summer Campaign 2026                │
│   → IMG_3847.jpg                            │
│     "Couple walking on beach at sunset,     │
│      drone aerial shot"                     │
│     In: Stock Photography                   │
│                                             │
│ 🤖 Ask AI                                   │
│   → "Find beach sunset campaign photos"     │
└─────────────────────────────────────────────┘
```

### Date-Based Search

EXIF `captured_at` enables temporal queries. The Command Bar and filter system support:

- "photos from October" → filter `files.metadata->>'captured_at'` by date range
- "images from last week" → same, relative date
- Asset library filter bar: Date Captured range picker (distinct from Date Uploaded)

In the asset library gallery view, sort options include:

- Date uploaded (existing: `files.created_at`)
- Date captured (new: `files.metadata->>'captured_at'`)
- Name (existing)
- File size (existing)

---

## 7. Extended File Detail Panel _(Post-MVP — Comms & Polish)_

The file detail panel (lightbox / attachment detail view) gains new sections from extracted data:

```
┌─────────────────────────────────────────────┐
│ beach-hero-final.jpg                    [×] │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ │           [Image Preview]               │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ 📋 Details │ 🏷️ AI Tags │ 📷 Camera │ 🔄 Versions │
│ ─────────────────────────────────────────── │
│                                             │
│ AI Description                              │
│ "Golden sunset over ocean with palm tree    │
│  silhouettes, warm orange and teal tones"   │
│                                     [Edit]  │
│                                             │
│ Tags                                        │
│ [sunset] [beach] [tropical] [golden hour]   │
│ [ocean] [palm trees] [warm tones]           │
│                          [+ Add tag] [Edit] │
│                                             │
│ Captured: Oct 14, 2025, 6:42 PM            │
│ Camera: Canon EOS R5 · EF 24-70mm f/2.8    │
│ Settings: f/8 · 1/250s · ISO 100           │
│ Location: Maui, HI (20.798°, -156.331°)    │
│ Resolution: 8192 × 5464 (45 MP) · 300 DPI  │
│ Color: sRGB                                 │
│                                             │
│ [Download] [Extract to Record] [Analyze]    │
└─────────────────────────────────────────────┘
```

**Editable AI tags:** Users can add, remove, or edit AI-generated tags. Manual edits are preserved — re-analysis appends new tags but doesn't overwrite manual ones. Tags stored with a `source` flag: `"ai"` or `"manual"`.

**Editable AI description:** Users can refine the AI description. Manual edits replace the AI version. Re-analysis only overwrites if the user explicitly triggers it.

---

## 8. Data Model Additions

Covers New Tables, Modified Tables.

### New Tables

```sql
-- Extraction templates (shared with mobile scan templates)
CREATE TABLE extraction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'custom',
  field_mapping JSONB NOT NULL,           -- { "extracted_key": "field_id" }
  line_item_config JSONB,                 -- { target_table_id, field_mapping }
  match_hints TEXT[],                     -- ["Acme", "INV-"]
  auto_apply BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  usage_count INTEGER DEFAULT 0
);

CREATE INDEX idx_extraction_templates_lookup
  ON extraction_templates (tenant_id, table_id);

-- File embeddings (content search)
-- See Section 6 above for full DDL
```

### Modified Tables

```sql
-- files: new columns
ALTER TABLE files ADD COLUMN extracted_text TEXT;
ALTER TABLE files ADD COLUMN extracted_text_tsv TSVECTOR
  GENERATED ALWAYS AS (to_tsvector('english', COALESCE(extracted_text, ''))) STORED;
ALTER TABLE files ADD COLUMN ai_search_tsv TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(metadata->>'ai_description', '') || ' ' ||
      COALESCE(
        array_to_string(
          ARRAY(SELECT jsonb_array_elements_text(metadata->'ai_tags')),
          ' '
        ),
        ''
      )
    )
  ) STORED;

-- asset_versions: AI context
ALTER TABLE asset_versions ADD COLUMN ai_description TEXT;
ALTER TABLE asset_versions ADD COLUMN ai_change_summary TEXT;

-- indexes
CREATE INDEX idx_files_extracted_text_search ON files
  USING gin (extracted_text_tsv) WHERE extracted_text IS NOT NULL;
CREATE INDEX idx_files_ai_search ON files
  USING gin (ai_search_tsv);
CREATE INDEX idx_files_captured_at ON files
  ((metadata->>'captured_at')) WHERE metadata->>'captured_at' IS NOT NULL;
```

---

## 9. AI Credit Costs

| Operation                     | Tier       | Credits          | Trigger                                   | Who Pays                                            |
| ----------------------------- | ---------- | ---------------- | ----------------------------------------- | --------------------------------------------------- |
| EXIF/metadata extraction      | —          | 0                | Auto on upload                            | Free                                                |
| PDF/DOCX text extraction      | —          | 0                | Auto on upload                            | Free                                                |
| Scanned PDF OCR               | `standard` | 2-5 per page     | Auto on upload (if text extraction fails) | Platform infrastructure                             |
| Image vision analysis         | `standard` | 1-2 per image    | Auto in asset library; manual elsewhere   | Asset library: platform. Manual: workspace credits  |
| Document-to-record extraction | `standard` | 3-5 per document | User-initiated                            | Workspace credits                                   |
| Version change summary        | `standard` | 2-3 per version  | Auto on version upload in asset library   | Platform infrastructure                             |
| File content embedding        | —          | 0                | Auto after extraction                     | Platform infrastructure (same as record embeddings) |

**Credit cost transparency:** Every AI-consuming operation shows the estimated cost before execution. The AI usage dashboard (`ai-metering.md`) tracks "Document Intelligence" as a category with subcategories for OCR, Vision Analysis, Extraction, and Version Comparison.

---

## 10. Permissions

| Action                               | Required Permission                                                  |
| ------------------------------------ | -------------------------------------------------------------------- |
| Upload file                          | Team Member+ on the record                                           |
| View extracted text / AI description | Viewer+ on the record (same as viewing the file)                     |
| Trigger "Extract to Record"          | Team Member+ on the record                                           |
| Trigger "Analyze Image" (manual)     | Team Member+ on the record                                           |
| Edit AI tags / description           | Team Member+ on the record                                           |
| Create/edit extraction templates     | Manager+ on the table                                                |
| View EXIF GPS / camera metadata      | Team Member+ on the record (stripped for Viewers and portal clients) |
| View version history                 | Viewer+ on the record                                                |
| Upload new version                   | Team Member+ on the record                                           |
| Compare versions                     | Viewer+ on the record                                                |

---

## 11. Phase Implementation

| Phase                                          | Document Intelligence Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Foundation**                           | `files.extracted_text` column added to schema. `files.metadata` JSONB shape extended (no new columns, just richer JSON). `extraction_templates` table in schema. `file_embeddings` table in schema (empty). BullMQ job definitions registered (no-op until activated).                                                                                                                                                                                                                                                                    |
| **MVP — Core UX**                              | **Activate metadata extraction:** `file.extract_metadata` job processes EXIF on image upload, PDF/DOCX properties on document upload. **Activate content extraction:** `file.extract_content` job extracts text from PDF/DOCX/XLSX/CSV. **Activate content search:** `extracted_text_tsv` index live, Command Bar Channel 3 extended to include file content. **Activate content embeddings:** `file.embed_content` job generates embeddings for extracted text, Command Bar Channel 4 extended. Date Captured sort/filter in file views. |
| **Post-MVP — Portals & Apps**                  | **Document-to-record extraction:** Full extraction pipeline with field mapping UI, extraction templates, linked record resolution. "Extract from file" button in Record View. Template save/auto-apply. Portal file upload → extraction flow (Professional+ plans).                                                                                                                                                                                                                                                                       |
| **Post-MVP — Comms & Polish**                  | **Vision analysis:** `file.vision_analyze` job for image description + tagging. AI search tsvector index. Asset library auto-analysis on upload. Manual "Analyze Image" for other tables. Extended file detail panel with AI tags/description. Chat and email attachment extraction triggers.                                                                                                                                                                                                                                             |
| **Post-MVP — Verticals & Advanced (post-MVP)** | **Asset library integration:** Version comparison tools (side-by-side, overlay, diff). `ai_change_summary` on version upload. Batch re-analysis for existing assets. Advanced search filters (color-based search, similar image search via embedding distance). Scanned PDF OCR pipeline.                                                                                                                                                                                                                                                 |

### Claude Code Prompt Roadmap

1. **Schema + jobs shell** — Add columns to files, create extraction_templates and file_embeddings tables, register BullMQ jobs as no-ops
2. **EXIF extraction** — Implement `file.extract_metadata` with `exifr`, PDF property parsing, DOCX property parsing
3. **Content extraction** — Implement `file.extract_content` with `pdf-parse`, `mammoth`, `SheetJS`
4. **Content search wiring** — Extend Command Bar Channel 3 query to include `files.extracted_text_tsv`, merge into RRF
5. **Content embeddings** — Implement `file.embed_content` using existing `EmbeddingProvider`, extend Channel 4
6. **Extraction pipeline** — Implement `file.extract_to_record` with Schema Descriptor Service integration, prompt assembly, `aiToCanonical()` write path
7. **Field mapping UI** — React component: extraction review modal with field dropdowns, line item handling, template save
8. **Extraction templates** — CRUD for extraction_templates, match_hints auto-selection, auto_apply flow
9. **Vision analysis** — Implement `file.vision_analyze` with LLM Router vision call, metadata update, AI search index
10. **File detail panel** — Extended panel with AI description, editable tags, camera metadata, date captured
11. **Version comparison** — Canvas-based side-by-side, overlay slider, pixel diff in Web Worker
12. **Version AI summary** — Implement version change summary via dual-image vision call

---

## Reconciliation with Existing Docs

| Existing Spec            | What Changes                                                                                                                                                                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files.md`               | `metadata` JSONB shape extended (documented here, files.md references this doc for extended schema). New columns: `extracted_text`, `extracted_text_tsv`, `ai_search_tsv`. Three new BullMQ jobs in upload completion flow.                                                                          |
| `vector-embeddings.md`   | "NOT embedded: file attachments" → now embedded via `file_embeddings` table. New embedding trigger: `embedding.file.upsert`. Section 6 of this doc is the canonical spec; vector-embeddings.md should add a cross-reference.                                                                         |
| `ai-architecture.md`     | `supportsVision: boolean` now actively used. New `AITaskType` entries: `document_extraction`, `vision_analysis`, `version_comparison`. Added to `FEATURE_ROUTING` map.                                                                                                                               |
| `ai-data-contract.md`    | Category 8 (Files) `aiToCanonical()` still rejects direct AI writes to file fields — extraction writes to OTHER fields on the record, not the file field itself. No change needed.                                                                                                                   |
| `ai-field-agents-ref.md` | Future extension #3 (Image/file analysis) partially addressed — field agents can now reference `files.metadata.ai_description` and `files.extracted_text` in their prompts. Full multimodal agent support (sending images directly to field agent models) remains a future extension.                |
| `agency-features.md`     | Asset library `searchable_text` reference → replaced by `files.extracted_text` + `files.ai_search_tsv` (richer, not a separate field on the asset record). Thumbnail pipeline unchanged. Version history enhanced with `ai_change_summary`.                                                          |
| `mobile.md`              | Camera Scanning & OCR flow → unified with this spec's extraction pipeline. Scan templates → extraction templates (same table). Mobile-specific UX (edge detection, perspective correction, viewfinder) remains in mobile.md. The extraction pipeline, field mapping, and template system are shared. |
| `command-bar.md`         | Search channels 3 and 4 extended to include file content. New result group: "Files" with content-match context.                                                                                                                                                                                      |
| `data-model.md`          | New table: `extraction_templates`. New table: `file_embeddings`. Modified: `files` (new columns), `asset_versions` (new columns).                                                                                                                                                                    |
