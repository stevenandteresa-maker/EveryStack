# Change Proposal Impact Map — Phase Division Updates

> Source: CP-001 (Portal Architecture) + CP-002 (Multi-Tenant Identity, Agency, Navigation)
> Purpose: Checklist for updating phase division docs + dependency graph
> Reality check: Phases 1A–1H are already built and merged to main (v0.1.6-phase-1g + 1H PR merged)

---

## Critical Context: Retroactive Changes

CP-001 and CP-002 introduce schema changes, middleware changes, and new UX scope that were decided *after* Phases 1A–1H shipped. These cannot be retrofitted into the already-merged 1B/1C sub-phases. They must be:

1. **Front-loaded as a migration + middleware update** at the start of whatever builds next (likely before Phase 2 or as a new bridging sub-phase)
2. **Absorbed into downstream sub-phases** where the UX/feature work naturally lives

This impact map identifies WHAT changed. The WHERE (new sub-phase vs. expansion of existing) is a decision to make during the edits.

---

## 1. Schema Changes (affects: phase-division-phase1.md → 1B)

Covers CP-001 additions to existing tables, CP-002 additions, Implementation note.
Touches `portal_access`, `tenant_relationships`, `effective_memberships` tables.

### CP-001 additions to existing tables

| Table | Change | Type |
|-------|--------|------|
| `portals` | `UNIQUE (slug)` → `UNIQUE (tenant_id, slug)` | Constraint change |
| `portal_access` | + `revoked_at TIMESTAMPTZ` | New column |
| `portal_access` | + `revoked_reason VARCHAR` | New column |
| `portal_access` | + `record_slug VARCHAR` + `UNIQUE (portal_id, record_slug)` | New column + constraint |
| `portal_access` | + `linked_record_id UUID FK → records(id)` | New column |
| `threads` | DROP `visibility`, ADD `thread_type VARCHAR` + `UNIQUE (scope_type, scope_id, thread_type)` | Column replace + constraint |

**Net effect on 1B:** portal_access gains 4 columns (was 9, now 13). threads column count unchanged (drop 1, add 1) but gains a constraint. portals gains a constraint change.

### CP-002 additions

| Table | Change | Type |
|-------|--------|------|
| `users` | + `personal_tenant_id UUID FK → tenants` | New column |
| `workspaces` | + `transferred_from_tenant_id UUID FK → tenants` | New column |
| `workspaces` | + `original_created_by_tenant_id UUID FK → tenants` | New column |
| `tenant_relationships` | Entirely new table (~14 columns) | **New table** |
| `effective_memberships` | New database view (union of tenant_memberships + tenant_relationships) | **New view** |

**Net effect on 1B:** Table count increases from 51 → 52 (+ tenant_relationships). New DB view. users gains 1 column. workspaces gains 2 columns (was 11, now 13).

### Implementation note

Since 1B is already merged, these changes ship as a **migration in the next build phase**, not as a 1B retroactive edit. The 1B sub-phase description in the phase division doc should be updated to reflect the *final* schema (including CP changes), with a note that CP-001/CP-002 columns ship as a separate migration.

---

## 2. Auth Middleware (affects: phase-division-phase1.md → 1C)

### CP-002 changes

| Change | Detail |
|--------|--------|
| Replace `tenant_memberships` query with `effective_memberships` view | All auth resolution goes through the unified view |
| Add tenant-switching stub | Clerk `setActive()` + Redis cache hybrid |
| Recognise `tenant_relationships` as valid access grant | Synthesised role derivation for agency members |
| Personal tenant auto-provisioning | Clerk `user.created` webhook now also creates a personal tenant |

**Net effect on 1C:** Scope expansion. The one-sentence scope, includes list, and estimated prompts need updating. Since 1C is already built, this is a surgical retroactive update — the phase division doc should note the CP-002 middleware update as a pre-requisite migration.

---

## 3. Record Thread Model (affects: phase-division-phase3-part1.md → 3C)

### CP-001-D changes

| Current 3C scope | New 3C scope |
|------------------|--------------|
| Single thread per record with `visibility` column | Two separate threads per record: internal + client |
| Thread visibility toggle | `thread_type` discriminator, no toggle |
| — | Record View shows both threads as tabs: "Team Notes" (internal) + "Client Messages" (client) |
| — | Client Messaging toggle in portal settings (creates client thread on enable) |
| — | Client thread notification email via Resend (MVP scope — without it, client has no way to know a reply was posted) |
| — | Persistent indicator when composing in client thread ("this message is client-visible") |

**Net effect on 3C:**
- **Scope increase:** Two-thread model is architecturally simpler (no visibility toggle bugs) but adds UX surface (tab pattern in Record View, client thread notification email, client-visible indicator).
- **Prompt estimate:** May increase by 1–2 prompts. Current estimate is 15 (already at ceiling). **May need to split 3C** or move client thread notification email to 3E-i (portals).
- **Includes list:** Needs rewrite of thread model description. Remove `visibility` column references. Add two-thread model, tab pattern, client thread notification, composer indicator.
- **Excludes list:** Add "Client thread designated-rep model (post-MVP — Manager assigns specific participants)".

---

## 4. Quick Portals (affects: phase-division-phase3-part2.md → 3E-i)

### CP-001-A,B,E,F changes

| Change | Impact on 3E-i |
|--------|---------------|
| **CP-001-A** Tenant-scoped slugs | Portal route group changes from `(portal)/portal/[portalSlug]/` to `(portal)/portal/[tenantSlug]/[portalSlug]/`. Slug uniqueness enforcement scoped to tenant. URL display in admin panel updated. |
| **CP-001-B** Record deletion cascade | New scope: warn-then-cascade flow on record deletion (modal warning, soft revocation, graceful "no longer available" page). Revoked clients display in admin panel Clients tab. Audit log for cascade revocation with `actor_type = "system"`. |
| **CP-001-D** Client thread in portal | New scope: portal renders client thread messaging panel when Client Messaging is enabled. Client Messaging on/off toggle in portal settings. Portal client can read/write client thread messages. |
| **CP-001-E** Multi-record list view | New scope: list page when client has access to multiple records (conditional: 1 record → direct, multiple → list). Summary field picker in portal settings (max 3 fields). `record_slug` generation on portal_access creation. URL structure with `/{record-slug}`. |
| **CP-001-F** linked_record_id | New scope: optional linking step in portal client invite flow. Autocomplete search on workspace tables. Can skip. |

**Net effect on 3E-i:**
- **Significant scope increase.** CP-001-B (deletion cascade), CP-001-D (client thread), and CP-001-E (list view) each add meaningful feature work.
- **Prompt estimate:** Current is 12. Will likely increase to 14–15 or **may need splitting** (e.g., 3E-i portal auth/admin + 3E-ii portal client experience, pushing current 3E-ii Forms to 3E-iii).
- **Includes list:** Needs additions for tenant-scoped slugs, warn-then-cascade, revoked client display, client thread panel, Client Messaging toggle, list view, summary fields, record_slug, linked_record_id invite step.
- **Dependencies:** May add dependency on 3C (client thread uses communications infrastructure).

---

## 5. Navigation, Sidebar Tree, Tenant Switching, Agency Console (affects: NEW SCOPE — not in any current sub-phase)

### CP-002 UX deliverables with no current home

| Deliverable | Scope | Size estimate |
|-------------|-------|---------------|
| **Sidebar navigation tree** | Collapsible tenant sections, workspace tree, My Office per tenant, portal section divider | Medium-Large |
| **Tenant switcher** | Clerk `setActive()` + Redis, optimistic UI shell repaint, error recovery | Medium |
| **Shell accent colouring** | `--shell-accent` per-tenant CSS token, shell repainting on switch, portal accent (system-owned) | Small-Medium |
| **Contextual clarity signals** | Three mandatory layers (sidebar header, shell colour, My Office heading), personal tenant fixed warm neutral | Small |
| **Portal display in sidebar** | Authenticated portal entries below "Portals" divider, distinct icon + system colour, no shell repaint on portal entry | Small |
| **Agency Console** | `/agency` route, portfolio view, context switch, client onboarding, relationship management, billing | Large (post-MVP?) |
| **"Acting as Agency" banner** | Non-dismissible shell-level persistent banner when operating in client tenant | Small |

**Key question:** Is the Agency Console MVP or post-MVP? CP-002 lists it in Implementation Order Step 7 but doesn't explicitly label it MVP/post-MVP. The sidebar tree and tenant switching are clearly needed for the multi-tenant identity model to function. The Agency Console could potentially be deferred.

**Options for placement:**
1. **New sub-phase** (e.g., "1J" or "2-Pre" or "3-Pre") — sidebar tree + tenant switching + shell accent as a standalone sub-phase before Phase 3 Core UX begins, since the sidebar is the navigation shell for everything
2. **Expand 1F** (retroactive) — the shell layout was built in 1F; the sidebar tree is a shell redesign. But 1F is already merged.
3. **Expand 3G-ii** — My Office is already here, and the sidebar tree directly wraps My Office. But 3G-ii is late in Phase 3 (depends on 3C, 3B-ii). The sidebar tree should exist much earlier.
4. **Split from 3G-ii into an earlier sub-phase** — extract sidebar/navigation into a new sub-phase that can run earlier in Phase 3 (after 1F + 1C are updated).

**Recommendation:** New sub-phase for sidebar tree + tenant switching + shell accent. It blocks all other Core UX sub-phases (they render inside the sidebar tree). Agency Console deferred to post-MVP or a late Phase 3 sub-phase.

---

## 6. Cross-Linking Enforcement (affects: phase-division-phase3-part1.md → 3B-i)

### CP-002 cross-tenant linking prohibition

| Change | Impact on 3B-i |
|--------|---------------|
| Cross-tenant linking permanently forbidden | 3B-i creation constraints must add 3-layer enforcement: DB FK constraints prevent cross-tenant links, API validates `workspace.tenant_id` matches on both sides, Link Picker never surfaces workspaces outside current tenant context |

**Net effect on 3B-i:** Minor scope addition. The creation constraints section already exists — this adds a specific constraint rule. 1–2 sentences in Includes, no prompt estimate change.

---

## 7. Design System Tokens (affects: phase-division-phase1.md → 1F)

### CP-002 token additions

| Change | Impact on 1F |
|--------|-------------|
| `--shell-accent` per-tenant colour token | New CSS custom property, part of the three-layer color architecture |
| Portal accent colour token (system-owned) | Fixed colour, not customisable by tenants |
| Shell repainting behaviour on tenant switch | CSS transition / class swap mechanism |

**Net effect on 1F:** Since 1F is already built, these tokens ship with the sidebar tree implementation (wherever that lands). The 1F phase division description should note the CP-002 token additions were deferred to the navigation sub-phase.

---

## 8. My Office (affects: phase-division-phase3-part2.md → 3G-ii)

### CP-002 changes

| Change | Impact on 3G-ii |
|--------|----------------|
| My Office is now per-tenant | Heading changes: "My Office · Personal" vs "My Office · [Tenant Name]" |
| My Office accessible from sidebar tree per tenant section | Navigation model changes — My Office is under each tenant node, not a single global destination |

**Net effect on 3G-ii:** Minor scope adjustment. My Office content (widgets, Tasks, Calendar, Chat, Notes) is unchanged. The framing is now tenant-qualified. If the sidebar tree is built in an earlier sub-phase, 3G-ii just renders inside it.

---

## 9. Automations (affects: phase-division-phases4-6.md → 4A/4B)

### CP-001-C confirmation

No change to 4A or 4B scope. `record.updated` already fires on portal write-backs. Add a confirmatory note in 4B Includes: "Portal write-backs fire `record.updated` — no separate trigger required (CP-001-C)."

---

## 10. Dependency Graph & Appendices (affects: dependency-graph-and-appendices.md)

### Changes needed

| Section | Change |
|---------|--------|
| Table count | 51 → 52 (+ tenant_relationships) |
| Schema Creation DAG | tenant_relationships is Tier 1 (depends on tenants, users). effective_memberships view depends on tenant_memberships + tenant_relationships. |
| portal_access column count | 9 → 13 |
| threads column description | visibility → thread_type |
| users column count | 7 → 8 |
| workspaces column count | 11 → 13 |
| New sub-phase (if added) | Insert into dependency graph with correct edges |
| Critical path | Re-evaluate if new sub-phase is inserted early |
| Appendix A | Reference doc loading — add `navigation.md` (new doc from CP-002) |

---

## 11. Dependency Map (affects: dependency-map.md)

### Changes needed

| Section | Change |
|---------|--------|
| §1.1 MVP Table Inventory | Add row for `tenant_relationships`. Update column counts for users, workspaces, portal_access, threads. Add effective_memberships view. |
| §1.2 Schema Creation DAG | Add tenant_relationships to Tier 1. Add effective_memberships note. |
| §2 Doc-Level Dependency Graph | Add `navigation.md` entry. Update `portals.md` and `communications.md` entries to reflect CP changes. |
| §3 Cross-Cutting Concerns | §3.4 Permission Model — note effective_memberships as auth resolution source |
| §4 Phase Boundary Analysis | Note CP-001/CP-002 as retroactive changes to already-shipped phases |

---

## Summary: Files to Edit

Consolidated edit list, decisions made (1J sub-phase creation, Agency Console deferral), the full 1J sub-phase definition, and updated project totals (35 sub-phases, 346 prompts). Relates to all five phase-division docs and `dependency-graph-and-appendices.md`.

| File | Sub-phases affected | Severity |
|------|-------------------|----------|
| `phase-division-phase1.md` | 1B (schema counts), 1C (middleware scope) | MEDIUM |
| `phase-division-phase3-part1.md` | 3C (thread model rewrite) | HIGH |
| `phase-division-phase3-part2.md` | 3E-i (portal scope expansion), 3G-ii (My Office per-tenant) | HIGH |
| `phase-division-phases4-6.md` | 4B (confirmatory note) | LOW |
| `dependency-graph-and-appendices.md` | Counts, new table, possible new sub-phase | MEDIUM |
| `dependency-map.md` | Table inventory, DAG, doc graph | MEDIUM |
| **NEW: sub-phase for sidebar/navigation/tenant-switching** | Needs to be defined | HIGH |

### Decisions Made

**Sidebar tree / tenant switching / shell accent → New sub-phase 1J (Option A)**

A new bridging sub-phase **1J** bundles CP-001/CP-002 schema migration + 1C middleware update + sidebar navigation tree + tenant switching + shell accent colouring. Sits between Phase 1 (complete) and Phase 2 (not started). All its Phase 1 dependencies are already merged.

**Agency Console → Post-MVP**

The Agency Console (`/agency` route), "Acting as Agency" banner, workspace transfer UI, white-label mode, and agency onboarding flows are all deferred to post-MVP. The `tenant_relationships` table and `effective_memberships` view are created now as forward-infrastructure.

### New Sub-Phase Definition: 1J

**1J — Change Proposal Migration, Multi-Tenant Auth & Navigation Shell**

**One-sentence scope:** Applies CP-001/CP-002 schema migrations (portal refinements + multi-tenant identity tables), updates the auth middleware to query the `effective_memberships` view with tenant-switching support, and builds the multi-tenant sidebar navigation tree with per-tenant shell accent colouring and portal display.

**Includes:**
- CP-001 schema migration (portals constraint change, portal_access +4 columns, threads visibility→thread_type, new constraints)
- CP-002 schema migration (users.personal_tenant_id, workspaces +2 transfer columns, tenant_relationships table, effective_memberships view)
- Auth middleware update (swap tenant_memberships → effective_memberships, Clerk setActive() + Redis tenant-switch stub, personal tenant auto-provisioning on user.created webhook)
- Sidebar navigation tree (collapsible tenant sections, workspace tree per tenant, My Office entry per tenant, portal section divider)
- Tenant switching UX (Clerk setActive() + Redis hybrid, optimistic shell repaint, error recovery toast)
- Shell accent colouring (--shell-accent per-tenant CSS token, portal accent token system-owned, shell repainting on switch)
- Contextual clarity signals (three mandatory layers: sidebar header, shell colour, My Office heading)
- Portal display in sidebar (authenticated portal entries below "Portals" divider, distinct icon + system colour, no shell repaint on portal entry)

**Excludes:**
- Agency Console /agency route (post-MVP)
- "Acting as Agency" banner (post-MVP)
- Workspace transfer UI (post-MVP — schema stubs only)
- White-label mode (post-MVP)
- Agency onboarding flows (post-MVP)
- Client onboarding via agency (post-MVP)

**Dependencies:**
- Depends on: 1A, 1B, 1C, 1F (all already merged)
- Can run in parallel with 1I (no dependency between them)
- Unlocks: Phase 2 (correct multi-tenant foundation), all Phase 3 sub-phases (Core UX renders inside sidebar tree)

**Reference docs:** navigation.md (new), data-model.md, permissions.md, design-system.md

**Estimated prompts:** 11
**Complexity:** Medium-High

### Updated Totals

| Metric | Before | After |
|--------|--------|-------|
| Total sub-phases | 34 | 35 |
| Total estimated prompts | 332 | 346 |
| Phase 1 sub-phases | 9 | 10 |
| Phase 1 prompts | 75 | 86 |
| Phase 3 Part 2 prompts | 83 | 86 |
