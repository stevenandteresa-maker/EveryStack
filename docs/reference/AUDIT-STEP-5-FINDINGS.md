# Step 5 — Schema Consistency: Findings

**Auditor:** Claude  
**Date:** 2026-03-01  
**Input tarball:** `everystack-post-step4-fixed.tar.gz`  
**Docs scanned:** 67 files  
**Canonical schema source:** `data-model.md` (70 tables), `GLOSSARY.md` (DB Entity Quick Reference)

---

## Summary

| Check                          | Scanned                              | Findings | Fixed                  | Informational              |
| ------------------------------ | ------------------------------------ | -------- | ---------------------- | -------------------------- |
| 1. Table name accuracy         | 70 canonical tables                  | 22       | 16 phantom stubs added | 5 ghost (no action needed) |
| 2. Column name accuracy        | Spot-checked key columns             | 0        | —                      | —                          |
| 3. Standard columns            | 35 MVP tables with full column specs | 2        | 2                      | 0                          |
| 4. JSONB structure consistency | 4 key JSONB columns                  | 0        | —                      | —                          |
| 5. Enum value consistency      | 6 enum types                         | 2        | 2                      | 0                          |
| 6. Foreign key coherence       | Spot-checked key FKs                 | 0        | —                      | —                          |
| **Totals**                     |                                      | **26**   | **20 fixed**           | **5 informational**        |

---

## Findings Table

| #     | File                    | Line(s) | Schema Reference  | Issue                                                                     | Severity             |
| ----- | ----------------------- | ------- | ----------------- | ------------------------------------------------------------------------- | -------------------- |
| 1     | `approval-workflows.md` | 6       | `actor_type` enum | "six-source" should be "seven-source"                                     | Moderate — **Fixed** |
| 2     | `bulk-operations.md`    | 15      | `actor_type` enum | "six-source" should be "seven-source"                                     | Moderate — **Fixed** |
| 3     | `data-model.md`         | 30      | `users` table     | Missing `created_at`, `updated_at` columns                                | Low — Informational  |
| 4     | `data-model.md`         | 31      | `tenants` table   | Missing `created_at`, `updated_at` columns                                | Low — Informational  |
| 5–9   | `data-model.md`         | various | 5 ghost tables    | Defined but never referenced by any other doc                             | Low — Informational  |
| 10–26 | various domain docs     | various | 17 phantom tables | Defined in domain docs but not listed in `data-model.md` Post-MVP section | Low — Informational  |

---

## Check 1 — Table Name Accuracy

Covers Ghost Tables (defined in data-model.md, never referenced elsewhere), Phantom Tables (referenced as tables in domain docs, not in data-model.md Post-MVP section).
Touches `automation_waiting`, `feature_suggestions`, `feature_votes`, `user_notification_preferences`, `user_recent_items` tables. See `approval-workflows.md`, `communications.md`, `command-bar.md`.

### Ghost Tables (defined in data-model.md, never referenced elsewhere)

| Table                           | data-model.md Line | Notes                                                                                                                   |
| ------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `automation_waiting`            | 160                | Wait-for-event step storage. Cross-ref says `approval-workflows.md` but that doc doesn't mention this table name.       |
| `feature_suggestions`           | 128                | User-submitted feature suggestions. No domain doc covers this feature.                                                  |
| `feature_votes`                 | 129                | Votes on feature suggestions. Same — no domain doc.                                                                     |
| `user_notification_preferences` | 93                 | Per-user notification settings. `communications.md` covers notification logic but doesn't reference this table by name. |
| `user_recent_items`             | 123                | Powers Command Bar recents. `command-bar.md` covers the feature but doesn't reference this table by name.               |

**Recommendation:** These tables are real and likely correct — the domain docs just don't mention them explicitly. No fix needed, but domain docs could optionally add cross-references.

### Phantom Tables (referenced as tables in domain docs, not in data-model.md Post-MVP section)

These 17 tables have schema definitions or explicit table references in domain docs but are not listed in `data-model.md` §Post-MVP Entities:

| Table                     | Primary Domain Doc                                      | Category                                                                                           |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `approval_requests`       | `approval-workflows.md` §approval_requests Table        | Approval system                                                                                    |
| `approval_rules`          | `approval-workflows.md` §approval_rules Table           | Approval system                                                                                    |
| `approval_step_instances` | `approval-workflows.md` §approval_step_instances Table  | Approval system                                                                                    |
| `booking_availability`    | `booking-scheduling.md`                                 | Scheduling system (already listed in data-model.md:153 — this is actually in the Post-MVP section) |
| `chat_visitors`           | `embeddable-extensions.md` §chat_visitors Table         | Live chat                                                                                          |
| `chat_widgets`            | `embeddable-extensions.md` §chat_widgets Table          | Live chat                                                                                          |
| `commerce_transactions`   | `embeddable-extensions.md` §commerce_transactions Table | Commerce                                                                                           |
| `connected_calendars`     | `email.md`                                              | Calendar integration                                                                               |
| `connected_mailboxes`     | `email.md`                                              | Email integration                                                                                  |
| `email_events`            | `email.md`                                              | Email tracking                                                                                     |
| `email_templates`         | `email.md` §email_templates                             | Email system                                                                                       |
| `email_suppression_list`  | `email.md` §email_suppression_list                      | Email compliance                                                                                   |
| `formula_dependencies`    | `formula-engine.md`                                     | Formula engine                                                                                     |
| `knowledge_embeddings`    | `gaps/knowledge-base-live-chat-ai.md`                   | Vector search                                                                                      |
| `portal_magic_links`      | `app-designer.md`                                       | Portal auth                                                                                        |
| `record_embeddings`       | `vector-embeddings.md`, `cockroachdb-readiness.md`      | Vector search                                                                                      |
| `workspace_knowledge`     | `agent-architecture.md`                                 | AI agents                                                                                          |

**Resolution:** All 16 tables (excluding `booking_availability` which was already listed) added as stub entries to `data-model.md` §Post-MVP Entities, following the existing one-line-per-table pattern. Claude Code will now find them when scanning `data-model.md` for the complete table inventory.

---

## Check 2 — Column Name Accuracy ✅

Spot-checked key columns across docs:

- `audit_log.actor_type` — 7 values consistent across `audit-log.md`, `data-model.md`, `GLOSSARY.md` (after "six-source" fix)
- `portal_sessions.auth_type` — `'quick'|'app'` consistent across `data-model.md`, `portals.md`, `app-designer.md`, `GLOSSARY.md`
- `records.canonical_data` — keyed by `fields.id` consistently referenced
- `views.permissions` — ViewPermissions JSONB shape consistent
- `workspace_memberships.role` — `manager|team_member|viewer` consistent

No mismatches found.

---

## Check 3 — Standard Columns

### Missing `created_at` and `updated_at` on Primary Entities

| Table     | Has `created_at`? | Has `updated_at`? | Notes                                                              |
| --------- | ----------------- | ----------------- | ------------------------------------------------------------------ |
| `users`   | ❌                | ❌                | Primary entity — should track account creation and profile changes |
| `tenants` | ❌                | ❌                | Primary entity — should track org creation and settings changes    |

All other MVP tables either have explicit timestamps or have appropriate alternatives (`joined_at`, `saved_at`, `started_at`/`completed_at`, etc.).

**Resolution:** Added `created_at` and `updated_at` to both `users` and `tenants` column specs in `data-model.md`.

---

## Check 4 — JSONB Structure Consistency ✅

Spot-checked four heavily-referenced JSONB columns:

- **`records.canonical_data`** — Consistently described as keyed by `fields.id` across `data-model.md`, `record-templates.md`, `ai-data-contract.md`, `sync-engine.md`
- **`views.config`** — Filter/sort/group/field_visibility structure consistent across `tables-and-views.md`, `permissions.md`, `mobile.md`
- **`views.permissions`** — ViewPermissions shape (`roles`, `specificUsers`, `excludedUsers`, `fieldPermissions`) consistent across `permissions.md`, `data-model.md`
- **`portal_sessions.auth_type`** — Polymorphic FK pattern (`'quick'` → `portal_access.id`, `'app'` → `portal_clients.id`) consistent across 4 docs

No JSONB structural conflicts found.

---

## Check 5 — Enum Value Consistency

### Finding 1–2: Stale "six-source" actor_type count — **Fixed**

Two cross-reference lines still said "six-source attribution" after `api_key` was added as the seventh `actor_type` value.

**`approval-workflows.md:6`**  
Before: `audit-log.md (approval events extend audit trail, six-source attribution)`  
After: `audit-log.md (approval events extend audit trail, seven-source attribution)`

**`bulk-operations.md:15`**  
Before: `audit-log.md (six-source attribution, bulk operation condensation...)`  
After: `audit-log.md (seven-source attribution, bulk operation condensation...)`

**Root cause:** When `api_key` was added as the seventh actor_type during the 2026-02-28 reconciliation, `audit-log.md` itself was updated but these two cross-referencing docs were missed.

### Other Enums — All Consistent ✅

| Enum                         | Canonical Values                                                               | Docs Checked                               | Result         |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ | -------------- |
| `actor_type`                 | user, sync, automation, portal_client, system, agent, api_key                  | audit-log.md, data-model.md, GLOSSARY.md   | ✅ (after fix) |
| `table_type`                 | table, projects, calendar, documents, wiki                                     | data-model.md, tables-and-views.md         | ✅             |
| `view_type`                  | grid, card (MVP); kanban, list, gantt, calendar, gallery, smart_doc (post-MVP) | data-model.md, tables-and-views.md         | ✅             |
| `tenant_memberships.role`    | owner, admin, member                                                           | data-model.md, GLOSSARY.md, permissions.md | ✅             |
| `workspace_memberships.role` | manager, team_member, viewer                                                   | data-model.md, GLOSSARY.md, permissions.md | ✅             |
| `publish_state`              | live, draft                                                                    | data-model.md, record-templates.md         | ✅             |

---

## Check 6 — Foreign Key Coherence ✅

Spot-checked key FK relationships:

| FK Reference                                     | Source Table                                              | Target Table        | Confirmed in data-model.md? |
| ------------------------------------------------ | --------------------------------------------------------- | ------------------- | --------------------------- |
| `workspace_id → workspaces.id`                   | tables, automations, webhook_endpoints                    | workspaces          | ✅                          |
| `table_id → tables.id`                           | fields, records, views, record_view_configs               | tables              | ✅                          |
| `record_view_config_id → record_view_configs.id` | forms, portals                                            | record_view_configs | ✅                          |
| `thread_id → threads.id`                         | thread_messages, thread_participants                      | threads             | ✅                          |
| `webhook_endpoint_id → webhook_endpoints.id`     | webhook_delivery_log                                      | webhook_endpoints   | ✅                          |
| `base_connection_id → base_connections.id`       | sync_failures, sync_schema_changes, synced_field_mappings | base_connections    | ✅                          |

No FK mismatches found.

---

## Files Modified

| File                    | Change                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `approval-workflows.md` | Line 6: "six-source" → "seven-source" in cross-references         |
| `bulk-operations.md`    | Line 15: "six-source" → "seven-source" in cross-references        |
| `data-model.md`         | Line 30: Added `created_at`, `updated_at` to `users` table        |
| `data-model.md`         | Line 31: Added `created_at`, `updated_at` to `tenants` table      |
| `data-model.md`         | Lines 168–183: Added 16 phantom table stubs to §Post-MVP Entities |
| `MANIFEST.md`           | Updated `data-model.md` line count: 579 → 595                     |

---

## Verification Commands

```bash
tar xzf everystack-post-step5-fixed.tar.gz

# Verify no "six-source" remains outside reconciliation notes and audit findings
grep -rn "six-source" *.md gaps/*.md | grep -v AUDIT | grep -v session-log | grep -v reconciliation

# Verify seven-source is now in approval-workflows and bulk-operations
grep "seven-source" approval-workflows.md
grep "seven-source" bulk-operations.md

# Verify actor_type canonical values in audit-log.md
grep "actor_type" audit-log.md | grep "'user'" | head -1
```
