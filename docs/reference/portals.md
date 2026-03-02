# EveryStack — Portals

> **Reconciliation note (2026-02-28, update 4 — Quick Portal / App Portal taxonomy):** Established Quick Portal (MVP, `portal_access` auth) and App Portal (post-MVP, `portal_clients` auth) as permanently coexisting portal types. Updated `portal_sessions` to polymorphic pattern (`auth_type` + `auth_id`). Renamed "Simple Portal" → "Quick Portal", "Full Portal" → "App Portal" throughout. Prior: (update 3) restructured for MVP/post-MVP clarity, aligned `portals` table schema with data-model.md, simplified MVP scoping to `portal_access.record_id`; (update 2) added `record_view_config_id`, renamed `auth_method` → `auth_type`, added `status`; (update 1) renamed Portal Designer → App Designer, clarified MVP scope.

> **Reference doc (Tier 3).** Client-facing portals — **MVP-focused.** This doc covers the MVP Quick Portal implementation: Record View + auth wrapper, `portals` and `portal_access` tables, magic link and password auth, session management, record scoping, rate limiting, caching, audit logging, GDPR, client management, and plan limits. For post-MVP App Portals (App Designer, block model, themes, multi-page layouts, data binding, analytics, payments, PWA, SEO, custom domains), see `app-designer.md`. Both portal types coexist permanently.
> Cross-references: `GLOSSARY.md` (source of truth — naming, scope, architecture), `data-model.md` (schema — `portals` and `portal_access` table definitions), `app-designer.md` (App Designer — post-MVP visual page builder, App Portal spec), `CLAUDE.md` (root — permissions, i18n), `automations.md` (Form Submitted trigger), `compliance.md` (PII registry, GDPR)
> Last updated: 2026-02-28 (update 3) — Full restructure. Schema aligned with data-model.md. `portal_clients` → `portal_access`. MVP/post-MVP cleanly separated. Post-MVP App Designer content moved to Part 2 summary referencing `app-designer.md`.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Portal Overview | 45–58 | Quick Portal concept — externally-shared Record View with auth, MVP scoping, what it is/isn't |
| Data Model — MVP | 62–142 | `portals`, `portal_access`, `portal_sessions` table schemas, Settings JSONB shape, indexes |
| Record Scoping — MVP | 146–161 | `portal_access.record_id` direct scoping, 5-step flow, linked record lookups, security invariant |
| Client Authentication — MVP | 165–271 | Password (bcrypt) + magic link auth, session management, route architecture, rate limiting, token security, auth failure paths, password reset |
| Client Management — MVP | 275–294 | Clients Tab CRUD, invite flow, bulk invite, Access Tab config |
| Portal Write-Back Flow — MVP | 298–328 | Editable field validation via Server Action, security invariant, no-delete policy, file uploads via portal |
| Caching Infrastructure (Three-Tier) — MVP | 332–357 | CDN edge cache, Redis record cache (TTL 60s/300s), Postgres fallback, event-driven invalidation |
| Audit Trail for Portal Actions — MVP | 361–381 | `portal_client` actor type, `writeAuditLog` call shape, Activity tab display format |
| Session Cleanup — MVP | 385–409 | Daily BullMQ job: expired session deletion, stale magic link token cleanup — full code |
| GDPR for Portal Clients — MVP | 413–424 | Access/erasure/rectification/portability rights implementation, PII registry |
| Portal Client Limits — MVP | 428–440 | Per-plan portal counts (1–unlimited), unlimited clients, page view quotas with Redis tracking, throttle at 120% |
| Rendering Modes — MVP | 444–447 | Preview Mode (client picker, draft banner) vs Live Mode, draft-to-live publishing |
| MVP Feature Summary | 451–461 | Quick reference checklist — all MVP Quick Portal capabilities in one block |
| Post-MVP Overview | 465–479 | Quick Portal vs App Portal comparison table (layout, records, pages, customization, data binding, design tool) |
| Post-MVP Database Tables | 483–495 | `apps`, `app_pages`, `app_blocks` tables — separate from MVP `portals`, naming notes |
| Post-MVP Capabilities (See `app-designer.md` for Full Spec) | 499–515 | App Designer, block model, themes, data binding, identity scoping, analytics, Stripe, PWA, custom domains, SEO, embeds, i18n |
| Quick Portal → App Portal Conversion (Post-MVP) | 519–539 | 6-step conversion flow, identity table matching, session migration, constraints (one-way only) |
| Post-MVP Phase Summary | 543–551 | Phased delivery table — Portals & Apps Initial, Fast-Follow, Automations |
| Booking/Scheduling System (Post-MVP) | 555–559 | Pointer to `booking-scheduling.md`, Scheduler block summary |

---

# PART 1: MVP — Quick Portals

Everything in Part 1 is MVP scope per GLOSSARY.md. A developer building MVP portals needs only Part 1.

---

## Portal Overview

Quick Portals are the MVP portal implementation. A Quick Portal is an **externally-shared Record View of a single record** with its own auth and permissions — no workspace chrome. It uses the same configurable field canvas layout as the Record View but is rendered as a standalone page.

**MVP scoping:** One portal link = one record. The client sees only the fields the Manager has configured for that portal layout. Linked record data can be included via single-hop lookups.

**MVP auth:** Magic link or email + password (Manager chooses per portal).

**MVP permissions:** Default read-only. Manager can selectively make specific fields editable.

**MVP access:** Standalone URL (e.g., `portal.everystack.app/{slug}`) or magic link sent to client.

**What a Quick Portal is (MVP):** A Record View shared externally with auth and permissions.
**What a Quick Portal is NOT (MVP):** A multi-page website, a dashboard showing multiple records, or a custom spatial layout. Those are post-MVP Apps built in the App Designer. See: `app-designer.md`.

---

## Data Model — MVP

> **Source of truth:** `data-model.md` > Portals & Forms section. If this section contradicts data-model.md, data-model.md wins.

### `portals` Table

Per data-model.md: Quick Portals — externally-shared Record View of a single record. Auth via magic link or email+password. Default read-only, selectively editable fields configured in settings.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Workspace that owns this portal |
| `table_id` | UUID | FK to tables — which table this portal shows records from |
| `record_view_config_id` | UUID | FK to `record_view_configs` — links to the shared Record View layout. Same layout primitive used by Record Views, Portals, and Forms. |
| `name` | VARCHAR | Display name |
| `slug` | VARCHAR (unique) | URL slug (`portal.everystack.app/{slug}`) |
| `auth_type` | VARCHAR | `'magic_link'` or `'password'`. Manager's choice per portal. |
| `status` | VARCHAR | `'draft'`, `'published'`, `'archived'` |
| `settings` | JSONB | Branding (logo, colors), `editable_fields[]` (field IDs that clients can edit), `linked_record_display` config. See Settings JSONB below. |
| `created_by` | UUID | FK to users — Manager who created the portal |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Indexes:** `UNIQUE (slug)`, `(tenant_id, status)`, `(record_view_config_id)`.

**Settings JSONB shape:**

```typescript
interface PortalSettings {
  branding: {
    logoUrl?: string;
    primaryColor?: string;  // Hex color for header/accent
    portalTitle?: string;   // Custom title (defaults to portal name)
  };
  editableFields: string[];  // Field IDs that clients can edit (empty = fully read-only)
  linkedRecordDisplay: {
    showLinkedFields: boolean;  // Whether to show single-hop lookup fields
    linkedFieldIds?: string[];  // Which linked fields to display (null = all visible)
  };
}
```

### `portal_access` Table

Per data-model.md: Per-record access credentials. One row per client per record. Magic link tokens are single-use, regenerable. **This is the auth table for Quick Portals.** App Portals (post-MVP) use `portal_clients` for identity-based scoping instead — see `app-designer.md`. Both portal types coexist permanently.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant scope — denormalized for RLS (consistent with all tenant-scoped tables). |
| `portal_id` | UUID | FK to portals |
| `record_id` | UUID | FK to records — the specific record this client can access. **This IS the record scoping mechanism for MVP.** |
| `email` | VARCHAR | Client's email address (PII — registered in compliance registry) |
| `auth_hash` | VARCHAR (nullable) | bcrypt hash. Set when portal uses password auth (`auth_type = 'password'`). NULL for magic-link-only portals. |
| `token` | VARCHAR (nullable) | Magic link token. Single-use, regenerable. Generated via `crypto.randomBytes(32).toString('base64url')`. |
| `token_expires_at` | TIMESTAMPTZ (nullable) | Magic link token expiry (15 minutes from creation). |
| `last_accessed_at` | TIMESTAMPTZ (nullable) | Updated on each successful access. |
| `created_at` | TIMESTAMPTZ | |

**Indexes:** `UNIQUE (portal_id, email)`, `(portal_id, record_id)`.

**Key design insight:** `portal_access.record_id` directly links each client to a specific record. For MVP (one portal = one record per client), this is the entire scoping mechanism — no separate `scoping_config` JSONB needed. The portal data resolver simply filters: `WHERE records.id = portal_access.record_id`.

**Multi-record access:** If a client needs access to multiple records on the same portal, they have multiple `portal_access` rows (same portal_id, same email, different record_id). The portal renders a list of accessible records, each clickable to view. This extends naturally from the one-record model without schema changes.

### `portal_sessions` Table

Session management after successful authentication. Required by the auth flow (httpOnly cookies need a server-side session store). Shared by both Quick Portals and App Portals (post-MVP) via polymorphic auth.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Session ID (stored in httpOnly cookie) |
| `auth_type` | VARCHAR | `'quick'` (Quick Portal) or `'app'` (App Portal, post-MVP) |
| `auth_id` | UUID | Polymorphic FK: → portal_access.id when auth_type='quick', → portal_clients.id when auth_type='app' |
| `portal_id` | UUID | FK to portals (Quick) or apps (App Portal) |
| `tenant_id` | UUID | Workspace context for tenant-scoped queries |
| `created_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | 30 days from creation |
| `revoked_at` | TIMESTAMPTZ (nullable) | Set when manually revoked by Manager |

**Indexes:** `(auth_type, auth_id)`, `(portal_id)`. For MVP, all rows have `auth_type='quick'`.

---

## Record Scoping — MVP

Record scoping for MVP is simple: **`portal_access.record_id` directly identifies which record the client sees.**

When the Manager creates a portal and invites a client, the system creates a `portal_access` row linking the client's email to the specific record. No identity tables, no scoping fields, no cross-link chain resolution needed for the MVP one-portal-one-record model.

**How it works:**
1. Manager creates a portal on a table (e.g., Projects).
2. Manager invites a client (email: jane@acme.com) and selects which record they can access (e.g., "Project Alpha", record ID `abc`).
3. System creates `portal_access` row: `{ portal_id, record_id: 'abc', email: 'jane@acme.com' }`.
4. When Jane authenticates, the portal data resolver queries: `WHERE records.id = portal_access.record_id`.
5. Jane sees Project Alpha's fields in the Record View layout configured by the Manager.

**Linked record data:** If the Record View layout includes single-hop lookup fields (e.g., "Client Name" from a linked CRM record), those display as read-only within the portal. The lookup is resolved server-side using the same mechanism as workspace Record Views.

**Security invariant:** The portal data resolver ALWAYS filters by `portal_access.record_id`. Even if a client crafts a request with a different record ID, the resolver rejects it — the client can only see records they have a `portal_access` row for.

---

## Client Authentication — MVP

Portal client authentication is entirely separate from Clerk (which handles EveryStack workspace users). The Manager chooses one auth method per portal via `portals.auth_type`.

### Two Authentication Methods

**Method 1: Email + Password** (`auth_type = 'password'`)

Best for clients who access the portal regularly (weekly+). Standard password-based login.

- Client receives an invitation email: "You've been invited to view your project on [Portal Name]. Click here to set your password."
- Client clicks, sets a password (min 8 chars, complexity requirements enforced client-side and server-side).
- Password hash (`bcrypt`, cost factor 12) stored on the `portal_access` row in the `auth_hash` column.
- Login page: email + password form. On success, creates a `portal_sessions` row and sets httpOnly cookie.

**Method 2: Magic Link (Passwordless)** (`auth_type = 'magic_link'`)

Best for clients who access the portal infrequently. Zero friction — no password to remember.

- Client requests access by entering their email on the portal login page.
- System looks up `portal_access` row by email + portal_id. If found, generates a token.
- Token: `crypto.randomBytes(32).toString('base64url')`. Stored in `portal_access.token` with `token_expires_at` set to 15 minutes from now.
- System sends email via Resend: "Click to access [Portal Name]." Link contains the token.
- Token validation: single use. On successful validation, sets `token = NULL` (consumed), creates a `portal_sessions` row, sets httpOnly cookie.

**Manager configures per portal** in Portal Settings > Access tab.

### Session Management

All authenticated portal access (password or magic link) creates a session:

- Session ID stored in httpOnly cookie: `Secure`, `SameSite=Lax`, path-scoped to `/portal/{portalSlug}`
- Session duration: 30 days
- `portal_sessions` table tracks active sessions with `expires_at` and optional `revoked_at`
- Managers can revoke sessions from the portal admin panel
- Session middleware on all `/portal/*` routes validates the cookie and injects `x-portal-client-id` header for downstream data resolvers

### Portal Route Architecture

Portal routes live in a Next.js route group excluded from Clerk middleware:

```
apps/web/src/app/(portal)/portal/[portalSlug]/
  ├── login/page.tsx          ← Login page (email+password or magic link request)
  ├── auth/magic/route.ts     ← Magic link validation endpoint
  ├── layout.tsx              ← Portal session middleware, branding injection
  └── [...slug]/page.tsx      ← Portal page renderer
```

Clerk middleware config excludes `/portal/*` — portal routes use their own session system.

### Rate Limiting

| Target | Limit | Window |
|---|---|---|
| Magic link requests per email | 5 | 15 minutes |
| Magic link requests per IP | 20 | 15 minutes |
| Password login attempts per email | 10 | 15 minutes (then lockout) |
| Password login attempts per IP | 50 | 15 minutes |

Rate limiters use Redis: `rl:portal:magic:{email}:{portalId}`, `rl:portal:login:{email}:{portalId}`, etc.

### Token Security

- **Magic link tokens:** 256-bit random (`crypto.randomBytes(32).toString('base64url')`), 15-minute TTL, single use (nulled on consumption).
- **Session IDs:** UUID v4, stored as httpOnly secure cookie. Validated server-side on every request.

### Auth Failure Paths

Every failure returns a generic, client-safe error message. Internal details are logged server-side but never exposed to portal visitors.

**Password login failures:**

| Scenario | Client sees | Server action |
|----------|-------------|---------------|
| Email not found in `portal_access` | "Invalid email or password." (generic — same as wrong password) | Log `portal.auth.email_not_found` with email hash. Do NOT reveal whether the email exists. |
| Wrong password | "Invalid email or password." | Increment rate limiter `rl:portal:login:{email}:{portalId}`. Log `portal.auth.password_fail`. |
| Account locked (rate limit exceeded) | "Too many login attempts. Please try again in 15 minutes." | Return 429. Do not process auth check. Log `portal.auth.locked`. |
| Portal status is `'draft'` or `'archived'` | "This portal is currently unavailable." | Return 404-style page. No login form rendered. |
| Portal access row has `revoked_at` set | "Your access to this portal has been revoked. Contact the portal owner." | Log `portal.auth.revoked_access`. |

**Magic link failures:**

| Scenario | Client sees | Server action |
|----------|-------------|---------------|
| Email not found when requesting link | "If an account exists, we've sent a login link." (generic — same as success) | Log `portal.auth.magic_no_account`. Do NOT send email. Do NOT reveal account existence. |
| Token expired (>15 min) | "This login link has expired. Please request a new one." + "Request New Link" button. | Log `portal.auth.magic_expired`. Token already consumed or nulled. |
| Token already used (single-use consumed) | "This login link has already been used. Please request a new one." + "Request New Link" button. | `token` is already NULL. Log `portal.auth.magic_reused`. |
| Token invalid (malformed or tampered) | "This login link is invalid. Please request a new one." | Log `portal.auth.magic_invalid`. Return 400. |
| Magic link request rate limited | "Too many requests. Please try again in 15 minutes." | Return 429. Log `portal.auth.magic_rate_limit`. |

**Session failures:**

| Scenario | Client sees | Server action |
|----------|-------------|---------------|
| Session cookie missing | Redirect to portal login page. | No log (normal flow — first visit or cookie cleared). |
| Session expired (`expires_at` passed) | Redirect to login page with toast: "Your session has expired. Please log in again." | Delete expired session row. Log `portal.auth.session_expired`. |
| Session revoked by Manager | Redirect to login page with toast: "Your access has been updated. Please log in again." | `revoked_at` is set. Log `portal.auth.session_revoked`. |
| Session valid but portal deleted | "This portal is no longer available." | Return 404-style page. Session cleanup runs async. |

**Password reset flow (password-auth portals only):**

1. Client clicks "Forgot password?" on login page.
2. Client enters email. System sends password reset email (same "if an account exists" pattern — never reveals existence).
3. Reset token: 256-bit random, 1-hour TTL, single use. Stored in `portal_access.reset_token` / `reset_token_expires_at`.
4. Client clicks link → enters new password (min 8 chars, bcrypt cost 12) → `auth_hash` updated, all existing sessions for this `portal_access` row revoked (`revoked_at` set).
5. Client redirected to login page with toast: "Password updated. Please log in with your new password."

---

## Client Management — MVP

### Clients Tab (Portal Admin Panel)

List of `portal_access` rows for this portal. Columns: email, record name, last accessed, created date. Actions: Invite, Revoke, Delete.

**Invite flow:**
1. Manager enters client email.
2. Manager selects which record this client can access (autocomplete search on the portal's table).
3. System creates `portal_access` row with `record_id` set.
4. System sends invitation email via Resend:
   - Password portals: "Click here to set your password and access [Portal Name]"
   - Magic link portals: "Click here to access [Portal Name]" (generates token, creates session on click)
5. `last_accessed_at` updates on first successful login.

**Bulk invite:** Manager selects multiple records → system prompts for email per record (or matches via an email field on the table if one exists). Creates `portal_access` rows in batch and sends invitation emails.

### Access Tab

Authentication method selector (magic link or email+password), session timeout override (default 30 days), custom login page message.

---

## Portal Write-Back Flow — MVP

Portal clients can edit specific fields when the Manager has configured them as editable via `portals.settings.editableFields[]`. This is the primary mechanism for external data collection on Quick Portals.

### Edit Flow

```
1. Portal client views record via authenticated portal
2. Editable fields render with input controls (non-editable fields render read-only)
3. Client modifies an editable field and submits
4. Server Action receives changes + portal session context:
   a. Verify portal session is active (from cookie)
   b. Verify the record is the client's record (portal_access.record_id check)
   c. Validate only editable fields are being changed (check against settings.editableFields[])
   d. Validate field values via Zod schemas (same as internal record editing)
   e. Reject any fields not in editableFields — silent drop, no error to client
5. Update record.canonical_data with new values
6. Post-update:
   - Write audit log: actor_type='portal_client', actor_id=portalAccessId
   - Update search_vector for the record
   - Emit record.updated domain event (may trigger automations)
   - Invalidate portal cache for this record
```

### Security Invariant

Portal write operations are **always scoped**. The Server Action re-verifies that `portal_access.record_id` matches the target record before allowing the mutation. If the record doesn't match, the request is rejected with `PORTAL_ACCESS_DENIED`.

**No delete via portal.** Portal clients cannot delete records. Deletion requires workspace membership. If a "remove" action is needed, Managers configure a status field (e.g., "Cancelled") that the portal client can set via editableFields, with an automation that handles the actual archival.

**File uploads via portal.** If an Attachment field is included in `editableFields`, portal clients can upload files through the standard upload pipeline (see `files.md`). Constraints: max 25MB per file, max 10 files per Attachment field, allowed types configurable per portal in `settings.allowed_file_types` (default: images, PDFs, common document formats — no executables). Files are stored under the workspace's storage quota (counted against the workspace plan, not per portal client). Upload failures return a generic error to the client: "File upload failed. Please try again." Files uploaded via portal are tagged with `context_type: 'portal_upload'` and `uploaded_by_portal_access_id` for audit tracking.

---

## Caching Infrastructure (Three-Tier) — MVP

Portal pages are read-heavy and client-facing — caching is critical for performance and cost.

### Tier 1: CDN Edge Cache

- Authenticated pages: `Cache-Control: private, no-store` (never cached at CDN)
- Surrogate-Key headers for targeted purging (e.g., `portal:{portalId} record:{recordId}`)

### Tier 2: Redis Application Cache

- Portal record data cached in Redis: `cache:portal:{portalId}:{recordId}:{portalAccessId}`
- TTLs: static content (branding, layout): 300s; record data: 60s
- Authenticated content keyed by `portalAccessId` (different clients may see different records)

### Tier 3: Postgres Fallback

- Cache miss → query Postgres with `portal_access.record_id` filter applied
- Always correct, just slower

### Cache Invalidation

Event-driven: when a record is mutated, the system:
1. Looks up which portals reference that record's table (via `portals.table_id`)
2. Purges Redis keys for affected portal + record combinations
3. Invalidation is fast because MVP portals are record-scoped (not table-scoped)

---

## Audit Trail for Portal Actions — MVP

Portal clients are a distinct `actor_type` in the audit system (see `audit-log.md`):

```typescript
await writeAuditLog(tx, {
  tenantId,
  actorType: 'portal_client',
  actorId: portalAccessId,
  action: 'record.updated',
  entityType: 'record',
  entityId: recordId,
  details: { portalId, fieldChanges: sanitizedChanges },
  traceId,
  ipAddress: req.headers.get('x-forwarded-for'),
});
```

**Display in Activity tab:** Portal client actions show as "jane@acme.com (portal client) updated this record via [Portal Name]." Distinguished from internal users by the `portal_client` actor type and badge.

**Portal activity log:** Managers can view all portal client activity from the Portal Admin panel.

---

## Session Cleanup — MVP

Background job cleans expired sessions and stale magic link tokens:

```typescript
// Worker job: portal-session-cleanup (runs daily at 03:00 UTC)
// BullMQ repeatable job
async function cleanupExpiredPortalSessions() {
  // Expired sessions
  await db.delete(portalSessions)
    .where(or(
      lt(portalSessions.expiresAt, new Date()),
      lt(portalSessions.revokedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    ));

  // Stale magic link tokens (well past 15-minute expiry)
  // Null out tokens on portal_access rows where token_expires_at < 24h ago
  await db.update(portalAccess)
    .set({ token: null, tokenExpiresAt: null })
    .where(and(
      isNotNull(portalAccess.token),
      lt(portalAccess.tokenExpiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    ));
}
```

---

## GDPR for Portal Clients — MVP

Portal clients are external individuals with PII (email). GDPR applies:

| Right | Implementation |
|-------|----------------|
| **Access** | Portal client can request a data export from portal settings page (exports their profile + the record visible via their `portal_access.record_id`) |
| **Erasure** | Manager can delete a portal client. Triggers: delete `portal_access` row, delete all `portal_sessions` where `auth_type='quick' AND auth_id` matches. The record visible via `record_id` is NOT deleted (it belongs to the workspace). |
| **Rectification** | Portal client can request email update. Email change triggers re-verification (new invitation). |
| **Portability** | Data export in JSON format from portal settings. |

Portal client emails are registered in the PII compliance registry (`packages/shared/compliance/`). Portal client deletion is separate from workspace user deletion.

---

## Portal Client Limits — MVP

Portal clients are **unlimited on all plans** (pricing: "Unlimited Team Members, Viewers, and portal clients at every tier"). The constraint is on the number of portals:

| Plan | Max Portals | Portal Clients | Portal Page Views/month |
|------|-------------|----------------|------------------------|
| Freelancer | 1 | Unlimited | 10,000 |
| Starter | 5 | Unlimited | 50,000 |
| Professional | 15 | Unlimited | 250,000 |
| Business | Unlimited | Unlimited | 1,000,000 |
| Enterprise | Unlimited | Unlimited | Custom |

**Page view tracking:** Redis counter per portal per month: `portal:views:{portalId}:{YYYY-MM}`, TTL 35 days. Incremented on every non-cached portal page request (CDN cache hits don't count). When limit reached: portal continues serving but a banner appears in the Manager's portal admin panel ("Approaching page view limit — upgrade to avoid throttling"). At 120% of limit: new requests receive a "This portal is temporarily unavailable" static page. No data loss — the portal is throttled, not deleted.

---

## Rendering Modes — MVP

- **Preview Mode:** Full rendering with real data. Top banner with client picker for testing which record is shown per specific `portal_access` row. Draft environment banner.
- **Live Mode:** What clients see. No editing chrome. Draft-to-live publishing — edits to portal config continue in draft; live unchanged until explicit publish (status changes from `'draft'` to `'published'`).

---

## MVP Feature Summary

> **Source of truth:** GLOSSARY.md MVP Scope Summary. If this section contradicts the glossary, the glossary wins.

**MVP (Quick Portals per GLOSSARY.md):** `portals` table (with `record_view_config_id` linking to shared Record View layout, `auth_type`, `status`, `settings` JSONB). `portal_access` table (per-record access credentials for Quick Portals). `portal_sessions` table (session cookies, polymorphic auth — see `data-model.md`). Single-record portal — one portal link = one record per client. Auth: magic link or email+password (Manager chooses per portal). Read-only by default, selectively editable fields via `settings.editableFields[]`. Session management (httpOnly cookies, 30-day expiry). Cleanup job for expired sessions and stale tokens. Three-tier caching. Rate limiting. Audit logging with `portal_client` actor type. GDPR endpoints. Portal URL: `portal.everystack.app/{slug}`.

---

# PART 2: Post-MVP — App Portals (App Designer)

> **⚠️ POST-MVP — Everything in Part 2 is post-MVP per GLOSSARY.md.** The App Designer (visual page builder) is post-MVP entirely. MVP portals use the Record View layout engine. For the full post-MVP specification, see `app-designer.md`.

---

## Post-MVP Overview

App Portals built in the App Designer let Managers create branded, multi-page, multi-record client-facing web applications. These extend beyond the Quick Portal's single-record view with custom spatial layouts, block-based design, data binding, themes, and a full visual page builder. Quick Portals and App Portals coexist permanently — Managers choose which type fits their need.

**What post-MVP adds over Quick Portals:**

| Capability | Quick Portal (MVP) | App Portal (App Designer, Post-MVP) |
|---|---|---|
| Layout | Record View field canvas | 12-column grid with drag-and-drop blocks |
| Records | One record per client | Multiple records, filtered lists, dashboards |
| Pages | Single page | Multi-page with navigation |
| Customization | Branding (logo, color) via settings JSONB | Full theme system (20 curated themes + custom) |
| Data binding | Direct record fields + single-hop lookups | Context-bound, relationship-bound, query-bound |
| Interactions | View + selectively edit fields | Forms, payments, approvals, comments, scheduling |
| Design tool | Record View config | App Designer (4-zone visual builder) |

---

## Post-MVP Database Tables

Per GLOSSARY.md DB entity quick reference, post-MVP App Designer outputs use **separate tables from MVP portals**:

| Table | Purpose | Key Columns |
|---|---|---|
| `apps` | App Designer outputs (custom portals, websites, internal apps) | `id, tenant_id, type, name, theme, status` |
| `app_pages` | Pages within an app | `id, app_id, slug, layout (JSONB)` |
| `app_blocks` | Blocks within a page | `id, page_id, block_type, config (JSONB)` |

**Important:** These are entirely separate from the MVP `portals` table. Quick Portals (MVP) and App Designer portals (post-MVP) coexist — the `portals` table handles simple record-sharing with `record_view_config_id`; the `apps` table handles App Designer outputs with spatial layouts and block trees.

> **Naming note (per GLOSSARY.md):** Old docs used `portal_pages` and `portal_blocks` as table names. Per the glossary DB entity reference and app-designer.md reconciliation notes, these are now `app_pages` and `app_blocks` — because the App Designer produces all app types (portals, internal apps, websites, documents), not just portals.

---

## Post-MVP Capabilities (See `app-designer.md` for Full Spec)

The following are all covered in detail in `app-designer.md`:

- **App Designer:** 4-zone visual builder (sidebar, canvas, property panel, toolbar). Block library with 6 categories (Layout, Data, Static, Action, Form Input, Special). Drag-and-drop, resize, 12-column grid snap.
- **Block model:** Recursive block tree via `parent_block_id`, container nesting rules (max depth 4), responsive breakpoints (desktop/tablet/mobile).
- **Theme system:** 12 semantic tokens, 20 curated gallery themes, custom token editor, 3-tier override model (theme → page → block).
- **Data binding:** Context-bound (default — current record), relationship-bound (cross-links), query-bound (power user — custom queries across tables).
- **Identity-based record scoping:** For multi-record portals, scoping uses a dedicated field on each table to match records to clients via CRM identity linkage. See `app-designer.md` > Record Scoping.
- **Portal analytics:** Page views, client activity, per-page metrics, event tracking via `portal_events` table.
- **Stripe payment integration:** Payment blocks, webhook-driven automation triggers.
- **PWA with offline:** Three-tier offline strategy (cached reads, queued writes, smart pre-caching).
- **Custom domains:** CNAME setup, auto-SSL via Let's Encrypt, `portal_domains` table.
- **SEO meta tags:** Per-page meta title, description, OG tags for public portal pages.
- **Embeddable forms:** Script tag and iframe embed with Turnstile spam protection.
- **Smart Setup suggestions:** Pre-publish automation suggestions based on block types present.
- **Multi-language content:** Locale-keyed block config values (designed, build deferred). Uses `resolveContent(value, locale)` helper.

---

## Quick Portal → App Portal Conversion (Post-MVP)

Optional upgrade path. Both portal types coexist permanently — conversion is a choice, not a requirement.

**Why the two auth models are different:** Quick Portals use `portal_access` (explicit per-record grants — "this email can see this record"). App Portals use `portal_clients` (identity-based scoping — "this email IS this contact, and they can see all records related to them"). These are intentionally different complexity levels for different needs.

**Conversion flow:**

1. Manager initiates conversion from portal admin panel → "Upgrade to App Portal" button.
2. **Select identity table:** Manager picks a table that represents client identities (e.g., Contacts, Clients). This becomes the `portal_clients.linked_record_id` target.
3. **Client matching:** For each `portal_access` row, the system matches the email to a record in the identity table.
   - **Matched** → creates a `portal_clients` row with `linked_record_id` pointing to that contact record.
   - **Unmatched** → Manager prompted per client: create a new contact record, manually map to an existing record, or skip (client will not be migrated).
4. **Scoping config:** Manager configures per-table scoping fields — how the system derives "which records belong to this client" from the identity link.
5. **Session migration:** `portal_sessions.auth_type` switches from `'quick'` to `'app'`. Existing sessions are preserved — clients don't need to re-authenticate.
6. **Cleanup:** Original `portal_access` rows are soft-deleted. The portal entry moves from `portals` table to `apps` table. The original `portals` row is archived (not deleted — preserves audit trail and URL redirects).

**Constraints:**
- A portal is one type or the other — `portal_access` and `portal_clients` never coexist on the same portal.
- Conversion is one-way (App Portal → Quick Portal downgrade is not supported — too much data loss).
- Unmatched clients receive an email notification: "Your portal has been upgraded. Click here to set up your new account."

---

## Post-MVP Phase Summary

> **Source of truth:** `app-designer.md` > Phase Implementation Summary. All phases below are post-MVP relative to the platform MVP defined in GLOSSARY.md.

| Phase | Work |
|-------|------|
| Post-MVP — Portals & Apps (Initial) | `apps`, `app_pages`, `app_blocks`, `portal_clients`, `portal_magic_links`, `portal_events` tables. `portal_sessions` updated with polymorphic auth (already exists from MVP). App Portal creation wizard with identity-based scoping setup. App Designer (4-zone layout, block library, canvas, property panel Content+Style tabs). Template-first creation flow. 20-theme gallery. Three access modes. Password + magic link auth. Record scoping via `linked_record_id` + scoping config. Write-back flow. Session middleware. Rate limiting. Three-tier caching. PWA Tier 1+2. Embeddable forms. Page view tracking. Audit logging. GDPR endpoints. Optional Quick Portal → App Portal conversion wizard. |
| Post-MVP — Portals & Apps (Fast-Follow) | Logic tab. Grid Container. Query-bound binding. Analytics dashboard. Stripe integration. AI-generated apps. Custom domains. Booking/scheduling. Offline Tier 3. |
| Post-MVP — Automations | Automation triggers: Form Submitted, Client Portal Action (payment, approval, comment). Automation actions: Post to Portal, Create Report. Auto-create portal client accounts on CRM record creation. |

---

## Booking/Scheduling System (Post-MVP)

> **⚠️ POST-MVP.** Booking/Scheduling is post-MVP per GLOSSARY.md MVP Excludes.

See `booking-scheduling.md` for the full specification. The Scheduler block is an App Designer block type (Special category). Full spec covers: Calendar View architecture, bookable tables, computed availability engine, Scheduler portal block, public booking pages, event types (one-on-one, group, round-robin, collective), buffer time / meeting limits / minimum notice, confirmation & reminder flows, self-service rescheduling & cancellation, routing & pre-booking qualification, no-show detection, video conferencing integration, meeting polls, single-use links, managed booking templates, scheduling analytics, and Quick Setup Wizard.
