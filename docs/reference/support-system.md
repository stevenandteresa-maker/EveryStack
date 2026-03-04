# EveryStack — Support System

> **New document: 2026-03-04** — Specifies the end-to-end user support system: the in-app Help Panel (user-facing), the AI-first support pipeline, the support agent console, and plan-based support tiers. Replaces and supersedes the support queue section in `platform-owner-console.md` (lines 346–390), which should be updated to reference this doc.
>
> Cross-references: `platform-owner-console.md` (admin console, /admin route, support agent schema), `data-model.md` (support_requests, support_request_messages schema), `design-system.md` (sidebar icon rail, help button placement), `my-office.md` (sidebar icon ordering), `settings.md` (Help & Support settings section), `agent-architecture.md` (AI agent execution model — post-MVP), `gaps/knowledge-base-live-chat-ai.md` (AI knowledge base retrieval — post-MVP), `ai-metering.md` (AI credit costs for support AI), `GLOSSARY.md` (plan tiers), `communications.md` (thread model), `observability.md` (support queue monitoring)
> Last updated: 2026-03-04 — Initial specification.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Design Philosophy | 35–55 | AI-first model, three-tier escalation, human access guarantee |
| Help Button & Panel | 56–130 | Sidebar placement, three-state panel UX, mobile behavior |
| Three-Tier Support Model | 131–175 | Tier 1 (AI), Tier 2 (support agent), Tier 3 (Steven/escalation) |
| AI Support Agent — Confirmation Flow | 176–245 | Rephrase-and-confirm pattern, confidence scoring, auto-send threshold |
| AI Support Agent — Capabilities | 246–305 | What the AI can do: KB retrieval, account context, billing queries, triage |
| Support Staff Console | 306–380 | Scoped /admin access, ticket view, draft approval, tenant context |
| Support Staff EveryStack Workspace | 381–410 | Deep case management, SLA tracking, internal knowledge |
| Plan-Based Support Tiers | 411–460 | What each plan gets, routing rules, enterprise contract model |
| Schema | 461–545 | New columns/tables: support_agents, ai_support_sessions, confidence tracking |
| Phase Implementation | 546–590 | MVP vs post-MVP build sequence |

---

## Design Philosophy

**AI-first, human-guaranteed.** Every support request enters an AI triage layer first. The AI attempts to resolve it autonomously. Humans only receive what the AI couldn't handle confidently. But every user — on any plan — always has a path to a human eventually. The difference between plans is speed of human response, not access.

**Confirm before answering.** The AI never assumes it understood the request correctly. It always rephrases the user's issue in its own words and asks for confirmation before attempting a resolution. This prevents wasted effort on misunderstood requests and builds user trust that the system is actually listening.

**Confidence-gated auto-send.** After confirmation, if the AI's resolution confidence is ≥95%, it sends the reply autonomously. Below 95%, it drafts the reply and queues it for a human support agent to review, edit, and send. This keeps AI quality high — humans only see borderline cases, not obvious answers.

**Urgency-flagged human escalation.** For non-enterprise plans, human involvement is not on a fixed SLA — it's triggered by urgency signals. The AI and the request category inform an urgency score. High-urgency requests (billing failures, data loss, sync completely down) surface immediately in the support agent queue. Low-urgency requests (feature questions, UI confusion) may be fully AI-resolved without human eyes.

**Enterprise is contract-defined.** Enterprise support terms (dedicated contact, on-call availability, response SLAs) are negotiated per contract. The platform supports the operational infrastructure for these arrangements; the specific terms are not hardcoded.

---

## Help Button & Panel

### Placement

The Help button lives in the **left sidebar icon rail**, immediately above the user's avatar. It is present on every page of the application — workspace views, My Office, settings, everywhere. It is never hidden, never context-dependent.

**Updated sidebar icon rail order (bottom section, from bottom up):**

| Position | Icon | Action |
|----------|------|--------|
| Bottom | 👤 Avatar | User profile / preferences |
| +1 | ❓ Help | Opens Help Panel |
| +2 | ⟷ Expand/collapse toggle | Sidebar width toggle |

This replaces the previous ordering where the expand/collapse toggle was directly above the avatar. The Help button inserts between them. `my-office.md` and `design-system.md` must be updated to reflect this ordering.

**Collapsed sidebar (48px):** Help icon only — question mark circle icon, `sidebarText` color, same 20px icon size as other sidebar icons. Tooltip on hover: "Help & Support".

**Expanded sidebar (~280px):** Icon + "Help & Support" label, same treatment as Tasks / Chat / Calendar labels.

### The Help Panel

Clicking the Help button opens a **push-style panel** — same mechanical behavior as Quick Panels (pushes main content to 75%, sidebar remains at 48px). The panel is 25% width in workspace context. In My Office context: full-height overlay panel at 400px fixed width (does not rearrange the widget grid).

The panel has **three tabs**, always visible at the top:

| Tab | Icon | Label | Default? |
|-----|------|-------|----------|
| 1 | 💬 | Ask AI | ✅ Default |
| 2 | 📖 | Browse Help | |
| 3 | ✉️ | Contact Support | |

Clicking the Help button always opens to **Tab 1: Ask AI**. If the user has an active conversation in progress, they return to it. If not, a fresh chat state.

---

### Tab 1: Ask AI

The primary support surface. An AI chat interface powered by the support AI agent (see AI Support Agent section).

**Initial state (no conversation):** A single centered prompt area with placeholder text: *"What can I help you with?"* and three quick-action chips below it (dynamically generated based on common issues for the user's plan and recent activity — e.g. "My sync isn't working", "Billing question", "How do I...").

**Conversation state:** Standard chat bubbles. User messages right-aligned, AI messages left-aligned with a small EveryStack logo mark as the avatar. The AI's rephrase-and-confirm message always appears as a distinct styled card (slightly different background) so the user clearly recognizes they're being asked to confirm, not receiving an answer.

**Confirmation card UI:**
```
┌─────────────────────────────────────────────┐
│ 🔄  Let me make sure I understand           │
│                                             │
│  "You're having trouble with your Airtable  │
│   sync — it ran yesterday but hasn't        │
│   updated since then, and you're seeing     │
│   a red error badge on the connection."     │
│                                             │
│  [Yes, that's right]   [No, let me clarify] │
└─────────────────────────────────────────────┘
```

If the user clicks "No, let me clarify" — the chat continues, AI asks a follow-up clarifying question.

**Resolution state:** After confirmation and AI response, two actions are offered below the response:
- ✅ "This solved my issue" — closes the ticket, marks resolved
- ❌ "I still need help" — opens a follow-up path (AI tries again, or escalates to Contact Support tab with context pre-filled)

**Escalation path:** If the AI cannot resolve after two attempts, or confidence never reaches the threshold, the panel automatically highlights the "Contact Support" tab with a badge and a message: *"Let me connect you with our support team. Your conversation will be included."*

---

### Tab 2: Browse Help

A searchable help center browser. **MVP:** This tab shows a simple static list of help categories with links to external documentation (a basic public help site — even a Notion page or a simple static site initially). The full dynamic knowledge base (wiki-powered, AI-searchable) is post-MVP.

**MVP state:**
- Search bar (client-side filter against a static article list loaded from `NEXT_PUBLIC_HELP_CENTER_URL` JSON endpoint)
- Category tiles: Getting Started / Sync & Connections / Billing & Plans / Portals & Sharing / Automations / Troubleshooting
- Each article opens in a new tab (external help site)
- "Didn't find what you needed?" CTA at bottom → switches to Tab 1 (Ask AI) with context

**Post-MVP state (after wiki + App Designer phases):** The Browse Help tab becomes a fully embedded help center, powered by the wiki-based knowledge base described in `gaps/knowledge-base-live-chat-ai.md`. Articles render inline in the panel. Search is semantic (hybrid keyword + vector). No external redirect needed.

---

### Tab 3: Contact Support

The guaranteed human escalation path. Always available. Always results in a response (eventually — per plan SLA).

**Form fields:**
- Category (pre-selected if coming from AI escalation): Billing / Bug / Feature Request / Account Issue / Other
- Subject (text, 255 char max) — pre-filled if coming from AI conversation
- Description (textarea) — pre-filled with AI conversation summary if escalating
- Severity (user-self-reported): It's blocking my work / It's annoying but I can work around it / Just a question

**Auto-attached (invisible to user, visible to support agent):**
- `tenant_id`, `user_id`, current plan, current URL, browser + OS, last 5 sync statuses for their connections, AI conversation transcript (if escalating from Tab 1)

**Submission:** Creates a `support_requests` row. User sees: *"Your request has been submitted. We'll get back to you at [email] as soon as possible."* No SLA promise shown in-app (plan-specific expectations are in the pricing page, not re-stated here).

**Request history:** Below the form, a collapsible "Your previous requests" section showing the last 5 submitted requests with status badges (Open / In Progress / Resolved). Clicking one shows the message thread.

---

### Mobile Behavior

On mobile (phone), the Help button appears in the **hamburger drawer** (same bottom section, above avatar). Tapping it opens the Help Panel as a **bottom sheet** (full-width, 85% screen height, swipe-to-dismiss). Same three tabs, same content. The AI chat interaction is touch-optimized — larger tap targets on confirm/deny buttons, keyboard auto-dismissed when AI is typing.

---

## Three-Tier Support Model

All inbound support requests flow through a structured three-tier pipeline. Tiers are not visible to the user — they experience a single seamless conversation.

### Tier 1 — AI Support Agent

**Who:** Autonomous AI agent with access to the requesting user's account context, the help knowledge base, and the ability to take limited read-only actions (look up billing status, check sync health, retrieve plan details).

**Triggers every request.** No exceptions — all requests enter Tier 1 first.

**Can autonomously resolve:**
- Help content questions (how-to, feature explanations)
- Common troubleshooting (sync errors with known fixes, permission issues, form submission problems)
- Billing inquiries (current plan, usage, next billing date, invoice retrieval)
- Account context questions (seat count, workspace list, feature availability on their plan)

**Cannot autonomously resolve:**
- Billing changes (refunds, plan upgrades/downgrades — these require Tier 3 platform admin action)
- Data recovery or restoration
- Suspected bugs requiring engineering investigation
- Anything requiring access to another tenant's data
- Requests where the user explicitly asks for a human

**Resolution path:** Rephrase → confirm → answer (if ≥95% confidence: auto-send; if <95%: queue for Tier 2 review).

**Escalation to Tier 2:** If confidence <95% after confirmation, or if the AI determines the request category requires human handling, the AI drafts a reply and routes to Tier 2 queue with: the original request, the AI's draft reply, the confidence score, and a triage classification.

### Tier 2 — Support Staff

**Who:** Internal EveryStack employees/contractors with `users.is_support_agent = true`. They have scoped access to the support console inside `/admin` — they can see tickets, tenant account context, and send replies. They cannot access billing actions, impersonate users, or see other admin functions.

**Receives:** Everything the AI couldn't resolve at ≥95% confidence, plus any requests manually escalated by Tier 1.

**Actions available:**
- View the AI's draft reply and confidence score
- Approve and send the AI draft as-is
- Edit the AI draft and send
- Discard draft and write a custom reply
- Escalate to Tier 3 (Steven / platform admin) with a note
- Mark resolved / close ticket
- Change priority/urgency flag

**Escalation to Tier 3:** For billing actions, data recovery, suspected platform bugs, enterprise account issues, or anything outside their authority.

### Tier 3 — Platform Admin (Steven / Senior Staff)

**Who:** Users with `users.is_platform_admin = true`.

**Receives:** Escalations from Tier 2, plus high-urgency auto-escalations (billing failures, data loss reports).

**Full authority:** All actions available — billing overrides, refunds, impersonation, feature flags, plan overrides, data recovery initiation.

**Enterprise:** Enterprise accounts may have a named Tier 3 contact (a specific person, not just "the admin pool") defined in their contract. This is surfaced in the support console as a "Dedicated Contact" flag on the tenant record.

---

## AI Support Agent — Confirmation Flow

### The Rephrase-and-Confirm Pattern

Every AI interaction follows this exact sequence before attempting resolution:

```
1. User submits message
         │
         ▼
2. AI classifies request type + extracts key claims
         │
         ▼
3. AI generates a rephrase of the issue in its own words
   ("Based on what you've described, it sounds like...")
         │
         ▼
4. AI presents confirmation card — user confirms or clarifies
         │
    ┌────┴────┐
    │         │
  Yes        No
    │         │
    ▼         ▼
5a. Proceed  5b. AI asks one clarifying question
  to answer       → loops back to step 3
```

**Why confirm before answering:** Support queries are often ambiguous. A user who says "my sync is broken" might mean the connection failed, the data is stale, the wrong records are syncing, or they deleted something accidentally. Confirming the specific interpretation prevents the AI from giving a confident, well-written answer to the wrong question — which is worse than saying "I'm not sure."

**One clarification loop only.** If after one clarifying exchange the AI still cannot produce a confident rephrase, it routes directly to Tier 2 rather than looping further. Users who have already clarified once and still aren't understood should talk to a human.

### Confidence Scoring

After the user confirms the rephrase, the AI generates its resolution and scores its own confidence on a 0–100 scale:

| Confidence | Meaning | Action |
|------------|---------|--------|
| 95–100 | AI is highly confident the answer is correct and complete | Auto-send to user, mark resolved pending user confirmation |
| 70–94 | AI has a good answer but acknowledges uncertainty | Draft for Tier 2 review |
| 40–69 | AI has partial information — answer may be incomplete | Draft for Tier 2 review, flagged as "partial answer" |
| 0–39 | AI does not have sufficient information to answer | Route to Tier 2 immediately, no draft generated |

**Confidence is computed from:**
- KB retrieval score (cosine similarity of top matching chunks — post-MVP)
- Request category (billing changes always capped at 70 regardless of KB match — requires human)
- Account context completeness (if required tenant data was retrieved successfully)
- Whether the request matches known resolvable categories

**MVP confidence scoring:** Until the vector-embedding knowledge base is built (post-MVP), confidence scoring uses a simpler rule-based classifier: known question patterns → high confidence; unknown patterns → low confidence. The architecture is identical — only the scoring mechanism changes.

### Auto-Send Behavior

When confidence ≥95%, the AI sends the reply directly to the user. The reply is added to `support_request_messages` with `author_type: 'ai_auto'`. The user is shown the response in the chat and sees two follow-up actions:

- ✅ "This solved my issue" → ticket closed, `support_requests.status = resolved`, `resolved_by = 'ai'`
- ❌ "I still need help" → ticket re-opens, routed to Tier 2 with full context

Auto-sent replies are **always auditable.** The `ai_support_sessions` table (see Schema section) records the full generation context: prompt, KB chunks used, confidence score, model used, credit cost.

**Billing category hard cap:** Any request classified as `category = billing` has confidence hard-capped at 70, regardless of AI certainty. Billing questions can be answered informationally (what is my current plan, when is my next invoice) at auto-send levels, but any action request (I want a refund, change my plan) is always routed to Tier 2/3 for human execution.

---

## AI Support Agent — Capabilities

### What the AI Has Access To (Per-Request Context)

When handling a request, the AI receives a context payload scoped to the requesting user's tenant:

```typescript
interface SupportAIContext {
  // Tenant profile
  tenant: {
    id: string;
    name: string;
    plan: PlanTier;
    subscription_status: string;
    trial_ends_at: string | null;
    created_at: string;
  };

  // Usage snapshot (read from DB at request time)
  usage: {
    total_records: number;
    plan_record_limit: number;
    active_automations: number;
    ai_credits_used_mtd: number;
    ai_credits_remaining: number;
    storage_used_bytes: number;
  };

  // Sync health (last 7 days)
  sync_connections: Array<{
    platform: string;
    status: string;
    last_synced_at: string;
    error_count_7d: number;
    last_error_message: string | null;
  }>;

  // Requesting user
  user: {
    id: string;
    email: string;
    role: string; // their role in the tenant
    last_active_at: string;
  };

  // AI conversation context
  conversation_history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

This context is never shown to the user. It allows the AI to give account-specific answers ("Your Airtable sync last ran 3 hours ago and has 2 errors in the last 7 days") rather than generic help content.

### Billing Query Handling

The AI can answer informational billing questions using the tenant context above:

| Question type | Can AI answer? | Source |
|--------------|----------------|--------|
| What plan am I on? | ✅ Yes | `tenant.plan` |
| When does my trial end? | ✅ Yes | `tenant.trial_ends_at` |
| How many records can I have? | ✅ Yes | Plan config |
| How many AI credits do I have left? | ✅ Yes | `usage.ai_credits_remaining` |
| What does my next invoice look like? | ✅ Yes (read from Stripe) | Stripe API read |
| Can I get a refund? | ❌ No — human only | Routes to Tier 2/3 |
| I want to upgrade my plan | ❌ No — direct to Settings | Shows upgrade path in Settings |
| I was charged incorrectly | ❌ No — human only | Routes to Tier 2/3 |

### Triage Classification

Every incoming request is classified before the confirmation step:

| Category | Routing Notes |
|----------|--------------|
| `how_to` | High AI resolvability — KB retrieval primary |
| `sync_error` | AI checks sync context + KB for known error patterns |
| `billing_info` | AI can answer, confidence cap 95% for info, 70% for action |
| `billing_action` | Always Tier 2/3 — AI explains and routes |
| `bug_report` | AI gathers reproduction info, always routes to Tier 2 with structured bug report |
| `account_access` | AI can handle basic cases; account lockout → Tier 3 |
| `data_issue` | AI gathers context; data loss/corruption → Tier 3 immediately |
| `feature_request` | AI acknowledges, logs to feature request table, marks resolved |

**Bug reports receive special handling:** The AI asks structured follow-up questions (what were you trying to do, what happened instead, does it happen every time, browser/device) and assembles a structured bug report before routing to Tier 2. This ensures human agents receive actionable information, not vague descriptions.

**Feature requests** are acknowledged by the AI ("Thanks — I've logged this as a feature request") and added to a `feature_requests` table (new — see Schema) for Steven's review. The ticket is immediately closed. No human response unless Steven wants to follow up.

---

## Support Staff Console

### Access Model

Support staff are EveryStack employees or contractors with `users.is_support_agent = true`. This is distinct from `is_platform_admin`. Support agents:

**Can:**
- View all open/in-progress support requests
- See the requesting tenant's name, plan, and usage context (read-only)
- View AI draft reply + confidence score
- Send replies (approve AI draft, edit AI draft, or write custom)
- Change ticket status and priority
- Add internal notes (never visible to user)
- Escalate to platform admin with a note

**Cannot:**
- See billing details (Stripe data) — Tier 3 only
- Impersonate users
- Issue refunds or change plans
- Access any other admin functions
- See other tenants' data beyond what's in the ticket context

### Support Console UI (`/admin/support`)

The support console is a section within `/admin`, accessible to both `is_support_agent` and `is_platform_admin` users. Support agents see only the support section; platform admins see everything.

**Queue view:** Tickets grouped by status (Open → In Progress → Waiting on User → Resolved). Within each group, sorted by urgency score (high to low), then created date (oldest first).

**Ticket card (collapsed):** Category badge, subject, tenant name + plan, time since submission, urgency indicator, AI confidence badge, assigned agent (if any).

**Ticket detail (expanded):**

```
┌─────────────────────────────────────────────────────────────┐
│ [Category: Sync Error]  [Priority: High]  [Open]           │
│                                                             │
│ Subject: Airtable sync hasn't run in 3 hours               │
│ Tenant: Acme Corp (Professional) · Submitted: 47 min ago   │
│                                                             │
│ ┌─ Account Context ──────────────────────────────────────┐  │
│ │ Plan: Professional  Records: 8,200/25,000              │  │
│ │ Airtable sync: FAILING · Last run: 3h ago              │  │
│ │ Error: Rate limit exceeded (429) · 4 errors in 7d      │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─ Conversation ─────────────────────────────────────────┐  │
│ │ USER: My Airtable data isn't updating...               │  │
│ │ AI (confirmed): Sync failing with rate limit errors    │  │
│ │ USER: Yes that's right                                 │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─ AI Draft Reply (Confidence: 82%) ─────────────────────┐  │
│ │ "Your Airtable sync is hitting rate limits, which      │  │
│ │  means Airtable is temporarily throttling requests     │  │
│ │  from EveryStack. This usually resolves within..."     │  │
│ │                                                         │  │
│ │  [Send as-is]  [Edit & Send]  [Write custom reply]    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ Internal note: _____________________ [Add note]            │
│                [Escalate to admin ↑]  [Close ticket]       │
└─────────────────────────────────────────────────────────────┘
```

### Email Notifications

Support agents receive email notifications (via Resend) for:
- New high-urgency tickets
- Tickets assigned to them
- User replies on in-progress tickets

Agents can reply by email — replies are parsed and added to `support_request_messages` (same pattern as user email replies). The `from:` address on outgoing support emails is `support@everystack.app`. Reply-to is a ticket-specific address that routes replies back to the correct ticket.

---

## Support Staff EveryStack Workspace

For deeper case management beyond ticket triage, support agent use a dedicated **Support workspace** inside Steven's internal EveryStack account (the Platform Workspace described in `platform-owner-console.md`).

This workspace grows in capability as EveryStack features mature.

### Recommended Tables

| Table | Type | Purpose |
|-------|------|---------|
| **Open Cases** | `table` | Synced/linked view of support_requests needing follow-up. Fields: Subject, Tenant, Priority, Assignee, Status, Notes, Resolution |
| **Known Issues** | `table` | Logged bugs and known platform issues. Fields: Title, Severity, Status (Investigating / Fix in Progress / Resolved), Affected tenants, Workaround |
| **Feature Requests** | `table` | All feature_requests logged by support AI. Fields: Request text, Source count, Priority, Status, Notes |
| **Response Templates** | `table` | Pre-written replies for common issues. Fields: Category, Title, Template body, Usage count |

### Evolution

| Phase | New Capability |
|-------|---------------|
| MVP — Core UX | Create the tables above manually |
| Post-MVP — Automations | Auto-create Open Cases records when high-urgency tickets arrive. Auto-notify assignee. Auto-close case when ticket resolves. |
| Post-MVP — AI Features | AI field agent scans Open Cases daily, suggests Known Issues matches, auto-populates workaround field from KB. |

---

## Plan-Based Support Tiers

### Routing Rules by Plan

All non-enterprise plans go through the same AI-first pipeline. The difference is in urgency weighting and human response commitment.

| Plan | AI Tier | Human Access | Urgency Weighting | Notes |
|------|---------|-------------|-------------------|-------|
| **Freelancer** | ✅ Full AI | Email form (Contact Support tab) | Standard | Human response if AI can't resolve + high urgency flag. No SLA promise. |
| **Starter** | ✅ Full AI | Email form | Standard | Same as Freelancer |
| **Professional** | ✅ Full AI | Email form | Elevated — billing + sync issues auto-flagged | |
| **Business** | ✅ Full AI | Email form | High — any billing or sync failure auto-flagged | Visible priority badge in support console |
| **Enterprise** | ✅ Full AI | Dedicated contact (per contract) | Highest | See Enterprise section below |

**No tiered blocking.** Freelancer users are not prevented from reaching humans — the form is always available. What changes by plan is how quickly humans are likely to see it, driven by urgency scoring in the support console.

### Urgency Scoring

Every incoming request receives an urgency score (0–100) based on:

| Signal | Score Contribution |
|--------|-------------------|
| Plan tier: Business | +20 |
| Plan tier: Enterprise | +40 |
| Category: billing_action or data_issue | +30 |
| Category: bug_report | +15 |
| Subscription status: past_due | +25 |
| Sync: all connections failing | +20 |
| User is tenant Owner | +10 |
| AI confidence <40 (no answer available) | +15 |
| User explicitly said "urgent" or "critical" | +10 |

Score 80+ → auto-notifies platform admin immediately (regardless of support agent queue). Score 60–79 → high priority in support console. Score <60 → normal queue.

### Enterprise Support Model

Enterprise support terms are defined per contract. The platform supports the following operational configurations:

**Dedicated contact:** A specific support agent (or Steven) is named as the primary contact for the enterprise account. Their name/email is recorded in `tenant_enterprise_config` (see Schema). The support console surfaces this on all tickets from enterprise tenants.

**On-call availability:** Defined in contract. The platform has no special on-call system — this is operationally managed (phone number, Signal, etc. provided directly to the enterprise admin). The platform's role is to surface the right escalation path and ensure tickets from enterprise accounts are immediately visible to Tier 3.

**SLA tracking:** If an SLA is contracted (e.g., <4h response), it is stored in `tenant_enterprise_config.sla_hours`. The support console shows a countdown timer on enterprise tickets and alerts when approaching breach. This is visibility tooling — enforcement is operational, not automated.

---

## Schema

### Additions to Existing Tables

**`users` table — new column:**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  is_support_agent BOOLEAN NOT NULL DEFAULT false;
```

**`tenants` table — new column:**
```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS
  support_tier VARCHAR(20) NOT NULL DEFAULT 'standard';
  -- Values: standard | priority | enterprise
  -- Derived from plan but can be manually overridden by platform admin
```

**`support_request_messages` table — update `author_type` enum:**
Add `'ai_auto'` and `'ai_draft'` to the existing `author_type` values (`'user'` | `'platform_admin'`):
- `'ai_auto'` — message sent autonomously by AI (confidence ≥95%)
- `'ai_draft'` — message drafted by AI, pending human review (never shown to user directly)
- `'support_agent'` — message sent by a support agent member

**`support_requests` table — new columns:**
```sql
ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS
  urgency_score        SMALLINT NOT NULL DEFAULT 0,
  ai_session_id        UUID REFERENCES ai_support_sessions(id),
  assigned_to          UUID REFERENCES users(id),  -- support agent assigned
  resolved_by          VARCHAR(20),  -- 'ai_auto' | 'support_agent' | 'platform_admin' | 'user'
  tier                 VARCHAR(20) NOT NULL DEFAULT 'standard';  -- routing tier
```

### New Tables

**`ai_support_sessions` — audit trail for AI support interactions:**
```sql
CREATE TABLE ai_support_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id UUID REFERENCES support_requests(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL,
  user_id           UUID NOT NULL,
  
  -- Request classification
  classified_category VARCHAR(50),        -- how_to | sync_error | billing_info | etc.
  urgency_score     SMALLINT,
  
  -- Confirmation step
  rephrase_text     TEXT,                 -- AI's rephrase of the issue
  user_confirmed    BOOLEAN,              -- Did user confirm the rephrase?
  clarification_rounds SMALLINT DEFAULT 0,
  
  -- Resolution attempt
  kb_chunks_used    JSONB,                -- Array of KB chunk IDs used (post-MVP)
  confidence_score  SMALLINT,            -- 0–100
  draft_reply       TEXT,                -- AI's generated reply
  auto_sent         BOOLEAN DEFAULT false, -- Was it auto-sent (confidence ≥95)?
  
  -- Outcome
  outcome           VARCHAR(20),          -- auto_resolved | escalated | user_closed
  
  -- Cost
  ai_credits_used   INTEGER DEFAULT 0,
  model_used        VARCHAR(100),
  
  created_at        TIMESTAMPTZ DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_ai_support_tenant ON ai_support_sessions (tenant_id);
CREATE INDEX idx_ai_support_request ON ai_support_sessions (support_request_id);
```

**`feature_requests` — logged by support AI:**
```sql
CREATE TABLE feature_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE SET NULL,
  submitted_by_user UUID REFERENCES users(id) ON DELETE SET NULL,
  source            VARCHAR(20) DEFAULT 'support_ai',  -- 'support_ai' | 'manual'
  request_text      TEXT NOT NULL,           -- User's original words
  ai_summary        TEXT,                    -- AI-cleaned summary
  category          VARCHAR(50),             -- feature area
  status            VARCHAR(20) DEFAULT 'new',  -- new | under_review | planned | shipped | declined
  admin_notes       TEXT,
  vote_count        INTEGER DEFAULT 1,       -- for future public voting
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feature_requests_status ON feature_requests (status, created_at DESC);
CREATE INDEX idx_feature_requests_tenant ON feature_requests (tenant_id);
```

**`tenant_enterprise_config` — enterprise-specific support settings:**
```sql
CREATE TABLE tenant_enterprise_config (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  dedicated_contact_id UUID REFERENCES users(id),  -- assigned support/admin user
  sla_hours            SMALLINT,                   -- Response SLA in hours (NULL = no SLA)
  on_call_info         TEXT,                        -- Encrypted, internal — how to reach on-call
  contract_notes       TEXT,                        -- Internal notes on contract terms
  contract_start_at    TIMESTAMPTZ,
  contract_end_at      TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
```

---

## Phase Implementation

### What Can Be Built Now (MVP Phase)

The following can be built during the current MVP phase sequence (alongside or after 1G):

| Component | Dependency | Scope |
|-----------|-----------|-------|
| Schema migration (all tables above) | None — additive only | MVP — Foundation (complete — migrations 0016 + 0017) |
| Help button placement in sidebar | Design system complete | MVP — Core UX |
| Tab 3: Contact Support (form + history) | support_requests schema | MVP — Core UX |
| Support Staff Console (/admin/support) | support_requests schema + is_support_agent | Post-MVP — Platform Operations |
| Basic Tab 2: Browse Help (static links) | None | MVP — Core UX |
| Email notifications for support | Resend email infrastructure | MVP — Core UX (alongside email setup) |

### What Is Post-MVP

| Component | Dependency | Scope |
|-----------|-----------|-------|
| Tab 1: AI Ask (full AI chat) | AI agent runtime + KB | Post-MVP — AI Features |
| AI confidence scoring via KB retrieval | Vector embeddings + wiki | Post-MVP — Documents + AI |
| Tab 2: Browse Help (embedded KB) | Wiki + App Designer | Post-MVP — Custom Apps |
| Enterprise SLA countdown timers | tenant_enterprise_config | Post-MVP — Platform Operations |
| Feature request voting (public) | App Designer / portal | Post-MVP — Custom Apps |
| Support analytics dashboard | Post-MVP | Post-MVP — Comms & Polish |

### MVP Interim: Tab 1 Without Full AI

Until the AI agent runtime is built, Tab 1 is not empty — it shows a **simplified smart triage form** that:
- Asks the user to pick a category
- Asks 2–3 category-specific follow-up questions (static logic, not AI)
- Summarizes their input and asks them to confirm
- Submits as a `support_requests` row with pre-structured content

This gives users a better experience than a blank form, and it generates well-structured tickets for support agent. When the AI is ready, it replaces this static triage flow with no UX disruption — same confirmation pattern, just powered by a real language model.
