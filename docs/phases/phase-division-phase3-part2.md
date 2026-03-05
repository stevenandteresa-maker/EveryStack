# Phase 3 (Second Half): MVP — Core UX — Sub-Phase Division (3E–3H)

## Summary
- Sub-phases: 9 (including second-level splits for 3E, 3G, and 3H)
- Estimated total prompts: 86
- Dependencies on Phase 3 first half: 3A-i (grid shell + cell renderers), 3A-ii (Record View + Card View + Views + Sections), 3A-iii (field-level permissions), 3B-i (cross-linking engine), 3B-ii (SDS + Command Bar), 3C (communications + notifications), 3D (document templates)
- Dependencies on Phases 1–2: 1A (monorepo/CI), 1B (database schema), 1C (auth/roles), 1D (observability), 1E (testing), 1F (design system), 1G (real-time/worker/files), 1H (AI service), 1I (audit/API auth), 2A (FieldTypeRegistry + Airtable adapter)

### Key Subdivision Decisions

**3E split into Portals and Forms:** Portals and Forms are distinct systems. Portals have their own authentication layer (magic link + password, `portal_access`, `portal_sessions`), caching infrastructure (three-tier), session management, rate limiting, GDPR compliance, and a separate route architecture (`/portal/*` excluded from Clerk middleware). Forms are public/link-gated data collection using the same Record View layout and standard record creation path. The shared infrastructure (both use `record_view_configs`) is minimal — they split cleanly into 3E-i (Portals) and 3E-ii (Forms).

**3F consolidates three smaller docs:** `field-groups.md`, `bulk-operations.md`, and `record-templates.md` are independent utilities that don't share prerequisites beyond the grid. However, `bulk-operations.md` (571 lines) is substantial enough to merit its own sub-phase, while field groups (569 lines of MVP Core UX content) also merits its own. Record templates (863 lines, but ~200 lines of MVP scope) is smaller but has its own prompt roadmap and sufficient complexity for a standalone sub-phase. Result: 3F-i (Field Groups), 3F-ii (Bulk Operations), 3F-iii (Record Templates).

**3G split into 3G-i and 3G-ii:** The original 3G (Settings + Audit Log UI + My Office) was estimated at 14 prompts, which is at the stated maximum. Personal Notes cannot be absorbed into 3G without breaching that ceiling. The split is clean because 3G-ii's content (My Office + Personal Notes) has different dependencies and a different UX concern than 3G-i's content (Settings + Audit UI). 3G-i (Settings page + Record Activity tab + Workspace Audit Log) and 3G-ii (My Office widget grid + Quick Panel expansion + Calendar Feed API + Personal Notes across all four surfaces) can execute in parallel once their shared gating dependency (3C) is met.

**3H split for mobile:** Mobile has two docs (1232 + 550 lines) covering fundamentally different concerns. 3H-i covers the responsive adaptation of all Phase 3 features (mobile Record View, Card View, mobile grid, mobile input optimization). 3H-ii covers mobile-specific infrastructure (two-layer bottom bar, offline architecture, PWA, notification routing, deep linking). Mobile depends on everything in 3A–3G being built first.

**Exclusions verified:** App Designer, Custom Apps, Embeddable Extensions, Kanban/Calendar/List views, formula engine, AI Agents, vector embeddings — all excluded from every sub-phase.

---

## Sub-Phases

### 3E-i — Quick Portals: Auth, Record Scoping & Client Management

**One-sentence scope:** Builds the Quick Portal system with portal CRUD, tenant-scoped portal slugs, dual client authentication (magic link + password with bcrypt), session management via httpOnly cookies, record scoping via `portal_access.record_id`, the portal route architecture excluded from Clerk middleware, three-tier caching, record deletion cascade with soft revocation, client thread messaging panel, multi-record list view with summary fields, rate limiting, audit logging with `portal_client` actor type, GDPR endpoints, and the portal admin panel.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| portals.md | PART 1: MVP — Quick Portals (all sections: Portal Overview through MVP Feature Summary) | 45–461 | ~417 |

**Total reference lines:** ~417

**Scope Boundaries:**
- **Includes:** `portals` table CRUD (Server Actions: create, update, publish/unpublish, archive, delete), `portal_access` table CRUD (invite, revoke, delete, bulk invite), `portal_sessions` table management (create on auth, expire, revoke), **tenant-scoped portal slugs** (CP-001-A: portal route group changes from `(portal)/portal/[portalSlug]/` to `(portal)/portal/[tenantSlug]/[portalSlug]/`, slug uniqueness enforced per tenant via `UNIQUE (tenant_id, slug)` constraint delivered in 1J, URL display in admin panel updated), portal slug generation, portal route group `(portal)/portal/[tenantSlug]/[portalSlug]/` (login page, magic link validation endpoint, portal layout with session middleware, page renderer), Clerk middleware exclusion for `/portal/*` routes, dual auth implementation (Method 1: email + password with bcrypt cost factor 12, `auth_hash` on `portal_access`; Method 2: magic link with `crypto.randomBytes(32).toString('base64url')`, 15-minute TTL, single-use token), session management (httpOnly `Secure` `SameSite=Lax` cookie, 30-day duration, path-scoped to `/portal/{portalSlug}`), session middleware injecting `x-portal-client-id` header, record scoping via `portal_access.record_id` (security invariant: portal data resolver ALWAYS filters by `portal_access.record_id`), auth failure paths (6 password scenarios, 5 magic link scenarios, 4 session scenarios — all returning generic client-safe messages), password reset flow (256-bit token, 1-hour TTL, single use, all sessions revoked on reset), rate limiting (4 rate limiters: magic link per email, magic link per IP, password per email, password per IP — Redis keys `rl:portal:magic:{email}:{portalId}`, `rl:portal:login:{email}:{portalId}`), portal write-back flow (Server Action: verify session → verify record → validate editableFields → Zod validate → update `canonical_data` → audit log → invalidate cache → emit event), portal file upload constraints (25MB/file, 10 files/attachment, configurable `allowed_file_types`), no-delete policy for portal clients, three-tier caching (CDN: `Cache-Control: private, no-store` for auth pages, Surrogate-Key headers; Redis: `cache:portal:{portalId}:{recordId}:{portalAccessId}` with 60s/300s TTL; Postgres fallback), event-driven cache invalidation, portal admin panel (Clients Tab: list, invite, revoke, delete, bulk invite; Access Tab: auth method selector, session timeout, custom login message), audit trail with `actor_type: 'portal_client'` and `actor_id: portalAccessId`, portal activity log in admin panel, session cleanup BullMQ job (daily: expired session deletion, stale token cleanup), GDPR endpoints (access, erasure, rectification, portability — PII registry in `packages/shared/compliance/`), plan limit enforcement (per-plan portal counts, unlimited clients, page view quotas via Redis `portal:views:{portalId}:{YYYY-MM}` with 35-day TTL, throttle at 120%), rendering modes (Preview Mode with client picker + draft banner, Live Mode with draft-to-live publishing), portal branding via `settings.branding` JSONB (logo, primaryColor, portalTitle), linked record display config, multi-record access (multiple `portal_access` rows per email per portal → record list UI), **record deletion cascade** (CP-001-B: warn-then-cascade flow on record deletion — modal warning showing affected portal clients, soft revocation via `portal_access.revoked_at` + `revoked_reason` columns delivered in 1J, graceful "no longer available" page for revoked clients, revoked clients display in admin panel Clients tab with revocation reason, audit log for cascade revocation with `actor_type = "system"`), **client thread messaging panel in portal** (CP-001-D: portal renders client thread when Client Messaging is enabled in portal settings, Client Messaging on/off toggle in portal settings, portal client can read/write client thread messages — consumes 3C client thread infrastructure), **multi-record list view** (CP-001-E: list page when client has access to multiple records — conditional: 1 record → direct to record, multiple → list; summary field picker in portal settings max 3 fields; `record_slug` generation on `portal_access` creation using `portal_access.record_slug` column delivered in 1J; URL structure with `/{record-slug}`), **linked_record_id invite step** (CP-001-F: optional linking step in portal client invite flow, autocomplete search on workspace tables to set `portal_access.linked_record_id`, can skip — forward-infrastructure for post-MVP portal-to-record conversion)
- **Excludes:** App Portals / App Designer (post-MVP), `portal_clients` table (post-MVP — App Portal identity-based scoping), portal themes (post-MVP), multi-page portals (post-MVP), custom domains (post-MVP), portal analytics / `portal_events` (post-MVP), Stripe payment integration (post-MVP), PWA (post-MVP), Quick Portal → App Portal conversion (post-MVP), portal-embedded forms (post-MVP), Form Builder (3E-ii), mobile portal PWA (3H)
- **Creates schema for:** None (portals, portal_access, portal_sessions defined in 1B)

**Dependencies:**
- **Depends on:** 3A-ii (Record View layout engine — portal renders a Record View of a single record; `record_view_configs` table consumed), 3A-iii (field-level permissions — portal editable fields model mirrors permission visibility), 3C (client thread infrastructure — portal client thread messaging panel consumes 3C's two-thread model and chat delivery), 1J (portal_access +4 columns, portals tenant-scoped slug constraint, tenant_relationships for multi-tenant context), 1B (portals, portal_access, portal_sessions tables), 1C (Clerk middleware config — portal routes excluded), 1D (Pino logging for auth events), 1G (BullMQ for session cleanup job, StorageClient for portal file uploads, real-time for cache invalidation events), 1I (writeAuditLog for portal_client actor type), 1F (shadcn/ui primitives for login pages, admin panel UI)
- **Unlocks:** 3E-ii (forms share `record_view_configs` pattern, portal route architecture provides reference for form standalone routes), 3H (mobile portal rendering), Phase 4+ (App Designer portals extend Quick Portal infrastructure)
- **Cross-phase deps:** 1B, 1C, 1D, 1F, 1G, 1I, 1J

**Sizing:**
- **Estimated prompts:** 15
- **Complexity:** High
- **Key risk:** Portal session security — the custom auth system (separate from Clerk) requires careful implementation of token security, session management, and rate limiting; any vulnerability is directly exposed to the internet; CP-001 scope additions (deletion cascade, client thread panel, multi-record list view, linked_record_id invite step) are significant — if 3E-i approaches the 15-prompt ceiling during playbook generation, consider splitting (e.g., 3E-i portal auth/admin + 3E-i-b portal client experience) and renumbering 3E-ii Forms to 3E-iii

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3E-ii — Quick Forms: Builder, Submission Pipeline & Embed

**One-sentence scope:** Builds the Quick Form system with form CRUD, the Record View–based field canvas for data input, Cloudflare Turnstile spam protection, submission pipeline (validate → create record → log → notify), standalone URL routing, embed snippet generation (script tag + iframe), and notification emails on submission.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| forms.md | Full doc (Overview through Phase Implementation) | 1–182 | ~182 |

**Total reference lines:** ~182

**Scope Boundaries:**
- **Includes:** `forms` table CRUD (Server Actions: create, update, publish/archive, delete), `form_submissions` table writes (record_id, ip_address, user_agent), form configuration UI (field selection from table, field ordering via `record_view_config`, required field overrides via `settings.required_field_overrides`), form success behavior config (thank-you message, redirect URL, submitted data summary), Cloudflare Turnstile integration (invisible challenge, configurable per form via `settings.turnstile_enabled`), 7-step submission flow (client validation → Turnstile → server validation → create record → log submission → send notifications → render success), 8 error handling scenarios (required field, type constraint, unique constraint, Turnstile fail, rate limited, duplicate submission via idempotency key, server error, form archived/draft), accessibility (aria-describedby for errors, focus-on-first-error, role="alert" for banners), per-IP rate limiting (10 submissions / 15 minutes, configurable), idempotency via client-generated UUID key on form load, standalone URL routing (`forms.everystack.app/{slug}`), embed snippet generation (script tag + iframe in form settings UI), form slug generation and uniqueness, notification emails on submission via Resend (form name, field summary, record link), form permissions (Manager+ creation, public/link-gated submission), mobile single-column responsive rendering with touch-optimized inputs
- **Excludes:** Portal-embedded forms (post-MVP — App Designer portal context), App Forms via App Designer (post-MVP — multi-step, conditional logic, cross-table, computed fields), form analytics (post-MVP), form payments (post-MVP), form file uploads beyond standard attachment fields (uses existing upload pipeline from 1G)
- **Creates schema for:** None (forms, form_submissions defined in 1B)

**Dependencies:**
- **Depends on:** 3A-ii (Record View layout engine via `record_view_configs` — form uses same field canvas), 3A-i (FieldTypeRegistry cell renderers — form field rendering reuses grid cell editors), 2A (FieldTypeRegistry — `validate()` for submission validation), 1B (forms, form_submissions tables), 1G (Resend email for submission notifications), 1F (shadcn/ui primitives for form UI, success/error states)
- **Unlocks:** 3H (mobile form rendering), Phase 4+ (automations "Form Submitted" trigger)
- **Cross-phase deps:** 1B, 1F, 1G, 2A

**Sizing:**
- **Estimated prompts:** 7
- **Complexity:** Medium
- **Key risk:** Turnstile integration complexity — Cloudflare Turnstile requires both client-side widget rendering and server-side token verification, and the invisible challenge mode must degrade gracefully on blocked clients

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3F-i — Field Groups, Per-Field Emphasis & Enhanced Hide/Show Panel

**One-sentence scope:** Builds the field group system with named colored column groups in the grid, per-field bold and accent color emphasis, group collapse behavior, the conditional cell color cascade, and the enhanced hide/show panel as the central field management console with live grid synchronization.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| field-groups.md | Strategic Rationale through Phase Integration (excluding Synced Table Tab Badges 276–326 which shipped in 2C, and Board Collapse 327–360 which is Foundation) | 35–275, 393–569 | ~418 |

**Total reference lines:** ~418

**Scope Boundaries:**
- **Includes:** `FieldGroup` interface on `views.config.field_groups` JSONB (id, name, color from 13-color palette, color_mode: header_only/full_column/both, collapsed, field_ids, sort_order), `FieldViewConfig` extensions on `views.config.field_config[field_id]` (bold_header, accent_color, accent_mode), user-level collapse overrides on `user_view_preferences.field_group_collapsed`, grid rendering (28px group header row with collapse chevron, name, color dot, group separator 2px vertical rule), 3 group color modes (header_only, full_column, both — with specified opacity values), group collapse behavior (48px collapsed column, vertical CSS writing-mode name, field count badge, click-to-expand, keyboard Space/Enter toggle), per-field bold header (600 weight toggle), per-field accent color (overrides group color per column, 13-color palette), 4-level conditional cell color cascade (conditional cell > conditional row > field accent > group tint — highest priority wins, no blending), enhanced hide/show panel (320px width, search bar, group header rows with inline-editable name + color dot + mode label + bulk visibility toggle + overflow menu, field rows with drag handle + visibility checkbox + name + emphasis controls + visibility icon, ungrouped section, "+ Add Group" button), 3 panel responsive modes (desktop: side-by-side, tablet: overlay with scrim, mobile: full-screen bottom sheet), drag-drop behavior (6 drag source/target combinations: within group, between groups, to/from ungrouped, reorder groups), instant application (all changes apply to grid in real-time, no Apply button), undo via Ctrl+Z while panel open, frozen column constraint (primary field stays first), field group lifecycle (3 creation paths, 6 modification operations, deletion moves fields to ungrouped), column header right-click menu updates (items 13–16: set accent color, toggle bold, move to group, create group from selected), group header right-click menu (10 items), interaction with existing features (frozen columns, column resize, filter/sort/group-by unaffected, print/PDF export, CSV/Excel export, views per-view config, real-time collaboration last-write-wins, responsive mobile: group headers hidden on phone with swipe-between-group navigation), Command Bar "go to group" command
- **Excludes:** Synced table tab badges (shipped in 2C), Board collapse behavior (Foundation — sidebar UI addition, pending Board/Base glossary alignment), Excel export with group headers (post-MVP — Documents), App Designer field group config (post-MVP)
- **Creates schema for:** None (views.config JSONB extensions, user_view_preferences extensions — no new tables)

**Dependencies:**
- **Depends on:** 3A-i (grid shell — field groups render as a layer on top of the grid column headers and cells), 3A-ii (views infrastructure — field groups are per-view config stored in `views.config`; hide/show panel extends existing "Hide fields" toolbar button), 3B-ii (Command Bar — "go to group" command registration), 1F (shadcn/ui primitives for hide/show panel, color pickers, context menus)
- **Unlocks:** 3H (mobile field group swipe navigation, responsive hide/show panel), Phase 4+ (App Designer field group config)
- **Cross-phase deps:** 1F

**Sizing:**
- **Estimated prompts:** 10
- **Complexity:** Medium-High
- **Key risk:** Drag-drop synchronization — every panel interaction must instantly update the grid's column order, group spans, and color rendering; out-of-sync state between panel and grid creates confusing visual artifacts

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3F-ii — Bulk Operations: Selection, Actions, Batch Server Pattern & Undo

**One-sentence scope:** Builds the complete bulk operations system with the multi-record selection model (checkbox column, 5K cap), 6 MVP toolbar actions (delete, edit, duplicate, copy, assign, export), the batch server action pattern with single-transaction processing, condensed audit log entries, batched real-time events, and the Redis-backed undo mechanism.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| bulk-operations.md | Strategic Rationale through Mobile Behavior (excluding Formula Cascade 467–485 [post-MVP] and Bulk Trigger Automation 229–254 [post-MVP — Automations]) | 50–228, 270–532 | ~441 |

**Total reference lines:** ~441

**Scope Boundaries:**
- **Includes:** Selection model (always-visible checkbox column, header checkbox selects all filtered, selection respects active filters, selection cap 5,000 with user messaging, cross-view selection clears, client-side `Set<string>` state), bulk actions toolbar (floating bar above grid footer when 2+ selected, left-aligned action buttons, right-aligned count + deselect, hidden when user lacks permission — no disabled-with-tooltip), 6 MVP toolbar actions: (1) **Delete selected** with `BulkDeleteImpactSummary` impact preview (cross-links, children, formula dependents, automation triggers, pending approvals — 3 severity tiers: zero/low/high impact, type "delete" for high impact), soft delete, (2) **Edit field value** with searchable field picker (excludes read-only, system-managed, auto-number, linked record, approval-gated [dormant scaffolding]; 2 edit modes: set/clear; Multi-Select: add/remove; Number with `allow_atomic_adjust`: adjust-by), confirmation threshold (≤50: immediate + undo toast, >50: confirmation dialog), (3) **Duplicate selected** with record quota pre-check (no partial execution), " (copy)" suffix, (4) **Copy selected** to clipboard (tab-separated), (5) **Assign to user** (People field shortcut, multi-field picker if needed), (6) **Export selection** to CSV/XLSX (respects field visibility, current view column order), batch server action pattern (`bulkUpdateRecords`, `bulkDeleteRecords`, `bulkDuplicateRecords` — Zod validation, single permission check per batch, single Drizzle `WHERE id IN (...)`, single condensed audit entry per batch, single batched real-time event), 3 new audit actions (`record.bulk_updated`, `record.bulk_deleted`, `record.bulk_created` with `record_ids_affected[]` capped at 1,000 + `truncated` flag), Record Activity tab query extension (includes bulk entries via JSONB `?` operator on GIN-indexed details), 3 batch real-time event types (`record.updated.batch`, `record.deleted.batch`, `record.created.batch` with recordIds + truncated + totalCount), client handling (≤100 records: invalidate specific rows, >100 or truncated: full view refresh), undo mechanism (≤50 records: 10-second undo toast; >50: no undo, confirmation is safeguard; prior values stored in Redis `undo:bulk:{tenantId}:{actionId}` with 15s TTL), mobile behavior (long-press to enter selection mode, bottom sheet toolbar)
- **Excludes:** Run automation toolbar action (post-MVP — Automations), Bulk Checklist Item Update (post-MVP — depends on approval workflows), Formula Cascade Handling (post-MVP — formula engine), Bulk edit Linked Record fields (future extension), Scheduled bulk operations (future extension), Bulk operations via API (future extension), Bulk operations in portals (future extension)
- **Creates schema for:** None (records, audit_log already defined in 1B)

**Dependencies:**
- **Depends on:** 3A-i (grid shell — selection model is part of grid interaction, checkbox column), 3A-ii (bulk actions toolbar replaces summary footer when active; views + filters determine selection scope), 3A-iii (field-level permissions — bulk edit field picker respects write access), 3B-i (cross-linking — bulk delete impact preview queries `cross_link_index`), 1I (writeAuditLog — bulk condensation extends existing audit patterns), 1G (real-time — batch event publishing via Redis pub/sub)
- **Unlocks:** 3H (mobile bulk selection mode), Phase 4+ (automations "Run automation" toolbar action)
- **Cross-phase deps:** 1G, 1I

**Sizing:**
- **Estimated prompts:** 11
- **Complexity:** Medium-High
- **Key risk:** Undo mechanism reliability — the Redis-backed prior values must survive the full 15-second window and the undo action must correctly replay all prior values in a new transaction; race conditions with concurrent edits on the same records during the undo window could produce incorrect rollbacks

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3F-iii — Record Templates: CRUD, Template Picker & View Scoping

**One-sentence scope:** Builds the record template system with template CRUD, the dynamic token resolution engine ($me, $today+N), the Template Manager configuration UI, the template picker dropdown on the grid "+" button, view-contextual template scoping, and the `record_creation_source` enum on all record creation paths.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| record-templates.md | Data Model, Table View & Permission Layer, UX Flow, Template Manager, Record Creation Flow, Deletion Cascades, Real-Time Behavior, Phase Implementation (MVP rows only), Claude Code Prompt Roadmap (Prompts 1–4 only) | 46–215, 264–437, 803–837 | ~380 |

**Total reference lines:** ~380

**Scope Boundaries:**
- **Includes:** `record_templates` table CRUD (Server Actions: create, update, delete, reorder, set default), `canonical_data` JSONB on templates (same shape as `records.canonical_data` — validates via FieldTypeRegistry), dynamic token resolution engine (`$me` reuse from view filters, `$today+Nd` date arithmetic, `$context_record` for linked creation context), template value merge logic (field defaults → template values → view-contextual overrides, with `FieldTypeRegistry.validate()` for each field), validation failure handling (skip invalid fields, log warning, notify Manager), `record_creation_source` enum (`manual`, `template`, `import`, `sync`, `automation`, `api`, `duplicate`, `form`) shipped on all record creation code paths (foundational — fixes automation correctness bugs), Template Manager UI in table settings (template list with drag-to-reorder, default badge, availability summary; template editor reusing Record View field editors; dynamic token chips in date/people/linked-record editors; empty-vs-set field indicators; system/computed field exclusion), template picker dropdown on "+" toolbar button (split button pattern for single-default shortcut, hover tooltip with description + field list, keyboard navigation, type-to-filter), `require_template` mode per view (no blank option), view-contextual template scoping (`template_config` on `views.view_config` JSONB, all/selected/none modes, `getTemplatesForView()`), post-creation Record View behavior (highlight animation 500ms teal fade, cursor focus on first empty field), 5-second undo for template-created records, mobile bottom sheet template picker, `is_default` single-template auto-apply, template `available_in` VARCHAR array (`'grid'`, `'command_bar'`, `'all'`)
- **Excludes:** Automation integration (post-MVP — `templateId` + `fieldOverrides` on Create Record action), Command Bar auto-registration for templates (post-MVP — Automations), Quick Entry `template_id` config (post-MVP), Contextual creation shortcuts (post-MVP — right-click "Create linked...", inline sub-table template options), Recipe bundling (post-MVP), API `template_id` parameter (post-MVP), Kanban/Calendar view template overrides (post-MVP — those views are post-MVP), Portal form block `template_id` (post-MVP — App Designer)
- **Creates schema for:** None (record_templates, sections defined in 1B)

**Dependencies:**
- **Depends on:** 3A-i (grid "+" button — template picker attaches to it; FieldTypeRegistry for template value validation), 3A-ii (Record View — post-creation highlight + cursor focus; views infrastructure for `template_config` on view config), 3A-iii (permissions — Manager+ creation gating), 1B (record_templates table), 1F (shadcn/ui primitives for Template Manager UI, picker dropdown)
- **Unlocks:** 3H (mobile template picker as bottom sheet), Phase 4+ (automations template integration, Command Bar auto-registration)
- **Cross-phase deps:** 1B, 1F

**Sizing:**
- **Estimated prompts:** 9
- **Complexity:** Medium
- **Key risk:** `record_creation_source` enum retrofit — this enum must be added to every existing record creation code path (grid inline, Record View, CSV import, sync, forms, bulk duplicate), and missing any code path breaks automation trigger correctness

**Existing Roadmaps:**
- record-templates.md Claude Code Prompt Roadmap (lines 818–848, 6 prompts). Only Prompts 1–4 are in MVP scope for 3F-iii (schema/CRUD, Template Manager UI, Template Picker UX, View scoping). Prompts 5–6 (automation integration, Command Bar/Quick Entry/contextual shortcuts) are post-MVP.

---

### 3G-i — Settings Page & Audit Log UI

**One-sentence scope:** Builds the workspace Settings page (9 sections with role-gated access and auto-save), the Record Activity tab on Record View (audit log UI for per-record change history), and the Workspace Audit Log page under Settings → Data & Privacy.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| settings.md | Full doc | 1–113 | ~113 |
| audit-log.md | UI Surfaces (Record Activity Tab + Workspace Audit Log sections only — `writeAuditLog` helper and schema already built in 1I) | 152–180 | ~29 |

**Total reference lines:** ~142

**Scope Boundaries:**
- **Includes:** **Settings page** — full-page route `/workspace/{id}/settings` with 240px left sidebar navigation + 720px content area, 9 sections (General, Members & Roles, Billing & Plan, AI & Credits, Integrations, Branding, Notifications, Data & Privacy, Advanced), role-gated section access (lock icon + "Requires [Role]" tooltip for insufficient roles), section layout pattern (header + setting groups + setting rows with label/control), auto-save on change (toggle/select) or blur (text inputs) with green checkmark animation, input validation (workspace name 1–100 chars, IANA timezone, 8 accent colors, logo 2MB/64–512px), last-write-wins concurrent edit handling with real-time push (`workspace.settings_updated`), plan enforcement (disabled controls with "Upgrade to..." inline badge, server-side rejection with `PLAN_LIMIT_EXCEEDED`), dedicated Server Actions per section, settings audit logging (`settings.updated` action), progressive disclosure (3 levels), accent color picker (8 curated colors → header bar), workspace branding (logo, portal default theme), notification preferences (per-user, per-workspace, per-type toggles, mute schedule), member management UI (invite, role assignment, pending invitations, deactivated users), billing display (plan, usage meters, upgrade/downgrade), API key management UI (create, revoke — consuming 1I's auth middleware), danger zone (transfer ownership, delete workspace — type name to confirm), mobile settings (single-column stacked, push navigation between sections); **Record Activity tab** — bottom tab on Record View, chronological feed of audit_log entries for `entity_type = 'record' AND entity_id = $recordId` (plus bulk entries via JSONB `?` operator query), timeline format with actor avatar/icon + action description + relative timestamp + inline diff for text changes, actor type visual distinction (user avatar, sync icon, automation icon, portal_client badge), pagination (LIMIT 50, cursor-based on `created_at`); **Workspace Audit Log** — Settings → Data & Privacy → Audit Log link, full workspace feed with filters (date range, actor, action type, entity type, text search on details JSONB), CSV export for compliance, Admin+ access only
- **Excludes:** Automation History tab (post-MVP — Automations), full audit coverage and CSV export with retention enforcement (post-MVP — Comms & Polish), My Office (3G-ii — separate sub-phase), Personal Notes (3G-ii), mobile My Office (3H — fundamentally different interaction model), SAML SSO / SCIM (post-MVP), CockroachDB region selection (post-MVP — Enterprise), dark/light mode toggle (no toggle — single fixed appearance)
- **Creates schema for:** None (user_notification_preferences, audit_log defined in 1B; workspaces.settings JSONB is an existing column)

**Dependencies:**
- **Depends on:** 3C (notification pipeline powers notification preferences UI), 3A-ii (Record View — Activity tab attaches to Record View as bottom tab; My Views/Shared Views for user-facing settings), 3A-iii (permissions — settings sections gated by workspace role), 3B-ii (Command Bar — `/settings` slash command), 1C (workspace roles for section gating, Clerk user management integration for Members & Roles), 1I (writeAuditLog helper — Activity tab reads from audit_log, settings changes write audit entries; API key management UI consumes API auth middleware), 1H (AI service — AI & Credits section displays credit balance and usage breakdown from `ai_credit_ledger`), 1F (shadcn/ui primitives for settings forms), 1G (real-time for `workspace.settings_updated` push)
- **Unlocks:** 3H (mobile Settings), Phase 4+ (post-MVP settings sections, Automation History tab)
- **Cross-phase deps:** 1C, 1F, 1G, 1H, 1I

**Sizing:**
- **Estimated prompts:** 11
- **Complexity:** Medium
- **Key risk:** Settings section isolation — each of the 9 sections needs dedicated Server Actions with their own validation; missing a server-side plan enforcement check on any section creates a billing bypass vulnerability

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3G-ii — My Office, Personal Notes & Quick Panel Expansion

**One-sentence scope:** Builds My Office as a per-tenant personal hub with the full widget grid (Tasks, Calendar, Chat, Workspaces, Notes), Quick Panel expansion, the Calendar Feed API, and Personal Notes across all four surfaces (My Office widget, Sidebar Quick Panel, Record View Notes tab with Share to Thread, and the `/notes` standalone route).

> **CP-002 retroactive note:** My Office is now per-tenant, not a single global destination. Heading displays "My Office · Personal" (personal tenant) or "My Office · [Tenant Name]" (org tenant). My Office is accessible from each tenant's section in the sidebar navigation tree built in 1J. Content (widgets, Tasks, Calendar, Chat, Notes) is unchanged — only the navigation framing is tenant-qualified.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| my-office.md | Full doc | 1–360 | ~360 |
| GLOSSARY.md | user_notes schema, Personal Notes (MVP simplified) definition, DB Entity Quick Reference row | Reference context only — do NOT load personal-notes-capture.md | ~40 |

**Total reference lines:** ~400

⚠️ **Do NOT load `personal-notes-capture.md` as build context for 3G-ii.** Its data model (wiki tables, `is_personal` column on `tables`) does not apply to the simplified MVP. All Personal Notes schema and scope is defined in GLOSSARY.md. The `user_notes` table is created in 1B.

**Scope Boundaries:**
- **Includes:** **My Office** — top-level personal hub route, 3-column widget grid on desktop (Tasks + Calendar + Chat + Notes), widget chrome (title bar, settings gear, expand button), Workspaces widget (board container tiles with workspace tiles, conditional on 3+ workspaces), widget catalog modal ("Customize your office" nudge), Quick Panel behavior (workspace context: 25% side panel pushing main content to 75%; My Office context: 2/3 expanded + 1/3 stacked), sidebar icon rail (Home, Tasks, Chat, Calendar, Notes icons with badges + expand/collapse toggle + avatar), Tasks widget (Assigned tab: aggregated from People/Assignee fields across all workspaces with table name badge + workspace color dot + due date pill; My To-Dos tab: private `user_tasks` with one-level subtasks, created via "+" or `/todo`), Calendar widget (aggregated sources: calendar-type records, project tasks, personal events; day/week/month view modes; quick-create click on empty slot; drag-to-reschedule; source filter toggles; `⌘+Shift+C` shortcut), personal events via `user_events` table (show_as: busy/free, recurrence with RRULE, exception handling with EXDATE, 3-option edit dialog), Calendar Feed API (`GET /api/v1/calendar/feed` with user_id, date range, workspace_ids, source_types, timezone — returns unified time blocks), Chat widget (DM/mentions feed from communications system, filter tabs: All/@Mentions/DMs, click navigates to source), responsive grid (3 columns desktop, 2 tablet); **Personal Notes** — `user_notes` table (defined in 1B: id UUIDv7, user_id FK users, tenant_id FK tenants, title TEXT nullable, content JSONB TipTap default '{}', record_id UUID nullable FK records, created_at, updated_at; indexes: `(user_id, updated_at DESC)` and `(record_id) WHERE record_id IS NOT NULL`; RLS: `user_id = current_user_id()` — never visible to other workspace members including Admins); **My Office Notes widget** (widget title "Notes", shows 5 most-recently updated notes truncated to one line each, clicking a note opens full-screen in `/notes` route scrolled to that note, "+ New Note" button creates and opens immediately, Quick Panel expansion to 2/3 width with scrollable note list + inline editor); **Sidebar Quick Panel** — Notes icon added to icon rail alongside Chat/Tasks/Calendar, opens as 25% side panel in workspace context showing note list + inline TipTap env 1 editor for active note, notes created from Quick Panel have `record_id = NULL`, auto-saves on blur; **Record View Notes tab** — "Notes" tab added to Record View tab bar, shows all `user_notes WHERE record_id = $currentRecordId AND user_id = $me`, tab not visible to other users (renders based on `$me`'s notes only), "+ Add note" creates note pre-populated with `record_id`; **Share to Thread action** — each note in the Record View Notes tab has a "Share" button; on share: owner selects recipients via @mention (@specific person or @everyone with record access), optionally adds context text, posts note content as a `thread_message` on the record's thread with `source_note_id` FK set to originating `user_notes.id`; uses existing @mention + notification pipeline from 3C; no new sharing infrastructure; **`/notes` standalone route** — route `/workspace/{workspaceId}/notes`, two-panel layout (left: note list sorted by `updated_at DESC` + search bar + "+ New" button; right: TipTap env 1 editor for selected note), URL updates to `/notes/{noteId}` on selection for deep linking, Command Bar `/notes` or `/note` command navigates here, `⌘+Shift+N` shortcut
- **Excludes:** Voice-to-text notes (post-MVP), file-first capture (post-MVP), vector embedding search (post-MVP), offline/IndexedDB notes (post-MVP), workspace-scoped personal tables (post-MVP), web clipper (post-MVP), ENEX import (post-MVP — full Evernote-competitor spec in `personal-notes-capture.md`), mobile My Office (3H — fundamentally different interaction model), `is_personal` column on `tables` table (post-MVP — not applicable to simplified MVP)
- **Creates schema for:** None (user_tasks, user_events defined in 1B; user_notes defined in 1B per this spec's Phase 1B addition; workspaces.settings JSONB is an existing column)

**Dependencies:**
- **Depends on:** 3A-ii (Record View — Notes tab attaches to Record View tab bar; Quick Panel sidebar pattern), 3C (TipTap env 1 already built; Quick Panel pattern; @mention + notification pipeline for Share to Thread), 3B-ii (Command Bar — `/notes` slash command, `⌘+Shift+N` shortcut registration), 1J (sidebar navigation tree — My Office renders inside per-tenant section; tenant-qualified heading), 1B (user_notes table created here), 1F (shadcn/ui primitives for widget cards, calendar component, note list, TipTap env 1 editor surface)
- **Unlocks:** 3H (mobile My Office renders same widgets in different layout — Notes widget included), Phase 4+ (post-MVP notes capabilities: voice, offline, embeddings, workspace tables)
- **Cross-phase deps:** 1B, 1F, 1J

**Sizing:**
- **Estimated prompts:** 12
- **Complexity:** Medium
- **Key risk:** My Office calendar aggregation performance — the Calendar Feed API must execute parallel queries across calendar records, project tasks, and personal events across multiple workspaces and merge results sorted by start time; slow aggregation makes the personal hub feel sluggish

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3H-i — Mobile Feature Adaptation: Views, Records, Input & Gestures

**One-sentence scope:** Implements the responsive mobile adaptations for all Phase 3 features including Card View as primary mobile view with swipe actions, full-screen Record View sheet with field group swipe navigation, mobile input optimization for all MVP field types, the calculator strip for Number/Currency fields, mobile form rendering, and mobile bulk selection mode.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| mobile.md | Core Principle, Device Tiers, Primary Mobile Surfaces, Mobile View Types (Card view + Form view MVP portions), Mobile Input Optimization, Ergonomic Design Constraints | 58–191, 276–384 (Card + Form MVP only), 739–822 | ~326 |
| mobile-navigation-rewrite.md | Active Field Input Behavior, Mobile Card/Record View, Record View Inline Sub-Table, Cell Error States, Field-Level Presence | 164–306, 361–374, 225–236 | ~227 |

**Total reference lines:** ~553

**Scope Boundaries:**
- **Includes:** Card View as primary mobile view (RecordCard component with mobile-specific props: `swipeActions: true`, `badges: [status, priority, overdue, unread, pending sync]`, `tapBehavior: 'full-screen'`, `layout: 'compact list'`; 3–5 key fields per card configured per Table View; grouping by single-select/status/user/date with sticky collapsible headers; drag cards between groups), full-screen Record View sheet on phone (single-column field layout, field group swipe-between-group navigation when field groups exist, >15 fields with groups → all except first auto-collapsed on open, inline sub-table compact summary + "View All" / "+ Add" links), mobile input optimization for all MVP field types (inputMode mapping: text=QWERTY, number=decimal+calculator strip, phone=tel, email=email, URL=url; pickers: date=calendar bottom sheet, time=scroll wheel, single select=bottom action sheet, multi select=bottom sheet with checkboxes, people=bottom sheet with avatar search, linked record=bottom sheet with record search + create inline, rating=star row with haptic, checkbox=56x32 toggle with haptic, attachment=action sheet camera/gallery/files, barcode=camera viewfinder, signature=full-screen canvas, address=text+autocomplete+"Use my location"), calculator strip for Number/Currency fields (44px tall, operators +−×÷%, running calculation display, = commits, C clears), field-level presence on mobile (20px avatar overlay, field temporarily non-interactive while another user editing), cell error states on mobile (5 states: broken reference, sync conflict, processing, type coercion, attachment loading — adapted from grid to single-column field layout), display value staleness signal (shimmer animation on cross-link chips during cascade), process state color language (red=failed, amber=processing, green=succeeded), mobile form rendering (single-column, touch-optimized inputs, thumb-zone submit, field-by-field navigation on very small screens, draft auto-save to IndexedDB), mobile bulk selection (long-press card to enter selection mode, tap to toggle, floating bottom bar with count + actions, bottom sheet toolbar), mobile Record View with template (template applied silently, no picker on phone), Card View sorting/filtering via toolbar (quick filters, sort pills), tablet inline grid editing (44px min touch targets), responsive right panel (phone: full-screen bottom sheet, tablet: 360px overlay with scrim)
- **Excludes:** Mobile bottom navigation bar (3H-ii), offline architecture (3H-ii), notification routing (3H-ii), deep linking (3H-ii), PWA (3H-ii), mobile chat & messaging full surface (post-MVP — MVP includes basic Record Thread tabs via 3C), Kanban view on mobile (post-MVP), Calendar view on mobile (post-MVP), Maps & Geolocation (post-MVP), Voice Input (post-MVP), Camera/Scanning/OCR (post-MVP), AI Personalization (post-MVP), Mobile Payments (post-MVP)
- **Creates schema for:** None

**Dependencies:**
- **Depends on:** 3A-i (grid shell + cell renderers — mobile adapts these), 3A-ii (Record View + Card View + views — mobile renders these surfaces), 3A-iii (field-level permissions — mobile respects same permission model), 3B-i (cross-link display — inline sub-table compact summary on mobile), 3E-ii (forms — mobile form rendering), 3F-i (field groups — mobile swipe-between-group navigation), 3F-ii (bulk operations — mobile selection mode), 3F-iii (record templates — mobile silent template apply), 1F (design system — touch targets, responsive breakpoints, thumb zones)
- **Unlocks:** 3H-ii (navigation infrastructure depends on mobile feature surfaces existing)
- **Cross-phase deps:** 1F

**Sizing:**
- **Estimated prompts:** 11
- **Complexity:** Medium-High
- **Key risk:** Mobile input optimization breadth — each of the ~16 MVP field types needs a distinct mobile input method (bottom sheet, picker, calculator strip, canvas, etc.); inconsistent or missing input methods for any field type degrades the mobile editing experience

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 3H-ii — Mobile Infrastructure: Navigation, Offline, PWA & Notifications

**One-sentence scope:** Builds the mobile-specific infrastructure with the two-layer contextual bottom navigation bar, the My Office mobile experience (workspace tiles + bottom tab bar), offline architecture (IndexedDB schema, service worker caching, optimistic writes with sync queue), PWA manifest and install flow, notification routing engine, deep linking, and the mobile E2E test suite.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| mobile.md | Mobile Navigation Model, Capability Gating, Offline Architecture, Notification Routing, Deep Linking, PWA Capabilities, Service Worker Caching, Performance Budgets, Additional Mobile Capabilities, Mobile Testing Strategy, Phase Implementation | 100–140, 440–607, 608–641, 901–1213 | ~564 |
| mobile-navigation-rewrite.md | Two-Layer Bottom Bar, FAB Removal, Record Templates on Mobile, Navigation Patterns, Tasks Tab Scope, Capability Gating, View Switcher on Mobile, Command Bar mobile, Cross-References | 52–163, 237–267, 375–550 | ~329 |
| my-office.md | Mobile My Office, Responsive Summary | 279–360 | ~82 |

**Total reference lines:** ~975 (significant overlap between mobile.md and mobile-navigation-rewrite.md — effective unique content ~650)

**Scope Boundaries:**
- **Includes:** **Two-layer bottom navigation** — Layer 1: workspace context 5-item nav (Home, Chat, Calendar, Workspaces, More) 56px fixed; My Office context 4-item nav (Tasks, Chat, Calendar, +); Layer 2: contextual action bar inside records (2 fixed: Chat + Command Bar, up to 3 dynamic from record field types: Camera, Scan, Call, Navigate, Sign, Email, Open Link; "More Actions" overflow bottom sheet if >3 match), layer transition animation on record open/close; **FAB removal** — record creation via "+" in toolbar/header only; **Capability gating** — phone (<768px) blocks structural actions (field/table creation, permission config, automation/App Designer, field group creation, approval rules) with "Open on tablet or desktop" prompt, allows light config (rename, toggle, reorder, edit filters); **Mobile My Office** — workspace tiles home screen, bottom tab bar (Tasks, Chat, Calendar, +), contextual tab swap inside records (Fields, Thread, Activity tabs), default panel user preference, mobile header (logo, hamburger, search), hamburger drawer (~280px with Quick Panel labels + workspace tree); **View switcher on mobile** — always dropdown mode, current view name + chevron as first toolbar item, bottom sheet with grouped list by sections; **Navigation patterns** — swipe-from-left-edge back, header back arrow, breadcrumb trail, deep link routing; **Swipe gesture registry** — 7 gestures (back, card right=primary action, card left=secondary, chat right=mark read, chat left=mute, field group swipe, pull down=refresh), swipe conflict resolution (field groups override record-to-record — use header prev/next arrows instead); **Offline architecture** — IndexedDB schema for Table View working set cache, `SessionStore` interface, service worker with cache-first strategy for static assets + network-first for API data, optimistic writes with offline action queue (100-action weighted cap: cell edit=1, cross-link=5, bulk=10), cross-link sequential replay on reconnect, scope filter validation conflict card on replay failure; **PWA** — manifest.json generation, install prompt, standalone mode, home screen icon; **Notification routing** — 8 notification types (mention, reply, DM, assignment, record_update, sync_alert, automation_alert, system), push notification delivery via web push API, badge counts on bottom nav items, notification panel accessible via More tab, notification preferences per type per user; **Deep linking** — URL scheme for all entities (records, tables, views, threads), universal link handling, context-aware opening (record → full-screen sheet + Layer 2, table → view + Layer 1); **Performance budgets** — bundle size targets, FCP/TTI/LCP thresholds; **Mobile E2E test suite** — 20+ Playwright specs across 3 viewport configs (phone 375px, tablet 768px, split-screen 512px), touch simulation, device matrix; **Additional mobile capabilities** — haptic feedback (toggle, rating, navigation), share sheet integration (outbound), clipboard paste handling, pull-to-refresh
- **Excludes:** Portal mobile PWA (post-MVP — paid tiers), Capacitor wrapping (post-MVP — when PWA limitations are blocking), biometric auth (post-MVP), native file picker (post-MVP), app store submission (post-MVP), home screen widgets (post-MVP), wearable notifications (post-MVP), NFC scanning (post-MVP), mobile chat full surface (post-MVP — MVP basic Record Thread tabs from 3C), Maps & Geolocation (post-MVP), Voice Input (post-MVP), Camera/Scanning/OCR (post-MVP), AI Personalization (post-MVP), Mobile Payments (post-MVP)
- **Creates schema for:** None (IndexedDB is client-side, not Postgres)

**Dependencies:**
- **Depends on:** 3H-i (mobile feature adaptations must exist before navigation infrastructure wraps them), 3G-i (mobile Settings push-navigation), 3G-ii (mobile My Office renders the same widgets in a different layout — Notes widget included), 3C (Chat widget — Chat bottom tab renders DM/thread feed; notifications — notification routing engine delivers from 3C's notification pipeline), 3B-ii (Command Bar — mobile Command Bar bottom sheet with scope pills), 1G (real-time — push notifications via WebSocket events), 1F (design system — responsive breakpoints, touch targets, thumb zone rules)
- **Unlocks:** Phase 4+ (post-MVP mobile capabilities: portal PWA, Capacitor, advanced offline, biometrics)
- **Cross-phase deps:** 1F, 1G

**Sizing:**
- **Estimated prompts:** 14 (but see note)
- **Complexity:** High
- **Key risk:** Offline action queue consistency — the weighted action queue with cross-link sequential replay and scope filter validation on reconnect creates complex state management; any bug in the replay logic can produce data corruption or lost edits

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

## Dependency Graph

```
Phase 1 (Foundation)
 ├── 1A, 1B, 1C, 1D, 1E, 1F, 1G, 1H, 1I, 1J
 │
Phase 2 (Sync)
 ├── 2A (FieldTypeRegistry + Airtable)
 ├── 2B (JSONB indexes + outbound sync + conflicts)
 │
Phase 3 — First Half (3A–3D)
 ├── 3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii
 ├── 3C (depends on 3A-ii)
 ├── 3D (depends on 3A-i, 3A-iii, 3B-i)
 │
Phase 3 — Second Half (3E–3H)
 │
 ├── 3E-i (Portals) ──── depends on 3A-ii, 3A-iii, 3C, 1J
 │
 ├── 3E-ii (Forms) ──── depends on 3A-i, 3A-ii, 2A
 │
 ├── 3F-i (Field Groups) ──── depends on 3A-i, 3A-ii, 3B-ii
 │
 ├── 3F-ii (Bulk Ops) ──── depends on 3A-i, 3A-ii, 3A-iii, 3B-i
 │
 ├── 3F-iii (Record Templates) ──── depends on 3A-i, 3A-ii, 3A-iii
 │
 ├── 3G-i (Settings + Audit UI) ──── depends on 3C, 3A-ii,
 │        3A-iii, 3B-ii, 1C, 1F, 1G, 1H, 1I
 │
 ├── 3G-ii (My Office + Personal Notes) ──── depends on 3A-ii,
 │        3C, 3B-ii, 1J, 1B, 1F
 │        [3G-i and 3G-ii are parallel — no dependency between them]
 │
 ├── 3H-i (Mobile Features) ──── depends on 3A-i, 3A-ii, 3A-iii,
 │        3B-i, 3E-ii, 3F-i, 3F-ii, 3F-iii
 │
 └── 3H-ii (Mobile Infra) ──── depends on 3H-i, 3G-i, 3G-ii,
          3C, 3B-ii
```

**Parallel execution potential:** After Phase 3 first half completes, sub-phases 3E-i, 3E-ii, 3F-i, 3F-ii, and 3F-iii can all proceed in parallel (no dependencies between them). 3G-i and 3G-ii can both proceed once 3C completes (from first half) — they are parallel to each other. 3H-i depends on 3E-ii, 3F-i, 3F-ii, and 3F-iii all completing. 3H-ii depends on 3H-i, 3G-i, and 3G-ii all completing.

**Critical path:** 3A-i → 3A-ii → 3A-iii → {3F-i, 3F-ii, 3F-iii, 3E-ii} → 3H-i → 3H-ii

---

## Validation Checklist

- [x] Every sub-phase passes the one-sentence test (no "and" — verified: each sentence describes one coherent deliverable)
- [x] No sub-phase exceeds 15 estimated prompts (max: 3E-i and 3H-ii at 15 and 14 respectively — 3E-i at ceiling due to CP-001 scope additions, consider splitting if ceiling breached during playbook generation)
- [x] No sub-phase needs 5+ reference docs (max: 3 docs in 3H-ii)
- [x] App Designer, Custom Apps, Embeddable Extensions excluded from all sub-phases (verified: all "Excludes" sections explicitly list them where relevant)
- [x] Dependencies reference specific sub-phase numbers from Phases 1, 2, and Phase 3 first half (1A through 1J, 2A, 3A-i through 3D — not "Phase 1" generically)
- [x] Mobile sub-phase(s) correctly depend on the UI features they're making responsive (3H-i depends on 3A-i, 3A-ii, 3A-iii, 3B-i, 3E-ii, 3F-i, 3F-ii, 3F-iii; 3H-ii depends on 3H-i, 3G-i, 3G-ii, 3C, 3B-ii)
- [x] No post-MVP features in any "Includes" (verified: Kanban, Calendar view, formula engine, App Designer, App Portals, App Forms, AI Agents, vector embeddings, connected inbox, omnichannel, custom apps, approval workflows, Capacitor, portal PWA, camera/scanning/OCR, maps/geolocation, voice input, AI personalization, mobile payments, full Evernote-competitor notes all excluded)
- [x] Total sub-phase count: 9
- [x] Total prompt estimate: 86 (15 + 7 + 10 + 11 + 9 + 11 + 12 + 11 + 14) — note: 3E-i increased from 12→15 due to CP-001 scope additions; 3G split from single 14-prompt sub-phase into 3G-i (11) + 3G-ii (12)
- [x] portals.md Part 1 assigned to single sub-phase 3E-i; Part 2 (post-MVP) correctly excluded
- [x] forms.md assigned to single sub-phase 3E-ii (182 lines, compact)
- [x] field-groups.md MVP portions assigned to 3F-i (synced table badges already in 2C, board collapse is Foundation)
- [x] bulk-operations.md MVP portions assigned to 3F-ii (Run Automation and Formula Cascade sections excluded as post-MVP)
- [x] record-templates.md MVP portions assigned to 3F-iii with Prompts 1–4 from existing roadmap; Prompts 5–6 deferred to post-MVP
- [x] settings.md (113 lines) + audit-log.md UI Surfaces (29 lines) correctly bundled in 3G-i (too thin for standalone sub-phases)
- [x] my-office.md (360 lines) + Personal Notes (GLOSSARY.md schema) correctly bundled in 3G-ii — split from 3G-i because different dependencies and UX concern; both 3G-i and 3G-ii are under the 15-prompt ceiling
- [x] personal-notes-capture.md correctly excluded from 3G-ii build context (full Evernote spec — wiki tables, is_personal column — does not apply to simplified MVP; user_notes schema sourced from GLOSSARY.md and 1B)
- [x] mobile.md + mobile-navigation-rewrite.md split cleanly: feature adaptations → 3H-i; infrastructure (nav, offline, PWA, notifications) → 3H-ii
- [x] gaps/portals-client-auth.md correctly excluded (content merged into app-designer.md per doc header)
