# EveryStack — Embeddable Extensions

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth).
> **Changes:**
>
> - Renamed all "Interface Designer" → **App Designer** per glossary naming discipline
> - Renamed all "Comms Hub" / "Communications Hub" → context-specific glossary terms: **Record Thread** (record-level), **Chat / DMs** (personal), or descriptive "communications workspace" for the aggregate UI (glossary does not define a single name for the combined comms surface; see `communications.md` for full spec)
> - Flagged **architectural conflict**: This doc describes Website Mode as a portal configuration (`portal_mode` on `portals` table). Glossary defines Website as a post-MVP **App type** built in the **App Designer**, stored in `apps` / `app_pages` / `app_blocks` tables — not a portal variant. This conflict needs resolution. Current doc preserved with flag.
> - Updated `portal_blocks` / `portal_pages` references to note glossary defines post-MVP schema as `app_blocks` / `app_pages` / `apps`
> - Marked **all three extensions as post-MVP** per glossary MVP Scope Summary (Website Mode, Commerce Embed, Live Chat Widget all explicitly excluded from MVP)
> - Updated cross-references to use glossary-correct terms
> - Replaced "interface types" language where present

> **Reference doc (Tier 3).** Three post-MVP extension products adjacent to the App Designer: Website Mode (App Designer as website builder), Live Chat Widget (embeddable chat for users' external websites), Commerce Embed (embeddable payment forms routing transactions to EveryStack). Architecture, data models, embed protocols, use cases, competitive positioning.
> Cross-references: `app-designer.md` (App Designer, block model, themes, access modes, embeddable forms, Stripe integration, custom domains, PWA, SEO), `communications.md` (thread scopes, external_contacts, channel_connections, Chat Editor TipTap env 1, omnichannel architecture), `automations.md` (triggers: Form Submitted, Client Portal Action; actions: Send Email, Post to Portal), `design-system.md` (design system tokens, theming), `data-model.md` (apps, app_pages, app_blocks, threads, thread_messages schema), `compliance.md` (GDPR, cookie security, CSP), `realtime.md` (WebSocket transport, Redis pub/sub), `email.md` (Resend transactional email), `booking-scheduling.md` (embeddable booking widget follows same embed protocol — script tag / iframe / React component), `gaps/knowledge-base-live-chat-ai.md` (Website Mode "Documentation / Knowledge Base" template default data source = wiki table_type; Live Chat Post-MVP — Native App & Tap to Pay AI auto-responses — full pipeline: knowledge base designation, Smart Doc content chunking, embedding schema, confidence-based routing, agent-assist mode)
> Cross-references (cont.): `workspace-map.md` (WebsiteNode, CommerceEmbedNode, ChatWidgetNode in topology graph — all three extension products rendered as Surface layer nodes with edges to their bound tables; commerce_sells_from/commerce_records_to, chat_links_to, website_displays edge types)
> Last updated: 2026-02-27 — Glossary reconciliation (naming alignment, post-MVP scope tagging, cross-reference updates). Prior: 2026-02-21 — Added `workspace-map.md` cross-reference.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                    | Lines   | Covers                                                                        |
| ------------------------------------------ | ------- | ----------------------------------------------------------------------------- |
| Strategic Overview                         | 37–52   | Three extension products, relationship to App Designer                        |
| Extension 1: Website Mode (Post-MVP)       | 53–209  | App Designer as website builder, 6 block types, AI generation, SEO            |
| Extension 2: Live Chat Widget (Post-MVP)   | 210–494 | Embeddable JS widget, shadow DOM, WebSocket, pre-chat form, CRM linking       |
| Extension 3: Commerce Embed (Post-MVP)     | 495–803 | 3 modes (single product, catalog, custom amount), Stripe Elements, line items |
| Cross-Extension Synergies                  | 804–819 | How extensions compose together                                               |
| Implementation Priority & Effort Estimates | 820–834 | Build order and effort sizing                                                 |
| Key Architectural Decisions                | 835–849 | ADR-style decisions with rationale                                            |
| MVP Feature Split                          | 850–882 | What ships when across extensions                                             |

---

## Strategic Overview

> **⚠️ Post-MVP scope:** All three extensions described in this document are **post-MVP** per the glossary MVP Scope Summary. The glossary explicitly excludes: "Commerce embeds, live chat widget", "Custom Apps (POS, websites, internal apps)", and "Full communications hub" from MVP. Build clean extension points during MVP, but don't build the extensions.

EveryStack's App Designer, communications infrastructure, and payment infrastructure are designed as internal platform features — portals for client dashboards, Record Thread and Chat / DMs for team messaging, Stripe for portal payments. But the same infrastructure, with targeted extensions, enables three outward-facing products that EveryStack users can deploy on _their own_ external websites:

1. **Website Mode** — Use the App Designer to build full marketing websites, not just data-bound client portals.
2. **Live Chat Widget** — An embeddable chat bubble that routes conversations into EveryStack's communications workspace (alongside Record Threads, Chat / DMs, and external channel messages), tied to CRM records.
3. **Commerce Embed** — An embeddable order/payment form that creates records and processes payments, routing transactions into EveryStack tables.

**Why these matter:** EveryStack's core value proposition is eliminating tool fragmentation for SMBs. These extensions close three remaining gaps where SMBs currently need separate tools: website builders (Squarespace, Wix), live chat (Intercom, Crisp, tawk.to), and embedded commerce (Shopify Buy Button, Stripe Payment Links). Each extension reuses 70–90% of existing infrastructure.

**Design principle:** AI capable, not AI obnoxious. These extensions follow the same progressive disclosure philosophy — simple by default, powerful when needed. A user who just wants a landing page shouldn't see query-bound data binding options. A user who just wants a chat bubble shouldn't need to understand thread scopes.

---

## Extension 1: Website Mode (Post-MVP)

### What It Is

> **⚠️ Glossary conflict — needs resolution:** The glossary defines Website as a post-MVP **App type** built in the App Designer, stored in the `apps` / `app_pages` / `app_blocks` tables. This document describes Website Mode as a **portal configuration** (`portal_mode` flag on the `portals` table). The implementation approach below reuses portal infrastructure for efficiency (~90% reuse), but the glossary's architectural model treats websites as Apps, not portals. Reconciliation decision needed: either (a) adopt this doc's portal-based approach and update the glossary, or (b) align this doc with the glossary's App-based approach. Current content preserved pending resolution.

Website Mode is a portal configuration — not a new system. A "website" is a portal with `portal_mode: 'website'`, which activates a set of marketing-focused block types, removes the data-scoping wizard, and adjusts the creation flow for content-first (rather than data-first) use cases.

**Core insight:** The App Designer already is a visual page builder with a 12-column responsive grid, 30+ block types, drag-and-drop, theme gallery, custom domains, SEO meta tags, three-tier caching, and PWA support. The gap between "client portal" and "website" is a handful of missing block types and a creation wizard that doesn't force you through table selection.

### What Already Exists (Zero New Work)

| Capability          | Portal Feature                                                           | Website Applicability                    |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| Visual page builder | 4-zone designer: sidebar + canvas + property panel + toolbar             | Identical — Squarespace/Webflow paradigm |
| Responsive design   | Desktop/tablet/mobile viewport toggle, per-breakpoint visibility         | Identical                                |
| Layout system       | Row, Column, Card, Tab Container, Collapsible Section, Grid Container    | Identical                                |
| Theme system        | 20 curated themes, 12 semantic tokens, custom token editor, Google Fonts | Identical                                |
| Static content      | Rich Text, Static Image, Divider, Spacer, Embed blocks                   | Core of any website                      |
| Forms               | Form pages with field-to-table binding, Turnstile spam protection        | Contact forms, lead capture              |
| Embeddable forms    | Script tag + iframe embed on external sites                              | Already works for lead gen               |
| SEO                 | Per-page title, description, OG tags, robots directives                  | Essential for marketing sites            |
| Custom domains      | CNAME + Let's Encrypt SSL, Professional+ plans                           | `www.yourbusiness.com`                   |
| PWA                 | Manifest generation, service worker, home screen install                 | Mobile-friendly sites                    |
| CDN caching         | Public pages: `Cache-Control: public, max-age=3600`                      | Fast static pages                        |
| Access modes        | Public (no auth, CDN cacheable)                                          | Marketing sites are public               |
| Publish flow        | Draft → Live with version numbers, diff summary                          | Content staging                          |

### What's New (Website-Specific Additions)

#### New Block Types (6 blocks)

| Block Type        | Category | Description                                                                                                                                                                                                                           |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero**          | Layout   | Full-width section with background image/video/gradient, overlay text (heading + subheading + CTA button), vertical alignment options (center/bottom), parallax scroll option. Responsive: image crops to focal point on mobile.      |
| **Testimonial**   | Static   | Quote card with attribution (name, title, company, avatar). Variant: carousel (auto-rotate with pagination dots) for multiple testimonials from a single data source or static entries.                                               |
| **Pricing Table** | Static   | 2–4 column plan comparison. Each column: plan name, price, feature list (checkmarks/crosses), CTA button. "Popular" badge toggle. Can be static (manually configured) or data-bound to a Plans/Products table.                        |
| **Footer**        | Layout   | Multi-column footer container with preset layouts (3-col, 4-col, logo+links+social). Social media icon set (20 platforms). Copyright text with `{{year}}` auto-token. Sticky to page bottom. One per portal, shared across all pages. |
| **Feature Grid**  | Layout   | CSS Grid of icon + heading + description cards. Preset layouts: 2×2, 3×1, 2×3. Icon picker (Lucide icon set, 1000+ icons). Responsive: collapses gracefully (3→2→1 columns).                                                          |
| **CTA Banner**    | Static   | Full-width colored band with heading + subheading + button. Background uses theme `primary` or `accent` token. Designed for section breaks / calls to action between content sections.                                                |

**Implementation note:** All new blocks follow the existing block schema. They are block types in the Block Library, stored in the block table's `block_type` column, configured via `config` JSONB. No schema changes required — just new renderers and property panel configs. _(Note: Per glossary, post-MVP App Designer outputs use `app_blocks` table. If Website Mode is implemented as a portal variant instead, the `portal_blocks` schema would apply — see architectural conflict note above.)_

#### New Portal Mode: `website`

```typescript
// Extension to portals table (portal-based approach — see glossary conflict note)
interface PortalModeConfig {
  portal_mode: 'portal' | 'website'; // Default: 'portal'
  // When 'website':
  //   - Creation wizard skips table selection and scoping field steps
  //   - Block library shows Website category (Hero, Footer, etc.)
  //   - Navigation Menu block defaults to multi-page site nav
  //   - SEO defaults to index,follow (not noindex)
  //   - No client auth section in settings (public by default)
}
```

**Data model change:** Add `portal_mode` column to `portals` table. `VARCHAR`, default `'portal'`. Minimal schema impact — this is a behavioral flag, not a structural change. _(Note: If the glossary's App-based approach is adopted instead, websites would be rows in the `apps` table with `type: 'website'` — no `portal_mode` column needed.)_

#### Website Creation Wizard (Modified Flow)

The existing 3-step portal wizard adapts for Website Mode:

**Step 1: Choose a Starting Point**
Template cards — same pattern, different templates:

- **Business Homepage** — Hero + About + Services + Testimonials + Contact Form + Footer
- **Landing Page** — Hero + Feature Grid + CTA Banner + Form
- **Portfolio** — Hero + Gallery Grid (Embed blocks) + About + Contact
- **Coming Soon** — Hero with countdown + Email signup form
- **Documentation / Knowledge Base** — Sidebar nav + Rich Text pages. Default data source: wiki table_type. See `gaps/knowledge-base-live-chat-ai.md` > Website Mode Help Center Wiring.
- **Start from Scratch**
- **AI-Generated** (Opus, 20 credits) — describe your business, AI generates full site structure with appropriate theme

**Step 2: Connect to Data (Optional)**

- Unlike portal mode, this step is optional. Skip → pure static site. Connect → data-bound pages (blog from Posts table, team from People table, products from Products table).
- When connected: same table picker, but no scoping field (websites don't have per-visitor data filtering).
- Blog use case: select a Posts table → wizard auto-creates a List page (blog index) and a Detail page (individual post) with slug-based routing from a URL Slug field.

**Step 3: Name and Theme**

- Identical to portal wizard. Portal name, URL slug, theme gallery, logo upload.

#### Blog / Content Pages (Data-Bound Without Scoping)

Websites can optionally bind to tables without identity-based record scoping. This enables:

- **Blog:** List page bound to a Posts table. Each record = a blog post. Detail page renders a single post at `/blog/{slug}`. Slug field auto-detected (URL-type or Single Line Text named "Slug").
- **Team page:** List page bound to a People/Team table. Card grid showing name, role, photo, bio.
- **Product catalog:** List page bound to a Products table. Grid view with images, descriptions, prices.
- **Event listing:** List page bound to an Events table with date sorting.

**How it differs from portal data binding:** Portal data binding always applies `record_scope` (filter by client identity). Website data binding applies only portal-level static filters from the block's Content tab (e.g., "Status = Published"). All visitors see the same data.

```typescript
// Website data binding — no record_scope, public visibility
interface WebsiteDataBinding {
  mode: 'context' | 'relationship' | 'query';
  // Same three modes as portal data binding
  // Difference: no record_scope layer applied at query time
  // Portal-level filters (configured on block) still apply
  // All visitors see identical content
}
```

#### Navigation Menu Block Enhancement

The existing Navigation Menu block (currently in the Static block category) needs enhancement for website use:

- **Multi-level dropdown:** Nested page groups with hover-expand on desktop, tap-expand on mobile.
- **Sticky header option:** `position: sticky` with background blur on scroll. Toggle in Style tab.
- **Mobile hamburger:** Auto-converts to hamburger menu below tablet breakpoint. Slide-out drawer with full page tree.
- **Logo slot:** Left-aligned logo image (from portal settings) with link to homepage.
- **CTA button slot:** Right-aligned primary button (e.g., "Get Started", "Contact Us") that stays visible in sticky mode.

#### Basic Animations (Style Tab Extension)

Website pages benefit from subtle motion. Add to the Style tab on all blocks:

| Animation            | Behavior                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Fade In**          | Opacity 0→1 on scroll into viewport. `IntersectionObserver` trigger. Duration: 400ms.                          |
| **Slide Up**         | Translate Y 20px→0 + fade. Same trigger. Duration: 500ms.                                                      |
| **Stagger Children** | Container applies fade-in to children with 100ms delay between each. For Feature Grids, Testimonial carousels. |
| **None**             | Default. No animation.                                                                                         |

Implementation: CSS `@keyframes` + `IntersectionObserver` in the portal renderer. No JavaScript animation libraries. Respects `prefers-reduced-motion`.

### Website Mode Use Cases

| Use Case                    | Template            | Data Binding                                        | Target User                            |
| --------------------------- | ------------------- | --------------------------------------------------- | -------------------------------------- |
| Agency portfolio site       | Portfolio           | Optional (projects from Projects table)             | Agency owner showing work to prospects |
| Client-facing business site | Business Homepage   | Optional (team, services, testimonials from tables) | SMB with 2–50 employees                |
| Product launch landing page | Landing Page        | Form → Leads table                                  | Startup or product team                |
| Event registration page     | Landing Page + Form | Form → Registrations table, optional Stripe payment | Event organizer                        |
| Internal knowledge base     | Documentation       | Content from Wiki/Docs table                        | Team documentation, not client-facing  |
| Job board / career page     | Custom              | Job listings from Jobs table, application form      | HR / recruiting                        |

### Website Mode Competitive Positioning

**vs. Squarespace/Wix:** EveryStack websites are data-connected. A Squarespace blog requires manual content entry. An EveryStack blog auto-publishes from a Posts table — the same table your team writes in, your automations process, and your AI agents analyze. Change a record status to "Published" and it's live on the website. No export, no copy-paste, no sync tool.

**vs. Webflow:** Similar designer paradigm, but EveryStack adds what Webflow can't: the website is one surface of a broader operations platform. The contact form creates a CRM record, triggers an automation that assigns the lead, sends a follow-up email, and creates a task for the sales rep. Webflow requires Zapier for all of that.

**vs. Building a Portal and Calling It a Website:** That's exactly what this is — but with UX polish. The website creation wizard doesn't ask "which field identifies the client?" because there is no client. The block library includes Hero and Footer because marketing pages need them. The framing matters for adoption.

### Phase Mapping

> **Post-MVP:** All Website Mode phases below are post-MVP per the glossary.

| Phase                                       | Website Mode Work                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Post-MVP — Portals & Apps (Initial)**     | `portal_mode` column on `portals` table. Website creation wizard (skip scoping step). `access_mode` default to `'public'` for websites. Data binding without `record_scope` (conditional on `portal_mode`). No new block types yet — websites can be built with existing Rich Text, Static Image, Form, Embed, and Navigation Menu blocks. |
| **Post-MVP — Portals & Apps (Fast-Follow)** | 6 new block types (Hero, Testimonial, Pricing Table, Footer, Feature Grid, CTA Banner). Navigation Menu enhancement (dropdown, sticky, hamburger, logo/CTA slots). Basic animations (Style tab). Blog/Content page type with slug-based routing. Website templates in creation wizard. AI-generated websites.                              |

---

## Extension 2: Live Chat Widget (Post-MVP)

### What It Is

An embeddable JavaScript widget that EveryStack users add to their own external websites. Website visitors click a chat bubble, type a message, and it routes into EveryStack's communications workspace as an `external` scope thread. The EveryStack user responds from their workspace — same interface they use for internal Chat / DMs, Record Thread comments, and (Post-MVP — Custom Apps & Live Chat) WhatsApp/Telegram messages.

**Core insight:** The communications infrastructure already specifies `external` scope threads, `external_contacts` for platform identity, `channel_connections` for routing config, and `author_type: 'external_contact'` on `thread_messages`. The live chat widget is one more channel — architecturally simpler than WhatsApp because EveryStack controls both sides of the protocol.

### Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────────┐
│  External Website            │     │  EveryStack Workspace             │
│                              │     │                                   │
│  ┌────────────────────┐      │     │  ┌──────────────────────┐        │
│  │  Chat Widget        │     │     │  │  Communications       │        │
│  │  (iframe/shadow DOM)│◄────┼─WSS─┼──│  Workspace            │        │
│  │                     │     │     │  │  Live Chat section    │        │
│  │  - Bubble icon      │     │     │  │  in sidebar            │        │
│  │  - Chat window      │     │     │  │                        │        │
│  │  - Message input    │     │     │  │  thread_messages       │        │
│  │  - File upload      │     │     │  │  (Chat Editor)         │        │
│  └────────────────────┘      │     │  └──────────────────────┘        │
│                              │     │            │                      │
│                              │     │            ▼                      │
│                              │     │  ┌──────────────────────┐        │
│                              │     │  │  CRM Record           │        │
│                              │     │  │  (auto-linked by      │        │
│                              │     │  │   email or created)    │        │
│                              │     │  └──────────────────────┘        │
└─────────────────────────────┘     └──────────────────────────────────┘
```

### Embed Protocol

Two embed options, matching the existing embeddable forms pattern:

**Script tag (recommended):**

```html
<script
  src="https://chat.everystack.app/widget/{widget_id}.js"
  data-position="bottom-right"
  data-color="#2DD4BF"
  data-greeting="Hi! How can we help?"
  async
></script>
```

The script injects a shadow DOM container (not an iframe) to avoid style conflicts with the host page. Shadow DOM provides CSS isolation while allowing the widget to resize fluidly with the viewport.

**React component (for React sites):**

```jsx
import { EveryStackChat } from '@everystack/chat-widget';

<EveryStackChat widgetId="wdg_abc123" position="bottom-right" greeting="Hi! How can we help?" />;
```

Published as `@everystack/chat-widget` on npm. Thin wrapper (~8KB gzipped) that loads the widget core lazily on first interaction.

### Widget UI

**Bubble state (default):** Floating circular button (56px), bottom-right (configurable), with unread badge. Customizable: color (from EveryStack user's portal theme or explicit hex), icon (chat bubble default, customizable), position (bottom-right, bottom-left).

**Open state:** Chat window (380px wide × 520px tall on desktop, full-screen on mobile < 480px). Three sections:

1. **Header:** Business name + avatar/logo (from workspace settings), "Online" / "Away" / "We typically reply in X" status, minimize button.
2. **Message area:** Scrollable message feed. Visitor messages right-aligned, agent messages left-aligned with name + avatar. Typing indicator ("Agent is typing..."). Timestamps on message groups.
3. **Input area:** Text input (simplified Chat Editor — no mentions, no slash commands, no markdown). Attach button (images + files). Send button. Optional pre-chat form (name + email) shown before first message.

**Pre-chat form (configurable):** Before the visitor sends their first message, optionally collect:

- Name (optional)
- Email (optional but recommended — enables CRM linking)
- Custom fields (up to 3, configured by EveryStack user — e.g., "Order Number", "Department")

Pre-chat data stored on the `chat_visitors` record and passed as metadata on the thread.

### Visitor Identity & Session

Chat visitors are not portal clients and not workspace users. They need their own lightweight identity system:

```typescript
// New table: chat_visitors
interface ChatVisitor {
  id: string; // UUID
  tenant_id: string; // Workspace that owns the widget
  widget_id: string; // FK to chat_widgets
  visitor_token: string; // 256-bit random token, stored in httpOnly cookie
  name: string | null; // From pre-chat form
  email: string | null; // From pre-chat form
  external_contact_id: string | null; // FK to external_contacts (created on first message)
  linked_record_id: string | null; // FK to CRM record (auto-linked by email match)
  metadata: Record<string, any>; // Pre-chat custom fields, page URL, referrer, user agent
  first_seen_at: string; // Timestamp
  last_seen_at: string; // Timestamp
  created_at: string;
}
```

**Session flow:**

1. Widget loads → checks for existing `es_chat_visitor` cookie (httpOnly, Secure, SameSite=Lax, 90-day expiry).
2. No cookie → generate `visitor_token` via `crypto.randomBytes(32)`, create `chat_visitors` row, set cookie. Visitor sees pre-chat form (if enabled) or empty chat.
3. Existing cookie → validate token → restore conversation history. Returning visitors see their previous messages.
4. On first message: create `external_contacts` row + `threads` row (`scope_type: 'external'`, `scope_id: widget thread identifier`) + `thread_messages` row.
5. If visitor provided email → search CRM/contacts table for email match → if found, set `linked_record_id`. Thread now appears linked to that CRM record in the communications workspace.

### Widget Configuration (Workspace Settings)

New section: **Settings > Channels > Live Chat**

| Setting                  | Options                                                                    | Default                                                 |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Widget status**        | Active / Paused                                                            | Active                                                  |
| **Appearance**           | Color (hex picker), position (bottom-right/left), logo upload, bubble icon | Theme primary, bottom-right, workspace avatar           |
| **Greeting message**     | Text shown when widget opens                                               | "Hi! How can we help?"                                  |
| **Pre-chat form**        | Enable/disable, required fields (name, email, custom)                      | Enabled, email optional                                 |
| **Business hours**       | Day/time ranges per timezone                                               | Always on                                               |
| **Offline message**      | Text shown outside business hours                                          | "We're away. Leave a message and we'll reply by email." |
| **Auto-reply**           | First-response message (immediate)                                         | None                                                    |
| **Assignment**           | Round-robin to team members, specific user, or unassigned                  | Unassigned                                              |
| **Notification routing** | Which users get notified on new chat                                       | All Managers                                            |
| **CRM linking**          | Which table to match visitor email against                                 | Auto-detect contacts/CRM table                          |
| **Allowed domains**      | Domains where the widget is permitted to load                              | Any (configurable allowlist)                            |

### Data Model

#### `chat_widgets` Table

| Column               | Type            | Purpose                                                                                            |
| -------------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `id`                 | UUID            | Primary key. Used in embed URL: `chat.everystack.app/widget/{id}`                                  |
| `tenant_id`          | UUID            | Workspace that owns this widget                                                                    |
| `name`               | VARCHAR         | Display name (for workspace UI, not visitor-facing)                                                |
| `status`             | VARCHAR         | `'active'`, `'paused'`                                                                             |
| `config`             | JSONB           | Appearance, pre-chat form, greeting, business hours, assignment rules, offline message, auto-reply |
| `allowed_domains`    | TEXT[]          | Domain allowlist for CORS / CSP. Empty = allow all.                                                |
| `crm_table_id`       | UUID (nullable) | Table to match visitor emails against for CRM linking                                              |
| `crm_email_field_id` | UUID (nullable) | Email field on the CRM table used for matching                                                     |
| `created_by`         | UUID            |                                                                                                    |
| `created_at`         | TIMESTAMPTZ     |                                                                                                    |
| `updated_at`         | TIMESTAMPTZ     |                                                                                                    |

**Indexes:** `(tenant_id)`, `UNIQUE (id)`.

#### `chat_visitors` Table

| Column                | Type               | Purpose                                                                                             |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| `id`                  | UUID               | Primary key                                                                                         |
| `tenant_id`           | UUID               |                                                                                                     |
| `widget_id`           | UUID               | FK to chat_widgets                                                                                  |
| `visitor_token`       | VARCHAR(64)        | Random token for cookie-based session. Generated via `crypto.randomBytes(32).toString('base64url')` |
| `name`                | VARCHAR (nullable) | From pre-chat form                                                                                  |
| `email`               | VARCHAR (nullable) | From pre-chat form (PII — registered in compliance registry)                                        |
| `external_contact_id` | UUID (nullable)    | FK to external_contacts. Created on first message.                                                  |
| `linked_record_id`    | UUID (nullable)    | FK to CRM record. Set when email matches.                                                           |
| `metadata`            | JSONB              | Page URL, referrer, user agent, custom pre-chat fields, browser language                            |
| `first_seen_at`       | TIMESTAMPTZ        |                                                                                                     |
| `last_seen_at`        | TIMESTAMPTZ        |                                                                                                     |
| `created_at`          | TIMESTAMPTZ        |                                                                                                     |

**Indexes:** `(tenant_id, widget_id)`, `(visitor_token)`, `(email)` where email is not null.

**Relationship to existing tables:**

- `external_contacts` (from `communications.md`): one `chat_visitors` row → one `external_contacts` row (created on first message). `external_contacts.channel_type = 'live_chat'`.
- `threads`: one conversation per visitor per widget. `scope_type: 'external'`, `scope_id: chat_visitors.id`. Reused across sessions (returning visitor continues same thread).
- `thread_messages`: messages use `author_type: 'external_contact'` for visitor messages, `author_type: 'user'` for agent replies. `channel_type: 'live_chat'`.

### Real-Time Transport

**Visitor side (widget):** WebSocket connection to `wss://chat.everystack.app/ws/{widget_id}/{visitor_token}`. Lightweight protocol — message events only (no presence, no typing indicators from other visitors, no room subscriptions).

Events sent to visitor:

- `message.new` — agent replied
- `message.updated` — agent edited a message
- `agent.typing` — typing indicator
- `agent.online` — at least one assigned agent is online (updates header status)

Events sent from visitor:

- `message.send` — visitor typed a message
- `visitor.typing` — typing indicator
- `visitor.seen` — read receipt (marks messages as seen)

**Agent side (communications workspace):** Uses existing WebSocket infrastructure from `realtime.md`. Live chat threads appear in the communications workspace alongside Chat / DMs, Record Threads, and (Post-MVP — Custom Apps & Live Chat) WhatsApp/Telegram conversations. No separate real-time system needed.

**Fallback:** If WebSocket fails (corporate firewalls, restrictive networks), the widget falls back to HTTP long-polling with 3-second intervals. Messages are never lost — they're always persisted server-side first, then pushed via WebSocket.

### Communications Workspace Integration

> **Terminology note:** The glossary distinguishes **Record Thread** (record-scoped communication) from **Chat / DMs** (personal messaging via Quick Panels). Live Chat threads are neither — they are `external` scope threads managed in the workspace communications surface alongside DMs and Record Threads. The glossary does not yet define a single name for this aggregate communications UI. See `communications.md` for full specification.

**New sidebar section: "Live Chat"** — appears between DMs and base/table threads in the communications workspace sidebar (Post-MVP — Custom Apps & Live Chat adds "Channels" for WhatsApp/Telegram; Live Chat is a distinct section because it's always-on, not platform-specific).

Sidebar entry per active conversation:

- Visitor name (or "Visitor" if no pre-chat form) + unread badge
- Last message preview (truncated)
- Time since last message
- CRM record link (if matched) — small chip below name
- Assignment indicator (avatar of assigned agent, or "Unassigned" tag)

**Conversation view:** Identical to other communications workspace threads — same Chat Editor (TipTap env 1), same message rendering, same attachment handling, same emoji reactions. Additional context panel on right:

- **Visitor info card:** Name, email, location (from IP geolocation — city/country level), browser, OS, current page URL, referrer, first seen, session count.
- **CRM record card:** If linked — shows record summary (name, company, recent activity). "View record" link. If not linked — "Link to record" button with record picker.
- **Conversation history:** Previous sessions (if returning visitor).

### CRM Auto-Linking

When a visitor provides an email (via pre-chat form or during conversation):

1. Query the widget's configured CRM table for a record where the email field matches.
2. **Match found:** Set `chat_visitors.linked_record_id`. Thread appears linked to that CRM record. All future messages visible in the record's Activity tab (as `external` scope thread).
3. **No match:** Optionally auto-create a new CRM record (configurable: "Create contact for new visitors" toggle in widget settings). If disabled, conversation stays unlinked until manually linked by an agent.

### Automation Integration

> **Post-MVP:** All automation triggers and actions below are post-MVP.

**New triggers:**

| Trigger                     | Fires When                               | Context Available                                                     |
| --------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `chat.message_received`     | Visitor sends a message                  | widget_id, visitor, message content, page URL, CRM record (if linked) |
| `chat.conversation_started` | First message in a new conversation      | widget_id, visitor info, referrer, landing page                       |
| `chat.visitor_identified`   | Visitor provides email via pre-chat form | widget_id, visitor, email, CRM match result                           |

**New actions:**

| Action                     | Does What                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| `chat.send_auto_reply`     | Sends a message in the chat thread (from "Bot" or workspace name) |
| `chat.assign_conversation` | Assigns conversation to a specific user or round-robin group      |
| `chat.tag_conversation`    | Adds tags to the thread for categorization                        |

**Example automation recipes:**

- **Lead capture:** Chat Conversation Started → Create record in Leads table (name, email, source: "Live Chat", page URL) → Assign to sales round-robin → Send Slack notification.
- **Support triage:** Chat Message Received → AI Classification (Condition: intent = billing/technical/sales) → Branch: billing → assign to accounts team, technical → assign to support, sales → assign to sales.
- **After-hours:** Chat Message Received → Condition: outside business hours → Send Auto-Reply ("We'll get back to you by 9 AM") → Create task in My Office for first available agent.

### Widget Plan Limits

| Plan         | Chat Widgets | Monthly Conversations | Concurrent Visitors |
| ------------ | ------------ | --------------------- | ------------------- |
| Freelancer   | 1            | 100                   | 5                   |
| Starter      | 2            | 500                   | 20                  |
| Professional | 5            | 2,000                 | 50                  |
| Business     | Unlimited    | 10,000                | 200                 |
| Enterprise   | Unlimited    | Custom                | Custom              |

**Conversation** = a thread with at least one visitor message. Conversations that span multiple days count once. Counter resets monthly. Redis tracking: `chat:convos:{tenantId}:{YYYY-MM}`.

### Security

- **Domain allowlist:** Widget only loads on allowed domains. Server validates `Origin` header on WebSocket handshake and REST endpoints. CORS headers set per widget config.
- **Rate limiting:** 10 messages per visitor per minute. 50 new conversations per IP per hour. Redis-based.
- **Content security:** Visitor messages sanitized (no HTML injection). File uploads scanned by ClamAV (same pipeline as portal file uploads in `files.md`). Max file size: 10MB per attachment.
- **Cookie security:** `visitor_token` cookie: httpOnly, Secure, SameSite=None (cross-site required since widget loads on external domains), 90-day expiry. Token validated via `crypto.timingSafeEqual`.
- **GDPR:** Visitor data (name, email, messages) registered in PII compliance registry. "Delete my data" option in widget settings menu. Workspace-level data retention: 24 months default (matches `communications.md > External Message Retention`).

### Live Chat Use Cases

| Use Case                        | Configuration                                                                             | Value Proposition                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Sales / lead capture**        | Pre-chat form (name + email required), auto-create CRM record, assign to sales team       | Every chat becomes a CRM record with full conversation history — no Intercom-to-CRM sync needed               |
| **Customer support**            | Pre-chat form (email required for account lookup), CRM auto-linking, AI triage automation | Support agent sees customer's full record (projects, invoices, history) alongside the chat — no tab-switching |
| **Agency client communication** | Embedded on agency's client-facing site, CRM linking to client records                    | Alternative to portal comments — clients who don't want to log into a portal can chat instead                 |
| **Event / conference**          | Temporary widget on event page, no pre-chat form, auto-reply with schedule link           | Quick Q&A without requiring registration                                                                      |
| **Internal help desk**          | Widget on company intranet, pre-chat form with department select                          | IT/HR support without a separate ticketing tool                                                               |

### Phase Mapping

> **Post-MVP:** All Live Chat phases below are post-MVP per the glossary.

| Phase                                  | Live Chat Widget Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Post-MVP — Comms & Polish**          | Foundation: communications workspace `external` scope threads operational, `external_contacts` table, real-time WebSocket infrastructure, Chat Editor (TipTap env 1). No widget yet — but the backend can receive and route external messages.                                                                                                                                                                                                                                                                                              |
| **Post-MVP — Custom Apps**             | `chat_widgets` and `chat_visitors` tables. Widget JavaScript bundle (shadow DOM, chat UI, WebSocket client, pre-chat form). Widget configuration in Settings > Channels > Live Chat. Communications workspace "Live Chat" sidebar section. CRM auto-linking. Visitor session management. Domain allowlist. Rate limiting. New automation triggers (`chat.message_received`, `chat.conversation_started`, `chat.visitor_identified`). New automation actions (`chat.send_auto_reply`, `chat.assign_conversation`). Plan limits and tracking. |
| **Post-MVP — Native App & Tap to Pay** | AI-powered auto-responses — see `gaps/knowledge-base-live-chat-ai.md` for full pipeline: knowledge base designation, Smart Doc content chunking, embedding schema (`knowledge_embeddings` + `knowledge_search` tables), confidence-based routing, agent-assist mode. Chatbot flows (decision tree before human handoff). Widget analytics (conversation volume, response time, resolution rate). Multi-language widget UI.                                                                                                                  |

---

## Extension 3: Commerce Embed (Post-MVP)

### What It Is

An embeddable payment form that EveryStack users place on external websites to collect orders, bookings, donations, or service payments. Submissions create records in EveryStack tables and process payments via Stripe — routing transactions directly into the user's workspace.

**Core insight:** EveryStack already has embeddable forms (script tag + iframe, Post-MVP — Portals & Apps (Initial)) and Stripe payment blocks (Post-MVP — Portals & Apps (Fast-Follow)). The Commerce Embed combines these into a single embeddable flow: form fields + product/price selection + Stripe payment + record creation.

### Architecture

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│  External Website                │     │  EveryStack Workspace             │
│                                  │     │                                   │
│  <script src="commerce/          │     │  Orders table ← new record        │
│    embed/{embed_id}.js">         │     │  Payments table ← payment record  │
│                                  │     │  Automations ← triggers fire      │
│  ┌─────────────────────────┐     │     │                                   │
│  │  Commerce Form           │     │     │  ┌──────────────────────┐        │
│  │                          │     │     │  │  Stripe Dashboard     │        │
│  │  Step 1: Product/service │     │     │  │  (payment lands here  │        │
│  │  Step 2: Customer info   │─REST┼─────│  │   too — reconciled)   │        │
│  │  Step 3: Stripe payment  │     │     │  └──────────────────────┘        │
│  │  Step 4: Confirmation    │     │     │                                   │
│  └─────────────────────────┘     │     └──────────────────────────────────┘
└─────────────────────────────────┘
```

### Embed Protocol

Same pattern as existing embeddable forms:

**Script tag:**

```html
<script src="https://commerce.everystack.app/embed/{embed_id}.js" async></script>
<div id="everystack-commerce-{embed_id}"></div>
```

**Iframe:**

```html
<iframe
  src="https://commerce.everystack.app/c/{embed_id}"
  style="width:100%;border:none;min-height:400px;"
></iframe>
```

**React component:**

```jsx
import { EveryStackCommerce } from '@everystack/commerce-widget';

<EveryStackCommerce
  embedId="emb_xyz789"
  onComplete={(result) => console.log('Payment complete:', result)}
/>;
```

### Commerce Embed Types

Three embed modes, covering the common SMB transaction patterns:

#### Mode 1: Single Product / Service

A one-step payment form. Customer sees: product name, description, price, quantity selector (optional), customer fields, payment. No catalog browsing.

**Use cases:** Service deposit, consultation booking payment, event ticket, donation, one-time product purchase.

**Configuration:**

```typescript
interface SingleProductConfig {
  mode: 'single_product';
  product: {
    name: string;
    description: string | null;
    image_url: string | null;
    price_cents: number; // Fixed price
    currency: string; // USD, EUR, etc.
    quantity_enabled: boolean; // Show quantity selector (default: false)
    quantity_max: number; // Max quantity (default: 10)
  };
  customer_fields: FormField[]; // Name, email, phone, custom fields
  success_action: SuccessAction; // Thank you message, redirect URL, or summary
}
```

#### Mode 2: Product Catalog (Table-Bound)

A multi-step form where the customer selects from products/services stored in an EveryStack table. The embed pulls product data (name, description, price, image) from the table in real time.

**Use cases:** Small product catalog (< 50 items), service menu, tiered pricing selection, add-on upsells.

**Configuration:**

```typescript
interface CatalogConfig {
  mode: 'catalog';
  source_table_id: string; // Products/Services table
  field_mapping: {
    name_field_id: string; // Product name field
    description_field_id: string | null;
    price_field_id: string; // Currency or Number field
    image_field_id: string | null; // Attachment field
    category_field_id: string | null; // Single Select — enables category tabs
    active_field_id: string | null; // Checkbox — only show active products
  };
  display: 'grid' | 'list'; // Product display layout
  multi_select: boolean; // Allow multiple products (cart)
  customer_fields: FormField[];
  success_action: SuccessAction;
}
```

**How product data is served:** The embed fetches product data via a public read-only API endpoint scoped to the specific embed configuration. Only fields mapped in `field_mapping` are exposed — no other table data leaks. CDN-cached with 60-second TTL, invalidated on record mutations (same pattern as portal caching).

#### Mode 3: Custom Amount

Customer enters their own amount (for donations, tips, or "pay what you want" pricing). Optional preset buttons ($10, $25, $50, $100, Custom).

**Configuration:**

```typescript
interface CustomAmountConfig {
  mode: 'custom_amount';
  currency: string;
  preset_amounts: number[] | null; // Preset buttons in cents [1000, 2500, 5000, 10000]
  min_amount_cents: number; // Floor (default: 100 = $1)
  max_amount_cents: number | null; // Ceiling (optional)
  label: string; // "Donation amount", "Tip amount", etc.
  customer_fields: FormField[];
  success_action: SuccessAction;
}
```

### Commerce Embed Steps (Visitor Flow)

**Step 1 — Selection (Catalog mode only):** Product grid/list rendered from table data. Category tabs if configured. Click to select. Quantity controls. Running total shown.

**Step 2 — Customer Information:** Form fields configured by the EveryStack user. Minimum: email (required for receipt). Common: name, phone, address, order notes. Custom fields map to table fields. Turnstile spam protection (same as existing embeddable forms).

**Step 3 — Payment:** Stripe Elements (card input). Customer's card data never touches EveryStack servers. Payment intent created server-side with amount calculated from selections. Apple Pay / Google Pay buttons shown when available (Stripe Payment Request Button API). Amount summary displayed above payment form.

**Step 4 — Confirmation:** Configurable success action:

- **Thank you message:** Customizable text + order summary.
- **Redirect:** Send customer to a URL (e.g., booking confirmation page, download page).
- **Summary:** Show submitted data + receipt link (Stripe hosted receipt).

### Record Creation on Payment Success

When Stripe `payment_intent.succeeded` webhook fires:

```
1. Match webhook to commerce embed via payment_intent metadata (embed_id, tenant_id)
2. Create record(s) in target table(s):
   a. Order/transaction record:
      - Customer fields → mapped table fields
      - Product info → mapped fields (name, quantity, price)
      - Payment status → "Paid"
      - Stripe receipt URL → URL field
      - Payment amount → Currency field
      - Stripe payment intent ID → Text field (for reconciliation)
      - created_by: NULL (external submission, same as portal write-back)
   b. Optional: Line item records (Catalog mode with multi-select)
      - One record per selected product in a Line Items table
      - Linked to the parent order record
3. Post-creation:
   - Write audit log: actor_type='commerce_embed', actor_id=embed_id
   - Emit record.created domain event (triggers automations)
   - Send receipt email to customer (if configured, via Resend)
   - Invalidate any portal/website cache pages bound to the orders table
```

### Data Model

#### `commerce_embeds` Table

| Column                     | Type             | Purpose                                                                                                                                                      |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ----------------------------------------------------- | ----------- | --------- |
| `id`                       | UUID             | Primary key. Used in embed URL.                                                                                                                              |
| `tenant_id`                | UUID             | Workspace that owns this embed                                                                                                                               |
| `name`                     | VARCHAR          | Display name (workspace UI)                                                                                                                                  |
| `status`                   | VARCHAR          | `'active'`, `'paused'`, `'draft'`                                                                                                                            |
| `mode`                     | VARCHAR          | `'single_product'`, `'catalog'`, `'custom_amount'`                                                                                                           |
| `config`                   | JSONB            | Mode-specific config (SingleProductConfig, CatalogConfig, or CustomAmountConfig)                                                                             |
| `target_table_id`          | UUID             | Table where order/transaction records are created                                                                                                            |
| `field_mapping`            | JSONB            | Maps embed fields → table fields. `{ customer_name: field_id, customer_email: field_id, amount: field_id, status: field_id, stripe_receipt: field_id, ... }` |
| `line_items_table_id`      | UUID (nullable)  | Table for line item records (Catalog mode with multi-select)                                                                                                 |
| `line_items_field_mapping` | JSONB (nullable) | Maps line item fields → table fields                                                                                                                         |
| `stripe_config`            | JSONB            | `{ price_mode: 'fixed'                                                                                                                                       | 'from_table' | 'custom', currency, tax_behavior: 'inclusive'         | 'exclusive' | 'none' }` |
| `theme`                    | JSONB (nullable) | Appearance overrides (colors, fonts, border radius). Null = EveryStack defaults.                                                                             |
| `success_action`           | JSONB            | `{ type: 'message'                                                                                                                                           | 'redirect'   | 'summary', message?: string, redirect_url?: string }` |
| `allowed_domains`          | TEXT[]           | Domain allowlist for CORS                                                                                                                                    |
| `notification_config`      | JSONB            | Who gets notified on new transaction (user IDs, email addresses)                                                                                             |
| `created_by`               | UUID             |                                                                                                                                                              |
| `created_at`               | TIMESTAMPTZ      |                                                                                                                                                              |
| `updated_at`               | TIMESTAMPTZ      |                                                                                                                                                              |

**Indexes:** `(tenant_id)`, `UNIQUE (id)`.

#### `commerce_transactions` Table

| Column                     | Type               | Purpose                                                          |
| -------------------------- | ------------------ | ---------------------------------------------------------------- |
| `id`                       | UUID               | Primary key                                                      |
| `tenant_id`                | UUID               |                                                                  |
| `embed_id`                 | UUID               | FK to commerce_embeds                                            |
| `stripe_payment_intent_id` | VARCHAR            | Stripe PI ID for reconciliation                                  |
| `amount_cents`             | INTEGER            | Total amount charged                                             |
| `currency`                 | VARCHAR(3)         |                                                                  |
| `status`                   | VARCHAR            | `'pending'`, `'succeeded'`, `'failed'`, `'refunded'`             |
| `customer_email`           | VARCHAR            | PII — registered in compliance registry                          |
| `customer_name`            | VARCHAR (nullable) |                                                                  |
| `customer_data`            | JSONB              | All submitted customer fields                                    |
| `line_items`               | JSONB              | Products/quantities/prices selected                              |
| `record_id`                | UUID (nullable)    | FK to created record in target table (set after record creation) |
| `stripe_receipt_url`       | VARCHAR (nullable) |                                                                  |
| `refund_amount_cents`      | INTEGER (nullable) | Partial or full refund amount                                    |
| `metadata`                 | JSONB              | Page URL, referrer, IP (hashed), user agent                      |
| `created_at`               | TIMESTAMPTZ        |                                                                  |
| `updated_at`               | TIMESTAMPTZ        |                                                                  |

**Indexes:** `(tenant_id, embed_id)`, `(stripe_payment_intent_id)`.

### Commerce Embed Configuration (Workspace UI)

New section: **Settings > Commerce Embeds** (or accessible from the portal admin area)

**Creation wizard (3 steps):**

1. **Choose mode:** Single Product / Product Catalog / Custom Amount. Card selector with description and illustration.
2. **Configure products & fields:** Mode-specific configuration. Single Product: enter name/price/description. Catalog: pick source table and map fields. Custom Amount: set presets and limits. All modes: configure customer fields and map them to a target table.
3. **Customize & deploy:** Theme (color, font), success action, embed code (script tag / iframe / React). Preview rendered inline. Copy-to-clipboard for embed code.

### Automation Integration

> **Post-MVP:** All commerce automation triggers and actions below are post-MVP.

**Triggers:**

| Trigger                      | Fires When              | Context Available                                                 |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `commerce.payment_succeeded` | Stripe payment succeeds | embed_id, transaction, customer data, products, amount, record_id |
| `commerce.payment_failed`    | Stripe payment fails    | embed_id, customer data, error reason                             |
| `commerce.refund_issued`     | Refund processed        | embed_id, transaction, refund amount, original record_id          |

**Example automation recipes:**

- **Order fulfillment:** Payment Succeeded → Update order status to "Paid" → Send confirmation email with receipt → Create task "Ship order #{record.order_number}" assigned to fulfillment team → If amount > $500, notify Manager.
- **Digital delivery:** Payment Succeeded → Generate download link (file URL field) → Send email with download link → Update record status to "Delivered".
- **Subscription onboarding:** Payment Succeeded → Create portal client account from customer email → Send portal invitation email → Create onboarding task sequence.
- **Donation acknowledgment:** Payment Succeeded → Send thank-you email → If amount > $100, send handwritten-note task to admin → Update donor record total_donated (Adjust Number Field action #38).

### Commerce Embed Plan Limits

| Plan         | Commerce Embeds | Monthly Transactions | Stripe Processing                                    |
| ------------ | --------------- | -------------------- | ---------------------------------------------------- |
| Freelancer   | 1               | 50                   | Standard Stripe fees (customer's own Stripe account) |
| Starter      | 3               | 200                  | Standard Stripe fees                                 |
| Professional | 10              | 1,000                | Standard Stripe fees                                 |
| Business     | Unlimited       | 5,000                | Standard Stripe fees                                 |
| Enterprise   | Unlimited       | Custom               | Standard Stripe fees                                 |

**Important:** EveryStack does not take a cut of transactions. Payments go directly to the customer's connected Stripe account. EveryStack is the platform, not the payment processor. This avoids payment processor compliance burden and aligns with the "superbase layer" positioning.

**Transaction tracking:** Redis counter `commerce:txn:{tenantId}:{YYYY-MM}`. At limit: new payment attempts return a friendly "This form is temporarily unavailable" page. No data loss — the limit is on new transactions, not on webhook processing.

### Security

- **PCI compliance:** Card data handled entirely by Stripe Elements. EveryStack servers never see card numbers, CVV, or expiration dates. EveryStack is SAQ-A eligible (all payment processing delegated to Stripe).
- **Webhook verification:** All Stripe webhooks verified via `stripe.webhooks.constructEvent()` with webhook signing secret (same as portal Stripe integration in `app-designer.md`).
- **Domain allowlist:** Embed only loads on allowed domains. Server validates `Origin` header.
- **Rate limiting:** 10 submissions per IP per minute (same as embeddable forms). 3 failed payment attempts per email per hour.
- **Spam protection:** Cloudflare Turnstile on the customer information step (same as embeddable forms).
- **Product data exposure:** Catalog mode exposes only mapped fields from the source table via a read-only endpoint. No other table data is accessible. Endpoint requires valid embed_id and validates against `commerce_embeds.source_table_id` + `field_mapping`.
- **GDPR:** Customer data (email, name, transaction history) registered in PII compliance registry. Deletion endpoint removes `commerce_transactions` customer data but preserves anonymized transaction records for accounting.

### Commerce Embed Use Cases

| Use Case                                    | Mode                     | Target User                                                  |
| ------------------------------------------- | ------------------------ | ------------------------------------------------------------ |
| **Service deposit / retainer**              | Single Product           | Agency collecting upfront payment from new clients           |
| **Consultation booking with payment**       | Single Product           | Consultant, coach, therapist charging for sessions           |
| **Product sales (small catalog)**           | Catalog                  | Small business selling 5–50 products on their website        |
| **Event registration with ticket purchase** | Catalog                  | Event organizer with ticket tiers (Early Bird, VIP, General) |
| **Donation collection**                     | Custom Amount            | Nonprofit, community organization, content creator           |
| **Invoice payment link**                    | Single Product (dynamic) | Sending a payment link with specific amount for an invoice   |
| **Service add-on upsell**                   | Catalog                  | Offering additional services during a checkout flow          |

### Relationship to Existing Portal Stripe Integration

The Commerce Embed and the Portal Payment Block are complementary, not competing:

|                    | Portal Payment Block                            | Commerce Embed                                      |
| ------------------ | ----------------------------------------------- | --------------------------------------------------- |
| **Where it lives** | Inside an authenticated portal page             | Embedded on any external website                    |
| **Who uses it**    | Portal clients (authenticated, identity-scoped) | Anonymous website visitors                          |
| **Data context**   | Bound to a specific record (e.g., Invoice #123) | Creates new records (orders, transactions)          |
| **Amount source**  | From a field on the bound record                | Fixed, from table catalog, or custom entry          |
| **Use case**       | "Pay this invoice" / "Pay this retainer"        | "Buy this product" / "Book this service" / "Donate" |

Both use Stripe Elements. Both fire `payment_intent.succeeded` webhooks. Both create records and trigger automations. The Commerce Embed is the _outbound_ commerce tool (attract new transactions from the web), while the Portal Payment Block is the _inbound_ commerce tool (collect payments from existing clients).

### Phase Mapping

> **Post-MVP:** All Commerce Embed phases below are post-MVP per the glossary.

| Phase                                       | Commerce Embed Work                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Post-MVP — Portals & Apps (Initial)**     | Existing embeddable forms infrastructure (script tag, iframe, Turnstile, record creation). No commerce-specific work, but the embed pattern is established.                                                                                                                                                                                                                                                 |
| **Post-MVP — Portals & Apps (Fast-Follow)** | `commerce_embeds` and `commerce_transactions` tables. Single Product mode (fixed price). Customer fields → record creation. Stripe Elements integration (extends portal Stripe work). Webhook handler. Configuration wizard in Settings. Embed code generation. Success actions. Automation triggers (`commerce.payment_succeeded`, `commerce.payment_failed`). Plan limits and tracking. Domain allowlist. |
| **Post-MVP — Accounting Integration**       | Catalog mode (table-bound product listing). Multi-product cart with line item record creation. Custom Amount mode. Refund handling (`commerce.refund_issued` trigger). Accounting integration: Commerce transactions push to QuickBooks/Xero via Action #32. Commerce analytics (transaction volume, revenue, conversion rate). React component package on npm.                                             |

---

## Cross-Extension Synergies

> **Post-MVP:** All cross-extension synergy scenarios below are post-MVP.

The three extensions are most powerful in combination:

**Website Mode + Commerce Embed:** Build a product catalog website with the App Designer. Embed commerce payment forms directly on product pages — visitors browse products (data from Products table), click "Buy Now", complete payment, record lands in Orders table, automation fulfills the order. Full e-commerce without Shopify.

**Website Mode + Live Chat Widget:** Business homepage built in App Designer + live chat widget embedded on the site. Visitor browses services, has a question, opens chat. Agent sees which page the visitor is on (from widget metadata). Conversation links to CRM. Post-chat automation creates a follow-up task. The website and the chat are both powered by EveryStack.

**Live Chat Widget + Commerce Embed:** Chat conversation leads to a sale. Agent sends a payment link (Commerce Embed URL) directly in the chat. Visitor clicks, pays, transaction record links to the same CRM contact as the chat conversation. Full conversation-to-conversion trail in one platform.

**All three:** An agency builds their website in Website Mode, embeds a live chat widget for prospect conversations, and has commerce embeds on their pricing page for service booking payments. New inquiry comes in via chat → agent qualifies the lead → sends booking link → payment completes → client record created → portal access provisioned → onboarding automation fires. Zero external tools.

---

## Implementation Priority & Effort Estimates

| Extension            | Effort                                                                                                    | New Tables                                                | New Infrastructure                                                                     | Reuse %                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Website Mode**     | 2–3 weeks (Post-MVP — Portals & Apps (Initial): 3 days, Post-MVP — Portals & Apps (Fast-Follow): 2 weeks) | 0 new tables (1 new column on `portals`)                  | 6 new block type renderers + property panels                                           | ~90% reuse of App Designer                                      |
| **Commerce Embed**   | 2–3 weeks (Post-MVP — Portals & Apps (Fast-Follow): 2 weeks, Post-MVP — Accounting Integration: 1 week)   | 2 new tables (`commerce_embeds`, `commerce_transactions`) | Embed JS bundle, Stripe Elements integration, product API endpoint                     | ~70% reuse of embeddable forms + portal Stripe                  |
| **Live Chat Widget** | 3–4 weeks (Post-MVP — Custom Apps)                                                                        | 2 new tables (`chat_widgets`, `chat_visitors`)            | Widget JS bundle, visitor WebSocket endpoint, communications workspace sidebar section | ~60% reuse of communications infrastructure + external_contacts |

**Recommended build order:**

1. **Website Mode** (Post-MVP — Portals & Apps (Initial)/4b) — lowest effort, highest marketing impact, zero new infrastructure.
2. **Commerce Embed** (Post-MVP — Portals & Apps (Fast-Follow)/8e) — moderate effort, directly monetizable for users, extends existing Stripe work.
3. **Live Chat Widget** (Post-MVP — Custom Apps) — highest effort but strongest competitive moat, depends on communications infrastructure (Post-MVP — Comms & Polish).

---

## Key Architectural Decisions

| #   | Decision                                                           | Rationale                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Website Mode is a portal configuration, not a separate system      | Avoids duplicating the entire designer, theme system, block model, and caching infrastructure. One renderer, one designer, one publish flow. _(Note: Glossary defines Website as a post-MVP App type — see conflict note at top of Extension 1. If the App-based approach is adopted, websites would use the `apps` table instead.)_ |
| 2   | Chat widget uses shadow DOM, not iframe                            | Shadow DOM provides CSS isolation without the cross-origin restrictions of iframes. Widget can resize fluidly, access `document.cookie` for session, and communicate with the host page via postMessage if needed. Iframe is offered as a fallback for sites with strict CSP.                                                        |
| 3   | Chat visitors are separate from portal clients                     | Portal clients have identity-based record scoping and full session management. Chat visitors are anonymous or semi-identified (email only). Different trust levels, different auth models, different data exposure. Shared only via `external_contacts` link.                                                                        |
| 4   | Commerce Embed doesn't take a transaction fee                      | EveryStack is the operations platform, not the payment processor. Taking a cut would require money transmitter compliance, compete with Stripe's own products, and misalign incentives. Revenue comes from SaaS subscriptions — commerce embeds make the platform stickier.                                                          |
| 5   | All three extensions use the existing embeddable forms pattern     | Script tag + iframe + domain allowlist + Turnstile + rate limiting is already proven. Consistency across embed types reduces engineering surface and user learning curve.                                                                                                                                                            |
| 6   | Live chat threads use existing `threads` / `thread_messages` model | No parallel messaging infrastructure. Chat messages are just thread_messages with `author_type: 'external_contact'` and `channel_type: 'live_chat'`. Same search, same AI analysis, same automation triggers.                                                                                                                        |
| 7   | Product catalog data served via read-only scoped API               | Catalog mode exposes only the mapped fields, not the full table. Defense in depth: embed_id validates → field_mapping restricts → CDN caches. No risk of data leakage.                                                                                                                                                               |
| 8   | Website Mode data binding removes record_scope layer               | Portals filter by client identity. Websites show the same data to all visitors. The binding modes (context, relationship, query) are identical — only the scoping layer is conditional on `portal_mode`.                                                                                                                             |

---

## MVP Feature Split

> **⚠️ Important:** Per the glossary, **none of the features in this document are MVP**. The phase references below indicate the post-MVP phase in which each feature is planned, not MVP inclusion. The glossary MVP Scope Summary explicitly excludes: "Commerce embeds, live chat widget", "Custom Apps (POS, websites, internal apps)", and "Full communications hub."

**Post-MVP — Portals & Apps (Initial) (post-MVP, with portal enhancements):**

- `portal_mode` column on `portals` table
- Website creation wizard (skip scoping, skip auth configuration)
- Public-default access mode for websites
- Data binding without `record_scope` when `portal_mode = 'website'`
- Websites buildable with existing block types (Rich Text, Static Image, Form, Embed, Navigation Menu)

**Post-MVP — Portals & Apps (Fast-Follow) (post-MVP, fast-follow):**

- 6 new website block types (Hero, Testimonial, Pricing Table, Footer, Feature Grid, CTA Banner)
- Navigation Menu enhancement (dropdown, sticky, hamburger)
- Basic scroll animations (Style tab)
- Blog / content page type with slug-based routing
- Website templates in creation wizard
- AI-generated websites (Opus, 20 credits)
- Commerce Embed: Single Product mode, `commerce_embeds` + `commerce_transactions` tables, Stripe Elements, configuration wizard, embed code generation, automation triggers

**Post-MVP — Comms & Polish (post-MVP, with communications infrastructure):**

- Communications workspace `external` scope threads operational (prerequisite for Live Chat)
- `external_contacts` table, real-time WebSocket infrastructure
- No widget yet — backend can receive external messages

**Post-MVP — Accounting Integration (post-MVP, with accounting):**

- Commerce Embed: Catalog mode, Custom Amount mode, multi-product cart, refund handling, accounting integration, analytics, npm React component

**Post-MVP — Custom Apps (post-MVP, with omnichannel):**

- Live Chat Widget: `chat_widgets` + `chat_visitors` tables, widget JS bundle, WebSocket transport, pre-chat form, communications workspace "Live Chat" section, CRM auto-linking, visitor session management, automation triggers/actions, plan limits

**Post-MVP — Native App & Tap to Pay (post-MVP, omnichannel follow-up):**

- Live Chat: AI auto-responses, chatbot decision trees, widget analytics, multi-language UI
