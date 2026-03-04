# EveryStack — Platform Owner Console

> **New document: 2026-03-04** — Specifies the operator-facing tooling for Steven (EveryStack platform owner) to manage the EveryStack business. Not a tenant-facing feature. Two-layer architecture: a thin `/admin` route for system-level ops + a dedicated Platform Workspace inside EveryStack for business operations. Identified as a gap during MVP — Foundation design review.
>
> Cross-references: `data-model.md` (tenants, users, support_requests schema), `support-system.md` (full support system spec — AI triage, support staff console, plan-based tiers), `settings.md` (tenant-facing Billing & Plan section), `compliance.md` (audit logging, data access), `operations.md` (incident response), `observability.md` (platform health dashboards), `permissions.md` (platform_admin role), `GLOSSARY.md` (plan tiers, tenant definition)
> Update: 2026-03-04 — Support queue section updated to reference support-system.md (full support system spec broken out into dedicated doc). support-system.md added to cross-references.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Architecture Decision | 38–60 | Two-layer design rationale, /admin vs Platform Workspace |
| Schema Additions | 61–120 | tenants table additions, users.is_platform_admin, support_requests table |
| /admin Route — Auth & Access | 121–145 | How platform admin auth works, middleware, Clerk metadata |
| /admin Route — Tenant List | 146–195 | Tenant index, search/filter, health signals, churn indicators |
| /admin Route — Tenant Detail | 196–270 | Per-tenant view: profile, usage, billing actions, impersonation, feature flags |
| /admin Route — Revenue Dashboard | 271–315 | MRR, trial conversion, churn, Stripe data aggregation |
| /admin Route — Sync Health | 316–345 | Cross-tenant sync failure visibility |
| /admin Route — Support Queue | 346–390 | References `support-system.md` — key points for /admin implementation |
| /admin Route — Broadcast Messaging | 391–420 | In-app and email broadcasts to tenant segments |
| /admin Route — Feature Flags | 421–455 | Per-tenant feature flag overrides |
| Platform Workspace | 456–530 | EveryStack-as-a-business: tables, views, automations, use cases |
| Phase Implementation | 531–560 | What gets built when, relative to main build sequence |

---

## Architecture Decision

### Two Layers, Two Purposes

The Platform Owner Console is split into two distinct layers:

| Layer | Route / Location | Purpose | Dependency |
|-------|-----------------|---------|------------|
| **`/admin` route** | `/admin/*` — server-rendered, protected | System-level operator ops: tenant management, billing actions, impersonation, feature flags, support triage, platform health | Always available — reads directly from DB and Stripe, not dependent on EveryStack application layer |
| **Platform Workspace** | A real EveryStack workspace owned by Steven | Business operations: pipeline tracking, support history, content calendar, revenue analysis, internal knowledge | EveryStack application layer must be functional |

**Why two layers, not one:** The `/admin` route must remain accessible even when something is broken at the application layer — it's the control plane. The Platform Workspace is the business operations layer and benefits from dogfooding EveryStack features as they mature. Neither replaces the other.

**The `/admin` route is NOT a tenant.** It has no `tenant_id`. It is a protected internal surface accessible only to users with `users.is_platform_admin = true`. It bypasses RLS (reads as superuser via `DATABASE_URL_DIRECT`) and has its own auth middleware.

**The Platform Workspace IS a real tenant.** Steven's EveryStack account is a real tenant with `tenants.is_internal = true`. This tenant is excluded from all revenue calculations, usage rollups, and tenant-facing analytics. It can be used to dogfood features as they become available.

---

## Schema Additions

These additions are required before the `/admin` route can be built. They are additive-only (no changes to existing columns) and must be applied as a migration during the next build session.

### `tenants` table — additional columns

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
  stripe_customer_id        VARCHAR(255),      -- Stripe Customer ID (cus_xxx)
  stripe_subscription_id    VARCHAR(255),      -- Stripe Subscription ID (sub_xxx)  
  subscription_status       VARCHAR(50)        -- active | trialing | past_due | canceled | unpaid
    DEFAULT 'trialing',
  trial_ends_at             TIMESTAMPTZ,       -- NULL after trial converts or expires
  plan_override             VARCHAR(50),       -- Platform owner can force a plan regardless of Stripe
  plan_override_reason      TEXT,              -- Required when plan_override is set
  plan_override_expires_at  TIMESTAMPTZ,       -- NULL = permanent override
  is_internal               BOOLEAN NOT NULL DEFAULT false,  -- TRUE for Steven's own workspace
  churn_risk_flag           VARCHAR(20),       -- NULL | 'watch' | 'at_risk' (set by admin or auto)
  churn_risk_note           TEXT,              -- Optional note when flag is set
  flagged_at                TIMESTAMPTZ,       -- When churn_risk_flag was last set
  first_active_at           TIMESTAMPTZ,       -- First non-trial login by any member
  last_active_at            TIMESTAMPTZ;       -- Last activity across any workspace in this tenant
```

**Indexes:**
```sql
CREATE INDEX idx_tenants_stripe_customer ON tenants (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_tenants_subscription_status ON tenants (subscription_status);
CREATE INDEX idx_tenants_trial_ends ON tenants (trial_ends_at) WHERE trial_ends_at IS NOT NULL;
CREATE INDEX idx_tenants_churn_risk ON tenants (churn_risk_flag) WHERE churn_risk_flag IS NOT NULL;
```

### `users` table — additional column

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  is_platform_admin BOOLEAN NOT NULL DEFAULT false;
```

This flag is set manually (Steven sets it on his own user via a one-time migration or seed). It is the single gate for `/admin` route access. Never expose this field via the Platform API or any tenant-facing query.

### `support_requests` table — new table

```sql
CREATE TABLE support_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE SET NULL,  -- NULL if tenant deleted
  submitted_by_user UUID REFERENCES users(id) ON DELETE SET NULL,
  category          VARCHAR(50) NOT NULL,   -- billing | bug | feature_request | account | other
  subject           VARCHAR(255) NOT NULL,
  body              TEXT NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'open',  -- open | in_progress | waiting | resolved | closed
  priority          VARCHAR(10) NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  admin_notes       TEXT,                  -- Internal notes (never shown to user)
  resolved_at       TIMESTAMPTZ,
  resolution_notes  TEXT,                  -- Shown to user on resolution
  source            VARCHAR(20) NOT NULL DEFAULT 'in_app',  -- in_app | email | manual
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_support_requests_tenant ON support_requests (tenant_id);
CREATE INDEX idx_support_requests_status ON support_requests (status, created_at DESC);
CREATE INDEX idx_support_requests_priority ON support_requests (priority, status);
```

### `support_request_messages` table — new table

```sql
CREATE TABLE support_request_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id  UUID NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  author_type         VARCHAR(20) NOT NULL,  -- 'user' | 'platform_admin' | 'ai_auto' | 'ai_draft' | 'support_agent' (see support-system.md)
  author_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  body                TEXT NOT NULL,
  is_internal_note    BOOLEAN NOT NULL DEFAULT false,  -- TRUE = only visible to platform admin
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_srm_request_id ON support_request_messages (support_request_id, created_at);
```

---

## `/admin` Route — Auth & Access

### Authentication Model

The `/admin` route uses the same Clerk session as the main application. However, access is additionally gated by `users.is_platform_admin = true` in the database. Two conditions must both be true:

1. Valid Clerk session (same as normal app auth)
2. `users.is_platform_admin = true` for the authenticated user

**Middleware:**

```typescript
// apps/web/middleware.ts — add admin route protection
// /admin/* routes: require Clerk auth + is_platform_admin check

export async function adminMiddleware(req: NextRequest) {
  const { userId } = getAuth(req);
  if (!userId) return NextResponse.redirect('/sign-in');

  // Check platform admin flag — use direct DB connection, not pooler
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { is_platform_admin: true }
  });

  if (!user?.is_platform_admin) {
    return NextResponse.redirect('/'); // Silent redirect — no 403 page
  }

  return NextResponse.next();
}
```

**Security rules:**
- `/admin` routes NEVER pass `tenant_id` filter to DB queries — they read across all tenants
- All DB queries in `/admin` use `DATABASE_URL_DIRECT` (bypasses RLS)
- All `/admin` actions are written to `audit_log` with `actor_type: 'platform_admin'`
- `/admin` is excluded from the Clerk organization model — it is user-scoped, not org-scoped
- `is_platform_admin` is never returned in any API response visible to non-admin users

---

## `/admin` Route — Tenant List

**Route:** `GET /admin/tenants`

The primary view. A paginated, filterable list of all tenants with health signals at a glance.

### Columns

| Column | Source | Notes |
|--------|--------|-------|
| Name | `tenants.name` | Links to `/admin/tenants/{id}` |
| Plan | `tenants.plan` + `plan_override` | Shows override badge if active |
| Status | `tenants.subscription_status` | Color-coded pill |
| Members | COUNT from `tenant_memberships` | |
| Records | SUM from `records` WHERE tenant_id | Denormalized daily — not live |
| Last Active | `tenants.last_active_at` | |
| Trial Ends | `tenants.trial_ends_at` | Only shown if `subscription_status = trialing` |
| Churn Risk | `tenants.churn_risk_flag` | 🟡 watch / 🔴 at_risk |
| MRR | Stripe — from `stripe_subscription_id` | Pulled from Stripe on page load (cached 1hr) |

### Filters

| Filter | Options |
|--------|---------|
| Status | All / Trialing / Active / Past Due / Canceled |
| Plan | All / Freelancer / Starter / Professional / Business / Enterprise |
| Churn Risk | All / Flagged Only |
| Last Active | All / Active (7d) / Going Quiet (8–30d) / Dormant (30d+) |

### Automated Churn Risk Signals

A nightly background job (`admin.churn_scan`) sets `churn_risk_flag` automatically based on:

| Signal | Flag Set |
|--------|----------|
| Trial ending in ≤3 days with zero records created | `watch` |
| Subscribed tenant with no login in 14 days | `watch` |
| Subscribed tenant with no login in 30 days | `at_risk` |
| Sync engine has had consecutive failures for 7+ days | `watch` |
| `subscription_status = past_due` for 3+ days | `at_risk` |

Flags set by the job can be overridden manually. Manual flags are never auto-cleared. Auto flags are re-evaluated nightly.

---

## `/admin` Route — Tenant Detail

**Route:** `GET /admin/tenants/{tenantId}`

Full context for a single tenant. Tabbed layout.

### Tab 1: Overview

- Tenant name, created date, plan, status
- Member list with roles, last login, and email addresses
- Workspace list with record counts per workspace
- Internal notes field (free text, saved to `tenants.admin_notes` — add this column)
- Churn risk flag control (set/clear with required note)

### Tab 2: Usage

Live usage meters pulled from database:

| Metric | Source |
|--------|--------|
| Total records | COUNT from `records` WHERE `tenant_id` |
| Records vs plan limit | `tenants.plan` → limit from plan config |
| Active automations | COUNT from `automations` WHERE `status = active` |
| AI credits used (MTD) | SUM from `ai_usage_log` WHERE current month |
| AI credits remaining | Plan budget − used |
| Storage used | SUM from `files` WHERE `tenant_id` |
| Sync connections | COUNT from `base_connections` WHERE `tenant_id` |
| Sync health | Last sync run + error count (7d) |

### Tab 3: Billing

Live data pulled from Stripe via Stripe SDK (not cached — fresh on tab open):

- Current plan + subscription status
- Next billing date + amount
- Payment method on file (last 4, card type)
- Invoice history (last 12 invoices, downloadable)
- **Actions:**
  - Extend trial (select +7d / +14d / +30d / custom date)
  - Apply plan override (force any plan tier, requires reason, optional expiry)
  - Issue refund (opens Stripe refund flow for selected invoice)
  - Cancel subscription (with confirmation modal — triggers Stripe cancel)
  - Reactivate subscription

All billing actions write to `audit_log` and send an automated email to the tenant owner.

### Tab 4: Support History

All `support_requests` for this tenant, newest first. Click to open detail view. Quick-create a support request manually (for phone/email contacts).

### Tab 5: Activity Log

Last 100 `audit_log` entries for this tenant. Filterable by action type.

### Actions — Impersonation

**"View as Tenant"** button on the Overview tab.

Clicking generates a short-lived impersonation token (stored in `admin_impersonation_sessions` — new table, 15 minute TTL). The admin is redirected to the main app with a banner: *"You are viewing as [Tenant Name]. [Exit impersonation]"*. All actions taken during impersonation are tagged in `audit_log` with `actor_type: 'platform_admin_impersonating'` and both the admin user ID and the impersonated tenant.

**Impersonation safety rules:**
- Read-only by default. Writes require explicit confirmation ("You are about to make a change as this tenant").
- Impersonation sessions expire after 15 minutes. The admin is redirected back to `/admin`.
- Impersonation is always logged. No exceptions.

```sql
CREATE TABLE admin_impersonation_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  token         VARCHAR(64) NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_impersonation_token ON admin_impersonation_sessions (token) WHERE ended_at IS NULL;
```

---

## `/admin` Route — Revenue Dashboard

**Route:** `GET /admin/revenue`

All revenue data is pulled from Stripe (with 1-hour Redis cache). No financial data is stored in the EveryStack database — Stripe is the source of truth for billing.

### Metrics

| Metric | Calculation |
|--------|------------|
| MRR | SUM of active subscription amounts / billing period normalized to monthly |
| New MRR (MTD) | MRR from subscriptions started this calendar month |
| Churned MRR (MTD) | MRR from subscriptions canceled this calendar month |
| Net MRR Change | New MRR − Churned MRR |
| Trial Count | COUNT of `subscription_status = trialing` |
| Trial → Paid (30d) | Conversions in rolling 30 days / trials that ended in rolling 30 days |
| Active Subscriptions | COUNT of `subscription_status = active` |
| Past Due | COUNT of `subscription_status = past_due` — requires attention |

### Plan Distribution

Pie/bar breakdown of active subscriptions by plan tier. Source: Stripe subscription metadata (plan stored as Stripe Price ID, mapped to plan name via env config).

### MRR Over Time

30-day chart of daily MRR. Pulled from Stripe's event log on first load, cached.

---

## `/admin` Route — Sync Health

**Route:** `GET /admin/sync-health`

Cross-tenant visibility into sync engine status. This is critical because a silent sync failure is an invisible churn risk.

### View

A table of all tenants with at least one active `base_connections` row:

| Column | Source |
|--------|--------|
| Tenant | `tenants.name` |
| Platform | `base_connections.platform` (airtable / smartsuite / notion) |
| Last Sync | `base_connections.last_synced_at` |
| Status | `base_connections.sync_status` |
| Errors (7d) | COUNT from `sync_failures` WHERE created_at > now() − 7 days |
| Staleness | now() − `last_synced_at` — color-coded (green <1h, yellow 1–6h, red 6h+) |

### Filters

- Show only: Erroring / Stale / All
- Platform: All / Airtable / SmartSuite / Notion

### Actions

- Click a row → goes to that tenant's detail page, Sync tab
- "Flag for follow-up" → sets `churn_risk_flag = watch` on the tenant

---

## `/admin` Route — Support Queue

**Route:** `GET /admin/support`

See `support-system.md` for the full support system specification. The support queue described here is the Tier 2 support staff view within `/admin`. Key points for the `/admin` implementation:

- Support staff access is gated by `users.is_support_agent = true` (distinct from `is_platform_admin`)
- Support agents see: ticket queue, AI draft + confidence score, tenant account context (read-only), reply/escalate controls
- Support agents cannot: access billing data, impersonate users, or use other admin functions
- The queue view, ticket detail layout, and email notification behavior are fully specified in `support-system.md` lines 306–380
- The `ai_support_sessions` table provides the full audit trail for AI interactions on each ticket

---

## `/admin` Route — Broadcast Messaging

**Route:** `GET /admin/broadcasts`

Send in-app notices or emails to all tenants or a defined segment.

### Broadcast Types

| Type | Mechanism | Use Case |
|------|-----------|---------|
| **In-app banner** | Inserts a dismissible notice into the top of the app for targeted tenants, stored in a `platform_notices` table | Maintenance windows, critical announcements |
| **Email blast** | Sends via Resend to the `owner` member of each targeted tenant | Feature announcements, pricing changes |

### Segmentation

| Segment | Definition |
|---------|-----------|
| All active | `subscription_status IN ('active', 'trialing')` |
| Plan tier | Filter by specific plan(s) |
| Trial only | `subscription_status = trialing` |
| Specific tenant | Single tenant by ID |

### `platform_notices` table

```sql
CREATE TABLE platform_notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  body        TEXT NOT NULL,
  type        VARCHAR(20) NOT NULL DEFAULT 'info',  -- info | warning | maintenance
  target      JSONB NOT NULL,  -- { "scope": "all" } | { "scope": "plan", "plans": ["starter"] } | { "scope": "tenant", "tenant_id": "..." }
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  active_until TIMESTAMPTZ,    -- NULL = manual dismiss only
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

In-app: The web app checks for active notices on session load and shows a dismissible top-of-app banner. Dismiss state stored per-user in `user_dismissed_notices` (user_id + notice_id).

---

## `/admin` Route — Feature Flags

**Route:** `GET /admin/feature-flags`

Per-tenant feature flag overrides. Enables early access for specific tenants (enterprise pilots, beta users) or disabling features for misbehaving accounts.

### Model

Feature flags are environment variables at the platform level. Per-tenant overrides are stored in `tenant_feature_flags`:

```sql
CREATE TABLE tenant_feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  flag_name   VARCHAR(100) NOT NULL,
  enabled     BOOLEAN NOT NULL,
  set_by      UUID REFERENCES users(id),
  reason      TEXT,
  expires_at  TIMESTAMPTZ,   -- NULL = permanent
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, flag_name)
);
CREATE INDEX idx_tenant_flags ON tenant_feature_flags (tenant_id);
```

### Flag Resolution (Application Layer)

```typescript
// packages/shared/feature-flags.ts
async function isFeatureEnabled(flagName: string, tenantId: string): Promise<boolean> {
  // 1. Check per-tenant override (Redis cache, 5-min TTL)
  const override = await getFeatureFlagOverride(tenantId, flagName);
  if (override !== null) return override;

  // 2. Fall back to environment config
  return env[`FEATURE_${flagName.toUpperCase()}`] === 'true';
}
```

### Admin UI

A table of all defined feature flags (sourced from a registered flag enum) + any per-tenant overrides currently active. Admin can add/remove overrides per tenant, set expiry dates, and add a required reason.

---

## Platform Workspace

Steven's EveryStack account is a real tenant (`tenants.is_internal = true`) used to operate EveryStack as a business using EveryStack itself. The Platform Workspace is created manually during initial setup.

**Purpose:** Dogfood EveryStack. Surface friction. Use EveryStack's own features to run EveryStack's business. As features mature (automations, portals, AI features), plug them into this workspace first.

### Recommended Tables

| Table Name | Type | Purpose |
|------------|------|---------|
| **Tenant Pipeline** | `table` | Track prospects and trial-to-paid conversion. One record per lead/tenant. Fields: Name, Company, Email, Stage, Plan Interest, Source, Notes, Last Contact |
| **Support Log** | `table` | Mirror/summary of support requests for your own tracking. Could be synced from support_requests via automation once automations are built |
| **Changelog / Releases** | `table` | Track what's been shipped per phase. Used to draft release notes |
| **Roadmap** | `projects` | Phase planning, feature ideas, prioritization |
| **Content Calendar** | `table` | Blog posts, launch announcements, social content |
| **Revenue Tracker** | `table` | Monthly MRR snapshots (manually entered until automation is built) |

### Evolution Over Time

| Phase | New Platform Workspace Capability |
|-------|----------------------------------|
| MVP — Core UX | Create the tables above. Use grid views for everything. |
| Post-MVP — Automations | Automate support log sync from support_requests. Auto-create Tenant Pipeline records on new trial signup (webhook → automation). Send weekly MRR digest to yourself via email automation. |
| Post-MVP — Portals | Create a Quick Portal for each enterprise customer showing their sync status and usage (account health portal). |
| Post-MVP — AI Features | Use AI field agents to auto-summarize support requests, score tenant health, draft release notes from changelog records. |

---

## Build Sequencing

### Schema — MVP — Foundation

The schema additions in this doc are additive — they don't change existing columns or RLS behavior. They must be applied as a migration before MVP — Core UX work begins because:

1. `tenants.stripe_customer_id` and `subscription_status` will be needed as soon as Stripe billing is wired up
2. `users.is_platform_admin` must exist before the `/admin` middleware can be implemented
3. `support_requests` can be added now at zero cost — no behavior changes, just schema

**Status:** Schema migration applied (migrations 0016 + 0017).

### The `/admin` Route — Post-MVP — Platform Operations

The `/admin` route is its own dedicated build scope: **Post-MVP — Platform Operations**. It is not part of the current MVP feature build sequence because:

- It has no bearing on tenant-facing functionality
- It requires Stripe to be wired up first (prerequisite: Stripe billing integration)
- It can be built at any point once the schema exists

**Scope:** Build all `/admin` routes described in this doc. Estimated build: 1 phase.

**Prerequisites:**
- Schema migration from this doc (complete)
- Stripe billing integration (sets `stripe_customer_id`, `subscription_status`, `trial_ends_at`)

### Platform Workspace — Setup

The Platform Workspace can be created at any time after MVP — Core UX is complete. No code required — Steven creates it manually as a normal EveryStack workspace on his account, then marks `tenants.is_internal = true` via a one-time SQL statement.

### Settings Update Required

`settings.md` needs a new section added: **Help & Support** (between Notifications and Data & Privacy). This is the user-facing entry point for submitting support requests. See Claude Code Prompt 2.

### `data-model.md` Update Required

The new tables and column additions must be reflected in `data-model.md`. See Claude Code Prompt 3.

---

## Security Considerations

- The `/admin` route uses `DATABASE_URL_DIRECT` — it bypasses RLS entirely. Any bug here can expose all tenant data. Keep `/admin` route handlers simple and audited.
- `is_platform_admin` is a boolean on the `users` table. It must be excluded from all Drizzle select queries that return user data to tenants. Add it to the RLS-excluded columns list in `CLAUDE.md`.
- Impersonation sessions expire in 15 minutes. The token is a cryptographically random 64-character string (not a JWT — no forgery risk).
- All `/admin` writes are dual-logged: `audit_log` (in DB) + Pino structured log (Sentry/observability pipeline).
- The `/admin` path must be excluded from Clerk's organization-based auth — it is user-scoped only.
