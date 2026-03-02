# EveryStack — Agency Features

> **🔄 Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Strengthened post-MVP labeling — glossary explicitly lists "Time tracking, asset library, ad platforms" under MVP Explicitly Excludes; (2) Clarified "Portal Integration" sections as post-MVP Custom Portal (App type) features per glossary — MVP Portals are simple Record Views with auth, not block-based layouts; (3) "Report Portal Pages" / "Portal Chart Block Enhancements" → clarified as App Designer outputs per glossary naming discipline (portal blocks are App blocks); (4) Updated cross-references to note `custom-apps.md` references post-MVP App Designer; (5) Fixed remaining "portal" block modifiers → "App" (portal time blocks → App time blocks, portal Asset Gallery block → App Asset Gallery block, Brand Assets portal template → Brand Assets Custom Portal App template).

> **⚠️ POST-MVP FEATURE.** Per GLOSSARY.md MVP Scope Summary, "Time tracking, asset library, ad platforms" is explicitly excluded from MVP. This entire specification describes Post-MVP — Verticals & Advanced+ post-MVP functionality.

> **Sub-document.** Time tracking, media/asset library, ad platform integrations. All Post-MVP — Verticals & Advanced (post-MVP).
> Cross-references: `data-model.md` (time_entries, billing_rates, time_tracking_config, asset_versions, metric_snapshots schema), `automations.md` (time-based triggers, report actions), `accounting-integration.md` (time tracking → invoicing bridge, billing rate resolution hierarchy, project profitability calculations), `inventory-capabilities.md` (Barcode field type for asset tracking, Quick Entry for equipment checkout), `custom-apps.md` (Timer Widget block embeddable in app pages for time clock kiosk), `approval-workflows.md` (timesheet approval workflow subsumed by generic approval system — 1-step approval rule on time entries status field, `approver_type: 'role'`, `approver_role: 'manager'`, bulk approve via approval queue; asset status approval similarly expressible as 1-step rule with `approver_type: 'user_field'`; migration in Post-MVP — Verticals & Advanced)
> Last updated: 2026-02-27 — Glossary reconciliation. See reconciliation note above for changes. Original: 2026-02-13.

---

## Time Tracking Architecture

Time tracking is a capability layer on top of any projects-type table, following the same configuration pattern as `pm_table_config`. It is not a separate table type — it is enabled per table via `time_tracking_config`.

### Core Data Model

**`time_entries`** — Central table for all logged time:

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| record_id | UUID → records.id | Which task/record this time is logged against |
| user_id | UUID → users.id | Who logged the time |
| start_time | TIMESTAMP | When work began |
| end_time | TIMESTAMP (nullable) | When work ended. Null while timer running. |
| duration_minutes | INTEGER | Total minutes (calculated or manual) |
| billable | BOOLEAN | Whether billable to client. Default: true. |
| billing_rate_snapshot | DECIMAL | Rate at time of entry (snapshot, not live reference) |
| description | TEXT (nullable) | What was worked on |
| entry_type | ENUM: timer \| manual | How time was logged |
| invoiced | BOOLEAN | Whether included in an invoice. Default: false. |
| invoice_id | UUID (nullable) | Links to invoice record if invoiced |

Indexes: (tenant_id, record_id), (tenant_id, user_id, start_time), (tenant_id, billable, invoiced).

**`billing_rates`** — Hourly rate definitions with priority hierarchy:

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| user_id | UUID (nullable) | Rate for specific user. Null for default. |
| client_record_id | UUID (nullable) | Rate for specific client. Null for non-client-specific. |
| activity_type | VARCHAR (nullable) | Rate for activity category (strategy, design, dev). |
| rate_per_hour | DECIMAL | Hourly rate |
| effective_from | DATE | When rate takes effect |
| effective_to | DATE (nullable) | When rate expires. Null for active. |

Rate resolution hierarchy (first match wins): user+client+activity → user+client → user+activity → client+activity → user → client → activity → workspace default. Resolved rate is snapshotted on `time_entries.billing_rate_snapshot`.

**`time_tracking_config`** — One per projects-type table with time tracking enabled:

Required: table_id, billable_default, require_description.
Optional: estimated_hours_field_id, actual_hours_field_id (computed rollup), activity_type_field_id, client_link_field_id (cross-link for rate lookup), rounding_increment (minutes), rounding_method (up/nearest/down).

**Rounding rules. Decided 2026-02-10:**
- **Workspace-level default** in Settings > Time Tracking: Round to nearest 1min (no rounding), 5min, 6min (1/10th hour — most common for billing), 15min, 30min. Default: no rounding. Direction: round up (standard billing practice), configurable to nearest.
- **Per-table override:** `time_tracking_config.rounding_override` (nullable). When set, overrides workspace default for that table's entries. Useful when a specific client contract requires different rounding.

### Timesheet Approval Workflow

**Simple two-stage: Submit → Approve. Decided 2026-02-10.**

| Status | Who Can Set | Editable By | Meaning |
|--------|-------------|-------------|---------|
| **Draft** (default) | Auto on create | Entry owner + Manager+ | Work in progress. Visible to owner and Manager+. |
| **Submitted** | Entry owner | Manager+ only | "Please review." Owner loses edit access. Manager notified. |
| **Approved** | Manager+ | Nobody (locked) | Billable, ready for invoicing. Manager can unlock to return to Draft. |
| **Rejected** | Manager+ | Entry owner | Returned with optional note. User fixes and resubmits. |

- `time_entries` gains `status` column: `draft | submitted | approved | rejected` (default: draft) and `reviewer_id`, `reviewed_at`, `review_note` (all nullable).
- **Bulk actions:** Manager can approve/reject entire weekly timesheet in one click.
- **No multi-level routing.** One approver level (any Manager+ on workspace). No chains.

### Timer UI

- Persistent timer widget in header (left of avatar). Shows play/stop/duration/record name.
- Start from any record detail, context menu, or `/timer start` command.
- Stop opens confirmation popover: duration, record name, billable toggle, description.
- Running timer persisted in Redis (keyed by user_id) — survives refreshes and device switches.
- Manual entry available on every record's Time panel.

### Record-Level Time Panel

Every record in a time-tracking-enabled table gains a 'Time' tab showing: summary bar (total hours, billable hours, billable amount, estimated vs actual), chronological entry list with inline edit, Add Entry and Timer buttons. Parent records include "Include subtasks" toggle for tree rollups.

### Timesheet View

Workspace-level view. Weekly grid: rows = records with logged time, columns = days. Cells show duration, click to expand/add. Weekly total with billable/non-billable breakdown. Team timesheet view for builders/owners with per-user rows and CSV export.

### Profitability Calculations

- Per-record: sum(duration × rate) vs budget field
- Per-project: roll up across task tree descendants
- Per-client: aggregate across all cross-linked records
- Per-user utilization: billable hours / available hours (from resource_profiles)

### Automation Integration

New triggers: "Time Entry Created" (entry context), "Budget Threshold Reached" (configurable %), "Timesheet Incomplete" (weekly reminder). New condition: "Branch by Profitability."

### Custom Portal App Integration (Post-MVP)

> **Note:** Per GLOSSARY.md, MVP Portals are simple Record Views with auth — no blocks. The features below are for post-MVP Custom Portal Apps built in the App Designer.

New App block: Time Summary (billable hours/amount for scoped records, configurable granularity). Internal entries never shown to clients. Retainer dashboard: KPI card with hours used / available + progress bar.

### Implementation Phase

Post-MVP — Verticals & Advanced (post-MVP). Timer widget, manual entry, and record-level panel are MVP. Timesheet view, profitability dashboards, and App time blocks follow in second iteration.

---

---

## Media & Asset Library Architecture

The Media & Asset Library extends the documents table type (`table_type = documents`) into a full asset management surface. Assets are records in the unified records table — they automatically inherit cross-linking, portal visibility, automation triggers, search, and comments.

### Architecture Approach

The documents table type is enhanced with richer rendering, version tracking, preview generation, and gallery views. A `documents_table_config` maps field IDs to asset-specific roles (same pattern as pm_table_config/wiki_table_config). Folders are records with a folder flag. Nesting uses the same self-referential parent pattern.

### Core Data Model

**`documents_table_config`** — One per documents-type table:

Required: title_field_id, file_field_id (S3/R2 URL), parent_field_id, is_folder_field_id.
Optional: description_field_id, tags_field_id, status_field_id (Draft/Approved/Archived), author_field_id, category_field_id (Logo/Photo/Document/Video/Template), default_view (gallery | list).

**`asset_versions`** — Version history per asset:

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| record_id | UUID → records.id | Which asset record |
| version_number | INTEGER | Sequential (auto-incremented) |
| file_url | TEXT | S3/R2 URL for this version |
| file_size | BIGINT | Bytes |
| file_type | VARCHAR | MIME type |
| dimensions | JSONB (nullable) | { width, height } for images/video |
| thumbnail_urls | JSONB (nullable) | { small, medium, large } |
| uploaded_by | UUID → users.id | Who uploaded |
| uploaded_at | TIMESTAMP | When uploaded |
| change_notes | TEXT (nullable) | What changed |

Indexes: (tenant_id, record_id, version_number), (tenant_id, record_id).

### Thumbnail Generation Pipeline

BullMQ job on upload. Three sizes: small (150px), medium (400px), large (800px). Stored in S3/R2.

| File Type | Preview Method |
|-----------|---------------|
| Images (PNG, JPG, WebP, GIF, SVG) | Sharp resize — full thumbnail support |
| PDF | pdftoppm first page render |
| Video (MP4, MOV, WebM) | ffmpeg frame extraction at 1s |
| Documents (DOCX, XLSX, PPTX) | LibreOffice headless → PDF → pdftoppm |
| Design files (AI, PSD, Sketch) | Generic icon + metadata (future: Filestack/CloudConvert) |
| Audio (MP3, WAV) | Waveform visualization |

Async — UI shows spinner until thumbnails ready.

### Asset Library Views

**Gallery View (default):** Grid of thumbnail cards. Responsive columns (min 180px). Filter by tag/category/type/status/date/uploader. Sort by name/date/size/type. Drag-and-drop upload into current folder.

**List View:** Spreadsheet-style with thumbnail, name, type, size, tags, status, uploader, version count. Bulk operations.

**Folder Navigation:** Left panel folder tree (same pattern as wiki/projects). Breadcrumb bar above gallery. Drag-and-drop to move between folders.

### Asset Detail Lightbox

Full-screen overlay: center preview (images zoom, PDFs paginate, videos play), right panel with Metadata/Versions/Comments tabs, toolbar (download, share, replace, delete, prev/next).

### Version History

Upload new version → new asset_versions row, record file field updated, thumbnail regenerated, all prior versions preserved. AI generates `ai_change_summary` comparing previous and current thumbnails via vision model ("Logo color changed from blue to teal, font weight increased"). Versions tab: thumbnail, number, uploader, date, notes, change summary, download/preview/restore/compare actions. Visual comparison tools (side-by-side, overlay slider, onion skin, pixel diff heat map) — see `document-intelligence.md` > Asset Version Comparison.

### Custom Portal App Integration (Post-MVP)

> **Note:** Per GLOSSARY.md, MVP Portals are simple Record Views with auth — no blocks. The features below are for post-MVP Custom Portal Apps built in the App Designer.

New App block: Asset Gallery (filtered subset of assets, configurable by tag/category/status). Brand Assets Custom Portal App template. File Upload block creates records in documents-type table with auto-tagging.

### Automation Integration

New triggers: "Asset Uploaded" (file type, size, uploader, folder, tags), "Asset Status Changed" (Draft → Approved). Enhanced actions: "Send to Storage" targets asset library folders, "Generate Document" saves to asset library with versioning.

### Search Integration

Assets indexed by Command Bar full-text search (names, descriptions, tags, folders). File content extraction (PDF/document text) and AI vision analysis (image descriptions, tags) provide content-level search via `files.extracted_text_tsv` and `files.ai_search_tsv` generated tsvector columns. Semantic search via `file_embeddings` table. See `document-intelligence.md` > Content Search Integration.

### Implementation Phase

Post-MVP, early post-launch. MVP — Foundation: config, gallery, folders, basic preview. MVP — Sync: versioning, lightbox, full thumbnail pipeline. MVP — Core UX: App Asset Gallery block, content search.

### Storage Quotas

Storage is workspace-level, shared across asset library, record attachments, Smart Doc content, and generated documents. Per-plan quotas and max upload sizes defined in `files.md` > File Size & Storage Limits (canonical source). Usage display: Settings > Storage shows bar chart with breakdown by category. Warning at 80%, hard block at 100% with upgrade prompt.

**Overages (asset library specific):** Professional $2/GB/month, Business $1.50/GB/month, Enterprise $1/GB/month. Freelancer and Starter cannot exceed quota — must upgrade.

### Design File Preview

**Defer native preview. Thumbnail generation + external open. Decided 2026-02-10.**

Native preview of Figma/Sketch/PSD requires embedded rendering engines — massive scope. Instead:
- **Thumbnails on upload:** Extract embedded preview (PSD, AI have embedded JPEGs). Common formats (PNG, JPG, SVG, PDF, MP4) via Sharp/FFmpeg server-side.
- **Preview modal:** Large thumbnail, filename, format, dimensions, file size, uploaded by, date, tags, linked records. "Download" and "Open Original" buttons.
- **Design files:** Figma URLs open in new tab. Sketch/PSD download to open locally. Generic icon + metadata in gallery.
- **Future (if demand):** Embed Figma iframe (their embed API supports it). Other design formats stay download-only.

---

---

## Ad Platform & External Data Integrations

Extends EveryStack's sync engine beyond no-code database platforms into analytics data sources (Google Ads, Meta Ads, Google Analytics, LinkedIn Ads). Enables campaign data sync, cross-linking to clients/projects, and automated client reporting.

### Architecture Challenge

Database platforms (Airtable, SmartSuite) return structured records. Ad platforms return time-series metrics (impressions, clicks, spend). Two integration patterns needed.

### Two Integration Patterns

**Pattern A: Entity Sync into Native Tables.** Sync engine pulls campaigns/ad groups/ads and creates records in native tables. Reuses existing BullMQ/base_connections architecture. Read-only (no outbound push). Configurable frequency (hourly/6h/daily/manual).

**Pattern B: Time-Series Metric Storage.** `metric_snapshots` table for trend data:

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| record_id | UUID → records.id | Which campaign/ad record |
| field_id | VARCHAR | Which metric (impressions, clicks, spend) |
| date | DATE | Date this value represents |
| value | DECIMAL | Metric value |

Unique index: (tenant_id, record_id, field_id, date). Each sync appends/upserts per-day per-metric rows. Records table stores current values in canonical_data; metric_snapshots stores history for charts.

### Supported Platforms

| Platform | Entities | Key Metrics |
|----------|----------|-------------|
| Google Ads | Campaigns, Ad Groups, Ads, Keywords | Impressions, Clicks, CTR, CPC, Cost, Conversions, ROAS |
| Meta Ads | Campaigns, Ad Sets, Ads | Impressions, Reach, Clicks, CTR, Spend, Conversions, ROAS, Frequency |
| Google Analytics 4 | Metrics only (no entity sync) | Sessions, Users, Pageviews, Bounce Rate, Conversions, Revenue |
| LinkedIn Ads | Campaign Groups, Campaigns, Creatives | Impressions, Clicks, CTR, Spend, Conversions, Leads |
| TikTok Ads (future) | Campaigns, Ad Groups, Ads | Impressions, Clicks, Spend, Conversions, Video Views |

### Connection Flow

Same OAuth pattern as Airtable/SmartSuite. Step 1: Authorize (OAuth). Step 2: Select ad accounts. Step 3: Configure sync (entity levels, metrics, backfill date range, frequency). Step 4: Auto-create native tables with appropriate fields.

### base_connections Expansion

- `platform` enum expands to include `google_ads | meta_ads | google_analytics | linkedin_ads | tiktok_ads`
- `sync_config` JSONB stores: selected account IDs, entity levels, metrics, backfill range, frequency, last_sync_at
- Sync direction implicitly inbound-only for ad platforms

### Rate Limiting

Redis-based rate limiter keyed by (platform, account_id). Per-platform concurrency limits. Exponential backoff on rate limit hits. Daily quota tracking in workspace settings.

### Cross-Linking to Business Data

Campaign records cross-linked to client records (per-client rollups), project records (creative-to-performance correlation), and invoice records (transparent billing with ad spend data). Standard cross-link creation UI — ad tables behave like any other table.

### Client-Facing Performance Reports

**Report App Pages (Custom Portal):** Chart App blocks enhanced with time-series query support against metric_snapshots. Line charts (metric over time), bar charts (comparisons), KPI cards (with period deltas), data tables.

**Automated Report Generation:** Scheduled trigger (first Monday of month) → Create Report (render App page for previous month) → Send Email (attach PDF) → Post to Custom Portal. Single automation replaces hours of manual report building.

### App Chart Block Enhancements (Custom Portal)

> **Note:** Per GLOSSARY.md, chart blocks are App blocks in the post-MVP App Designer. MVP Portals are simple Record Views with no block system.

Chart blocks use the shared chart component library from `chart-blocks.md`. The enhancements below add the `metric_snapshot` data binding mode (Mode C) to the existing chart system.

New data source: "Metric History" (alongside "Table Records" and "Cross-Linked Records"). Config: record picker, metric picker, date range, aggregation (daily/weekly/monthly). Comparison mode: two metrics on same chart, or same metric across periods. Multi-record mode: compare campaigns on one chart.

### Implementation Phase

Post-MVP — Verticals & Advanced (post-MVP). Depends on mature portals/doc gen/automations. 8a: metric_snapshots, adapter pattern, Google Ads. 8b: Meta Ads, GA4, Chart block enhancements. 8c: LinkedIn Ads, report templates, cross-platform dashboards. Future: TikTok, Pinterest per demand.

### Platform Priority

**Decided 2026-02-10.** Google + Meta cover 80%+ of agency ad spend. Ship those first, validate pattern, add per demand.

| Priority | Platform | Phase | Rationale |
|----------|----------|-------|-----------|
| 1 | **Google Ads** | 8a | Largest ad platform. Every agency uses it. |
| 1 | **Meta Ads** (Facebook + Instagram) | 8b | Second largest. Single API covers both. |
| 2 | **LinkedIn Ads** | 8c | B2B agencies. Smaller but high-value. |
| 3 | **TikTok Ads** | 9+ | Growing but smaller agency adoption. Newer API. |
| 4 | **Twitter/X Ads** | 9+ | Declining agency spend. Low priority. |

### Developer Token Acquisition

**Start process in Post-MVP — Comms & Polish, ship in Post-MVP — Verticals & Advanced. Decided 2026-02-10.**

- **Google Ads:** Create Google Cloud project → apply for developer token (basic: 15K ops/day) → submit for Standard Access review (2-4 weeks, requires demo video + privacy policy).
- **Meta Ads:** App Review for Marketing API access (similar timeline and requirements).
- Start both applications simultaneously during Post-MVP — Comms & Polish to absorb lead time.
- **No user-provided API keys.** EveryStack holds platform-level developer tokens (same pattern as Google Places for address fields). Users authenticate via OAuth to grant read access to their ad accounts.

### metric_snapshots Retention Policy

**Raw 90 days, daily aggregates forever. Decided 2026-02-10.**

| Tier | Granularity | Retention | Purpose |
|------|-------------|-----------|---------|
| Raw snapshots | Per-sync (hourly/6h) | 90 days | Debugging, recent detailed analysis |
| Daily aggregates | Per-day | Forever | Historical reporting, trend analysis |
| Monthly aggregates | Per-month | Forever | Long-range, year-over-year |

- Nightly BullMQ job aggregates raw data older than 90 days into daily records, then deletes raw.
- Storage impact: minimal — ~10 numeric columns per row. 3 years of daily aggregates for 100 campaigns ≈ ~100K rows.

---

