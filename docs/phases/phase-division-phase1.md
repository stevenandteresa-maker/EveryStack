# Phase 1: MVP — Foundation — Sub-Phase Division

## Section Index

| Section | Lines | Summary |
|---------|-------|---------|
| Summary | 12–15 | Sub-phase count, prompt total, cross-cutting concerns established in Phase 1 |
| Sub-Phases (1A--1J) | 17–365 | Ten sub-phase definitions with scope, reference docs, dependencies, sizing, and existing roadmaps |
| Dependency Graph | 367–387 | ASCII DAG of 1A--1J with parallel execution notes |
| Validation Checklist | 389–403 | 12-item verification of one-sentence test, prompt ceilings, table coverage, and CP retroactive handling |

## Summary
- Sub-phases: 10
- Estimated total prompts: 86
- Key cross-cutting concerns established: tenant isolation (`tenant_id` on every query), environment column (`'live'` only, enforced), design system tokens (Obsidian Teal), workspace role model (5 roles), FieldTypeRegistry pattern, canonical JSONB pattern, error handling (typed errors), i18n (`t('key')` everywhere), AIService abstraction (capability tiers), audit trail (seven-source attribution), real-time event bus (Redis pub/sub + Socket.io)

## Sub-Phases

Covers 1A — Monorepo, CI Pipeline, Dev Environment, 1B — Database Schema, Connection Pooling, Tenant Routing, 1C — Authentication, Tenant Isolation, Workspace Roles, 1D — Observability, Security Hardening, 1E — Testing Infrastructure, 1F — Design System Foundation.
Touches `tenant_relationships`, `effective_memberships`, `personal_tenant_id`, `portal_access`, `revoked_at` tables. See `middleware.ts`, `tenant-resolver.ts`.

### 1A — Monorepo, CI Pipeline, Dev Environment

**One-sentence scope:** Bootstraps the runnable monorepo shell from empty directory to green CI with Docker Compose dev services, linting, and formatting.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| CLAUDE.md | Tech Stack, Monorepo Structure, Key Commands, Code Conventions, Pre-Merge Gates | Full doc (context) | ~461 |
| testing.md | CI Pipeline (GitHub Actions) | 693–886 | ~194 |
| operations.md | Docker Compose, .env.example, Graceful Shutdown | Scattered (~80 lines) | ~80 |

**Total reference lines:** ~735 (but CLAUDE.md is always-loaded context, not read fresh — effective new reading: ~274)

**Scope Boundaries:**
- **Includes:** Turborepo workspace config (`turbo.json`), pnpm workspaces, `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` package scaffolds, Docker Compose (`docker-compose.yml` with PostgreSQL 16 + PgBouncer + Redis), GitHub Actions CI workflow (lint → typecheck → unit-test → migration-check gates), ESLint + Prettier config, `tsconfig.json` strict mode, `.env.example`, `docker-compose.test.yml` for CI
- **Excludes:** Database schema (1B), any application code, E2E tests (Playwright setup is 1E), production deployment config
- **Creates schema for:** None (package scaffolds only)

**Dependencies:**
- **Depends on:** None (first sub-phase)
- **Unlocks:** 1B, 1C, 1D, 1E, 1F, 1G, 1H, 1I, 1J (all subsequent sub-phases)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 8
- **Complexity:** Medium
- **Key risk:** Turborepo + pnpm workspace config getting the monorepo package resolution right on first try

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1B — Database Schema, Connection Pooling, Tenant Routing

**One-sentence scope:** Creates the complete database layer — Drizzle ORM schemas for all 52 MVP tables across Tiers 0–7 (including `tenant_relationships` from CP-002), PgBouncer connection pooling, tenant-isolated read/write routing via `getDbForTenant()`, RLS policies, UUIDv7 primary keys, initial migrations.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| data-model.md | Database Schema — MVP Entities, Field System Architecture, Cross-Linking Architecture, Bidirectional Sync Architecture | 24–574 | ~490 |
| database-scaling.md | Connection Pooling, Read/Write Routing + `getDbForTenant()`, Table Partitioning, Tenant-Aware Resource Protection, RLS at Scale, Zero-Downtime Migration Rules | 29–222 | ~179 |
| cockroachdb-readiness.md | Development Safeguards | 291–331 | ~41 |
| compliance.md | Row-Level Security Policies | 198–217 | ~20 |

**Total reference lines:** ~730

**Scope Boundaries:**
- **Includes:** Drizzle schema files for all 52 MVP tables (17 Foundation + 1 CP-002 + 4 Sync + 30 Core UX — schema created upfront, populated in later phases), `drizzle.config.ts`, migration files, PgBouncer config (transaction mode), `getDbForTenant()` with read/write intent routing (`dbRead` + `db`), RLS policies on all tenant-scoped tables, hash partitioning for `records` table (16 partitions), UUIDv7 generation utility (no `serial`), `adjustFieldValue()` atomic JSONB utility, statement timeout guardrails, zero-downtime migration patterns
- **Excludes:** tsvector indexing (Core UX search), JSONB expression indexes (Core UX), CockroachDB regional routing (post-MVP), application-level CRUD helpers, any UI code
- **Creates schema for:** users, tenants, tenant_memberships, boards, board_memberships, workspaces, workspace_memberships, base_connections, tables, fields, records, cross_links, cross_link_index, views, user_view_preferences, record_view_configs, record_templates, sections, portals, portal_access, portal_sessions, forms, form_submissions, synced_field_mappings, sync_conflicts, sync_failures, sync_schema_changes, threads, thread_participants, thread_messages, user_saved_messages, user_tasks, user_events, user_notes, notifications, user_notification_preferences, document_templates, generated_documents, automations, automation_runs, webhook_endpoints, webhook_delivery_log, ai_usage_log, ai_credit_ledger, audit_log, api_keys, api_request_log, user_recent_items, command_bar_sessions, feature_suggestions, feature_votes, tenant_relationships

> **CP-001/CP-002 retroactive note:** 1B shipped with 51 tables. The following changes are applied as a migration in sub-phase 1J (not retrofitted into the original 1B migration):
> - `tenant_relationships` table (~14 columns) + `effective_memberships` database view (CP-002)
> - `users` + `personal_tenant_id` column, `workspaces` + 2 transfer columns (CP-002)
> - `portal_access` + 4 columns (`revoked_at`, `revoked_reason`, `record_slug`, `linked_record_id`) (CP-001)
> - `portals` constraint change: `UNIQUE (slug)` → `UNIQUE (tenant_id, slug)` (CP-001)
> - `threads` column replace: `visibility` → `thread_type` + `UNIQUE (scope_type, scope_id, thread_type)` (CP-001)
> Final table count after 1J migration: 52. Column counts: portal_access 13 (was 9), users 8 (was 7), workspaces 13 (was 11).

**Dependencies:**
- **Depends on:** 1A (monorepo + Docker Compose with Postgres)
- **Unlocks:** 1C (needs workspace_memberships for roles), 1D (needs tables for PII annotations), 1E (needs schemas for test factories), 1G (needs tables for room identifiers), 1H (needs ai_usage_log/ai_credit_ledger), 1I (needs audit_log/api_keys), Phase 2 (Sync needs base_connections, tables, fields, records), 3G-ii (needs user_notes table)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 13
- **Complexity:** High
- **Key risk:** Foreign key dependency ordering across 52 tables — incorrect tier ordering causes migration failures

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1C — Authentication, Tenant Isolation, Workspace Roles

**One-sentence scope:** Integrates Clerk authentication with workspace-scoped tenant isolation, the five-role hierarchy, permission check utilities, and the `PermissionDeniedError` shape.

> **CP-002 retroactive note:** 1C shipped with `tenant_memberships`-based auth resolution. The following middleware updates are applied in sub-phase 1J:
> - Auth resolution swaps from `tenant_memberships` to the `effective_memberships` view (union of tenant_memberships + tenant_relationships)
> - Clerk `setActive()` + Redis hybrid for tenant switching
> - `tenant_relationships` recognised as valid access grant with synthesised role derivation
> - Personal tenant auto-provisioning on `user.created` webhook

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| permissions.md | Core Principles, Workspace Roles, Permission Denial Behavior, Tenant Isolation, Phase Implementation | 43–86, 409–475 | ~102 |
| CLAUDE.md | Platform Authentication & Onboarding, Architecture Fundamentals (tenant isolation rules) | Context (always loaded) | ~30 |

**Total reference lines:** ~132

**Scope Boundaries:**
- **Includes:** Clerk middleware in `middleware.ts` (protecting all routes except public/webhooks/portal), `getTenantId()` from Clerk session (never from client), Clerk webhook handler for `user.created` / `organization.created`, `tenant-resolver.ts` (Clerk org ID → internal tenant UUID lookup), five workspace roles on `workspace_memberships.role` column (Owner, Admin, Manager, Team Member, Viewer), `checkRole()` / `requireRole()` utility functions, `PermissionDeniedError` typed error with HTTP 403, cross-tenant returns 404 (prevents enumeration), workspace ID from URL for navigation only — never for data access
- **Excludes:** Full field-level permission model (Core UX), table-view-based access control (Core UX), permission configuration UI (Core UX), permission caching in Redis (Core UX), portal client permissions (post-MVP)
- **Creates schema for:** None (workspace_memberships.role column defined in 1B)

**Dependencies:**
- **Depends on:** 1A (monorepo + web app scaffold), 1B (users, tenants, workspace_memberships tables)
- **Unlocks:** 1G (Socket.io needs Clerk auth for connections), 1I (API auth needs tenant context), Phase 2 (Sync needs tenant isolation), Phase 3 (Core UX needs auth + roles for every feature)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 5
- **Complexity:** Medium
- **Key risk:** Clerk webhook handler reliability — missed `user.created` events break the user → tenant_membership chain

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1D — Observability, Security Hardening

**One-sentence scope:** Establishes the cross-cutting runtime infrastructure: structured logging with Pino, distributed tracing via AsyncLocalStorage + OpenTelemetry, Sentry error tracking, security headers, encryption enforcement, webhook signature verification patterns.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| observability.md | All sections (Stack, Logging, Sentry, OTel, AI Telemetry, Dashboards, Alerting, Phase Implementation) | Full doc | ~173 |
| compliance.md | Core Principle, PII Handling, Encryption, Security Headers, Webhook Signatures & Gotenberg | 32–196, 219–243 | ~165 |

**Total reference lines:** ~338

**Scope Boundaries:**
- **Includes:** Pino logger config with PII redaction, `pino-http` middleware, `traceId` via `AsyncLocalStorage` on all requests/jobs, Sentry DSN + error boundary config, OpenTelemetry auto-instrumentation (HTTP, Postgres, Redis), PII column annotations on schema, encryption-at-rest verification (Postgres, Redis, R2), TLS 1.2+ on all connections, security headers middleware (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy), HMAC signature verification pattern for inbound webhooks (Clerk, Stripe, Resend), typed error classes (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`)
- **Excludes:** Monitoring dashboards (operational), alerting rules (operational), WAF rules (production), session management controls (Enterprise post-MVP), SAML SSO / SCIM (post-MVP), portal-specific CSP (post-MVP), Gotenberg sandboxing (Documents phase)
- **Creates schema for:** None

**Dependencies:**
- **Depends on:** 1A (monorepo), 1B (tables for PII annotations)
- **Unlocks:** 1G (real-time needs logging), 1H (AI needs telemetry), 1I (API auth needs logging + security patterns), Phase 2 (Sync needs structured logging), Phase 3 (all features need observability)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 7
- **Complexity:** Medium
- **Key risk:** OpenTelemetry auto-instrumentation adding unexpected latency overhead to hot paths

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1E — Testing Infrastructure

**One-sentence scope:** Builds the complete test infrastructure with Vitest monorepo workspace, Playwright E2E setup, test data factories, `testTenantIsolation()` helper, mock Clerk sessions, MSW mocks, Docker Compose test services.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| testing.md | Test Framework, File Conventions, Test Utilities, Priority Tiers, Coverage Targets, Vitest Configuration, Playwright Configuration, Docker Compose for Test Services, Accessibility Testing, Performance Regression Testing, Staging Database Management, Local Development Testing | 34–692, 887–1002 | ~773 |

**Total reference lines:** ~773

**Scope Boundaries:**
- **Includes:** `vitest.workspace.ts` monorepo config, per-package Vitest configs (`apps/web`, `apps/worker`, `packages/shared`), test setup files, Playwright config with 3 viewport projects (desktop, tablet, phone), `docker-compose.test.yml` (Postgres + PgBouncer + Redis on tmpfs), test factories (`createTestTenant`, `createTestRecord`, `createTestUser`, `createTestWorkspace`, etc.), `testTenantIsolation()` helper, mock Clerk session utility, MSW handlers for external APIs, `expectQueryTime()` performance guard, axe-core accessibility test helper, coverage thresholds per package, staging seed script skeleton
- **Excludes:** CI pipeline YAML (already in 1A), actual feature tests (written alongside features in Core UX), E2E test scenarios (written during Core UX)
- **Creates schema for:** None

**Dependencies:**
- **Depends on:** 1A (CI pipeline), 1B (table schemas for factories), 1C (Clerk mock needs auth shape)
- **Unlocks:** All subsequent sub-phases (test utilities available), Phase 2 (Sync tests), Phase 3 (Core UX tests)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 8
- **Complexity:** Medium
- **Key risk:** Test factory type safety — factories must stay in sync with Drizzle schema changes or tests break silently

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1F — Design System Foundation

**One-sentence scope:** Installs the design system foundation with shadcn/ui primitives, Tailwind token system, three-layer color architecture (surface + accent + data palette), typography (DM Sans + JetBrains Mono), responsive application shell layout.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| design-system.md | Foundations, Color Model — Hybrid Layout, Process State Color Language, Text Contrast, Typography Scale, Spacing, Component Specifications, Application Shell (Responsive), Responsive Architecture, Progressive Disclosure, Shared Responsive Patterns, Ergonomic Design Constraints, AI Credit Display Pattern, Creation Flow Patterns | Full doc | ~357 |

**Total reference lines:** ~357

**Scope Boundaries:**
- **Includes:** shadcn/ui CLI installation of core primitives (Button, Input, Card, Dialog, Dropdown, Badge, Tooltip, Select, Popover, Tabs, Sheet, Command, etc.), `tailwind.config.ts` with Obsidian Teal CSS custom properties, three-layer color architecture (surface tokens `sidebarBg`/`contentBg`/`panelBg`/`cardBg`, 8 curated workspace accent colors with default Teal `#0D9488`, 12-color data palette), process state color language (7 semantic states), DM Sans + JetBrains Mono font installation, 4px base spacing scale, `globals.css` with CSS custom properties, responsive application shell skeleton (sidebar 48/280px, header with accent, content area, right panel placeholder), CSS logical properties enforcement (`margin-inline-start` not `margin-left`), responsive breakpoints (phone/tablet/desktop), touch target minimums (44px)
- **Excludes:** Feature-specific component compositions (Core UX), chart components (post-MVP), portal theming (post-MVP), mobile-specific navigation (Core UX), widget grid layout (Core UX)
- **Creates schema for:** None

> **CP-002 retroactive note:** The following design tokens were not in scope when 1F shipped and are delivered in sub-phase 1J:
> - `--shell-accent` per-tenant colour CSS custom property
> - Portal accent colour token (system-owned, not customisable)
> - Shell repainting mechanism on tenant switch (CSS transition / class swap)

**Dependencies:**
- **Depends on:** 1A (monorepo + web app package)
- **Unlocks:** 1J (navigation shell needs design system tokens), Phase 3 (every UI component needs design system), 1G (real-time connection status indicator), 1H (AI credit display pattern)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 8
- **Complexity:** Medium
- **Key risk:** CSS custom property naming conflicts between shadcn defaults and Obsidian Teal tokens

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1G — Runtime Services: Real-Time Scaffold, Background Worker, File Upload

**One-sentence scope:** Creates the server-side runtime services: Socket.io real-time scaffold with Redis pub/sub, BullMQ background job processing skeleton, file upload pipeline with R2 storage.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| realtime.md | Core Principle, Transport Abstraction, Room Model, Connection Lifecycle, Event Flow, Horizontal Scaling, Deployment, Phase Implementation | Full doc (Foundation scaffold portions) | ~150 |
| files.md | File Types, Data Model, Storage Client, Upload Flow, Content-Type Security, Image Processing, Virus Scanning, Serving Strategy, File Size Limits, Orphan Cleanup, Audit & Access Logging, Phase Implementation | 29–340 | ~312 |

**Total reference lines:** ~462

**Scope Boundaries:**
- **Includes:** `apps/realtime` Socket.io server with Clerk JWT auth verification on connection, Redis adapter for horizontal scaling, room model (`workspace:{id}`, `table:{id}`, `record:{id}`), room join/leave with tenant verification, `RealtimeService` interface for feature code (emit/subscribe via Redis pub/sub — no direct Socket.io in features), reconnection strategy with exponential backoff, `apps/worker` BullMQ skeleton with queue definitions (sync, file-processing, email, automation, document-gen, cleanup), job processor base class, Redis connection config, graceful shutdown, `StorageClient` interface (`upload`, `download`, `getSignedUrl`, `delete`), R2 implementation of `StorageClient`, presigned URL upload endpoint (`/api/upload`), MIME allowlist with magic byte verification, image processing pipeline (Sharp — thumbnails, resize variants), ClamAV virus scanning integration (async scan after upload), CDN serving strategy (public files via CDN, authenticated via signed URLs), per-plan file size limits, orphan cleanup scheduled job
- **Excludes:** Presence system (Core UX), chat/DM message delivery (Core UX), Smart Doc co-editing (post-MVP), sync status push (Sync phase), cursor broadcasting (post-MVP), actual sync/automation/email jobs (later phases populate queues), Document Intelligence extraction (post-MVP)
- **Creates schema for:** None (tables defined in 1B)

**Dependencies:**
- **Depends on:** 1A (monorepo packages), 1B (schema for room identifiers, file field values), 1C (Clerk auth for socket connections), 1D (logging for services)
- **Unlocks:** Phase 2 (Sync needs BullMQ worker + real-time scaffold for sync status push), Phase 3 (Core UX needs real-time for grid live updates, presence, file upload for attachments)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 9
- **Complexity:** Medium-High
- **Key risk:** Socket.io + Clerk JWT handshake timing — token refresh during active connection requires reconnection without data loss

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1H — AI Service Layer

**One-sentence scope:** Creates the AI service abstraction with provider adapter interface, Anthropic SDK integration, capability-based model routing, prompt registry with versioning, AI-to-canonical data contract signatures, credit metering flow.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| ai-architecture.md | Core Principle, AI Capabilities, Provider Adapter Interface, Capability-Based Model Routing, Prompt Registry & Versioning, Tool Definition Abstraction, Streaming Support, Technical Architecture, Phase Implementation | 40–250, 366–376 | ~196 |
| ai-data-contract.md | Core Principle, Two Translation Functions, Per-Field-Type Mapping, Integration with Existing Validation, Implementation Notes | Full doc (Foundation portions) | ~120 |
| ai-metering.md | AI Independence Guarantee, Anthropic API Pricing Reference, AI Usage Logging Infrastructure, Credit Budget & Metering System, AIService Wrapper Implementation, AIFeature Enum | 43–212, 304–337, 425–438 | ~220 |

**Total reference lines:** ~536

**Scope Boundaries:**
- **Includes:** `AIProviderAdapter` TypeScript interface (with `generateText`, `generateStructuredOutput`, `streamText` methods), Anthropic SDK adapter implementation, capability-based model routing (4 tiers: `basic` → `fast` → `standard` → `advanced`, mapped to Haiku/Sonnet/Opus), `PromptTemplate` interface with version tracking, `ToolDefinition` interface (JSON Schema params + pure function handlers — MCP-compatible), `AIService` singleton entry point (all AI calls go through this), Vercel AI SDK streaming integration, `canonicalToAIContext()` function signatures + basic type implementations, `aiToCanonical()` function signatures + basic type implementations, `ai_usage_log` write path (cost calculation: input tokens × price + output tokens × price), `ai_credit_ledger` credit tracking (1 credit = $0.01), metering flow (pre-check budget → execute → log → deduct credits), `AIFeature` enum (13 values), AI independence guarantee (14 core workflows function without AI)
- **Excludes:** Agent runtime (post-MVP), DuckDB context layer (post-MVP), vector embeddings (post-MVP), AI field agents (post-MVP), self-hosted LLM adapter (post-MVP), MCP server/client (post-MVP), Provider Evaluation Framework (post-MVP), admin AI dashboard UI (Core UX), user usage view UI (Core UX), actual AI features (Command Bar AI search, Smart Fill, etc. — Core UX)
- **Creates schema for:** None (ai_usage_log, ai_credit_ledger defined in 1B)

**Dependencies:**
- **Depends on:** 1A (monorepo), 1B (AI tables), 1D (logging + tracing for AI calls)
- **Unlocks:** Phase 3 (Core UX needs AIService for Command Bar AI search, Smart Fill, record summarization, document AI draft, field/link suggestions)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 10
- **Complexity:** Medium-High
- **Key risk:** Anthropic SDK versioning — ensuring the adapter abstraction doesn't leak provider-specific types into feature code

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1I — Audit Log Helper, Platform API Auth Skeleton

**One-sentence scope:** Delivers the external-facing platform infrastructure: `writeAuditLog()` helper with seven-source attribution, API key authentication middleware with SHA-256 hashing, token-bucket rate limiting, structured error format.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| audit-log.md | What Gets Audited, Seven-Source Attribution, Schema, Retention Policy, Audit Write Mechanism, Implementation Rules, Phase Implementation | 26–151, 181–351 | ~296 |
| platform-api.md | Overview, Authentication, Rate Limiting, API Versioning, Error Format, Audit Integration | 36–272 | ~237 |
| vertical-architecture.md | Full doc (strategy — read-only, no code output) | 29–472+ | ~444 |

**Total reference lines:** ~977 (but vertical-architecture.md is read-only strategy context — effective code-relevant: ~533)

**Scope Boundaries:**
- **Includes:** `writeAuditLog()` helper function (accepts actor type, action, entity, details JSONB), seven actor types (`user`, `sync`, `automation`, `portal_client`, `system`, `agent`, `api_key` — Foundation ships `user` + `system`), audit log partitioning by `created_at` (monthly), retention policy config (90-day hot, 1-year cold), bulk audit condensation pattern, `api_keys` management (create, revoke, rotate), SHA-256 key hashing (only prefix `esk_live_*` stored in cleartext), API key scope model (5 scopes: `data:read`, `data:write`, `schema:read`, `schema:write`, `admin`), API auth middleware (`X-API-Key` header → hash → lookup → scope check → inject tenant context), Redis token-bucket rate limiter (4 tiers by plan), rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`), structured JSON error format (`{ error: { code, message, details?, traceId? } }`), API versioning setup (`/api/v1/`), `actor_type: 'api_key'` + `actor_label` in audit log for API-originated mutations
- **Excludes:** Data API endpoints (Core UX), Schema API endpoints (Core UX), Provisioning API (post-MVP), Automation API (Core UX), AI API (Core UX), Webhook Management API (Core UX), audit log UI — Record Activity tab (Core UX), workspace audit log page (Core UX), CSV export (post-MVP)
- **Creates schema for:** None (audit_log, api_keys, api_request_log defined in 1B)

**Dependencies:**
- **Depends on:** 1A (monorepo), 1B (audit_log, api_keys, api_request_log tables), 1C (tenant context for API requests), 1D (logging + tracing)
- **Unlocks:** Phase 2 (Sync needs audit helper for sync-originated mutations), Phase 3 (every Server Action calls writeAuditLog, Platform API Data/Schema endpoints built on auth middleware)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 8
- **Complexity:** Medium
- **Key risk:** API key security — SHA-256 hashing implementation must prevent timing attacks, key prefix must not leak scope information

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 1J — Change Proposal Migration, Multi-Tenant Auth & Navigation Shell

**One-sentence scope:** Applies CP-001/CP-002 schema migrations (portal refinements + multi-tenant identity tables), updates the auth middleware to query the `effective_memberships` view with tenant-switching support, and builds the multi-tenant sidebar navigation tree with per-tenant shell accent colouring and portal display.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| navigation.md | Full doc (new — sidebar tree, tenant switching, contextual clarity, portal display) | Full doc | ~400 |
| data-model.md | tenant_relationships table, effective_memberships view, portal_access CP columns | Scattered | ~60 |
| permissions.md | effective_memberships as auth resolution source, tenant-switching middleware | Scattered | ~40 |
| design-system.md | Shell accent colouring, --shell-accent token, shell repainting | Scattered | ~30 |

**Total reference lines:** ~530

**Scope Boundaries:**
- **Includes:** CP-001 schema migration (portals `UNIQUE (tenant_id, slug)` constraint change, portal_access +4 columns: `revoked_at`, `revoked_reason`, `record_slug` + unique constraint, `linked_record_id` FK, threads `visibility` → `thread_type` + `UNIQUE (scope_type, scope_id, thread_type)` constraint), CP-002 schema migration (`users.personal_tenant_id` FK, `workspaces` +2 transfer columns: `transferred_from_tenant_id`, `original_created_by_tenant_id`, `tenant_relationships` table ~14 columns, `effective_memberships` database view as union of `tenant_memberships` + `tenant_relationships`), auth middleware update (swap `tenant_memberships` query → `effective_memberships` view for all auth resolution, Clerk `setActive()` + Redis cache hybrid for tenant-switch stub, `tenant_relationships` recognised as valid access grant with synthesised role derivation, personal tenant auto-provisioning on `user.created` webhook), sidebar navigation tree (collapsible tenant sections, workspace tree per tenant, My Office entry per tenant, portal section divider below workspace tree), tenant switching UX (Clerk `setActive()` + Redis hybrid, optimistic shell repaint, error recovery toast), shell accent colouring (`--shell-accent` per-tenant CSS custom property, portal accent token system-owned, shell repainting CSS transition on tenant switch), contextual clarity signals (three mandatory layers: sidebar header with tenant name, shell accent colour, My Office heading with tenant qualifier), portal display in sidebar (authenticated portal entries below "Portals" divider, distinct icon + system colour, no shell repaint on portal entry)
- **Excludes:** Agency Console `/agency` route (post-MVP), "Acting as Agency" banner (post-MVP), workspace transfer UI (post-MVP — schema stubs only), white-label mode (post-MVP), agency onboarding flows (post-MVP), client onboarding via agency (post-MVP)
- **Creates schema for:** tenant_relationships (new table), effective_memberships (new view); **schema migration for:** users (+1 column), workspaces (+2 columns), portal_access (+4 columns), portals (constraint change), threads (column replace + constraint)

**Dependencies:**
- **Depends on:** 1A (monorepo), 1B (base schema — migration alters existing tables + creates new table/view), 1C (Clerk auth middleware — 1J updates it), 1F (design system tokens — 1J adds shell accent tokens)
- **Can run in parallel with:** 1I (no dependency between them)
- **Unlocks:** Phase 2 (correct multi-tenant foundation with effective_memberships), all Phase 3 sub-phases (Core UX renders inside the sidebar navigation tree)
- **Cross-phase deps:** None

**Sizing:**
- **Estimated prompts:** 11
- **Complexity:** Medium-High
- **Key risk:** Clerk `setActive()` tenant switching — ensuring Redis cache invalidation and session state are consistent during switch; sidebar tree performance with multiple tenants each containing multiple workspaces

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

## Dependency Graph

```
1A (Monorepo/CI)
 ├── 1B (Database) ─────────────────────────────────┐
 │    ├── 1C (Auth/Roles) ──────────────────────┐    │
 │    │    └── 1G (Real-time/Worker/Files) ──┐   │    │
 │    ├── 1D (Observability/Security) ──────┐│   │    │
 │    │    ├── 1H (AI Service) ─────────────┤│   │    │
 │    │    └── 1I (Audit/API Auth) ─────────┘│   │    │
 │    ├── 1E (Testing) ─────────────────────────┘    │
 │    └── 1F (Design System) ──────────────────────── │
 │                                                     │
 ├── 1J (CP Migration + Multi-Tenant Auth + Nav Shell)
 │    depends on: 1A, 1B, 1C, 1F
 │    parallel with: 1I (no dependency)
 │                                                     │
 └─────── 1A–1I + 1J unlock Phase 2 (Sync) + Phase 3 (Core UX)
```

**Parallel execution potential:** After 1B completes, sub-phases 1C/1D/1E/1F can proceed in parallel. After 1C+1D complete, sub-phases 1G/1H/1I can proceed in parallel. 1J depends on 1A+1B+1C+1F (all already merged) and can run in parallel with 1I.

## Validation Checklist

- [x] Every sub-phase passes the one-sentence test
- [x] No sub-phase exceeds 15 estimated prompts (max: 1B at 13)
- [x] No sub-phase needs 5+ reference docs (max: 4 in 1B and 1J)
- [x] ALL MVP tables appear in exactly one sub-phase's "Creates schema for" (1B — all 52 MVP tables; 1J creates `tenant_relationships` + `effective_memberships` view as CP-002 migration)
- [x] No post-MVP features in any "Includes" (verified: no Kanban, no formula engine, no agents runtime, no App Designer, no self-hosted AI, no DuckDB, no vector embeddings, no Agency Console)
- [x] Dependencies flow downward (no cycles — 1A → 1B → {1C,1D,1E,1F} → {1G,1H,1I} → 1J depends on {1A,1B,1C,1F})
- [x] Total sub-phase count: 10
- [x] Total prompt estimate: 86
- [x] compliance.md sections split cleanly: RLS (198–217) → 1B, headers/encryption/PII/webhooks → 1D
- [x] testing.md sections split cleanly: CI Pipeline (693–886) → 1A, everything else → 1E
- [x] operations.md Docker Compose portions → 1A, graceful shutdown context referenced in 1G
- [x] CP-001/CP-002 retroactive changes handled: schema migration + middleware update + navigation shell bundled in 1J (not retrofitted into merged 1B/1C)
- [x] Agency Console and all agency UX deferred to post-MVP (1J excludes list)
