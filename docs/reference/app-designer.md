# EveryStack — App Designer

> **Reference doc (Tier 3).** The App Designer is the unified visual builder for all EveryStack app types. It provides a shared engine: 12-column grid canvas, recursive block tree, drag-and-drop, data binding, themes, preview/publish. This doc covers the designer architecture, block model, theme system, canvas behavior, property panel, and the seven app types it produces.
>
> **⚠️ POST-MVP SCOPE (entire App Designer).** Per `GLOSSARY.md`: the App Designer (visual page builder) is **post-MVP**. MVP uses Quick Portals (externally-shared Record View of one record, auth wrapper — see `portals.md`) and simple Forms (Record View layout for record creation — see `forms.md`). These MVP features do NOT use the App Designer — they use the Record View layout engine. The App Designer builds upon them post-MVP with spatial layouts, multi-page structures, and custom block canvases. Build clean extension points in MVP, but do not build the App Designer itself.
>
> **App Types (three categories) — all post-MVP except where noted:**
> - **External** (audience outside the workspace): **Custom Portal** (multi-page, multi-record, custom layout — post-MVP upgrade of MVP Quick Portal), **App Form** (multi-step, conditional logic — post-MVP upgrade of MVP Quick Form), **Website** (public-facing pages, no auth/record context — post-MVP)
> - **Internal** (workspace users): **Custom Table View** (opinionated, view-based, fast setup — see `tables-and-views.md`), **Widget** (renders inside My Office grid cell, responsive to container width — see `my-office.md`), **Internal App** (full spatial layout, POS/kiosk/dispatch — see `custom-apps.md`)
> - **Document** (file output): **Document** (fixed-size page canvas, renders to PDF/DOCX via Gotenberg — invoices, contracts, proposals, reports — see `document-designer.md`)
>
> The designer experience is unified across all types. Differences are: auth context, permissions model, rendering target, and available configuration options. "Portal" is an external app type, not the name of the designer.
>
> **⚠️ DB model note (per GLOSSARY.md):** The old docs used the `portals` DB table to store all App Designer outputs via a `type` column. Per the glossary, MVP splits this: `portals` for simple record-sharing (with `record_view_config_id`), `forms` for record-creation forms (with `record_view_config_id`), and (post-MVP) `apps` / `app_pages` / `app_blocks` for App Designer outputs. The unified `portals` table with `type` column described in this doc is the **post-MVP** schema for App Designer outputs only.
>
> Cross-references: `CLAUDE.md` (root — permissions, i18n), `data-model.md` (schema), `smart-docs.md` (Smart Doc blocks — wiki mode only; template mode subsumed by Document type), `document-designer.md` (Document app type — fixed-size canvas, PDF/DOCX output, merge tags, header/footer zones, template gallery, homegrown DOCX engine), `automations.md` (triggers/actions), `agency-features.md` (chart blocks, asset gallery block), `compliance.md` (PII registry, GDPR), `accounting-integration.md` (invoice portal page, retainer dashboard, client financial summary blocks), `inventory-capabilities.md` (Quick Entry app mode — portal-compatible for warehouse/stockroom staff), `chart-blocks.md` (Chart block and Metric/KPI Card block rendering, theming, record-scoped chart aggregation), `custom-apps.md` (internal apps — shared block model, themes, canvas, `apps.type` column branching, `PageBuilderRenderer` context switching), `embeddable-extensions.md` (Website type as `portal_mode: 'website'` — same designer, blocks, themes; 6 marketing block types; data binding without record_scope; Commerce Embed reuses Stripe payment infrastructure), `approval-workflows.md` (portal Approval Block connects to approval engine — portal client resolved as approver via record scoping identity, portal theming on approval block, `actor_type: 'portal_client'` on step decisions), `booking-scheduling.md` (Scheduler block spec, public booking pages reuse App Designer infrastructure, embeddable booking widget, booking lifecycle record creation), `my-office.md` (Widget app type renders in My Office grid cells, responsive to container width), `record-templates.md` (form block `template_id` — template values pre-fill form, hidden template fields silently populated; portal as `record_creation_source` enum value)
> Cross-references (cont.): `workspace-map.md` (PortalNode in topology graph — publish status, bound tables, client count, payment/form/chart/approval/booking flags; portal block data_binding JSONB parsed for `portal_displays`, `portal_scoped_by`, `portal_writes_to` edge extraction; double-click navigates to App Designer), `field-groups.md` (App tab `field_config` can include `field_groups` in `view_config` — Managers set up field groups as part of App design; if `customizable` and `can_hide_fields` true, users modify groups within `user_app_customizations` overrides)
> **Reconciliation: 2026-02-27 (filename rename)** — Renamed file `interface-designer.md` → `app-designer.md` per `GLOSSARY.md` naming discipline ("Interface Designer" → **App Designer**). Updated all 13 cross-referencing docs to point to `app-designer.md`. MANIFEST.md intentionally not updated (done separately).
> Prior reconciliation (2026-02-27): Aligned DB table names with `GLOSSARY.md` DB entity reference: `portal_pages` → `app_pages`, `portal_blocks` → `app_blocks`, FKs updated to reference `apps` table. Updated `portals.theme` → `apps.theme` in App Designer context. Updated `portal_domains` FK to reference `apps`. No content deleted; all changes are naming/reference alignment.
> Prior reconciliation (2026-02-27): Renamed Interface Designer → App Designer, interface types → app types, tagged entire doc as post-MVP per glossary MVP scope, noted DB model split (portals/forms/apps). Prior: Added Document as 7th app type, `document-designer.md` cross-reference.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Progressive Disclosure Mapping | 69–80 | 3-level disclosure for app creation |
| Portal Overview (App Designer — Post-MVP) | 81–92 | App Portal concept and relationship to Quick Portals |
| Portal Architecture (App Designer — Post-MVP) | 93–104 | Apps/app_pages/app_blocks table architecture |
| App Navigation in Workspace (Post-MVP) | 105–116 | How apps appear in sidebar and workspace |
| App Creation — Type Selection (Progressive Disclosure) — Post-MVP | 117–149 | 7 app types, creation wizard entry |
| Portal Creation Flow (App Designer — Post-MVP) | 150–173 | Step-by-step App Portal creation |
| Designer Architecture (Post-MVP) | 174–208 | 12-column grid canvas, recursive block tree, drag-and-drop |
| Block Model | 209–245 | Block types, block tree structure, nesting rules |
| Canvas Behavior (Post-MVP) | 246–260 | Grid snapping, responsive preview, undo/redo |
| Property Panel (Three Tabs) — Post-MVP | 261–283 | Content, Style, Logic tabs for block configuration |
| Data Binding Modes (Post-MVP) | 284–331 | Record context, list binding, aggregation binding |
| Theme System (Post-MVP) | 332–368 | App-level theming, color tokens, font overrides |
| Client Interaction Capabilities (Post-MVP) | 369–382 | Form submissions, file uploads, chat from portals |
| Record Scoping (Identity-Based) | 383–434 | portal_clients, linked_record_id scoping, per-table scope config |
| Client Authentication | 435–517 | Magic link + password auth, portal_sessions, session lifecycle |
| Portal Client Data Model | 518–649 | portal_clients table, identity resolution, CRM linking |
| Client Management | 650–683 | Client list, access management, bulk operations |
| Portal Write-Back Flow (Form Submissions) | 684–737 | Data submission pipeline, validation, record creation |
| Portal Analytics (Post-MVP) | 738–757 | Page views, session tracking, engagement metrics |
| Stripe Payment Integration (Post-MVP) | 758–765 | Stripe Elements, payment blocks, invoice integration |
| Rendering Modes (Post-MVP — App Designer) | 766–773 | SSR, client-side, hybrid rendering strategies |
| Preview and Publish Flow (Post-MVP — App Designer) | 774–798 | Draft/live workflow, preview URLs, versioning |
| Caching Infrastructure (Three-Tier) | 799–834 | CDN, Redis, in-memory caching for portal pages |
| Portal Client Limits | 835–850 | Plan-based limits on portal clients and pages |
| Automation Integration | 851–864 | Portal event triggers, automation actions for portals |
| Audit Trail for Portal Actions | 865–888 | Portal client audit logging, actor_type: portal_client |
| Session Cleanup | 889–911 | Expired session pruning, revocation |
| Custom Domain Architecture (Specced — Build Post-MVP — Portals & Apps (Fast-Follow)) | 912–934 | CNAME setup, SSL provisioning, routing |
| Mobile Portal Experience — PWA with Offline (Post-MVP) | 935–963 | Mobile PWA portal, offline support |
| Portal SEO — Basic Meta Tags (Post-MVP) | 964–977 | Meta tags, Open Graph, sitemap |
| Embeddable External Forms | 978–1004 | Script tag / iframe embedding for forms |
| GDPR for Portal Clients | 1005–1019 | Data rights, deletion, export for portal users |
| Booking/Scheduling System (Post-MVP) | 1020–1027 | Booking integration with App Designer |
| Multi-Language Portal Content (Designed — Build Deferred) | 1028–1042 | i18n for portal content |
| MVP Feature Split | 1043–1052 | What ships as Quick Portal vs App Designer |
| Phase Implementation Summary (App Designer — Post-MVP) | 1053–1061 | Post-MVP — Portals & Apps+ delivery scope |

---

## Progressive Disclosure Mapping

> **⚠️ POST-MVP.** This entire section describes the App Designer's progressive disclosure — the App Designer is post-MVP per `GLOSSARY.md`.

| Level | User Experience | What's Visible |
|---|---|---|
| **L1 (80%)** | Choose a use case card ("Client Dashboard", "Public Form", etc.), pick a table, select a theme, and get a working app with template pre-built. Edit content by selecting blocks and changing fields in the property panel. Publish with one click. | Intent-based type picker, 3-step wizard, template gallery, canvas with pre-placed blocks, Content tab in property panel, Preview and Publish buttons. |
| **L2 (15%)** | Add blocks from the library, configure data binding (context-bound default, relationship-bound for linked data), set visibility rules, adjust per-breakpoint column spans, create multi-page apps, configure portal client authentication and record scoping. | Block library sidebar, Layers tree mode, relationship-bound data binding, Logic tab (visibility rules, permissions), page tree with add/duplicate/delete, client auth settings, embed/custom domain config. |
| **L3 (5%)** | Query-bound data binding (custom queries across any portal table), Grid Container with CSS Grid cell placement, rate limiting on form submissions, PWA configuration, Commerce Embed and Stripe Terminal integration, AI-generated apps (Opus, 20 credits). | Query builder in data binding, Grid Container block, advanced Logic tab options, PWA settings, commerce/payment configuration, AI generation prompt. |

---

## Portal Overview (App Designer — Post-MVP)

> **⚠️ POST-MVP.** This section describes full-featured portals built in the App Designer (multi-page, multi-record, custom layout). MVP portals are simpler — see `GLOSSARY.md` and `portals.md`: an externally-shared Record View of a single record with auth. MVP portals use the Record View layout engine, NOT the App Designer canvas.

Client portals built in the App Designer let EveryStack users create branded, client-facing web applications from their data. These are the primary way Managers deliver value to their end clients — replacing emailed spreadsheets and PDFs with live, interactive dashboards, forms, document hubs, and payment pages. Reports are portal pages rendered to PDF — there is no separate report designer.

**App Designer portals are standalone entities.** A portal is NOT a Table View. App Designer portals have their own table (`apps` post-MVP), their own designer, their own page/block tree, and their own client auth system. The only connection to the workspace data layer is that portal blocks bind to table data. A portal can reference multiple tables across multiple bases.

**All display configuration happens in the App Designer.** Field visibility, filters, sorting, grouping, and colors are configured directly on each block within the App Designer. App Designer portals do not reference or inherit from Table Views. This keeps portals fully self-contained — changes to workspace views never affect live portals.

---

## Portal Architecture (App Designer — Post-MVP)

> **⚠️ POST-MVP.** This architecture describes App Designer portals. MVP portals use `portals` table with `record_view_config_id` — see `GLOSSARY.md` DB entity reference. Post-MVP App Designer outputs use `apps` / `app_pages` / `app_blocks` tables.

- **Portal (App):** A row in the `apps` table (post-MVP). Has theme, navigation, access settings, and owns pages.
- **Pages:** Each has a slug, `page_type` (dashboard, list, detail, form, custom), and `context_table_id`.
- **Blocks:** Arranged on a 12-column grid. Each has `data_binding`, interaction mode, `style_overrides`, and `visibility_rules`. Blocks form a tree via `parent_block_id`.
- **Client Auth:** Separate from workspace users. Magic link or email+password (Manager chooses per portal). `record_scope` filters visible data per client based on CRM record linkage.
- **URL:** `portal.everystack.app/{portalSlug}` or custom domains (Professional+ plans, CNAME setup).

---

## App Navigation in Workspace (Post-MVP)

> **⚠️ POST-MVP.** This workspace-level Apps page and navigation is post-MVP. MVP portals and forms are created/managed from the table toolbar, not a centralized Apps page.

**Workspace-level Apps page (primary home):** Top-level sidebar nav item. All apps (portals, internal apps, forms, websites, widgets, documents) shown as cards with name, type badge, status badge (Draft/Published/Unpublished), thumbnail preview, primary table, last edited timestamp. Filter tabs: All, Published, Drafts, and by type. `[+ New App]` button lives here.

**Base-level app indicator (contextual shortcut):** Tables powering apps show an app icon on their tab. Within a base, an Apps section shows only apps connected to that base's tables. Apps belong to the workspace (can reference tables from multiple bases via Cross-Links), not to any single base. Base-level indicators are shortcuts, not ownership.

**Table-level entry point (contextual creation):** The table tab menu dropdown includes **Create App** with sub-options by type (Portal, Internal App, Form, Website, Widget, Document). Selecting any type enters the creation wizard with the table pre-selected. Additionally, the table context shows existing apps where this table is the **primary context table** (set during creation), with a lighter treatment for apps that reference this table secondarily via relationship-bound or query-bound blocks. Each app card displays a type badge (Portal, Form, Document, Internal App, Widget) for quick identification. This table-level list is a contextual shortcut — the workspace Apps page remains the canonical home for all apps.

---

## App Creation — Type Selection (Progressive Disclosure) — Post-MVP

> **⚠️ POST-MVP.** The App Designer creation flow is post-MVP. MVP portal and form creation uses simpler flows described in `portals.md`.

`[+ New App]` opens a type selection step before the type-specific wizard begins. This step uses progressive disclosure to prevent concept overload — most users should never see the 7-type taxonomy directly.

### Level 1 — Intent-Based Selection (Default)

The user sees **use case cards**, not type names. Each card describes what the user wants to accomplish. The system resolves the card to the correct app type automatically.

| Card Label | Description | Resolves To |
|---|---|---|
| **Client Dashboard** | "Give your clients a branded portal to see their data" | Custom Portal |
| **Booking Page** | "Let people book appointments on your website" | App Form (with Scheduler block) |
| **Internal App** | "Build a custom screen for your team — POS, dispatch, check-in" | Internal App |
| **Public Form** | "Collect submissions from anyone with a link" | App Form |
| **Business Website** | "Build a marketing site or help center" | Website |
| **Dashboard Widget** | "Add a live data widget to your home screen" | Widget |
| **Create a Document** | "Design a document template — invoices, contracts, proposals, and more" | Document |
| **Custom Table View** | "Create an opinionated view of a table for your team" | Table View (redirects to `tables-and-views.md` Table View creation) |

The "Custom Table View" card is a shortcut that navigates to the table's view configuration — it does not enter the App Designer wizard. It's included here so users looking for "custom view" find it in the expected place.

### Level 2 — Direct Type Selection (Power User)

Below the use case cards, a text link: **"Or choose by type →"** expands to show the 7-type grid with technical labels (Custom Portal, Internal App, App Form, Website, Widget, Document, Table View) and the External/Internal/Document category tags. This is the view from the `custom-apps.md` architecture table. Power users who know the type system can skip the intent-based step.

### After Type Selection

Each type proceeds to its own wizard (Wizard Create pattern — see `design-system.md > Creation Flow Patterns`). Custom Portal, Internal App, Website, and Document use the full 3-step wizard. App Form uses a 2-step wizard (template → table binding). Widget uses a 2-step wizard (template → source selection). Table View redirects to the table's view configuration. See `document-designer.md` for the Document creation wizard details (page size, orientation, margins, template gallery).

---

## Portal Creation Flow (App Designer — Post-MVP)

> **⚠️ POST-MVP.** This multi-step creation wizard is for App Designer portals (multi-page, multi-record). MVP portal creation is simpler — Record View config + auth wrapper, created from the table toolbar. See `portals.md`.

`[+ New Portal]` (or selecting "Client Dashboard" from the intent cards) opens a 3-step wizard:

### Step 1: Choose a Starting Point

Template cards grid — Client Dashboard, Request/Intake Form, Document Hub, Payment Portal, Full Client Portal (multi-page), Start from Scratch, AI-Generated (Opus, 20 credits — text field: describe what you want, AI generates full structure and selects appropriate gallery theme).

### Step 2: Connect to Data

1. **Pick a base and table.** Table picker showing all tables across all bases. For multi-page templates, selects primary table and suggests related tables via cross-links.
2. **Pick the scoping field.** The wizard asks: "Which field identifies the client?" — showing fields that link to a contacts/CRM-type table or email-type fields. This is the field the system uses to determine which records belong to which portal client. Example: the "Client" cross-link field on the Projects table, which points to the CRM.
3. **Auto-create client accounts.** If the selected scoping field resolves to records with email addresses, the system offers to auto-create portal client accounts for each distinct client and send invitation emails. The Manager can select all or pick specific clients.

For multi-table portals, each table bound to the portal must have a scoping field that references the same CRM/contacts table. The wizard validates this and warns if a table lacks a direct client reference.

### Step 3: Name and Theme

Portal name, URL slug (auto-generated from name, editable), theme gallery (20 curated themes as cards, click to preview). Logo upload optional. Hit Create → land directly in designer with template pre-built and themed.

---

## Designer Architecture (Post-MVP)

> **⚠️ POST-MVP.** The App Designer (visual page builder) is post-MVP per `GLOSSARY.md`.

The App Designer is a full-screen visual page builder using a sidebar-panel paradigm (similar to Squarespace or Webflow). The workspace sidebar collapses to ~48px icon rail mode.

### Designer Layout (Four-Zone)

```
┌─────────────┬──────────────────────────────────┬───────────────┐
│  Sidebar    │  Canvas                           │  Property     │
│  (260px)    │  (fills remaining)                │  Panel        │
│             │                                    │  (320px)      │
│  Modes:     │  Visual page builder with          │               │
│  [Pages]    │  12-column grid, block snap,       │  Tabs:        │
│  [Blocks]   │  drag/drop, resize, selection      │  [Content]    │
│  [Layers]   │                                    │  [Style]      │
│             │                                    │  [Logic]      │
├─────────────┴──────────────────────────────────┴───────────────┤
│  Toolbar: Page selector | Viewport (desktop/tablet/mobile) |   │
│           Zoom | Undo/Redo | Theme | Preview | Settings |      │
│           Publish                                               │
└────────────────────────────────────────────────────────────────┘
```

### Designer Sidebar (Three Modes)

**Page Tree mode:** Hierarchical list of all pages. Icon by type, name, slug, drag handle for reordering. Right-click: Rename, Duplicate, Set as Home, Delete. `[+ Add Page]` opens type picker (Dashboard, List, Detail, Form, Custom). Adding a List page auto-prompts "Create a linked Detail page?"

**Block Library mode:** Categorized list of available blocks. Drag from library onto canvas to place, or click to add. Search/filter at top. Categories listed in Block Model section below.

**Block Tree mode:** Figma-style layer panel showing the block hierarchy as a collapsible tree. Selecting in the tree highlights on the canvas and vice versa. Drag-and-drop to reorder or re-parent blocks.

---

## Block Model

> **⚠️ POST-MVP.** The block model is part of the App Designer's canvas system. MVP portals and forms use the Record View field canvas, not blocks.

Everything is a block. Blocks form a tree (via `parent_block_id`) rendered recursively. Every block lives inside a container. The page itself is the root container.

### Block Categories

| Category | Block Types |
|---|---|
| **Layout** | Row, Column, Card Container, Tab Container, Collapsible Section, Grid Container |
| **Data** | Field Display, Table/List, Chart, Kanban, Image, Metric/KPI Card. Chart and Metric/KPI Card blocks use the shared chart component library — see `chart-blocks.md` > Chart Rendering in Portals. |
| **Static** | Rich Text, Static Image, Divider, Spacer, Navigation Menu, Embed |
| **Action** | Button (runs automation, navigates, generates document, submits form), Link, File Download |
| **Form Input** | Text Input, Select, Date Picker, File Upload, Checkbox, Multi-select |
| **Special** | Scheduler, Payment (Stripe), Approval, Comment Thread |

### Container Rules & Nesting

Containers define the layout structure. Each container type has specific behavior, default background, and valid children:

| Container | Behavior | Background | Valid Children |
|---|---|---|---|
| **Page Root** | Full-width vertical stack. Always exists. | `theme.surfaceAlt` (light gray) | Any block |
| **Row** | Horizontal layout. 12-column distribution (2 children = 6+6, 3 = 4+4+4). Adjust via divider drag or explicit spans. Auto-wraps on smaller viewports. | Transparent | Columns only (auto-created, min 1, max 6) |
| **Column** | Vertical stack within a Row. | Transparent | Any block except Column and Row |
| **Card Container** | Visually distinct content group with border, radius, padding, shadow. | White (`theme.surface`) | Any block except Card (no card-in-card) |
| **Tab Container** | Named tab panels, one visible at a time. `[+ Add Tab]` in design mode. Right-click tabs: Rename, Reorder, Delete. | Tab bar: `theme.surfaceAlt`; panels: white | Tab Panels only → Tab Panels accept any block except Column, Row, Tab Container |
| **Collapsible Section** | Header with label and chevron toggle. Animates open/closed. `defaultExpanded` toggle. | White with subtle borders | Any block except Collapsible (no nested collapsibles) |
| **Grid Container** | CSS Grid for complex dashboard layouts. Define rows/columns, place children into specific cells with optional spanning. (Power user.) | Transparent | Any block |

**Maximum nesting depth:** 4 levels. Page → Row → Column → Card → blocks inside card. Drop zones do not appear beyond this depth. Tooltip: "Maximum nesting depth reached."

**Default background rule:** Containers that visually contain content (Card, Tab Panel, Collapsible) default to white. Structural containers (Row, Column, Grid) default to transparent. Page Root defaults to light gray. White cards on a light gray page create professional visual separation with zero configuration.

---

## Canvas Behavior (Post-MVP)

> **⚠️ POST-MVP.** The 12-column grid canvas is part of the App Designer.

- **Grid overlay:** Subtle 12-column grid lines visible in design mode. Blocks snap to columns. Gutters between columns (16px default, configurable).
- **Block selection:** Click to select. Blue outline with resize handles that snap to grid lines.
- **Block hover:** Light highlight showing boundary plus small label (block type + data binding summary).
- **Drop zones:** Valid zones highlight with dashed blue border when dragging. Invalid zones stay inert. Self-enforcing — cannot create invalid structures.
- **Nesting indicator:** Container glows when it will receive a block as a child.
- **Binding chips:** Data-bound blocks show a small chip in top-right corner with binding summary.
- **Breadcrumb bar:** Below toolbar, shows full nesting path. Click any level to select that ancestor.
- **Viewport toggle:** Desktop (full width), Tablet (768px), Mobile (375px). Per-breakpoint visibility: "Hide on mobile" toggle in property panel.

---

## Property Panel (Three Tabs) — Post-MVP

> **⚠️ POST-MVP.** The App Designer property panel. MVP portals/forms use Record View field configuration.

Context-sensitive based on selected block. Three tabs always present:

### Content Tab (what the block shows/does)

- **Field Display:** Field picker from bound table, display format (plain/badge/progress bar/date/currency), label position (above/inline/hidden), editable toggle, validation.
- **Table/List:** Table picker, field columns (select which to show/hide), sort, filters, grouping, color rules, pagination, row-click action. All configured here in the App Designer — not inherited from Table Views.
- **Button:** Label, style (primary/secondary/outline/danger), icon, action picker (navigate, submit form, run automation, generate document, open URL, confirm+action).
- **Form Input:** Field binding (auto-detected type), placeholder, help text, required, validation.

### Style Tab (how it looks)

Background, text color, padding, margin, border, radius, shadow — all with theme defaults. Alignment, font size/weight overrides. Responsive section: per-breakpoint column span, show/hide on breakpoints. "Reset to theme defaults" button. Override dot indicator when block deviates from theme.

### Logic Tab (conditional behavior)

Visibility rules: Show if `[field] [operator] [value]`, multiple conditions with AND/OR. Client scope: which clients see this block (usually inherited from page context, overridable). Permissions: read-only (default for data blocks), editable, submittable. Rate limiting toggle for form submissions.

---

## Data Binding Modes (Post-MVP)

> **⚠️ POST-MVP.** Data binding modes are part of the App Designer's block system. MVP portals show a single record via Record View.

All data binding is configured on the block in the App Designer. Three modes, presented progressively from simplest to most powerful:

| Mode | Description | Coverage |
|---|---|---|
| **Context-Bound** (default) | Page has a context table (set during page creation). Block field picker shows fields from that table. Detail pages show one record; list pages show all visible records (filtered by client's `record_scope`). | ~70% of use cases |
| **Relationship-Bound** | On detail pages, Table/List blocks show a "Related Data" section listing all cross-links from the context table. Pick one → block shows linked records. Cross-base linking differentiator visible here. | ~20% of use cases |
| **Query-Bound** (power user) | "Custom Query" option: pick any table bound to this portal, add filters, sort. For dashboards pulling from multiple tables. | ~10% of use cases |

**Important:** All three modes are subject to `record_scope` filtering. The portal client only ever sees records that belong to them, regardless of how the block is bound. See Record Scoping below.

### Block `data_binding` JSONB Shape

```typescript
// Context-Bound (default)
interface ContextBinding {
  mode: 'context';
  // Inherits context_table_id from page
  // No additional config needed — fields selected in Content tab
}

// Relationship-Bound
interface RelationshipBinding {
  mode: 'relationship';
  crossLinkFieldId: string;    // The cross-link field on the page's context table
  // Shows records linked via this field
}

// Query-Bound
interface QueryBinding {
  mode: 'query';
  tableId: string;             // Any table bound to this portal
  filters: FilterRule[];       // Portal-designer-configured filters
  sort: SortRule[];
  groupBy: string | null;      // Field ID
}

// Union type
type BlockDataBinding = ContextBinding | RelationshipBinding | QueryBinding;
```

All binding modes are augmented by the block's Content tab settings (visible fields, column order, color rules, pagination) which are stored in the block's `config` JSONB, not in `data_binding`.

---

## Theme System (Post-MVP)

> **⚠️ POST-MVP.** The full theme system with 20 gallery themes is part of the App Designer. MVP portals may have basic branding (logo, primary color) but not the full token-based theme system described here.

Every app has a theme stored in `apps.theme` (JSONB). All blocks inherit from theme tokens — no block has hardcoded colors by default.

### Theme Tokens

| Token Group | Tokens |
|---|---|
| **Palette (12 colors)** | surface, surfaceAlt, border, text, textMuted, primary, primaryText, accent, accentText, success, warning, danger |
| **Typography** | Heading font, body font, mono font, type scale (6 size/weight pairs) |
| **Shape** | radius, radiusLg, radiusSm |
| **Spacing** | cardPadding, sectionGap, blockGap |

### Gallery Tab (default, ~80% of builders)

20 curated theme cards with mini-preview rendering. Each is a complete, tested palette with considered font pairing and consistent shape language. Range covers dark/light, warm/cool, playful/serious, rounded/sharp.

Example themes: Clean Slate (white/slate/Inter/sharp), Ocean Depth (navy/teal/Plus Jakarta Sans), Midnight (dark/electric blue/Sora), Warm Studio (cream/terracotta/Nunito), Nordic (cool white/light blue/Figtree).

Click applies instantly with live canvas preview. "Upload brand colors" option: paste hex or upload logo, system generates accessible custom theme.

### Custom Tab (power users)

Full token editor. Color swatches with pickers plus WCAG AA contrast ratio indicators. Font pickers with 20 curated families rendered in own typeface; "Browse all" for full Google Fonts. Radius slider with presets (sharp 2px, rounded 8px, pill 20px). "Save as custom theme" for workspace reuse across portals.

### Override Model (3 Tiers)

1. **Theme tokens** (global — every block inherits)
2. **Block type defaults** (semi-global, optional)
3. **Individual block overrides** (local — Style tab per block, override dot indicator)

Theme switch prompts: "Keep overrides or reset?"

---

## Client Interaction Capabilities (Post-MVP)

> **⚠️ POST-MVP.** These capabilities describe App Designer portal blocks. MVP portals support basic field editing (selectively editable fields on a Record View). Scheduling, Payment, Approval, and Comment Thread blocks are post-MVP App Designer features.

- **Field Editing:** Data blocks configurable as editable. 6-gate security: authentication, record_scope, block permissions, value constraints, rate limiting, audit logging.
- **Scheduling Blocks:** Calendar-based appointment booking from rules or table.
- **Payment Blocks:** Stripe Elements. Card data never touches EveryStack servers. Webhooks fire automation triggers on payment success/failure/refund.
- **Approval Blocks:** Approve / Request Revision with optional comment.
- **Comment Threads:** Record-level comments with visibility control (internal vs client-visible). Uses `threads` / `thread_messages` model.
- **File Upload:** Attachment blocks for client documents.
- **Forms:** Form pages with form_input block types writing to table fields.

---

## Record Scoping (Identity-Based)

> **MVP/Post-MVP note:** The basic concept of identity-based record scoping applies to MVP Quick Portals (one portal link = one record, scoped to a single client). The multi-table scoping, scoping configuration, and query-time filtering described in detail below are the post-MVP App Designer implementation for multi-record portals.

Record scoping determines which records a portal client can see. It is identity-based — derived from data relationships, not manually configured per client.

### How It Works

1. **During portal setup**, the Manager designates a **scoping field** on each portal-bound table. This is a field that identifies the client — typically a cross-link to the CRM/contacts table, or an email field.
2. **When a portal client is created**, they are linked to a specific record in the CRM/contacts table (their "identity record"). This is stored as `linked_record_id` on the `portal_clients` row.
3. **At query time**, the portal data resolver adds a filter: "Show records where `[scoping_field]` equals this client's `linked_record_id`." This happens automatically on every data query — the portal client never sees records that don't belong to them.

### Example

- CRM table has contact "Jane Smith" (record ID `abc`)
- Projects table has a "Client" cross-link field pointing to CRM
- Portal scoping field for Projects is set to "Client"
- Jane's portal client record has `linked_record_id: 'abc'`
- When Jane logs in, the Projects Table/List block automatically filters to `WHERE client_field = 'abc'`
- If someone creates a new Project linked to Jane, it appears in her portal immediately

### Multi-Table Scoping

Each table bound to a portal has its own scoping field. All must reference the same CRM/contacts table. The setup wizard validates this and warns if a table lacks a direct client reference field.

**Post-MVP — Portals & Apps (Initial): Direct links only.** The scoping field must be directly on the table. No following cross-link chains (e.g., Invoice → Project → Client). If Invoices need to appear in the portal, the Invoices table needs its own Client reference field. This keeps scoping predictable and fast.

### Scoping Resolution Chain

When a portal block renders data, three layers of filtering apply in order. Each layer can only narrow, never expand:

1. **Portal-level filters** — any static filters configured on the block (e.g., "Status = Active")
2. **Record scope** — automatic identity-based filter (records belonging to this client)
3. **Block visibility rules** — conditional logic from the Logic tab

### Portal Scoping Configuration (Stored on Portal)

```typescript
interface PortalScopingConfig {
  scopingFields: Array<{
    tableId: string;           // Table bound to this portal
    scopingFieldId: string;    // Field on that table used for client matching
    scopingType: 'cross_link' | 'email';  // How matching works
  }>;
  identityTableId: string;     // The CRM/contacts table that clients link to
}
```

This is set during portal setup and editable in Portal Settings > Data tab.

---

## Client Authentication

> **MVP/Post-MVP note:** Basic portal auth (magic link or email+password, Manager's choice) is MVP — see `GLOSSARY.md` Portal definition. The three access modes (Public, Link-Protected, Authenticated) and the full session management infrastructure described below apply to both MVP Quick Portals and post-MVP App Designer portals.

Portal client authentication is entirely separate from Clerk (which handles EveryStack workspace users). The Manager chooses one auth method per portal.

### Two Authentication Methods

**Method 1: Email + Password**

Best for clients who access the portal regularly (weekly+). Standard password-based login.

- Client receives an invitation email: "You've been invited to view your projects on [Portal Name]. Click here to set your password."
- Client clicks, sets a password (min 8 chars, complexity requirements enforced client-side and server-side).
- Password hash (`bcrypt`, cost factor 12) stored on the `portal_clients` table in the `auth_hash` column. Passwords are NEVER stored in CRM table fields.
- The CRM record gets a status indicator only: "Portal Access: Active."
- Login page: email + password form.

**Method 2: Magic Link (Passwordless)**

Best for clients who access the portal infrequently. Zero friction — no password to remember.

- Client requests access by entering their email on the portal login page.
- System sends an email via Resend: "Click to access [Portal Name]." Link contains a single-use token.
- Token: 256-bit random via `crypto.randomBytes(32).toString('base64url')`. Stored in `portal_magic_links` table.
- Token valid for 15 minutes. Single use — marked `used_at` on first click.
- Successful token validation creates a session (30-day expiry).

**Manager configures per portal** in Portal Settings > Access tab. Could offer both methods on the same login page as a Post-MVP — Portals & Apps (Fast-Follow) enhancement.

### Three Portal Access Modes

The auth method above applies to authenticated portals. Portals also support two unauthenticated modes:

| Mode | Description | Use Cases |
|---|---|---|
| **Public** | No auth. Any visitor can view. CDN cacheable. | Listings, catalogs, status pages, knowledge bases |
| **Link-Protected** | Secret token in URL. Anyone with the link can view. Prevents indexing and casual discovery. Token validated server-side on every page load using `crypto.timingSafeEqual`. | Project dashboards shared with clients, event pages, temporary campaigns |
| **Authenticated** | Portal clients log in via password or magic link (as above). Each client sees only their records via `record_scope`. | Client dashboards, project portals, invoice portals |

### Session Management

All authenticated portal access (password or magic link) creates a session:

- Session ID stored in httpOnly cookie: `Secure`, `SameSite=Lax`, path-scoped to `/portal/{portalSlug}`
- Session duration: 30 days
- `portal_sessions` table tracks active sessions with `expires_at` and optional `revoked_at`
- Managers can revoke sessions from the portal admin panel
- Session middleware on all `/portal/*` routes validates the cookie and injects `x-portal-client-id` header for downstream data resolvers

### Portal Route Architecture

Portal routes live in a Next.js route group excluded from Clerk middleware:

```
apps/web/src/app/(portal)/portal/[portalSlug]/
  ├── login/page.tsx          ← Login page (email+password or magic link request)
  ├── auth/magic/route.ts     ← Magic link validation endpoint
  ├── layout.tsx              ← Portal session middleware, theme injection
  └── [...slug]/page.tsx      ← Portal page renderer
```

Clerk middleware config excludes `/portal/*` — portal routes use their own session system.

### Rate Limiting

| Target | Limit | Window |
|---|---|---|
| Magic link requests per email | 5 | 15 minutes |
| Magic link requests per IP | 20 | 15 minutes |
| Password login attempts per email | 10 | 15 minutes (then lockout) |
| Password login attempts per IP | 50 | 15 minutes |

Rate limiters use Redis: `rl:portal:magic:{email}:{portalId}`, `rl:portal:login:{email}:{portalId}`, etc.

### Token Security

- **Magic link tokens:** 256-bit random (`crypto.randomBytes(32).toString('base64url')`), 15-minute TTL, single use.
- **Link-protected portal tokens:** Same generation method. Stored on `portals.secret_token` (MVP Quick Portals) or `apps.secret_token` (post-MVP App Designer apps). Validated with `crypto.timingSafeEqual` (constant-time comparison to prevent timing attacks).
- **Session IDs:** UUID v4, stored as httpOnly secure cookie.

---

## Portal Client Data Model

> **⚠️ DB MODEL NOTE (per GLOSSARY.md):** The `portals` table schema below uses the pre-glossary unified schema with a `type` column. Per `GLOSSARY.md`, MVP uses separate tables: `portals` (with `record_view_config_id`, `auth_type`, `status`) for Quick Portals, `forms` (with `record_view_config_id`, `target_table_id`, `status`) for Quick Forms, and post-MVP `apps` / `app_pages` / `app_blocks` for App Portals. **Portal auth by type:** Quick Portals use `portal_access` (per-record explicit grants — see `portals.md`). App Portals use `portal_clients` (identity-based scoping via `linked_record_id`). Both use `portal_sessions` with polymorphic auth (see `data-model.md`). Both portal types coexist permanently — Quick Portals are not replaced by App Portals. Optional conversion: Manager can upgrade a Quick Portal to an App Portal, migrating `portal_access` rows to `portal_clients` rows.

### `portals` Table (Pre-Glossary Unified Schema — See Note Above)

> **🚫 DO NOT BUILD FROM THIS SCHEMA.** This section preserves the pre-glossary unified portal schema for reference only. It must be fully rewritten to use `apps` / `app_pages` / `app_blocks` tables before Post-MVP — Portals & Apps development begins. The canonical MVP schema is in `data-model.md`.

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Workspace that owns this portal |
| `name` | VARCHAR | Display name |
| `slug` | VARCHAR | URL slug (`portal.everystack.app/{slug}`) |
| `description` | TEXT (nullable) | |
| `type` | VARCHAR | `'portal'`, `'app'`, `'form'`, `'website'`, `'widget'`, `'document'`. Determines designer behavior, rendering target, and available blocks. **⚠️ POST-MVP schema note:** Per `GLOSSARY.md`, this unified `type` column on a single `portals` table is the post-MVP App Designer schema. MVP uses separate `portals` and `forms` tables with `record_view_config_id`. |
| `layout_config` | JSONB (nullable) | Type-specific layout settings. For `type='document'`: page size, orientation, margins, header/footer heights. See `document-designer.md`. |
| `access_mode` | VARCHAR | `'public'`, `'link_protected'`, `'authenticated'`. Not applicable for `type='document'`. |
| `auth_method` | VARCHAR (nullable) | `'password'`, `'magic_link'`. Set when `access_mode = 'authenticated'` |
| `secret_token` | VARCHAR(64) (nullable) | Set when `access_mode = 'link_protected'`. Generated via `crypto.randomBytes(32).toString('base64url')` |
| `custom_domain` | VARCHAR (nullable) | e.g., `portal.clientcompany.com` |
| `theme` | JSONB | Colors, typography, logo URL, custom CSS (see Theme System) |
| `navigation` | JSONB | Nav structure — page order, grouping, icons |
| `scoping_config` | JSONB | `PortalScopingConfig` — which field on each table identifies the client (see Record Scoping) |
| `seo_defaults` | JSONB | `{ title, description, ogImage, noIndex }` — portal-level defaults |
| `favicon_url` | VARCHAR (nullable) | |
| `publish_state` | VARCHAR | `'live'` or `'draft'` — authoring workflow (see data-model.md environment note) |
| `version` | INTEGER | Incremented on publish |
| `published_at` | TIMESTAMPTZ (nullable) | |
| `created_by` | UUID | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Indexes:** `(tenant_id, environment)`, `UNIQUE (slug)`.

### `app_pages` Table (Post-MVP — per GLOSSARY.md DB Entity Reference)

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `app_id` | UUID | FK to apps |
| `tenant_id` | UUID | |
| `slug` | VARCHAR | Page URL slug |
| `name` | VARCHAR | Display name |
| `page_type` | VARCHAR | `'dashboard'`, `'list'`, `'detail'`, `'form'`, `'custom'` |
| `context_table_id` | UUID (nullable) | Primary table this page displays data from |
| `layout_config` | JSONB | Page-level layout settings |
| `seo` | JSONB (nullable) | Per-page SEO overrides (title, description, og:image, robots) |
| `sort_order` | INTEGER | Order in navigation |
| `publish_state` | VARCHAR | `'live'` or `'draft'` — authoring workflow (see data-model.md environment note) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Indexes:** `(app_id, environment)`, `UNIQUE (app_id, slug, environment)`.

### `app_blocks` Table (Post-MVP — per GLOSSARY.md DB Entity Reference)

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `page_id` | UUID | FK to app_pages |
| `parent_block_id` | UUID (nullable) | FK to app_blocks (tree structure) |
| `tenant_id` | UUID | |
| `block_type` | VARCHAR | Block type from Block Categories |
| `config` | JSONB | Block-specific content config (field selection, display format, sort, filters, grouping, colors, etc.) |
| `data_binding` | JSONB | `BlockDataBinding` — see Data Binding Modes |
| `style_overrides` | JSONB (nullable) | Theme overrides for this block |
| `visibility_rules` | JSONB (nullable) | Conditional show/hide logic |
| `grid_position` | JSONB | `{ colStart, colSpan, rowOrder }` — position on 12-column grid |
| `responsive` | JSONB (nullable) | Per-breakpoint overrides (column span, visibility) |
| `sort_order` | INTEGER | Order among siblings |
| `publish_state` | VARCHAR | `'live'` or `'draft'` — authoring workflow (see data-model.md environment note) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Indexes:** `(page_id, environment)`, `(parent_block_id)`.

### `portal_clients` Table

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Workspace that owns this portal |
| `portal_id` | UUID | FK to `portals` (MVP Quick Portals) or `apps` (post-MVP App Designer portals) — client belongs to one portal/app |
| `email` | VARCHAR | Client's email address (PII — registered in compliance registry) |
| `display_name` | VARCHAR (nullable) | Name shown in portal UI and activity feeds |
| `avatar_url` | VARCHAR (nullable) | Optional avatar |
| `auth_hash` | VARCHAR (nullable) | bcrypt hash. Set when portal uses password auth. NULL for magic-link-only portals |
| `linked_record_id` | UUID | FK to the client's record in the CRM/contacts table. Used for record_scope resolution |
| `status` | VARCHAR | `'invited'`, `'active'`, `'suspended'`, `'deleted'` |
| `metadata` | JSONB (nullable) | Custom key-value data (e.g., `{ company: "Acme Corp", region: "West" }`) |
| `last_login_at` | TIMESTAMPTZ (nullable) | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Indexes:** `(tenant_id, portal_id)`, `UNIQUE (portal_id, email)`.

**`linked_record_id` is the key field.** It connects the portal client to their identity record in the CRM/contacts table. The portal's `scoping_config` defines which field on each data table to match against this record. All record scoping flows from this link.

**Multi-portal access:** The same email can exist as a client on multiple portals (unique constraint is per-portal). Each has its own `linked_record_id`, auth credentials, and session. A person who is a client on Portal A and Portal B has two `portal_clients` rows.

**Converting a Quick Portal to an App Portal:** When a Manager upgrades a Quick Portal to an App Portal, each `portal_access` row becomes a `portal_clients` row. The `portal_access.record_id` becomes `linked_record_id` if it points to a CRM/contacts record. If the source record is not a CRM contact (e.g., a project record), the upgrade wizard prompts the Manager to select the identity table and map each client to a contact. Existing `portal_sessions` rows are updated: `auth_type` changes from `'quick'` to `'app'` and `auth_id` is remapped to the new `portal_clients.id`. Quick Portals and App Portals coexist permanently — conversion is optional, not inevitable.

### `portal_sessions` Table

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Session ID (stored in httpOnly cookie) |
| `auth_type` | VARCHAR | `'quick'` (Quick Portal → portal_access) or `'app'` (App Portal → portal_clients) |
| `auth_id` | UUID | Polymorphic FK: → portal_access.id when auth_type='quick', → portal_clients.id when auth_type='app' |
| `portal_id` | UUID | Which portal/app this session is for |
| `tenant_id` | UUID | |
| `created_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | 30 days from creation |
| `revoked_at` | TIMESTAMPTZ (nullable) | Set when manually revoked by Manager |

**Indexes:** `(auth_type, auth_id)`, `(portal_id)`. Shared by both Quick Portals and App Portals — see `data-model.md` for canonical schema.

### `portal_magic_links` Table

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | |
| `portal_client_id` | UUID | |
| `token` | VARCHAR(64) | Random token sent in magic link |
| `portal_id` | UUID | Scoped to one portal |
| `tenant_id` | UUID | |
| `expires_at` | TIMESTAMPTZ | 15 minutes from creation |
| `used_at` | TIMESTAMPTZ (nullable) | Set on first use (single-use) |

---

## Client Management

### Clients Tab (Portal Admin Panel)

List of `portal_clients` for this portal. Columns: display name, email, status, last login, linked CRM record. Actions: Invite, Suspend, Delete.

**Invite flow:**
1. Manager enters client email + optional display name
2. Manager selects which CRM record this client is linked to (autocomplete search on identity table)
3. System creates `portal_clients` row with `status='invited'` and `linked_record_id`
4. System sends invitation email via Resend:
   - Password portals: "Click here to set your password and access [Portal Name]"
   - Magic link portals: "Click here to access [Portal Name]" (creates session directly)
5. Client clicks link → sets password (if applicable) → lands on portal homepage with scoped data
6. Status updates to `'active'` on first successful login

**Auto-creation during setup:** When the portal creation wizard detects email addresses via the scoping field, it offers to bulk-create client accounts. Each client gets an invitation email. Clients without a resolvable email require manual invitation.

**Bulk import:** Managers can upload a CSV of client emails. System matches each email to a CRM record via the identity table's email field. Matched clients get auto-created with `linked_record_id` set. Unmatched emails are flagged for manual linking.

### Access Tab

Authentication method selector (magic link or email+password), session timeout override (default 30 days), custom login page message, "Allow new clients to request access" toggle (sends notification to Manager for approval).

### Domain Tab

Default URL shown. Custom domain setup with CNAME instructions (Professional+ plans). See Custom Domain Architecture.

### Notifications Tab

Manager notification triggers — form submission, payment received, comment posted, approval given. Configurable per portal.

---

## Portal Write-Back Flow (Form Submissions)

Portal clients can create or edit records when the block's permissions allow it (set in the Logic tab). This is the primary mechanism for external data collection — client intake forms, status updates, feedback submission.

### Form Submission → Record Creation

```
1. Portal client fills out a form block on a Form page
2. Client clicks "Submit"
3. Server Action receives form data + portal client context (from x-portal-client-id header)
4. Validation pipeline:
   a. Verify portal client has active session
   b. Verify the block's permissions allow creation (submittable = true)
   c. Validate submitted fields against the block's configured field list (only fields on the form)
   d. Validate field values via Zod schemas (same as internal record creation)
   e. Reject any fields not configured on the form — silent drop, no error to client
5. Create record in records table:
   - tenant_id: from portal's tenant
   - table_id: from block's data binding
   - canonical_data: only configured fields, validated values
   - Set the scoping field to the client's linked_record_id (auto-populated)
   - created_by: NULL (portal clients are not workspace users)
6. Post-creation:
   - Write audit log: actor_type='portal_client', actor_id=portalClientId
   - Update search_vector for the new record
   - Emit record.created domain event (may trigger automations)
   - Invalidate portal cache for pages bound to this table
```

**Auto-populating the scoping field:** When a portal client creates a record via a form, the scoping field (e.g., "Client") is automatically set to the client's `linked_record_id`. The client doesn't need to select themselves — the system knows who they are. This field can be hidden from the form.

### Portal Edit Flow

```
1. Portal client clicks "Edit" on a record visible within their record_scope
2. Editable fields pre-populated (only fields the block exposes as editable)
3. Client submits changes
4. Server Action:
   a. Verify portal client session
   b. Verify block allows editing
   c. Verify the record is within client's record_scope (re-evaluate at query time)
   d. Validate only exposed fields are being changed
   e. Update record.canonical_data with new values
   f. Audit: actor_type='portal_client', action='record.updated'
```

### Security Invariant

Portal write operations are **always scoped**. Even if a malicious client crafts a request with a record ID outside their `record_scope`, the Server Action re-evaluates the scoping filter against the target record before allowing the mutation. If the record doesn't pass the filter, the request is rejected with `PORTAL_ACCESS_DENIED`.

**No delete via portal.** Portal clients cannot delete records. Deletion requires workspace membership. If a "remove" action is needed, Managers configure a status field (e.g., "Cancelled") that the portal client can set, with an automation that handles the actual deletion or archival.

---

## Portal Analytics (Post-MVP)

### Overview Dashboard

Total/active clients, page views (30d), unique sessions, most viewed pages, most used forms, recent activity feed. Timeframe selector: 7d / 30d / 90d / all time.

### Client Activity View

Table of all portal clients with columns: name, email, last login, total sessions, page views, forms submitted, payments made. Click row for full activity timeline.

### Per-Page Analytics

View count, average time on page, interaction counts as overlay badges in designer page tree.

### Data Model

`portal_events` table storing `event_type` (page_view, form_submit, button_click, payment, login, file_download), `client_id`, `page_id`, `block_id` (nullable), `metadata` JSONB, `timestamp`. Raw events: 90-day retention. Daily aggregates: indefinite.

---

## Stripe Payment Integration (Post-MVP)

Payment blocks use Stripe Elements (card data never touches EveryStack). On successful payment, Stripe fires `payment_intent.succeeded` webhook. EveryStack matches to portal, record, and client, then fires the automation trigger.

**Payment block "On successful payment" config (auto-suggested):** Update status field to "Paid". Store Stripe receipt URL in a URL field (creates field if needed). Store payment date/amount. Notify Manager toggle. Send client receipt toggle (emails Stripe hosted receipt link). Optional automation picker for complex flows.

---

## Rendering Modes (Post-MVP — App Designer)

- **Design Mode:** Grid lines visible, blocks draggable/resizable, property panel on click, sample data.
- **Preview Mode:** Full rendering with real data. Top banner with client picker for testing `record_scope` filtering per specific portal_client. Draft environment banner.
- **Live Mode:** What clients see. No grid, no editing chrome. Draft-to-live publishing — edits continue in draft; live unchanged until explicit publish.

---

## Preview and Publish Flow (Post-MVP — App Designer)

**Preview:** Canvas switches to live rendering. Grid lines and builder chrome hidden. Top banner: "Preview Mode — viewing as: [client picker dropdown] | Back to Editor." Client picker tests `record_scope` filtering per specific portal_client.

**Publish button** opens a modal with:
1. **Diff summary** showing changes since last publish
2. **Pre-publish Smart Setup** — system scans portal blocks and auto-suggests needed automations as toggles
3. **Client access** section with existing clients and invite button
4. **Publish** button promotes draft to live with URL shown and copy button

### Pre-Publish Smart Setup Suggestions

| Block Type | Auto-Suggested Automations |
|---|---|
| Payment block | Update status to "Paid", store receipt URL, email receipt |
| Form page | Notify Manager on submission, send client confirmation |
| Comment Thread | Notify on client/Manager comments |
| Approval block | Notify on approval/revision, update status |
| Scheduling block | Send calendar invite, send reminder |
| Always | Create Portal Access Link field for magic links, send invitation emails |

Each enabled toggle creates an `automation_definition` on publish.

---

## Caching Infrastructure (Three-Tier)

Portal pages are read-heavy and client-facing — caching is critical for performance and cost.

### Tier 1: CDN Edge Cache

- Public portal pages: `Cache-Control: public, max-age=3600, s-maxage=3600`
- Link-protected pages: cached with token as part of cache key
- Authenticated pages: `Cache-Control: private, no-store` (never cached at CDN)
- Surrogate-Key headers for targeted purging (e.g., `portal:{portalId} page:{pageId} table:{tableId}`)

### Tier 2: Redis Application Cache

- Portal page data cached in Redis: `cache:portal:{portalId}:{pageId}:{clientId}`
- TTLs by content type:
  - Static content (theme, nav, text blocks): 300s
  - Data-bound blocks (lists, charts): 60s
  - Real-time blocks (comments, approvals): 10s
- Authenticated content keyed by `clientId` (different clients see different data)

### Tier 3: Postgres Fallback

- Cache miss → query Postgres with `record_scope` filters applied
- Always correct, just slower

### Cache Invalidation

Event-driven: when a record is mutated, the system:
1. Looks up which portals reference that record's table (via `scoping_config`)
2. Purges Redis keys for affected portal pages
3. Issues CDN surrogate-key purge for public pages

Redis TTL for authenticated content: 60 seconds (shorter than public pages because `record_scope` filtering means different clients may see different data as underlying records change).

---

## Portal Client Limits

Portal clients are **unlimited on all plans** (pricing: "Unlimited Team Members, Viewers, and portal clients at every tier"). The constraint is on the number of portals:

| Plan | Max Portals | Portal Clients | Portal Page Views/month |
|------|-------------|----------------|------------------------|
| Freelancer | 1 | Unlimited | 10,000 |
| Starter | 5 | Unlimited | 50,000 |
| Professional | 15 | Unlimited | 250,000 |
| Business | Unlimited | Unlimited | 1,000,000 |
| Enterprise | Unlimited | Unlimited | Custom |

**Page view tracking:** Redis counter per portal per month: `portal:views:{portalId}:{YYYY-MM}`, TTL 35 days. Incremented on every non-cached portal page request (CDN cache hits don't count). When limit reached: portal continues serving but a banner appears in the Manager's portal admin panel ("Approaching page view limit — upgrade to avoid throttling"). At 120% of limit: new requests receive a "This portal is temporarily unavailable" static page. No data loss — the portal is throttled, not deleted.

---

## Automation Integration

Portal events drive automations via dedicated triggers and actions:

**Triggers:**
- Form Submitted — portal form submission with portal/client/form context
- Client Portal Action — sub-types: payment received/failed, approval given, comment posted, appointment booked, file uploaded/downloaded, client logged in

**Actions:**
- Post to Portal — notification, cache refresh, page toggle
- Create Report — render portal report page to PDF with time period filter

---

## Audit Trail for Portal Actions

Portal clients are a distinct `actor_type` in the audit system (see `audit-log.md`):

```typescript
await writeAuditLog(tx, {
  tenantId,
  actorType: 'portal_client',
  actorId: portalClientId,
  action: 'record.created',
  entityType: 'record',
  entityId: newRecord.id,
  details: { portalId, pageId, blockId, formData: sanitizedFormData },
  traceId,
  ipAddress: req.headers.get('x-forwarded-for'),
});
```

**Display in Activity tab:** Portal client actions show as "Jane Smith (portal client) created this record via Client Dashboard." Distinguished from internal users by the `portal_client` actor type and badge.

**Portal activity log:** Managers can view all portal client activity from the Portal Admin panel.

---

## Session Cleanup

Background job cleans expired sessions and stale magic links:

```typescript
// Worker job: portal-session-cleanup (runs daily at 03:00 UTC)
// BullMQ repeatable job
async function cleanupExpiredPortalSessions() {
  // Expired sessions
  await db.delete(portalSessions)
    .where(or(
      lt(portalSessions.expiresAt, new Date()),
      lt(portalSessions.revokedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    ));

  // Stale magic links (well past 15-minute expiry)
  await db.delete(portalMagicLinks)
    .where(lt(portalMagicLinks.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}
```

---

## Custom Domain Architecture (Specced — Build Post-MVP — Portals & Apps (Fast-Follow))

Portals default to `portal.everystack.app/{portalSlug}`. Custom domains let clients access portals at `clients.youragency.com`.

**DNS & SSL:**
- Customer adds CNAME record: `clients.youragency.com → portals.everystack.com`
- SSL provisioned automatically via Let's Encrypt (Caddy or cert-manager). Free, auto-renewing.
- Routing layer resolves incoming hostname → tenant + portal. Mapping cached in Redis.

**Setup Flow:** Portal Settings > Domain tab → enter domain → show CNAME instructions with copy button → "Verify" button polls DNS → once resolved, provision SSL cert → green checkmark + "Active" status.

**URL Resolution (designed for custom domains from day one):**
1. Incoming request hostname → lookup `app_domains` → resolve app
2. If no match → parse path `/portal/{portalSlug}` → resolve by slug + tenant

**Data Model:**

| Table | Columns |
|-------|---------|
| `app_domains` | `id`, `tenant_id`, `app_id` (FK → apps), `domain` (unique), `status` (pending / verified / active / error), `ssl_expires_at`, `verified_at`, `created_at` |

---

## Mobile Portal Experience — PWA with Offline (Post-MVP)

> **⚠️ POST-MVP.** PWA with offline capability is post-MVP App Designer functionality. MVP portals are responsive web pages without PWA features.

**Core insight:** Many portal users are mobile-primary (field service, property management, delivery). Connectivity is often unreliable. Portals must work offline.

### Tiered Offline Strategy

**Tier 1 — Cached Reads (Post-MVP — Portals & Apps (Initial)):**
- Service worker caches portal pages, record data, and documents the user has viewed
- Stale-while-revalidate pattern: show cached content immediately, refresh in background when connected

**Tier 2 — Queued Writes (Post-MVP — Portals & Apps (Initial)):**
- When offline, form submissions, status updates, time entries, approvals, and comments enter an IndexedDB queue
- **Sync indicator** in portal header: green dot = online, amber dot = N queued changes, red dot = offline
- When connectivity returns, queue replays in order
- Conflict detection on sync: last-write-wins with toast notification if server state changed

**Tier 3 — Smart Pre-Caching (Post-MVP — Portals & Apps (Fast-Follow)):**
- "Going offline? Tap to cache today's jobs" prompt
- Background sync when connection quality is good

### Home Screen Install
- `manifest.json` generated per portal: portal name, logo, theme colors
- "Add to Home Screen" prompt after 2nd portal visit
- Launches in standalone mode (no browser chrome)

---

## Portal SEO — Basic Meta Tags (Post-MVP)

Most portals are authenticated — SEO irrelevant for those. Public portal pages get basic meta tags.

**Per-page configuration** in App Designer property panel (page-level settings):
- `<title>` — defaults to portal name + page name
- `<meta name="description">` — defaults to portal description
- `og:title`, `og:description`, `og:image` — for link sharing
- `robots` — `index,follow` for public pages, `noindex,nofollow` for authenticated pages (automatic)

**Implementation:** Server renders meta tags on initial page load via HTML template injection (not full SSR).

---

## Embeddable External Forms

> **MVP/Post-MVP note:** Basic form embedding (script tag, iframe) for Quick Forms is MVP per `GLOSSARY.md` (Forms: "Standalone URL, embeddable via script tag or iframe"). The advanced form features described here (configurable field mapping, rate limiting configuration) extend into post-MVP App Designer App Forms.

Portal form pages can be embedded externally for lead capture on external websites.

### Embed Options

- **Script tag:** `<script src="https://forms.everystack.app/embed/{form_id}.js"></script>` — renders inline form on any page.
- **Iframe:** `<iframe src="https://forms.everystack.app/f/{form_id}"></iframe>` — sandboxed.
- Both generate a unique form URL with sharing token.

### Submission Behavior

- Creates records in a target table. Configurable field mapping.
- **No authentication required** (lead capture, intake, public submissions).
- **Spam protection:** Cloudflare Turnstile (free, privacy-respecting). Not Google reCAPTCHA.
- **Success actions (configurable):** Thank you message, redirect URL, or show submitted data summary.
- **Rate limiting:** Max 10 submissions per IP per minute. Configurable per form.

### Notifications

- Automation trigger "Form Submitted" available.
- Confirmation email to submitter (optional, requires email field in form).

---

## GDPR for Portal Clients

Portal clients are external individuals with PII (email, name). GDPR applies:

| Right | Implementation |
|-------|----------------|
| **Access** | Portal client can request a data export from portal settings page (exports their profile + all records visible via their `record_scope`) |
| **Erasure** | Manager can delete a portal client. Triggers: delete `portal_client` record, delete all `portal_sessions`, delete all `portal_magic_links`. Records visible via `record_scope` are NOT deleted (they belong to the workspace). |
| **Rectification** | Portal client can update their display_name and email from portal settings. Email change triggers re-verification. |
| **Portability** | Data export in JSON format from portal settings. |

Portal client emails are registered in the PII compliance registry (`packages/shared/compliance/`). Portal client deletion is separate from workspace user deletion.

---

## Booking/Scheduling System (Post-MVP)

> **⚠️ POST-MVP.** Booking/Scheduling is post-MVP per `GLOSSARY.md` MVP Excludes.

See `booking-scheduling.md` for the full specification. Covers: Calendar View architecture, bookable tables, computed availability engine, Scheduler portal block, public booking pages, event types (one-on-one, group, round-robin, collective), buffer time / meeting limits / minimum notice, confirmation & reminder flows, self-service rescheduling & cancellation, routing & pre-booking qualification, no-show detection, video conferencing integration, meeting polls, single-use links, managed booking templates, scheduling analytics, and Quick Setup Wizard.

---

## Multi-Language Portal Content (Designed — Build Deferred)

Portal block `config` JSONB fields that contain user-visible text will support locale-keyed values in the future:
```
// Post-MVP — Portals & Apps (Initial): plain string
config.label = "Submit Payment"

// Future: locale-keyed object
config.label = { en: "Submit Payment", es: "Enviar Pago", default: "en" }
```

**Resolution:** All portal content renderers use `resolveContent(value, locale)` from day one. Currently returns the plain string.

---

## MVP Feature Split

> **⚠️ GLOSSARY RECONCILIATION NOTE:** Per `GLOSSARY.md`, the App Designer (visual page builder) is **post-MVP entirely**. MVP portals are simple Record View + auth wrappers; MVP forms are Record View layouts for record creation. The phases below describe the App Designer's own internal phasing — both Post-MVP — Portals & Apps (Initial) and 4b are **post-MVP** relative to the platform MVP defined in the glossary. The MVP portal and form features described in the glossary use the Record View layout engine, not the App Designer.

**Post-MVP — Portals & Apps (Initial) (post-MVP — App Designer initial release):** Standalone `apps` table and schema. Portal creation wizard (base → table → scoping field → theme). Template-first creation flow. Core container model (Row, Column, Card, Tabs). Data binding (context-bound and relationship-bound). All display config in App Designer (filters, sort, fields, grouping, colors on each block). 20-theme gallery. Property panel (Content and Style tabs). Publish flow with client management. Auth (password + magic link, Manager's choice). Identity-based record scoping. Portal write-back (forms). Session management and cleanup job. PWA with offline Tier 1+2. Basic meta tags per page. Embeddable external forms with Turnstile. Page view tracking and throttling. Audit logging with `portal_client` actor type. Three-tier caching.

**Post-MVP — Portals & Apps (Fast-Follow) (post-MVP — App Designer fast-follow):** Logic tab. Grid Container. Query-bound data binding mode. Portal analytics dashboard. Stripe payment integration. AI-generated apps. Custom domain support. Booking/scheduling system. Smart pre-caching (offline Tier 3). Both auth methods on same login page.

---

## Phase Implementation Summary (App Designer — Post-MVP)

> **⚠️ POST-MVP.** All phases below describe the App Designer's internal phasing — all are post-MVP relative to the platform MVP defined in `GLOSSARY.md`.

| Phase | App Designer Work |
|-------|------------|
| Post-MVP — Portals & Apps (Initial) | `apps`, `app_pages`, `app_blocks`, `portal_clients`, `portal_magic_links`, `portal_events` tables. `portal_sessions` updated with polymorphic auth (already exists from MVP). App Portal creation wizard with identity-based scoping setup. Designer (4-zone layout, block library, canvas, property panel Content+Style tabs). Three access modes. Password + magic link auth. Record scoping via `linked_record_id` + `scoping_config`. Write-back flow. Session middleware. Rate limiting. Three-tier caching. PWA Tier 1+2. Embeddable forms. Page view tracking. Audit logging. GDPR endpoints. Optional Quick Portal → App Portal conversion wizard. |
| Post-MVP — Portals & Apps (Fast-Follow) | Logic tab. Grid Container. Query-bound binding. Analytics dashboard. Stripe integration. AI-generated apps. Custom domains. Booking/scheduling. Offline Tier 3. |
| Post-MVP — Automations | Automation triggers: Form Submitted, Client Portal Action (payment, approval, comment, etc.). Automation actions: Post to Portal, Create Report. Auto-create portal client accounts on CRM record creation. |
