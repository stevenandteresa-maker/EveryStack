# CLAUDE.md — EveryStack

> Root configuration for Claude Code. This is the project-level system prompt.
> For concept definitions and naming: `docs/reference/GLOSSARY.md` (source of truth).
> For document index and phase reading order: `docs/reference/MANIFEST.md`.

---

## Section Index

| Section                                     | Lines     |
|---------------------------------------------|-----------|
| What Is EveryStack                          | 36–44     |
| Tech Stack                                  | 46–71     |
| Monorepo Structure                          | 73–118    |
| Key Commands                                | 120–139   |
| Architecture Fundamentals                   | 141–187   |
| Platform Authentication & Onboarding        | 189–226   |
| Code Conventions                            | 228–265   |
| Testing Rules                               | 267–298   |
| Error Handling — Default Patterns           | 300–340   |
| Critical Rules — Do's and Don'ts            | 342–370   |
| Design Philosophy                           | 372–388   |
| Documentation Hierarchy (3-Tier)            | 390–433   |
| State Files                                 | 435–491   |
| MVP Scope Guard                             | 493–503   |
| Reference Doc vs. Phase Build Doc Hierarchy | 505–513   |
| Agent Roster                                | 515–525   |
| Build Lifecycle — Steps & Planning Gates    | 527–634   |
| Scope Label Discipline                      | 636–647   |
| CockroachDB Readiness — Active Safeguards   | 649–659   |
| Pre-Merge Gates (CI)                        | 661–673   |

---

## What Is EveryStack

EveryStack is a multi-tenant SaaS that unifies no-code databases (Airtable, SmartSuite, Notion). It connects to external platforms via APIs, caches data in PostgreSQL using a canonical JSONB format, and provides cross-platform linking, client portals, document generation, automations, and AI — all from a single interface.

**Target user:** SMBs (2–50 people) using Airtable, SmartSuite, or Notion as their operational backbone.

**Core differentiator:** Cross-base linking. Any table can link to any other table within the same tenant — across workspaces, across platforms. This is what no other product does.

---

## Tech Stack

| Layer                   | Technology                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Framework**           | Next.js (App Router)                                                                            |
| **Language**            | TypeScript (strict mode)                                                                        |
| **Monorepo**            | Turborepo + pnpm workspaces                                                                     |
| **UI**                  | React, shadcn/ui, Tailwind CSS                                                                  |
| **State**               | Zustand (client state), TanStack Query (server state/cache)                                     |
| **Grid virtualization** | TanStack Virtual                                                                                |
| **Database**            | PostgreSQL 16 (pgvector extension), Drizzle ORM                                                 |
| **Connection pooling**  | PgBouncer (transaction mode)                                                                    |
| **Cache / Pub-Sub**     | Redis 7                                                                                         |
| **Realtime**            | Socket.io (Redis adapter for horizontal scaling)                                                |
| **Background jobs**     | BullMQ (Redis-backed)                                                                           |
| **Auth**                | Clerk (users), custom portal auth (magic link / password)                                       |
| **File storage**        | Cloudflare R2 (S3-compatible), presigned URLs                                                   |
| **Email**               | Resend (transactional)                                                                          |
| **PDF generation**      | Gotenberg (sandboxed)                                                                           |
| **Rich text**           | TipTap (2 environments: chat editor, Smart Doc editor)                                          |
| **AI**                  | Anthropic Claude (via AIService abstraction — feature code never references providers directly) |
| **Testing**             | Vitest (unit/integration), Playwright (E2E), axe-core (a11y)                                    |
| **CI/CD**               | GitHub Actions                                                                                  |
| **Node**                | v20                                                                                             |

---

## Monorepo Structure

```
everystack/
├── apps/
│   ├── web/                  # Next.js app (App Router)
│   │   ├── src/
│   │   │   ├── app/          # Routes and layouts
│   │   │   ├── components/   # React components
│   │   │   ├── data/         # Server-side data access (queries, mutations)
│   │   │   ├── actions/      # Server Actions
│   │   │   └── lib/          # Client utilities
│   │   └── e2e/              # Playwright E2E tests
│   ├── worker/               # BullMQ job processors (sync, automations, AI)
│   └── realtime/             # Socket.io server
├── packages/
│   └── shared/
│       ├── db/
│       │   ├── schema/       # Drizzle schema definitions
│       │   └── migrations/   # Drizzle migration files
│       ├── sync/
│       │   ├── adapters/     # Platform adapters (Airtable, Notion, SmartSuite)
│       │   └── field-registry.ts  # FieldTypeRegistry
│       ├── ai/
│       │   ├── providers/    # AIProviderAdapter implementations
│       │   ├── prompts/      # Versioned prompt templates
│       │   ├── tools/        # AI tool definitions
│       │   └── evaluation/   # AI eval suite
│       └── testing/          # Shared test utilities and factories
├── docs/
│   ├── reference/            # Tier 3 deep-dive specs (63 docs)
│   │   ├── GLOSSARY.md       # Source of truth — definitions, naming, MVP scope
│   │   ├── MANIFEST.md       # Document index with status and reading order
│   │   └── *.md              # Domain-specific reference docs
│   ├── decisions/            # ADRs (Architecture Decision Records)
│   ├── phases/               # Phase division docs
│   ├── capture/              # Future ideas, not yet scoped
│   └── subdivisions/         # Subdivision docs produced by Planner Agent (Gate 1)

├── CLAUDE.md                 # This file (Tier 1 — always loaded)
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.test.yml
```

---

## Key Commands

```bash
pnpm install                    # Install all dependencies
pnpm dev                        # Start dev server (Next.js + worker + realtime)
pnpm turbo build                # Build all packages and apps
pnpm turbo lint                 # ESLint (no-console, no-any)
pnpm turbo typecheck            # tsc --noEmit (strict mode)
pnpm turbo check:i18n           # No hardcoded English strings
pnpm turbo test                 # Run unit + integration tests (Vitest)
pnpm turbo test -- --coverage   # Tests with V8 coverage
pnpm turbo test:coverage-check  # Verify coverage thresholds
pnpm turbo test:e2e             # Playwright E2E tests
pnpm turbo test:ai-eval         # AI prompt evaluation suite
pnpm turbo db:migrate           # Run Drizzle migrations
pnpm turbo db:migrate:check     # Migration timing + lock check
pnpm turbo db:seed-staging      # Seed staging-scale synthetic data
```

---

## Architecture Fundamentals

### Data Flow — The Canonical JSONB Pattern

Every record, regardless of source platform, is stored in `records.canonical_data` as JSONB keyed by `fields.id`. This is the single source of truth for all features. Platform adapters translate to/from canonical on sync.

```
Platform API → Adapter.toCanonical() → Canonical JSONB ← All features read/write here
Canonical JSONB → Adapter.fromCanonical() → Platform API (outbound sync)
```

Adding a new platform = writing a new adapter pair. Zero modifications to the sync engine or any feature.

### Multi-Tenant Isolation

Every data table has a `tenant_id` column. Row-Level Security (RLS) enforces isolation at the database level. All queries use `getDbForTenant()` for read/write routing. Tenant isolation is tested with the `testTenantIsolation()` helper — **no exceptions**.

### AI Abstraction — The AIService

All AI features go through `AIService`. Feature code requests a capability tier (`fast`, `standard`, `advanced`), never a provider or model. The service resolves tiers to specific models based on configuration. Provider swaps require zero feature code changes.

### Field Type Registry

All field type transforms are registered per-platform, per-field-type in `packages/shared/sync/field-registry.ts`. Use the registry — never use switch statements on field types.

### Permission Model

Five roles in two layers: **Tenant-level** (Owner, Admin, Member) on `tenant_memberships` and **Workspace-level** (Manager, Team Member, Viewer) on `workspace_memberships`. The Table View is the access boundary for Team Members and Viewers. Permissions are field-level (read-write / read-only / hidden). Internal defaults open, portals default closed.

### Hierarchy

```
Tenant (org, billing, RLS boundary)
  └─ Boards (optional grouping — permission convenience)
      └─ Workspaces (multi-platform table containers)
          ├─ Tables (synced or native)
          │   ├─ Table Views (Grid, Card — MVP)
          │   ├─ Record View (overlay — configurable field canvas)
          │   ├─ Cross-Links (relationships across tables/workspaces/platforms)
          │   └─ Fields (typed columns with canonical JSONB storage)
          ├─ Portals (externally-shared Record View with auth)
          ├─ Forms (Record View layout that creates records)
          ├─ Automations (trigger → action flows)
          └─ Documents (merge-tag templates → PDF)
```

---

## Platform Authentication & Onboarding

### Auth Provider: Clerk

Clerk handles all platform user authentication. EveryStack does NOT implement custom auth for workspace users — only for portal clients (see `portals.md`).

**Clerk provides:** Email + password signup, Google OAuth, email verification, password reset, session management (JWT), multi-device sessions, and the user management API. All auth routes use Clerk's Next.js middleware (`@clerk/nextjs`).

**EveryStack does NOT build:** Login forms, password hashing, session tokens, or OAuth flows for platform users. Clerk components handle the UI. The `userId` from Clerk's session is the identity anchor for all platform operations.

### Signup & Workspace Creation Flow

1. User lands on signup page → Clerk `<SignUp />` component (email + password or Google OAuth).
2. Clerk creates user → Clerk webhook `user.created` fires.
3. Webhook handler creates `tenants` row (Freelancer plan default) + `workspace_memberships` row (role: Owner).
4. User redirected to onboarding wizard (3 steps):
   - **Step 1:** Workspace name, timezone, week start day.
   - **Step 2:** "Connect a platform" — optional Airtable/Notion/SmartSuite OAuth (can skip).
   - **Step 3:** Invite team members (email input, role selector: Admin / Manager). Invites queued.
5. Wizard completes → user lands in workspace. If sync platform connected, sync wizard begins automatically.

### Team Member Invitation Flow

1. Admin/Owner enters email(s) + role in Members & Roles settings (or onboarding Step 3).
2. Server creates `workspace_memberships` row with `status: 'pending'`.
3. System sends invite email via Resend: "You've been invited to join {workspaceName} on EveryStack."
4. **New user:** Clicks link → Clerk signup (pre-filled email) → on signup, webhook resolves pending membership → user lands in workspace.
5. **Existing user:** Clicks link → if already signed in, membership activated immediately → workspace appears in workspace picker. If not signed in, login first.
6. Invite expires after 7 days. Admin can resend from Members & Roles.

### Session Handling

- Clerk manages JWT tokens with automatic refresh.
- Clerk middleware on all `/app/*` routes validates the session. Invalid/expired → redirect to login.
- Portal routes (`/portal/*`) are excluded from Clerk middleware — they use their own session system.
- The `userId` and `tenantId` are extracted from the Clerk session and injected into all Server Actions and API handlers via middleware context. Never trust client-supplied user/tenant IDs.

---

## Code Conventions

### Naming

- **Files:** kebab-case (`record-actions.ts`, `CellRenderer.tsx` for components)
- **Variables / functions:** camelCase
- **Types / interfaces:** PascalCase
- **Database columns:** snake_case
- **Constants:** SCREAMING_SNAKE_CASE
- **JSONB keys in canonical_data:** keyed by `fields.id` (UUID), never by field name

### Patterns

- Always use `async/await`, never raw Promises or `.then()` chains
- Use Zod for all API input validation and AI structured output
- Use Drizzle ORM for all database queries — no raw SQL except in migrations and performance-critical paths
- Server Actions for mutations, `data/` functions for queries
- Use `@` path alias for imports within `apps/web/src/`
- Use `@everystack/db`, `@everystack/sync`, etc. for shared package imports
- Thread table column types: `author_type`, `message_type`, and `scope_type` on thread tables are VARCHAR — never convert to Postgres ENUM. Any code that branches on these values must include a default/fallback branch. TypeScript types for these fields should use `string` with inline comments listing known values, not exhaustive union types. This ensures new values (e.g. `external_inbound`, `activity_log`) can be added post-MVP without requiring type or migration changes.

### Component Conventions

- All UI primitives are shadcn/ui, customized via Tailwind + CSS custom properties
- Fonts: DM Sans (UI/headings), JetBrains Mono (code/technical)
- Base spacing unit: 4px — all spacing multiples of 4
- Touch targets: minimum 44×44px (WCAG 2.5.8)
- Loading states: skeleton screens (not spinners), matching layout shape
- No dark/light mode toggle — hybrid layout: always-dark sidebar, white content, admin-chosen accent header

### TypeScript Rules

- Strict mode enforced (`tsc --noEmit` in CI)
- No `any` (ESLint rule)
- No `console.log` in production code (ESLint rule) — use Pino logger
- No hardcoded English strings — all user-facing text through i18n

---

## Testing Rules

### File Naming

| Test type     | Pattern                         | Location                  |
| ------------- | ------------------------------- | ------------------------- |
| Unit          | `[source].test.ts`              | Co-located with source    |
| Integration   | `[feature].integration.test.ts` | `__tests__/` directories  |
| E2E           | `[flow].spec.ts`                | `apps/web/e2e/`           |
| Component     | `[Component].test.tsx`          | Co-located with component |
| Accessibility | `[feature].a11y.spec.ts`        | `apps/web/e2e/a11y/`      |

### Non-Negotiable Testing Rules

1. **Every `/data` function gets a tenant isolation test.** Use `testTenantIsolation()`. No exceptions.
2. **Tests use factories, not raw inserts.** `createTestTenant()`, `createTestRecord()`, etc. Never hardcode UUIDs.
3. **Integration tests get their own database.** `beforeAll` creates, `afterAll` drops.
4. **No test interdependence.** Each test creates its own state via factories.
5. **Async tests must have timeout.** Unit: 10s, Integration: 30s, E2E: 60s.
6. **New code must have ≥80% line coverage on changed files.** Enforced in CI.

### Coverage Targets (Enforced)

| Path                    | Lines | Branches |
| ----------------------- | ----- | -------- |
| `apps/web/src/data/`    | 95%   | 90%      |
| `packages/shared/db/`   | 90%   | 85%      |
| `packages/shared/sync/` | 90%   | 85%      |
| `apps/web/src/actions/` | 90%   | 85%      |
| `apps/worker/src/jobs/` | 85%   | 80%      |

---

## Error Handling — Default Patterns

When a domain doc is silent on error handling, apply these defaults. Domain-specific error specs (e.g., `permissions.md` § Permission Denial Behavior, `portals.md` § Auth Failure Paths) override these defaults.

### Error Response Shape (All Surfaces)

```typescript
interface AppError {
  code: string; // Machine-readable: 'VALIDATION_FAILED', 'PERMISSION_DENIED', 'NOT_FOUND', 'RATE_LIMITED', 'INTERNAL_ERROR'
  message: string; // Human-readable, safe to display to end users
  details?: Record<string, unknown>; // Optional structured context (field IDs, limits, etc.)
  traceId?: string; // For support debugging — included on 500 errors
}
```

| Surface                        | Success shape   | Error shape                                                                                           | Error status codes                     |
| ------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Server Actions**             | Return value    | Throw `AppError` (caught by global error boundary)                                                    | N/A (not HTTP)                         |
| **Platform API** (`/api/v1/*`) | `{ data: ... }` | `{ error: AppError }` — see `platform-api.md` § Error Format                                          | 400, 401, 403, 404, 409, 422, 429, 500 |
| **Portal endpoints**           | Return value    | `{ error: { code, message } }` — no `details` or `traceId` (never expose internals to portal clients) | 400, 401, 403, 404, 429, 500           |
| **Real-time events**           | Event payload   | No error events sent. Failures are silent (server-side logged). Client recovers via API fallback.     | N/A                                    |

### Default UI Error Behavior

| Error type                  | UI pattern                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Validation (422)**        | Inline field errors. Focus first error. Do not clear form.                                                                                                  |
| **Permission denied (403)** | Toast: "You don't have permission to do that." Revert optimistic update if applicable.                                                                      |
| **Not found (404)**         | Redirect to parent context. Toast: "This item is no longer available."                                                                                      |
| **Rate limited (429)**      | Toast: "Too many requests. Please wait a moment." Disable the action briefly.                                                                               |
| **Conflict (409)**          | Toast: "This was modified by someone else. Please refresh." Offer refresh button.                                                                           |
| **Server error (500)**      | Toast: "Something went wrong. Please try again." Include "Report Issue" link (opens support with `traceId`). Never expose stack traces or internal details. |

### Logging Defaults

- All 500 errors: `console.error` + Sentry (see `observability.md`).
- All 403 errors: write to `audit_log` with `action: 'permission_denied'` (see `permissions.md`).
- All 429 errors: increment rate limit metrics in Redis for monitoring dashboards.
- Validation errors (422): no logging (high volume, low value). Client-side only.

---

## Critical Rules — Do's and Don'ts

### DO

- ✅ Check `GLOSSARY.md` for the correct name of every concept before using it in code, comments, or UI text
- ✅ Use the FieldTypeRegistry for all field type operations
- ✅ Use `getDbForTenant()` for all database access — never bypass tenant routing
- ✅ Use `AIService` capability tiers (`fast`/`standard`/`advanced`) — never reference providers or models
- ✅ Use Pino logger with `AsyncLocalStorage` traceId — never `console.log`
- ✅ Write tenant isolation tests for every data access function
- ✅ Use Zod schemas for all external input validation
- ✅ Use presigned URLs for file uploads — never stream through the server
- ✅ Show AI credit cost before execution, never during or after
- ✅ Use skeleton screens for loading states, never spinners

### DON'T

- ❌ **Never delete or modify existing migration files** — always create new migrations
- ❌ **Never use switch statements on field types** — use the FieldTypeRegistry
- ❌ **Never reference AI providers or models in feature code** — only capability tiers
- ❌ **Never use raw SQL outside of migrations** — use Drizzle ORM
- ❌ **Never hardcode UUIDs in tests** — use factories
- ❌ **Never bypass RLS or tenant isolation** — every query must be tenant-scoped
- ❌ **Never build post-MVP features** unless explicitly instructed — check the GLOSSARY.md MVP scope
- ❌ **Never invent new names for existing concepts** — if it's in the glossary, use the glossary term exactly
- ❌ **Never sync computed fields back to platforms** — Lookup, Rollup, Formula, Count are read-only
- ❌ **Never acquire ACCESS EXCLUSIVE lock for >1s in migrations** — CI will reject it

---

## Design Philosophy

**Simple, intuitive first — capable underneath.** Every feature uses progressive disclosure:

- **Level 1 (80%):** No jargon. Smart defaults. Templates as entry points. Feels complete.
- **Level 2 (15%):** One click deeper. Full option sets. Still visual, guided.
- **Level 3 (5%):** Expert mode. Custom code, raw expressions, cron syntax.

**Three creation flow patterns — no more:**

1. **Inline Create** — for records (fast, contextual, template-optional)
2. **Wizard Create** — for configured entities like portals and forms (2–3 steps)
3. **Recipe Create** — for logic entities like automations (pre-built templates first)

When specifying a new creation flow, map it to one of these three. If it doesn't fit, redesign the flow — not the pattern.

---

## Documentation Hierarchy (3-Tier)

| Tier              | Location                      | Loaded                         | Purpose                                     |
| ----------------- | ----------------------------- | ------------------------------ | ------------------------------------------- |
| **1 — Root**      | `CLAUDE.md` (this file)       | Always                         | Project-wide rules, tech stack, conventions |
| **2 — Directory** | `CLAUDE.md` in each directory | When working in that directory | Directory-specific rules and patterns       |
| **3 — Reference** | `docs/reference/*.md`         | On demand when needed          | Deep-dive specs for each domain             |

### How to Use Reference Docs

When working on a feature:

1. Check `docs/reference/MANIFEST.md` for which reference docs are relevant
2. Load the relevant reference doc(s) from `docs/reference/` for architectural context
3. **Phase build docs** (created per sprint) tell you WHAT to build and in what order — they override any sequencing suggestions in reference docs
4. **Reference docs** tell you HOW each system works
5. **Directory CLAUDE.md files** tell you the RULES for code in that directory

### Key Reference Docs by Domain

| Domain                         | Reference Doc(s)                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Naming, MVP scope, definitions | `GLOSSARY.md` — **always check this first**                                                   |
| Database schema                | `data-model.md`                                                                               |
| Sync engine                    | `sync-engine.md`                                                                              |
| Permissions                    | `permissions.md`                                                                              |
| UI/design                      | `design-system.md`                                                                            |
| Navigation/sidebar             | `navigation.md`                                                                               |
| AI features                    | `ai-architecture.md`, `ai-data-contract.md`, `ai-metering.md`, `schema-descriptor-service.md`, `ai-skills-architecture.md`, `platform-maintenance-agents.md` |
| Testing                        | `testing.md`                                                                                  |
| Cross-linking                  | `cross-linking.md`                                                                            |
| Portals                        | `portals.md`                                                                                  |
| Forms                          | `forms.md`                                                                                    |
| Automations                    | `automations.md`                                                                              |
| Documents                      | `smart-docs.md`                                                                               |
| Communications                 | `communications.md`, `email.md`                                                               |
| Files                          | `files.md`                                                                                    |
| Platform API                   | `platform-api.md`                                                                             |
| Compliance/security            | `compliance.md`                                                                               |
| CI/CD, operations              | `testing.md`, `operations.md`, `observability.md`                                             |
| Mobile                         | `mobile.md`                                                                                   |
| Reference doc scope map        | `MANIFEST.md` > "Reference Doc Scope Map"                                                     |

---

## State Files

Three persistent state files live at the repo root alongside CLAUDE.md,
GLOSSARY.md, and MANIFEST.md. They track build state that would otherwise
be lost between agent sessions.

### DECISIONS.md — Tactical Decisions Log

Running log of within-session decisions (newest first). Captures choices
that don't warrant a full ADR but that downstream agents need visibility
into — approach selections, deferrals, ambiguity resolutions.

- **Written by:** Build Agent (Step 3), Architect Agent (Step 0)
- **Read by:** All agents
- **Not a replacement for ADRs.** If you chose between 2+ viable
  architectural approaches, write an ADR in `docs/decisions/`. Use
  DECISIONS.md for tactical calls within a single session.

### MODIFICATIONS.md — Per-Session Changelog

Structured record of every file created, modified, or deleted during each
build session. Includes schema changes and new domain terms. Bridges the
Build Agent and Docs Agent — the Docs Agent reads this instead of
reconstructing changes from `git diff`.

- **Written by:** Build Agent (Step 3), appended after each session
- **Read by:** Reviewer Agent (Step 4) for diff cross-checking, Docs
  Agent (Step 5) for MANIFEST/GLOSSARY updates, Planner for progress
  assessment
- **Archived by:** Docs Agent moves completed sessions to the archive
  section after Step 5 merges

### TASK-STATUS.md — Unit Checklist

Checklist of subdivision units per sub-phase with status tracking. Every
agent session starts by reading this file for orientation.

- **Written by:** Planner (initial checklist), all agents (status updates)
- **Read by:** All agents at session start
- **Statuses:** `pending` → `in-progress` → `passed-review` → `docs-synced`
  (or `failed-review` → retry, or `blocked`)
- **Sub-phase complete when:** All units show `docs-synced`

### Rules for All State Files

1. **Always append, never rewrite.** New entries go at the top (DECISIONS)
   or bottom (MODIFICATIONS, TASK-STATUS) of the active section. Never
   edit previous entries except to update status fields.
2. **Write as part of execution, not as an afterthought.** The Build Agent
   writes its MODIFICATIONS block before ending the session, not after.
3. **State files are not authoritative for architecture.** GLOSSARY.md,
   CLAUDE.md, MANIFEST.md, and ADRs remain the long-term persistent layer.
   State files track workflow state, not design decisions.
4. **State files are committed to the repo** on the same branch as the
   work they describe. They are part of the git history.

---

## MVP Scope Guard

The GLOSSARY.md defines what is and isn't MVP. Before building anything, verify its scope:

**MVP includes:** Sync Engine (Airtable, Notion, SmartSuite), Grid + Card views, Record View, Cross-Links, Quick Portals, Quick Forms, linear Automations (6 triggers, 7 actions), Document Templates (PDF via Gotenberg), Record Thread + DMs, Command Bar, AI (Natural Language Search, Smart Fill, Record Summarization, Document AI Draft, Field & Link Suggestions), Platform API (phased), My Office, Settings.

**MVP explicitly excludes:** Kanban/List/Gantt/Calendar views, App Designer, App Portals, App Forms, Visual automation canvas, Formula engine, AI Agents, Vector embeddings, DuckDB Context Layer, Custom Apps, Booking/Scheduling, Accounting integration, Self-hosted AI.

Build clean extension points for post-MVP, but do not build the extensions themselves.

---

## Reference Doc vs. Phase Build Doc Hierarchy

Reference docs (this `docs/reference/` directory) define **what each system is and how it works** — architecture, schemas, behavior, rules, and scope (MVP vs. Post-MVP).

Phase build docs (created per sprint) define **what to build and in what order** — sequencing, sprint scope, and prompt decomposition.

**Hierarchy rule:** If a phase build doc and a reference doc give conflicting guidance on _build order or sequencing_, the phase build doc wins. Reference docs are authoritative on _architecture, schema, and behavior_.

Reference docs use **scope labels** (e.g., "MVP — Core UX", "Post-MVP — Automations"), never phase numbers. Phase build docs may use their own internal numbering for sprints.

## Agent Roster

| Agent     | Lifecycle Position        | Branch Prefix | Primary Output                |
|-----------|---------------------------|---------------|-------------------------------|
| Architect | Step 0 — Doc Prep         | `docs/`       | Reference doc updates, ADRs   |
| Planner   | Gate 1 — Subdivision      | `plan/`       | Subdivision docs, TASK-STATUS |
| Builder   | Step 3 — Build            | `build/`      | Application code              |
| Reviewer  | Step 4 — Review           | (none)        | Pass/fail verdicts            |
| Docs      | Step 5 — Docs Sync        | `fix/`        | MANIFEST, GLOSSARY updates    |

---

## Build Lifecycle — Steps & Planning Gates

The full lifecycle with planning gates:

```
Step 0: Doc Prep (Architect Agent)
  ↓
Gate 1: Subdivision Planning (Planner Agent)
  ↓
Step 1: Playbook Generation
  ↓
Step 2: Prompting Roadmap Generation
  ↓
Gate 2: Pre-Build Context Curation (Planner Agent)
  ↓
Step 3: Build Execution (Build Agent)
  ↓
Step 4: Review (Reviewer Agent)
  ↓ (if FAIL → Gate 3: Replanning by Planner Agent)
  ↓ (if PASS)
Step 5: Docs Sync (Docs Agent)
  ↓
Gate 4: Phase Boundary Summary (Planner Agent)
```

### Gate 1: Pre-Subdivision Planning (between Step 0 and Step 1)

Before generating a playbook, the Planner (or Architect) produces a
**subdivision doc** that breaks the sub-phase into tightly scoped units.
Each unit carries:

- **Big-picture anchor** — one paragraph on where this unit fits in the
  platform
- **Interface contract** — the exact exports, types, schema additions,
  or API surfaces this unit produces that downstream units consume
- **Context manifest** — the specific doc sections (by line range) and
  source files the Build Agent needs for this unit and nothing more
- **Acceptance criteria** — scoped from the playbook to this unit only

The subdivision doc populates TASK-STATUS.md with the initial unit
checklist. Playbooks are then generated at the subdivision level.

**Context budget test:** If a unit's context manifest would exceed ~40%
of a Claude Code context window (including CLAUDE.md, GLOSSARY.md, and
the relevant source files), the unit must be subdivided further.

### Reasoning Surface Audit (RSA)

Every unit in a subdivision doc and every prompt in a playbook carries
an RSA classification. The Planner assigns unit-level classifications
during Gate 1. The Playbook Author refines to prompt-level during
Step 1. The Reviewer uses classifications to calibrate review depth
during Step 4.

**Classifications:**
- **D (Deterministic Path):** Spec fully determines the output.
  Builder translates spec → code. Reviewer does a binary spec-match
  check.
- **SH (Structured Handoff):** Spec says WHAT, builder decides HOW.
  Reviewer validates against documented constraints.
- **PJ (Pure Judgment):** Spec has a gap. Must be surfaced to Steven
  before build. Builder uses judgment; reviewer flags the decision
  for Steven's attention.

**PJ pre-build gate:** All PJ-classified prompts are presented to
Steven before Step 3. He resolves the gap (upgrading classification)
or confirms the builder should proceed with judgment.

**L1 training data:** RSA classifications and rationale text are
captured as training data for AbleSpec's L3 Decomposition Engine.
Rich rationale (referencing specific spec sections) is more valuable
than bare labels.

### Gate 2: Pre-Build Context Curation (between Step 2 and Step 3)

For each prompt in the Prompting Roadmap, the Planner annotates a
**context manifest** — the exact doc sections and source files that
prompt needs. This is recorded in the Prompting Roadmap itself.

The Build Agent loads only what the context manifest specifies. No
speculative loading of "might be relevant" docs.

### Gate 3: Post-Failure Replanning (within Step 3/4 loop)

When a review verdict is FAIL, the Planner assesses whether the failure
affects sibling or downstream units before the Build Agent retries:

- **Isolated failure:** Only the failed unit retries. No changes to
  other units.
- **Contract-breaking failure:** The failed unit's interface contract
  couldn't be met as specified. Downstream units that consume this
  contract move to `blocked` in TASK-STATUS.md. The Planner may revise
  the subdivision doc.
- **Cascading failure:** The failure reveals a spec gap. Escalate to
  Steven — this may require returning to Step 0.

### Gate 4: Phase Boundary Summary (after Step 5)

After the Docs Agent completes Step 5 for the final unit in a sub-phase,
the Planner produces a **completion summary** that:

1. Confirms all units in TASK-STATUS.md show `docs-synced`
2. Lists any DECISIONS.md entries that should be promoted to ADRs
3. Proposes CLAUDE.md updates if conventions evolved during the build
4. Identifies any spec gaps discovered during build that need Step 0
   attention in the next sub-phase

---

## Scope Label Discipline

Reference docs classify features using these scope labels:

**MVP scopes:** MVP — Foundation, MVP — Sync, MVP — Core UX, MVP — AI, MVP — API

**Post-MVP scopes:** Post-MVP — Portals & Apps, Post-MVP — Documents, Post-MVP — Automations, Post-MVP — Comms & Polish, Post-MVP — Verticals & Advanced, Post-MVP — Custom Apps, Post-MVP — Self-Hosted AI

❌ Never write "Phase 3" or "Phase 7" in reference docs.
✅ Write "MVP — Core UX" or "Post-MVP — Comms & Polish".

---

## CockroachDB Readiness — Active Safeguards

These 5 safeguards are active from MVP — Foundation. They ensure a smooth migration path to CockroachDB post-MVP:

1. **UUIDv7 for all primary keys** — no serial/auto-increment
2. **No PostgreSQL-specific syntax** in application queries (CTEs, JSONB operators through Drizzle helpers)
3. **Explicit transaction boundaries** via `getDbForTenant()` helpers
4. **No advisory locks** — use Redis-based distributed locks
5. **Hash partitioning compatible schemas** — tenant_id as partition key

---

## Pre-Merge Gates (CI)

All 9 must pass before merging to main:

1. TypeScript compiles with zero errors (strict mode)
2. ESLint passes with zero errors
3. i18n completeness check (no hardcoded English strings)
4. All Tier 1 tests pass
5. All Tier 2 tests pass for changed packages
6. Coverage thresholds met for changed packages
7. New code coverage ≥80% on changed files
8. Migration check passes (if migrations changed) — no ACCESS EXCLUSIVE lock >1s, no migration >30s
9. AI eval passes at ≥95% schema compliance (if prompts changed)
