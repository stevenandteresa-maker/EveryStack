# EveryStack — Dependency Map

> Generated: 2026-03-02; Updated: 2026-03-05 (CP-001/CP-002: +tenant_relationships table, +effective_memberships view, column count updates, navigation.md added)
> Input: `phase-extraction-notes.json`, `data-model.md`, `GLOSSARY.md`, `CLAUDE.md`, `MANIFEST.md`, `docs/changes/CP-IMPACT-MAP.md`

---

## 1. Schema Creation Order

### 1.1 MVP Table Inventory (43 tables + 1 view)

| # | Table | Column Count (approx) | Foreign Keys To | Referenced By | Phase |
|---|-------|----------------------|-----------------|---------------|-------|
| 1 | `users` | 8 (CP-002: +personal_tenant_id) | — (root) | tenant_memberships, board_memberships, workspace_memberships, base_connections, threads, thread_messages, thread_participants, user_tasks, user_events, user_saved_messages, notifications, user_notification_preferences, user_recent_items, command_bar_sessions, ai_usage_log, api_keys, feature_suggestions, feature_votes, records, sections, tables, views, record_view_configs, record_templates, portals, forms, document_templates, automations, audit_log, webhook_endpoints, generated_documents, sync_schema_changes, sync_failures | MVP — Foundation |
| 2 | `tenants` | 7 | — (root) | tenant_memberships, boards, workspaces, workspace_memberships, base_connections, tables, fields, records, cross_links, cross_link_index, views, record_view_configs, record_templates, portals, portal_access, portal_sessions, forms, form_submissions, synced_field_mappings, sync_conflicts, sync_failures, sync_schema_changes, threads, thread_messages, user_saved_messages, notifications, user_notification_preferences, document_templates, generated_documents, automations, automation_runs, webhook_endpoints, webhook_delivery_log, ai_usage_log, ai_credit_ledger, sections, user_recent_items, command_bar_sessions, audit_log, api_keys, api_request_log, feature_suggestions | MVP — Foundation |
| 3 | `tenant_memberships` | 8 | tenants, users | — | MVP — Foundation |
| 4 | `boards` | 7 | tenants | board_memberships, workspaces | MVP — Foundation |
| 5 | `board_memberships` | 5 | boards, users | — | MVP — Foundation |
| 6 | `workspaces` | 13 (CP-002: +transferred_from_tenant_id, +original_created_by_tenant_id) | tenants, boards (nullable), users | workspace_memberships, tables, automations, webhook_endpoints | MVP — Foundation |
| 7 | `workspace_memberships` | 10 | users, tenants, workspaces | — | MVP — Foundation |
| 8 | `base_connections` | 14 | tenants, users | synced_field_mappings, sync_failures, sync_schema_changes | MVP — Foundation (schema), MVP — Sync (populated) |
| 9 | `tables` | 10 | workspaces, tenants, users | fields, records, views, record_view_configs, record_templates, cross_links, portals, forms, document_templates | MVP — Foundation |
| 10 | `fields` | 18 | tables, tenants | cross_links, synced_field_mappings, sync_conflicts | MVP — Foundation |
| 11 | `records` | 10 | tables, tenants, users | cross_link_index, sync_conflicts, form_submissions, generated_documents | MVP — Foundation (schema), MVP — Sync (populated via sync) |
| 12 | `cross_links` | 14 | tenants, tables (x2), fields (x2) | cross_link_index | MVP — Core UX |
| 13 | `cross_link_index` | 6 | tenants, cross_links, records (implied) | — | MVP — Core UX |
| 14 | `views` | 13 | tables, tenants, users | user_view_preferences | MVP — Foundation (default view), MVP — Core UX (full) |
| 15 | `user_view_preferences` | 4 | views, users | — | MVP — Core UX |
| 16 | `record_view_configs` | 8 | tables, tenants, users | portals, forms | MVP — Core UX |
| 17 | `record_templates` | 14 | tables, tenants, sections, users | — | MVP — Core UX |
| 18 | `portals` | 10 | tenants, tables, record_view_configs, users | portal_access, portal_sessions | MVP — Core UX |
| 19 | `portal_access` | 13 (CP-001: +revoked_at, +revoked_reason, +record_slug, +linked_record_id) | tenants, portals, records (linked_record_id, nullable) | portal_sessions (via auth_id) | MVP — Core UX |
| 20 | `portal_sessions` | 7 | portal_access or portal_clients (polymorphic), portals, tenants | — | MVP — Core UX |
| 21 | `forms` | 9 | tenants, tables, record_view_configs, users | form_submissions | MVP — Core UX |
| 22 | `form_submissions` | 6 | forms, tenants, records | — | MVP — Core UX |
| 23 | `synced_field_mappings` | 7 | tenants, base_connections, tables, fields | — | MVP — Sync |
| 24 | `sync_conflicts` | 11 | tenants, records, fields | — | MVP — Sync |
| 25 | `sync_failures` | 12 | tenants, base_connections, records (nullable), users (nullable) | — | MVP — Sync |
| 26 | `sync_schema_changes` | 11 | tenants, base_connections, fields (nullable), users (nullable) | — | MVP — Sync |
| 27 | `threads` | 7 (CP-001: visibility→thread_type + UNIQUE(scope_type, scope_id, thread_type)) | tenants, users | thread_participants, thread_messages, user_saved_messages, notifications | MVP — Core UX |
| 28 | `thread_participants` | 5 | threads, users | — | MVP — Core UX |
| 29 | `thread_messages` | 14 | threads, users (nullable) | user_saved_messages, notifications | MVP — Core UX |
| 30 | `user_saved_messages` | 5 | users, thread_messages, tenants | — | MVP — Core UX |
| 31 | `user_tasks` | 8 | users | — | MVP — Core UX (My Office) |
| 32 | `user_events` | 11 | users | — | MVP — Core UX (My Office) |
| 33 | `notifications` | 7 | users, tenants, threads (nullable), thread_messages (nullable) | — | MVP — Core UX |
| 34 | `user_notification_preferences` | 4 | users, tenants | — | MVP — Core UX |
| 35 | `document_templates` | 9 | tenants, tables, users | generated_documents | MVP — Core UX |
| 36 | `generated_documents` | 8 | tenants, document_templates, records, users | — | MVP — Core UX |
| 37 | `automations` | 12 | tenants, workspaces, users | automation_runs | MVP — Core UX |
| 38 | `automation_runs` | 7 | automations | — | MVP — Core UX |
| 39 | `webhook_endpoints` | 10 | tenants, workspaces, users | webhook_delivery_log | MVP — Core UX |
| 40 | `webhook_delivery_log` | 11 | tenants, webhook_endpoints | — | MVP — Core UX |
| 41 | `ai_usage_log` | 12 | tenants, users | — | MVP — Foundation |
| 42 | `ai_credit_ledger` | 6 | tenants | — | MVP — Foundation |
| 43 | `sections` | 8 | tenants, users (nullable) | record_templates | MVP — Core UX |
| 44 | `user_recent_items` | 5 | users, tenants | — | MVP — Core UX |
| 45 | `command_bar_sessions` | 5 | users, tenants | — | MVP — Core UX |
| 46 | `audit_log` | 12 | tenants | — | MVP — Foundation |
| 47 | `api_keys` | 12 | tenants, users | api_request_log | MVP — Foundation |
| 48 | `api_request_log` | 8 | tenants, api_keys | — | MVP — Foundation |
| 49 | `feature_suggestions` | 9 | users, tenants | feature_votes | MVP — Core UX |
| 50 | `feature_votes` | 4 | feature_suggestions, users | — | MVP — Core UX |
| 51 | `tenant_relationships` | ~14 (CP-002) | tenants (x2), users (x2) | effective_memberships (view) | MVP — Foundation (1J migration) |
| — | `effective_memberships` | view (CP-002) | tenant_memberships, tenant_relationships | — (auth resolution source) | MVP — Foundation (1J migration) |
| 52 | `user_notes` | 8 | users, tenants, records (nullable) | thread_messages (source_note_id) | MVP — Core UX (My Office) |

### 1.2 Schema Creation DAG (Dependency Tiers)

Tables must be created in this order. Each tier can be created in parallel within the tier, but all tables in tier N must exist before tier N+1.

**Tier 0 — Root (no FKs):**
- `users`
- `tenants`

**Tier 1 — Depends on roots:**
- `tenant_memberships` (→ tenants, users)
- `tenant_relationships` (→ tenants x2, users x2) — CP-002, created in 1J migration
- `boards` (→ tenants)
- `ai_usage_log` (→ tenants, users)
- `ai_credit_ledger` (→ tenants)
- `audit_log` (→ tenants)
- `user_tasks` (→ users)
- `user_events` (→ users)
- `user_notes` (→ users, tenants) — 1B migration, record_id FK to records is nullable so no tier dependency on records

> **`effective_memberships`** — database view (CP-002, created in 1J migration). UNION of `tenant_memberships` + `tenant_relationships`. Used as the single auth resolution source for all middleware. Depends on both tables above existing.

**Tier 2 — Depends on Tier 1:**
- `board_memberships` (→ boards, users)
- `workspaces` (→ tenants, boards)
- `api_keys` (→ tenants, users)
- `notifications` (→ users, tenants)
- `user_notification_preferences` (→ users, tenants)
- `user_recent_items` (→ users, tenants)
- `command_bar_sessions` (→ users, tenants)
- `feature_suggestions` (→ users, tenants)

**Tier 3 — Depends on Tier 2:**
- `workspace_memberships` (→ workspaces, users, tenants)
- `base_connections` (→ tenants, users)
- `tables` (→ workspaces, tenants, users)
- `automations` (→ workspaces, tenants, users)
- `webhook_endpoints` (→ workspaces, tenants, users)
- `threads` (→ tenants, users)
- `sections` (→ tenants, users)
- `api_request_log` (→ tenants, api_keys)
- `feature_votes` (→ feature_suggestions, users)

**Tier 4 — Depends on Tier 3:**
- `fields` (→ tables, tenants)
- `records` (→ tables, tenants, users)
- `views` (→ tables, tenants, users)
- `record_view_configs` (→ tables, tenants, users)
- `record_templates` (→ tables, tenants, sections)
- `document_templates` (→ tables, tenants, users)
- `automation_runs` (→ automations)
- `webhook_delivery_log` (→ webhook_endpoints, tenants)
- `thread_participants` (→ threads, users)
- `thread_messages` (→ threads, users)
- `synced_field_mappings` (→ base_connections, tables, fields) — *NOTE: also needs fields from Tier 4, so actually Tier 5*
- `sync_failures` (→ base_connections, tenants, records)
- `sync_schema_changes` (→ base_connections, tenants, fields)

**Tier 5 — Depends on Tier 4:**
- `cross_links` (→ tables x2, fields x2, tenants)
- `synced_field_mappings` (→ base_connections, tables, fields)
- `sync_conflicts` (→ tenants, records, fields)
- `portals` (→ tables, record_view_configs, tenants, users)
- `forms` (→ tables, record_view_configs, tenants, users)
- `user_view_preferences` (→ views, users)
- `user_saved_messages` (→ users, thread_messages, tenants)
- `generated_documents` (→ document_templates, records, tenants, users)

**Tier 6 — Depends on Tier 5:**
- `cross_link_index` (→ cross_links, tenants)
- `portal_access` (→ portals, tenants)
- `form_submissions` (→ forms, records, tenants)

**Tier 7 — Depends on Tier 6:**
- `portal_sessions` (→ portal_access [polymorphic], portals, tenants)

### 1.3 Phase-Grouped Table Summary

| Phase | Tables | Count |
|-------|--------|-------|
| **MVP — Foundation** | users, tenants, tenant_memberships, tenant_relationships (CP-002, 1J migration), boards, board_memberships, workspaces, workspace_memberships, base_connections, tables, fields, records, views (schema + default), ai_usage_log, ai_credit_ledger, audit_log, api_keys, api_request_log + `effective_memberships` view (CP-002, 1J migration) | 18 + 1 view |
| **MVP — Sync** | synced_field_mappings, sync_conflicts, sync_failures, sync_schema_changes | 4 |
| **MVP — Core UX** | cross_links, cross_link_index, user_view_preferences, record_view_configs, record_templates, portals, portal_access, portal_sessions, forms, form_submissions, threads, thread_participants, thread_messages, user_saved_messages, user_tasks, user_events, notifications, user_notification_preferences, document_templates, generated_documents, automations, automation_runs, webhook_endpoints, webhook_delivery_log, sections, user_recent_items, command_bar_sessions, feature_suggestions, feature_votes | 29 |

---

## 2. Doc-Level Dependency Graph

### Foundation & Infrastructure

#### data-model.md
- **Provides:** All MVP table definitions, field system architecture, canonical JSONB pattern, cross-linking data model, bidirectional sync architecture
- **Requires:** — (foundational, no doc dependencies)
- **Tables needed:** All 50 MVP tables defined here
- **Ships in:** MVP — Foundation (schema creation), referenced by all subsequent phases

#### database-scaling.md
- **Provides:** PgBouncer config, read/write routing (`getDbForTenant()`), hash partitioning, RLS at scale, tsvector indexing, JSONB expression indexes
- **Requires:** data-model.md (table schemas)
- **Tables needed:** records (partitioning), all tables (RLS)
- **Ships in:** MVP — Foundation (core), post-MVP (CockroachDB, multi-region)

#### design-system.md
- **Provides:** Hybrid color model, workspace accent colors, data palette, typography, spacing, shadcn component inventory, responsive architecture, creation flow patterns, application shell layout
- **Requires:** — (foundational UI spec)
- **Tables needed:** tenants (branding settings), workspaces (accent color)
- **Ships in:** MVP — Foundation

#### navigation.md (new — CP-002)
- **Provides:** Sidebar navigation tree, multi-tenant tenant switching, shell accent colouring, contextual clarity signals, portal display in sidebar, My Office per-tenant framing
- **Requires:** design-system.md (shell layout, accent tokens), permissions.md (effective_memberships, tenant context), data-model.md (tenant_relationships, tenants, workspaces)
- **Tables needed:** tenants (sidebar sections), workspaces (tree nodes), tenant_relationships (agency access), portals (sidebar portal entries)
- **Ships in:** MVP — Foundation (1J)

#### files.md
- **Provides:** Upload pipeline (presigned URLs → R2/S3), StorageClient abstraction, MIME security, image processing, virus scanning, CDN serving
- **Requires:** data-model.md (records with file fields)
- **Tables needed:** records (file field values in canonical_data)
- **Ships in:** MVP — Foundation (infrastructure), MVP — Core UX (field rendering)

#### observability.md
- **Provides:** Pino logging with PII redaction, AsyncLocalStorage traceId, Sentry config, OTel auto-instrumentation, monitoring dashboards, alerting rules
- **Requires:** — (foundational infrastructure)
- **Tables needed:** ai_usage_log (AI telemetry)
- **Ships in:** MVP — Foundation

#### operations.md
- **Provides:** Backup strategy, RTO/RPO targets, Redis failover, incident response, monitoring dashboards, scaling triggers
- **Requires:** observability.md (logging/monitoring), compliance.md (security requirements)
- **Tables needed:** All tables (backup), records (soft delete)
- **Ships in:** MVP — Foundation (Docker Compose, PgBouncer), post-MVP (production ops)

#### realtime.md
- **Provides:** Socket.io transport, room model, connection lifecycle, auth, reconnection strategy, Redis pub/sub, presence, horizontal scaling
- **Requires:** data-model.md (room identifiers), compliance.md (auth verification)
- **Tables needed:** workspace_memberships (auth for room subscriptions)
- **Ships in:** MVP — Foundation (scaffold), MVP — Sync (sync status push), MVP — Core UX (grid live updates)

#### compliance.md
- **Provides:** GDPR/CCPA rights, PII handling, encryption, security headers (platform + portal CSP), RLS specs, webhook signature verification, WAF, session management, SSO/SCIM
- **Requires:** data-model.md (PII column annotations)
- **Tables needed:** users (PII), tenants (data subject rights), audit_log (compliance trail)
- **Ships in:** MVP — Foundation (security headers, encryption, RLS, webhook verification)

#### testing.md
- **Provides:** Test strategy (3 tiers), Vitest + Playwright + axe-core, test utilities, CI pipeline, coverage targets, staging seed script
- **Requires:** data-model.md (test factories), observability.md (tracing), database-scaling.md (test DB setup)
- **Tables needed:** All tables (factories and seed data)
- **Ships in:** MVP — Foundation

#### cockroachdb-readiness.md
- **Provides:** CockroachDB-compatible patterns, migration playbook, 5 development safeguards
- **Requires:** data-model.md (schema constraints), database-scaling.md (routing)
- **Tables needed:** All tables (UUIDv7 PKs, no serial)
- **Ships in:** MVP — Foundation (safeguards only), post-MVP (deployment)

#### settings.md
- **Provides:** Settings page layout, 9 sections, role gating, auto-save, plan enforcement
- **Requires:** permissions.md (role gating), design-system.md (UI patterns), data-model.md (tenants, workspace_memberships)
- **Tables needed:** tenants (settings JSONB), workspace_memberships (role check), ai_credit_ledger (AI settings)
- **Ships in:** MVP — Core UX

### Sync Engine

#### sync-engine.md
- **Provides:** Canonical Transform Layer, FieldTypeRegistry, platform adapters (Airtable, SmartSuite, Notion), sync setup wizard, sync filters, conflict resolution, sync error recovery, sync settings dashboard
- **Requires:** data-model.md (tables, fields, records, base_connections), database-scaling.md (JSONB indexes), realtime.md (sync status push), permissions.md (tenant isolation), observability.md (logging)
- **Tables needed:** base_connections, tables, fields, records, synced_field_mappings, sync_conflicts, sync_failures, sync_schema_changes
- **Ships in:** MVP — Sync (primary), some infrastructure in MVP — Foundation

### Core UX

#### tables-and-views.md
- **Provides:** Table types, view types (Grid + Card MVP), Record View overlay, My Views / Shared Views, CSV/data import
- **Requires:** data-model.md (tables, views, record_view_configs), design-system.md (UI layout), permissions.md (view access boundary), cross-linking.md (linked record display)
- **Tables needed:** tables, views, user_view_preferences, record_view_configs, fields, records
- **Ships in:** MVP — Core UX

#### cross-linking.md
- **Provides:** Cross-platform record relationships, query-time resolution, cycle detection, permission resolution, cascade engineering, link scope filters, impact analysis
- **Requires:** data-model.md (cross_links, cross_link_index), permissions.md (cross-link permission resolution), sync-engine.md (synced table links)
- **Tables needed:** cross_links, cross_link_index, fields (linked_record type), records
- **Ships in:** MVP — Core UX

#### command-bar.md
- **Provides:** Universal search (Cmd+K), record search, table navigation, slash commands, natural language AI search
- **Requires:** data-model.md (user_recent_items, command_bar_sessions), schema-descriptor-service.md (AI search), ai-architecture.md (AIService)
- **Tables needed:** user_recent_items, command_bar_sessions
- **Ships in:** MVP — Core UX

#### field-groups.md
- **Provides:** Named field groups, group coloring, collapse behavior, per-field emphasis, conditional cell coloring, enhanced hide/show panel
- **Requires:** data-model.md (fields, views config JSONB), design-system.md (data palette colors), tables-and-views.md (grid rendering), permissions.md (field visibility)
- **Tables needed:** fields (group config in JSONB), views (field group visibility)
- **Ships in:** MVP — Foundation (board collapse), MVP — Sync (badges), MVP — Core UX (full feature)

#### bulk-operations.md
- **Provides:** Multi-record selection, 7 bulk actions, binary gating, batch server actions, audit condensation, real-time batching, undo mechanism
- **Requires:** tables-and-views.md (grid selection), permissions.md (action gating), audit-log.md (bulk condensation), realtime.md (event batching), automations.md (run automation action)
- **Tables needed:** records, audit_log, automations (run trigger)
- **Ships in:** MVP — Core UX

#### record-templates.md
- **Provides:** Pre-filled record templates, dynamic tokens ($me/$today/$context_record), template picker UX, view-contextual overrides
- **Requires:** data-model.md (record_templates), tables-and-views.md (template picker in grid), permissions.md (Manager+ creation), command-bar.md (auto-registration)
- **Tables needed:** record_templates, sections
- **Ships in:** MVP — Core UX (core), post-MVP — Automations (automation integration)

#### my-office.md
- **Provides:** Personal home screen, widget grid, Quick Panel expansion, desktop 3-column layout, mobile workspace tiles
- **Requires:** design-system.md (layout), communications.md (Chat widget), data-model.md (user_tasks, user_events)
- **Tables needed:** user_tasks, user_events, threads (Chat/DM widget)
- **Ships in:** MVP — Core UX

#### mobile.md
- **Provides:** Device tier strategy, mobile surfaces, input optimization, thumb zone layout, offline architecture, notification routing, deep linking
- **Requires:** design-system.md (responsive), tables-and-views.md (Card view primary), communications.md (mobile chat)
- **Tables needed:** All tables (mobile rendering of same data)
- **Ships in:** MVP — Foundation (responsive CSS), MVP — Core UX (mobile views)

#### mobile-navigation-rewrite.md
- **Provides:** Two-layer bottom bar navigation rewrite
- **Requires:** mobile.md (base mobile architecture), design-system.md (navigation patterns)
- **Tables needed:** — (navigation only)
- **Ships in:** MVP — Core UX

### Portals & Forms

#### portals.md
- **Provides:** Quick Portals (single-record sharing, magic link / password auth, selectively editable fields, caching)
- **Requires:** data-model.md (portals, portal_access, portal_sessions), record_view_configs (layout), permissions.md (portal field permissions), compliance.md (portal CSP, cookie security)
- **Tables needed:** portals, portal_access, portal_sessions, record_view_configs
- **Ships in:** MVP — Core UX (Quick Portals), post-MVP (App Portals via App Designer)

#### forms.md
- **Provides:** Quick Forms (record creation, Turnstile, embed, notification emails)
- **Requires:** data-model.md (forms, form_submissions), record_view_configs (layout), tables-and-views.md (field rendering)
- **Tables needed:** forms, form_submissions, record_view_configs
- **Ships in:** MVP — Core UX (Quick Forms), post-MVP (App Forms via App Designer)

### Documents

#### smart-docs.md
- **Provides:** TipTap editor (2 environments), merge-tag document templates, PDF via Gotenberg, AI draft, Smart Doc field type, versioning
- **Requires:** data-model.md (document_templates, generated_documents), ai-architecture.md (AI draft), files.md (PDF storage)
- **Tables needed:** document_templates, generated_documents
- **Ships in:** MVP — Core UX (template creation + PDF generation)

### Automations

#### automations.md
- **Provides:** Linear trigger → action flows (6 triggers, 7 actions), step-by-step list builder, execution model, webhook architecture
- **Requires:** data-model.md (automations, automation_runs, webhook_endpoints, webhook_delivery_log), email.md (Send Email action), smart-docs.md (Generate Document action), communications.md (Notify action)
- **Tables needed:** automations, automation_runs, webhook_endpoints, webhook_delivery_log
- **Ships in:** MVP — Core UX (linear flows), post-MVP (visual canvas, branching)

### Communications

#### communications.md
- **Provides:** Record Thread, DMs, group DMs, Chat Editor (TipTap env 1), notification system, messaging error handling
- **Requires:** data-model.md (threads, thread_messages, thread_participants, notifications), realtime.md (chat delivery), design-system.md (Chat editor UI)
- **Tables needed:** threads, thread_participants, thread_messages, user_saved_messages, notifications, user_notification_preferences
- **Ships in:** MVP — Core UX (Record Thread + DMs), post-MVP (omnichannel)

#### email.md
- **Provides:** Resend transactional email, email templates, notification delivery, automation Send Email action
- **Requires:** data-model.md (email field type), automations.md (Send Email action), communications.md (notification delivery)
- **Tables needed:** — (uses Resend API, no dedicated MVP tables; post-MVP: email_templates, email_events, etc.)
- **Ships in:** MVP — Core UX (system emails), post-MVP (connected inbox)

### AI Layer

#### ai-architecture.md
- **Provides:** AIProviderAdapter interface, capability-based routing, prompt registry, tool definitions, evaluation framework, streaming support, structured output
- **Requires:** data-model.md (ai_usage_log, ai_credit_ledger)
- **Tables needed:** ai_usage_log, ai_credit_ledger
- **Ships in:** MVP — Foundation (AIService skeleton, adapter, prompt registry), MVP — Core UX (Context Builder, full tool suite)

#### ai-data-contract.md
- **Provides:** `canonicalToAIContext()` and `aiToCanonical()` — formal data boundary between AI and canonical JSONB
- **Requires:** ai-architecture.md (AIService), data-model.md (canonical_data JSONB, field types)
- **Tables needed:** records (canonical_data), fields (type definitions)
- **Ships in:** MVP — Foundation (core signatures), MVP — Core UX (all MVP field types)

#### ai-metering.md
- **Provides:** Credit system, rate card, model routing, credit budgets, metering flow, admin dashboard, daily caps, reconciliation
- **Requires:** ai-architecture.md (AIService wrapper), data-model.md (ai_usage_log, ai_credit_ledger)
- **Tables needed:** ai_usage_log, ai_credit_ledger
- **Ships in:** MVP — Foundation (metering flow), MVP — Core UX (admin dashboard)

#### schema-descriptor-service.md
- **Provides:** SDS: read-only schema in LLM-optimized format, WorkspaceDescriptor JSON, 3 API endpoints, 2-tier caching
- **Requires:** data-model.md (tables, fields, cross_links), permissions.md (per-user filtered schema), ai-architecture.md (Context Builder integration)
- **Tables needed:** tables, fields, cross_links, views, workspace_memberships (permissions)
- **Ships in:** MVP — Core UX (SDS implementation)

### Permissions & Audit

#### permissions.md
- **Provides:** 5 workspace roles, Table View as access boundary, field-level permissions, two-layer restriction model, runtime resolution, caching
- **Requires:** data-model.md (workspace_memberships, views.permissions JSONB)
- **Tables needed:** tenant_memberships, workspace_memberships, views (permissions JSONB)
- **Ships in:** MVP — Foundation (workspace roles, basic check), MVP — Core UX (full model with field-level)

#### audit-log.md
- **Provides:** Seven-source attribution, audit_log schema, retention, Record Activity tab, workspace audit log, bulk condensation
- **Requires:** data-model.md (audit_log), permissions.md (actor types)
- **Tables needed:** audit_log
- **Ships in:** MVP — Foundation (table + helper), MVP — Core UX (Record Activity, full attribution)

### Platform API

#### platform-api.md
- **Provides:** External REST API: auth (API keys), Data API, Schema API, Provisioning API, AI API, rate limiting, versioning, error format
- **Requires:** data-model.md (api_keys, api_request_log), permissions.md (scope enforcement), ai-architecture.md (AI API), schema-descriptor-service.md (Schema API)
- **Tables needed:** api_keys, api_request_log, audit_log (actor_type: 'api_key')
- **Ships in:** MVP — Foundation (api_keys, auth middleware, rate limiting), MVP — Core UX (Data API, Schema API)

#### vertical-architecture.md
- **Provides:** Architecture guide for branded vertical products, three-layer architecture, B2B/B2C patterns, platform reuse matrix
- **Requires:** platform-api.md (API design), data-model.md (schema)
- **Tables needed:** api_keys, tenants (vertical provisioning)
- **Ships in:** MVP — Foundation (strategy context informing API design)

### Post-MVP Docs (included for dependency completeness)

#### app-designer.md
- **Provides:** Visual page builder, 12-column grid canvas, block library, data binding, themes
- **Requires:** data-model.md (apps, app_pages, app_blocks — post-MVP tables), portals.md (portal auth patterns), permissions.md (portal permissions)
- **Tables needed:** apps, app_pages, app_blocks, portal_clients, portal_domains (all post-MVP)
- **Ships in:** Post-MVP — Portals & Apps

#### agent-architecture.md
- **Provides:** AI agent identity, execution runtime, 3-layer memory, 5-tier approval, safety framework, 8 agent types
- **Requires:** ai-architecture.md, ai-metering.md, permissions.md, schema-descriptor-service.md
- **Tables needed:** agent_sessions (schema created MVP — Foundation, runtime post-MVP), agent_type_configs, workspace_knowledge
- **Ships in:** Post-MVP — AI Agents

#### approval-workflows.md
- **Provides:** Status field transition enforcement, 3 operating modes, approval chains
- **Requires:** data-model.md, permissions.md, automations.md, realtime.md
- **Tables needed:** approval_rules, approval_requests, approval_step_instances (all post-MVP)
- **Ships in:** MVP — Core UX (modes 1+2: status transitions only), Post-MVP — Automations (mode 3: full approval)

#### formula-engine.md
- **Provides:** PEG parser, AST evaluator, dependency graph, formula result caching
- **Requires:** data-model.md (fields, records), cross-linking.md (LOOKUP/ROLLUP)
- **Tables needed:** formula_dependencies (post-MVP)
- **Ships in:** Post-MVP

#### chart-blocks.md
- **Provides:** 8 chart types, data binding modes, aggregate query engine
- **Requires:** data-model.md, tables-and-views.md, design-system.md
- **Tables needed:** — (chart config stored in views.config JSONB)
- **Ships in:** MVP — Core UX (ProgressChart only), Post-MVP (full system)

#### booking-scheduling.md
- **Provides:** Calendar View, bookable tables, availability engine, Scheduler block
- **Requires:** app-designer.md, automations.md, data-model.md
- **Tables needed:** booking_availability, booking_links, booking_templates, meeting_polls, meeting_poll_responses (all post-MVP)
- **Ships in:** Post-MVP — Portals & Apps (Fast-Follow)

#### custom-apps.md
- **Provides:** Internal apps on App Designer engine, POS, kiosk mode, Cart/Transaction block
- **Requires:** app-designer.md, data-model.md
- **Tables needed:** apps (app type column), commerce_transactions
- **Ships in:** Post-MVP — Custom Apps

#### document-designer.md
- **Provides:** Document app type in App Designer, fixed-size canvas, merge tags, PDF/DOCX output
- **Requires:** app-designer.md, smart-docs.md
- **Tables needed:** apps (document type)
- **Ships in:** Post-MVP — Documents

#### embeddable-extensions.md
- **Provides:** Website Mode, Live Chat Widget, Commerce Embed
- **Requires:** app-designer.md, communications.md, realtime.md
- **Tables needed:** chat_widgets, chat_visitors, commerce_transactions
- **Ships in:** Post-MVP — Custom Apps / Portals & Apps

#### document-intelligence.md
- **Provides:** File metadata extraction, content extraction, OCR, document-to-record extraction
- **Requires:** files.md, ai-architecture.md, vector-embeddings.md
- **Tables needed:** extraction_templates, file_embeddings, asset_versions
- **Ships in:** MVP — Foundation (schema stubs), MVP — Core UX (metadata extraction), Post-MVP (full features)

#### vector-embeddings.md
- **Provides:** pgvector, embedding generation, Command Bar hybrid search
- **Requires:** ai-architecture.md, data-model.md, schema-descriptor-service.md
- **Tables needed:** record_embeddings, file_embeddings, knowledge_embeddings (all post-MVP)
- **Ships in:** MVP — Foundation (extension point only), Post-MVP (activation)

#### self-hosted-ai.md
- **Provides:** Enterprise air-gapped AI, Qwen3 model family, hybrid routing
- **Requires:** ai-architecture.md, ai-metering.md
- **Tables needed:** — (uses existing ai_usage_log with self-hosted flag)
- **Ships in:** Post-MVP — Self-Hosted AI

#### duckdb-context-layer-ref.md
- **Provides:** Read-only ephemeral analytical query engine for AI context
- **Requires:** schema-descriptor-service.md, ai-data-contract.md, data-model.md, permissions.md
- **Tables needed:** — (reads from records, writes nothing)
- **Ships in:** Post-MVP — AI Agents

#### ai-field-agents-ref.md
- **Provides:** LLM-powered computed fields, prompt assembly pipeline, execution engine
- **Requires:** schema-descriptor-service.md, duckdb-context-layer-ref.md, ai-data-contract.md, ai-architecture.md
- **Tables needed:** fields (ai_field config), records (result storage)
- **Ships in:** Post-MVP — AI Agents

#### personal-notes-capture.md
- **Provides:** Personal notes, file-first capture, voice-to-text, personal notebooks
- **Requires:** data-model.md (tables with is_personal flag), smart-docs.md (TipTap), my-office.md (My Notes sidebar)
- **Tables needed:** tables (is_personal, owner_user_id columns), wiki_table_config (post-MVP)
- **Ships in:** MVP — Core UX (basic My Notes), Post-MVP (full Evernote competitor)

#### workspace-map.md
- **Provides:** Interactive topology visualization, 14 node types, impact analysis
- **Requires:** schema-descriptor-service.md, cross-linking.md, automations.md, realtime.md
- **Tables needed:** — (reads from existing schema tables, caches in Redis)
- **Ships in:** Post-MVP — Verticals & Advanced

#### project-management.md
- **Provides:** PM table_type config, dependencies, Gantt/Timeline views
- **Requires:** data-model.md, tables-and-views.md, chart-blocks.md
- **Tables needed:** pm_table_config, record_dependencies, resource_profiles, pm_baselines (all post-MVP)
- **Ships in:** Post-MVP

#### accounting-integration.md
- **Provides:** Unified accounting API, invoice/expense lifecycle, Financial Command Center
- **Requires:** data-model.md, automations.md, sync-engine.md, app-designer.md
- **Tables needed:** invoice_table_config, expense_table_config, financial_snapshots, financial_summary (all post-MVP)
- **Ships in:** Post-MVP — Accounting Integration

#### agency-features.md
- **Provides:** Time tracking, asset library, ad platform integrations
- **Requires:** data-model.md, automations.md, custom-apps.md
- **Tables needed:** time_entries, billing_rates, time_tracking_config, asset_versions, metric_snapshots (all post-MVP)
- **Ships in:** Post-MVP

#### meetings.md
- **Provides:** Meeting table_type config, agenda/action items, AI summary
- **Requires:** tables-and-views.md, booking-scheduling.md, communications.md, smart-docs.md
- **Tables needed:** meeting_table_config (post-MVP)
- **Ships in:** Post-MVP

#### inventory-capabilities.md
- **Provides:** Atomic quantity operations, barcode field, Quick Entry, threshold triggers
- **Requires:** data-model.md, automations.md, mobile.md
- **Tables needed:** records (atomic JSONB ops on canonical_data)
- **Ships in:** MVP — Core UX (atomic ops only), Post-MVP (full features)

#### gaps/automations-execution-triggers-webhooks.md
- **Provides:** Full 22-trigger/42-action spec, execution model, webhook architecture (merged into automations.md)
- **Requires:** automations.md (MVP subset)
- **Tables needed:** automations, automation_runs
- **Ships in:** Post-MVP — Automations

#### gaps/knowledge-base-live-chat-ai.md
- **Provides:** Knowledge base designation, Smart Doc content chunking, Live Chat AI retrieval
- **Requires:** smart-docs.md, vector-embeddings.md, embeddable-extensions.md
- **Tables needed:** knowledge_embeddings (post-MVP)
- **Ships in:** Post-MVP

---

## 3. Cross-Cutting Concerns

### 3.1 Tenant Isolation

- **First established:** data-model.md (every table has `tenant_id`), compliance.md (RLS specs), database-scaling.md (`getDbForTenant()`)
- **Phase origin:** MVP — Foundation
- **Consumers:** Every doc and every phase. Every DB query, every server action, every data function.
- **Evolution:** MVP: single Postgres instance, `tenant_id` column + RLS. Post-MVP: CockroachDB regional routing via `getDbForTenant()`, hash partitioning by tenant_id.
- **Testing:** `testTenantIsolation()` helper mandatory for every `/data` function.

### 3.2 Environment Column (`'live'` | `'sandbox'`)

- **First established:** data-model.md (on tables, fields, cross_links, views, record_templates, automations, document_templates)
- **Phase origin:** MVP — Foundation (always `'live'`, filter enforced from day one)
- **Consumers:** Every query touching definition tables must include `WHERE environment = 'live'`
- **Evolution:** MVP: always `'live'`. Post-MVP: sandbox mode enables schema experimentation.

### 3.3 Design System Tokens

- **First established:** design-system.md (Obsidian Teal tokens, DM Sans / JetBrains Mono, spacing scale)
- **Phase origin:** MVP — Foundation
- **Consumers:** Every component in apps/web/src/components/. Every UI in every phase.
- **Evolution:** Stable. Portal theming (post-MVP) adds theme tokens via `ChartTheme` and portal CSS custom properties.

### 3.4 Permission Model (RBAC + Field-Level)

- **First established:** permissions.md (5 roles, Table View boundary, field-level 3-state)
- **Phase origin:** MVP — Foundation (workspace roles), MVP — Core UX (full field-level model)
- **Consumers:** tables-and-views.md, cross-linking.md, portals.md, forms.md, automations.md, command-bar.md, schema-descriptor-service.md, platform-api.md, bulk-operations.md, audit-log.md, mobile.md
- **CP-002 update:** Auth resolution now uses `effective_memberships` view (union of `tenant_memberships` + `tenant_relationships`) as the single source for all middleware permission checks. `tenant_relationships` enables agency B2B access with synthesised role derivation. Tenant switching via Clerk `setActive()` + Redis. All established in 1J.
- **Evolution:** MVP: role checks + field permissions on views JSONB. Post-MVP: portal permissions (App Designer `app_blocks.data_binding`), approval workflow gating, agent scope restrictions, Agency Console.

### 3.5 FieldTypeRegistry

- **First established:** data-model.md (field system architecture), sync-engine.md (per-platform adapters)
- **Phase origin:** MVP — Foundation (registry pattern), MVP — Sync (adapter registration)
- **Consumers:** Every feature touching field data: tables-and-views.md (grid renderers), cross-linking.md (display field), portals.md (field rendering), forms.md (field input), smart-docs.md (merge tags), automations.md (field value actions), ai-data-contract.md (canonical ↔ AI translation), command-bar.md (search), bulk-operations.md (bulk edit)
- **Evolution:** MVP: ~25 field types across 8 categories. Post-MVP: Formula, Lookup, Rollup, Count, Dependency, Sub-Items, Barcode.

### 3.6 Canonical JSONB Pattern

- **First established:** data-model.md (`records.canonical_data`), sync-engine.md (`toCanonical()` / `fromCanonical()`)
- **Phase origin:** MVP — Foundation (schema), MVP — Sync (population via adapters)
- **Consumers:** Every feature reading/writing record data. ai-data-contract.md (`canonicalToAIContext()` / `aiToCanonical()`), cross-linking.md (linked record resolution), portals.md / forms.md (read/write), automations.md (field value actions), smart-docs.md (merge tags).
- **Evolution:** Stable format. New field types add new JSONB shapes, but the keying-by-field-ID pattern never changes.

### 3.7 Error Handling Patterns

- **First established:** CLAUDE.md (AppError shape, UI error behavior, logging defaults)
- **Phase origin:** MVP — Foundation
- **Consumers:** All Server Actions, route handlers, portal endpoints. Typed errors: NotFoundError, ForbiddenError, ValidationError, ConflictError.
- **Evolution:** Stable. Portal error responses omit `details` and `traceId` for security.

### 3.8 i18n (Internationalization)

- **First established:** CLAUDE.md (rule: all UI strings via `t('key')`)
- **Phase origin:** MVP — Foundation (enforced from day one)
- **Consumers:** Every component. Every user-facing string.
- **Evolution:** Stable. Portal content i18n (post-MVP) adds `resolveContent()` for user-created content.

### 3.9 AIService Abstraction

- **First established:** ai-architecture.md (AIProviderAdapter, capability tiers)
- **Phase origin:** MVP — Foundation (skeleton + Anthropic adapter)
- **Consumers:** command-bar.md (NL search), smart-docs.md (AI draft), automations.md (AI actions), ai-metering.md (credit tracking), ai-data-contract.md (data boundary)
- **Evolution:** MVP: fast/standard/advanced tiers, single provider. Post-MVP: agent runtime, self-hosted adapter, evaluation framework.

### 3.10 Audit Trail

- **First established:** audit-log.md (seven-source attribution), data-model.md (audit_log table)
- **Phase origin:** MVP — Foundation (table + writeAuditLog helper)
- **Consumers:** Every mutation path. All Server Actions emit audit events. Bulk operations condense entries. Platform API adds `actor_type: 'api_key'`.
- **Evolution:** MVP: user, sync, automation, system actor types. Post-MVP: portal_client, agent, api_key actors. Workspace audit log UI. CSV export.

### 3.11 Real-Time Event Bus

- **First established:** realtime.md (Redis pub/sub + Socket.io)
- **Phase origin:** MVP — Foundation (scaffold), MVP — Sync (sync status push)
- **Consumers:** sync-engine.md (sync status), tables-and-views.md (grid live updates), communications.md (chat delivery), bulk-operations.md (batch events), permissions.md (permission invalidation)
- **Evolution:** MVP: basic room model, presence. Post-MVP: cursor broadcasting, typing indicators, Hocuspocus for Smart Doc co-editing.

---

## 4. Phase Boundary Analysis

### 4.1 Conflicts (Doc vs. MANIFEST)

| Doc | Doc's Own Phase Note | MANIFEST Classification | Resolution |
|-----|---------------------|------------------------|------------|
| `approval-workflows.md` | "Mode 1+2 MVP — Core UX, Mode 3 Post-MVP — Automations" | Post-MVP (primary) | **No conflict.** MANIFEST says "Post-MVP" overall because Mode 3 is the main feature. Modes 1+2 (simple status transitions) are a small MVP — Core UX subset. Build transition config UI in Core UX; defer approval chains. |
| `chart-blocks.md` | "ProgressChart MVP — Core UX" | Post-MVP (primary) | **No conflict.** MANIFEST correctly marks as post-MVP overall. Only the ProgressChart component (a single renderer) ships in MVP — Core UX as a cell renderer for Progress fields. |
| `inventory-capabilities.md` | "Atomic Quantity Operations: MVP — Core UX (Critical)" | Post-MVP (primary) | **Minor tension.** Atomic ops (`adjustFieldValue()`) are needed for MVP — Core UX for the Number field "adjust" automation action. MANIFEST marks entire doc as post-MVP. Resolution: `adjustFieldValue()` is a database utility, not a UI feature — include it in MVP — Foundation as a shared utility. |
| `field-groups.md` | "MVP — Foundation (board collapse), MVP — Sync (badges), MVP — Core UX (full)" | MVP (MVP — Core UX) | **No conflict.** MANIFEST correctly classifies as MVP — Core UX. Small Foundation/Sync pieces are infrastructure. |
| `record-templates.md` | "MVP — Core UX (core), Post-MVP — Automations (automation integration)" | MVP (MVP — Core UX) | **No conflict.** Core template CRUD and picker ships MVP. Automation `templateId` integration is post-MVP. |
| `personal-notes-capture.md` | "MVP — Core UX (basic My Notes)" | Post-MVP in MANIFEST scope map | **Tension.** Doc says basic My Notes (is_personal column, sidebar section, Quick Capture) ships MVP — Core UX. MANIFEST lists it only under Post-MVP. Resolution: Add `is_personal` + `owner_user_id` columns to tables schema in MVP — Foundation as extension points. Defer My Notes UI to Post-MVP unless explicitly prioritized. |
| `document-intelligence.md` | "MVP — Foundation (schema stubs), MVP — Core UX (metadata extraction)" | Post-MVP in MANIFEST scope map | **Tension.** Doc's own phase notes include MVP — Core UX activation of metadata extraction. MANIFEST says post-MVP. Resolution: Schema stubs (empty tables, job definitions as no-ops) go in MVP — Foundation. Activation of extraction deferred to post-MVP. |

### 4.1b Retroactive Changes (CP-001/CP-002)

CP-001 (Portal Architecture) and CP-002 (Multi-Tenant Identity, Agency, Navigation) introduce schema changes, middleware changes, and new UX scope that were decided *after* Phases 1A–1H shipped. These changes are handled as follows:

| Change Category | Resolution |
|----------------|------------|
| Schema migration (portal_access +4 cols, threads visibility→thread_type, tenant_relationships table, effective_memberships view, users/workspaces +cols) | Bundled in new sub-phase **1J** as a migration, not retrofitted into 1B |
| Auth middleware update (effective_memberships, tenant switching) | Bundled in **1J**, not retrofitted into 1C |
| Sidebar navigation tree + shell accent tokens | Bundled in **1J** (new scope, no prior home) |
| Two-thread model (internal + client) | Absorbed into **3C** scope expansion |
| Portal scope (tenant-scoped slugs, deletion cascade, client thread, list view, linked_record_id) | Absorbed into **3E-i** scope expansion (12→15 prompts) |
| My Office per-tenant framing | Absorbed into **3G-ii** (minor adjustment) |
| Agency Console, "Acting as Agency" banner, workspace transfer UI | Deferred to **post-MVP** |

See `docs/changes/CP-IMPACT-MAP.md` for the full impact analysis and decision record.

### 4.2 Shared Dependencies (Phase 2+ needs from Phase 1 beyond "the database")

| Downstream Phase | Needs from MVP — Foundation | Specific Deliverable |
|-----------------|---------------------------|---------------------|
| **MVP — Sync** | Real-time scaffold | Socket.io server with Redis adapter, basic room model (sync status push replaces polling) |
| **MVP — Sync** | BullMQ worker infrastructure | Queue definitions, job processor skeleton, Redis connection |
| **MVP — Sync** | FieldTypeRegistry | Registry pattern code, type definitions for all MVP field types |
| **MVP — Sync** | Observability | Pino logging, traceId via AsyncLocalStorage, Sentry DSN |
| **MVP — Core UX** | AIService skeleton | AIProviderAdapter interface, Anthropic adapter, capability routing, prompt registry |
| **MVP — Core UX** | Design system | shadcn/ui primitives installed, Tailwind config, CSS custom properties, DM Sans / JetBrains Mono |
| **MVP — Core UX** | Permission model (basic) | Workspace role checks, `getTenantId()` from Clerk session |
| **MVP — Core UX** | Test infrastructure | Vitest config, test factories, `testTenantIsolation()`, mock Clerk session, CI pipeline |
| **MVP — Core UX** | File upload pipeline | StorageClient + R2 implementation, presigned URL endpoints, MIME allowlist |
| **MVP — Core UX** | API key infrastructure | `api_keys` table, auth middleware, rate limiting (even though Data API ships in Core UX) |
| **MVP — Core UX** | Audit log helper | `writeAuditLog()` function, audit_log table |
| **MVP — Core UX** | Real-time service | Room model operational for grid live updates and presence |

### 4.3 Phase-Internal Ordering

#### MVP — Foundation (must-come-first items)

1. **Monorepo + CI** — Turborepo, pnpm workspaces, GitHub Actions pipeline, Docker Compose
2. **Database** — Postgres + PgBouncer, Drizzle schema (all Tier 0–4 tables), migrations, `getDbForTenant()`
3. **Auth** — Clerk integration, middleware, `getTenantId()`, webhook handler for user.created
4. **Observability** — Pino, traceId, Sentry
5. **Test infrastructure** — Vitest, factories, tenant isolation helper
6. **Design system** — shadcn/ui primitives, Tailwind config, CSS tokens, fonts
7. **Permission model (basic)** — Workspace roles, role check utility
8. **Real-time scaffold** — Socket.io + Redis adapter, room model
9. **BullMQ worker** — Queue definitions, job processor skeleton
10. **AIService skeleton** — Provider adapter interface, Anthropic adapter, prompt registry, metering flow
11. **File upload** — StorageClient, R2 implementation, presigned URL endpoints
12. **API key infrastructure** — api_keys table, auth middleware, rate limiting
13. **Audit log** — audit_log table, writeAuditLog helper

#### MVP — Sync

1. **FieldTypeRegistry** — Registry pattern, MVP field type registrations
2. **Canonical Transform Layer** — `toCanonical()` / `fromCanonical()` base implementations
3. **Airtable adapter** — First adapter, proves the pattern
4. **Progressive initial sync** — Paginated sync, rate limit management
5. **Grid rendering from JSONB** — Expression indexes, optimistic UI
6. **Outbound sync** — Bidirectional writes
7. **Conflict resolution** — Detection, manual mode, diff view
8. **Notion adapter** — Second adapter, validates registry pattern works
9. **SmartSuite adapter** — Third adapter
10. **Sync settings dashboard** — Connection health, error recovery UI

#### MVP — Core UX

Must be sequenced internally due to component dependencies:

1. **Grid + Card views** — TanStack Table/Virtual, field type cell renderers (depends on Sync providing data)
2. **Record View** — Configurable field canvas overlay (depends on Grid for row click)
3. **Table View management** — Shared/My Views, view config CRUD
4. **Cross-linking** — Create/display links, linked record field type
5. **Record Thread + DMs** — Chat editor (TipTap env 1), threading, presence
6. **My Office + Quick Panels** — Widget grid, Tasks/Calendar/Chat widgets
7. **Command Bar** — Search, navigation, slash commands, AI search (depends on SDS)
8. **Schema Descriptor Service** — SDS implementation (depends on tables/fields/cross_links existing)
9. **Quick Portals** — Single-record sharing with auth (depends on Record View)
10. **Quick Forms** — Record creation forms (depends on Record View layout)
11. **Document templates + PDF** — Merge tags, Gotenberg pipeline
12. **Automations** — 6 triggers, 7 actions, linear flows
13. **Bulk operations** — Selection model, 7 actions
14. **Record templates** — Template CRUD, picker UX
15. **Field groups** — Group coloring, collapse, emphasis
16. **Settings** — 9 settings sections
17. **Platform API (Data + Schema)** — Record CRUD, Table/Field queries
18. **Notification system** — Data model, delivery pipeline
19. **Mobile optimization** — Responsive views, input optimization, bottom nav
20. **Audit log UI** — Record Activity tab

---

## 5. MVP Scope Boundaries

### 5.1 MVP Features (must be in a phase)

| Feature | Phase | Source |
|---------|-------|--------|
| Monorepo (Turborepo + pnpm) | MVP — Foundation | CLAUDE.md |
| Auth (Clerk) | MVP — Foundation | CLAUDE.md |
| PostgreSQL + PgBouncer + Redis | MVP — Foundation | CLAUDE.md |
| Design system (shadcn/ui + Tailwind) | MVP — Foundation | GLOSSARY, design-system.md |
| AIService + Anthropic adapter | MVP — Foundation | ai-architecture.md |
| Schema Descriptor Service | MVP — Core UX | schema-descriptor-service.md |
| AI credit system | MVP — Foundation | ai-metering.md |
| Boards (optional workspace grouping) | MVP — Foundation | GLOSSARY |
| Workspace/table CRUD | MVP — Foundation | GLOSSARY |
| Sidebar navigation | MVP — Foundation | GLOSSARY |
| Sync Engine (Airtable, SmartSuite, Notion) | MVP — Sync | sync-engine.md |
| Bidirectional sync | MVP — Sync | sync-engine.md |
| Canonical JSONB pattern | MVP — Foundation (schema), MVP — Sync (adapters) | data-model.md |
| Table Views (Grid + Card) | MVP — Core UX | tables-and-views.md |
| Record View (configurable field canvas) | MVP — Core UX | tables-and-views.md |
| My Views / Shared Views | MVP — Core UX | tables-and-views.md |
| Cross-linking (create/display) | MVP — Core UX | cross-linking.md |
| Quick Portals (single-record sharing) | MVP — Core UX | portals.md |
| Quick Forms (record creation) | MVP — Core UX | forms.md |
| Document templates + PDF generation | MVP — Core UX | smart-docs.md |
| Linear automations (6 triggers, 7 actions) | MVP — Core UX | automations.md |
| Command Bar (search + slash commands + AI) | MVP — Core UX | command-bar.md |
| Natural Language Search | MVP — Core UX | GLOSSARY |
| Smart Fill (AI field values) | MVP — Core UX | GLOSSARY |
| Record Summarization | MVP — Core UX | GLOSSARY |
| Document AI Draft | MVP — Core UX | GLOSSARY |
| Field & Link Suggestions | MVP — Core UX | GLOSSARY |
| Platform API (phased: foundation → Data → Schema) | MVP — Foundation + Core UX | platform-api.md |
| Record Thread + DMs + group DMs | MVP — Core UX | communications.md |
| System emails (Resend) | MVP — Core UX | email.md |
| Mobile (responsive Grid + Card + Record View) | MVP — Core UX | mobile.md |
| My Office (widget grid) | MVP — Core UX | my-office.md |
| Quick Panels (Chat, Tasks, Calendar) | MVP — Core UX | my-office.md |
| Settings (9 sections) | MVP — Core UX | settings.md |
| Audit log (table + helper + Record Activity) | MVP — Foundation + Core UX | audit-log.md |
| Bulk operations (7 actions) | MVP — Core UX | bulk-operations.md |
| Record templates | MVP — Core UX | record-templates.md |
| Field groups | MVP — Core UX | field-groups.md |
| Notification system | MVP — Core UX | communications.md |
| CSV/data import | MVP — Core UX | tables-and-views.md |
| File upload pipeline | MVP — Foundation | files.md |
| Observability (Pino, Sentry, OTel) | MVP — Foundation | observability.md |
| Testing infrastructure | MVP — Foundation | testing.md |
| Compliance (security headers, encryption, RLS) | MVP — Foundation | compliance.md |
| CockroachDB safeguards (UUIDv7, no serial) | MVP — Foundation | cockroachdb-readiness.md |
| Status field transitions (modes 1+2, no approval chains) | MVP — Core UX | approval-workflows.md |
| Atomic quantity operations (`adjustFieldValue()`) | MVP — Core UX | inventory-capabilities.md |
| ProgressChart cell renderer | MVP — Core UX | chart-blocks.md |

### 5.2 Post-MVP Features (EXCLUDED from all phases)

| Feature | Deferred To | Common Trap? |
|---------|-------------|-------------|
| **Kanban view** | Post-MVP (soon after) | **YES — commonly assumed MVP** |
| **List, Gantt, Calendar, Gallery views** | Post-MVP | |
| **Formula engine** | Post-MVP | **YES — commonly assumed MVP** |
| **Rollups and aggregations** | Post-MVP | |
| **AI Agents (autonomous multi-step)** | Post-MVP — AI Agents | **YES — agent_sessions table created in Foundation but runtime is post-MVP** |
| **App Designer (visual page builder)** | Post-MVP — Portals & Apps | **YES — commonly confused with MVP portals/forms** |
| **Custom Apps (POS, websites, internal apps)** | Post-MVP — Custom Apps | **YES** |
| **Visual automation canvas (branching, conditions)** | Post-MVP — Automations | **YES** |
| **Full-featured portals (multi-page, multi-record)** | Post-MVP — Portals & Apps | |
| **Self-hosted AI / data residency** | Post-MVP — Self-Hosted AI | **YES** |
| **DuckDB analytical layer** | Post-MVP — AI Agents | |
| **Vector embeddings / semantic search** | Post-MVP (file embedding generation may ship MVP) | |
| **Booking / Scheduling** | Post-MVP — Portals & Apps (Fast-Follow) | |
| **Approval workflows (Mode 3 chains)** | Post-MVP — Automations | |
| **Wiki / Knowledge Base** | Post-MVP | |
| **Full communications hub (omnichannel)** | Post-MVP — Comms & Polish | |
| **Workspace Map** | Post-MVP — Verticals & Advanced | |
| **Time tracking, asset library, ad platforms** | Post-MVP — Agency Features | |
| **Commerce embeds, live chat widget** | Post-MVP — Custom Apps | |
| **Document App type (canvas → PDF)** | Post-MVP — Documents | |
| **Personal Notes / Evernote competitor** | Post-MVP | |
| **Project management (PM overlays)** | Post-MVP | |
| **Accounting integration** | Post-MVP — Accounting Integration | |
| **Meetings system** | Post-MVP | |
| **MCP Client** | Post-MVP | |
| **Chart system (full — beyond ProgressChart)** | Post-MVP | |
| **SAML SSO / SCIM** | Post-MVP — Comms & Polish (Professional+ plans) | |

---

## 6. Phase-Internal Doc Order

### Phase: MVP — Foundation

Recommended build order (each doc's Foundation-phase deliverables):

| Order | Doc | What Ships |
|-------|-----|-----------|
| 1 | testing.md | Vitest workspace, Docker Compose test services, test factories, CI skeleton |
| 2 | data-model.md | Drizzle schema for all MVP tables (Tiers 0–7), migrations |
| 3 | database-scaling.md | PgBouncer config, `getDbForTenant()`, read/write routing, RLS policies |
| 4 | compliance.md | Security headers middleware, encryption config, RLS specs |
| 5 | cockroachdb-readiness.md | UUIDv7 enforcement, CI safeguard checks |
| 6 | observability.md | Pino + pino-http, traceId via AsyncLocalStorage, Sentry DSN, OTel |
| 7 | design-system.md | shadcn/ui primitives, Tailwind config, CSS tokens, fonts |
| 8 | permissions.md | Workspace role on workspace_memberships, role check utility, permission denial shape |
| 9 | realtime.md | Socket.io scaffold with Clerk auth, Redis adapter, room join/leave |
| 10 | files.md | StorageClient + R2 implementation, presigned URLs, MIME allowlist |
| 11 | ai-architecture.md | AIService skeleton, Anthropic adapter, prompt registry, capability routing |
| 12 | ai-data-contract.md | `canonicalToAIContext()` / `aiToCanonical()` signatures, basic type implementations |
| 13 | ai-metering.md | Credit system, metering flow, ai_usage_log / ai_credit_ledger |
| 14 | audit-log.md | audit_log table (partitioned), writeAuditLog() helper |
| 15 | platform-api.md | api_keys table, auth middleware, rate limiting, error format |
| 16 | vertical-architecture.md | Strategy document (no code — informs API design decisions) |
| 17 | operations.md | Docker Compose with health checks, .env.example, graceful shutdown |

### Phase: MVP — Sync

| Order | Doc | What Ships |
|-------|-----|-----------|
| 1 | sync-engine.md (FieldTypeRegistry) | Registry pattern, MVP field type registrations |
| 2 | sync-engine.md (CTL + Airtable) | Canonical Transform Layer, Airtable adapter, progressive sync |
| 3 | sync-engine.md (grid JSONB) | Expression indexes, grid rendering from canonical_data |
| 4 | sync-engine.md (outbound + conflicts) | Bidirectional sync, conflict detection/resolution |
| 5 | sync-engine.md (Notion + SmartSuite) | Second and third adapters |
| 6 | sync-engine.md (dashboard) | Sync settings, connection health, error recovery |
| 7 | field-groups.md (badges) | Synced table platform badge, sync status icon |
| 8 | realtime.md (sync push) | Sync status push via Redis → Socket.io (replaces polling) |
| 9 | observability.md (sync metrics) | Sync engine dashboard metrics, rate limiter telemetry |

### Phase: MVP — Core UX

| Order | Doc | What Ships |
|-------|-----|-----------|
| 1 | tables-and-views.md | Grid + Card views, Record View overlay, view management |
| 2 | field-groups.md | Field group rendering, coloring, collapse, hide/show panel |
| 3 | cross-linking.md | Cross-link creation, display, query-time resolution |
| 4 | communications.md | Record Thread, DMs, group DMs, Chat Editor, notification system |
| 5 | my-office.md | Widget grid, Quick Panels (Chat, Tasks, Calendar) |
| 6 | schema-descriptor-service.md | SDS implementation, caching, token budget estimator |
| 7 | command-bar.md | Universal search, slash commands, AI natural language search |
| 8 | ai-data-contract.md | All MVP field type implementations for AI boundary |
| 9 | ai-metering.md | Admin AI dashboard, user usage view |
| 10 | portals.md | Quick Portals (single-record, auth, caching) |
| 11 | forms.md | Quick Forms (Turnstile, embed, notifications) |
| 12 | smart-docs.md | TipTap editor, merge-tag templates, PDF generation |
| 13 | automations.md | 6 triggers, 7 actions, linear builder, execution engine |
| 14 | email.md | Resend system emails, automation Send Email action |
| 15 | bulk-operations.md | Selection model, 7 bulk actions, audit condensation |
| 16 | record-templates.md | Template CRUD, picker UX, dynamic tokens |
| 17 | approval-workflows.md | Status field transitions (modes 1+2 only) |
| 18 | audit-log.md | Record Activity tab, seven-source attribution |
| 19 | permissions.md | Full field-level model, config UI, caching |
| 20 | platform-api.md | Data API (Record CRUD), Schema API, File Upload API |
| 21 | settings.md | 9 settings sections |
| 22 | mobile.md + mobile-navigation-rewrite.md | Responsive views, input optimization, bottom nav |
| 23 | personal-notes-capture.md | is_personal column, My Notes sidebar section (minimal) |
| 24 | testing.md | Playwright E2E, component tests, AI eval pipeline |

### Phase: Post-MVP — Portals & Apps

| Order | Doc | What Ships |
|-------|-----|-----------|
| 1 | app-designer.md (Initial) | App Designer, block model, 12-column canvas, theming |
| 2 | portals.md (App Portals) | Multi-page portals, identity-based scoping, portal_clients |
| 3 | chart-blocks.md | Full chart system (8 types, Mode A data binding) |
| 4 | forms.md (App Forms) | Multi-step forms, conditional logic |
| 5 | embeddable-extensions.md (Website) | Website Mode, 6 block types |
| 6 | booking-scheduling.md | Calendar View, booking system (Fast-Follow) |
| 7 | meetings.md | Meeting table_type, agenda patterns |
| 8 | document-intelligence.md | Document-to-record extraction |
| 9 | platform-api.md (Provisioning) | Provisioning API, Portal/Form management |

### Phase: Post-MVP — Documents

| Order | Doc | What Ships |
|-------|-----|-----------|
| 1 | smart-docs.md (wiki mode) | Wiki sub_type, Smart Doc content tables, versioning |
| 2 | document-designer.md | Document App type, fixed canvas, merge tags, PDF/DOCX |
| 3 | gaps/knowledge-base-live-chat-ai.md | KB designation, wiki content schema |

### Phase: Post-MVP — Automations

| Order | Doc | What Ships |
|-------|-----|-----------|
| 1 | automations.md (visual canvas) | Visual builder, branching, conditions, full trigger/action set |
| 2 | approval-workflows.md (Mode 3) | Approval chains, approval UI, SLA monitoring |
| 3 | inventory-capabilities.md | Adjust Field action, Snapshot action, threshold triggers |
| 4 | record-templates.md (automation) | templateId on Create Record action, Command Bar auto-registration |
| 5 | platform-api.md (full) | AI API, Automation API, Webhook API, Tenant API |
| 6 | bulk-operations.md (run automation) | Run automation toolbar action |

### Phase: Post-MVP — Comms & Polish

| Order | Doc | What Ships |
|-------|-----|-----------|
| 1 | communications.md (advanced) | Activity feed, base/table threads |
| 2 | email.md (connected inbox) | Connected mailboxes, email events tracking |
| 3 | realtime.md (chat) | Full chat delivery, typing indicators, cursor broadcasting |
| 4 | mobile.md (advanced) | Offline queue, push notifications, PWA |
| 5 | operations.md (production) | Backup automation, Redis failover, monitoring dashboards |
| 6 | ai-metering.md (admin) | Full admin dashboard, daily caps, reconciliation |
| 7 | compliance.md (SOC 2) | SOC 2 Type I preparation, SSO/SCIM |
| 8 | testing.md (full suite) | Comprehensive E2E, accessibility audit |

---

## Validation Report

### Completeness Check

- **Docs from extraction JSON covered:** 63/63 reference docs + 4 gap docs accounted for + navigation.md (new, CP-002)
- **Every doc in MANIFEST appears in dependency graph:** YES (navigation.md added per CP-002)
- **Total MVP tables:** 52 (43 primary entities + 8 junction/log tables + 1 CP-002 table) + 1 database view (effective_memberships)
- **Total post-MVP tables:** 40+ (parked in data-model.md §Post-MVP Entities)

### Circular Dependency Check

No circular dependencies in schema creation order. The DAG has a maximum depth of 7 tiers. All FK relationships are strictly hierarchical (child → parent, never parent → child).

One notable quasi-circular reference: `portal_sessions.auth_id` is polymorphic (→ portal_access when auth_type='quick', → portal_clients when auth_type='app'). This is not a true circular dependency — portal_clients is post-MVP and the FK is resolved at runtime, not enforced as a DB constraint.

### Post-MVP Feature Guard

Verified: No post-MVP features appear in any MVP phase's doc ordering:
- Kanban view: NOT in any MVP phase
- Formula engine: NOT in any MVP phase (formula_dependencies table listed as post-MVP)
- AI Agents: NOT in any MVP phase (agent_sessions schema created but runtime deferred)
- App Designer: NOT in any MVP phase
- Visual automation canvas: NOT in any MVP phase
- Self-hosted AI: NOT in any MVP phase
- Custom Apps: NOT in any MVP phase
- Embeddable Extensions: NOT in any MVP phase

### Ambiguities

1. **personal-notes-capture.md scope tension:** Doc says basic My Notes ships MVP — Core UX. MANIFEST says post-MVP. Recommended: add schema columns in Foundation, defer UI to post-MVP unless user prioritizes.
2. **document-intelligence.md MVP activation:** Doc says metadata extraction activates in MVP — Core UX. MANIFEST says post-MVP. Recommended: schema stubs in Foundation, defer activation.
3. **inventory-capabilities.md `adjustFieldValue()`:** Listed as MVP — Core UX (Critical) in doc, but MANIFEST marks entire doc as post-MVP. Recommended: include as a shared DB utility in Foundation since automations need it for the "Adjust Number Field" action.
4. **chart-blocks.md ProgressChart:** Listed as MVP — Core UX in doc. Not explicitly called out in GLOSSARY MVP scope. Included because Progress field type needs a renderer — this is a cell renderer, not a "chart feature."
