# Phase 3 (First Half): MVP — Core UX — Sub-Phase Division (3A–3D)

## Section Index

| Section | Lines | Summary |
|---------|-------|---------|
| Summary | 13–33 | Sub-phase count (7), prompt total (82), Phase 1/2 dependencies |
| Key Subdivision Decisions | 19–33 | Workspace Map exclusion, SDS+Command Bar bundling, doc-intelligence deferral, email.md consolidation |
| Sub-Phases (3A-i -- 3D) | 35–258 | Seven sub-phase definitions: grid core, view features, field permissions, cross-linking, SDS+Command Bar, communications, documents |
| Dependency Graph | 260–296 | ASCII DAG of 3A-i through 3D with parallel execution potential |
| Validation Checklist | 298–317 | 14-item verification of scope, exclusions, and reference doc section splits |

## Summary
- Sub-phases: 7 (including second-level splits for 3A and 3B)
- Estimated total prompts: 82
- Phase 1 dependencies: 1A (monorepo/CI), 1B (database schema), 1C (auth/roles), 1D (observability), 1E (testing), 1F (design system), 1G (real-time/worker/files), 1H (AI service), 1I (audit/API auth)
- Phase 2 dependencies: 2A (FieldTypeRegistry + Airtable adapter), 2B (JSONB indexes + outbound sync + conflict resolution)

### Key Subdivision Decisions

**Workspace Map excluded:** `workspace-map.md` Phase Integration section (line 1224) explicitly states: "Post-MVP — Verticals & Advanced: Full Workspace Map implementation." The entire doc is post-MVP. Excluded from all sub-phases.

**Schema Descriptor Service bundled with Command Bar:** SDS (`schema-descriptor-service.md`) is the primary data source for Command Bar's AI natural language search channel. The dependency map's Core UX ordering places SDS at #6 and Command Bar at #7, with Command Bar requiring SDS. Bundling them in 3B-ii keeps the dependency chain clean and avoids an orphan sub-phase for a single infrastructure service.

**gaps/tables-views-boundaries.md as reference context only:** The doc is marked "SUPERSEDED" (line 14): "Do not use this doc's schemas for new work. Consult GLOSSARY.md and tables-and-views.md for the current architecture." It provides useful architectural context for the Table View / My View boundary but generates no code.

**document-intelligence.md excluded:** Per the Phase Boundary Analysis in `dependency-map.md` (line 614): "Tension. Doc's own phase notes include MVP — Core UX activation of metadata extraction. MANIFEST says post-MVP. Resolution: Schema stubs (empty tables, job definitions as no-ops) go in MVP — Foundation. Activation of extraction deferred to post-MVP."

**document-designer.md excluded:** Ships in "Post-MVP — Documents" (dependency-map.md line 426). Not Phase 3 Core UX.

**email.md MVP scope is tiny:** Only system emails (invitations, system alerts) ship in MVP — ~50 lines of actionable content. Combined with 3C rather than given a separate sub-phase.

---

## Sub-Phases

Covers 3A-i — Grid View Core: Layout, Cell Renderers & Inline Editing, 3A-ii — View Features, Record View, Card View & Data Import, 3A-iii — Field-Level Permissions: Model, Resolution & Config UI, 3B-i — Cross-Linking Engine, 3B-ii — Schema Descriptor Service & Command Bar, 3C — Record Thread, DMs, Notifications & System Email.
Touches `cross_links`, `cross_link_index`, `card_fields`, `link_scope_filter`, `target_table_id` tables.

### 3A-i — Grid View Core: Layout, Cell Renderers & Inline Editing

**One-sentence scope:** Builds the TanStack Table + TanStack Virtual grid shell with all ~16 MVP field type cell renderers, column configuration, inline cell editing, keyboard navigation, and windowed virtualization.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| tables-and-views.md | Table Type System, Grid Anatomy, Permission Gating on Structural UI, Row Behavior, Column Behavior, Column Header Right-Click Menu, Row Right-Click Menu, Scrolling & Performance, Cell Behavior, Cell Error States, Cell Type Rendering, Keyboard Shortcuts | 27–365 | ~339 |

**Total reference lines:** ~339

**Scope Boundaries:**
- **Includes:** Table type system (5 types, tab colors, view type enum with MVP = grid + card), TanStack Table core setup with TanStack Virtual windowed virtualization (row overscan 10, column overscan 3), grid anatomy (drag handle, checkbox column, row numbers, primary field frozen, "+" column for Manager+), row behavior (3 density modes: 32/44/64px, zebra striping, persistent empty "add row" pinned at bottom, manual reordering via drag handle, row hover highlight), column behavior (resize 60–800px, reorder via drag-drop, freeze up to 40% viewport, column header sort/filter indicators, column coloring from 8–10 pastel palette), column header right-click menu (14 items), row right-click menu (9 items), all ~16 MVP field type cell renderers (Single Select, Multi-Select, Linked Record, Attachment, People, Percent/Progress, Checklist, Date, Checkbox, URL, Email, Phone, Rating, Currency, Smart Doc badge, Barcode), cell behavior (single-click replace mode, double-click edit mode, auto-save on blur, optimistic updates with rollback, undo/redo, multi-cell copy/paste with type coercion, drag-to-fill, read-only cells with lock icon, validation error border), 5 cell error state overlays (broken reference, sync conflict, processing, succeeded, type coercion), keyboard shortcuts (navigation: arrow/tab/enter/escape/home/end/page, selection: shift+arrow/shift+click/cmd+click/cmd+A, editing: cmd+Z/C/V/D/delete/space/F2, grid actions: cmd+shift+F/S/E/N, cmd+K, cmd+F), performance thresholds (10K info banner, 50K auto-pagination, 30+ columns suggestion)
- **Excludes:** Filtering/sorting/grouping UI (3A-ii), summary footer (3A-ii), grid toolbar layout (3A-ii), My Views / Shared Views (3A-ii), multi-user collaboration (3A-ii), Record View overlay (3A-ii), Card View (3A-ii), Sections (3A-ii), Inline Sub-Table (3A-ii), CSV import (3A-ii), Kanban view (post-MVP), Quick Entry (post-MVP), field-level permission enforcement (3A-iii — grid renders all fields for Manager+ initially), formula engine (post-MVP)
- **Creates schema for:** None (tables, fields, views, records defined in 1B)

**Dependencies:**
- **Depends on:** 1A (monorepo), 1B (tables, fields, records, views schema), 1C (Clerk auth + tenant context for grid data loading), 1F (shadcn/ui primitives, Tailwind tokens, DM Sans font), 2A (FieldTypeRegistry with canonical JSONB shapes — cell renderers consume registry), 2B (JSONB expression indexes for grid query performance)
- **Unlocks:** 3A-ii (view features built on top of grid shell), 3A-iii (permissions applied to rendered grid), 3B-i (cross-linking UI embeds in grid cells as Linked Record renderer)
- **Cross-phase deps:** 1A, 1B, 1C, 1F, 2A, 2B

**Sizing:**
- **Estimated prompts:** 12
- **Complexity:** High
- **Key risk:** Cell renderer coverage — ~16 field types each need a render mode and an edit mode, plus error state overlays. Missing or inconsistent renderers block downstream features.

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3A-ii — View Features, Record View, Card View & Data Import

**One-sentence scope:** Adds grid feature layers (selection, grouping, sorting, filtering, summary footer, toolbar, My Views / Shared Views, multi-user collaboration) plus Record View overlay, Card View, Sections, Inline Sub-Table, and CSV import.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| tables-and-views.md | Selection & Bulk Actions, Grouping, Sorting, Color Coding, Filtering, Summary Footer Row, Grid Toolbar, Record Count, Grid + Record View Layout, Permissions in Grid, Import / Export, My Views & Shared Views, Multi-User Collaboration, Record Deletion, Responsive Grid, Loading & Empty States, Record View, Card View, Sections, Inline Sub-Table Display, CSV/Data Import | 366–842 (excluding 824–842 post-MVP Kanban/Quick Entry) | ~457 |

**Total reference lines:** ~457

**Scope Boundaries:**
- **Includes:** Row selection (always-visible checkbox column, range selection, header checkbox selects all filtered), bulk actions toolbar (delete, edit value, duplicate, copy — visible when 2+ selected), multi-level grouping up to 3 levels (collapsible headers, record count, per-group aggregation row, drag between groups), multi-level sort with drag-to-reorder priority, conditional color coding (row-level tint + cell-level coloring), filtering (quick filters via column header + full filter builder with AND/OR logic and nested groups), summary footer row (per-column configurable aggregations by field type: sum/avg/min/max/count for numbers, earliest/latest for dates, checked/unchecked for checkboxes, etc.), grid toolbar (view switcher, hide fields, filter, sort, group, color, density, share/export, overflow menu), record count display ("32 of 247 records"), Grid + Record View combined layout (60%/40% split, 55%/25%/20% with Record Thread), My Views / Shared Views (personal vs shared, locked views, promotion flow, default view fallback chain), multi-user collaboration (field-level presence locks via Redis + WebSocket, 60s timeout, row-level presence border, real-time event coalescing with 100ms/500ms buffer), record deletion (soft delete with 10s undo toast, bulk delete with confirmation dialog), responsive grid (tablet horizontal scroll, mobile horizontal scroll), loading (skeleton shimmer) and empty states, Record View overlay (configurable field canvas, 4-column desktop / 2-column mobile, drag-and-drop rearrangeable, inline editable, multi-tab, multiple saved configs per table, 60% overlay width), Card View (3 layouts: single column / grid 2–3 cols / compact list, inline editable fields, RecordCard unified component with swipe actions on mobile), Sections universal list organizer (personal + Manager-created, collapsible, drag-and-drop, scoped to surface via `context` column), Inline Sub-Table display for Linked Record fields (embedded mini-grid for parent-child patterns, spreadsheet-like inline editing, configurable columns, permissions-aware), CSV import (5-step flow: upload → preview → field mapping → validation → batch execution, Papaparse, Manager+ only, 10MB max)
- **Excludes:** Core grid shell and cell renderers (3A-i — already built), field-level permission enforcement in grid (3A-iii), cross-link creation and resolution (3B-i — Linked Record field renderer from 3A-i shows pills, 3B-i adds link picker and resolution), Kanban view (post-MVP), Excel import (post-MVP), merge/update on import (post-MVP), formula engine (post-MVP), Inline Sub-Table summary row (post-MVP — requires rollups)
- **Creates schema for:** None (views, user_view_preferences, record_view_configs, sections defined in 1B)

**Dependencies:**
- **Depends on:** 3A-i (grid shell with cell renderers — this sub-phase adds features on top), 1F (shadcn/ui Dialog, Sheet, Popover, Tabs for Record View + filter builder + view switcher), 1G (real-time service for multi-user collaboration presence + edit events), 1D (logging for collaboration events)
- **Unlocks:** 3A-iii (grid + Record View + Card View ready for permission enforcement), 3B-i (Record View ready for cross-link display and inline sub-table), 3C (Record Thread panel attaches to Record View), Phase 3 second half (Portals use Record View layout engine, Forms use Record View layout engine)
- **Cross-phase deps:** 1D, 1F, 1G

**Sizing:**
- **Estimated prompts:** 13
- **Complexity:** High
- **Key risk:** Multi-user collaboration field locking — Redis lock lifecycle (acquire, heartbeat, release, timeout) must be bulletproof or users experience phantom locks preventing edits

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3A-iii — Field-Level Permissions: Model, Resolution & Config UI

**One-sentence scope:** Implements the full field-level permission model with three-state visibility (read-write / read-only / hidden), two-layer restriction storage in `views.permissions` JSONB, the 7-step runtime resolution algorithm, permission configuration UI, Redis caching with real-time invalidation.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| permissions.md | Table View–Based Access, Field-Level Permissions, Permission Configuration UI, Permission Storage (JSONB), Permission Resolution at Runtime, Permission Caching Strategy, Permission Management Hierarchy, Key Decisions Summary, Permission Denial Behavior | 90–448 | ~359 |
| gaps/tables-views-boundaries.md | Table View data model, My View data model (reference context — doc is SUPERSEDED) | 20–100 | ~80 |

**Total reference lines:** ~439 (but gaps doc is reference-only context, not code-generative — effective new code lines: ~359)

**Scope Boundaries:**
- **Includes:** Table View as access boundary for Team Members and Viewers (they see only assigned Shared Views), field-level 3-state permissions (read-write / read-only / hidden) per role per Table View, two-layer restriction model (Layer 1: role-level restrictions per table per Table View stored in `views.permissions` JSONB with `ViewPermissions` / `ViewFieldPermissions` TypeScript interfaces; Layer 2: bidirectional individual overrides that can restrict further OR restore access), 7-step internal user permission resolution cascade (base role → role restrictions → individual overrides → effective state), cross-link permission resolution (intersect card_fields with target table permissions), permission configuration UI (role-level field grid with click-to-cycle states, individual override view showing effective permissions), `resolveFieldPermissions()` runtime function in `/data` layer, permission check in `/actions` layer (role + operation gating), Redis cache at `cache:t:{tenantId}:perm:{interfaceId}:{userId}` with 300s TTL, invalidation triggers (role change, field permission update, view permission update), `permission.updated` real-time push via Redis pub/sub for connected clients, permission denial behavior (403 ForbiddenError, disabled buttons for unauthorized actions, hidden fields not rendered, read-only fields with lock icon, audit logging for denied attempts with deduplication), security tests (hidden field leakage in API response, Viewer write attempt, cross-link field permission bypass)
- **Excludes:** Workspace role assignment and `checkRole()` / `requireRole()` utilities (1C — already built), portal client permissions (Phase 3 second half — Portals), App Designer portal permissions via `app_blocks.data_binding` (post-MVP), sandbox/live environment permission isolation (post-MVP), SAML SSO / SCIM provisioning (post-MVP)
- **Creates schema for:** None (views.permissions JSONB shape, workspace_memberships.role defined in 1B)

**Dependencies:**
- **Depends on:** 3A-i (grid renders fields — permissions control which fields are visible), 3A-ii (Record View + Card View + My Views need permission filtering), 1C (workspace roles, `getTenantId()`, `checkRole()` already built), 1E (test factories + `testTenantIsolation()` for permission security tests), 1G (real-time service for `permission.updated` push)
- **Unlocks:** 3B-i (cross-link permission resolution depends on field permissions being enforced), 3B-ii (Command Bar search results filtered by permissions, SDS permission-filtered schema), 3C (Record Thread visibility respects record access), 3D (document template merge tags respect field visibility), Phase 3 second half (Portals, Forms need full permission model)
- **Cross-phase deps:** 1C, 1E, 1G

**Sizing:**
- **Estimated prompts:** 10
- **Complexity:** Medium-High
- **Key risk:** Permission resolution performance — the 7-step cascade runs on every field render for every user; incorrect caching or invalidation creates stale permissions (security vulnerability) or excessive Redis lookups (latency)

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3B-i — Cross-Linking Engine

**One-sentence scope:** Builds the cross-platform record linking system with the `cross_links` / `cross_link_index` data layer, query-time resolution at levels 0–2, the Link Picker UX, display value maintenance, scalability infrastructure, creation constraints, impact analysis, and the Convert to Native Table migration path.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| cross-linking.md | What Cross-Linking Is, Data Model, Query-Time Resolution, Link Picker UX, Display Value Maintenance, Cross-Link + Sync Interaction, Scalability, Creation Constraints, Cross-Link Creation & Modification Permissions, Impact Analysis, "Convert to Native Table" Migration | 31–567 | ~537 |

**Total reference lines:** ~537

**Scope Boundaries:**
- **Includes:** `cross_links` table population and Server Actions (CRUD with `card_fields` JSONB, `link_scope_filter`, relationship types one_to_many / many_to_one), `cross_link_index` maintenance (denormalized pair entries for bidirectional lookup), Linked Record field type in FieldTypeRegistry (`type: 'linked_record'` with `target_table_id`, `cross_link_id`, `card_fields` config), query-time resolution at 3 levels (L0: display values from cache, L1: single-hop JOIN for full linked record, L2: two-hop for linked-of-linked), depth limit enforcement (max 2 hops MVP, configurable), Link Picker UX (search across target table records, create-new inline, multi-select for many-to-many, recent links, scope filter awareness), display value maintenance (cached display values on `cross_link_index.display_value`, staleness detection via `updated_at` comparison, refresh triggers on linked record update), cross-link + sync interaction (synced tables as link targets, `filtered_out` flag handling), scalability (tiered integrity sampling at 3 tiers, batch processing for cascade updates, index optimization on `cross_link_index`, backpressure via Redis `q:cascade:depth:{tenantId}`), creation constraints (per-table link limits, depth limits, cycle detection algorithm, **cross-tenant linking permanently forbidden** — 3-layer enforcement: DB FK constraints prevent cross-tenant links, API validates `workspace.tenant_id` matches on both sides, Link Picker never surfaces workspaces outside current tenant context — CP-002), cross-link creation permissions (Manager within managed bases, Admin/Owner for cross-base links), impact analysis (3-tier consequence model: Tier 1 direct dependents, Tier 2 indirect, Tier 3 estimated; cascade visualization modal), "Convert to Native Table" migration (copy synced records to native table, remap cross-links, optional dual-write period, finalization step)
- **Excludes:** Linked Record cell renderer (3A-i — pill display already built), Inline Sub-Table display mode (3A-ii — already built), multi-hop traversal beyond L2 (post-MVP), rollups across cross-links (post-MVP — requires formula engine), cascade engineering full implementation (post-MVP — MVP uses single-hop rule), Workspace Map visualization (post-MVP)
- **Creates schema for:** None (cross_links, cross_link_index defined in 1B)

**Dependencies:**
- **Depends on:** 3A-i (Linked Record cell renderer displays cross-link pills), 3A-ii (Record View displays linked records, Inline Sub-Table consumes cross-link data), 3A-iii (cross-link permission resolution requires field permissions), 2A (FieldTypeRegistry — Linked Record field type registration), 1B (cross_links, cross_link_index tables), 1I (writeAuditLog for cross-link mutations)
- **Unlocks:** 3B-ii (SDS includes cross-link graph in WorkspaceDescriptor, Command Bar searches across linked records), 3C (Record Thread on linked records), 3D (document template merge tags can traverse cross-links), Phase 3 second half (Portals display cross-linked records, Forms can create linked records)
- **Cross-phase deps:** 1B, 1I, 2A

**Sizing:**
- **Estimated prompts:** 12
- **Complexity:** High
- **Key risk:** Query-time resolution performance — L1/L2 JOINs across large tables with many cross-links can produce slow queries; the tiered integrity sampling and index strategy must be validated early against realistic data volumes

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3B-ii — Schema Descriptor Service & Command Bar

**One-sentence scope:** Implements the Schema Descriptor Service (read-only LLM-optimized schema API with per-user permission filtering and 2-tier caching) and the Command Bar with record search, table navigation, slash commands, and AI natural language search.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| schema-descriptor-service.md | Overview, Architecture Position, Output Schema, Permissions Integration, API Surface, Caching Strategy | 45–237 | ~193 |
| command-bar.md | Full doc | 1–163 | ~163 |

**Total reference lines:** ~356

**Scope Boundaries:**
- **Includes:** SDS `describe_workspace()` endpoint (returns `WorkspaceDescriptor` JSON: tables with field definitions, cross-link graph, view configs — all permission-filtered per requesting user's role), SDS `describe_table()` endpoint (single-table detail with field metadata, linked tables, sample records), SDS `describe_links()` endpoint (cross-link topology for a table), `schema_version_hash` for cache invalidation (hash of table/field/cross-link definitions, invalidated on schema mutation), 2-tier caching (in-memory LRU per process + Redis `cache:t:{tenantId}:sds:{hash}` with 300s TTL), token budget estimator (estimate WorkspaceDescriptor token count for AI context window management), Command Bar (`Cmd+K` / `Cmd+F`) with 4 search channels (Channel 1: fuzzy record search across all accessible tables via tsvector, Channel 2: table/view navigation with keyboard selection, Channel 3: slash commands — `/create`, `/import`, `/settings`, `/help`, etc., Channel 4: AI natural language search via SDS + AIService), recent items tracking (`user_recent_items` table, `command_bar_sessions` for analytics), Command Bar scoped mode (`Cmd+F` scopes to current table), search result ranking (recent items boosted, permission-filtered), keyboard-first interaction (arrow keys, enter to select, escape to close, type-ahead filtering)
- **Excludes:** DuckDB analytical query layer (post-MVP — SDS provides schema discovery, DuckDB provides execution), vector embeddings / semantic search (post-MVP), AI agents consuming SDS (post-MVP), Smart Docs live data in SDS (post-MVP), Workspace Map consuming SDS (post-MVP), full-text search infrastructure (tsvector indexes assumed from 2B grid performance layer)
- **Creates schema for:** None (user_recent_items, command_bar_sessions defined in 1B)

**Dependencies:**
- **Depends on:** 3A-iii (SDS permission filtering requires field-level permission resolution), 3B-i (SDS includes cross-link graph — cross_links must exist), 1H (AIService for Command Bar AI natural language search channel), 1B (user_recent_items, command_bar_sessions tables), 1F (shadcn/ui Command component — cmdk — for Command Bar UI)
- **Unlocks:** 3D (document template merge tag picker can use SDS field metadata), Phase 3 second half (Forms field picker uses SDS, Settings uses SDS for schema display), Phase 4+ (AI features consume SDS — Smart Fill, Record Summarization, Field Suggestions)
- **Cross-phase deps:** 1B, 1F, 1H

**Sizing:**
- **Estimated prompts:** 10
- **Complexity:** Medium-High
- **Key risk:** SDS token budget management — the WorkspaceDescriptor for a large workspace (50+ tables, 500+ fields, 100+ cross-links) can exceed AI context windows; the token budget estimator must accurately predict size and the SDS must support progressive detail levels

**Existing Roadmaps:**
- schema-descriptor-service.md has an existing Claude Code Prompt Roadmap (lines 273–499, 8 prompts). This roadmap covers the full SDS implementation including post-MVP DuckDB integration. Only MVP portions (prompts 1–6 approximately) are in scope for 3B-ii.

---

### 3C — Record Thread, DMs, Notifications & System Email

**One-sentence scope:** Builds the MVP communications system with the two-thread Record Thread model (internal "Team Notes" + client "Client Messages" via `thread_type` discriminator), DMs and group DMs, the Chat Editor (TipTap environment 1), in-app notification aggregation and delivery pipeline, presence system, system email via Resend, thread tab lenses, in-thread search, client thread notification email, and the `source_note_id` schema migration for Personal Notes share-to-thread.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| communications.md | MVP Scope, Thread Scopes (MVP), Threaded Replies, Chat Navigation, Pinned Bookmarks & Presence, Notification Aggregation & Delivery, Chat Editor (TipTap Env 1), Messaging Error Handling, Emoji Picker | 29–440 | ~412 |
| email.md | Email Provider Stack, Sender Identity (Tier 1 only), MVP: System Emails | 10–49 | ~40 |

**Total reference lines:** ~452

**Scope Boundaries:**
- **Includes:** Record Thread with two-thread model (each record has two separate threads: **internal** (`thread_type: 'internal'` — "Team Notes") + **client** (`thread_type: 'client'` — "Client Messages"), replacing the previous single-thread-with-visibility-column design; Record View shows both threads as tabs: "Team Notes" tab (internal, always present) + "Client Messages" tab (client, visible when Client Messaging is enabled in portal settings); no visibility toggle — the `thread_type` discriminator on the `threads` table separates scope cleanly; accessible from Record View header chat icon, opens as 25% panel alongside Record View; Client Messaging toggle in portal settings creates the client thread on enable), client thread notification email via Resend (MVP scope — without it, portal client has no way to know a reply was posted; fires on new message in client thread; renders message preview + link to portal), persistent "client-visible" indicator when composing in client thread (non-dismissible banner above chat input reminding user this message will be visible to portal clients), DMs (1:1 direct messages between workspace members, persistent conversation threads), group DMs (3–8 participants, converted from DM or created fresh), Chat Quick Panel (unified chat feed in sidebar — Quick Panel widget showing all conversations: Record Threads + DMs + Group DMs, sorted by recency), Chat Editor TipTap environment 1 (lightweight editor: progressive disclosure from plain text → @mentions → markdown shortcuts → bubble toolbar → attachments; keyboard: Enter sends, Shift+Enter newline; @mention autocomplete from workspace members; markdown shortcuts for bold/italic/code/links; bubble toolbar on text selection; link preview cards; file/image attachment via drag-drop or button; message display with avatar/name/timestamp/content; edit own messages within 15 minutes; delete own messages), threaded replies (reply-to-parent pattern, auto-add replier as participant, unread markers per thread depth), chat navigation (hierarchical sidebar for self-referential records, tree dropdown in Record Thread header), pinned messages (pin important messages to thread top, visible to all thread participants), bookmarked/saved messages (personal bookmarks via `user_saved_messages`), presence system (online/away/DND/offline states via Redis `presence:t:{tenantId}:{roomId}:{userId}` with 60s TTL heartbeat, WebSocket broadcast), notification aggregation and delivery pipeline (8 notification types: @mention, reply, DM, assignment, record_update, sync_alert, automation_alert, system; `notifications` table with polymorphic reference; in-app notification bell with unread count badge; notification panel dropdown; mark as read/unread; notification preferences per type per user in `user_notification_preferences`; push notification routing for mobile — deferred delivery if user is active in-app), messaging error handling (optimistic send with retry, failed message indicator with manual retry button, offline queue with sync on reconnect), emoji reactions (JSONB schema on `thread_messages.reactions`, emoji picker via emoji-mart with colon autocomplete), system email via Resend (workspace invitations, system alerts like sync failures/automation errors/storage quota; `notifications@everystack.com` sender; React Email server-side rendered templates; Clerk handles auth-related emails separately); **source_note_id migration** — `ALTER TABLE thread_messages ADD COLUMN source_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL` — nullable, NULL for all regular messages, set only when a note is shared via the Share to Thread action in 3G-ii; index `(source_note_id) WHERE source_note_id IS NOT NULL`; ON DELETE SET NULL preserves the thread message when its originating note is deleted; **thread tab lenses** — replace single Record Thread feed with filtered tab navigation: `[ All ] [ Notes ] [ Activity ] [ Files ]` — All: chronological default, Notes: `WHERE source_note_id IS NOT NULL` (shared personal notes only, navigation tool for long threads), Activity: `WHERE message_type = 'activity'` (system-generated entries: field changes, automation runs, sync events), Files: `WHERE attachment IS NOT NULL`; all tabs are filtered views of the same `thread_messages` data with no storage duplication; **visual distinction for shared notes** — thread messages where `source_note_id IS NOT NULL` render with: note icon badge (📝) in message header, 3px solid `--ws-accent` left border, slightly inset body container (`border-l-4 border-ws-accent bg-muted/40 pl-3 rounded-r-md` on message body wrapper) to visually distinguish privately-drafted content deliberately surfaced from regular conversation; **in-thread search (⌘+F)** — scoped to the open thread panel only (not global Command Bar search); trigger: ⌘+F when thread panel is focused; short threads (all messages in memory): client-side string filter on rendered message content; long threads (paginated): `ILIKE` query on `thread_messages WHERE thread_id = $current AND content::text ILIKE $query`; results: highlight matched text inline, scroll to first match, Escape closes search bar
- **Excludes:** Client thread designated-rep model (post-MVP — Manager assigns specific participants to client thread; MVP: all workspace members with record access can see/write client thread), Base-scoped threads (post-MVP), table-scoped threads (post-MVP), omnichannel external messaging (post-MVP — Custom Apps & Live Chat), activity logging in record threads (post-MVP — Comms & Polish), slash commands in chat (post-MVP), rich link unfurls (post-MVP), custom workspace emoji (post-MVP), email digest notifications (post-MVP), connected inbox (post-MVP), outbound CRM email (post-MVP — Documents), custom domain email (post-MVP), email compose UI (post-MVP), email templates for user content (post-MVP); **Personal Notes UI** (3G-ii — the Share to Thread *button* and the `@mention` recipient picker live in 3G-ii; 3C delivers only the schema migration and thread rendering that enables them)
- **Creates schema for:** None (threads, thread_participants, thread_messages, user_saved_messages, notifications, user_notification_preferences defined in 1B); **schema migration only:** `source_note_id UUID NULLABLE REFERENCES user_notes(id) ON DELETE SET NULL` added to `thread_messages` — this column cannot be in 1B since 1B is already merged to main; it ships as a Phase 3C migration

**Dependencies:**
- **Depends on:** 3A-ii (Record View provides the overlay where Record Thread panel attaches; Chat Quick Panel uses the Quick Panel sidebar pattern), 1J (threads.thread_type schema migration — two-thread model requires thread_type column + UNIQUE constraint delivered in 1J), 1G (real-time service for chat message delivery via Redis pub/sub → WebSocket, presence heartbeat system, BullMQ for notification delivery jobs), 1F (shadcn/ui primitives for notification panel, chat UI, emoji picker), 1D (Pino logging for message delivery tracking), 1I (writeAuditLog for message deletion)
- **Unlocks:** 3E-i (portal client thread rendering consumes client thread infrastructure), Phase 3 second half (My Office Chat widget consumes the chat system, Mobile messaging surface), 3D (Record Thread accessible from document template editor), 3G-i (notification preferences UI reads from notification pipeline), 3G-ii (My Office Chat widget + Personal Notes Share to Thread action depend on TipTap env 1, Quick Panel pattern, and notification pipeline), Phase 4+ (automations "Notify" action sends via notification pipeline, Activity Feed post-MVP)
- **Cross-phase deps:** 1D, 1F, 1G, 1I, 1J

**Sizing:**
- **Estimated prompts:** 15
- **Complexity:** Medium-High
- **Key risk:** TipTap environment 1 scope creep — the Chat Editor has extensive progressive disclosure (6 interaction tiers) and must remain lightweight compared to environment 2 (Smart Doc editor in 3D); over-engineering the chat editor delays the entire communications sub-phase; the added thread tab lenses, visual distinction rendering, in-thread search, two-thread model (CP-001-D), client thread notification email, and client-visible composer indicator are real scope additions — if 3C approaches the 15-prompt ceiling during playbook generation, consider moving client thread notification email to 3E-i (portals) and splitting as 3C-ii before generating the playbook

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3D — Document Templates & PDF Generation

**One-sentence scope:** Builds the TipTap environment 2 editor for document template authoring with merge-tag field tokens, the Gotenberg PDF generation pipeline, document template CRUD, and the template mapper UI for selecting record data sources.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| smart-docs.md | TipTap Editor Architecture (Environment 2), Document Generation — Two Prongs (Prong 1 only: TipTap merge-tag → Gotenberg → PDF) | 49–229, 331–414 | ~265 |

**Total reference lines:** ~265

**Scope Boundaries:**
- **Includes:** TipTap environment 2 (full-featured Smart Doc editor — superset of env 1 chat editor; additional capabilities: headings H1–H4, nested lists, code blocks with syntax highlighting, tables with cell merging, images with resize/alignment, callout blocks, horizontal rules, table of contents auto-generation, page break markers for PDF), custom EveryStack TipTap node definitions (merge-tag field token node — displays field name as inline chip, resolves to record value at render/generation time; record reference node — links to another record; table embed node — inline sub-table reference), JSONB document schema (TipTap JSON → `document_templates.content` JSONB column, version tracking), React component structure (`SmartDocEditor` with toolbar, content area, merge-tag inserter sidebar), merge-tag inserter (browse table fields, cross-link traversal for linked record fields, insert as inline token chip, preview with sample data), document template CRUD (Server Actions: create, update, duplicate, delete; stored in `document_templates` table with `tenant_id`, `table_id`, `content` JSONB, `name`, `created_by`), Prong 1 document generation flow (select template → select record → resolve merge tags against `records.canonical_data` → render TipTap JSON to styled HTML → send to Gotenberg → receive PDF → store in R2 via StorageClient → create `generated_documents` row → return download URL), Gotenberg integration (HTTP API call with HTML + CSS payload, sandboxed PDF rendering, timeout handling, error recovery), template mapper UI (visual interface for selecting which record's data populates the template — useful when template spans multiple linked tables), rendering pipelines (screen preview: TipTap rendered in browser with resolved merge tags; PDF: Gotenberg-rendered with print-optimized CSS; portal: read-only rendered view for shared documents), plan limit enforcement (doc gen/month quota check before generation)
- **Excludes:** Wiki architecture and wiki table_type (post-MVP — Documents), Smart Doc field type (post-MVP — the field type that stores authored/generated docs per record), Smart Doc View (wiki mode two-panel page tree — post-MVP), Prong 2 upload template generation (post-MVP — .docx/.xlsx template upload with Docxtemplater), AI content blocks (post-MVP), chart embeds in docs (post-MVP), knowledge base mode (post-MVP), Smart Doc co-editing via Hocuspocus (post-MVP), document versioning and snapshots (post-MVP — `smart_doc_versions`, `smart_doc_snapshots` tables), backlinks (post-MVP), formula engine (post-MVP)
- **Creates schema for:** None (document_templates, generated_documents defined in 1B)

**Dependencies:**
- **Depends on:** 3A-i (FieldTypeRegistry cell renderers inform merge-tag display), 3A-iii (merge-tag inserter respects field visibility permissions), 3B-i (cross-link traversal for merge tags that reference linked record fields), 1G (StorageClient + R2 for PDF storage, BullMQ for async PDF generation jobs), 1H (AIService for future AI draft capability — interface wired but AI draft is a separate prompt), 1F (shadcn/ui primitives for template editor UI)
- **Unlocks:** Phase 3 second half (Portals can share generated documents, Forms can trigger document generation), Phase 4+ (automations "Generate Document" action consumes the generation pipeline, email "Send in email" action attaches generated PDFs)
- **Cross-phase deps:** 1F, 1G, 1H

**Sizing:**
- **Estimated prompts:** 10
- **Complexity:** Medium
- **Key risk:** TipTap environment 2 custom node complexity — the merge-tag field token node must correctly resolve across cross-link boundaries at generation time, and the JSONB document schema must be stable since it's the long-term storage format for all document templates

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

## Dependency Graph

```
Phase 1 (Foundation)
 ├── 1A, 1B, 1C, 1D, 1E, 1F, 1G, 1H, 1I
 │
Phase 2 (Sync)
 ├── 2A (FieldTypeRegistry + Airtable)
 ├── 2B (JSONB indexes + outbound sync + conflicts)
 │
Phase 3 — First Half
 │
 ├── 3A-i (Grid View Core)
 │    │
 │    ├── 3A-ii (View Features + Record/Card View)
 │    │    │
 │    │    └── 3A-iii (Field-Level Permissions)
 │    │         │
 │    │         ├── 3B-i (Cross-Linking Engine)
 │    │         │    │
 │    │         │    └── 3B-ii (SDS + Command Bar)
 │    │         │
 │    │         ├── 3C (Communications + Notifications + Email)
 │    │         │
 │    │         └── 3D (Document Templates + PDF)
 │    │
 │    └── 3C also depends on 3A-ii (Record View for Record Thread)
 │
 └─────── All unlock Phase 3 second half (Portals, Forms, Field Groups,
          Settings, Mobile) + remaining Core UX sub-phases (My Office,
          Automations, Bulk Ops, Record Templates, Audit Log UI,
          Platform API, etc.)
```

**Parallel execution potential:** After 3A-iii completes, sub-phases 3B-i, 3C, and 3D can proceed in parallel (they share no direct dependencies between each other). 3B-ii depends on 3B-i completing first. The critical path is: 3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii.

---

## Validation Checklist

- [x] Every sub-phase passes the one-sentence test (no "and" — verified: each sentence describes one coherent deliverable)
- [x] No sub-phase exceeds 15 estimated prompts (max: 3A-ii and 3C at 13 and 15 respectively)
- [x] No sub-phase needs 5+ reference docs (max: 2 docs in 3A-iii, 3B-ii, 3C)
- [x] Kanban view is excluded from all tables/views sub-phases (explicitly in 3A-i and 3A-ii "Excludes")
- [x] Formula engine is excluded from all sub-phases (explicitly excluded in 3A-i, 3A-ii, 3B-i, 3D)
- [x] Dependencies reference specific sub-phase numbers from Phases 1 and 2 (1A through 1J, 2A, 2B — not "Phase 1" generically)
- [x] No post-MVP features in any "Includes" (verified: Kanban, formula, Wiki, App Designer, AI agents, vector embeddings, connected inbox, omnichannel, Workspace Map, Smart Doc field type, DuckDB, custom apps all excluded)
- [x] Workspace Map correctly excluded (post-MVP — Verticals & Advanced per workspace-map.md line 1224)
- [x] document-intelligence.md correctly excluded (deferred to post-MVP per dependency-map.md Phase Boundary Analysis)
- [x] document-designer.md correctly excluded (post-MVP — Documents per dependency-map.md line 426)
- [x] Total sub-phase count: 7
- [x] Total prompt estimate: 82 (12 + 13 + 10 + 12 + 10 + 15 + 10)
- [x] tables-and-views.md sections split cleanly: Table Type System + Grid core (27–365) → 3A-i; View features + Record/Card/Sections/Import (366–822) → 3A-ii
- [x] permissions.md sections split cleanly: Foundation portions (43–86, 452–475) already in 1C; Core UX portions (90–448) → 3A-iii
- [x] cross-linking.md assigned to single sub-phase 3B-i (537 MVP lines, 12 prompts — within bounds)
- [x] schema-descriptor-service.md MVP portions (45–237) correctly bundled with command-bar.md in 3B-ii (Command Bar is primary SDS consumer)
- [x] email.md MVP scope (~40 lines of system emails) correctly bundled with communications.md in 3C (too thin for standalone sub-phase)
- [x] smart-docs.md sections split cleanly: Wiki Architecture (26–47) excluded as post-MVP; TipTap Editor + Doc Gen Prong 1 → 3D; Smart Doc field type and views excluded as post-MVP
