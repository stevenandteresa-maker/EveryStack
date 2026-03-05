# EveryStack — Navigation Architecture

> **Reference doc.** Sidebar tree structure, tenant switcher, My Office per-tenant model, portal display rules, contextual clarity signals, agency banner.
> Origin: CP-002 (Multi-Tenant Identity, Agency Model & Navigation Architecture).
> See `GLOSSARY.md` for concept definitions (Tenant, Personal Tenant, Agency Tenant, effective_memberships).
> Cross-references: `design-system.md` (shell accent tokens, application shell, sidebar icon rail), `permissions.md` (effective_memberships, agency access model), `portals.md` (portal display in sidebar), `data-model.md` (tenant_relationships, users.personal_tenant_id)
> Created: 2026-03-05

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                       | Lines   | Covers                                                                      |
| ----------------------------- | ------- | --------------------------------------------------------------------------- |
| Sidebar Navigation Tree       | 25–65   | Collapsible tree structure, tenant sections, workspace nesting              |
| Tenant Switcher               | 67–95   | Clerk+Redis hybrid model, optimistic UI, shell repainting                   |
| My Office — Per-Tenant        | 97–115  | Tenant-qualified headings, personal vs org context                          |
| Contextual Clarity            | 117–145 | Three mandatory signals, one-second rule                                    |
| Portal Display in Sidebar     | 147–175 | Authenticated portal entries, visual distinction, data boundary enforcement |
| Agency Console                | 177–215 | /agency route, portfolio view, agency-in-client banner                      |

---

## Sidebar Navigation Tree

The left sidebar is the primary navigation surface. It replaces the Home-first flow with a collapsible tree that provides direct access to any tenant's workspaces in one click.

### Tree Structure

```
▼ Steven's Personal          ← personal tenant, always listed first
    My Office
  ▼ Workspace A
  ▼ Workspace B

▼ Acme Co                    ← org tenant, expanded = active context
    My Office
  ▼ Workspace C
  ▼ Workspace D

▶ Client Co                  ← collapsed by default

── Portals ─────────────────  ← section divider
▶ Globex Portal               ← distinct icon + portal accent colour
▶ Initech Portal
```

### Display Rules

- **Personal tenant** is always listed first in the sidebar, regardless of alphabetical ordering.
- **Personal tenant is hidden** in the tenant switcher until the user has created at least one workspace inside it. Once visible, it persists.
- **Active tenant** is expanded by default. Other tenants are collapsed.
- **Collapsed tenants** show only the tenant header (logo + name). One click expands to show workspaces.
- **My Office** appears as the first item under each tenant section — it is tenant-qualified (see Contextual Clarity below).
- **Portals section** appears below all tenant sections, separated by a visual divider. Portal entries use a dedicated portal icon and system-owned accent colour.

### Workspace Nesting

Within each tenant section, workspaces are grouped by board (if boards exist) or listed flat:

```
▼ Acme Co
    My Office
  ▼ Board: Client Work
      Workspace: Acme Corp Project
      Workspace: Beta Inc Retainer
  ▼ Board: Back Office
      Workspace: Finance
      Workspace: HR & Operations
    Workspace: Sandbox              ← ungrouped
```

---

## Tenant Switcher

### Clerk + Redis Hybrid Model

- **Clerk `setActive()`** is the authoritative source of truth. It re-issues a cryptographically signed JWT baking the active tenant into the session. Cannot be tampered with client-side.
- **Redis** provides a fast-lookup cache for the current active tenant context. It never authorises — only accelerates.
- On cache miss or mismatch, the request falls back to Clerk. Security derives from Clerk; performance derives from Redis.

### Switching Flow

1. User clicks a tenant header in the sidebar (or selects from a tenant picker dropdown).
2. **Optimistic UI:** Shell repaints immediately — header accent colour, sidebar active state, My Office heading.
3. **Clerk `setActive()` fires** — issues new JWT for the target tenant.
4. **Redis updates** with the new active tenant context.
5. **If Clerk fails:** Shell reverts to previous tenant state with toast error: "Unable to switch workspace. Please try again."

### What Tenant Switch Changes

| Element | On Switch |
|---|---|
| Header accent colour | Repaints to target tenant's `--shell-accent` |
| Sidebar active state | Target tenant expands, previous collapses |
| My Office heading | Updates to "My Office · [Tenant Name]" |
| Content area | Navigates to target tenant's last-accessed workspace |
| Breadcrumbs | Reset to target tenant context |

---

## My Office — Per-Tenant

My Office is tenant-scoped. Each tenant has its own My Office with its own widget grid aggregating data from that tenant's workspaces.

### Heading Rule

My Office headings are always tenant-qualified to prevent confusion:

| Context | Heading |
|---|---|
| Personal tenant | "My Office · Personal" |
| Org tenant | "My Office · [Tenant Name]" |
| Agency accessing client tenant | "My Office · [Client Tenant Name]" (agency banner also visible) |

### Personal vs Org

- **Personal My Office:** Aggregates tasks, calendar, chat from personal workspaces only.
- **Org My Office:** Aggregates across all workspaces the user has access to within that org tenant.
- Switching tenants in the sidebar switches My Office context — no cross-tenant aggregation.

---

## Contextual Clarity — Three Mandatory Signals

A user must be able to determine their current context within one second, without reading text, at all times. This is enforced by three simultaneous signals:

| Signal | Personal Tenant | Org / Agency Tenant |
|---|---|---|
| **Sidebar header** | User avatar + "Steven's Workspace" | Org logo + org name, always visible |
| **Shell colour** | Fixed warm neutral (never reused by orgs) | Per-tenant accent colour via `--shell-accent` token |
| **My Office heading** | "My Office · Personal" | "My Office · [Tenant Name]" — always tenant-qualified |

### Why Three Signals

Any single signal can be missed (user not looking at header, colour-blind user, My Office not visible). Three simultaneous signals — visual position, colour, text — ensure at least two are always perceivable.

### Personal Tenant Visual Identity

The personal tenant uses a fixed warm neutral accent colour that is **never available** in the 8 curated org accent options. This prevents any org tenant from accidentally or intentionally matching the personal tenant's appearance.

---

## Portal Display in Sidebar

Authenticated EveryStack users who have been granted portal access by another tenant see those portals natively in the sidebar, beneath a dedicated "Portals" section divider.

### Visual Distinction Rules

- Portal entries use a **system-defined portal accent colour** (never customisable by the granting tenant) and a **dedicated portal icon** not shared with tenant or workspace icon families.
- The portal colour is owned by EveryStack. This prevents a tenant from mimicking the user's own tenant colours to create confusion.
- When inside a portal, the shell does **not** repaint to a new accent colour (that signal is reserved for tenant switching). A persistent but subdued portal indicator sits in the sidebar header showing the portal name and icon.

### Data Boundary Enforcement

- All data boundary rules are fully intact. The portal is a **display convenience**, not a data bridge.
- Cross-linking from a portal into the user's own workspaces is permanently forbidden.
- The portal renders in the same way as the standalone portal URL — same auth, same field visibility, same data scoping.

### When Portals Appear

- Portal entries appear when the user has at least one active (non-revoked) `portal_access` row from another tenant.
- Revoked portal access (`revoked_at` set) removes the entry from the sidebar.
- The portals section divider is hidden when no portal entries exist.

---

## Agency Console (/agency route)

The Agency Console follows the same pattern as the Platform Owner Console (`/admin`): a separate route with its own middleware guard. **Mode-switching within the workspace UI is explicitly rejected** — it creates ambiguity about operational context when accessing multiple clients' data.

### Portfolio View

- List of client tenants with: plan, workspace count, last activity, billing status, relationship status.
- One-click context switch into any client tenant with agency-level access.
- Client onboarding flow (Path A — provision a new managed tenant from the Agency Console).
- Relationship management: accept incoming requests, adjust `access_level`, revoke.
- Consolidated billing view when `agency_billing_responsible = true`.

### Two Onboarding Paths

**Path A — Agency creates the client tenant:** From the Agency Console, the agency provisions a new tenant for a client. They are automatically the managing agency. The client receives owner-level access to their own tenant.

**Path B — Existing client invites the agency:** A client tenant owner sends an agency invite. The agency accepts. A `tenant_relationships` row is created with `initiated_by = 'client'`.

### Persistent "Acting as Agency" Banner

Whenever an agency member is operating inside a client tenant, a visually unmistakable persistent banner appears in the shell layer. This is **not a badge** — it is a full shell-level element showing:

- Which agency the member represents
- Which client tenant they are currently inside
- A one-click exit back to their own agency tenant

This banner **cannot be dismissed or minimised**. It protects both parties: the agency member maintains constant context clarity, and the client tenant has permanent audit transparency.

### Audit Identity

When an agency member performs actions in a client tenant:

- **Default:** Audit log shows `[Agency Name] on behalf of [User Name]`.
- **White-label mode** (`tenant_relationships.metadata.hide_member_identity = true`): Only the agency name is shown — individual member names are suppressed. This protects agencies who do not want to reveal their team structure.

---

## Implementation Sequencing

These navigation features depend on CP-002 schema and auth changes being in place:

| Dependency | Required Before |
|---|---|
| `tenant_relationships` table | Agency Console, portfolio view |
| `effective_memberships` view | Tenant switching, multi-tenant sidebar |
| `users.personal_tenant_id` | Personal tenant section in sidebar |
| `--shell-accent` token (design-system.md) | Tenant switching visual feedback |
| `--portal-accent` token (design-system.md) | Portal entries in sidebar |

See CP-002 § Implementation Order for the full sequencing.
