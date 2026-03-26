# EveryStack — Email Architecture

> **Reference doc.** Email system: transactional system emails (MVP), outbound CRM (Post-MVP — Documents), connected inbox (Post-MVP — Comms & Polish). Provider stack, compose UI, templates, tracking, inbound matching, data model.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (email_templates, email_events schema), `communications.md` (Record Thread email entries, notification delivery), `automations.md` (Send Email action), `smart-docs.md` (Send in email action)
> Last updated: 2026-02-27 — Aligned with GLOSSARY.md. Clarified MVP = system emails only. Cleaned cross-refs to post-MVP docs.

---

## Email Provider Stack

| Role                             | Provider                     | Rationale                                                                                                    |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Outbound transactional + CRM** | **Resend**                   | Modern API, React Email support, webhook tracking (opens/clicks/bounces), clean pricing (3K free → $20/50K). |
| **Inbound routing**              | **Cloudflare Email Workers** | Receives reply emails, routes to API. Free tier. Pairs with existing Cloudflare stack.                       |

---

## Sender Identity — Four Tiers

| Tier                   | From Address                      | Phase                     | Use Case                                |
| ---------------------- | --------------------------------- | ------------------------- | --------------------------------------- |
| **System**             | `notifications@everystack.com`    | MVP                       | Invitations, system alerts              |
| **Workspace branded**  | `{workspace}@mail.everystack.com` | Post-MVP — Documents      | Automation emails, doc sends, templates |
| **Custom domain**      | `hello@clientagency.com`          | Post-MVP — Documents      | Professional branded outbound           |
| **Connected personal** | `alex@clientagency.com`           | Post-MVP — Comms & Polish | Personal replies, connected inbox       |

**Custom domain verification (Post-MVP — Documents):**

1. Manager → Settings > Email > Domains > "Add Domain"
2. EveryStack generates DNS records: SPF, DKIM (via Resend), DMARC
3. Manager adds to DNS. EveryStack verifies (poll or manual button).
4. Domain available as sender identity.

---

## MVP: System Emails

Platform sends emails on behalf of the system. No compose UI. No user-authored content.

**Email types:**

- Workspace invitations ("You've been invited to join {workspace}")
- System alerts (sync failures, automation errors, storage quota warnings)

**Note:** Password reset and magic link auth handled by Clerk's built-in email system, not EveryStack's Resend integration.

**From:** `notifications@everystack.com` (single verified sender).

**Templates:** React Email components rendered server-side. EveryStack branding. Not user-editable — system templates maintained by engineering.

---

## Post-MVP: Outbound CRM Email (Post-MVP — Documents)

Covers Email Compose UI, Email Templates, Sent Email → Record Timeline, Open/Click Tracking, Resend Webhook Endpoint, Sending Limits.
Touches `thread_messages`, `email_metadata`, `email_events` tables.

### Email Compose UI

**Record-context modal** — email always sent in context of a record.

**Entry points:**

- Record View "Send Email" button (visible when record has Email field)
- Smart Doc "Send in email" action
- Automation "Send Email" action (headless — configured in builder)
- Command Bar `/email`

**Compose modal:**

```
┌──────────────────────────────────────────────────────┐
│  New Email                                      ✕    │
├──────────────────────────────────────────────────────┤
│  From: [workspace branded ▾]                         │
│  To:   [alex@client.com] (auto from record)          │
│  CC:   [                                        ]    │
│  BCC:  [                                        ]    │
│  Subject: [                                     ]    │
├──────────────────────────────────────────────────────┤
│  Template: [None ▾]                                  │
├──────────────────────────────────────────────────────┤
│  [TipTap Chat Editor — rich text body]               │
│  Type { to insert merge fields                       │
├──────────────────────────────────────────────────────┤
│  📎 Attachments: [+ Add]  Smart Doc PDF ✓            │
│  ☐ Track opens   ☐ Track clicks                      │
│  [Cancel]                          [Send ▾] [Schedule]│
└──────────────────────────────────────────────────────┘
```

**Compose behavior:**

- **To auto-population:** Email field on record → auto-fill. Multiple email fields → dropdown.
- **Merge fields:** Type `{` → field picker. Inline teal pill node. Resolved at send time.
- **Rich text body:** TipTap Chat Editor with bold, italic, underline, links, lists, images, horizontal rule. No headings, code blocks, or slash commands.
- **Attachments:** Drag-drop or picker. Max 25MB total (Resend limit).
- **Template picker:** Pre-fills subject + body with merge fields. Editable after loading.
- **Schedule send:** "Send" dropdown includes "Schedule for later" with date/time picker. Queued via BullMQ delayed job.
- **From picker:** Workspace branded, verified custom domains. Connected accounts (Post-MVP — Comms & Polish).

### Email Templates

**Lightweight, separate from Smart Doc templates.**

Smart Doc templates generate documents. Email templates are for communication. Different context, simpler format.

- Settings > Email > Templates (also accessible from compose modal)
- Manager+ creates/edits. Team Members use but not modify.
- Subject + body with `{merge}` syntax. Categorization optional.
- Preview with sample record data before saving.

### Sent Email → Record Timeline

Every sent email creates `thread_messages` row with `message_type: 'email_outbound'` and `email_metadata` JSONB:

```json
{
  "to": ["alex@client.com"],
  "cc": [],
  "bcc": [],
  "subject": "Proposal for Project Alpha",
  "from_address": "hello@clientagency.com",
  "resend_message_id": "msg_abc123",
  "tracking_id": "estrk_a1b2c3d4e5f6",
  "template_id": "uuid-or-null",
  "attachments": [{ "filename": "proposal.pdf", "file_url": "s3://...", "size": 245000 }],
  "scheduled_at": null
}
```

**Timeline display:** Envelope icon, subject, recipient(s), timestamp. Delivery indicators (✓ Sent → ✓ Delivered → 👁 Opened → 🔗 Clicked). Click to expand full body inline.

### Open/Click Tracking

Resend webhook events → `/api/webhooks/resend` → `email_events` table.

| Event          | How                        | Display                                    |
| -------------- | -------------------------- | ------------------------------------------ |
| **Sent**       | Resend confirms acceptance | ✓ gray                                     |
| **Delivered**  | Delivery confirmed         | ✓ teal                                     |
| **Opened**     | Tracking pixel             | 👁 with count and timestamp                |
| **Clicked**    | Link wrapping              | 🔗 with link name and timestamp            |
| **Bounced**    | Webhook                    | ⚠️ red badge with reason                   |
| **Complained** | Webhook                    | 🚫 red badge, auto-suppresses future sends |

- **Opt-out:** Settings > Email > Tracking > "Disable tracking." No pixel, no link wrapping.
- **Auto-suppression:** Spam complaint → address added to suppression list. Future sends blocked with warning.

### Resend Webhook Endpoint

`/api/webhooks/resend` — HMAC-SHA256 verified via `svix-signature` header. Handler validates → enqueues `email.event.process` BullMQ job → returns 200 immediately.

### Sending Limits

| Plan         | Emails/month | Daily max |
| ------------ | ------------ | --------- |
| Freelancer   | 500          | 100       |
| Starter      | 5,000        | 1,000     |
| Professional | 25,000       | 5,000     |
| Business     | 100,000      | 20,000    |
| Enterprise   | Unlimited    | Unlimited |

- **Overage:** Blocked with upgrade prompt. Compose shows "limit reached."
- **Automation awareness:** Send Email action checks quota before executing. Fails gracefully if insufficient.

### BullMQ Email Queues

| Queue        | Job Type                | Concurrency | Purpose                       |
| ------------ | ----------------------- | ----------- | ----------------------------- |
| `email`      | `email.send`            | 10          | Outbound via Resend           |
| `email`      | `email.send.scheduled`  | 10          | Delayed job at scheduled_at   |
| `email`      | `email.event.process`   | 20          | Resend webhook events         |
| `email`      | `email.inbound.process` | 10          | Inbound email from Cloudflare |
| `email-sync` | `email.sync.poll`       | 5/provider  | Connected mailbox polling     |

All with 3× exponential retry.

### Redis Key Patterns

| Pattern                                | Usage                  | TTL      |
| -------------------------------------- | ---------------------- | -------- |
| `rl:email:monthly:t:{tenantId}`        | Monthly send counter   | 35 days  |
| `rl:email:daily:t:{tenantId}`          | Daily send counter     | 25 hours |
| `cache:email:suppression:t:{tenantId}` | Suppression list cache | 300s     |

---

## Tracking ID Format

```
estrk_{nanoid(16)}
```

- ~95 bits entropy. Stored in `email_metadata.tracking_id`.
- Used in `Reply-To: reply+estrk_xxx@inbound.everystack.com`.
- Anti-replay: handler checks existence + deduplicates by `Message-ID` header.

---

## Post-MVP: Connected Inbox (Post-MVP — Comms & Polish)

Covers OAuth Connected Accounts, Inbound Sync — Dual Path, Auto-Matching Inbound Emails to Records, Reply from EveryStack, Connected Mailbox Sync Rules.
Touches `connected_mailboxes`, `connected_calendars`, `resend_message_id` tables.

### OAuth Connected Accounts

- Settings > Email > Connected Accounts: "Connect Gmail" / "Connect Outlook"
- **Per-user connection** — each member connects own mailbox.
- Google: OAuth 2.0 → Gmail API (`gmail.readonly`, `gmail.send`, `gmail.modify`).
- Microsoft: OAuth 2.0 → Graph API (`Mail.ReadWrite`, `Mail.Send`).
- Token storage: Dedicated `connected_mailboxes` table. Calendar uses separate `connected_calendars` table. Both share OAuth consent flow.

### Inbound Sync — Dual Path

**Path 1 — Reply routing (instant):**
Outbound email `Reply-To` includes `reply+{tracking_id}@inbound.everystack.com`. Cloudflare Email Worker receives reply → extracts tracking_id → POSTs to API → threads on correct record.

**Path 2 — Periodic pull:**
Poll Gmail/Outlook API every 2 minutes. Google also supports Pub/Sub push (preferred, polling fallback). Sync cursor: Gmail `historyId`, Outlook `deltaLink`. Only inbox + sent mail (no drafts, spam, trash).

### Auto-Matching Inbound Emails to Records

1. **Reply-chain match (highest):** `In-Reply-To` / `References` headers against known `resend_message_id`. If match → same record thread.
2. **Sender match:** Sender email against Email fields across tables. One match → attach.
3. **Multiple matches:** Recency heuristic (most recent email activity). Shows "Also linked to..." note.
4. **No match:** "Unmatched Emails" inbox. Manager can link, create contact, or dismiss.

### Reply from EveryStack

Record email thread → "Reply" → compose modal pre-filled. Sent via user's connected account. Fallback: workspace branded with user name in display name.

### Connected Mailbox Sync Rules

- Inbox + sent mail only.
- Optional filter: "Only sync from contacts in our tables."
- Historical backfill: last 30 days on first connect.
- Attachment handling: stored in R2/S3, max 25MB individual.

---

## Bulk Email / Campaigns

**Out of scope.** EveryStack email is record-contextual (one-to-one/few). Not building Mailchimp. Automation Send Email with filtered view sends individual transactional emails, not campaign blasts. For mass campaigns → dedicated ESP via webhooks.

---

## Data Model

Covers `email_templates`, `email_events`, `connected_mailboxes`, `email_suppression_list`, thread_messages Extensions.
Touches `email_templates`, `email_events`, `connected_mailboxes`, `email_suppression_list`, `message_type` tables. See `communications.md`.

### `email_templates`

| Column     | Type               | Purpose                       |
| ---------- | ------------------ | ----------------------------- |
| id         | UUID               | Primary key                   |
| tenant_id  | UUID               | Workspace                     |
| name       | VARCHAR            | Template name                 |
| subject    | TEXT               | Subject with `{merge}` syntax |
| body       | JSONB              | TipTap JSON with merge nodes  |
| category   | VARCHAR (nullable) | Grouping                      |
| created_by | UUID               | Author                        |

### `email_events`

| Column     | Type                   | Purpose                                               |
| ---------- | ---------------------- | ----------------------------------------------------- |
| id         | UUID                   | Primary key                                           |
| tenant_id  | UUID                   |                                                       |
| message_id | UUID → thread_messages | Which sent email                                      |
| event_type | ENUM                   | sent, delivered, opened, clicked, bounced, complained |
| metadata   | JSONB                  | Click URL, user agent, bounce reason                  |
| created_at | TIMESTAMP              |                                                       |

### `connected_mailboxes`

| Column        | Type              | Purpose                                    |
| ------------- | ----------------- | ------------------------------------------ |
| id            | UUID              | Primary key                                |
| tenant_id     | UUID              |                                            |
| user_id       | UUID              | Which user's mailbox                       |
| provider      | ENUM              | gmail, outlook                             |
| email_address | VARCHAR           | Connected address                          |
| oauth_tokens  | JSONB (encrypted) | Access + refresh tokens                    |
| sync_cursor   | VARCHAR           | Last sync position                         |
| sync_filter   | ENUM              | all_inbox, contacts_only                   |
| status        | ENUM              | active, disconnected, token_expired, error |

### `email_suppression_list`

| Column        | Type    | Purpose                     |
| ------------- | ------- | --------------------------- |
| id            | UUID    |                             |
| tenant_id     | UUID    |                             |
| email_address | VARCHAR | Suppressed address          |
| reason        | ENUM    | bounced, complained, manual |

Unique index: (tenant_id, email_address). Checked before every outbound send.

### thread_messages Extensions

`message_type` gains `email_outbound` and `email_inbound` values. `email_metadata` JSONB stores all email-specific data. See `communications.md` for canonical message_type enum.

---

## Phasing Summary

| Phase                         | Email Capability                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **MVP**                       | System emails only: invitations, system alerts. `notifications@everystack.com`. Resend. Auth emails via Clerk.                      |
| **Post-MVP — Documents**      | Outbound CRM: compose UI, templates, merge fields, tracking, record timeline, branded/custom domain, sending limits, schedule send. |
| **Post-MVP — Comms & Polish** | Connected inbox: Gmail/Outlook OAuth, two-way sync, auto-matching, reply from EveryStack, unmatched inbox.                          |
