# EveryStack — Document Designer (App Type — Post-MVP)

> **Reconciliation Note (2026-02-27):** Aligned with GLOSSARY.md (source of truth).
> **Changes made:**
> - **Renamed "Interface Designer" → "App Designer"** throughout per glossary Naming Discipline table ("Interface Designer" → App Designer; "Interface types" → App types)
> - **Renamed "interface type" → "App type"** and "interface" (as designer output) → "App" throughout
> - **Renamed "Interfaces Page" → Apps page**, "Create Interface" → "Create App", "interface card" → "App card"
> - **Marked entire doc as post-MVP.** Glossary MVP Scope Summary explicitly lists "Document interface type (App Designer canvas → PDF)" under "MVP Explicitly Excludes." MVP document generation uses **Document Templates** — simple merge-tag rich text editor → PDF via Gotenberg — stored in the `document_templates` DB table. See GLOSSARY.md § Definitions — Documents.
> - **Updated DB references:** Old doc used `portals.type = 'document'` and `portal_blocks`. Glossary mandates split: MVP uses `portals` (simple record-sharing), `forms` (record-creation), `document_templates` (merge-tag templates). Post-MVP App Designer outputs use `apps` / `app_pages` / `app_blocks` tables. Updated Data Model section accordingly.
> - **Added "Path 0: Document Templates (MVP)"** to "Relationship to Other Document Paths" section to clarify the MVP baseline this post-MVP spec upgrades from.
> - **Updated cross-references** to use glossary terms (App Designer, App, App type, Cross-Link)
> - **Retained all post-MVP content** — labeled clearly rather than deleted.

---

> **Reference doc (Tier 3). ⚠️ This entire spec is post-MVP.** The Document Designer is a rendering mode of the App Designer that produces fixed-layout document templates — invoices, contracts, proposals, SOWs, receipts, letters, reports, certificates. Instead of responsive web pages, it renders to fixed page sizes (US Letter, A4, etc.) and outputs PDF or DOCX via Gotenberg. The same block model, theme system, data binding, and property panel from the App Designer apply — the differences are canvas behavior, page chrome, and output target.
>
> **MVP vs. Post-MVP:** For MVP, document generation uses **Document Templates** — a simpler path with a rich text editor (TipTap), merge tags, PDF output via Gotenberg, an AI Draft option, and saved templates per table. Document Templates are stored in the `document_templates` DB table and triggered via a "Generate Document" button on Record View. See GLOSSARY.md § Definitions — Documents. The Document App type described in this spec is the **post-MVP upgrade path** that adds spatial layout (12-column grid canvas), header/footer zones, DOCX output, and full design control via the App Designer.
>
> The Document App type is stored in the post-MVP `apps` table with `type='document'`. (Note: the previous version of this doc referenced a `portals.type` enum — the glossary mandates separate tables: MVP `portals` for record-sharing, MVP `forms` for record-creation, post-MVP `apps` for App Designer outputs.)
>
> Cross-references: `app-designer.md` (shared designer architecture, block model, themes, data binding, property panel), `smart-docs.md` (TipTap editor — Rich Text blocks in Document Apps use TipTap Environment 2 with merge tag extension; Smart Doc wiki view remains for knowledge bases; template mode subsumed by Document App type), `automations.md` (Generate Document action, triggers), `data-model.md` (schema — post-MVP `apps` table with `type='document'`, `template_definitions`, `generated_documents`), `compliance.md` (Gotenberg sandboxing for PDF generation), `chart-blocks.md` (Chart blocks render as static images in PDF output via Gotenberg), `custom-apps.md` (receipt/invoice generation via Document templates on Cart transaction completion — replaces Smart Doc template path)
> Last updated: 2026-02-27 — Glossary reconciliation.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Design Philosophy | 51–62 | Fixed-page canvas, PDF-first, merge tags over code |
| Progressive Disclosure Mapping | 63–74 | 3-level disclosure for document creation |
| App Creation — Entry Points | 75–105 | Document app creation from workspace, table, template |
| Document Creation Wizard | 106–144 | Step-by-step wizard for new document apps |
| Canvas Behavior (Fixed-Size Page) | 145–217 | A4/Letter/Legal canvas, page breaks, margins, rulers |
| Block Model — Document-Specific Additions | 218–252 | Page break, header/footer, merge tag, table blocks |
| Data Binding | 253–287 | Merge tag resolution, linked record traversal, image binding |
| Render Pipeline | 288–345 | TipTap → HTML → Gotenberg → PDF/DOCX output |
| Automation Integration — "Set Up Automation" Wizard | 346–414 | Auto-generate on record change, batch generation |
| Preview and Publish | 415–437 | Preview rendering, template versioning, publish flow |
| Relationship to Other Document Paths | 438–485 | How Document Designer relates to Smart Docs and merge tags |
| Homegrown DOCX Template Engine | 486–520 | Custom DOCX engine (no Docxtemplater), template compilation |
| Data Model | 521–577 | document_templates enhancements, generated_documents table |
| Page Sizes Reference | 578–591 | Standard page dimensions and margins |
| Phase Implementation | 592–629 | Post-MVP delivery scope |

---

## Design Philosophy

> **⚠️ Post-MVP.** This section describes the Document App type built in the App Designer. MVP document generation uses Document Templates (rich text editor + merge tags → PDF). See GLOSSARY.md § Definitions — Documents.

**The App Designer is the document designer.** There is no separate tool. A document is an App type — same designer, same block model, same themes, same property panel. The only differences are: the canvas is a fixed physical page (not responsive), Rich Text blocks support merge tags, the output is PDF/DOCX (not a web page), and header/footer zones repeat on every page.

This means a Manager who has learned to build a client portal App already knows how to build an invoice. One tool, one learning curve, multiple App types.

**Documents are templates, not one-offs.** A Document App is a reusable template bound to a table. "Generate Invoice" produces a PDF for a specific record using the template's layout and that record's data. Batch generation (all unpaid invoices) is handled at the automation layer.

---

## Progressive Disclosure Mapping

> **⚠️ Post-MVP.** Progressive disclosure for Document Apps in the App Designer.

| Level | User Experience | What's Visible |
|---|---|---|
| **L1 (80%)** | Choose a template card ("Invoice", "Contract", etc.), pick a table, select a theme, and get a working document with pre-placed blocks. Edit by selecting blocks and changing fields in the property panel. Set up a quick automation with one click. | Template gallery, 3-step wizard, canvas with pre-placed blocks, Content tab in property panel, page size selector, "Set Up Automation" button. |
| **L2 (15%)** | Add blocks from the library, configure data binding, add Rich Text blocks with merge tag placeholders, insert manual page breaks, configure header/footer content, adjust styling, multi-page document design. | Block library sidebar, Layers tree mode, merge tag field picker, page break blocks, header/footer zones, Style tab overrides. |
| **L3 (5%)** | Query-bound data binding across multiple tables, conditional visibility rules on blocks, AI content injection, complex automation flows with multi-step document generation. | Query builder in data binding, Logic tab, AI content blocks, full automation builder integration. |

---

## App Creation — Entry Points

> **⚠️ Post-MVP.** These entry points are for creating Document Apps in the App Designer.

### From the Apps Page (Workspace Level)

`[+ New App]` → type selection step → "Create a Document" card.

| Card Label | Description | Resolves To |
|---|---|---|
| **Create a Document** | "Design a document template — invoices, contracts, proposals, and more" | Document App |

After selecting the card, the Manager chooses: **From Scratch** or from the **Template Gallery**.

### From a Table (Contextual Shortcut)

Table tab menu dropdown → **Create App** → sub-options by App type. Selecting "Document" enters the creation wizard with the table pre-selected.

When creating from a specific table context:
1. The wizard's "Connect to Data" step pre-selects that table (editable)
2. The designer field picker defaults to showing that table's fields at the top
3. Any block dropped on the canvas inherits context-bound data binding to that table

### Table-Level App Visibility

Managers viewing a table grid see existing Apps rooted in that table. By default, the list shows Apps where this table is the **primary context table** (set during creation). Apps that reference this table secondarily (via relationship-bound or query-bound blocks on other tables) appear in a lighter treatment. Each App card shows a type badge (Portal, Form, Document, Internal App, Widget) for quick identification.

The workspace-level Apps page remains the canonical home for all Apps across all types and tables.

---

## Document Creation Wizard

> **⚠️ Post-MVP.** This wizard is for creating Document Apps in the App Designer. MVP document generation uses Document Templates created via a simpler flow — see GLOSSARY.md § Definitions — Documents.

### Step 1: Choose a Starting Point

**Template Gallery** — curated document template cards:

| Template | Description | Pre-built Blocks |
|---|---|---|
| **Invoice** | Standard invoice with company header, bill-to, line items, totals | Header with logo + company info, bill-to/ship-to Row, line items Table/List, totals section, payment terms Rich Text |
| **Proposal / Quote** | Client proposal with scope, pricing, terms | Header, client info, scope Rich Text with merge tags, pricing table, terms and conditions |
| **Contract** | Agreement with signature blocks | Header, parties section, terms Rich Text, signature blocks, date fields |
| **Statement of Work** | Detailed deliverables with timeline | Header, project overview, deliverables table, timeline, payment schedule |
| **Receipt** | Transaction confirmation | Header with logo, transaction details, line items, total, payment method |
| **Letter / Letterhead** | Branded business letter | Letterhead header/footer, date, recipient address, body Rich Text |
| **Report** | Data summary with charts | Header, executive summary Rich Text, data tables, chart blocks, footer |
| **Certificate** | Award or completion certificate (landscape default) | Decorative border, title, recipient name, description, signature, date |
| **Start from Scratch** | Empty canvas with page chrome only | Header zone, footer zone, empty body |

### Step 2: Connect to Data

1. **Pick a table.** Table picker showing all tables across all bases. Pre-selected if entering from a table context.
2. **Field preview.** Shows available fields from the selected table, grouped by type. Confirms the data source makes sense for the chosen template.

For Document Apps, there is no scoping field (unlike Portals). Documents render for a single record at a time; which records to generate for is determined at the automation/action layer.

### Step 3: Name, Theme, and Page Setup

- **Document name** (e.g., "Client Invoice", "Project Proposal")
- **Page size selector:** US Letter (8.5 × 11"), A4 (210 × 297mm), US Legal (8.5 × 14"), A3 (297 × 420mm), A5 (148 × 210mm)
- **Orientation:** Portrait or Landscape
- **Margins:** Preset options (Normal, Narrow, Wide) or custom (top/bottom/left/right in inches or mm)
- **Theme gallery** — same 20 curated themes as other App types

Hit **Create** → land directly in designer with template pre-built and themed.

---

## Canvas Behavior (Fixed-Size Page)

> **⚠️ Post-MVP.** Canvas behavior for the Document App type in the App Designer.

The Document designer canvas differs from the standard App Designer canvas in key ways:

### Page Simulation

The canvas renders a physical page on a neutral background (`#E2E0DC`), similar to Google Docs or Word. The page has defined dimensions based on the selected page size and orientation, rendered with a subtle drop shadow. The Manager designs within the page boundaries.

### Page Size Selector (Replaces Viewport Toggle)

The standard App Designer viewport toggle (Desktop / Tablet / Mobile) is replaced with:
- **Page size selector** — dropdown with available sizes (US Letter, A4, Legal, A3, A5)
- **Orientation toggle** — Portrait / Landscape
- **Zoom control** — 50% / 75% / 100% / 125% / 150% / Fit to Width

There are no responsive breakpoints. Documents have a single fixed layout for their selected page size.

### Multi-Page Design

Documents support multiple pages via a **hybrid scrolling + page break** model:

- The canvas is a single continuous scrolling surface with visible page boundaries (dashed horizontal lines showing where pages break)
- **Page Break block** — a special block type in the Layout category that forces content to the next page. Renders as a visible dashed line with "Page Break" label in design mode, invisible in output
- **Automatic overflow** — when content exceeds a page, it flows to the next page naturally. Gotenberg handles this at render time
- **Table/List blocks** that exceed the page continue onto the next page with **column headers repeated** on each new page (Google Docs behavior). No max-row limit
- **Page counter** in the toolbar shows current page count based on content length

The Manager designs on a continuous canvas without manually managing page boundaries for most cases. Manual Page Break blocks are available for explicit control (e.g., "terms and conditions always start on a new page").

### Header and Footer Zones

**Dedicated header and footer zones** appear above and below the main canvas area, visually separated by a distinct background tint and a subtle border:

```
┌─ Header Zone ──────────────────────────────────┐
│  (Repeats on every page)                        │
│  Logo, company name, document title, page #     │
├─────────────────────────────────────────────────┤
│                                                  │
│  Main Canvas (Body)                              │
│  12-column grid, all standard blocks             │
│                                                  │
│ · · · · · · Page Break · · · · · · · · · · · ·  │
│                                                  │
│  (continues...)                                  │
│                                                  │
├─────────────────────────────────────────────────┤
│  Footer Zone                                     │
│  (Repeats on every page)                         │
│  Page numbers, legal text, website URL           │
└─────────────────────────────────────────────────┘
```

**Header zone behavior:**
- Fixed height (configurable, default 80px)
- Supports the same blocks as the main canvas: Rich Text, Field Display, Image, Row/Column containers
- Repeats identically on every rendered page
- Merge tags work in headers (e.g., `{client_name}` in the header)
- Typical content: company logo, company name/address, document title, document number field

**Footer zone behavior:**
- Fixed height (configurable, default 48px)
- Same block support as header
- Repeats identically on every rendered page
- **Page number token:** a special merge tag `{page_number}` and `{total_pages}` available in footer Rich Text blocks, resolved at render time by Gotenberg
- Typical content: page numbers ("Page {page_number} of {total_pages}"), legal disclaimer, company website

Header and footer zones are optional — a document can have neither, one, or both. They are configured at the document template level, not per-page.

---

## Block Model — Document-Specific Additions

> **⚠️ Post-MVP.** Block model extensions for the Document App type in the App Designer.

The Document App type uses the same block categories as the standard App Designer (see `app-designer.md` > Block Model) with the following additions and modifications:

### New Blocks

| Block | Category | Behavior |
|---|---|---|
| **Page Break** | Layout | Forces subsequent content to the next page. Visible as a dashed line in design mode, invisible in output. |

### Modified Blocks

| Block | Modification |
|---|---|
| **Rich Text** | Merge tag extension enabled. TipTap Environment 2 with the `mergeTag` custom node active — field placeholder pills (`{field_name}`) can be inserted from the field picker. Supports simple tags, loop tags (`{#items}...{/items}`), and conditional tags (`{#if field}...{/if}`). This is the primary block for free-text document content with dynamic data. |
| **Table/List** | When rendering to PDF, overflow behavior changes: rows that exceed the page boundary continue on the next page with column headers repeated. Pagination controls (used in web-facing Apps) are disabled — all rows render. |
| **Chart** | Renders as a static image in PDF output. Gotenberg captures the chart component as a PNG and embeds it in the PDF. See `chart-blocks.md`. |
| **Image** | Supports the `{image_field}` merge tag pattern for dynamic images (company logos, signatures, product photos). When bound to an image/attachment field, resolves to the field's file URL at render time. |

### Blocks Not Available in Document App Type

| Block | Reason |
|---|---|
| **Scheduler** | Interactive — no meaning in a static document |
| **Payment (Stripe)** | Interactive — requires web context |
| **Approval** | Interactive — requires Portal App client context |
| **Comment Thread** | Interactive — requires user sessions |
| **Form Input blocks** | Documents are output-only, not input |
| **Navigation Menu** | Documents don't have navigation |
| **Embed** | iframes don't render in PDF |

---

## Data Binding

> **⚠️ Post-MVP.** Data binding for Document Apps. MVP Document Templates use simpler merge-tag field resolution from the record's table and Cross-Linked tables.

Document Apps use the same three data binding modes as other App types (see `app-designer.md` > Data Binding Modes):

| Mode | Document Usage |
|---|---|
| **Context-Bound** (default) | The document template's context table. Field Display blocks and Rich Text merge tags pull from this table's fields for the current record. ~70% of use. |
| **Relationship-Bound** | Table/List blocks showing related records (e.g., line items linked to an invoice). Used for repeating row sections. ~25% of use. |
| **Query-Bound** (power user) | Pull data from any table for complex documents that aggregate across multiple sources. ~5% of use. |

**Single-record context.** A Document template always renders in the context of one record. When generating, the system resolves all data binding for that specific record. Batch generation (multiple records → multiple documents) is handled at the automation layer — the template itself is always single-record.

### Merge Tags in Rich Text Blocks

When a Rich Text block is selected in a Document App, the field picker sidebar shows available fields as insertable merge tags. Clicking a field inserts a `{field_name}` teal pill at the cursor position (using the existing TipTap `mergeTag` custom node from `smart-docs.md`).

**Available merge tag types:**

| Tag Type | Syntax | Example |
|---|---|---|
| **Simple field** | `{field_name}` | `{client_name}`, `{invoice_date}`, `{total_amount}` |
| **Loop (repeating)** | `{#relationship}...{/relationship}` | `{#line_items}...{/line_items}` — repeats content for each linked record |
| **Conditional** | `{#if field_name}...{/if}` | `{#if has_discount}Discount: {discount_amount}{/if}` |
| **Page tokens** | `{page_number}`, `{total_pages}` | Available in header/footer zones only |

The field picker sidebar organizes fields in sections:
- **This Table** — fields from the context table (shown first, expanded by default)
- **Related Tables** — fields from Cross-Linked tables, grouped by relationship name (e.g., "Line Items (via Items field)", "Client (via Client field)")

When entering from a table context, "This Table" is pre-populated with that table's fields.

---

## Render Pipeline

> **⚠️ Post-MVP.** Render pipeline for Document Apps built in the App Designer. MVP Document Templates use a simpler path: TipTap content → merge tag resolution → Gotenberg → PDF.

The Document App type renders through a distinct pipeline from web-facing Apps:

```
Document App (block tree)
  → Resolve data binding for target record
  → Resolve merge tags in Rich Text blocks
  → Resolve dynamic images
  → Generate styled HTML (same generateHTML path as Portal Apps)
  → Apply page size, margins, header/footer
  → Gotenberg (HTML → PDF or HTML → DOCX)
  → Store output in S3/R2
  → Link to source record in generated_documents table
```

### Pipeline Details

1. **Data resolution:** Fetch the target record. Resolve all field values, Cross-Link traversals, and computed fields. For relationship-bound blocks (Table/List with line items), query linked records.

2. **Merge tag resolution:** Walk all Rich Text block content (TipTap JSON). Replace `mergeTag` nodes with resolved field values. Process loops by cloning content for each linked record. Evaluate conditionals and include/exclude content accordingly. Uses the existing `merge-resolver.ts` utility from `smart-docs.md`.

3. **HTML generation:** Convert the block tree to styled HTML using `generateHTML()` — the same function used for Portal App rendering. Apply the document's theme tokens as CSS variables. Wrap in a page-sized container with margin, header, and footer HTML.

4. **PDF generation:** Send styled HTML to Gotenberg (`POST /forms/chromium/convert/html`). Gotenberg renders with Chromium, handling pagination, page breaks, header/footer repetition, and Table/List overflow with repeated column headers. Output: PDF file.

5. **DOCX generation (optional):** Gotenberg also supports HTML → DOCX via LibreOffice (`POST /forms/libreoffice/convert/html`). Less common — PDF is the primary output. DOCX output available for documents that recipients need to edit.

6. **Storage:** Generated file stored in S3/R2 at `documents/{tenant_id}/{template_id}/{record_id}/{timestamp}.{format}`. Row created in `generated_documents` table linking file to template and source record.

### Gotenberg Configuration for Documents

```typescript
// PDF generation request to Gotenberg
const response = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
  method: 'POST',
  body: formData({
    'index.html': styledHtml,
    'paperWidth': pageConfig.widthInches,    // e.g., 8.5
    'paperHeight': pageConfig.heightInches,  // e.g., 11
    'marginTop': pageConfig.marginTop,       // in inches
    'marginBottom': pageConfig.marginBottom,
    'marginLeft': pageConfig.marginLeft,
    'marginRight': pageConfig.marginRight,
    'preferCssPageSize': 'false',
    'printBackground': 'true',
    'headerHtml': headerHtml,    // Gotenberg repeats on every page
    'footerHtml': footerHtml,    // Gotenberg repeats on every page
  }),
});
```

Gotenberg natively supports repeating headers/footers and page number tokens (`<span class="pageNumber"></span>`, `<span class="totalPages"></span>`), which map directly to the `{page_number}` and `{total_pages}` merge tags.

---

## Automation Integration — "Set Up Automation" Wizard

> **⚠️ Post-MVP.** Automation integration for Document Apps. MVP document generation uses a manual "Generate Document" button on Record View, plus the MVP automation action "Generate Document" which produces a PDF from a Document Template (see `automations.md`).

The Document designer includes a contextual **"Set Up Automation"** button in the toolbar (next to Preview and Publish). This opens a streamlined wizard that leverages the designer's existing context.

### Quick Setup Wizard

The wizard already knows: the source table, the document template, and the available fields. It asks three things:

**1. Output Format**
- PDF (default)
- DOCX
- Both

**2. Destination**
- **Attach to record** — select an attachment field on the source table (or create one). Generated file is stored as an attachment on the record.
- **Email to recipient** — select an email field on the source table (e.g., "Client Email") or enter a static address. Generated file sent as attachment.
- **Save to Documents table** — select or create a Documents-type table. Generated file linked as a record.
- Multiple destinations can be selected.

**3. Trigger**
- **Manual** (default) — "Generate Document" button on the record
- **When record is created**
- **When status changes to [value]** — field + value picker (e.g., Status = "Approved")
- **On a schedule** — cron picker

The wizard generates an `automation_definition` with the appropriate trigger, a "Generate Document" action pointing to this template, and the selected delivery actions. The automation is created in a ready-to-activate state.

### Full Automation Builder (Alternative Path)

For complex flows (multi-step, conditional routing, approval gates before generation, batch generation with filters), the Manager uses the full automation builder (`automations.md`) and selects "Generate Document" as an action step. The action configuration shows:

1. **Template selector** — dropdown of Document templates in this workspace (both Document Apps and Document Templates)
2. **Record source** — the trigger record (default) or a query
3. **Output format** — PDF / DOCX
4. **Delivery actions** — same options as quick setup, plus custom webhook delivery

### Generate Document Automation Action

```typescript
interface GenerateDocumentAction {
  actionType: 'generate_document';
  config: {
    templateId: string;            // Document App ID or Document Template ID
    recordSource: 'trigger_record' | { tableId: string; filter: FilterRule[] };
    outputFormat: 'pdf' | 'docx' | 'both';
    delivery: Array<{
      type: 'attach_to_record' | 'email' | 'save_to_table' | 'webhook';
      config: {
        // attach_to_record
        fieldId?: string;
        // email
        recipientFieldId?: string;
        recipientStatic?: string;
        emailSubject?: string;
        emailBody?: string;         // supports merge tags
        // save_to_table
        targetTableId?: string;
        // webhook
        webhookUrl?: string;
      };
    }>;
  };
}
```

---

## Preview and Publish

> **⚠️ Post-MVP.** Preview and publish for Document Apps in the App Designer.

### Preview Mode

The canvas switches to a rendered view with real data. The designer chrome hides. A top banner shows: **"Preview — showing data from: [record picker dropdown] | Back to Editor"**

The record picker lets the Manager select any record from the context table to preview how the document looks with real data. Merge tags resolve to actual field values. Table/List blocks show real linked records. The preview renders at the document's page size with visible page boundaries.

### Publish

Publishing a Document App makes it available for generation. The Publish button opens a modal:

1. **Template summary** — page size, orientation, source table, field count
2. **Set Up Automation** — same quick setup wizard (if no automation exists yet)
3. **Test generate** — generate a sample document using a specific record
4. **Publish** — activates the template

Unlike web-facing Apps (Portal Apps, Form Apps, Website Apps), a Document App does not have a public URL. It exists as a generation template referenced by automations and manual actions.

---

## Relationship to Other Document Paths

EveryStack maintains multiple document generation paths, each suited to different needs:

### Path 0: Document Templates (MVP)

- **This is the MVP path.** Ships first. See GLOSSARY.md § Definitions — Documents.
- **Template authoring:** Rich text editor (TipTap) with merge tag picker — select fields from the record's table and Cross-Linked tables.
- **Output:** PDF via Gotenberg (TipTap content → HTML → PDF).
- **AI Draft:** AI generates prose content using record data + SDS context.
- **Access:** "Generate Document" button on Record View. Saved templates per table.
- **DB:** `document_templates` table (id, tenant_id, table_id, content as TipTap JSON, name).
- **Best for:** Simple merge-tag documents — invoices, letters, summaries, confirmations. Content-focused (rich text with merge tags), not design-focused (no spatial canvas).

### Path 1: Document App Type (Post-MVP — This Spec)

- **⚠️ Post-MVP.** Upgrade path from MVP Document Templates.
- **Template authoring:** App Designer with fixed-size canvas
- **Strengths:** Visual drag-and-drop design, 12-column grid layout for spatial documents, same tool as Portal Apps / Internal Apps, Rich Text blocks with merge tags, theme system, header/footer zones
- **Output:** PDF or DOCX via Gotenberg (HTML → PDF/DOCX)
- **Best for:** Design-heavy documents — invoices with complex layout, proposals, contracts, certificates, reports, any layout-heavy document

### Path 2: Upload DOCX Template (Compatibility Path)

- **Template authoring:** Microsoft Word or Google Docs → upload .docx → Template Mapper
- **Engine:** EveryStack's homegrown pizzip-based template engine (tag parsing, loop support, conditional sections, image replacement, value filters). Build spec: covered in this document (§ Template Mapper Architecture, § Tag Types, § Template Engine Internals below). The architectural specification here is sufficient for Claude Code implementation — the engine is built from the patterns described in this file. The engine replaces Docxtemplater and eliminates the $1,500 PRO pack dependency.
- **Strengths:** 100% fidelity to original Word formatting — because the engine only swaps tag values in the XML, it preserves every font, style, image, table, header, footer, and page layout from the original file. Zero learning curve for template creation (users already know Word). Easy migration path for businesses with existing templates.
- **Output:** DOCX (native) or PDF (via Gotenberg conversion)
- **Best for:** Businesses migrating existing Word templates, documents requiring precise Word-specific formatting, users who prefer designing in Word/Google Docs

### Shared Infrastructure

All paths share:
- The **automation system** — "Generate Document" action works with all template types. The action config includes `templateType: 'tiptap' | 'app_document' | 'docx_upload'` to route to the appropriate engine.
- **Gotenberg** — PDF conversion for all paths (TipTap HTML → PDF for MVP templates, block tree HTML → PDF for Document Apps, DOCX → PDF for uploaded templates)
- **Storage** — `template_definitions` and `generated_documents` tables store all template types
- **Field resolution** — all engines resolve field values, Cross-Link traversals, and computed fields from the same data layer

### What Was Subsumed

The **Smart Doc view template mode** (previously a separate document generation path) is subsumed by the Document App type. Smart Doc views in template mode produced live computed document fields on records using TipTap's linear block model. The Document App type replaces this with a superior spatial layout engine while keeping the same merge tag syntax and TipTap Rich Text blocks.

**Smart Doc template-output field sub-type** is deprecated. Documents are now generated as files (PDF/DOCX) via automation and stored in S3/R2 or as record attachments — not as live-rendered fields on records. This is simpler, cheaper (no re-rendering on every field change), and produces portable file output.

**Smart Doc wiki mode and the Smart Doc field type are unchanged.** TipTap remains the platform's rich text editor for wiki pages, meeting notes, descriptions, inline content, and knowledge bases. Smart Doc wiki views can still be embedded in Apps (Portal Apps, Internal Apps) as content blocks.

---

## Homegrown DOCX Template Engine

EveryStack is building a custom DOCX template engine to replace the Docxtemplater dependency. The engine uses pizzip to unzip/rezip .docx files and performs tag replacement directly on the XML, preserving 100% formatting fidelity.

### Engine Capabilities

| Feature | Status |
|---|---|
| Tag parsing (`{{placeholder}}` extraction from document.xml, headers, footers) | Build spec complete |
| Simple replacement (with XML run-splitting handling) | Build spec complete |
| Loop support (`{{#items}}...{{/items}}` — table rows and paragraph sections) | Build spec complete |
| Conditional sections (`{{#if field}}...{{/if}}`) | Build spec complete |
| Expression filters (`{{field \| currency}}`, `{{field \| format_date:"MM/DD/YYYY"}}`) | Build spec complete |
| Image replacement (alt-text-based `{{logo}}` → image buffer swap) | Build spec complete |
| API endpoints + workspace data connection | Build spec complete |
| Mapping Wizard UI | Build spec complete |
| Automation integration | Build spec complete |

Build implementation follows the patterns described above (§ Template Mapper Architecture). The engine replaces Docxtemplater and eliminates the $1,500 PRO pack dependency.

### Template Mapper UI

The Template Mapper is the field mapping interface for uploaded DOCX templates. It is **not** a document editor — it is a visual tool for connecting Word template placeholders to EveryStack data fields.

**Workflow:**
1. User uploads a .docx file designed in Word/Google Docs
2. Platform parses the document and extracts all `{{placeholder}}` tags
3. Tags are displayed grouped by type: simple fields, loops (with inner fields), conditionals, images
4. User maps each tag to a workspace field via dropdown pickers with search/filter
5. Auto-match attempts name-similarity matching (e.g., `{{client_name}}` → "Client Name" field)
6. Preview generates a sample document with real data from the first record
7. Save creates a `template_definition` row with `template_type: 'docx_upload'`

---

## Data Model

> **⚠️ Post-MVP DB architecture for Document Apps.** MVP document generation uses the `document_templates` table (see GLOSSARY.md § Database Entity Quick Reference: `document_templates` — id, tenant_id, table_id, content (TipTap JSON), name). The `apps` / `app_pages` / `app_blocks` tables below are post-MVP and store App Designer outputs.

### `apps` Table (Post-MVP)

Post-MVP, Document Apps are stored in the `apps` table alongside other App Designer outputs:

```typescript
// apps.type includes 'document' for Document Apps
type: 'portal' | 'internal_app' | 'form' | 'website' | 'widget' | 'document'
```

Document-specific fields stored in existing JSONB columns:

```typescript
// apps.layout_config (JSONB) — for type='document'
interface DocumentLayoutConfig {
  pageSize: 'us_letter' | 'a4' | 'us_legal' | 'a3' | 'a5';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;      // inches
    bottom: number;
    left: number;
    right: number;
  };
  headerHeight: number | null;   // px, null = no header
  footerHeight: number | null;   // px, null = no footer
}
```

**Note on legacy `portals` table:** The previous version of this doc stored Document Apps in the `portals` table via a `type='document'` column. Per GLOSSARY.md, the `portals` DB table is now scoped to MVP Quick Portals (record-sharing with auth). Forms have their own `forms` table. Post-MVP App Designer outputs (including Document Apps) use the `apps` / `app_pages` / `app_blocks` tables. See GLOSSARY.md § Database Entity Quick Reference.

### `template_definitions` Table Updates

```typescript
// template_type adds 'app_document' alongside existing values
template_type: 'tiptap' | 'docx_upload' | 'app_document'

// For Document App templates (post-MVP):
// - file_url: null (no uploaded file)
// - content: null (design lives in app_blocks)
// - app_id: UUID (FK to apps where type='document')
// - field_mappings: null (binding is on the blocks, not a separate mapping)

// For MVP Document Templates:
// - template_type: 'tiptap'
// - content: TipTap JSON with merge tags
// - table_id: FK to the source table
```

### `generated_documents` Table (Unchanged)

Stores output files from all paths. The `template_id` FK points to the `template_definitions` row, which indicates the template type.

---

## Page Sizes Reference

| Size | Dimensions (in) | Dimensions (mm) | Common Use |
|---|---|---|---|
| **US Letter** | 8.5 × 11 | 215.9 × 279.4 | Standard US business documents (default) |
| **A4** | 8.27 × 11.69 | 210 × 297 | International standard (default outside US) |
| **US Legal** | 8.5 × 14 | 215.9 × 355.6 | Legal contracts, agreements |
| **A3** | 11.69 × 16.54 | 297 × 420 | Large format reports, posters |
| **A5** | 5.83 × 8.27 | 148 × 210 | Booklets, small certificates |

Default page size is inferred from workspace locale (US Letter for US workspaces, A4 for international).

---

## Phase Implementation

### Post-MVP — Document Designer — Document Designer (Post-MVP. Depends on: Post-MVP — Portals & Apps App Designer complete, Post-MVP — Documents Gotenberg pipeline ready)

> **⚠️ Post-MVP.** The Document App type in the App Designer is post-MVP. MVP document generation (Document Templates with merge tags + Gotenberg PDF output) ships as part of the core MVP scope — see GLOSSARY.md § MVP Scope Summary: "Document Gen: Merge-tag templates. Rich text editor. PDF output. AI draft option."

**Work streams:**

1. **Document App type registration** — Add `'document'` to `apps.type` enum. Document-specific `layout_config` JSONB shape. Page size and orientation selectors.

2. **Fixed-size canvas** — Page simulation rendering in the App Designer. Page boundary visualization. Page Break block. Zoom control replacing viewport toggle.

3. **Header/footer zones** — Dedicated canvas regions above/below body. Repeat-on-every-page rendering. Page number tokens (`{page_number}`, `{total_pages}`).

4. **Rich Text merge tags in designer** — Enable TipTap `mergeTag` extension on Rich Text blocks within Document Apps. Field picker sidebar integration. Loop and conditional tag support.

5. **Document render pipeline** — Block tree → data resolution → merge tag resolution → HTML generation → Gotenberg → PDF/DOCX. Header/footer HTML injection. Page size configuration passthrough.

6. **"Set Up Automation" wizard** — Contextual wizard in designer toolbar. Format, destination, trigger configuration. Auto-generates automation definition.

7. **Template gallery** — 8 curated document templates (Invoice, Proposal/Quote, Contract, SOW, Receipt, Letter/Letterhead, Report, Certificate). Each is a pre-built Document App with themed blocks and placeholder merge tags.

8. **Table-level entry point** — Tab menu dropdown → Create App → Document option. Pre-fills table context in wizard.

9. **Template Mapper + pizzip engine** — Homegrown DOCX template engine (8-prompt build). Template Mapper UI for uploaded DOCX field mapping. API endpoints for upload, parse, map, generate.

10. **Smart Doc template mode deprecation** — Remove template mode from Smart Doc view type picker. Migrate any existing template-output fields to Document App equivalents. Smart Doc view retains wiki mode only.

### Dependencies

| Dependency | Source |
|---|---|
| App Designer (block model, canvas, property panel, themes) | Post-MVP — Portals & Apps |
| Gotenberg pipeline (HTML → PDF, network isolation, sandboxing) | Post-MVP — Documents |
| Automation system (triggers, actions, action registry) | Post-MVP — Automations |
| Smart Doc TipTap editor (merge tag extension, merge-resolver) | Post-MVP — Documents |

**Note:** The automation "Set Up Automation" wizard and full "Generate Document" action depend on the automation system (Post-MVP — Automations). Post-MVP — Document Designer can build the designer and render pipeline; the automation integration lands when Post-MVP — Automations is ready. In the interim, document generation can be triggered manually (button on record → generate → download).
