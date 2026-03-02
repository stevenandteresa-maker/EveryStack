# Audit Step 9 — Completeness & Gap Analysis

**Date:** 2026-03-01
**Scope:** All docs in tarball (excluding session-log.md)
**Method:** Systematic search for TODO/TBD markers, empty sections, referenced-but-unspecified features, missing error states, missing edge cases, and gap doc resolution status.

**Status: ALL 17 ISSUES FIXED (2026-03-01)**

---

## Findings Table

| # | File | Gap Description | Priority | Status |
|---|------|-----------------|----------|--------|
| 1 | `data-model.md` | **SmartSuite sync adapter fields were `TBD | TBD`.** | **Critical** | ✅ Fixed — Filled in: Bidirectional, Polling only (no webhooks), 10 req/sec per API key. Sourced from `sync-engine.md` §Rate Limits. |
| 2 | `document-designer.md` | **`docx-template-engine-prompts.md` flagged as "pending creation."** | **Moderate** | ✅ Fixed — Removed references to pending doc. Clarified that architectural spec in document-designer.md is sufficient for implementation. |
| 3 | `permissions.md` | **Zero error-handling specification.** No error response shape, no UI feedback on denial, no audit of denied access. | **Critical** | ✅ Fixed — Added "Permission Denial Behavior" section: error response shape (`PermissionDeniedError`), UI behavior table (7 contexts), audit logging of denials with dedup, HTTP status conventions. |
| 4 | `permissions.md` | **No RLS/tenant isolation specification.** Zero mentions of tenant_id, RLS, or cross-tenant behavior. | **Moderate** | ✅ Fixed — Added "Tenant Isolation" section: cross-tenant 404 behavior (not 403), RLS layer separation, portal tenant isolation cross-reference. |
| 5 | `portals.md` | **Missing error states for authentication flows.** No expired magic link, invalid password, locked account, or session expiry behavior. | **Critical** | ✅ Fixed — Added "Auth Failure Paths" section: password login failures (5 scenarios), magic link failures (5 scenarios), session failures (4 scenarios), password reset flow (5 steps). All follow generic error messaging pattern. |
| 6 | `communications.md` | **Notification system was 12 lines** referenced by 15+ docs. Missing data model, delivery mechanism, types, API. | **Critical** | ✅ Fixed — Expanded to full spec: `notifications` table schema, `user_notification_preferences` JSONB structure, 8 notification types, delivery pipeline flow, bell icon behavior, smart grouping, notification API (5 endpoints), error handling (4 scenarios). |
| 7 | `communications.md` | **Zero error/failure/retry handling across messaging.** | **Moderate** | ✅ Fixed — Added "Messaging Error Handling" section: 10 error scenarios with client and server behavior columns. |
| 8 | `realtime.md` | **Reconnection logic was a single line.** No backoff params, catch-up mechanism, or stale data handling. | **Moderate** | ✅ Fixed — Expanded to full spec: auth/authorization for subscriptions, reconnection parameter table (6 params), 6-step reconnection sequence, catch-up query via Redis Streams, stale data indicator UX. |
| 9 | `forms.md` | **Form error handling was one sentence.** | **Moderate** | ✅ Fixed — Expanded to 9-row error table covering required fields, type violations, unique constraints, Turnstile, rate limiting, duplicate submissions, server errors, archived forms, attachment failures. Added accessibility notes. |
| 10 | `settings.md` | **Settings doc was layout-only — no functional specification.** | **Low** | ✅ Fixed — Added "Functional Specification" section: API/persistence model (5 storage locations), validation constraints, concurrent edit handling, plan enforcement, audit logging rules. |
| 11 | `CLAUDE.md` | **No platform authentication/signup/invite flow specification.** | **Moderate** | ✅ Fixed — Added "Platform Authentication & Onboarding" section: Clerk integration pattern, 5-step signup & workspace creation flow, 6-step team member invitation flow, session handling rules. |
| 12 | `tables-and-views.md` | **No CSV/data import specification.** Referenced by 6+ docs as a write path. | **Moderate** | ✅ Fixed — Added "CSV/Data Import — MVP" section: 5-step import flow, Papaparse parsing, auto field mapping, validation preview, batch execution, error report CSV, plan limit enforcement. |
| 13 | `GLOSSARY.md` | **Plan tier quota numbers entirely undefined.** | **Low** | ✅ Fixed — Added clarifying note: use domain doc placeholder numbers, all quotas are plan-level config values (not hardcoded), tunable via environment config. |
| 14 | `gaps/automations-...` | **Gap doc missing MERGED banner.** | **Low** | ✅ Fixed — Added "SUBSTANTIALLY MERGED" banner with merge details. |
| 15 | `portals.md` | **No specification for portal client file uploads.** | **Low** | ✅ Fixed — Added file upload spec: 25MB limit, 10 files per field, configurable allowed types, storage quota, audit tracking. |
| 16 | `realtime.md` | **Realtime doc thin for a foundational system.** | **Moderate** | ✅ Fixed — Addressed alongside #8. Added auth/authorization, subscription verification, room join security. |
| 17 | `CLAUDE.md` | **No unified error response specification.** | **Low** | ✅ Fixed — Added "Error Handling — Default Patterns" section: universal `AppError` shape, per-surface error conventions, default UI behavior table (6 error types), logging defaults. |

---

## Gap Doc Coverage Summary

| Gap Doc | Status | Resolution |
|---------|--------|------------|
| `gaps/portals-client-auth.md` | ✅ **MERGED** | All content incorporated into `app-designer.md`. |
| `gaps/tables-views-boundaries.md` | ✅ **SUPERSEDED** | Architecture evolved in `tables-and-views.md` and `GLOSSARY.md`. |
| `gaps/knowledge-base-live-chat-ai.md` | ✅ **POST-MVP (No Action)** | Entire document tagged as post-MVP. |
| `gaps/automations-execution-triggers-webhooks.md` | ✅ **SUBSTANTIALLY MERGED** | Key sections in `automations.md`. Banner added 2026-03-01. |

---

## Files Modified in Fix Pass

| File | Change | Lines Before → After |
|------|--------|---------------------|
| `data-model.md` | SmartSuite TBD → actual values | 595 → 595 |
| `permissions.md` | Added Permission Denial Behavior + Tenant Isolation | 393 → 452 |
| `portals.md` | Added Auth Failure Paths + portal file uploads | 488 → 531 |
| `communications.md` | Expanded notification system + messaging error handling | 327 → 439 |
| `document-designer.md` | Removed pending doc references | 629 → 629 |
| `realtime.md` | Expanded connection lifecycle, auth, reconnection | 184 → 220 |
| `forms.md` | Expanded error handling specification | 168 → 182 |
| `settings.md` | Added functional specification section | 72 → 113 |
| `CLAUDE.md` | Added Platform Auth & Onboarding + Error Handling defaults | ~400 → 461 |
| `tables-and-views.md` | Added CSV/Data Import section | 812 → 842 |
| `GLOSSARY.md` | Clarified quota deferral | 877 → 876 |
| `gaps/automations-execution-triggers-webhooks.md` | Added SUBSTANTIALLY MERGED banner | 687 → 690 |
| `MANIFEST.md` | Updated line counts and descriptions for all modified docs | Updated |

---

## Summary

All 17 issues from the original audit have been resolved. The documentation set now has:

- **Consistent error handling patterns** across all MVP surfaces (permissions, portals, forms, messaging, real-time)
- **A unified error response shape** documented in CLAUDE.md as the default for when domain docs are silent
- **Complete notification system specification** supporting the 15+ docs that reference it
- **Platform auth/onboarding flow** covering the Clerk integration gap
- **CSV import specification** grounding the 6+ docs that reference bulk import as a write path
- **No remaining TBD markers** in MVP-scoped specifications
- **All gap docs properly tagged** with merge/supersession status
