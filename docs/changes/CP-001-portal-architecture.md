# CP-001 — Portal Architecture Refinements

| Field | Value |
|-------|-------|
| **Status** | APPLIED |
| **Date** | 2026-03-05 |
| **Phase Impact** | Pre-Portal build phase |
| **Origin** | Architecture review session |
| **Depends On** | — |
| **Reference Docs Updated** | 2026-03-05 (last conversation) |

---

## 1. Overview

Six concrete decisions made during an architecture review of the portal system. Each addresses a gap or ambiguity in the current spec that would cause rework or drift if left unresolved before the portal build phase begins.

All six changes are pre-build — none require migrating existing data. Phases 1A–1H are unaffected. This proposal was applied to reference docs before any portal-related build prompts were written.

**Scope:** Portals only. Multi-tenant identity and agency model changes are covered in CP-002.

---

## 2. Blast Radius

| Document | Impact | What Changes |
|----------|--------|--------------|
| `portals.md` | HIGH | Slug uniqueness, record deletion cascade, thread model, multi-record list UX, `linked_record_id` addition |
| `data-model.md` | HIGH | Schema additions to `portals`, `portal_access`, and `threads` tables |
| `communications.md` | MEDIUM | Two-thread model per record — `thread_type` discriminator replaces `visibility` column |
| `automations.md` | LOW | Confirm `record.updated` is sufficient for portal write-backs — no new trigger needed |
| `GLOSSARY.md` | LOW | URL pattern update for tenant-scoped portal slugs |

---

## 3. Changes

### CP-001-A — Portal Slug Uniqueness (Tenant-Scoped)

**What:** Portal slugs move from platform-global uniqueness to tenant-scoped uniqueness.

| Before | After |
|--------|-------|
| `UNIQUE (slug)` | `UNIQUE (tenant_id, slug)` |
| `portal.everystack.app/{slug}` | `portal.everystack.app/{tenant-slug}/{portal-slug}` |

**Why:** Platform-global slug uniqueness means generic names like "portal," "clients," and "projects" can only exist once across all tenants. Tenant-scoped slugs give every tenant their own namespace, which also composes cleanly with custom domains.

**Schema:**
```sql
-- portals table
DROP   UNIQUE (slug)
ADD    UNIQUE (tenant_id, slug)
```

**Downstream UX:**
- Portal URL displayed in the portal admin panel updates to show the two-part path.
- Custom domain support (post-MVP) follows the same pattern: `acme.com/{portal-slug}`.
- `GLOSSARY.md` portal URL example requires update.

---

### CP-001-B — Record Deletion Cascade for Portal Access

**What:** When a workspace record is deleted, any `portal_access` rows pointing to it are cascade-revoked. A new `revoked_at` column on `portal_access` tracks this. The deletion flow warns the Manager before proceeding.

**Why:** `portal_access.record_id` is the entire scoping mechanism for Quick Portals. A deleted record leaves orphaned `portal_access` rows. Clients who visit their portal URL hit a silent error. The warn-then-cascade pattern keeps the client experience graceful and maintains audit integrity.

**Schema:**
```sql
-- portal_access table
ADD  revoked_at       TIMESTAMPTZ  nullable
ADD  revoked_reason   VARCHAR      nullable  -- "record_deleted" | "manager_revoked" | "portal_archived"
```

**Deletion flow:**
1. Workspace user initiates record deletion.
2. System checks for `portal_access` rows referencing this record.
3. If found: modal warns — "2 portal clients have access to this record. Deleting it will revoke their access." — with explicit confirm.
4. On confirm: record soft-deleted, `portal_access.revoked_at` set, `portal_access.revoked_reason = "record_deleted"`.
5. Portal client visits URL → session check passes → data resolver finds `revoked_at` is set → renders graceful "This portal is no longer available" page.

**Downstream UX:**
- Portal admin panel Clients tab shows revoked clients with reason and timestamp.
- Audit log records the cascade revocation with `actor_type = "system"` and reference to the deletion event.

---

### CP-001-C — Portal Edit Automation: `record.updated` is Sufficient

**What:** No new automation trigger is added for portal client edits. The existing `record.updated` domain event, already fired on portal write-backs, is sufficient.

**Why:** When a Manager configures a field as editable in a portal and an automation fires on `record.updated`, the Manager has explicitly established that relationship. If source-based filtering is needed in future, the `record.updated` event payload already carries enough context — a `source` field can be added without a schema change or a new trigger type.

**Decision:** No `portal.client_updated_record` trigger. `record.updated` handles portal write-backs. Source context deferred to post-MVP payload enrichment if needed.

**Schema impact:** None.

---

### CP-001-D — Two Distinct Thread Types Per Record

**What:** The `threads` table gains a `thread_type` discriminator column replacing the existing `visibility` column. Every record has exactly two threads: an internal thread (workspace users only) and a client thread (workspace users + portal client).

**Why:** The current `visibility: internal | client_visible` column implies a single thread that gets toggled. Internal team communication and client-facing communication are fundamentally different surfaces. Conflating them into one thread with a visibility toggle creates a high-risk accidental leak scenario. Two separate threads eliminates this entirely — the internal thread does not exist in the portal's data layer.

**Schema:**
```sql
-- threads table
DROP  visibility  VARCHAR  -- "internal" | "client_visible"  (superseded)
ADD   thread_type VARCHAR  -- "internal" | "client"

-- Constraint: one of each type per record
ADD   UNIQUE (scope_type, scope_id, thread_type)
```

**Thread behavior:**

| | Internal Thread | Client Thread |
|---|---|---|
| Creation | Auto-created with every record | Created when Manager enables Client Messaging in portal settings |
| Who can read | All workspace users with record access (MVP) | Workspace users + portal client |
| Who can write | All workspace users with record access (MVP) | Workspace users + portal client |
| Visible in portal | Never | Yes — rendered as messaging panel when enabled |
| Post-MVP upgrade | No change | Manager designates specific users as client thread participants |

**Notification requirement:** Portal clients must be notified when a workspace user posts a reply. Email notification via Resend is required at MVP.

**MVP scope:** Client thread notification (outbound email to portal client on new reply) is MVP scope.

**Workspace Record View UX:**
- Record View shows both threads — tab pattern: "Team Notes" (internal) and "Client Messages" (client thread).
- When composing in the client thread, a persistent indicator makes clear the message is client-visible.
- New message from portal client triggers notification to workspace users with record access.

---

### CP-001-E — Multi-Record List View

**What:** When a portal client has access to multiple records, the portal renders a list page before the record view. One record → direct to record; multiple records → list first.

**Why:** The current spec states "the portal renders a list of accessible records" but does not define what that list looks like, how it is configured, or what the URL structure is.

**MVP approach — Manager-designated summary fields (Option C):**
- Manager designates up to 3 fields as summary fields in portal settings.
- List row shows: record name + summary fields. If `summaryFields` is empty, record name only.
- Stored in `portals.settings` JSONB — no new tables or columns required.

```jsonc
// portals.settings JSONB addition
{
  "listView": {
    "summaryFields": []  // field IDs, max 3, shown on list rows
  }
}
```

**Post-MVP upgrade:** Full list layout config (Option B) — Manager builds the list surface column by column.

**URL structure:**
```
portal.everystack.app/{tenant-slug}/{portal-slug}
  → list page (if multiple records) OR direct record view (if one record)

portal.everystack.app/{tenant-slug}/{portal-slug}/{record-slug}
  → individual record view
```

**Schema:**
```sql
-- portal_access table
ADD  record_slug  VARCHAR  -- client-safe, non-guessable slug for portal URLs
ADD  UNIQUE (portal_id, record_slug)
-- Generated on portal_access creation. Raw record UUID never exposed in portal URLs.
```

---

### CP-001-F — Portal Client Identity Link for Post-MVP Conversion

**What:** A nullable `linked_record_id` column is added to `portal_access`. Unused at MVP but enables the Quick Portal → App Portal conversion wizard post-MVP.

**Why:** The post-MVP conversion path requires matching `portal_access` email addresses to records in an identity table. Adding `linked_record_id` now, with UI nudges during invite, dramatically improves the post-MVP conversion experience.

**Schema:**
```sql
-- portal_access table
ADD  linked_record_id  UUID  nullable  FK → records(id)
-- Nullable: not required at MVP, set optionally by Manager on client invite
```

**MVP UX nudge:** On portal client invite flow, after Manager enters email and selects record, optional step: "Link this client to a contact record." Autocomplete search on workspace tables. Manager can skip.

**Important:** This field is entirely optional at MVP. The portal works identically with or without it.

---

## 4. Consolidated Schema Changes

All schema changes for a single migration, applied before any portal build phase:

```sql
-- Migration: CP-001 Portal Architecture Refinements

-- CP-001-A: Tenant-scoped portal slugs
ALTER TABLE portals DROP CONSTRAINT portals_slug_key;
ALTER TABLE portals ADD CONSTRAINT portals_tenant_slug_unique UNIQUE (tenant_id, slug);

-- CP-001-B: Record deletion cascade
ALTER TABLE portal_access ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE portal_access ADD COLUMN revoked_reason VARCHAR;

-- CP-001-D: Two thread types per record
ALTER TABLE threads DROP COLUMN visibility;
ALTER TABLE threads ADD COLUMN thread_type VARCHAR NOT NULL DEFAULT 'internal';
ALTER TABLE threads ADD CONSTRAINT threads_one_per_type
  UNIQUE (scope_type, scope_id, thread_type);

-- CP-001-E: Client-safe record slugs for portal URLs
ALTER TABLE portal_access ADD COLUMN record_slug VARCHAR;
ALTER TABLE portal_access ADD CONSTRAINT portal_access_record_slug_unique
  UNIQUE (portal_id, record_slug);

-- CP-001-F: Portal client identity link (post-MVP conversion path)
ALTER TABLE portal_access ADD COLUMN linked_record_id UUID REFERENCES records(id);

-- portals.settings JSONB — no migration needed, additive to existing JSONB column
```

---

## 5. Decision Log

| Ref | Decision | Rationale |
|-----|----------|-----------|
| CP-001-A | Tenant-scoped slugs over global uniqueness | Avoids slug squatting on day one. Composes with custom domains. |
| CP-001-B | Warn-then-cascade on record delete | Manager retains control. Client gets graceful failure state. |
| CP-001-C | No portal-specific automation trigger at MVP | Manager configured the portal and gave edit access — knows it will fire `record.updated`. Source filtering deferred. |
| CP-001-D | Two threads per record — separate entities, not one with visibility toggle | Eliminates accidental client exposure of internal communications. Clean access boundary. |
| CP-001-D MVP | All workspace users with record access can read/write both threads | Simpler. Designated-rep model deferred to post-MVP. |
| CP-001-D post-MVP | Manager designates specific workspace users as client thread participants | Limits client correspondence to designated rep. |
| CP-001-E MVP | Summary field picker (Option C) for list view — up to 3 fields | Zero schema cost. Sufficient for MVP. Full column layout builder deferred. |
| CP-001-E | Client-safe record slugs in portal URLs | Professional URL appearance. Prevents enumeration attacks. |
| Guest access | No guest membership tier — portals handle all external access | Keeps `tenant_memberships` clean. Portals provide the right access level for all external scenarios. |
