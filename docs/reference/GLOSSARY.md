# EveryStack — Glossary & Source of Truth

> **This is the authoritative definition of every concept in EveryStack.** If a reference doc, phase playbook, or CLAUDE.md contradicts this document, this document wins. Every concept is defined once. Every name is final. No synonyms, no aliases, no "formerly known as."
>
> Last updated: 2026-03-12 — Added Process & Workflow section (7 terms: Build Unit, Subdivision Doc, Interface Contract, Context Manifest, Context Budget Test, Planning Gate, Seam). Prior: 2026-03-09 — Phase 3A-ii prep: added 6 terms (Card View, Summary Footer, Color Coding, Inline Sub-Table, CSV Import, Field-Level Presence Locking); broadened Section definition from sidebar-only to universal list organizer. Prior: 2026-03-09 — Added AI Skills & Platform Agents section (9 terms). Prior: 2026-03-09 — Post-Phase 3A-i docs sync (Grid View, TableType, Tab Color + sub-definitions).

---

## Platform Overview

EveryStack is a multi-tenant SaaS that unifies no-code databases (Airtable, SmartSuite, Notion). It connects to external platforms via APIs, caches data in PostgreSQL using a canonical JSONB format, and provides cross-platform linking, client portals, document generation, automations, and AI — all from a single interface.

**Target user:** SMBs (2–50 people) using Airtable, SmartSuite, or Notion as their operational backbone.

**Core value proposition:** Connect your scattered databases. Link records across platforms. Share data with clients. Generate documents. Automate workflows. All with AI that understands your schema.

---

## Concept Map — How Everything Relates

```
EveryStack Platform
│
├── My Office (personal hub — home screen)
│   ├── Widget Grid (Tasks, Calendar, Chat, Workspaces, etc.)
│   └── Quick Panel expansion (2/3 width, other widgets stack in 1/3)
│
├── Quick Panels (context-dependent — side panel in workspace, widget expansion on My Office)
│   ├── Chat / DMs
│   ├── Tasks
│   └── Calendar
│
├── Tenant (organization — billing, identity, RLS boundary)
│   ├── Boards (optional grouping of workspaces — permission convenience)
│   └── Workspaces (multi-platform table containers)
│       ├── Tables (synced from Airtable, SmartSuite, Notion — or native)
│       │   ├── Table Views (Grid, Card, Kanban, List, Gantt, Calendar, etc.)
│       │   │   └── My Views / Shared Views (user or team filter/sort/group configs)
│       │   ├── Record View (overlay — configurable field canvas for one record)
│       │   │   └── Record Thread (contextual comms panel alongside Record View)
│       │   ├── Cross-Links (relationships between tables, even across workspaces and platforms)
│       │   └── Fields (typed data — text, number, date, select, linked record, etc.)
│       ├── Portals (externally-shared Record View of one record)
│       ├── Forms (Record View layout that creates new records)
│       ├── Automations (trigger → action flows)
│       └── Documents (merge-tag templates → PDF output)
│
├── App Designer (separate full-screen tool — post-MVP)
│   └── Apps (custom portals, internal apps, websites, POS, etc.)
│
├── Platform API (external programmatic access — verticals, integrations, scripts)
│   ├── Data API (Record CRUD, Table queries)
│   ├── Schema API (Table/Field/Cross-Link structure, SDS)
│   ├── Provisioning API (create Workspaces, Tables, Fields, Automations, Portals, Forms)
│   ├── AI API (AIService consumption, prompt templates)
│   └── Automation API (trigger, status, webhook management)
│
└── AI Layer (embedded throughout — not a separate surface)
    ├── Natural Language Search (Command Bar)
    ├── Smart Fill (AI-generated field values)
    ├── Record Summarization
    ├── Document AI Draft
    └── Field & Link Suggestions
```

---

## Definitions — Platform Level

### My Office

The personal home screen. Shows a widget grid of platform-level tools: Tasks, Calendar, Chat/DMs, Workspaces list, and more. Each widget is a responsive component.

**Desktop layout:** 3 equal-width columns by default. Clicking a Quick Panel icon (when on My Office) expands that widget to 2/3 of the main panel width. The remaining widgets stack vertically in the remaining 1/3.

**Mobile layout:** Workspace tiles as the initial view. Bottom tab bar provides access to Quick Panels (Chat, Tasks, Calendar, +).

**What it is:** Your personal cockpit across all workspaces.
**What it is NOT:** A workspace. My Office has no tables, no records, no workspace-specific data. It aggregates personal items across all workspaces.

### Quick Panels

The platform-level tools (Chat/DMs, Tasks, Calendar) accessible via sidebar icons on any page. They are the same components as the My Office widgets, rendered responsively to fit their container. Context determines behavior:

**In a Workspace:** Quick Panel opens as a 25% side panel to the right of the sidebar, pushing the main panel content right to 75%. Both are visible and usable simultaneously.

**In My Office:** Quick Panel icon rearranges the widget grid — the selected widget expands to 2/3 width, remaining widgets stack in the other 1/3.

**Behavior:** Push-style (not overlay). The Quick Panel coexists with whatever the user is working on. Clicking the same icon again collapses the panel (workspace) or returns to default grid (My Office).

**What they are:** Ambient access to personal tools without leaving your current context.
**What they are NOT:** Record-level communication. Quick Panels show _your_ DMs, _your_ tasks, _your_ calendar. They do not show record-scoped comments or threads. See: Record Thread.

### Sidebar

A persistent left-edge navigation column. **Collapsed by default (48px icon rail)**, expandable to **~280px** via a dedicated toggle button (above avatar).

**Collapsed state (48px):** Icons only — My Office (🏠), Tasks (✅), Chat (💬), Calendar (📅), expand toggle (⟷), Help (❓), avatar (👤).

**Expanded state (~280px):** Icon rail + content zone. Shows Quick Panel labels and the Workspace tree (Boards → Workspaces).

**Expand/Collapse Toggle (⟷ button, above avatar):** Toggles sidebar between 48px and ~280px. Same behavior everywhere.

**My Office icon (🏠):** On My Office page — expands sidebar (same as toggle). On any other page — navigates to My Office.

**Quick Panel icons (Chat, Tasks, Calendar) — context-dependent:**

- On My Office: rearranges widget grid (selected widget to 2/3, others stack in 1/3).
- In a workspace: opens 25% side panel to the right of the sidebar, pushing main content right.

**Help icon (❓, above expand toggle):** Opens the Help Panel — a slide-out panel with three tabs: Ask AI (post-MVP), Browse Help, and Contact Support. Present on every page. See: Help Panel.

**Table View navigation:** NOT in the sidebar. Table views are accessed from the table's own Grid toolbar. The sidebar handles cross-workspace navigation + personal productivity; the table toolbar handles workspace-internal navigation.

### Help Panel

A slide-out panel accessible via the Help icon in the sidebar icon rail. Three tabs:

- **Tab 1 — Ask AI:** AI-first support chat that rephrases-and-confirms before answering. Post-MVP (requires AI agent runtime). MVP interim: simplified smart triage form with category-based follow-up questions.
- **Tab 2 — Browse Help:** Links to documentation, getting started guides, keyboard shortcuts. MVP: static link list. Post-MVP: embedded knowledge base.
- **Tab 3 — Contact Support:** Submit a support request (creates a `support_requests` row) and view history of prior requests. MVP.

**What it is:** The user-facing entry point for all help and support.
**What it is NOT:** A Quick Panel. The Help Panel is not a productivity tool — it does not rearrange the My Office widget grid or open a side panel in workspace context. It is always a slide-out overlay. See: `support-system.md` for full specification.

### Platform Owner Console

The operator-facing tooling for managing the EveryStack business. Not a tenant-facing feature. Two layers:

- **`/admin` route:** System-level operator ops (tenant management, billing actions, impersonation, feature flags, support triage, platform health). Always available — bypasses RLS, reads directly from DB and Stripe. Gated by `users.is_platform_admin = true`. Scope: Post-MVP — Platform Operations.
- **Platform Workspace:** A real EveryStack workspace (`tenants.is_internal = true`) used to operate EveryStack as a business using EveryStack itself. Dogfooding layer. Created manually once MVP — Core UX is complete.

See: `platform-owner-console.md` for full specification.

### Support Agent

A platform user with `users.is_support_agent = true`. Support agents have scoped access to `/admin/support` (ticket queue, AI drafts, tenant context) but cannot access billing data, impersonate users, or use other admin functions. Distinct from `is_platform_admin`. See: `support-system.md`.

### Support Tier

A per-tenant setting (`tenants.support_tier`) that determines support routing and response expectations. Three values:

- **standard:** AI-first triage, human escalation via urgency signals (default for Freelancer/Starter/Professional plans)
- **priority:** Faster human response, priority queue placement (Business plan)
- **enterprise:** Contract-defined SLA, dedicated contact, on-call support (Enterprise plan, negotiated per contract)

---

## Definitions — Workspace Level

### Workspace

A container for tables, views, portals, forms, automations, and documents. Workspaces live within a Tenant (organization) and are analogous to "bases" in Airtable but with a critical difference: **a single Workspace can contain tables from multiple platforms and multiple bases within those platforms.**

Example: A "Client Operations" workspace might contain a Clients table from Airtable, a Projects table from SmartSuite, and a Knowledge Base from Notion — all linked together via Cross-Links.

**What it is:** A unified data environment where tables from different sources coexist and connect.
**What it is NOT:** A 1:1 mirror of an Airtable base or a tenant. A workspace is platform-agnostic and sits below the tenant level. One tenant has many workspaces.

### Table

A structured dataset — rows (records) and columns (fields). Tables are either **synced** from an external platform (Airtable, SmartSuite, Notion) or **native** (created directly in EveryStack). Synced tables cache data in PostgreSQL using the canonical JSONB format and stay in sync via the Sync Engine.

Every table has a `table_type` that determines its default behavior:

| Type        | Default View                       | Purpose                        |
| ----------- | ---------------------------------- | ------------------------------ |
| `table`     | Grid                               | Standard rows and columns      |
| `projects`  | List (post-MVP; Grid for MVP)      | Project/task management        |
| `calendar`  | Calendar (post-MVP; Grid for MVP)  | Events, appointments, bookings |
| `documents` | Gallery (post-MVP; Grid for MVP)   | File storage, generated docs   |
| `wiki`      | Smart Doc (post-MVP; Grid for MVP) | Knowledge base, internal docs  |

The `table_type` controls presentation defaults. All types store data the same way (`records.canonical_data` JSONB). Any view type is available on any table type.

**MVP table_types:** `table`, `projects`. Both use Grid as the default view at MVP.

**Post-MVP table_types:** `calendar`, `documents`, `wiki`. These ship when their default view types (Calendar, Gallery, Smart Doc) become available. Until then, users who need calendar or document tables use the `table` type with appropriate fields.

### Field

A typed column on a table. Fields define what kind of data a cell holds (text, number, date, select, linked record, formula, etc.). The Field Type Registry defines all available types. Fields have configuration (required, default value, validation rules) and can be restricted per role via the permission system.

**Key MVP field categories:** Text, Number, Date, Select/Multi-Select, Checkbox, Email, Phone, URL, Attachment, Linked Record (Cross-Link), Auto-Number, Created/Modified timestamps.

### Record

A single row in a table. Records store their data in the `canonical_data` JSONB column in a platform-agnostic format. For synced tables, the Sync Engine translates between the canonical format and the platform-native format.

### Table View

A configured way of looking at a table's records. Table Views define which records are visible (filters), how they're ordered (sorts), how they're grouped, and which fields are shown.

**View types (MVP):** Grid, Card.
**View types (post-MVP):** Kanban, List, Gantt, Calendar, Gallery, Smart Doc.

**Shared Views:** Created by Manager+ roles. Visible to all workspace members with access. Define the default experience for a table.

**My Views:** Created by any user for themselves. Personal filter/sort/group overrides on top of a shared view. Only visible to the creator.

**What Table Views are:** Filtered, sorted, configured lenses on table data.
**What Table Views are NOT:** Custom spatial layouts. Table Views follow a predefined structure (grid columns, card layouts, kanban columns). For custom spatial layouts, see: App Designer (post-MVP).

### Grid View

The primary Table View type at MVP. Renders records as rows in a virtualized spreadsheet-style grid (TanStack Virtual). Key architectural components:

- **DataGrid** — Root component: virtualizes rows/columns, manages frozen columns, row density, keyboard navigation, clipboard, undo/redo, drag-to-fill, column resize/reorder, row reorder.
- **Cell Registry** — Registry pattern (no switch statements) mapping `field_type` → `{ DisplayComponent, EditComponent }`. Uses `registerCellRenderer()` / `getCellRenderer()`, consistent with the FieldTypeRegistry pattern. See `apps/web/src/components/grid/cells/cell-registry.ts`.
- **GridStore** — Per-grid-instance Zustand store managing active cell, editing state, density, frozen columns, column widths, column order, column colors, hidden fields, and row selection. Not a global store — each DataGrid instance creates its own. See `apps/web/src/components/grid/use-grid-store.ts`.
- **ViewConfig** — Zod-validated schema for `views.config` JSONB: column widths, frozen column count, row density (`compact` | `medium` | `tall`), column order, column colors, default flag. See `apps/web/src/lib/types/grid.ts`.
- **CellPosition** — `{ rowId, fieldId }` coordinate pair identifying a single cell in the grid. Used by keyboard navigation, clipboard, and editing state.

**Row density:** Three density levels — compact (32px), medium (44px), tall (64px). Stored in ViewConfig. Medium is the default.

### TableType

TypeScript union type (`'table' | 'projects' | 'calendar' | 'documents' | 'wiki'`) defining the five table types. Each type has metadata: icon (Lucide), default tab color, default view type (all `'grid'` for MVP), and i18n label key. MVP table types: `table`, `projects`. See `apps/web/src/lib/constants/table-types.ts`.

### Tab Color

Customizable color assigned to a table via `tables.tab_color`. If null, defaults to the table type's default color. Ten-color palette with light and dark mode hex values. Resolved by `resolveTabColor()` which auto-selects dark hex for sidebar context. Independent of PlatformBadge — two separate visual channels. See `apps/web/src/lib/constants/table-types.ts`.

### Record View

A configurable canvas for viewing and editing a single record. When a user clicks a row in a Table View, the Record View expands as an overlay from the right side of the screen.

**Layout:**

- **Header:** Record name, colored by workspace/platform theme.
- **Body:** White canvas displaying selected fields arranged in columns.
- **Columns:** Up to 4 on desktop, up to 2 on mobile. Fields are rearrangeable and adjustable in width (spanning 1–4 columns) and height.
- **Tabs:** Record View can be single-paged or multi-tabbed for complex records.
- **Mobile:** Single column (possibly double on large screens). Full-screen sheet.

**Screen dimensions:**

- "Main panel" = everything to the right of the icon rail (full viewport minus 48px rail). Record View overlay dimensions are always relative to this full main panel width, regardless of Quick Panel state — opening a Record View collapses or covers the Quick Panel.
- Record View alone: 60% of main panel width, overlay from right.
- Record View + Record Thread: 80% total (55% Record View + 25% Record Thread).
- Main panel content is dimmed but visible behind the overlay (~20% visible).

**Saved Record Views:** Multiple Record View configurations can be saved per table and applied to individual Table Views. This means different Table Views of the same table can show different field layouts when a record is expanded.

**What Record View is:** The primary way users interact with individual records.
**What Record View is NOT:** A page builder. Record View arranges fields on a canvas. It does not support arbitrary blocks, containers, or spatial layouts. For that, see: App Designer (post-MVP).

### Record Thread

A contextual communication panel tied to a specific record. Opens alongside the Record View (to its right, 25% of screen width). Contains record-scoped comments, @mentions, activity history, and (post-MVP) client-visible messages.

**Behavior:** Opens from within an expanded Record View. Overlay-style (same as Record View). Both panels coexist at 55% + 25% of screen width.

**Mobile:** When a record is expanded, the bottom tab bar contextually swaps from Quick Panel tabs to Record Thread tabs (Comments, Activity, Files, etc.).

**What Record Thread is:** Communication _about_ a specific record.
**What Record Thread is NOT:** Personal DMs or team chat. Those live in Quick Panels. Record Thread is always scoped to one record.

### Card View

A card-based Table View type (`view_type: card`). MVP view type alongside Grid. Cards display fields in order defined by the view's `field_config`, with inline editing (click, edit, blur to save). Three layout options: single column (full-width), grid (2–3 cols), compact list. Shares all Grid capabilities: hide/show fields, filtering, grouping, sorting, color coding. Mobile uses compact list layout with swipe actions. See `tables-and-views.md` > Card View.

### Summary Footer

An optional row below the grid data area. Each column is independently configurable with field-type-appropriate aggregations (sum, avg, min, max, count, earliest, latest, etc.). Click a footer cell to pick the aggregation type. Sticky to bottom of the viewport. Per-group footers also available when grouping is active. See `tables-and-views.md` > Summary Footer Row.

### Color Coding

Conditional visual coding applied to grid rows and cells. Two combinable levels: **row-level** (entire row background tint based on conditions) and **cell-level** (individual cells colored by value or conditions). Configured per view. Separate from structural column coloring and tab colors. See `tables-and-views.md` > Color Coding, `field-groups.md` > conditional cell coloring cascade.

### Inline Sub-Table

A compact linked record widget that displays linked records as an embedded mini-grid within Record View. Configured via the `display` property on a Linked Record field (`style: "inline_table"`). Designed for parent-child patterns (invoice → line items, project → tasks). Supports inline creation, deletion, reorder, and spreadsheet-like editing (Tab, Enter, Escape). No new tables — purely a rendering mode on existing Linked Record fields. Summary row deferred to post-MVP (requires rollups). See `tables-and-views.md` > Inline Sub-Table Display for Linked Records.

### CSV Import

A guided data import flow for adding records to existing tables from CSV/TSV files. Five steps: upload (max 10MB, Papaparse client-side parsing), preview & header detection, field mapping (fuzzy auto-match), validation preview (dry-run via `FieldTypeRegistry.validate()`), import execution (batches of 100 via standard `createRecord` path). Manager+ role required. MVP scope: CSV only; Excel import, linked record resolution, and update-by-match are post-MVP. See `tables-and-views.md` > CSV/Data Import — MVP.

### Field-Level Presence Locking

A real-time collaboration mechanism that prevents concurrent editing of the same field on the same record. When a user focuses a field, a Redis lock is acquired (`lock:{tenantId}:{recordId}:{fieldId}` → `{userId, avatar, timestamp}`, TTL 60s). Other users see the editing user's avatar on the field and the field becomes temporarily non-interactive. Lock releases on blur (auto-save) or after 60 seconds of no keystrokes. No queue — if locked, other users wait. WebSocket broadcasts lock/unlock events. See `tables-and-views.md` > Multi-User Collaboration.

---

## Definitions — External-Facing (MVP)

### Portal

A client-facing view of workspace data, shared externally with its own auth and no workspace chrome. Two types coexist:

**Quick Portal (MVP):** An externally-shared Record View of a single record. Uses the same field canvas layout as Record View but rendered as a standalone page. Auth via `portal_access` table (per-record explicit grants). Setup: 2 minutes. DB: `portals` table.

**App Portal (post-MVP):** A multi-page, multi-record client application built in the App Designer. Identity-based scoping via `portal_clients` table (`linked_record_id` → CRM contact). Custom spatial layouts, block-based design, data binding, themes. DB: `apps` table.

**Scoping (Quick Portal):** One portal link = one record. The client sees only the fields and data the Manager has configured for that portal layout. Linked record data can be included if desired.

**Scoping (App Portal):** Identity-based — derived from data relationships via `linked_record_id` and per-table scoping fields. Client automatically sees all records that belong to them.

**Auth:** Magic link or email + password. Manager chooses per portal. Both types use `portal_sessions` with polymorphic auth (`auth_type` + `auth_id`).

**`portal_client` as enum value:** `portal_client` appears as an `author_type` (thread_messages) and `actor_type` (audit_log) enum value across the platform. This is a logical actor type meaning "an external portal user" — it is NOT a reference to the `portal_clients` table (which is post-MVP, App Portal only).

**Permissions:** Default read-only. Manager can selectively make specific fields editable.

**Access:** Standalone URL: `portal.everystack.app/{tenant-slug}/{portal-slug}` (tenant-scoped slugs — CP-001-A). Multi-record URL: `portal.everystack.app/{tenant-slug}/{portal-slug}/{record-slug}`. Or magic link sent to client.

**What a Quick Portal is:** A Record View shared externally with auth and permissions.
**What a Quick Portal is NOT:** A multi-page website, a dashboard showing multiple records, or a custom spatial layout. Those are App Portals built in the App Designer.

**Optional conversion:** Manager can upgrade a Quick Portal to an App Portal. Both types coexist permanently — conversion is optional, not inevitable.

**Conversion mechanics (post-MVP):** When upgrading a Quick Portal to an App Portal:

1. Manager selects a "client identity table" (e.g., Contacts) — this becomes the `portal_clients.linked_record_id` target.
2. For each `portal_access` row, the system matches the email to a record in the identity table. Matched → creates a `portal_clients` row with `linked_record_id` pointing to that contact. Unmatched → Manager prompted to create a contact record, manually map, or skip.
3. The App Portal's per-table scoping config determines which additional records the client can see based on data relationships to their contact record.
4. Original `portal_access` rows are soft-deleted after successful migration. `portal_sessions` are preserved (polymorphic `auth_type` switches from `'quick'` to `'app'`).
5. The two auth models (`portal_access` for Quick, `portal_clients` for App) never coexist on the same portal — a portal is one type or the other.

### Form

A data-input view that creates new records in a target table. Two types coexist:

**Quick Form (MVP):** A Record View layout configured for data _input_ rather than data _display_. Fields are empty, validation rules apply, and submission creates a new record. Uses the same field canvas layout system as Record View (columns, widths, heights, field arrangement). Setup from the table toolbar in under 2 minutes. DB: `forms` table.

**App Form (post-MVP):** A multi-step, conditional-logic form built in the App Designer. Branching paths, custom spatial layouts, block-based design, multi-page steps. DB: `apps` table.

**Auth:** None required (public) or link-gated. Both types.

**Spam protection:** Cloudflare Turnstile.

**Access:** Standalone URL, embeddable via script tag or iframe.

**Behavior (Quick Form):** Submit action with configurable success behavior (thank you message, redirect, or submitted data summary).

**Behavior (App Form):** Same success options plus conditional step routing, partial saves, and custom validation logic per step.

**What a Quick Form is:** A Record View layout that creates new records — fast to set up, always available from the table toolbar.
**What a Quick Form is NOT:** A form builder with conditional logic, multi-page steps, or branching. Those are App Forms built in the App Designer.

**Optional conversion:** Manager can upgrade a Quick Form to an App Form. Both types coexist permanently — conversion is optional, not inevitable.

See `forms.md` for Quick Form specification. For App Forms, see `app-designer.md`.

---

## Definitions — Cross-Linking

### Cross-Link

A relationship between two tables — even if those tables are in different workspaces, synced from different platforms, or different bases within the same platform. Cross-linking is EveryStack's primary differentiator. **Cross-links are tenant-scoped: any table can link to any other table within the same tenant, across any workspace.**

**Example:** An Airtable "Clients" table linked to a SmartSuite "Projects" table. The link exists only in EveryStack — neither platform knows about it.

**MVP scope:**

- Create cross-links between any tables (same or different platforms).
- Display linked record data in grid cells (compact summary) and Record View (full linked fields).
- Single-hop lookups: show fields from the linked record.
- Basic link creation UI: source table → target table → linking field.

**Post-MVP:** Rollups, formulas across links, cascade engineering, impact analysis, convert-to-native-table, deep link traversal (multi-hop).

**What a Cross-Link is:** A platform-agnostic record relationship managed by EveryStack.
**What a Cross-Link is NOT:** A native relationship in Airtable/SmartSuite/Notion. Cross-links exist only in EveryStack's data layer. They are never synced back to the source platform.

---

## Definitions — Documents

### Document Template

A reusable layout for generating PDFs from record data. Uses a Rich Text editor with merge tags — placeholders that pull field values from a specific record at generation time.

**MVP scope:**

- Rich Text editor with merge tag picker (select fields from the record's table and linked tables).
- PDF output via Gotenberg.
- "Generate Document" button on Record View.
- AI Draft option: AI generates prose content using record data + SDS context.
- Saved templates per table.

**Post-MVP:** Full Document App type in App Designer (fixed-page canvas, DOCX output, header/footer zones, batch generation, complex layouts). See: App Designer.

**What a Document Template is (MVP):** Mail merge for PDFs. Pick a template, pick a record, get a PDF.
**What a Document Template is NOT (MVP):** A page layout tool. MVP doc gen is content-focused (rich text with merge tags), not design-focused (spatial blocks on a canvas).

---

## Definitions — Automations

### Automation

A trigger → action flow that executes automatically when conditions are met. MVP automations are linear (no branching, no conditions, no loops).

**MVP triggers:**
| Trigger | Description |
|---------|-------------|
| Record Created | A new record is added to a table |
| Record Updated | Any field on a record changes |
| Field Value Changed | A specific field changes to/from a specific value |
| Form Submitted | A Form creates a new record |
| Button Clicked | User clicks an automation button on a Record View |
| Scheduled | Runs on a schedule (daily, weekly, custom cron) |

**MVP actions:**
| Action | Description |
|--------|-------------|
| Send Email | Send a templated email (Resend) |
| Create Record | Create a new record in any table |
| Update Record | Update fields on the triggering record or a linked record |
| Generate Document | Produce a PDF from a Document Template |
| Send Notification | In-app notification to specified users |
| Adjust Field Value | Atomic increment/decrement on a number field |
| Send Webhook | POST data to an external URL |

**Builder UI (MVP):** Simple step-by-step list builder. Select a trigger, add actions in sequence. No visual canvas, no branching, no parallel paths. Configured via a form-style panel, not a drag-and-drop flow chart.

**Post-MVP:** Visual flow canvas (React Flow), branching conditions, loops, Wait for Event steps, 22+ triggers, 42+ actions, AI-generated automations, recipe templates. See reference docs for full spec.

**What an Automation is:** A saved trigger → action sequence that runs without user intervention.
**What an Automation is NOT (MVP):** A visual flow chart, a code editor, or an AI agent. Keep it simple.

---

## Definitions — AI Layer

### AIService

The abstraction layer through which all AI features operate. Feature code never references providers or models directly. Instead, features request a capability tier:

| Tier       | Use Case                                                  | Cost                 |
| ---------- | --------------------------------------------------------- | -------------------- |
| `fast`     | Field suggestions, categorization, quick completions      | Low (1 credit)       |
| `standard` | Natural language search, record summarization, Smart Fill | Medium (1–2 credits) |
| `advanced` | Document AI drafts, complex analysis                      | Higher (2–5 credits) |

The AIService resolves tiers to specific models based on configuration. Provider swaps never touch feature code.

_Approximate ranges above are for plan communication. Actual credits computed dynamically from API cost (1 credit = $0.01 of Anthropic API spend, rounded up). See ai-metering.md for computation details._

### Schema Descriptor Service (SDS)

A service that produces structured descriptions of a tenant's schema — tables, fields, field types, cross-links, relationships across all workspaces — in a format optimized for AI consumption. Every AI feature consumes SDS output as context so the AI understands the user's data model without re-discovering it each time. SDS operates at the tenant level to support cross-workspace cross-link suggestions.

**Why it matters:** SDS is what makes EveryStack's AI _contextual_. Instead of a generic chatbot, every AI call knows: "This workspace has a Clients table linked to Projects linked to Invoices, and the user is looking at Project #47 for Acme Corp." That context is what produces useful results.

### AI Credit System

A simple metering system. Each AI operation costs credits. Credits are included in the plan (200–20,000/month depending on tier). Features gracefully disable at exhaustion — no overages, no blocking, no surprises.

### Natural Language Search

Users type plain English into the Command Bar. AI translates the query into filters on the appropriate table using SDS context.

Example: "overdue invoices for Acme Corp" → filters the Invoices table to `due_date < today AND status ≠ paid AND client = Acme Corp`.

**Where it lives:** Command Bar (keyboard shortcut to open, available from any page).

### Smart Fill

Right-click a field column → "Fill with AI." AI examines the record's other fields and generates a contextually appropriate value. Works on text, select, and multi-select fields.

Example: On a Projects table, Smart Fill on a "Summary" field reads the project name, status, task count, and client name, then generates a one-line summary.

### Record Summarization

A "Summarize" action on the Record View that produces a natural language summary of the record and its linked data. Uses SDS for context.

Example: "Project Alpha for Acme Corp. Started Jan 15. 3 of 7 tasks complete. $12,400 billed of $25,000 budget. Last activity 2 days ago."

**Also available in Portals:** Clients see a plain-English summary of their record.

### Document AI Draft

When generating a document from a template, an "AI Draft" option generates prose content (cover letters, proposal narratives, summary sections) using record data. Merge tags handle structured fields; AI handles the human-readable parts.

### Field & Link Suggestions

During table setup or when connecting new tables, AI suggests: field types based on data patterns, cross-link candidates across existing tables, and missing fields common for the table's use case.

Example: "You have a Clients table and an Invoices table. Want to link them by the Client field?"

---

## Definitions — AI Skills & Platform Agents (Post-MVP)

### Runtime AI Skill

A curated knowledge document that the AI Context Builder loads alongside schema context to eliminate orientation cost. Skills encode how features work, how integrations behave, and how a specific workspace uses them — so the AI spends its token budget on productive work instead of rediscovering the platform every session.

Skills operate at three tiers:

| Tier | What It Encodes | Generated By | Storage |
|------|----------------|-------------|---------|
| **Tier 1 — Platform Skills** | How EveryStack features work (static, human-written) | Platform team or Skill Maintenance Agent (human-approved) | `packages/shared/ai/skills/documents/` (version-controlled) |
| **Tier 2 — Workspace Context Skills** | How a specific workspace uses features and integrations (dynamic) | Workspace Usage Descriptor | Redis cache (`wud:{workspaceId}:{configHash}`) |
| **Tier 3 — Behavioral Skills** | Patterns observed from actual usage (learned over time) | Usage pattern analysis from `ai_usage_log` | Redis cache (keyed per user within workspace) |

**Full specification:** `ai-skills-architecture.md`.

### Feature Skill Registry

The module at `packages/shared/ai/skills/` that manages runtime AI skills. Contains the `SkillRegistry` class, a loader (fits skills within token budgets using three pre-written condensation levels: full/standard/minimal), a parser for markdown skill files with YAML frontmatter, and type definitions (`SkillDocument`, `LoadedSkill`).

### Skill Condensation Level

Each skill document has three pre-written versions at different token budgets — `full`, `standard`, and `minimal`. A human decides which facts are essential at each level because feature knowledge doesn't condense well algorithmically. The Token Budget Allocator selects the appropriate level based on available context window budget.

### Integration Skill

A Tier 1 skill document that encodes knowledge about an external platform (HubSpot, Google Analytics, Stripe, etc.). Covers MCP tools, common query patterns, response shapes, rate limits, EveryStack field mapping conventions, and API version awareness. Includes `lastVerified` date and `externalApiVersion` metadata for automated drift detection.

### Workspace Usage Descriptor

A companion module to SDS that produces behavioral context about how a workspace uses features and integrations. While SDS provides _what tables and fields exist_, the Workspace Usage Descriptor provides _how the workspace uses them_ — integration inventory, automation patterns, portal configurations, document template patterns. Cached like SDS output. Generates Tier 2 workspace context skills.

### Token Budget Allocator

Extends the SDS Token Budget Estimator into a shared budget across four consumers: (1) Platform + integration skills, (2) Workspace context skills, (3) SDS schema, (4) Conversation history / few-shot / behavioral. Skills get first priority because they are small (500–2,000 tokens) but extremely high value per token.

### Skill Maintenance Agent

A platform-level agent (see Platform Maintenance Agent) that monitors skill quality, detects declining performance from `ai_usage_log` data, drafts updated skill content, validates via eval suite, and packages proposals for human approval. Runs weekly on a scheduled cadence. Can investigate integration drift by running exploratory MCP tool calls against live integrations. Drafts but never deploys — human approval always required.

**Full specification:** `ai-skills-architecture.md` §10, `platform-maintenance-agents.md` §6.

### Platform Maintenance Agent

An autonomous AI agent that operates at the platform level — across tenants — on behalf of the platform owner. Unlike user-facing agents (scoped to a single workspace), platform agents have cross-tenant read access via a dedicated RLS-exempt service role. They run on a dedicated BullMQ queue (`platform-agent-queue`) with lower priority than user-facing work.

Seven platform agents are defined:

| Agent | Purpose |
|-------|---------|
| Security & Compliance | Continuous security posture monitoring, compliance drift detection |
| Ops Intelligence | Infrastructure health analysis, capacity planning, anomaly detection |
| Sync Health | Cross-tenant sync failure pattern analysis, adapter quality monitoring |
| Automation Health | Automation failure pattern detection, performance optimization |
| Business Intelligence | Revenue analytics, growth metrics, churn risk identification |
| Skill Maintenance | AI skill quality monitoring and improvement (see Skill Maintenance Agent) |
| Data Quality | Schema consistency, orphan detection, data hygiene across tenants |

All platform agents use the tiered approval model from `agent-architecture.md`. Results surface in the Platform Owner Console (Settings → AI → Platform Agents).

**Full specification:** `platform-maintenance-agents.md`.

### Platform Agent Runtime

The execution infrastructure for platform maintenance agents. Extends the user-facing agent runtime from `agent-architecture.md` with: a dedicated BullMQ queue (`platform-agent-queue`), an RLS-exempt database service role for cross-tenant reads, platform-scoped Redis namespaces, and schedule-based triggers (cron via BullMQ repeatable jobs). Each agent runs in a sandboxed `AgentSession` with explicit scope boundaries defining which tables, operations, and tenant data it can access.

---

## Definitions — Platform API

### Platform API

The external programmatic interface to EveryStack. A versioned, authenticated, rate-limited REST API that exposes the same operations the web application uses internally. Every operation — Record CRUD, Table queries, Automation triggers, Document Generation, AI calls — is available to external consumers through the Platform API.

**Audiences:** Branded vertical products (see `vertical-architecture.md`), third-party integrations (Zapier, Make, MCP clients), and EveryStack customers automating their own workflows. All consumers use the same endpoints — there are no vertical-specific or customer-specific API surfaces.

**Base URL:** `/api/v1/`

**API groups:**

| Group                | Purpose                                                                                                     | Required Scope                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Data API**         | Record CRUD, Table queries with filters/sorts                                                               | `data:read`, `data:write`                                            |
| **Schema API**       | Read Table/Field/Cross-Link structure, SDS endpoint                                                         | `schema:read`                                                        |
| **Provisioning API** | Create Workspaces, Tables, Fields, Cross-Links, Automations, Quick Portals, Quick Forms, Document Templates | `schema:write`, `automation:write`, `portal:write`, `document:write` |
| **AI API**           | Consume AIService — capability-routed completions, prompt template registration                             | `ai:use`                                                             |
| **Automation API**   | Trigger Automations, query run status, manage webhooks                                                      | `automation:trigger`, `automation:read`                              |
| **File API**         | Presigned upload URLs for S3/R2 storage                                                                     | `data:write`                                                         |
| **Tenant API**       | Create Tenants (platform-level keys only)                                                                   | Platform key                                                         |

**Auth:** Service-level API keys. See: API Key.

**Full specification:** `platform-api.md`.

### API Key

A service-level credential for authenticating Platform API requests. API keys identify a trusted backend or integration, not an individual user. Keys are Tenant-scoped — every key is bound to one Tenant, and every request through that key operates within that Tenant's data with RLS enforced.

**Format:** `esk_live_` (production) or `esk_test_` (staging) prefix + 48 random alphanumeric characters. Only the SHA-256 hash is stored; the full key is shown once at creation.

**Scoping:** Each key holds one or more permission scopes (e.g., `data:read`, `data:write`, `schema:read`, `admin`) that control which API operations it can perform.

**Audit:** Platform API mutations record `actor_type: 'api_key'` and `actor_id: api_keys.id` in the Audit Log. An optional `X-Actor-Label` request header provides human-readable context (e.g., "JobStack: plumber@acme.com") for Audit Log display — not validated by EveryStack.

**Rate limiting:** Redis token bucket per key. Tiers: basic (60/min), standard (120/min), high (600/min), enterprise (2,000/min).

**Management:** Owner or Admin creates keys via Settings → Data & Privacy → API Keys, or via the Platform API itself (requires `admin` scope).

**Platform-level keys:** A separate key type with `esk_platform_` prefix, issued to authorized vertical operators. Can create Tenants (platform-level operation) but cannot access any Tenant's data. Used by B2B vertical provisioning services.

**What an API Key is:** A machine credential for programmatic access to a Tenant's data and configuration.
**What an API Key is NOT:** A user authentication token. API keys authenticate services and integrations. Users authenticate through Clerk. The two systems are independent.

**Full specification:** `platform-api.md` §Authentication.

---

## Definitions — App Designer & Apps (Post-MVP)

### App Designer

A full-screen visual page builder for creating custom applications. Produces spatial layouts using a 12-column grid canvas with drag-and-drop blocks, themes, data binding, and a property panel. The App Designer is its own tool — separate from the workspace experience.

**Access:** From a workspace, via an "Apps" button on a table's toolbar. This shows existing apps connected to that table and offers "+ Create App" which opens the App Designer with the table pre-selected. The App Designer itself lives at its own route (`/app-designer/{appId}`).

**What it produces:** Apps — fully custom, spatial-layout interfaces. These are fundamentally different from Table Views and Record Views, which follow predefined structural patterns.

**Relationship to workspace:** Apps are connected to workspace table(s) and display workspace data. The workspace is where you manage and launch apps. The App Designer is where you build and edit them.

**MVP status:** The App Designer is **post-MVP**. The MVP portal and form features use the Record View layout engine, not the App Designer.

### App

A custom application built in the App Designer. Apps can be internal-facing (team tools) or external-facing (client portals, public forms, websites).

**Post-MVP app types:**
| Type | Audience | Example |
|------|----------|---------|
| Custom Portal | External clients | Multi-page client dashboard with charts, lists, detail views |
| Internal App | Workspace users | POS terminal, dispatch board, warehouse station |
| Website | Public | Marketing site, help center, landing page |
| App Form | Public / gated | Multi-step forms with conditional logic |
| Document | File output | Invoice template, contract, proposal (App Designer canvas → PDF) |

**What an App is:** A custom spatial layout built in the App Designer that displays and interacts with workspace data.
**What an App is NOT:** A Table View or Record View. Those are structural, fast to set up, and follow predefined patterns. Apps are freeform, powerful, and require design effort.

---

## Definitions — Sync & Data

### Sync Engine

The system that connects EveryStack to external platforms (Airtable, SmartSuite, Notion) and keeps data synchronized. Each platform has a dedicated adapter that translates between the platform's native data format and EveryStack's canonical JSONB format.

**Sync direction:**

- **Inbound only:** Pull data from platform. Fields are read-only in EveryStack.
- **Bidirectional:** Pull and push. Edits in EveryStack write back to the source platform.

**Conflict resolution:** Last-write-wins by default.

### Canonical JSONB

The platform-agnostic data format used to store all record data in PostgreSQL. Every record's field values are stored in `records.canonical_data` as a JSONB object. The canonical format is the single source of truth — all features read and write canonical form. Only sync adapters translate to/from platform-native formats.

### Base Connection

A configured connection to an external platform base/workspace. Stores: platform type, API credentials, sync direction, sync schedule, last sync timestamp. One base connection can sync multiple tables.

### Smart Polling

Adaptive polling strategy that adjusts sync frequency based on user activity context. Four tiers: actively viewing a synced table (30s), tab open but table not visible (5min), workspace not accessed (30min), webhook available (event-driven, no polling). All polling uses cursor-based change detection (`modifiedTime > lastSyncTimestamp`). See `sync-engine.md` > Layer 5.

### Converted Table

A synced table that has been migrated to a native EveryStack table via the "Convert to Native Table" flow. Conversion progresses through statuses on `base_connections.sync_status`: `converted` (migration in progress, dual-write to shadow table), `converted_finalized` (migration complete, sync fully stopped). Converted tables are excluded from polling entirely. See `cross-linking.md` > "Convert to Native Table" Migration.

### NotionAdapter

The Notion platform adapter implementing the `PlatformAdapter` interface. Handles OAuth 2.0 authentication, Notion API communication via `NotionApiClient`, and field type transforms for 18 Notion property types. Registered via `registerNotionTransforms()` at startup. See `sync-engine.md`.

### NotionPropertyType

TypeScript union type enumerating all Notion database property types (title, rich_text, number, select, multi_select, date, people, files, checkbox, url, email, phone_number, formula, relation, rollup, created_time, created_by, last_edited_time, last_edited_by, status, unique_id). Used by the Notion adapter's field transform registry. See `packages/shared/sync/adapters/notion/notion-types.ts`.

### TableVisibility

Visibility state of a synced table derived from Socket.io room membership: `active` (user has this table open, 30s polling), `background` (workspace open but table not visible, 5min polling), `inactive` (workspace not accessed, 30min polling). Used by smart polling to determine sync intervals. See `sync-engine.md` > Smart Polling.

### SyncPriority

Priority tiers (P0–P3) for sync job dispatch under rate limit pressure. P0 (critical — outbound sync, webhook-triggered) always dispatches. P1 (active viewing) dispatches if capacity >30%. P2 (background) >50%. P3 (inactive) >70%. Ensures actively viewed tables are prioritized when API rate limits are constrained. See `sync-engine.md` > Priority-Based Scheduling.

### ConnectionHealth

Shape of the `base_connections.health` JSONB column. Tracks: `last_success_at`, `last_error` (structured `SyncError`), `consecutive_failures`, `next_retry_at`, `records_synced`, `records_failed`. Used by the sync dashboard and error recovery flows. Validated via `ConnectionHealthSchema` (Zod). See `sync-engine.md` > Sync Connection Status Model.

### SyncError / SyncErrorCode

Structured error types for sync failures. `SyncErrorCode` enumerates 8 error codes: `auth_expired`, `rate_limited`, `platform_unavailable`, `schema_mismatch`, `permission_denied`, `partial_failure`, `quota_exceeded`, `unknown`. Each `SyncError` includes `code`, `message`, `timestamp`, `retryable`, and `details`. Stored in `ConnectionHealth.last_error`. See `sync-engine.md` > Sync Error Recovery.

### Sync Notifications

Real-time toast notifications for sync events delivered via Socket.io. Covers: sync completion, sync failures, schema changes detected, quota warnings. Rendered by `SyncNotificationToast` component. Events are tenant-scoped via the standard realtime event bus. See `packages/shared/sync/sync-notifications.ts`.

### PlatformBadge

UI component rendering a 14px platform logo (Airtable, Notion, SmartSuite) as an overlay on the table type icon in the sidebar. Absence of badge indicates a native EveryStack table. Independent of tab color — two visual channels, no conflict. See `field-groups.md` > Synced Table Tab Badges.

### SyncStatusIcon

UI component rendering sync health status next to table names in the sidebar. Six states: healthy (bidirectional arrows), syncing now (animated), conflicts pending (amber warning), sync paused, sync error (red), converted (no icon). Click action opens the Sync Dashboard. See `field-groups.md` > Sync Status Indicator.

### Priority Scheduler

BullMQ-based scheduler (`SyncScheduler`) running on a 30-second tick interval. Evaluates all active connections and dispatches sync jobs according to `SyncPriority` tiers and current rate limit capacity. Enforces multi-tenant fairness (no single tenant >20% of platform API capacity, P0 exempt). See `sync-engine.md` > Priority-Based Scheduling.

### Sync Dashboard

Settings page for managing a sync connection (`/[workspaceId]/settings/sync/[baseConnectionId]`). Tabbed interface: Overview (connection health, sync history chart), Tables & Filters (per-table sync config), Conflicts (resolution UI), Failures (error log with retry/dismiss), Schema Changes (detected diffs), History (event timeline). See `sync-engine.md` > Sync Settings Dashboard.

---

## Definitions — Communications

**Record Thread** — See definition under Workspace Level above.

### Chat / DMs (Quick Panel)

Personal messaging — DMs with teammates, group DMs (3–8 people). Accessible via the Chat Quick Panel from any page. Workspace-scoped (you DM a teammate within a workspace context).

**Not to be confused with:** Record Thread (which is about a record, not a person-to-person conversation).

### Notifications

In-app notifications surfaced in the Chat Quick Panel and on the My Office widget. Includes: @mentions, task assignments, automation completions, form submissions, portal activity, approval requests.

---

## Definitions — Permissions

### Roles

Five roles across two levels. Presented as a single flat hierarchy in the UI — users don't need to know about the table split.

**Tenant-level** (`tenant_memberships.role`):

| Role       | Access Level                                                                     |
| ---------- | -------------------------------------------------------------------------------- |
| **Owner**  | Everything. Billing, deletion, tenant settings, role assignment. All workspaces. |
| **Admin**  | Everything except billing/deletion. All workspaces.                              |
| **Member** | Default. Workspace access determined by workspace-level roles below.             |

**Workspace-level** (`workspace_memberships.role` — for Members only):

| Role            | Access Level                                                    |
| --------------- | --------------------------------------------------------------- |
| **Manager**     | Manages tables, views, portals, automations. Sees raw data.     |
| **Team Member** | Day-to-day data work through Table Views. No structural access. |
| **Viewer**      | Read-only access through Table Views. No edits.                 |

**Key principle:** Table Views are the access boundary for Team Members and Viewers. They see only the views they've been given access to, with only the fields that have been made visible to their role. Owners and Admins bypass Table View scoping entirely.

### Field Permissions

Every field resolves to one of three states per user: **read-write**, **read-only**, or **hidden**. Manager+ controls field visibility per role per Table View. Individual overrides can further restrict or restore access for specific users.

---

## Definitions — Infrastructure

### Tenant (Technical)

The top-level organizational entity — the company/account. The billing boundary, identity boundary, and RLS isolation unit. All data queries include `tenant_id` for isolation. Multi-tenancy is enforced at every layer. One tenant contains many workspaces.

**Identity model (CP-002):** A user holds a persistent platform identity (`users` table) and can hold roles across one or more tenants. The correct model is:

```
User → persistent platform identity
  → holds roles across one or more Tenants (via tenant_memberships or tenant_relationships)
  → accesses Workspaces based on those roles
```

**Personal Tenant:** Every user receives a personal tenant on first login, auto-provisioned. Stored in `users.personal_tenant_id`. Rules: it is a normal tenant the user owns — no special type flag. Hidden in tenant switcher until it contains at least one workspace. Identity-bound — cannot be transferred. Workspaces inside a personal tenant can be transferred to another tenant.

**Agency Tenant / Client Tenant (CP-002):** A formal tenant-to-tenant relationship via `tenant_relationships` table. An agency tenant holds authorised access to one or more client tenants. Agency members access client tenants without being added to the client's `tenant_memberships`. See `permissions.md` § Agency Access Model.

**`effective_memberships` view (CP-002):** A database view that unions direct `tenant_memberships` and agency-delegated access from `tenant_relationships`. All auth middleware queries this view, never the underlying tables directly.

**Cross-tenant linking — permanently forbidden:** Cross-workspace record linking is only permitted between workspaces sharing the same `tenant_id`. Forbidden between different tenants (even with agency relationship), between shared and personal workspaces, and between personal workspaces of different users. Enforced at database, API, and UI layers.

**Corrected hierarchy:**

```
Tenant (organization — billing, identity, RLS boundary)
├── Board: "Client Work" (optional grouping — MVP scope)
│   ├── Workspace: "Acme Corp Project"
│   └── Workspace: "Beta Inc Retainer"
├── Board: "Back Office"
│   ├── Workspace: "Finance"
│   └── Workspace: "HR & Operations"
├── Workspace: "Sandbox" (ungrouped — no board)
├── My Office (personal hub — aggregates across all workspaces)
└── Cross-Links (TENANT-SCOPED — any table ↔ any table across all workspaces)
```

### Board

An optional organizational grouping of workspaces within a tenant. Boards serve as a permission convenience — adding a user to a board bulk-grants workspace access. Boards appear as collapsible container tiles in the Workspaces widget on My Office and in the expanded sidebar's workspace tree. Ungrouped workspaces appear in an "Ungrouped" section. A workspace belongs to at most one board.

### Workspace (Technical)

Corresponds to the `workspaces` table in the database. A workspace is a container for tables, views, portals, forms, automations, and documents. It sits below the tenant level. `tenant_id` on database tables indicates the organization (tenant) scope, not the workspace.

### Section

A universal UI primitive for organizing any long list. A section is a named, collapsible group header that items can be dragged into. Sections apply to: sidebar table lists, view switchers, automations lists, cross-links lists, document/template lists, and any future list surface. Two tiers: personal sections (any user, visible only to creator) and manager-created sections (Manager+, visible to all workspace members). Sections are presentational only — they do not affect permissions or data access. Items can be ungrouped. See `tables-and-views.md` > Sections — Universal List Organizer.

### Command Bar

A keyboard-triggered (⌘K / Ctrl+K) universal search and command interface. Supports: record search, table navigation, slash commands, and (MVP) natural language AI search.

### Tech Stack

| Layer                    | Technology                                         | Purpose                                                                       |
| ------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Monorepo**             | Turborepo + pnpm                                   | Build orchestration, workspace management                                     |
| **Frontend**             | Next.js (App Router)                               | Web application framework                                                     |
| **UI Components**        | shadcn/ui + Tailwind CSS                           | Component library + utility-first styling                                     |
| **Fonts**                | DM Sans, JetBrains Mono                            | UI/headings, code/technical                                                   |
| **State**                | Zustand (client), TanStack Query (server)          | Client state, server cache/sync                                               |
| **Rich Text**            | TipTap                                             | Record Thread messages, document templates, notes                             |
| **Grid Virtualization**  | TanStack Virtual                                   | Large table rendering performance                                             |
| **Validation**           | Zod                                                | Runtime schema validation (API, forms, AI output)                             |
| **Backend**              | Next.js Route Handlers + Server Actions            | API routes and mutations within the Next.js App Router                        |
| **ORM**                  | Drizzle ORM                                        | Type-safe PostgreSQL queries                                                  |
| **Database**             | PostgreSQL (JSONB)                                 | Primary data store, canonical format                                          |
| **Cache / Pub-Sub**      | Redis                                              | Caching, real-time pub/sub, field locks, sessions                             |
| **Job Queue**            | BullMQ                                             | Background jobs (sync, automations, notifications)                            |
| **Real-Time**            | Socket.io                                          | WebSocket connections for live updates                                        |
| **Auth**                 | Clerk                                              | Authentication, user management, SSO                                          |
| **Email**                | Resend                                             | Transactional email delivery                                                  |
| **PDF Generation**       | Gotenberg                                          | HTML → PDF via headless Chromium                                              |
| **Spam Protection**      | Cloudflare Turnstile                               | Form and portal spam prevention                                               |
| **File Storage**         | Cloudflare R2 (S3-compatible; MinIO for local dev) | File uploads, generated documents. Presigned URLs for direct upload/download. |
| **File Processing**      | sharp (images), ClamAV (virus scan)                | Image optimization, security scanning                                         |
| **AI Provider**          | Anthropic (Claude)                                 | All AI features via AIService abstraction                                     |
| **Testing**              | Vitest (unit), Playwright (E2E)                    | Test framework                                                                |
| **Analytics (post-MVP)** | DuckDB                                             | Analytical queries, cross-base analysis                                       |

---

## Definitions — Process & Workflow

These terms describe the agent build lifecycle — how work is decomposed, planned, and tracked. They are not platform features or user-facing concepts. They govern how agents interact with each other and with documentation.

### Build Unit

The smallest piece of work that can be built, reviewed, and verified independently within a sub-phase. Each unit carries an interface contract (what it produces and consumes), a context manifest (what docs and files the Build Agent needs), and acceptance criteria. Units are defined in subdivision docs and tracked in TASK-STATUS.md.

**Appears in:** `SUBDIVISION-STRATEGY.md`, `CLAUDE.md` § Build Lifecycle, `TASK-STATUS.md`, `planner/SKILL.md`

### Subdivision Doc

A decomposition plan that breaks a sub-phase into build units with explicit seams and contracts. Sits between the sub-phase scope and the playbook in the document hierarchy: Phase Division → Sub-phase → Subdivision Doc → Playbook → Build Prompts. Produced by the Planner Agent at Gate 1. Stored in `docs/subdivisions/`.

**What it is NOT:** A playbook (no prompts), a spec (no feature definitions), or a task list (no status tracking).

**Appears in:** `SUBDIVISION-STRATEGY.md`, `CLAUDE.md` § Build Lifecycle, `planner/SKILL.md`

### Interface Contract

The definition of what a build unit produces that downstream units consume. Contains: exported names and file paths, function/type signatures (enough for downstream units to write imports against), and side effects (migrations, routes, queues). The single most important element of a subdivision doc — it converts review from "does the diff look right?" to "does the diff fulfill the contract?"

**Appears in:** `SUBDIVISION-STRATEGY.md` § Writing Interface Contracts, `planner/SKILL.md`

### Context Manifest

The exact doc sections (by line range) and source files that a Build Agent needs for a specific unit or prompt. The mechanism that enforces context discipline — the Build Agent loads only what the manifest specifies, no speculative "might be relevant" docs. Each unit in a subdivision doc carries one. Validated against the context budget test.

**Appears in:** `SUBDIVISION-STRATEGY.md` § Curating Context Manifests, `CLAUDE.md` § Gate 1 / Gate 2, `planner/SKILL.md`

### Context Budget Test

A unit passes the context budget test if its full context load (doc sections + source files + prior unit outputs + CLAUDE.md + GLOSSARY.md) fits within ~40% of a Claude Code context window. The remaining ~60% is reserved for the code being written and iteration headroom. If a unit fails, it must be subdivided further — never solved by trimming context.

**Appears in:** `SUBDIVISION-STRATEGY.md` § The Context Budget Test, `CLAUDE.md` § Gate 1

### Planning Gate

A checkpoint in the build lifecycle where the Planner Agent intervenes. Four gates exist: **Gate 1** (pre-subdivision, between Step 0 and Step 1), **Gate 2** (pre-build context curation, between Step 2 and Step 3), **Gate 3** (post-failure replanning, within the Step 3/4 loop), **Gate 4** (phase boundary summary, after Step 5). Gates ensure decomposition quality before build and assess failure impact after review.

**Appears in:** `CLAUDE.md` § Build Lifecycle — Steps & Planning Gates, `playbook-generation-strategy.md`, `planner/SKILL.md`

### Seam

A boundary where one build unit ends and another begins. Good seams produce units that are internally cohesive and externally decoupled. Four seam heuristics in priority order: (1) Data → Service → UI layers, (2) CRUD boundaries, (3) Tenant isolation boundaries, (4) Cross-cutting concern boundaries. Anti-patterns: splitting by file count, estimated effort, or separating tests from implementation.

**Appears in:** `SUBDIVISION-STRATEGY.md` § Finding Natural Seams, `planner/SKILL.md`

---

## Plan Tiers (Canonical Reference)

> **⚠️ PROVISIONAL.** Plan names are canonical; all quota numbers are provisional and will evolve. When they do, update this table first — domain docs reference it.

Five plan tiers, stored as `tenants.plan`:

| Plan             | Target                                      |
| ---------------- | ------------------------------------------- |
| **Freelancer**   | Solo operators, small client rosters        |
| **Starter**      | Small teams getting started                 |
| **Professional** | Growing businesses with cross-platform data |
| **Business**     | Larger teams with high-volume needs         |
| **Enterprise**   | Custom contracts, dedicated support         |

**Quota dimensions** (numbers defined in domain docs, cross-referenced here). When plan pricing is finalized, consolidate all numeric quotas into the Plan Tiers table above and have domain docs reference it — single source of truth for numbers:

| Dimension                                     | Defined in                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| Record quota (cached records)                 | `sync-engine.md` §Record Quota Enforcement                                   |
| Base connections & tables per base            | `sync-engine.md` §Record Quota Enforcement                                   |
| AI credits (monthly included)                 | `ai-metering.md` §Monthly Credit Budgets by Tier                             |
| AI concurrent requests & batch limits         | `ai-metering.md` §AIService Wrapper Implementation + §Plan Limits for Agents |
| Portal count                                  | `portals.md` §Portal Client Limits — MVP                                     |
| Portal access rows & record quota             | `portals.md` §Portal Client Limits — MVP                                     |
| Automation count, executions/month, max steps | `automations.md` §Plan Limits                                                |
| Webhook delivery rate limits                  | `automations.md` §Rate Limiting                                              |
| API rate limit tiers                          | `platform-api.md` §Rate Limiting                                             |

When pricing is finalized, consolidate all quota numbers into this table and have domain docs reference it rather than maintaining independent copies. **For build purposes:** Use the placeholder numbers in each domain doc (e.g., `sync-engine.md` record quotas, `ai-metering.md` credit budgets). These are reasonable defaults that can be tuned via environment config without code changes. Every quota is stored as a plan-level config value, not hardcoded.

---

## MVP Scope Summary

### MVP Includes

| Area              | What Ships                                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Foundation**    | Monorepo, auth (Clerk), PostgreSQL, Redis, design system (shadcn/ui), AIService + SDS + credit system                                                                                                                         |
| **Organization**  | Boards (optional workspace grouping), workspace/table CRUD, sidebar navigation                                                                                                                                                |
| **Sync Engine**   | Airtable, SmartSuite, Notion adapters. Bidirectional sync. Canonical JSONB.                                                                                                                                                   |
| **Core UX**       | Table Views (Grid + Card), Record View (configurable field canvas), My Views / Shared Views, Command Bar                                                                                                                      |
| **Cross-Linking** | Create links across any tables/platforms. Display linked data. Single-hop lookups.                                                                                                                                            |
| **Quick Portals** | Externally-shared Record View. Single record. Magic link / password auth. Read-only default, selectively editable.                                                                                                            |
| **Quick Forms**   | Record View layout for creating new records. Public or link-gated. Turnstile spam protection.                                                                                                                                 |
| **Document Gen**  | Merge-tag templates. Rich text editor. PDF output. AI draft option.                                                                                                                                                           |
| **Automations**   | Linear trigger → action flows. 6 triggers, 7 actions. Step-by-step list builder.                                                                                                                                              |
| **AI**            | Natural language search, Smart Fill, record summarization, document AI draft, field/link suggestions.                                                                                                                         |
| **Platform API**  | API key auth, Data API (Record CRUD, queries), Schema API, Provisioning API, Automation triggers, webhook management. Phased: foundation in MVP — Foundation, Data API MVP — Core UX, full surface by Post-MVP — Automations. |
| **Mobile**        | Workspace tiles home. Grid + Card views. Single-column Record View. Bottom tab Quick Panels with contextual Record Thread tabs.                                                                                               |

### MVP Explicitly Excludes

| Area                                                            | Deferred To                                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| App Designer (visual page builder)                              | Post-MVP                                                                                                                      |
| Custom Apps (POS, websites, internal apps)                      | Post-MVP                                                                                                                      |
| Full-featured Portals (multi-page, multi-record, custom layout) | Post-MVP                                                                                                                      |
| Visual automation canvas (branching, conditions, loops)         | Post-MVP                                                                                                                      |
| Formula engine                                                  | Post-MVP                                                                                                                      |
| Rollups and aggregations                                        | Post-MVP                                                                                                                      |
| Kanban, Gantt, Calendar, List, Gallery views                    | Post-MVP (Kanban soon after MVP)                                                                                              |
| Wiki / Knowledge Base                                           | Post-MVP                                                                                                                      |
| Full communications hub (base/table threads, omnichannel)       | Post-MVP                                                                                                                      |
| Booking / Scheduling                                            | Post-MVP                                                                                                                      |
| Approval workflows                                              | Post-MVP                                                                                                                      |
| AI Agents (autonomous multi-step)                               | Post-MVP                                                                                                                      |
| DuckDB analytical layer                                         | Post-MVP                                                                                                                      |
| Vector embeddings / semantic search                             | Post-MVP (file content embedding generation ships MVP — Core UX via `file.embed_content` job; semantic search UX is post-MVP) |
| Personal Notes / Evernote competitor                            | Post-MVP                                                                                                                      |
| Workspace Map                                                   | Post-MVP                                                                                                                      |
| Time tracking, asset library, ad platforms                      | Post-MVP                                                                                                                      |
| Commerce embeds, live chat widget                               | Post-MVP                                                                                                                      |
| Document App type (App Designer canvas → PDF)                   | Post-MVP                                                                                                                      |
| Self-hosted AI, data residency                                  | Post-MVP                                                                                                                      |
| Runtime AI Skills (Tier 2/3), Skill Maintenance Agent           | Post-MVP (Tier 1 skills + Context Builder integration are MVP — AI)                                                           |
| Platform Maintenance Agents (7 platform-level autonomous agents)| Post-MVP (depends on agent runtime from `agent-architecture.md`)                                                              |

---

## Naming Discipline — Terms That Were Confused

| ❌ Do NOT Use                             | ✅ Use Instead                                          | Why                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| "Interface" (as a Table View)             | **Table View**                                          | "Interface" is overloaded. Table Views are views.                                                                            |
| "Interface" (as an App Designer output)   | **App**                                                 | Apps are custom things built in the App Designer.                                                                            |
| "Interface Designer"                      | **App Designer**                                        | It designs Apps, not "interfaces."                                                                                           |
| "Portal Designer"                         | **App Designer**                                        | One tool, one name.                                                                                                          |
| "Interface types"                         | **App types**                                           | Portal, Internal App, Website, Form, Document, etc.                                                                          |
| "Portals table" (for non-portal entities) | Rename post-MVP                                         | DB table is still `portals` for now, but we never call non-portal things "portals" in user-facing language or documentation. |
| "Communications Hub"                      | **Record Thread** (record-level) or **Chat** (personal) | Distinguish the two surfaces clearly.                                                                                        |
| "My Office panels"                        | **Quick Panels**                                        | Consistent name everywhere.                                                                                                  |
| "base" (as synonym for workspace)         | **Workspace**                                           | "Base" refers to an external platform container (e.g., Airtable base). EveryStack's container is a Workspace.                |

---

## Database Entity Quick Reference

This maps user-facing concepts to their database tables. Full schema in `data-model.md`.

| Concept                    | Primary DB Table(s)                           | Key Columns                                                                                                                                                                      |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant (Organization)      | `tenants`                                     | id, name, slug, plan                                                                                                                                                             |
| Board                      | `boards`                                      | id, tenant_id, name, sort_order                                                                                                                                                  |
| Board Membership           | `board_memberships`                           | id, board_id, user_id, default_workspace_role                                                                                                                                    |
| Workspace                  | `workspaces`                                  | id, tenant_id, board_id (nullable), name, slug                                                                                                                                   |
| User                       | `users`                                       | id, clerk_id, email, name                                                                                                                                                        |
| Tenant Membership          | `tenant_memberships`                          | id, tenant_id, user_id, role (owner\|admin\|member), status (active\|invited\|suspended)                                                                                         |
| Workspace Membership       | `workspace_memberships`                       | user_id, tenant_id, workspace_id, role (manager\|team_member\|viewer)                                                                                                            |
| Table                      | `tables`                                      | id, tenant_id, workspace_id, name, table_type, tab_color, environment (synced\|native), created_by, created_at, updated_at                                                       |
| Field                      | `fields`                                      | id, tenant_id, table_id, name, field_type, config (JSONB)                                                                                                                        |
| Record                     | `records`                                     | id, tenant_id, table_id, canonical_data (JSONB)                                                                                                                                  |
| Table View                 | `views`                                       | id, tenant_id, table_id, view_type, config (JSONB), permissions (JSONB)                                                                                                          |
| Record View Config         | `record_view_configs`                         | id, tenant_id, table_id, name, layout (JSONB)                                                                                                                                    |
| Cross-Link                 | `cross_links` + `fields` (type=linked_record) | source/target table, link config, card_fields (JSONB)                                                                                                                            |
| Portal                     | `portals`                                     | id, tenant_id, table_id, record_view_config_id, name, slug, auth_type, status                                                                                                    |
| Portal Access              | `portal_access`                               | id, tenant_id, portal_id, record_id, email, auth_hash, token, token_expires_at, last_accessed_at                                                                                 |
| Portal Session             | `portal_sessions`                             | id, auth_type ('quick'\|'app'), auth_id, portal_id, expires_at                                                                                                                   |
| Form                       | `forms`                                       | id, tenant_id, table_id, record_view_config_id, name, slug, status                                                                                                               |
| Document Template          | `document_templates`                          | id, tenant_id, table_id, name, content (JSONB — TipTap JSON with merge tags), settings (JSONB), version, created_by, created_at, updated_at                                      |
| Automation                 | `automations`                                 | id, tenant_id, workspace_id, name, trigger (JSONB), steps (JSONB[]), status                                                                                                      |
| Automation Run             | `automation_runs`                             | id, automation_id, status, started_at, step_log                                                                                                                                  |
| Webhook Endpoint           | `webhook_endpoints`                           | id, tenant_id, workspace_id, url, signing_secret, subscribed_events (TEXT[]), status (active\|disabled), consecutive_failures, created_by                                        |
| Webhook Delivery Log       | `webhook_delivery_log`                        | id, tenant_id, webhook_endpoint_id, event, delivery_id, payload (JSONB), status_code, status (pending\|success\|failed), retry_count, created_at                                 |
| Base Connection            | `base_connections`                            | id, tenant_id, platform, external_base_id, external_base_name, oauth_tokens, sync_config (JSONB), sync_direction, conflict_resolution, sync_status, last_sync_at, health (JSONB) |
| Sync Failure               | `sync_failures`                               | id, tenant_id, base_connection_id, error_code, status                                                                                                                            |
| Sync Schema Change         | `sync_schema_changes`                         | id, tenant_id, base_connection_id, change_type, status                                                                                                                           |
| Record Template            | `record_templates`                            | id, tenant_id, table_id, name, canonical_data (JSONB), publish_state                                                                                                             |
| Record Thread              | `threads` + `thread_messages`                 | scope_type=record, scope_id=record_id                                                                                                                                            |
| DM / Chat                  | `threads` + `thread_messages`                 | scope_type=dm or group_dm                                                                                                                                                        |
| Saved Message              | `user_saved_messages`                         | id, user_id, message_id, tenant_id, note (nullable), saved_at                                                                                                                    |
| Personal Task              | `user_tasks`                                  | id, user_id, title, completed, due_date                                                                                                                                          |
| Personal Event             | `user_events`                                 | id, user_id, title, start_time, end_time                                                                                                                                         |
| AI Usage                   | `ai_usage_log`                                | tenant_id, feature, credits_charged                                                                                                                                              |
| AI Credit Budget           | `ai_credit_ledger`                            | tenant_id, credits_total, credits_used                                                                                                                                           |
| API Key                    | `api_keys`                                    | id, tenant_id, name, key_hash, key_prefix, scopes (TEXT[]), rate_limit_tier, status (active\|revoked)                                                                            |
| API Request Log            | `api_request_log`                             | id, tenant_id, api_key_id, method, path, status_code, duration_ms. Monthly partitioned, 30-day retention                                                                         |
| App (post-MVP)             | `apps`                                        | id, tenant_id, type, name, theme, status                                                                                                                                         |
| App Page (post-MVP)        | `app_pages`                                   | id, app_id, slug, layout (JSONB)                                                                                                                                                 |
| App Block (post-MVP)       | `app_blocks`                                  | id, page_id, block_type, config (JSONB)                                                                                                                                          |
| Audit Log                  | `audit_log`                                   | id, tenant_id, actor_type, actor_id, actor_label, action, entity_type, entity_id, details (JSONB)                                                                                |
| Form Submission            | `form_submissions`                            | id, form_id, tenant_id, record_id, submitted_at, ip_address, user_agent                                                                                                          |
| Generated Document         | `generated_documents`                         | id, tenant_id, template_id, source_record_id, file_url (S3/R2), file_type (pdf), generated_by, generated_at, automation_run_id (nullable), ai_drafted (boolean)                  |
| Sync Conflict              | `sync_conflicts`                              | id, tenant_id, base_connection_id, record_id, field_id, local_value, remote_value, resolution                                                                                    |
| Synced Field Mapping       | `synced_field_mappings`                       | id, tenant_id, base_connection_id, table_id, field_id, external_field_id, status                                                                                                 |
| Notification               | `notifications`                               | id, user_id, tenant_id, type, source_thread_id, source_message_id, read, created_at                                                                                              |
| Section (sidebar grouping) | `sections`                                    | id, tenant_id, workspace_id, name, sort_order                                                                                                                                    |
| Command Bar Session        | `command_bar_sessions`                        | id, tenant_id, user_id, query, selected_action, context                                                                                                                          |
| Cross-Link Index           | `cross_link_index`                            | source_record_id, target_record_id, cross_link_id (denormalized lookup)                                                                                                          |
| Platform Key (post-MVP)    | `platform_keys`                               | id, name, key_hash, prefix, permissions (JSONB), issued_to                                                                                                                       |

**Note:** The old docs used the `portals` table to store all App Designer outputs (portals, apps, forms, websites, widgets, documents) via a `type` column. For MVP, Portals and Forms are **not** App Designer outputs — they're Record View configurations with auth wrappers. The `portals` DB table from old docs should be split: `portals` for simple record-sharing, `forms` for record-creation forms, and (post-MVP) `apps` for App Designer outputs.

**Note:** `workspace_memberships` uses a composite primary key (`user_id` + `workspace_id`) — one role per user per workspace. No surrogate `id` column. All other tables use a surrogate `id`.

---

## Layout & Dimension Reference

### Workspace Layout

```
Sidebar collapsed (default):
┌──────┬────────────────────────────────────┐
│ Icon │  Main Panel                   100% │
│ Rail │                                    │
│ 48px │  (Table View, Record View, etc.)   │
└──────┴────────────────────────────────────┘

Sidebar expanded (~280px):
┌──────┬──────────────┬─────────────────────┐
│ Icon │  Workspace   │  Main Panel         │
│ Rail │  Tree +      │                     │
│ 48px │  Labels      │                     │
└──────┴──────────────┴─────────────────────┘

With Quick Panel open (workspace context):
┌──────┬─────────┬──────────────────────────┐
│ Icon │ Quick   │  Main Panel          75% │
│ Rail │ Panel   │                          │
│ 48px │ 25%     │                          │
└──────┴─────────┴──────────────────────────┘

Record View overlay:
┌──────┬────────────┬───────────────────────┐
│ Icon │  Main      │  Record View     60%  │
│ Rail │  (dimmed)  │  (overlay)            │
│ 48px │  40%       │                       │
└──────┴────────────┴───────────────────────┘

Record View + Record Thread:
┌──────┬──────┬─────────────────┬───────────┐
│ Icon │ Main │ Record View 55% │ Record    │
│ Rail │(dim) │                 │ Thread    │
│ 48px │ 20%  │                 │ 25%       │
└──────┴──────┴─────────────────┴───────────┘
```

### My Office Layout

```
Default (3-column widget grid, sidebar collapsed):
┌──────┬──────────────┬──────────────┬──────────────┐
│ Icon │  Widget 1    │  Widget 2    │  Widget 3    │
│ Rail │  (1/3)       │  (1/3)       │  (1/3)       │
│ 48px │              │              │              │
└──────┴──────────────┴──────────────┴──────────────┘

Sidebar expanded (~280px):
┌──────┬──────────────┬─────────┬─────────┬─────────┐
│ Icon │  Workspace   │ Widget  │ Widget  │ Widget  │
│ Rail │  Tree +      │  1      │  2      │  3      │
│ 48px │  Labels      │         │         │         │
└──────┴──────────────┴─────────┴─────────┴─────────┘

Quick Panel expanded (via icon click on My Office):
┌──────┬─────────────────────────────┬──────────────┐
│ Icon │  Expanded Panel        2/3  │  Remaining   │
│ Rail │                             │  widgets     │
│ 48px │                             │  stacked 1/3 │
└──────┴─────────────────────────────┴──────────────┘
```

### Mobile Layout

```
Workspace (Table View):
┌─────────────────────────┐
│  Header (workspace name)│
├─────────────────────────┤
│                         │
│  Grid or Card View      │
│  (mobile optimized)     │
│                         │
├─────────────────────────┤
│ 💬  ✅  📅  ＋     │  ← Quick Panel bottom tabs
└─────────────────────────┘

Record View (expanded):
┌─────────────────────────┐
│  ← Back    Record Name  │
├─────────────────────────┤
│                         │
│  Single-column fields   │
│  (possibly double)      │
│                         │
├─────────────────────────┤
│ 💬  📋  📎  🕐        │  ← Record Thread tabs
└─────────────────────────┘     (contextually swapped)
```

---

## How to Use This Document

1. **When writing a reference doc or phase playbook**, check this glossary for the correct name of every concept. If you're tempted to invent a new name for something, it probably already has one here.

2. **When Claude Code encounters an ambiguous term** in an older doc, this glossary resolves it. The naming discipline table above maps old terms to correct terms.

3. **When scoping work**, check the MVP Scope Summary. If something is listed under "MVP Explicitly Excludes," do not build it or design for it unless explicitly told otherwise. Build clean extension points, but don't build the extensions.

4. **When a reference doc contradicts this glossary**, the glossary wins. Flag the contradiction for resolution.
