# CP-002 — Multi-Tenant Identity, Agency Model & Navigation Architecture

| Field | Value |
|-------|-------|
| **Status** | APPLIED |
| **Date** | 2026-03-05 |
| **Phase Impact** | Phase 1C (auth middleware), Phase 1G+, all subsequent phases touching auth or navigation |
| **Origin** | Architecture review session |
| **Depends On** | CP-001, Phase 1C Auth Layer, Phase 1F Design System |
| **Reference Docs Updated** | 2026-03-05 (last conversation) |

---

## 1. Overview

Three interrelated architectural changes that must be implemented as a coordinated unit. They cannot be decoupled: the identity model informs the navigation model, the navigation model exposes the agency model, and the agency model depends on correct identity resolution.

1. **Multi-Tenant Identity** — How a user's platform identity relates to one or many tenant memberships, including auto-provisioned personal tenants and workspace portability.
2. **Agency Model** — Formal tenant-to-tenant relationships enabling one business (Agency) to manage workspaces on behalf of another (Client), with clean access delegation and revocation.
3. **Navigation Architecture** — The sidebar tree, tenant switcher, My Office model, and portal display that surface the above to users.

---

## 2. Blast Radius

| Document / Component | Impact | Change Required |
|---|---|---|
| `data-model.md` | HIGH | Add new table, columns, and view definitions. Update ER diagram. |
| `permissions.md` | HIGH | Document `effective_memberships` view as the single auth resolution source. Add agency access level derivation rules. |
| `GLOSSARY.md` | HIGH | Add: personal_tenant, tenant_relationships, agency tenant, client tenant, effective_memberships, portal (sidebar context). |
| `CLAUDE.md` (auth middleware) | HIGH | Update middleware config to query `effective_memberships` view. Document Clerk+Redis hybrid switching. |
| Phase 1C — Auth Layer | HIGH | Surgical update: swap direct `tenant_memberships` query for `effective_memberships` view. Add tenant-switch stub. |
| `clerk-integration.md` | MEDIUM | Document `setActive()` usage for tenant switching. Document multi-org Clerk flow. |
| Phase 1G — Runtime Services | MEDIUM | Blocked until Phase 1C middleware update is complete. |
| `navigation.md` (new doc) | MEDIUM | New reference document. Sidebar tree structure, portal display rules, tenant switcher behaviour. |
| `design-system.md` / tokens | MEDIUM | Add `--shell-accent` per-tenant colour token. Add portal colour token. Document shell repainting. |
| Platform Owner Console docs | LOW | Note that Agency Console follows same scoped pattern at `/agency` route. |
| `portals.md` | LOW | Add section on authenticated portal display in sidebar. Clarify boundary rules. |

---

## 3. Changes

### 3.1 Identity Model

The correct model replaces single-tenant-per-user with multi-tenant identity:

```
// WRONG (current)
User → belongs to Tenant → owns Workspaces

// CORRECT (proposed)
User → persistent platform identity
     → holds roles across one or more Tenants
     → accesses Workspaces based on those roles
```

#### Personal Tenant Auto-Creation

Every user who signs up receives a personal tenant, provisioned automatically on first login.

- `users.personal_tenant_id` FK is set on first login via auto-provisioning.
- The personal tenant is a normal tenant the user happens to own — no special type flag.
- The Clerk organisation is provisioned immediately, but the tenant switcher hides the personal tenant until the user has created at least one workspace inside it.
- Personal tenants are identity-bound and cannot be transferred. Workspaces created inside a personal tenant can be transferred to another tenant.

#### Cross-Tenant Linking — Permanently Forbidden

Cross-workspace record linking is only permitted between workspaces sharing the same `tenant_id`. The following combinations are permanently forbidden, enforced at three layers:

- Between workspaces of different tenants, even where an agency relationship exists.
- Between any shared (tenant-owned) workspace and a personal workspace.
- Between personal workspaces of different users.

**Enforcement layers:**
- **Database:** FK constraints prevent cross-tenant link rows from being written.
- **API:** Link creation endpoint validates `workspace.tenant_id` matches on both sides.
- **UI:** The link picker never surfaces workspaces outside the current tenant context.

---

### 3.2 Schema Changes

#### `users` table — additions

```sql
ADD personal_tenant_id  UUID  nullable  FK → tenants
    -- Set on first login via auto-provisioning trigger
```

#### `workspaces` table — additions

```sql
ADD transferred_from_tenant_id     UUID  nullable  FK → tenants
    -- Set when a workspace is moved; null if never transferred

ADD original_created_by_tenant_id  UUID  nullable  FK → tenants
    -- Immutable. Records originating tenant regardless of transfers
```

#### `tenant_relationships` — new table

```sql
id                          UUID  PK
agency_tenant_id            UUID  FK → tenants  NOT NULL
client_tenant_id            UUID  FK → tenants  NOT NULL
relationship_type           ENUM  managed | white_label | reseller | referral
status                      ENUM  pending | active | suspended | revoked
access_level                ENUM  admin | builder | read_only
initiated_by                ENUM  agency | client
authorized_by_user_id       UUID  FK → users
agency_billing_responsible  BOOL
created_at                  TIMESTAMPTZ
accepted_at                 TIMESTAMPTZ  nullable
revoked_at                  TIMESTAMPTZ  nullable
revoked_by_user_id          UUID  nullable  FK → users
metadata                    JSONB
    -- includes: contract_ref, hide_member_identity (bool for white_label)
```

#### `effective_memberships` — database view (new)

A unified view that unions direct `tenant_memberships` and agency-delegated access from `tenant_relationships`. The auth middleware queries only this view, never the underlying tables directly. This ensures any future membership source (SSO provisioning, future guest tiers) is handled by updating the view, not the middleware.

---

### 3.3 Ownership Transfer Rules

#### Workspace Transfer

Three-step async flow: initiate → accept → complete.

- Owner-level approval required from both source and destination tenant.
- Cross-workspace links involving the workspace are audited before transfer. Cannot transfer with live links pointing outside the destination tenant.
- On completion, RLS policies re-resolve under the new `tenant_id`.
- `transferred_from_tenant_id` and `original_created_by_tenant_id` are written at completion.
- **Transfer flow UI is post-MVP.** Schema stubs are added now.

#### Tenant Ownership Transfer

- Current owner nominates a new owner who must already be an existing member.
- New owner must explicitly accept. Old owner drops to Admin automatically.
- Irreversible without the new owner's consent.
- Personal tenants cannot have ownership transferred — identity-bound.

---

### 3.4 Agency Model

A formal, persistent, business-to-business access model. An Agency Tenant holds authorised access to one or more Client Tenants via `tenant_relationships` rows.

#### Two Onboarding Paths

- **Path A — Agency creates the client tenant:** From the Agency Console, the agency provisions a new tenant for a client. They are automatically the managing agency. The client receives owner-level access to their own tenant.
- **Path B — Existing client invites the agency:** A client tenant owner sends an agency invite. The agency accepts. A `tenant_relationships` row is created.

#### Access Resolution

Agency members access client tenants via the `tenant_relationships` row. They are NOT added to the client tenant's `tenant_memberships`.

- Revoking the relationship cleanly removes all access in one action.
- Agency members do not appear in client membership lists.
- Audit logs show "[Agency Name] on behalf of [User]" rather than raw individual names.

#### White-Label Mode

When `relationship_type = white_label`, `metadata.hide_member_identity = true` suppresses individual agency member names in client audit logs. Only the agency name is shown.

---

### 3.5 Session & Auth Middleware

#### Tenant Switching — Hybrid Model

- **Clerk `setActive()`** is the authoritative source of truth. Re-issues a cryptographically signed JWT baking the active tenant into the session.
- **Redis** provides a fast-lookup cache for the current active tenant context. It never authorises — only accelerates.
- On cache miss or mismatch, the request falls back to Clerk. Security derives from Clerk; performance derives from Redis.
- Switching tenant: optimistic UI repaints shell immediately → Clerk `setActive()` fires → Redis updates. If Clerk fails, shell reverts with toast error.

#### Middleware Update Required (Phase 1C)

The existing 1C auth middleware queries `tenant_memberships` directly. Before Phase 1G proceeds, the middleware must be updated to:

1. Replace the direct `tenant_memberships` query with the `effective_memberships` view.
2. Add a stub for tenant-switching logic (Clerk + Redis hybrid).
3. Recognise `tenant_relationships` rows as a valid access grant with synthesised role derivation.

This is a small, contained surgical change that prevents all 1G and later work from building on a broken assumption.

---

## 4. Downstream UX/UI Effects

### 4.1 Sidebar Navigation Tree

The left sidebar becomes the primary navigation surface, replacing the Home-first flow with a collapsible tree:

```
▼ Steven's Personal          ← personal tenant, always listed first
    My Office
    ▼ Workspace A
    ▼ Workspace B

▼ Acme Co                    ← org tenant, expanded = active
    My Office
    ▼ Workspace C
    ▼ Workspace D

▶ Client Co                  ← collapsed by default

── Portals ─────────────────
▶ Globex Portal              ← distinct icon + portal accent colour
▶ Initech Portal
```

### 4.2 Contextual Clarity — Three Mandatory Layers

A user must be able to determine their current context within one second, without reading text, at all times:

| Signal | Personal Tenant | Org / Agency Tenant |
|--------|----------------|---------------------|
| Sidebar header | User avatar + "Steven's Workspace" | Org logo + org name, always visible |
| Shell colour | Fixed warm neutral (never reused by orgs) | Per-tenant accent colour via `--shell-accent` token |
| My Office heading | "My Office · Personal" | "My Office · [Tenant Name]" — always tenant-qualified |

### 4.3 Portal Display in Sidebar

Authenticated EveryStack users who have been granted portal access by another tenant see those portals natively in the sidebar, beneath a dedicated "Portals" section divider.

- Portal entries use a system-defined portal accent colour (never customisable by the granting tenant) and a dedicated portal icon.
- The portal colour is owned by EveryStack — granting tenants cannot set it. Prevents mimicking.
- When inside a portal, the shell does not repaint. A persistent but subdued portal indicator in the sidebar header shows the portal name and icon.
- All data boundary rules are fully intact. Cross-linking from a portal into the user's own workspaces is permanently forbidden.

### 4.4 Agency Console (`/agency` route)

Separate route with its own middleware guard (same pattern as Platform Owner Console at `/admin`). Mode-switching within the workspace UI is explicitly rejected.

- **Portfolio view:** List of client tenants with plan, workspace count, last activity, billing status, relationship status.
- **One-click context switch** into any client tenant with agency-level access.
- **Client onboarding flow** (Path A — provision a new managed tenant).
- **Relationship management:** Accept incoming requests, adjust `access_level`, revoke.
- **Consolidated billing view** when `agency_billing_responsible = true`.

#### Persistent "Acting as Agency" Banner

Whenever an agency member is operating inside a client tenant, a visually unmistakable persistent banner appears in the shell layer:

- Which agency the member represents.
- Which client tenant they are currently inside.
- A one-click exit back to their own agency tenant.
- **Cannot be dismissed or minimised.** Protects both parties.

---

## 5. Implementation Order

| Step | Area | Action |
|------|------|--------|
| 1 | Schema migration | Add `personal_tenant_id` to `users`; add `transferred_from` / `original_created_by` to `workspaces`; create `tenant_relationships` table. |
| 2 | `effective_memberships` view | Create DB view unioning `tenant_memberships` + `tenant_relationships`. All middleware must query this view from this point forward. |
| 3 | Phase 1C middleware update | Swap direct `tenant_memberships` query for `effective_memberships` view. Add Clerk+Redis tenant-switch stub. Must complete before Phase 1G begins. |
| 4 | Reference doc updates | Update `data-model.md`, `permissions.md`, `GLOSSARY.md`, `CLAUDE.md`. Create `navigation.md`. Update design-system tokens. |
| 5 | Sidebar tree (Phase 1G+) | Implement collapsible sidebar tree with tenant sections, My Office entries, and portal section. |
| 6 | Tenant shell colouring | Implement `--shell-accent` per-tenant token and shell repainting on tenant switch. |
| 7 | Agency Console | Build `/agency` route with portfolio view and agency-in-client banner. Blocked until Steps 1–4 complete. |

---

## 6. Decision Log

| Decision | Rationale |
|----------|-----------|
| Multi-tenant identity over single-tenant-per-user | Real-world: freelancers, multi-company employees, agency operators all need multiple tenant access. |
| Personal tenant auto-creation (normal tenant, no special type) | Uniform model. Personal work has a container. No special-case code paths. |
| Cross-tenant linking permanently forbidden (3-layer enforcement) | Prevents hidden relational dependencies that survive permission changes. Revoked agency relationship must not leave broken links in client data. |
| Agency access via `tenant_relationships`, not `tenant_memberships` | Clean revocation (one action removes all access). Agency members don't pollute client membership lists. Audit identity preserved. |
| `effective_memberships` view as single auth resolution source | Any future membership source (SSO, guest tiers) updates the view, not middleware. Single point of truth. |
| Clerk `setActive()` as authoritative, Redis as cache only | Security from Clerk (signed JWT). Performance from Redis. Cache miss falls back safely. |
| Sidebar tree replaces Home-first flow | Collapses three clicks into one. Multi-tenant users need direct access. |
| Portal accent colour owned by EveryStack, not granting tenant | Prevents tenant impersonation in the user's sidebar. |
| Agency Console as separate `/agency` route, not mode-switch | Eliminates context ambiguity when accessing multiple clients' data. |
| "Acting as Agency" banner is non-dismissible | Protects both agency member (context clarity) and client tenant (audit transparency). |
| White-label mode suppresses individual names | Agencies who don't want to reveal team structure to clients. |
| Workspace transfer UI is post-MVP, schema stubs now | Forward-infrastructure without build commitment. |
