# EveryStack — Quick Forms (MVP)

> **Reference doc.** MVP form implementation: Record View layout configured for data input, creating one record per submission.
> For App Forms (multi-step, conditional logic, App Designer), see `app-designer.md`.
> Cross-references: `data-model.md` (forms + form_submissions tables), `tables-and-views.md` (record_view_configs), `portals.md` (portal-embedded forms — Post-MVP — Portals & Apps), `design-system.md` (form field rendering)
> Created: 2026-02-28

---

## Overview

A **Quick Form** is a Record View layout configured for data input rather than display. It creates one record in a target table on each submission. Forms use the same field canvas layout as Record View (`record_view_configs`), ensuring consistent field rendering and validation.

**Key characteristics:**
- One table, one record per submission
- Uses Record View field canvas (columns, widths, ordering)
- Public or link-gated access (no workspace membership required)
- Standalone URL or embeddable (script tag / iframe)
- Spam protection via Cloudflare Turnstile

---

## Two-Tier Forms Distinction

| | Quick Forms (MVP) | App Forms (Post-MVP) |
|--|-------------------|------------------------|
| **Built with** | Table toolbar, not a designer | App Designer visual builder |
| **Layout** | Record View field canvas (columns, widths, ordering) | Drag-and-drop blocks, multi-page, conditional logic |
| **Scope** | One table, creates one record | Cross-table, computed fields, multi-step |
| **Auth** | Public or link-gated | Portal session, identity-scoped |
| **Access** | Standalone URL, embed (script/iframe) | App Designer published URL |
| **Reference** | This doc (`forms.md`) | `app-designer.md` |

> Both types coexist permanently. Quick Forms remain available from the table toolbar after App Forms ship. Conversion is optional, not inevitable.

---

## Form Configuration

- **Field selection and ordering:** Which table fields appear on the form and in what order. Not all fields need to appear — hidden fields are simply omitted from the form UI (but may still receive values from record templates).
- **Required field overrides:** `forms.settings.required_field_overrides` — allows the form to mark fields as required even if they're optional in the table schema, or vice versa.
- **Field visibility:** Subset of table fields. Fields not included in the form's `record_view_config` are not shown to submitters.
- **Success behavior:** Configurable per form — thank-you message, redirect URL, or submitted data summary.

---

## Schema

Canonical schema defined in `data-model.md`. Summary for reference:

### `forms` Table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant scope |
| `table_id` | UUID FK → tables | Target table for record creation |
| `record_view_config_id` | UUID FK → record_view_configs | Layout configuration |
| `name` | VARCHAR(255) | Display name |
| `slug` | VARCHAR | URL-friendly identifier |
| `status` | VARCHAR | `draft` \| `published` \| `archived` |
| `settings` | JSONB | See Settings JSONB below |
| `created_by` | UUID FK → users | Form creator |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `form_submissions` Table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `form_id` | UUID FK → forms | Parent form |
| `tenant_id` | UUID | Tenant scope |
| `record_id` | UUID FK → records | Created record |
| `submitted_at` | TIMESTAMPTZ | Submission timestamp |
| `ip_address` | VARCHAR | Submitter IP (for rate limiting, audit) |
| `user_agent` | VARCHAR | Browser user agent |

### Settings JSONB

```jsonc
{
  "success_message": "Thank you for your submission!",
  "redirect_url": null,                    // Optional — redirect after submit
  "turnstile_enabled": true,               // Cloudflare Turnstile spam protection
  "notification_emails": ["admin@co.com"], // Email on each submission
  "required_field_overrides": {
    "fld_phone": true,                     // Make optional field required on form
    "fld_notes": false                     // Make required field optional on form
  }
}
```

---

## Submission Flow

1. User fills fields → client-side validation (required fields, type constraints from `FieldTypeRegistry`)
2. Cloudflare Turnstile challenge (if `settings.turnstile_enabled = true`)
3. Server validates all fields, applies required overrides from `settings.required_field_overrides`
4. Server creates record in target table via standard record creation path
5. Server logs submission to `form_submissions` (record_id, IP, user_agent)
6. Server sends notification emails to `settings.notification_emails[]` list
7. Client renders success state: message, redirect, or submitted data summary

**Error handling:**

| Error | Client behavior | Server behavior |
|-------|----------------|-----------------|
| **Required field empty** | Inline error beneath field: "This field is required." Field border turns `accent` red. Submit button disabled until resolved. | Client-side only. Server also validates (defense in depth). |
| **Type constraint violation** (e.g., text in number field) | Inline error: "Please enter a valid number." Validation messages come from `FieldTypeRegistry.validate()`. | Server returns 422 with `{ field: fieldId, error: 'validation_failed', message: '...' }`. |
| **Unique constraint violation** | Inline error on the field: "This value already exists." | Server returns 409 with the conflicting field ID. |
| **Turnstile challenge failed** | Banner: "Security check failed. Please try again." Re-render challenge widget. | Server returns 403. Do not create record. |
| **Rate limited (too many submissions)** | Banner: "Too many submissions. Please wait a moment and try again." | Server returns 429. Per-IP: 10 submissions / 15 minutes (default, configurable per form). |
| **Duplicate submission (double-click)** | Submit button disabled immediately on first click. Shows spinner. Second click is no-op. | Server-side idempotency: `form_submissions` includes a client-generated `idempotency_key` (UUID generated on form load). Duplicate key → return original success response. |
| **Server error (DB failure, unexpected)** | Banner: "Something went wrong. Please try again." No field-level detail. Form data preserved — user can retry without re-entering. | Server returns 500. Log full error with `traceId`. Do not expose internal details. |
| **Form archived or draft** | Render "This form is no longer accepting submissions" page. No form fields shown. | Return 404-style page at the form URL. |
| **File attachment upload failure** | Inline error on attachment field: "File upload failed — please try again." Other fields preserved. | Attachment upload is a separate request. If it fails, record creation is blocked (attachment field value is empty). |

**Accessibility:** Error messages are associated with their fields via `aria-describedby`. Focus moves to the first field with an error on submit attempt. Error banner has `role="alert"` for screen reader announcement.

---

## Spam Protection

- **Cloudflare Turnstile** integration — invisible challenge by default
- Configurable per form via `settings.turnstile_enabled`
- **Rate limiting:** Per-IP submission throttle (configurable) — prevents automated bulk submissions
- Forms with Turnstile disabled are more vulnerable; recommended for internal/link-gated forms only

---

## Access & Distribution

- **Standalone URL:** `forms.everystack.app/{slug}`
- **Embed:** Script tag or iframe snippet — generated in form settings UI
- **Embed styling:** Inherits basic theme, constrained by iframe sandbox
- **Access modes:** Public (no auth required) or link-gated (requires knowing the URL — not indexed, not guessable)

---

## Notification on Submission

- Configurable list of email addresses (`settings.notification_emails[]`)
- Email contains: form name, submitted field values summary, link to created record (for workspace members)
- Sent immediately on successful submission via Resend

---

## Mobile Rendering

- Single-column field layout (responsive — desktop may use multi-column from `record_view_config`)
- Touch-optimized input controls (date pickers, dropdowns, file upload)
- Same validation UX as desktop — inline field errors, submit button disabled until required fields satisfied

---

## Permissions

- **Form creation:** Manager+ (workspace role)
- **Form submission:** Anyone with URL access (no workspace membership required)
- **Created record:** Inherits normal table permissions for workspace members; submitter has no ongoing access unless they're a workspace member

---

## Rendering Contexts

From `tables-and-views.md`:

| Context | Record View Config | Purpose |
|---------|-------------------|---------|
| Form | `forms` + `record_view_configs` | External user creating a record via form — empty fields, submit action |

---

## Phase Implementation

| Phase | Work |
|-------|------|
| **MVP — Core UX** | `forms` table, `form_submissions` table, Turnstile integration, embed snippet generation, notification emails, standalone URL routing |
| **Post-MVP — Portals & Apps** | Portal-embedded forms (form within a portal session — form accessible through portal auth context) |
| **Post-MVP** | App Forms via App Designer (multi-step, conditional logic, cross-table, computed fields) |
