# EveryStack — Session Log & Open Questions

> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Updated terminology throughout per glossary naming discipline — "Interface Designer" → "App Designer", "Interface" (custom apps) → "App", "Communications Hub" → "Record Thread" / "Chat", "Unified Command Prompt" → "Command Bar", "Builder" → "Manager", "Boards/Bases" → "Workspace" organizational context, "Expand Record" → "Record View" overlay, old "Record View" (multi-record card view) → "Card View" (Table View type); (2) Tagged post-MVP features per glossary MVP scope summary; (3) Updated cross-references to match current glossary terms. Historical decision content preserved — terminology updated to current canonical names.

> **Historical document.** Session notes, decision records, and open questions. Consult for context on past decisions.
> This document is append-only — new sessions add to the top.
> ⚠️ Pre-dates EveryStack rename and tech stack evolution (Fastify→Next.js, Prisma→Drizzle, Passport→Clerk). See GLOSSARY.md naming discipline table for all term mappings. Architecture decisions remain valid; implementation details follow current tarball docs.
> ⚠️ Contains references to removed tables (`interface_views`, `interface_tabs`, `user_interface_customizations`). These are historical context only — see `data-model.md` Legacy Tables for current replacements.
> ⚠️ Docxtemplater PRO purchase decision is historical context only — MVP uses TipTap → HTML → Gotenberg (Chromium) → PDF. DOCX upload path deferred to post-MVP; `document-designer.md` supersedes with homegrown DOCX engine.
> Last updated: 2026-02-27 — Glossary reconciliation applied. All 74 open questions resolved. Email architecture specced (new sub-document).

---

## Open Questions / Discussion Log

_Items to revisit as development progresses:_

- [x] ~~Fastify vs Express — final decision?~~ → **Fastify.** Built-in JSON schema validation (compiled once, runs fast), native async. Decided 2026-02-10.
- [x] ~~AI provider selection (Claude API, OpenAI, etc.) for Command Bar conversational AI~~ → **Anthropic (Claude) as primary provider.** Selected for large context windows, structured output reliability, instruction adherence, and native tool use. Provider-agnostic AIService layer allows swapping. Three-tier model allocation: Haiku (fast), Sonnet (workhorse), Opus (heavy reasoning). Decided in architecture doc §16.
- [x] ~~Custom domain architecture for portals~~ → **Specced, build Post-MVP — Portals & Apps (Fast-Follow).** CNAME to `portals.everystack.com`, Let's Encrypt via Caddy/cert-manager, Redis-cached hostname→portal lookup, `portal_domains` table. URL resolution designed for custom domains from day one (hostname-first, path fallback). Decided 2026-02-10.
- [x] ~~Offline PWA strategy details~~ → **PWA with tiered offline for portals.** Tier 1 (cached reads, stale-while-revalidate) + Tier 2 (queued writes in IndexedDB, sync indicator, last-write-wins on reconnect) in Post-MVP — Portals & Apps (Initial) MVP. Tier 3 (smart pre-caching based on daily schedule) in Post-MVP — Portals & Apps (Fast-Follow). Home screen install with per-portal manifest.json. Decided 2026-02-10.
- [x] ~~Notion integration timing / priority~~ → **MVP — Sync MVP alongside Airtable.** Databases + properties only (no standalone pages, no page body content). 20 of 23 property types mapped. Polling only (no webhooks), 3 req/sec. Bidirectional. Page content → Smart Doc mapping deferred to Post-MVP — Documents+. Decided 2026-02-10.
- [x] ~~Command Bar AI: token/usage limits per plan tier?~~ → **AI Credits system fully specced.** ~~Workspace-pooled credits: Starter 1,500/mo, Professional 5,000/mo, Business 15,000/mo, Enterprise 40,000/mo.~~ **SUPERSEDED — see `ai-metering.md` §Credit Allocation for current numbers (Freelancer 200, Starter 800, Professional 2,500, Business 7,500, Enterprise 20,000).** Per-action costs: 1 credit (Haiku), 2–5 (Sonnet), 8–20 (Sonnet/Opus). Graceful degradation at 100% (Haiku-only mode). Optional overage $1/100 credits. See `claude.md` > AI Credits System.
- [x] ~~Saved views: sharing with team members or private only?~~ → **Both.** My Views (default, any role), Shared Views (Manager+), Locked Shared Views (Manager+, read-only filters). View switcher shows sections divided. Decided 2026-02-10.
- [x] ~~Notification aggregation/digest strategy (real-time vs batched)~~ → **Both, user-controlled.** In-app: real-time via Redis pub/sub, smart grouping (same-thread within 5min collapses). Email: user picks Instant/Hourly/Daily digest (default)/Off. @mentions and DMs always real-time regardless of setting. Decided 2026-02-10.
- [x] ~~Calendar table_type: aggregation view pulling dates from other tables, or records representing events, or both?~~ → **Records representing events.** Calendar-type tables hold event records (meetings, appointments, bookings) configured via `calendar_table_config`. Aggregation across tables is handled by **My Calendar** — a personal platform surface (not a table type) that pulls from calendar tables, project tasks, bookings, personal events, and synced external calendars. One calendar table per workspace marked as default for quick event creation.
- [x] ~~Docxtemplater module selection: PRO pack (4 modules) vs Enterprise (all 19)? HTML + Image + Table likely sufficient for MVP.~~ → **PRO pack ($1,500).** 4 modules: HTML, Image, Table, Styling. Covers all MVP doc gen use cases. Enterprise deferred. Decided 2026-02-10.
- [x] ~~Template Mapper: support Google Docs upload (convert to DOCX first) or DOCX-only?~~ → **DOCX-only for MVP.** Helper tip in UI: "Using Google Docs? Download as .docx first." Native Google Docs API deferred. Decided 2026-02-10.
- [x] ~~DOCX XML run-merging: use existing library or build custom? (Word's text splitting is the core challenge)~~ → **Non-issue.** Docxtemplater handles split runs automatically via built-in InspectModule/parser. No custom code needed. Decided 2026-02-10.
- [x] ~~PDF conversion: LibreOffice headless (self-hosted) vs Gotenberg (Docker service) vs cloud API?~~ → **Gotenberg.** Docker service wrapping LibreOffice. Clean HTTP API (POST DOCX → GET PDF). Also handles HTML→PDF for Smart Doc exports. Free, one docker-compose entry. Decided 2026-02-10.
- [x] ~~Cascading date recalculation: opt-in per table or always-on for auto-scheduled tasks?~~ → **Opt-in per view with atomic undo.** Toggle "Auto-cascade dates" in Timeline toolbar (default: off). Downstream tasks shift by same delta. Stops at fixed constraints with warning. Single Cmd+Z undoes entire cascade. MVP: manual "Shift dependents" button. Auto-cascade: MVP — Core UX (extended). Decided 2026-02-10.
- [x] ~~Critical path calculation: real-time on every change or on-demand/cached?~~ → **MVP — Core UX (extended), visual only (no auto-scheduling).** Forward/backward pass via recursive CTEs. Red left-border accent on critical path tasks. Float as tooltip + optional column. Toggle "Show critical path" (default: off). Informational only — highlights but doesn't move tasks. Decided 2026-02-10.
- [x] ~~PM Gantt rendering library: build custom (full control) vs adopt open-source (faster MVP)?~~ → **Deferred to post-MVP.** MVP uses Timeline view with basic dependency arrows (finish-to-start, start-to-start). Full Gantt (critical path highlight, baseline overlay, auto-schedule cascade) in PM MVP — Core UX — custom Canvas/D3 build when needed. Decided 2026-02-10.
- [x] ~~Resource leveling algorithm: simple heuristic or full constraint solver?~~ → **Deferred to Post-MVP — Verticals & Advanced+.** MVP alternative: overallocation warnings (MVP — Core UX). Red bar above assignee swim lane on overallocated days. No auto-fix — manager adjusts manually. Data: assignee + dates + effort estimate field. Covers 80% of value at 5% effort. Decided 2026-02-10.
- [x] ~~user_tasks: keep at one subtask level or match records with unlimited depth?~~ → **One level of subtasks only.** Personal tasks are lightweight. Deeper nesting belongs in projects-type tables with full dependency management. Decided 2026-02-10.
- [x] ~~Time tracking: rounding rules — workspace-level default or per-table override?~~ → **Both.** Workspace default in Settings (1/5/6/15/30 min, default: none, direction: up). Per-table override via `time_tracking_config.rounding_override`. Decided 2026-02-10.
- [x] ~~Time tracking: approval workflow for submitted timesheets (builder approves member entries)?~~ → **Yes, simple two-stage.** Draft → Submitted → Approved/Rejected. Owner submits, Manager+ approves. Approved = locked for invoicing. Rejected returns to Draft with note. Bulk approve/reject. No multi-level routing. Decided 2026-02-10.
- [x] ~~Asset library: storage quota limits per plan tier?~~ → **Plan-based, workspace-level.** Starter 5GB, Professional 25GB ($2/GB overage), Business 100GB ($1.50/GB), Enterprise 500GB ($1/GB). Max upload: 100MB Starter, 500MB Professional+. Usage dashboard in Settings > Storage. Warning 80%, block 100%. Decided 2026-02-10.
- [x] ~~Asset library: design file preview — build integration or defer to future?~~ → **Defer native preview.** Thumbnail generation on upload (Sharp/FFmpeg for common formats, embedded preview extraction for PSD/AI). Preview modal with metadata + "Open Original" button. Figma URLs open in new tab. Future: Figma iframe embed if demand warrants. Decided 2026-02-10.
- [x] ~~Ad platform integrations: developer token acquisition process for Google Ads (requires app review)?~~ → **Start process Post-MVP — Comms & Polish, ship Post-MVP — Verticals & Advanced.** Google Ads: Cloud project → developer token → Standard Access review (2-4 weeks). Meta: App Review for Marketing API. Start both simultaneously. Platform-level tokens (no user API keys). Users OAuth for account access. Decided 2026-02-10.
- [x] ~~Ad platform integrations: metric_snapshots retention policy (raw data vs aggregated)?~~ → **Raw 90 days, daily aggregates forever, monthly aggregates forever.** Nightly BullMQ job prunes raw >90d into daily. Storage impact minimal (~100K rows for 3 years × 100 campaigns). Decided 2026-02-10.
- [x] ~~Ad platform integrations: which platforms to prioritize based on target user research?~~ → **Google Ads + Meta Ads first (Post-MVP — Agency Features/8b).** Cover 80%+ of agency spend. LinkedIn Ads Post-MVP — Verticals & Advancedc. TikTok/Twitter Post-MVP — Custom Apps & Live Chat+ per demand. Decided 2026-02-10.
- [x] ~~Record-level ownership access control: field-based scoping (assignee sees own records only) — design sharing rules model~~ → **MVP — Core UX (extended). Simple ownership filter.** Manager+ designates People field as ownership field. Team Members/Viewers see only their records. Server-side WHERE filter. Not a full sharing rules engine. Decided 2026-02-10.
- [x] ~~Pipeline/Kanban value rollups: stage-based aggregation, weighted pipeline, summary bar — Board view enhancement~~ → **MVP — Core UX with Board view.** Per-column: count + sum of value field. Weighted pipeline: configurable probability per column. Summary bar at top. Toolbar toggle. Decided 2026-02-10.
- [x] ~~Embeddable external forms: script tag/iframe embed for lead capture on external websites — public form submission to records~~ → **Post-MVP — Portals & Apps (Initial) alongside portals.** Script tag + iframe. Submissions → target table. Cloudflare Turnstile spam protection. Success actions configurable. No auth required. Decided 2026-02-10.
- [x] ~~Activity logging: call/meeting/note logging on records, Activity tab, interaction timeline — data model design~~ → **Post-MVP — Comms & Polish [post-MVP] alongside full communications system.** New message_type 'activity_log' in thread_messages. activity_metadata JSONB (type, duration, outcome, participants). Quick-log button on record detail. Activity tab on Record View overlay. Decided 2026-02-10.
- [x] ~~Smart Doc collaboration: Yjs + Hocuspocus (self-hosted) vs Liveblocks vs TipTap Cloud for real-time collaboration backend?~~ → **Deferred to post-MVP.** Ship Smart Docs as single-user editing first. When adding collab, lean Yjs + Hocuspocus (self-hosted, no vendor lock, TipTap has native Yjs support). Decided 2026-02-10.
- [x] ~~Smart Doc version history: auto-save frequency (every N seconds vs on blur vs manual)? Version pruning strategy for storage?~~ → **Debounced 3s after last keystroke + save on blur.** No manual save button. Visual "Saving..."→"Saved ✓". Pruning: all versions 30 days, daily snapshots 30–90 days, weekly 90+. Named versions + snapshots kept forever. Decided 2026-02-10.
- [x] ~~Smart Doc large doc threshold: 50KB cutoff for overflow to smart_doc_content — validate against real-world content sizes~~ → **Keep 50KB, validate with telemetry.** 50KB ≈ 15K–20K words, covers 95%+ use cases. Config constant, trivially adjustable. Add telemetry in Post-MVP — Documents. Decided 2026-02-10.
- [x] ~~Smart Doc in forms: how simplified should the "rich text input" variant be for form respondents? Bold/italic only, or allow lists too?~~ → **Bold, italic, underline, bullet list, numbered list, links.** No headings/images/tables/code/slash commands. Same TipTap with restricted extensions. Max 10K chars (configurable). Placeholder text configurable. Decided 2026-02-10.
- [x] ~~TipTap license: confirm 2-environment tier covers both Chat Editor + Smart Doc Editor configurations~~ → **Deferred — using TipTap open-source.** Open-source core (tiptap + starter-kit + extensions) covers both Chat Editor and Smart Doc Editor for MVP. Paid tiers add collaboration, AI commands, cloud hosting — none needed yet. Revisit when adding real-time collab. Decided 2026-02-10.
- [x] ~~DMs: max group DM size (currently specced 3–8) — should this be configurable per workspace?~~ → **Fixed 3–8, not configurable.** Avoids settings complexity and edge cases. Larger group conversations → record-scoped thread. Decided 2026-02-10.
- [x] ~~Threaded replies: should reply notifications go to all thread participants or only parent message author + explicit followers?~~ → **Parent author + explicit followers + @mentioned.** Not all participants. Auto-follow on posting. Unfollow anytime. Matches Slack model. Decided 2026-02-10.
- [x] ~~Presence: WebSocket infrastructure — use existing Redis pub/sub or dedicated presence service (e.g., Ably, Pusher)?~~ → **Redis pub/sub.** Already in stack for AI streaming, BullMQ, caching. Simple heartbeat publish/subscribe per workspace handles 2–50 person teams. No vendor dependency. Swap in dedicated service later if needed. Decided 2026-02-10.
- [x] ~~Link unfurls: rate limiting on OG fetch to prevent abuse (user spamming URLs)?~~ → **5 unfurls/message max, 30s user cooldown after 3+ URL messages, Redis cache 24h TTL, failed fetches cached 1h.** Backtick-wrapped URLs suppress unfurl (Slack convention). Decided 2026-02-10.
- [x] ~~Omnichannel: WhatsApp Business API requires Meta business verification — document onboarding flow for customers~~ → **Guided wizard in Settings.** Step-by-step: Meta Business Manager → verification → phone number → SMS verify → connected. Links to Meta docs. Alternative: BSP partnership evaluated Post-MVP — Custom Apps & Live Chat. Decided 2026-02-10.
- [x] ~~Omnichannel: pricing model for external messaging (per-message cost pass-through vs included in plan tier)?~~ → **Pass-through + 20% markup, usage-based add-on.** Not included in plan tiers. Pre-paid credit system ($10–$100 blocks). Auto-reload. Low balance warning 20%. Decided 2026-02-10.
- [x] ~~Omnichannel: message retention policy for external conversations (compliance implications)?~~ → **2 years default, configurable for Enterprise (1/2/5yr/indefinite).** After retention: metadata kept, content purged. GDPR "Purge conversation" action. Internal messages kept indefinitely. Decided 2026-02-10.
- [x] ~~Hierarchical chat nav: should unread counts bubble up to parent records (project shows aggregate unread from all tasks)?~~ → **Yes, one level up only.** Parent record shows aggregate unread badge from direct child threads. No deeper recursion. Materialized counter, incremented/decremented on child events. Decided 2026-02-10.
- [x] ~~`$me` token: extend to standard views (not just Interfaces)?~~ → `$me` is core to the Table View / App system [post-MVP for App scope tiers]. Available in all scope tiers (table/base/workspace — base and workspace are post-MVP). Extension to standard views deferred — standard views are Manager+ context where explicit filter controls suffice.
- [x] ~~App cross-table tabs [post-MVP]: max number of cross-table tabs per App?~~ → **10 tabs max.** Tab overflow: horizontal scroll with arrows. Beyond 10 → create second App or consolidate via cross-links. Decided 2026-02-10.
- [x] ~~Smart Doc template output auto-sync: debounce window (currently 2s) — configurable per workspace or fixed?~~ → **Fixed at 2 seconds.** Server-side constant. Not configurable — marginal value for added settings complexity. Adjustable if telemetry warrants. Decided 2026-02-10.
- [x] ~~Smart Doc snapshots: retention policy (keep forever, or auto-prune after N months)?~~ → **Keep forever.** Snapshots only created on Email/Share/Export (low volume, 5–50 per record). Audit trail value outweighs negligible storage cost. Decided 2026-02-10.
- [x] ~~Record View: max card height before internal scroll? Card field limit guidance?~~ → **No hard max — internal scroll at 80vh.** Guidance: 15–25 fields recommended. >30 creates scroll-heavy UX — hide infrequently used fields. Decided 2026-02-10.
- [x] ~~Record View overlay bottom tabs (Activity, Time, Linked Records, History): which ship in Post-MVP — Comms & Polish vs later?~~ → **Fields + Chat + Linked Records: MVP — Core UX MVP. Activity/History: Post-MVP — Comms & Polish. Time: PM Post-MVP — Portals & Apps.** Tab bar extensible from day one. Decided 2026-02-10.
- [x] ~~My Calendar: recurrence support — full RRULE spec or simplified presets (daily/weekly/monthly/yearly) for MVP?~~ → **Simplified presets UI, RRULE storage.** Presets: Daily, Weekly (pick days), Bi-weekly, Monthly, Quarterly, Yearly. Stored as RFC 5545 RRULE strings. End: Never/After N/Until date. Exception handling: EXDATE + 3-option edit (this/future/all). Decided 2026-02-10.
- [x] ~~My Calendar: external calendar sync (Google/Outlook) — Post-MVP — Comms & Polish (alongside comms) or separate phase?~~ → **Post-MVP — Comms & Polish alongside Record Thread / Chat system [post-MVP for full communications hub].** Shared OAuth flow covers both email + calendar for Google/Microsoft. MVP: one-way pull (read-only). Bidirectional push as fast-follow. Decided 2026-02-10.
- [x] ~~My Calendar: should personal events (`user_events`) block availability in the booking/scheduling system by default or opt-in?~~ → **Block by default (`show_as: 'busy'`).** Toggle per-event to "Show as Free" for reminder-only events. External calendar events same pattern. Workspace events always block (no toggle). Decided 2026-02-10.
- [x] ~~My Calendar: header widget — should it show events from all workspaces or just the currently active workspace?~~ → **Active workspace only.** Header widget shows current workspace events. My Office Calendar tab shows all workspaces (cross-workspace, color-coded). Decided 2026-02-10.
- [x] ~~My Calendar: right panel Calendar tab — future tabs (Activity, Time Log, Linked Records) — when to add?~~ → **MVP: Chat + Calendar only.** Linked Records: MVP — Core UX (extended). Activity: Post-MVP — Comms & Polish (needs audit log). Time Log: PM Post-MVP — Portals & Apps (needs time tracking). Tab bar extensible from day one. Decided 2026-02-10.
- [x] ~~Booking/scheduling system (Calendly replacement): availability rules, booking portal block, round-robin — **dedicated spec session planned, build Post-MVP — Portals & Apps (Fast-Follow).** Decided 2026-02-10.~~ → Already deferred to dedicated spec session. No action needed this session.
- [x] ~~Field System: formula computation — on read (always fresh, slower) or cached with invalidation on write (fast reads)?~~ → **Cached with invalidation.** Compute on write, store result, instant read. Invalidation chain via dependency graph. Circular deps detected at creation. Cascading formula max depth: 10. Decided 2026-02-10.
- [x] ~~Field System: formula syntactic sugar fast-follow — hidden Rollup auto-creation vs inline computation at evaluation time?~~ → **Hidden Rollup auto-creation.** `SUM(linked.col)` in formula → system creates hidden Rollup (`is_system: true`, not visible in grid). Formula references Rollup's cached value. Same caching infrastructure, no separate computation path. Decided 2026-02-10.
- [x] ~~Field System: Checklist items surfacing in My Office Tasks — should overdue checklist items trigger notification?~~ → **Yes, opt-in per field.** `notify_overdue: boolean` (default: false) in checklist field config. Manager decides per field. Off for lightweight checklists, on for onboarding/inspection. Decided 2026-02-10.
- [x] ~~Field System: Sub-Items field type — max depth? Should it use same self-referential pattern or a lighter mechanism?~~ → **3 levels max, self-referential.** Same `parent_record_id` pattern. Task → Subtask → Sub-subtask covers 99% of use cases. Deeper nesting → use PM table with parent-child + dependencies. Decided 2026-02-10.
- [x] ~~Field System: Signature field — legal metadata requirements (timestamp, IP, signer identity) for binding signatures?~~ → **Full metadata.** JSONB stores: signature_data (base64), signer_name, signer_email, signed_at (TIMESTAMPTZ), signer_ip, user_agent, consent_text, document_hash (SHA-256 of record state). Not PKI-level (eIDAS/ESIGN) but sufficient for business use. Decided 2026-02-10.
- [x] ~~Field System: Address field — Google Places API key management (per-workspace or platform-level)?~~ → **Platform-level with quotas.** One EveryStack API key, backend proxy (`POST /api/v1/places/autocomplete`), never exposed client-side. Quotas per plan: Starter 500/mo, Professional 2K/mo, Business 10K/mo, Enterprise 50K/mo. Overage blocked with upgrade prompt. ~$2.83 per 1K requests absorbed into plan pricing. Decided 2026-02-10.
- [x] ~~Bidirectional Sync: polling interval for inbound sync (configurable per connection? Webhook support where available?)~~ → **Webhooks preferred, polling fallback.** Webhooks primary for Airtable. Polling for Notion (no webhooks): 5min active, 30min adaptive backoff. Not configurable for MVP. "Sync Now" button available. Decided 2026-02-10.
- [x] ~~Bidirectional Sync: rate limiting for outbound pushes to prevent API quota exhaustion on source platforms~~ → **Token bucket per connection.** Platform defaults: Airtable 5 req/sec, Notion 3 req/sec, generic 2 req/sec. BullMQ queue, warning at 1K depth. Exponential 429 backoff (1s→60s), pause after 5 consecutive. Daily quota tracking, alert at 80%. Decided 2026-02-10.
- [x] ~~Bidirectional Sync: what happens when source platform field types change (e.g., Airtable user converts text → number)?~~ → **Detect, pause field, notify, 3-option resolution with impact preview.** Pause sync for that field only. Options: (a) Match source type (recommended if >90% coerce, non-convertible preserved in backup field), (b) Keep type + coerce incoming, (c) Disconnect field. Each option shows impact preview (records affected, formulas/automations referencing field). Decided 2026-02-10.
- [x] ~~Boards: when to add permission scoping? What model — restrict visibility, restrict editing, or both?~~ → **MVP — Core UX (extended). Restrict visibility only.** Manager+ marks board as "restricted" → only added members see it. `board_members` table. Unrestricted = default. Editing controlled at base/table level, not board. Decided 2026-02-10.
- [x] ~~Boards: drag-and-drop reordering in sidebar? Drag bases between boards?~~ → **Yes to both, MVP — Foundation.** dnd-kit, persist in `display_order`. Drag base between boards updates `bases.board_id`. Confirmation if cross-links exist to source board (they'll still work). Decided 2026-02-10.
- [x] ~~Table Grid View: toolbar button order and arrangement~~ → **Specced.** Left→right by usage frequency: View switcher, Hide fields, Filter, Sort, Group, Color, [Search center], Density, Share/Export, "…" overflow. Decided 2026-02-10.
- [x] ~~Table Grid View: keyboard shortcuts master list~~ → **Full master list specced** in `tables-and-views.md`: Navigation (arrows, Tab, Home/End, Page Up/Down), Selection (Shift+Arrow, Cmd+Click, Cmd+A), Editing (Cmd+Z/Shift+Z, Cmd+D fill down, F2 edit-in-place, Space toggle checkbox), Grid actions (Cmd+Shift+F filter, Cmd+Shift+N new record, Cmd+Shift+E expand), Platform (Cmd+K, Cmd+/). Decided 2026-02-10.
- [x] ~~Table Grid View: mobile touch interactions (swipe actions, long-press menus)~~ → **Fully specced in Responsive Architecture.** Mobile grid shows card list view. Swipe left = quick action menu, swipe right = select. Tap card → Record View overlay. FAB for +New Record. See `claude.md` > Responsive Architecture > Table Grid View. Decided 2026-02-10.
- [x] ~~Table Grid View: grid library choice (TanStack Table + Virtual, AG Grid, custom?)~~ → **TanStack Table + TanStack Virtual.** Headless data layer gives full control over 40 field type renderers, 3 density modes, inline editing. Pairs with existing TanStack Query. AG Grid's opinions would fight the 74 specced grid behaviors. Decided 2026-02-10.
- [x] ~~Table Grid View: default column widths per field type~~ → **Specced.** 19 field type widths: primary text 280px, checkbox 60px (min), text area 240px, numbers 120px, etc. Global min 60px, max 800px. See `tables-and-views.md` > Column Behavior. Decided 2026-02-10.
- [x] ~~Table Grid View: paste conflict UI when types don't match~~ → **Specced.** Coercible types auto-convert silently. Incompatible cells skipped with toast "N cells skipped — incompatible types" + "Show Details" popover listing each skipped cell. Partial success is fine. Decided 2026-02-10.
- [x] ~~Table Grid View: grouped view + summary footer interaction (table-wide vs per-group only)~~ → **Both.** Per-group summary row at each group footer + table-wide sticky summary bar at very bottom of grid. Grouping off = single table-wide footer. Decided 2026-02-10.
- [x] ~~Table Grid View: performance threshold exact numbers for suggestion banner~~ → **Specced.** >10K rows: info banner. >50K rows: warning + auto-pagination (100/page). >30 columns: hide suggestion. Sort on non-indexed >5K: slow warning. Loading >2s/5s: progressive messaging. Decided 2026-02-10.
- [x] ~~Table Grid View: horizontal virtualization column buffer tuning~~ → **Specced.** Column overscan: 3 before + 3 after (6 total). Row overscan: 10 above + 10 below (20 total). Frozen: row#, checkbox, primary field (never virtualized) + up to 3 user-pinned. No scroll debounce; column resize debounced at 16ms. Decided 2026-02-10.

---

---

## Session Notes

### 2026-02-10 — Infrastructure Decisions Resolved, Documentation Modularization & Reconciliation

**Infrastructure Decisions (7 resolved + 1 PM visual decision):**

1. **HTTP Framework → Fastify.** Built-in JSON schema validation (compiled once, runs fast). Native async. Ecosystem gap has narrowed.
2. **Grid Library → TanStack Table + TanStack Virtual.** Headless data layer gives full control over 40 field type renderers, 3 density modes, inline editing. AG Grid's opinions would fight the 74 specced grid behaviors. Pairs with existing TanStack Query.
3. **Real-time collaboration → Deferred to post-MVP.** Ship Smart Docs as single-user editing first. When adding collab: Yjs + Hocuspocus (self-hosted, TipTap has native Yjs support).
4. **Presence infrastructure → Redis pub/sub.** Already in stack for AI streaming, BullMQ, caching. Handles 2–50 person team presence easily.
5. **PDF conversion → Gotenberg.** Docker service wrapping LibreOffice. Clean HTTP API (POST DOCX → GET PDF). Also handles HTML→PDF for Smart Doc exports. Free, one docker-compose entry.
6. **TipTap license → Deferred, using open-source.** Open-source core covers both Chat Editor and Smart Doc Editor for MVP. Doc gen pipeline works entirely with open-source TipTap (`editor.getHTML()`) + Docxtemplater PRO modules.
7. **Gantt rendering → Deferred to post-MVP (PM MVP — Core UX).** Custom Canvas/D3 build when full Gantt needed.
8. **MVP PM visual → Timeline view with basic dependency arrows.** Finish-to-start and start-to-start connector lines between horizontal bars. Drag to reschedule, resize to change duration. Full Gantt (critical path, baseline overlay, auto-schedule cascade) deferred to PM MVP — Core UX.

**Documentation Modularization:**
Split monolithic architecture doc (29 sections) into 12 modular md files matching the claude.md sub-document structure. Full reconciliation performed: 2 conflicts resolved (sync conflict resolution → last-write-wins; 5-role model authoritative), 9 content gaps filled from architecture doc into md files (platform positioning, backend architecture detail, UI design system, AI integration architecture, sandbox/staging, mobile, account security, conventions, CRM quick wins). AI Integration Architecture placed in claude.md as foundation-level concern.

**Open questions resolved:** 9 items checked off (Fastify, AI provider, AI credits, PDF conversion, Gantt library, Smart Doc collab, TipTap license, grid library, presence infrastructure).

**Design System Completion (3 items resolved):**

9. **Full color palette finalized.** Dark mode: 11 tokens (bgDeep `#0B0F13` through error `#F87171`). Light mode: 11 tokens (symmetric), 3 derived values approved — bgDeep `#E2E8F0` (sidebar tint), bgElevated `#FFFFFF` (shadow-differentiated), tealMuted `#0F766E` (hover teal).
10. **Dark/light mode switching.** System preference default (`prefers-color-scheme`), manual sun/moon toggle in header + Settings > Appearance. Per-user preference in `users.preferences` JSONB. CSS custom properties on `[data-theme]` — components reference tokens only, never raw hex.
11. **Full responsive specification.** Per-component behavior across all 3 breakpoints (Desktop ≥1440, Tablet ≥768, Mobile <768) for: Table Grid View, Record View (overlay), Command Bar, My Office, App Designer [post-MVP], Smart Doc Editor, Automation Builder, Record Thread / Chat system, Cross-Links Manager, Settings, Portal (client-facing). Shared patterns: 44px touch targets, swipe gestures, bottom sheets for modals, action sheets for menus, skeleton loading, pull-to-refresh, keyboard avoidance.

**Total open questions resolved this session:** 12.

**App Designer [post-MVP] Decisions (5 items resolved):**

12. **Custom domains → Spec now, build Post-MVP — Portals & Apps (Fast-Follow).** CNAME → `portals.everystack.com`, Let's Encrypt via Caddy/cert-manager, Redis-cached hostname lookup, `portal_domains` table. URL resolution designed hostname-first from day one.
13. **Mobile portals → PWA with tiered offline, Post-MVP — Portals & Apps (Initial) MVP.** Tier 1 (cached reads, stale-while-revalidate) + Tier 2 (IndexedDB write queue, sync indicator, replay on reconnect). Tier 3 (smart pre-caching from daily schedule) in Post-MVP — Portals & Apps (Fast-Follow). Home screen install with per-portal manifest.
14. **Booking/scheduling [post-MVP] → Dedicated spec session, build Post-MVP — Portals & Apps (Fast-Follow).** Scheduler block placeholder exists. Full spec needs: availability rules, timezone handling, round-robin, conflict detection, cancellation policies.
15. **Multi-language → i18n infrastructure from MVP — Foundation.** i18next + react-i18next, all UI strings via `t('key')`, CSS logical properties for RTL, `resolveContent()` utility for content i18n. 2–3 days MVP — Foundation work prevents costly retrofit. Content locale-keying designed but deferred.
16. **Portal SEO → Basic meta tags in Post-MVP — Portals & Apps (Initial).** Per-page title, description, OG tags. Server-rendered via HTML template injection (not full SSR). Authenticated pages auto-noindex.

**Total open questions resolved this session:** 16.

**Table Grid View Specifications (8 items resolved):**

17. **Toolbar button order** — left→right by usage frequency: View switcher, Hide fields, Filter, Sort, Group, Color, [Search center], Density, Share/Export, "…" overflow.
18. **Keyboard shortcuts master list** — 27 shortcuts across Navigation, Selection, Editing, Grid Actions, and Platform categories.
19. **Default column widths** — 19 field-type-specific defaults (60px–280px), global min 60px, max 800px.
20. **Paste conflict UI** — auto-coerce when possible, skip incompatible cells with toast + "Show Details" popover.
21. **Grouped view + summary footer** — per-group footer AND table-wide sticky footer, both visible when grouping active.
22. **Performance thresholds** — 10K/50K row banners, 30 column suggestion, non-indexed sort warning, progressive loading messages.
23. **Virtualization buffer** — 3 column overscan, 10 row overscan, 3 frozen columns (always) + 3 user-pinned, no scroll debounce.
24. **Mobile touch interactions** — (resolved in Design System section, item #11 above).

**Total open questions resolved this session:** 21.

**Field System Specifications (6 items resolved):**

25. **Formula computation → Cached with invalidation.** Compute on write, store result, instant read. Dependency graph invalidation, circular dep detection at creation, max cascade depth 10.
26. **Formula syntactic sugar → Hidden Rollup auto-creation.** `SUM(linked.col)` in formula → system creates hidden Rollup (`is_system: true`, invisible). Same caching infra, no separate path.
27. **Checklist overdue notifications → Opt-in per field.** `notify_overdue: boolean` (default: false) in field config. Manager decides per checklist field.
28. **Sub-Items max depth → 3 levels.** Self-referential `parent_record_id` pattern. Deeper nesting requires PM table.
29. **Signature legal metadata → Full metadata.** JSONB: signature_data, signer_name/email, signed_at, signer_ip, user_agent, consent_text, document_hash (SHA-256). Business-grade, not PKI-level.
30. **Address API key → Platform-level with quotas.** Backend proxy, plan-based quotas (500–50K/mo), overage blocked.

**Total open questions resolved this session:** 27.

**Sync Engine Specifications (4 items resolved):**

31. **Inbound sync → Webhooks preferred, polling fallback.** Airtable: webhooks primary. Notion: polling only (5min active, 30min adaptive backoff). Not configurable for MVP. "Sync Now" button available.
32. **Outbound rate limiting → Token bucket per connection.** Platform-specific defaults (Airtable 5/sec, Notion 3/sec). BullMQ queue, 429 exponential backoff, daily quota tracking.
33. **Field type mismatch → Detect, pause field, 3-option resolution with impact preview.** Match source (recommended) / keep type + coerce / disconnect field. Impact preview shows affected records, formulas, automations.
34. **Notion → MVP — Sync MVP.** Databases + properties only, 20/23 property types, polling, bidirectional. Page content mapping deferred to Post-MVP — Documents+. Airtable + Notion at launch = strong differentiator.

**Total open questions resolved this session:** 31.

**Communications Specifications (5 items resolved):**

35. **DM group size → Fixed 3–8, not configurable.** Larger groups → record-scoped threads.
36. **Thread reply notifications → Parent author + followers + @mentioned.** Auto-follow on posting. Not all participants.
37. **Link unfurl rate limiting → 5/message max, 30s user cooldown, 24h Redis cache, 1h failure cache.** Backtick suppresses unfurl.
38. **Hierarchical unread → One level up only.** Parent record aggregates direct child thread unreads. Materialized counter.
39. **Notification aggregation → Both channels.** In-app: real-time + smart grouping. Email: user-controlled digest (Instant/Hourly/Daily/Off). @mentions + DMs override to real-time.

**Total open questions resolved this session:** 36.

**Smart Docs / Doc Gen Specifications (6 items resolved):**

40. **Docxtemplater → PRO pack ($1,500).** 4 modules: HTML, Image, Table, Styling. Enterprise deferred.
41. **Template Mapper upload → DOCX-only.** Google Docs users: "Download as .docx first" helper tip.
42. **DOCX XML run-merging → Non-issue.** Docxtemplater handles natively.
43. **Auto-save → 3s debounce + save on blur.** No manual save. Version pruning: all/30d, daily/90d, weekly/forever. Named versions exempt.
44. **50KB overflow threshold → Keep, validate with telemetry.** Config constant, adjustable. 95%+ docs under threshold.
45. **Smart Doc in forms → Simplified rich text.** Bold, italic, underline, lists, links. No headings/images/tables/slash. 10K char default max.

**Total open questions resolved this session:** 42.

**Project Management Specifications (3 items resolved):**

46. **Cascading dates → Opt-in per view + atomic undo.** Toggle "Auto-cascade dates" (default: off). Same delta shift. Stops at fixed constraints. Cmd+Z undoes entire cascade. MVP: manual "Shift dependents" button. Auto-cascade: MVP — Core UX (extended).
47. **Critical path → MVP — Core UX (extended), visual only.** Red left-border accent on critical path tasks. Float tooltip + optional column. Informational, not auto-scheduling.
48. **Resource leveling → Deferred Post-MVP — Verticals & Advanced+.** MVP: overallocation warnings (red bar on assignee swim lane). No auto-fix. Covers 80% of value.

**Total open questions resolved this session:** 45.

**My Office / Calendar Specifications (6 items resolved):**

49. **user_tasks subtask depth → One level only.** Personal tasks are lightweight. Deeper nesting → projects-type tables.
50. **Calendar recurrence → Simplified presets UI, RRULE storage.** 6 presets, RFC 5545 strings, 3-option exception editing.
51. **External calendar sync → Post-MVP — Comms & Polish alongside Record Thread / Chat [post-MVP for full hub].** Shared OAuth flow. One-way pull MVP, bidirectional fast-follow.
52. **Personal events availability → Block by default (`show_as: 'busy'`).** Per-event "Show as Free" toggle. External events same.
53. **Header widget scope → Active workspace only.** My Office Calendar = all workspaces cross-workspace.
54. **Right panel future tabs → Chat + Calendar MVP.** Linked Records: 3b. Activity: Post-MVP — Comms & Polish. Time Log: PM Post-MVP — Portals & Apps.

**Total open questions resolved this session:** 51.

**Agency Feature Specifications (7 items resolved):**

55. **Time tracking rounding → Workspace default + per-table override.** 6 increments (1/5/6/15/30min, none). Direction: round up (configurable to nearest).
56. **Timesheet approval → Two-stage: Draft → Submit → Approve/Reject.** Manager+ approves. Locked on approve. Bulk actions. No multi-level chains.
57. **Storage quotas → Plan-based.** 5/25/100/500 GB. Overage: $2/$1.50/$1 per GB/month. Usage dashboard in Settings.
58. **Design file preview → Deferred.** Thumbnails on upload (Sharp/FFmpeg). Preview modal + "Open Original." Future: Figma iframe embed.
59. **Developer token → Start Post-MVP — Comms & Polish, ship Post-MVP — Verticals & Advanced.** Google Ads + Meta Ads applications simultaneously. Platform-level tokens, user OAuth.
60. **Metric retention → Raw 90 days, daily forever, monthly forever.** Nightly pruning job.
61. **Ad platform priority → Google Ads + Meta Ads Post-MVP — Agency Features/8b.** LinkedIn 8c. TikTok/Twitter Post-MVP — Custom Apps & Live Chat+.

**Total open questions resolved this session:** 58.

**Cross-Cutting Specifications (16 items resolved, including 1 previously deferred):**

62. **Views → My Views + Shared Views + Locked Shared Views.** Any role creates My Views. Manager+ creates Shared/Locked.
63. **Record View card height → Internal scroll at 80vh.** 15–25 fields recommended.
64. **Record View overlay tabs → Fields/Chat/Linked Records MVP.** Activity: Post-MVP — Comms & Polish. Time: PM Post-MVP — Portals & Apps.
65. **App cross-table tabs [post-MVP] → 10 max.** Horizontal scroll overflow.
66. **Smart Doc auto-sync debounce → Fixed 2s.** Not configurable. Server constant.
67. **Smart Doc snapshots → Keep forever.** Low volume, high audit value.
68. **Board permission scoping → MVP — Core UX (extended), visibility only.** `board_members` table. Unrestricted default.
69. **Board drag-and-drop → MVP — Foundation.** Reorder boards + drag bases between boards.
70. **Ownership access control → MVP — Core UX (extended), simple filter.** People field as ownership field. Team Members see own records only.
71. **Pipeline value rollups → MVP — Core UX with Board view.** Per-column sum, weighted pipeline, summary bar.
72. **Embeddable forms → Post-MVP — Portals & Apps (Initial).** Script tag + iframe. Turnstile spam protection. No auth required.
73. **Activity logging → Post-MVP — Comms & Polish.** Structured message type in thread. Quick-log UI. Activity tab on Record View overlay.
74. **WhatsApp onboarding → Guided wizard in Settings.** Step-by-step Meta verification flow.
75. **Omnichannel pricing → Pass-through + 20% markup.** Pre-paid credits. Not included in plan tiers.
76. **External message retention → 2 years default.** Enterprise configurable. GDPR purge action.
77. **Booking/scheduling → Already deferred to dedicated spec session (Post-MVP — Portals & Apps (Fast-Follow)).**

**FINAL TOTAL: 74 open questions resolved this session: 74/74. ✅ ALL OPEN QUESTIONS RESOLVED.**

### Email Architecture (New Spec — 2026-02-10 15:15 UTC)

**New sub-document created: `email.md` — full email architecture.**

Decisions made:

1. **Email provider → Resend (outbound) + Cloudflare Email Workers (inbound).** Resend: modern API, React Email, webhook tracking, clean pricing. Cloudflare: free, pairs with existing stack. SendGrid rejected (bloated, deliverability issues).
2. **Sender identity → 4 tiers.** System (`@everystack.com`, MVP — Foundation) → workspace branded (`@mail.everystack.com`, Post-MVP — Documents) → custom domain (customer DNS, Post-MVP — Documents) → connected personal (Gmail/Outlook OAuth, Post-MVP — Comms & Polish).
3. **Email compose UI → Record-context modal.** Entry points: record detail, Smart Doc action, automation, `/email` command. TipTap body editor with `{merge}` field pills. Template picker. Schedule send.
4. **Email templates → Lightweight, separate from Smart Docs.** Simple subject + body with merge fields. Manager+ creates, Team Members use. Not document templates.
5. **Open/click tracking → Resend webhooks → `email_events` table.** Tracking pixel for opens, link wrapping for clicks. Workspace opt-out toggle for privacy.
6. **Sending limits → Plan-based.** Starter 500/mo, Professional 5K, Business 25K, Enterprise 100K. Overage blocked (not pay-per-email).
7. **Connected inbox → Post-MVP — Comms & Polish, Gmail + Outlook OAuth.** Per-user connection. Shares OAuth flow with calendar sync. Poll every 2 min (Gmail push preferred).
8. **Inbound auto-matching → 3-step priority.** Reply-chain match → sender email match → unmatched inbox. Manager links unmatched manually.
9. **Reply from EveryStack → Via user's connected account.** Falls back to workspace branded if no mailbox connected.
10. **Record Thread / Chat email section [post-MVP] → Post-MVP — Comms & Polish.** Sidebar: All | Sent | Received | Unmatched. Conversations grouped by record.
11. **Bulk email → Out of scope.** EveryStack is record-contextual, not Mailchimp. Automation "Send Email" covers filtered-view sends.
12. **Reply routing → Cloudflare Email Workers.** Unique `reply+{tracking_id}@inbound.everystack.com` in Reply-To header. Instant threading.
13. **Phasing → System (MVP — Foundation), Outbound CRM (Post-MVP — Documents), Connected inbox (Post-MVP — Comms & Polish).**

Files updated: `email.md` (new, 267 lines), `claude.md` (tech stack, pricing, phases, manifest), `communications.md` (Record Thread / Chat email section [post-MVP] reference), `automations.md` (Send Email action reference).

### 2026-02-10 — Sections UI Primitive, Platform Gap Analysis, Five-Role Permission Model, Table View / App Scope Tiers [post-MVP for base/workspace scope]

**Five-Role Permission Model (replaces Owner/Builder/Member):**
- **Owner**: Billing, workspace settings, can restrict Admins, all access. Multiple non-billing Owners allowed.
- **Admin**: Full technical access without billing. Access to all bases. Can create/delete bases. Can manage workspace settings (non-billing). Can set permissions for Manager and below. Cannot create/delete Admins.
- **Manager**: Power user who constructs the experience. Access to permitted bases. Can create bases (not delete). Can create/delete tables (confirmation required). Can create fields, Table Views (table-level MVP) / Apps (base + workspace-level, post-MVP), automations, doc templates, portals. Can invite with role cap (up to Manager). Can set permissions for Team Member and below.
- **Team Member**: Consumption tier. Sees assigned Table Views / Apps, not raw table structure. Record CRUD unless restricted. My Views within Table Views. Personal Sections. Full Record Thread and Chat (Quick Panel) access, plus Command Bar.
- **Viewer**: Read-only by default. Managers can grant edit access to specific fields/tables.

**Role-Based Navigation Bifurcation:**
- Owner/Admin/Manager see structural sidebar: Boards → Bases → tables, plus Cross-Links, Portals, Documents, Automations, Communications, Settings.
- Team Member/Viewer see curated sidebar: flat list of permitted Table Views / Apps organized with Sections, plus Communications. No Boards, Bases, or raw tables visible.
- Table Views / Apps ARE the Team Member's workspace experience. Sections provide organizational grouping that may mirror Board names but are independent.
- Empty state: "Your workspace is being set up" when no Table Views / Apps assigned.

**Three Table View / App Scope Tiers [post-MVP for base/workspace scope]:**
- **Table-level** (Manager+): One table + cross-linked records. Lives in table view switcher. Current spec preserved.
- **Base-level** (Manager+): Any table within one base as equals. No single parent table. Each tab has its own `source_table_id`. Primary use case: mini-apps for business domains (Client Management, Project Tracker).
- **Workspace-level** (Owner/Admin only): Any table in any base. Purpose: aggregation dashboards, executive reporting. Addresses the reporting gap — workspace-level Apps [post-MVP] with chart/summary tabs replace need for separate report builder.
- Data model: `interface_views` gains `scope` enum (table|base|workspace), `table_id` and `base_id` both nullable, `primary_tab_id` for master-detail, `section_id` for Team Member sidebar organization.

**Sections — Platform-Wide List Organizer:**
- Identified list clutter as an unaddressed problem across multiple surfaces (view switcher, automations, cross-links, documents, sidebar, etc.).
- Designed Sections as a universal UI primitive: named, collapsible group headers that items can be dragged into. Purely organizational — no permissions, no filtering, no new entity type.
- Two tiers: personal sections (any user, private) and Manager-created sections (default grouping visible to all workspace members). Team Members see Manager sections as starting layout, can add personal sections on top.
- Same component and mechanics everywhere. "Add Section" option lives alongside "Add [item]" in each context.
- Data model: `sections` table with context discriminator, nullable user_id (null = shared), sort_order, collapse state. Items reference section via nullable `section_id` FK.

**Platform Gap Analysis (5 Holes Identified):**
1. **Email as communication channel** — no spec for connected mailbox, email threading per record, composing/sending from Record Thread / Chat [post-MVP for full hub], inbound email matching. Automation "Send Email" exists but is fire-and-forget with no response loop.
2. **Sections / list clutter** — resolved (see above).
3. **File storage unification** — files live in 5 places (record fields, documents table, chat attachments, Smart Doc embeds, generated docs) with no workspace-level aggregation, no storage quotas, no lifecycle management.
4. **Reports** — partially addressed by workspace-level Apps [post-MVP] as internal dashboards. Portal-page-to-PDF remains for formal reports. Lightweight report recipes/wizards still unspecified.
5. **Base-level UI experience** — table tab bar behavior unspecified (overflow, right-click menu, reordering, indicators). No platform integration wizard for onboarding (connecting Airtable/SmartSuite and choosing tables to import). No table archive/delete cascade spec. No base overview page.

### 2026-02-09 — Table (Grid) View Architecture

**74 design decisions** covering the complete Table View (grid) specification. Comprehensive grid spec from scratch — structure, interaction, cell types, permissions, performance.

**Grid Structure:**
- Column order: drag handle (hover) → checkbox → row # → primary field (frozen) → fields → "+" column
- Three density modes: compact (32px), medium (44px default), tall (64px)
- Alternating row stripes always on
- Windowed virtualization for performance (TanStack Virtual / react-window)
- Sticky header + sticky summary footer

**Interaction Model:**
- Full spreadsheet keyboard nav (arrows, Tab, Enter, Escape)
- Multi-cell range selection + copy/paste (supports external spreadsheets)
- Drag-to-fill (Excel-style fill handle)
- Right-click menus at row level (unified — no separate cell menu) and column header level
- Manual row reordering via drag handle (disabled when sort active)
- Bulk actions toolbar on multi-select: delete, edit in bulk, duplicate, copy

**Cell Type Rendering:**
- Single/multi-select: builder-configurable display (colored block, colored pill, grey pill + dot, plain text)
- People: builder-configurable (grey pill + avatar, colored pill + name, avatar only)
- Smart Doc: badge/icon, opens in side panel
- Linked records: clickable pills, navigate to source table
- Attachments: thumbnail strip (3–4)
- URL/Email: clickable, double-click to edit
- Boolean: single-click toggle
- Rating: inline star widget
- Currency: formatted with symbol + decimals
- Date: click opens date picker popover

**Record View overlay — Three-Zone Layout:**
- Grid | Record View Card | Chat/Calendar — all visible simultaneously
- Record panel mirrors Record View card (vertical fields, inline editable)
- Right panel auto-switches to record's chat thread, collapsible to icon strip
- Clicking different grid rows updates the record panel (persistent)
- Replaces full-screen overlay for grid context

**Column Features:**
- Structural column coloring (pastel tints for visual field grouping, predefined palette, per view)
- User-freezable columns beyond primary field ("Freeze up to here")
- Drag-to-resize, drag-to-reorder headers

**Data Operations:**
- Multi-level sort with priority ordering
- Multi-level grouping (max 3 deep) with collapsible headers, record counts, aggregation rows, drag between groups
- Quick filters (per column) + full filter builder (AND/OR logic, nested groups)
- Optional summary footer (sum, count, avg, min, max per column)
- Import: CSV, Excel, paste, merge/update. Export: CSV, Excel (filtered rows only). Print + PDF.

**Collaboration:**
- Real-time WebSocket updates
- Row-level presence (colored border + avatar)
- Last-write-wins conflict resolution
- Optimistic updates with rollback on error

**Permissions & Views:**
- Field-level permissions: hidden, read-only, or full access per role (Manager-configured)
- My Views + Shared Views, tabs in view switcher
- Manager-assigned default view per table
- No hard row/field caps — graceful degradation with suggestion banners

**Key Design Decisions:**
- No in-grid search (rely on Command Bar + column filters)
- No row hover preview (rely on expand icon)
- Read-only cells show lock icon, paste silently skips them
- Auto-save on blur, no edit mode toggle
- Validation errors show inline (red border + message)
- Empty cells blank, empty state shows illustration + CTA
- Single/bulk delete: undo toast for single, confirmation dialog for bulk
- Responsive: same grid on all breakpoints (never replaced by card layout)

**Command Bar Prompt & Command Ecosystem:**
- Slash command UX: Slack-familiar (type `/`, contextual suggestions at top, alphabetical with fuzzy search)
- 26 system commands across 9 categories: Navigation, Record Creation, Data Operations, Communication, Document Generation, Automation, Settings, Utility, AI Actions
- Prompt templates vs automations: clear distinction (user-initiated one-off vs system-triggered background)
- AI interaction model: natural language primary, AI always rephrases to confirm, output always previewed
- Templates earned from use: AI suggests saving after 3 similar requests
- Personal templates by default, Manager-created templates also available (lightweight or automation-backed)
- AI slash commands are shortcut entry points, not the only path

**Documents Produced:**
- claude.md updated with Table (Grid) View Architecture section, System Slash Command Catalog, AI Prompt Template Model
- table-decisions.md — full 74+ decision running document (grid + command ecosystem)

### 2026-02-09 — Field System Architecture, Boards, Sync & Linking

**Workspace/Tenant Clarification:** Tenant = Workspace, always 1:1. No multi-workspace tenants. No cross-workspace linking — tenant isolation is absolute. An agency managing multiple clients has multiple separate workspaces.

**Boards:** New organizational layer. Boards are folders for bases within a workspace. Default board auto-created. Bases can live at workspace root (outside boards). Purely organizational — no permission scoping initially (add later). `bases` gains nullable `board_id`.

**Field Definitions → Separate Table:** Moved from JSONB in `tables` to first-class `fields` relational table. Enables real foreign keys from config tables, individual field queries, field-level metadata. Record values still in `records.canonical_data` JSONB keyed by field ID.

**Field Type Taxonomy (40 types, 8 categories):**
- Text: text, text_area, smart_doc
- Number: number, currency, percent, rating, duration, progress, auto_number
- Selection: single_select, multiple_select, status, tag
- Date/Time: date, date_range, due_date, time, created_at, updated_at
- People/Contact: people, created_by, updated_by, email, phone, url, address, full_name, social
- Boolean/Interactive: checkbox, button, checklist, signature
- Relational/Computed: linked_record, lookup, rollup, count, formula, dependency, sub_items
- Files: files (one type, auto-detects MIME for rendering)
- Deferred: vote (post-MVP)

**Key field decisions:**
- Status: separate field type (semantic categories: not_started/in_progress/done/closed)
- Tag: separate from Multiple Select (fluid, users add freely)
- Due Date: separate from Date (countdown, overdue coloring, urgency)
- Date Range: keep (start/end in one field, powers Timeline/Gantt/Calendar)
- Progress: computed field (sources: checklist, children, formula, status_mapping, manual)
- Priority: display style on Single Select (not separate type). `icon_set` config (flags/arrows/numbers/exclamation/dots), `level` on options for sort order
- Sub-Items: distinct field type (embeds child records inline)
- Checklist: keep with assignee + due date per item. Assigned items surface in My Office Tasks
- Signature: keep for MVP
- Social: keep for MVP

**Display styles:**
- Selection (Status/Single/Multiple Select/Tag): full_bar, colored_pill, dot_text, plain, priority (Single Select only)
- People: avatar_name, avatar_only, colored_pill, grey_avatar_pill, name_only
- Phone: call/SMS/WhatsApp/copy action buttons, device-adaptive, optional Record Thread / Chat [post-MVP for full hub] routing

**System fields:** Exist on every table, hidden by default, shown on demand. Record Title, Auto Number, Record ID, Created Time, Last Modified Time, Created By, Last Modified By.

**Conditional field display:** Baked into field system from MVP. Show/hide fields based on other field values. Tab > section > field hierarchy.

**Formula System [post-MVP]:** Pure Approach A for MVP (explicit Lookups/Rollups, formulas reference local fields only). Syntactic sugar fast-follow (SUM(linked.field) syntax decomposes into cached intermediates). Full function library: math, text, date, logic, cross-record (fast-follow), type conversion, special.

**Formula Editor:** Simple inline builder (field + operator + field, ~40% of use cases) + Advanced modal (3-panel: left sidebar tabs Functions/Operators/Fields, main editor with syntax highlighting and live preview, right sidebar with context-sensitive docs). AI assistance: natural language → formula generation, formula → explanation, error fixing with suggestions. All via Sonnet (2–4 credits).

**Cross-Linking:** Unlimited within workspace (any table → any table, any base, any board). No cross-workspace linking. Creating a Linked Record field auto-creates cross_link + inverse field. Single tenant_id on cross_links.

**Bidirectional Sync:** Default for Airtable/SmartSuite connections. Inbound-only for ad platforms. Outbound sync via BullMQ jobs. New records on synced tables push to source. Conflict resolution: always surface for manual resolution (diff view in base header). Fields with `external_field_id` eligible for outbound sync; EveryStack-only and computed fields never pushed.

**Computed Value Writeback:** Cross-base Lookup/Rollup values can be sent back to source platforms via automation (user creates field in source, builds automation to map computed → synced field). Pre-built recipe template. Contextual suggestion when creating Lookups/Rollups on synced tables.

**New/updated database tables:** `boards`, `fields`, `sync_conflicts`. Updated: `bases` (board_id), `tables` (removed fields JSONB), `records` (sync_status, last_synced_at), `cross_links` (source/target_field_id, relationship_type), `cross_link_index` (created_at, created_by), `base_connections` (sync_direction, conflict_resolution, sync_status).

### 2026-02-09 — My Calendar Architecture & Calendar Table Type

**My Calendar as First-Class Platform Surface:**
Defined My Calendar as a virtual aggregation layer (not a table type) that pulls time-based data from across all workspaces, filtered to current user. Aggregates: calendar-type table events, projects-type tasks with dates, booking records, personal events (`user_events`), and synced external calendar events (Google/Outlook).

**Three Access Points (Progressive Detail):**
1. **Header widget** (persistent): shows single next item, hover reveals mini agenda (next 2–3 items), click opens right panel calendar tab
2. **Right panel Calendar tab** (360px): coexists with Chat via tab switcher (`Chat | Calendar`). Day view, inline quick-create, source filter toggles. `⌘+Shift+C` shortcut.
3. **My Office Calendar section**: full day/week/month views, complete event management

**Personal Events (`user_events`):** User-scoped (no tenant_id), same pattern as `user_tasks`. For events that don't belong in any workspace (personal appointments, reminders). Created from calendar quick-create with "Personal" target.

**Workspace Default Calendar:** Each workspace auto-creates a default calendar-type table. Quick-created events go there. Configurable via workspace settings. `calendar_table_config.is_default_calendar` flag.

**Calendar Table Type Clarified:** Calendar-type tables hold event records (meetings, appointments, bookings). Configured via `calendar_table_config` mapping fields to event roles (title, start/end time, attendees, location, event type, recurrence, booking source). Aggregation is My Calendar's job, not the table type's.

**Right Panel Tab Architecture:** Right panel now supports tabs (`Chat | Calendar`). Chat remains default. Calendar tab opens via header widget click or keyboard shortcut. Non-sticky — reverts to Chat on navigation. Architecture extensible for future tabs (Activity, Time Log, etc.).

**Key Decisions:**
- My Calendar is a platform surface, not a table type — it doesn't own records, it aggregates
- Personal events live outside tenant scope (like user_tasks) in `user_events` table
- Right panel uses tabs for Chat/Calendar coexistence (not split, not context-dependent)
- Header widget is progressive: next item → hover for 2–3 → click for full panel
- Calendar tab is non-sticky (reverts to Chat on nav) since chat is more commonly contextual
- External calendar events are read-only reference items (not EveryStack records) — for display and availability calculation only
- Calendar feed API provides unified backend query across all source types

**New database tables:** `user_events`, `calendar_table_config`
**Updated:** My Office (5 sections), Application Shell (header + right panel), Table Type System (calendar description), Database Schema

### 2026-02-09 — TipTap Editor Architecture & Smart Doc Field Type

**Two TipTap Environments (paid license tier optimization):**
Defined two distinct TipTap editor configurations to stay within the 2-environment paid tier:
- **Environment 1: Chat Editor** — lightweight, command-prompt-style input for all messaging/conversation contexts. Single-line default, expandable to paragraph mode with Shift+Enter. Floating bubble toolbar on text selection. Cancel/OK buttons in paragraph mode (OK = Cmd+Enter). Extensions: bold, italic, underline, bullet/ordered lists, links, @mentions, placeholder, history. No headings, images, tables, slash commands, or collaboration.
- **Environment 2: Smart Doc Editor** — full-featured document/content editor with three modes (Wiki, Doc, Template). Full toolbar, slash commands, floating bubble menu, block handles. Collaboration via Yjs. Mode-specific extensions: Wiki adds backlinks/TOC/nested pages, Template adds placeholder toolbar/field picker/preview toggle.

**Smart Doc as First-Class Field Type:**
Introduced `smart_doc` as a field type in the EveryStack field system. Any record in any table can have Smart Doc fields. Two sub-types: wiki (editable) and template_output (read-only, live computed from Smart Doc view templates). Content stored as TipTap JSON (source of truth) in canonical_data JSONB; large docs overflow to `smart_doc_content` table. HTML rendered on-demand for Docxtemplater, portals, export.

**New Database Tables:** `smart_doc_content` (doc storage), `smart_doc_versions` (version history/diff/restore), `smart_doc_snapshots` (frozen versions on send/export), `smart_doc_backlinks` (bidirectional wiki link index).

**Contextual Access Points:** Smart Docs surface via: table type (wiki), table view type (document view), record-level field, portals (Smart Doc Block), interfaces, automations (Generate Smart Doc, Smart Doc → PDF), forms (read-only context or rich text input).

**Doc Gen Bridge:** Smart Doc template mode is the visual authoring counterpart to the Template Mapper. Two paths converge: uploaded DOCX → Docxtemplater (complex layouts) and Smart Doc template → HTML module → Docxtemplater (flowing content). Both output DOCX/PDF to S3/R2.

**Key Decisions:**
- TipTap JSON (not HTML) as source of truth for Smart Doc content — lossless round-trip, preserves editor state, collaboration-friendly.
- Chat Editor publishes with Enter (single-line) or Cmd+Enter (paragraph mode). Shift+Enter expands to paragraph.
- Smart Doc field has two sub-types: wiki (editable) and template_output (read-only, live computed from Smart Doc view templates).
- Template authoring happens at the Smart Doc view level (not at the field level). Record-level fields receive generated output.
- Template-output fields auto-sync on source field changes (debounced 2s BullMQ job).
- Email/Share/Export actions create frozen snapshots in smart_doc_snapshots table.
- Wiki table_type stays distinct as base-level knowledge base. Smart Doc view available on any table for table-scoped wiki/templates.
- Three preview modes in template editor: Edit (pills), Preview (sample data), Raw (syntax).

**Documents Produced:**
- claude.md updated with TipTap Editor Architecture section, Smart Doc field type, database schema additions, cross-references throughout.
- claude.md updated with full Chat Editor specification: input states/transitions, progressive disclosure levels, keyboard shortcuts, mention system, markdown shortcuts, message editing/deletion, reactions design.

**Chat Editor Decisions (Progressive Disclosure applied):**
- Bubble toolbar shows only B/I/U/Link/Bullets/Numbers (6 items). Strikethrough, inline code, and blockquote exist via markdown shortcuts only (Level 3) — no toolbar buttons.
- @mentions dropdown: people first, then @here/@channel under "Notify Group" divider (Level 2), then @record/@page under "Link to..." divider (Level 2). @channel restricted to Manager+/Owners.
- Message editing: unlimited time window (not a compliance product). ⋯ menu edit (Level 1) + ↑ arrow last message (Level 2). Small gray "(edited)" label.
- Message deletion: soft delete, "This message was deleted" placeholder. Members delete own, Manager+/Owners delete any.
- Reactions: deferred to Post-MVP — Comms & Polish, but `thread_messages.reactions` JSONB column designed now to avoid retrofitting.
- Attachments: paperclip button + drag-and-drop, stored in `thread_messages.attachments` JSONB.
- thread_messages schema expanded: +parent_message_id, +attachments, +reactions, +link_previews, +pinned_at, +pinned_by, +channel_type, +edited_at, +deleted_at columns.

**Record Thread / Chat Architecture (Slack gap analysis → full spec):**
- Performed feature-by-feature comparison against Slack. Identified three critical gaps (DMs, threaded replies, link unfurls) and several high-value gaps (pins, bookmarks, presence, emoji picker).
- Conversations section replaced with full Record Thread / Chat Architecture section.

**Thread scope expansion:** base/table/record → + dm + group_dm (Post-MVP — Comms & Polish) + external (Post-MVP — Custom Apps & Live Chat). DMs workspace-scoped, 1:1 uses deterministic hash of sorted user_ids as scope_id, group_dm uses generated ID + editable name.

**New tables:** `thread_participants` (membership + unread tracking for DMs, opt-in for other scopes), `user_saved_messages` (private bookmarks), `channel_connections` (Post-MVP — Custom Apps & Live Chat — external platform credentials), `external_contacts` (Post-MVP — Custom Apps & Live Chat — external identities linked to records).

**Threaded replies:** parent_message_id on thread_messages. Flat timeline default (Level 1), reply count chip expands to right panel (Level 2). Per-user inline toggle.

**Hierarchical chat navigation:** Any table with self-referential linked record field gets dropdown picker in chat panel showing parent → siblings → children with unread indicators. Auto-detected, no config needed. No data model change — navigation layer over existing record threads.

**Pinned messages:** pinned_at/pinned_by on thread_messages. 📌 icon in thread header. Members pin in participating threads, Manager+/Owners pin anywhere.

**Bookmarks/saved:** user_saved_messages table. ⋯ menu → Save. Access via My Office "Saved" tab (new 4th section) or Command Bar.

**User presence/status:** WebSocket heartbeat + Redis for real-time presence (online/away/DND/offline). Custom status (emoji + text + auto-clear) stored in workspace_memberships. DND suppresses all notifications except Owner @mentions.

**Rich link unfurls:** Async OG metadata fetch via BullMQ, stored in thread_messages.link_previews JSONB. Redis-cached (24h TTL). Internal EveryStack URLs unfurl as live record/page cards.

**Emoji picker:** emoji-mart library. 😊 button + `:` colon autocomplete. Custom emoji deferred Post-MVP — Verticals & Advanced+.

**Slash commands in chat:** `/` in Chat Editor triggers command_registry filtered to context_scopes including "chat". Complements (not competes with) Command Bar. Examples: /remind, /todo, /generate-doc, /poll, /schedule, /status.

**Omnichannel external messaging [post-MVP, Post-MVP — Custom Apps & Live Chat]:** WhatsApp, Telegram, FB Messenger, Viber integration via platform adapters. Two contexts: internal (user) vs client-facing (external). External threads tied to client records. Inbound: webhook → adapter → normalize → match contact → thread_messages. Outbound: Chat Editor reply → adapter → external API. Post-MVP — Custom Apps: WhatsApp + Telegram. Post-MVP — Native App & Tap to Pay: Messenger + Viber + scheduled messages + contact merging.

**My Office updated:** Now five sections (Chat, Saved, Tasks, Calendar, Workspaces). Desktop layout: 2-column grid + full-width workspaces row.

**Development phases updated:** Post-MVP — Comms & Polish expanded with full comms feature list. Post-MVP — Custom Apps & Live Chat (Omnichannel) added.

**Table View / App Architecture (new section):**
- Table Views (MVP) / Apps (post-MVP) are Manager-designed, permission-scoped view containers in the table view switcher (visually distinguished with 🔷 icon).
- Access types: everyone, role_minimum, user_list (the "Driver #1" pattern for personalized workspaces).
- `$me` token in filters: resolves to current user at query time. One definition serves entire team.
- Cross-table tabs: tabs can pull data from any table in the same base via cross-link relationships.
- Master-detail linking: selecting a record in Tab 1 automatically filters cross-table tabs via `$selected` context.
- Customizability: Manager toggles customizable flag with granular bounds (can_add_tabs, can_modify_filters, etc.). All bounded by user permission level.
- New tables: `interface_views`, `interface_tabs`, `user_interface_customizations`.

**Record View (new view type):**
- Card-based view of filtered records, available on any table. Default first tab in new Table Views / Apps.
- Card layouts: single column, grid (2-3 cols), compact list. Manager sets default, user overrides if customizable.
- Inline editable fields on cards (click to edit, blur to save).
- Right sidebar (360px) shows chat thread for selected record. Includes hierarchical chat navigation.

**Record View overlay (full-screen detail):**
- Universal record detail: expand icon (⤢) available from every view (Table, Board, Gantt, Record View, List).
- Layout: record card (main panel, editable) + chat (right sidebar 360px). Bottom tabs (future): Activity, Time, Linked Records, History.
- Primary field always frozen in table view — expand icon always accessible regardless of horizontal scroll.
- Responsive: desktop side-by-side, tablet overlay chat, mobile full-width with chat via bottom tab.

**Smart Doc Architecture Revision:**
- **Smart Doc field (record level) simplified to two sub-types:**
  - Wiki: user-authored, fully editable, collaboration + version history. Unlimited per record.
  - Template Output: generated from Smart Doc view template, **read-only, live computed** (auto-syncs when record fields change via debounced BullMQ job). One per Smart Doc view template on the table.
- **Smart Doc view (table level) formalized as view type:**
  - Wiki mode: page tree + rich text editor (same as wiki table_type but available on any table).
  - Template mode: doc gen template that auto-populates template-output fields on records. Automations reference Smart Doc view templates by name/ID.
- **Template mode moved from field level to view level.** Record-level fields don't have placeholder toolbars — templates are designed at the view level.
- **Output actions on template-output fields:** Print, Email, Share URL, Copy, Duplicate, Export (DOCX/PDF). Email/Share/Export create frozen snapshots in `smart_doc_snapshots` table.
- **Auto-sync:** field change → debounced BullMQ job (2s window) → re-render template → swap in UI.
- **Three doc gen paths:** Upload DOCX → Docxtemplater (complex layouts), Smart Doc view template → live computed + file export (flowing content), Smart Doc wiki → export on demand (ad-hoc).
- **Wiki table_type [post-MVP] stays distinct** as base-level general knowledge base. Not collapsed into Smart Doc view.

**Table Type System updated:** Added Available View Types table listing all 10 view types (table, record, board, list, timeline, gantt, calendar, gallery, smart_doc, interface).

**New database tables:** `interface_views`, `interface_tabs`, `user_interface_customizations`, `smart_doc_snapshots`. Updated `smart_doc_content` with source_view_id. Updated `interface_definitions` note (portals only, internal interfaces now use interface_views).

**New open questions:** `$me` token availability in standard views.

### 2026-02-08 — Agency Features: Time Tracking, Asset Library, Ad Integrations

**Salesforce Gap Analysis — Quick Win Features to Add:**
Compared EveryStack architecture against Salesforce functionality. Identified four high-value, low-complexity features to add that address the most common gaps without introducing enterprise CRM complexity:

1. **Record-level access control based on ownership [post-MVP]** — "Reps see only their own records, managers see their team's." Extends current RBAC with field-based record visibility scoping. A table-level visibility setting (`visible to: everyone | assigned user only | assigned user + their manager`). The visibility field is configured per table, pointing to a person/user field. Repository layer adds a filter for current user when setting is active. RLS policies enforce at DB level as defense-in-depth. Impact: Enables any team >5 people to use EveryStack for record-based workflows with appropriate data isolation.

2. **Pipeline/Kanban with value rollups [post-MVP]** — Enhance the existing Board view (projects tables) with stage-based value aggregation. When a table has a currency/number field for deal value, Board view displays: total value per Kanban column header, weighted pipeline value (column value × configurable probability per stage), and summary bar showing total pipeline, weighted forecast, and closed-won total. Extends `pm_table_config` (or new `board_config` JSONB) with `value_field_id` and `stage_probabilities` mapping. Calculations client-side from cached data.

3. **Embeddable external forms** — Lightweight form widget embeddable on any external website via script tag or iframe. Unlike portal forms, no client auth required — public-facing. Configuration: select target table, choose exposed fields, set labels/help text/required, success message or redirect URL, receive embed code. Security: honeypot fields, rate limiting per IP (default 10/hour), optional CAPTCHA, CORS domain restrictions. Submissions hit public API endpoint (bypasses workspace auth, enforces rate limits). Fires existing "Form Submitted" trigger for follow-up automations.

4. **Activity logging [post-MVP] (calls/meetings/notes)** — Structured interaction logging on records. `activity_log` table with: `id`, `tenant_id`, `record_id`, `user_id`, `activity_type` (call/meeting/note/email — extensible enum), `subject`, `description`, `outcome` (type-dependent single select: connected/voicemail/no answer/meeting held/cancelled), `duration_minutes`, `attendees` (JSONB array), `activity_date`, `created_at`. Indexed on `(tenant_id, record_id, activity_date)`. UI: "Activity" tab on record detail with chronological timeline (icon per type, avatar, timestamp, expandable notes). `+ Log Activity` button with type selector. Command Bar: `/log call`, `/log meeting`, `/log note` auto-associated with current record. New trigger: "Activity Logged" for automation workflows. Future: Gmail/Outlook sidebar plugin, calendar integration for auto-logging.

These four features are noted for inclusion in the platform roadmap. They follow existing architectural patterns and don't require new structural concepts.

**Context:** Analyzed marketing agency requirements against EveryStack architecture. Identified three feature gaps for agency vertical: time tracking, media/asset management, and ad platform integrations.

**Time Tracking [post-MVP] (Section 26):**
- Capability layer on projects-type tables via `time_tracking_config` (same pattern as pm_table_config).
- Core data model: `time_entries` (logged hours), `billing_rates` (hierarchical rate resolution), `time_tracking_config` (per-table settings).
- Timer widget in header (persistent, Redis-backed across devices). Manual entry on record Time panel.
- Timesheet view (weekly grid, team view for managers/owners).
- Profitability calculations at record/project/client/user levels.
- New automation triggers: Time Entry Created, Budget Threshold Reached, Timesheet Incomplete.
- Portal integration: Time Summary block, retainer dashboard KPI.

**Media & Asset Library [post-MVP] (Section 27):**
- Extends documents table type — assets are records, folders are records with flag, nesting via parent field.
- `documents_table_config` maps fields to asset roles. `asset_versions` tracks version history.
- Thumbnail pipeline via BullMQ (Sharp for images, pdftoppm for PDFs, ffmpeg for video).
- Gallery view (default), list view, folder tree sidebar, asset detail lightbox with versions/comments.
- Portal Asset Gallery block, Brand Assets template, enhanced File Upload creates records.
- Content extraction (PDF/doc text) for full-text search indexing.

**Ad Platform & External Data Integrations [post-MVP] (Section 28):**
- Two sync patterns: Pattern A (entity sync — campaigns as records) and Pattern B (time-series metric storage via `metric_snapshots` table).
- Supported platforms: Google Ads, Meta Ads, Google Analytics 4, LinkedIn Ads (TikTok future).
- OAuth connection flow mirroring Airtable/SmartSuite pattern. Read-only sync (no outbound push).
- `base_connections.platform` enum expanded. Per-platform rate limiting via Redis.
- Cross-linking ad data to clients/projects/invoices — EveryStack's core differentiator.
- Portal Chart block enhanced with "Metric History" data source for time-series rendering.
- Automated monthly client report workflow: Scheduled trigger → Create Report → Email → Post to Portal.
- Post-MVP — Verticals & Advanced in roadmap (post-MVP), sub-phased: 8a Google Ads, 8b Meta/GA4/charts, 8c LinkedIn/templates.

**Key Design Decisions:**
- Time tracking is a capability layer, not a table type — can be enabled on any projects table.
- Assets are records (not a separate system) — inherits all EveryStack capabilities for free.
- Ad platform sync is read-only and uses a new metric_snapshots table for time-series data.
- All three features follow existing architectural patterns (config tables, BullMQ jobs, portal blocks).

**Documents Produced:**
- Architecture spec updated to v1.2 (Sections 26–28 added)
- claude.md updated with condensed feature specs

### 2026-02-09 — Document Generation: Two-Pronged Strategy & Template Mapper

**Document Editor Evaluation:**
Evaluated rich text editor options for template-based document generation. Explored Tiptap (placeholder nodes + DOCX export), CKEditor 5 (pagination + restricted editing), and OnlyOffice (full Office clone via Docker). Identified core limitation: Tiptap's linear block model can't handle fixed-layout documents (invoices, contracts with side-by-side elements). OnlyOffice is overkill ($6K/yr, separate server). CKEditor is a middle ground but still limited for precise layout.

**Two-Pronged Architecture Decision:**
1. **Tiptap** — keeps its existing role for record-level rich text, wiki pages, comments, @mentions, and collaboration. Not used for template-driven document generation.
2. **Docxtemplater** — handles all template-based document output. Users design templates in Word/Google Docs (familiar tools, full layout control), upload to EveryStack, map fields via Template Mapper UI, generate populated documents on demand.

**Docxtemplater Evaluation:**
- Open-source core: `{placeholder}` replacement, loops, conditionals — free
- PRO ($1,500 one-time, 4 modules): HTML injection (bridges Tiptap content into templates), image module, table module, XLSX generation
- Enterprise (all 19 modules): subtemplates, charts, slides, paragraph replacement
- Runs on Node.js and in browser. JSON input → populated DOCX output. Cannot convert to PDF natively — requires LibreOffice headless.

**Template Mapper UI Prototype:**
Built interactive React prototype (docx-template-mapper.jsx) demonstrating the complete field-mapping workflow: upload DOCX → visual preview → select text → map to database fields → preview with sample data → export as template. Design follows Obsidian Teal system (DM Sans, teal primary, dark sidebar, 8px radius, two-panel layout matching App Designer [post-MVP] and automation builder patterns).

**Key Technical Decisions:**
- **docx-preview** (not mammoth.js) for browser-side DOCX rendering — preserves fonts, tables, colors, spacing faithfully
- **JSZip** for DOCX XML manipulation — unzip, walk `<w:t>` runs, replace text with `{placeholder}`, rezip
- **Run-merging logic** needed because Word splits single words across multiple XML runs
- **Template storage** in S3/R2, associated with record types via `template_definitions` table (updated with `template_type` discriminator)
- **PDF conversion** via LibreOffice headless or Gotenberg Docker service
- **HTML module** bridges the two prongs — Tiptap-authored rich text can be injected into Docxtemplater templates

**Backend Integration Requirements (70% of work):**
The prototype covers UX flow (~30%). Production requires: DOCX XML manipulation engine, storage/versioning, dynamic field registry (pulling from workspace schema), Docxtemplater backend service (BullMQ job), PDF conversion pipeline, and docx-preview integration for real uploads.

**Documents Produced:**
- claude.md updated with Document Generation Architecture section, tech stack updates, Post-MVP — Documents rewrite
- Architecture spec Section 13 to be updated (pending)
- docx-template-mapper.jsx (interactive React prototype)

### 2026-02-08 — App Designer [post-MVP], Automation Builder, Design Philosophy

**App Designer [post-MVP] Architecture (from earlier session):**
- Full App Designer [post-MVP] specification added to architecture doc (Section 12): creation flow, designer layout (4-zone: sidebar + canvas + property panel + toolbar), sidebar modes (Pages/Blocks/Layers), block model (44 block types across 7 categories), container rules and nesting, canvas behavior, property panel (Content/Style/Logic tabs), data binding modes (Context/Query/Static/Client), theme system (20 curated themes + custom), preview/publish flow, Smart Setup auto-generation.
- Seven Figma addendums (#12–#18) created covering portal dashboard, designer shell, canvas, property panel, theme system, preview/publish, client management.
- Interactive React mockup created for App Designer [post-MVP] matching Obsidian Teal aesthetic.

**Automation Builder Architecture:**
- Chose flow visualization paradigm (not linear step list, not sprawling node canvas). Top-to-bottom vertical flow with branching columns for conditions. Document-like reading for simple flows; visual columns when branching.
- Builder interface: three-zone layout with three-tab sidebar (Automations with activity summaries, Integrations, History scoped to current automation). History tab replaces Builder/History toolbar toggle — both visible simultaneously.
- Interactive React mockup created for automation builder.
- 12 trigger types fully specified (Record Matches Condition through Another Automation Completed).
- 22 action types fully specified, including: Wait for Event (lifecycle workflow primitive with event/timeout branching), Run Script (sandboxed JS, Level 3), Create Report (portal page rendered to PDF — no separate report designer), Merge Documents (combine files into single PDF), Push Notification (builder + client, with email fallback), AI Generate (prompt with merge fields → text/value/structured output).
- 5 condition types: Branch by Field Value, Record Exists, Formula, Client/Portal Context, Previous Step Result.
- Lifecycle workflow features: global exit conditions, re-entry prevention, sending windows, per-record tracking dashboard, email engagement tracking.
- Reports are portal pages rendered to PDF (Option B) — no separate report designer needed.

**Design Philosophy — Progressive Disclosure:**
- Platform-wide principle: "Always accessible/intuitive for normal users; extremely functional when needed for power users."
- Three levels: Default View (80% use case, recipes/templates, common actions), Expanded View (full options, advanced accordions), Power View (code, expressions, cron).
- Implementation patterns: smart defaults + customize escape hatches, advanced accordions, action/block/field tiering (Common vs All), contextual revelation, recipes as entry points, workspace complexity setting (future).
- Applies to automation builder, App Designer [post-MVP], table builder, cross-links, command prompt.

**Command Bar (formerly "Unified Command Prompt"):**
- Single persistent input in toolbar. Four intent paths: Action (execute with confirmation), Guide (AI walkthrough), Communication (@mentions, messages), Search (records/files/messages).
- Same Cmd+K shortcut. Always visible on every page.
- Permission-Scoped AI: AI calls same API endpoints as frontend (goes through RBAC). Context provider pre-filtered by user permissions. AI can't see what user can't see. Audit trail shows user as actor.
- Confirmation Architecture: writes always require explicit user confirmation (preview → approve). Reads execute immediately. AI never acts autonomously.
- Guide Mode: persistent overlay strip (48px) at bottom of screen. Shows one step at a time. "Show me" spotlights target element. Auto-advances on step completion. Persists across all navigation. Handles detours gracefully.
- Contextual suggestions: passive hints based on usage patterns. One per session max. Dismissable. Powered by Haiku.

**Key Design Decisions:**
- Reports = portal pages rendered to PDF. No separate report designer.
- AI Tutor, Command Bar, and contextual suggestions consolidated into the Command Bar.
- AI is permission-scoped at every level. AI never acts without user confirmation. AI is the user's tool, not an autonomous agent.
- Automation sidebar uses combined automation list + activity monitoring (Tab 1), not separate views.

**Documents Produced:**
- Architecture spec updated (Section 9.8–9.9 Command Bar + Guide Mode, Section 14 full rewrite)
- automation-builder-mockup.jsx (interactive React prototype)
- portal-designer-mockup.jsx (interactive React prototype)
- claude-code-context.md (design system reference for Claude Code)

### 2026-02-07 — Initial Setup & My Office Architecture
- Imported v1.0 of Platform Architecture & Development Specification. Created claude.md. Created Figma Design System & Shell Template Setup Guide.
- My Office as top-level hub. Multi-workspace model. Three-level conversations. Private personal tasks. Command Bar. Extensible command registry. Responsive shell. Table Type System (table/projects/calendar/documents/wiki). Project Management Architecture (pm_table_config, dependencies, calendars, baselines, resources, critical path, auto-scheduling, 5 views). Wiki Architecture. Figma Addendums #3–#11.

---

---

## Document Inventory

| Document | Location | Description |
|----------|----------|-------------|
| Architecture Spec (latest) | /mnt/user-data/outputs/Architecture_updated_feb_8.docx | Full platform specification (28 sections, v1.2). Updated Feb 8 with time tracking, asset library, ad platform integrations. Section 13 pending update for two-pronged doc gen strategy. |
| claude.md | /mnt/user-data/outputs/claude.md | Running project reference (condensed). Updated Feb 9 with Field System Architecture, Boards, Bidirectional Sync, Cross-Linking, Formula System, My Calendar Architecture, Calendar Table Type, TipTap Editor Architecture, Smart Doc field/view types, Table View / App Architecture, Record View (overlay), Record Thread / Chat, Table Grid View Architecture. |
| Table Grid View Decisions | /mnt/user-data/outputs/table-decisions.md | Full 74-decision running document covering grid structure, cell types, interaction model, permissions, performance, collaboration. |
| Command Bar & Prompt Ecosystem | /mnt/user-data/outputs/command-bar-prompt-decisions.md | Complete spec: Command Bar, 26 system slash commands, AI interaction model, prompt template system, Guide Mode, data model. |
| Template Mapper Prototype | /mnt/user-data/outputs/docx-template-mapper.jsx | Interactive React prototype — DOCX upload, visual preview, text selection, field mapping, preview modes, Obsidian Teal design |
| Automation Builder Mockup | /mnt/user-data/outputs/automation-builder-mockup.jsx | Interactive React prototype — flow canvas, branching, config panel, run history |
| App Designer [post-MVP] Mockup | /mnt/user-data/outputs/portal-designer-mockup.jsx | Interactive React prototype — canvas, sidebar modes, property panel, themes, preview |
| Claude Code Context | /mnt/user-data/outputs/claude-code-context.md | Design system reference for Claude Code (colors, spacing, component patterns, architecture) |
| Figma Addendum #1 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-1.docx | Design System & Shell Template |
| Figma Addendum #2 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-2.docx | Command Bar & Notifications |
| Figma Addendum #3 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-3.docx | Base Tab Bar & Type Picker |
| Figma Addendum #4 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-4.docx | Project List & Detail Shell |
| Figma Addendum #5 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-5.docx | Task List View (Asana-style) |
| Figma Addendum #6 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-6.docx | MVP Gantt & Timeline |
| Figma Addendum #7 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-7.docx | Board / Kanban View |
| Figma Addendum #8 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-8.docx | Full Gantt Overlays (MVP — Sync) |
| Figma Addendum #9 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-9.docx | Workload, Portfolio & Dashboard Views (MVP — Core UX) |
| Figma Addendum #10 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-10.docx | Wiki View |
| Figma Addendum #11 | /mnt/user-data/outputs/EveryStack-Figma-Addendum-11.docx | PM Config Wizard |
| Figma Addendums #12–#18 | /mnt/user-data/outputs/ | App Designer [post-MVP] series: Dashboard, Designer Shell, Canvas, Property Panel, Theme System, Preview/Publish, Client Management |
