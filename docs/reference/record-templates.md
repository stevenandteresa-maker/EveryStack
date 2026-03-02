# EveryStack — Record Templates & Quick-Create Patterns

> **Glossary reconciliation: 2026-02-27 (batch 2)**
> Changes in this pass:
>
> - **Fixed stale cross-reference**: `interface-designer.md` → `app-designer.md` in cross-references section and reconciliation notes (file was renamed; MANIFEST.md known issue resolved).
> - **Replaced all `interface_tabs` DB references with `views`** per glossary. Code is built from scratch — no legacy naming to preserve. Affected: view `view_config` JSONB references (§Table View & Permission Layer, §Phase Implementation, §Claude Code Prompt 4), and `getTemplatesForView()` code sample (renamed accessor `getInterfaceTab()` → `getView()`).
>
> Changes from prior pass (2026-02-27 batch 1):
>
> - **"Interface" → "Table View"** throughout when referring to configured view contexts (glossary naming discipline: "Interface" as a Table View → **Table View**). DB table `interface_tabs` → `views` per glossary (code built from scratch — no legacy naming).
> - **"Interface field_overrides" → "Table View field_overrides"**; **"Interface template scoping" → "Table View template scoping"**.
> - **`available_in: 'interface'` → `'table_view'`** to match glossary naming.
> - **"Board view" → "Kanban view"** per glossary Table View type naming; all Kanban view references tagged **[Post-MVP]** (glossary MVP scope: only Grid + Card ship).
> - **Calendar view template picker** tagged **[Post-MVP]** (Calendar view is post-MVP per glossary).
> - **"Expand Record"** clarified as **"Record View"** where it refers to the view surface (glossary: Record View is the configurable canvas for viewing/editing a single record).
> - **Portal form block template references** tagged **[Post-MVP]** where they describe App Designer block concepts (glossary: MVP portals are simple Record View shares; block-based portals are post-MVP App Designer outputs).
> - **`app-designer.md` cross-reference** annotated: concept is **App Designer** per glossary.
> - **"Quick Entry Interface Mode" → "Quick Entry mode"** (dropped overloaded "Interface" term).
> - **`custom-apps.md` cross-reference** annotated: App Designer / Apps are post-MVP per glossary.
> - **Phase tags reviewed**: MVP — Core UX items cross-checked against glossary MVP scope; post-MVP items (Kanban, Calendar, portal form blocks, App Designer features) clearly labeled.

> **Sub-document.** Record template system, pre-filled field value sets, dynamic tokens, template picker UX, automation integration, Table View/permission scoping, portal templates, Command Bar and Quick Entry integration, contextual creation shortcuts.
> Cross-references: `CLAUDE.md` (permissions — Manager+ creates templates), `data-model.md` (fields.default_value, records.canonical_data JSONB, field type taxonomy, system fields, FieldTypeRegistry), `tables-and-views.md` (grid new-row creation, Quick Entry mode, Record View, Kanban view column creation [post-MVP], Calendar view slot creation [post-MVP], inline sub-table Add Row, Command Bar commands, FAB on mobile), `automations.md` (Record Created trigger #1, Create Record action #1, trigger execution context, template resolution engine), `app-designer.md` (App Designer — post-MVP; portal form blocks [post-MVP], portal_clients record_scope), `command-bar.md` (command_registry, slash commands, context_scopes), `permissions.md` (workspace roles, Table View field_overrides, field-level permissions), `cross-linking.md` (cross_links, Linked Record field, contextual record creation), `inventory-capabilities.md` (Quick Entry default_values — superseded by template reference), `custom-apps.md` (App form blocks [post-MVP], Cart/Transaction block completion flow [post-MVP]), `design-system.md` (split button pattern, bottom sheet mobile, progressive disclosure), `mobile.md` (FAB, bottom sheet, card view creation), `bulk-operations.md` (bulk duplicate follows single-record duplication rules — new UUID, copied fields, record quota check before execution; bulk create from template listed as future extension)
> Last updated: 2026-02-27 — Glossary reconciliation batch 2 (cross-reference filename fix, `interface_tabs` → `views` throughout). Prior: 2026-02-27 — Glossary reconciliation batch 1 (naming, MVP scope tagging). Prior: 2026-02-21 — Added `bulk-operations.md` cross-reference. Prior: Initial specification.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                             | Lines   | Covers                                                                                |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| Strategic Rationale                 | 50–59   | Why record templates exist, value proposition                                         |
| Data Model                          | 60–166  | record_templates table, canonical_data shape, dynamic tokens, linked_records, scoping |
| Automation Integration              | 167–305 | Templates in automation actions, record_creation_source, contextual creation          |
| Table View & Permission Layer       | 306–452 | Template visibility per view, role access, view-contextual overrides                  |
| UX Flow                             | 453–619 | Template picker UI, split button, dropdown, mobile bottom sheet                       |
| Template Manager (Configuration UI) | 620–703 | Admin template CRUD, field mapping, default templates, categories                     |
| Record Creation Flow (End-to-End)   | 704–726 | 7-step creation flow with template resolution                                         |
| API Surface                         | 727–765 | REST endpoints for template CRUD and application                                      |
| Deletion Cascades & Edge Cases      | 766–778 | Orphan handling, field deletion impact, table deletion                                |
| Real-Time Behavior                  | 779–788 | Template updates broadcast, cache invalidation                                        |
| What to Defer                       | 789–802 | Explicitly deferred features                                                          |
| Phase Implementation                | 803–817 | MVP — Core UX + Post-MVP — Automations delivery scope                                 |
| Claude Code Prompt Roadmap          | 818–845 | 6-prompt implementation roadmap                                                       |
| Key Architectural Decisions         | 846–860 | ADR-style decisions with rationale                                                    |

---

## Strategic Rationale

EveryStack has no concept of record templates — pre-filled field value sets that users select when creating a new record. Every CRM, project manager, and operations tool has this. A "New Client Onboarding" template that pre-populates status, default fields, linked records, and triggers a checklist is the kind of quality-of-life feature that makes the difference between a database and a business tool.

The existing `fields.default_value` column provides per-field defaults at the schema level, but it's a single static default per field across _all_ new records. There's no way to say "when creating a _client onboarding_ record, use _this set_ of defaults; when creating a _vendor setup_ record, use _that set_."

Record templates are trivially implementable — a template is a JSONB blob of default field values stored alongside the table config — and they unlock significant value across automations, portals, Command Bar, Quick Entry, and contextual creation flows.

---

## Data Model

### `record_templates` Table

Standalone table, not JSONB on `tables`. Templates are CRUD objects with their own lifecycle — users create, edit, reorder, duplicate, and delete them independently. A mature CRM table might have 8–10 templates. Storing them as a JSONB array on `tables` would mean every template edit rewrites a hot row, makes permissions queries awkward, and swallows foreign key relationships.

| Column           | Type                          | Purpose                                                                                                                                 |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | UUID PK                       | Stable identifier.                                                                                                                      |
| `tenant_id`      | UUID FK → tenants             | Tenant scope.                                                                                                                           |
| `table_id`       | UUID FK → tables              | Parent table.                                                                                                                           |
| `name`           | VARCHAR(255) NOT NULL         | Display name (e.g., "Client Onboarding").                                                                                               |
| `description`    | TEXT (nullable)               | Help text shown in template picker tooltip.                                                                                             |
| `icon`           | VARCHAR(50) (nullable)        | Emoji or icon key for visual distinction.                                                                                               |
| `color`          | VARCHAR(20) (nullable)        | Visual distinction in template picker.                                                                                                  |
| `canonical_data` | JSONB NOT NULL DEFAULT {}     | Pre-filled values keyed by `fields.id`. Same shape as `records.canonical_data`. Supports dynamic tokens.                                |
| `linked_records` | JSONB (nullable)              | Pre-link specifications keyed by Linked Record field ID. Supports `$context_record` token.                                              |
| `is_default`     | BOOLEAN DEFAULT false         | Auto-apply when creating via plain "+" button. One per table max.                                                                       |
| `available_in`   | VARCHAR[] DEFAULT '{all}'     | Contexts where the template surfaces. Values: `all`, `grid`, `table_view`, `portal`, `automation`, `quick_entry`, `command_bar`, `api`. |
| `section_id`     | UUID (nullable) FK → sections | Grouping in template picker (for tables with many templates).                                                                           |
| `sort_order`     | INTEGER DEFAULT 0             | Order in template picker.                                                                                                               |
| `created_by`     | UUID FK → users               | Creator.                                                                                                                                |
| `publish_state`  | VARCHAR DEFAULT 'live'        | `live` \| `draft` — governs draft/live authoring workflow.                                                                              |
| `environment`    | VARCHAR DEFAULT 'live'        | `live` \| `sandbox` — standard sandbox isolation (post-MVP). Orthogonal to `publish_state`.                                             |
| `created_at`     | TIMESTAMPTZ                   |                                                                                                                                         |
| `updated_at`     | TIMESTAMPTZ                   |                                                                                                                                         |

**Indexes:** `(tenant_id, table_id, environment)` for sandbox isolation (standard query rule). `(tenant_id, table_id, publish_state)` for listing templates per table. Unique partial index on `(tenant_id, table_id)` where `is_default = true` to enforce one default per table.

**No `automation_id` FK.** Template-to-automation binding is handled through the trigger system (see Automation Integration > Direction 1). A direct FK creates a parallel execution path that duplicates what the trigger engine already does and requires dedup logic — a code smell indicating two systems doing the same job.

### `canonical_data` JSONB Shape

Keyed by `fields.id`, identical structure to `records.canonical_data`. This is critical: validation runs through the exact same `FieldTypeRegistry.validate()` pipeline that runs on normal record creation. No special-casing.

```jsonc
{
  "fld_status_abc": "opt_active", // single select option ID
  "fld_priority_def": "opt_high", // another select
  "fld_checkbox_ghi": true, // boolean
  "fld_assignee_jkl": ["$me"], // dynamic token — resolved at creation time
  "fld_due_date_mno": "$today+14d", // relative date expression
  "fld_text_pqr": "Standard onboarding", // static text
  "fld_checklist_xyz": [
    // checklist pre-population
    { "id": "chk_1", "title": "Send welcome email", "completed": false },
    { "id": "chk_2", "title": "Schedule kickoff call", "completed": false },
    { "id": "chk_3", "title": "Create shared folder", "completed": false },
  ],
}
```

Fields left out of `canonical_data` are not set by the template — they fall through to `fields.default_value` or null.

Checklist pre-population lives inside `canonical_data`, not in a separate column. It flows through the same path as every other field type. Simpler.

### Dynamic Tokens

Static values are easy, but templates become dramatically more useful with dynamic tokens that resolve at record creation time. These tokens reuse existing resolution engines — `$me` in view filters is already specced in `tables-and-views.md`.

| Token             | Resolves To                                              | Available In                                     | Notes                                           |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| `$me`             | Creating user's ID                                       | People fields                                    | Same token used in view filter rules.           |
| `$today`          | Current date (UTC)                                       | Date, Due Date fields                            | ISO 8601 string.                                |
| `$today+Nd`       | Current date + N days                                    | Date, Due Date fields                            | N is a positive integer.                        |
| `$today-Nd`       | Current date − N days                                    | Date, Due Date fields                            | N is a positive integer.                        |
| `$now`            | Current timestamp                                        | Date fields with `include_time: true`            | Full datetime.                                  |
| `$context_record` | Record the user was viewing when they chose the template | Linked Record fields (in `linked_records` JSONB) | See Linked Records section. Null if no context. |

**Token resolution runs server-side** at record creation time, not at template save time. A template with `$today+14d` always resolves to 14 days from _now_, not 14 days from when the template was created.

**Validation of token values:** Tokens are validated at template save time for structural correctness (e.g., `$today+Nd` must have a valid integer) but the resolved value is validated at creation time through the standard `FieldTypeRegistry.validate()` pipeline.

### `linked_records` JSONB Shape

Pre-link specifications keyed by Linked Record field ID:

```jsonc
{
  "fld_linked_client": "$context_record", // link to the record user was viewing
  "fld_linked_team": ["rec_abc", "rec_def"], // static record IDs (e.g., "Default Team")
}
```

`$context_record` resolves to the record the user was looking at when they chose the template. If a user right-clicks a client record and selects "New Invoice from template," the client link auto-populates. If there's no context record (e.g., user clicked "+" from the toolbar), the field is left empty.

Static record IDs are validated at template save time — if a referenced record is deleted, the template continues to work but that link is silently skipped at creation time.

**Cross-link pairs** are created through the standard `cross_link_index` creation path. No special handling — the template just provides the target record IDs that would normally come from user selection.

### Value Resolution Order

When a new record is created, field values are resolved in this order. Each layer overrides the previous:

1. **`fields.default_value`** — baseline default for every new record regardless of template
2. **`record_templates.canonical_data`** — template values override field-level defaults
3. **User edits** — any changes the user makes after creation override template values

If a template doesn't specify a value for a field, the field-level default applies. If neither exists, the field is null.

For the Create Record automation action with `templateId` + `fieldOverrides`, the order is:

1. **`fields.default_value`**
2. **`record_templates.canonical_data`**
3. **Automation `fieldOverrides`** — dynamic values from execution context

---

## Automation Integration

Five integration surfaces, prioritized by value and independence.

### Direction 1: Record Creation Source Context (Priority: Foundational)

The "Record Created" trigger (#1 in `automations.md`) currently fires with the new record as context but no way to know _how_ the record was created. This is a gap independent of templates.

**Add `source` and `template` to trigger execution context:**

```jsonc
{
  "trigger": {
    "type": "record_created",
    "record": {
      /* full record */
    },
    "source": "template",
    "template": {
      "id": "tmpl_abc123",
      "name": "New Client Onboarding",
    },
    "created_by": "usr_xyz",
  },
}
```

**`record_creation_source` enum:**

| Value              | Meaning                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `manual`           | User created a blank record (empty row click, "+" button with no template) |
| `template`         | User selected a record template                                            |
| `automation`       | Created by a Create Record automation action                               |
| `api`              | Created via API                                                            |
| `portal`           | Portal client submitted a form                                             |
| `import`           | Bulk import (CSV, XLSX, or sync initial load)                              |
| `quick_entry`      | Created via Quick Entry mode                                               |
| `inline_sub_table` | Created as a child row in an inline sub-table                              |
| `duplicate`        | Duplicated from an existing record                                         |

This enables critical automation patterns:

- "Only run when source = template AND template.name = 'Client Onboarding'" → fires welcome sequence
- "Only run when source = portal" → fires client notification flow
- "Skip when source = automation" → prevents infinite loops from Create Record actions
- "Skip when source = import" → don't fire 500 welcome emails during bulk import
- "Skip when source = duplicate" → don't re-fire onboarding for duplicated records

**Implementation:** The `source` field is set by the application layer at the point of record creation. Every code path that calls the record creation function must pass a `source` value. The trigger execution engine includes it in the trigger payload. No schema changes to `records` table — the source is transient context on the trigger event, not persisted on the record.

**This should ship with or without templates.** It fixes a real automation correctness bug (imports firing individual record triggers) and unblocks all template-aware automation patterns.

### Direction 2: Template as Automation Action Parameter (Priority: High)

The existing "Create Record" action (#1) takes `tableId` and `fieldValues: { fieldId: template }` where each value is a template expression. This works but requires manual specification of every field value.

**Add `templateId` and `fieldOverrides` as an alternative mode:**

```jsonc
// Mode A: manual (existing behavior, unchanged)
{
  "action": "create_record",
  "config": {
    "tableId": "tbl_xyz",
    "fieldValues": {
      "fld_a": "{{trigger.record.fields.name}}",
      "fld_b": "Active"
    }
  }
}

// Mode B: template-based (new)
{
  "action": "create_record",
  "config": {
    "tableId": "tbl_xyz",
    "templateId": "tmpl_abc123",
    "fieldOverrides": {
      "fld_client": "{{trigger.record.id}}",
      "fld_amount": "{{step_2.output.calculated_total}}"
    }
  }
}
```

`templateId` and `fieldValues` are **mutually exclusive at the top level**. `fieldOverrides` is the template companion — it overrides specific template values using the standard template resolution engine (`{{...}}` syntax from `automations.md`). The template handles the 12 boilerplate fields, the overrides handle the 2–3 dynamic ones.

**Builder UI:** Toggle in the Create Record action config panel: "Set fields manually" vs "Use a record template." Picking a template collapses the field configuration down to a template selector plus an optional overrides section showing only fields the user wants to change. The builder UX goes from configuring 15 field-value pairs to selecting a template and overriding 2.

### Direction 3: Source and Template as Trigger Filter Fields (Priority: Medium)

Rather than a separate "Record created from template" trigger type, add `source` and `template` as filterable fields in the condition builder when the trigger is "Record Created."

**UI treatment in trigger picker:**

```
When a record is created...
  ○ Any new record
  ○ From a specific template → [template picker dropdown]
  ○ From a portal submission
  ○ From an API call
```

Under the hood, these are all trigger #1 ("Record Created") with different preset conditions on `source` and `template.id`. No new trigger type to maintain, no special-casing in the execution engine. It's just data.

This matters for discoverability. A user setting up automations sees "From a specific template" as an option and immediately understands the concept. The condition-based approach buries it.

### Direction 4: Automation Recipe Bundling (Priority: Deferred — Post-MVP — Verticals & Advanced+)

Automation recipes (pre-built templates for accounting, inventory, etc.) could bundle a record template + an automation + the binding between them. When the user installs the recipe, both are created and linked.

**Flag only, don't spec.** Recipes are under-specced — there's no recipe definition format in the docs yet. When that gets specced, `record_templates` should be part of the bundle format. Note for future: the recipe installer needs a "Create record template" step alongside "Create automation."

### Source Context Implementation Notes

The `source` enum is set at the application layer. Every record creation code path must be updated:

| Code Path                                         | Source Value                                                |
| ------------------------------------------------- | ----------------------------------------------------------- |
| Grid empty row click                              | `manual`                                                    |
| "+" toolbar button (no template)                  | `manual`                                                    |
| "+" toolbar button (with template)                | `template`                                                  |
| FAB tap (no template)                             | `manual`                                                    |
| FAB tap (with template)                           | `template`                                                  |
| Create Record automation action (no templateId)   | `automation`                                                |
| Create Record automation action (with templateId) | `automation` (not `template` — the automation is the actor) |
| API `POST /records` (no template)                 | `api`                                                       |
| API `POST /records` (with template_id param)      | `api` (same reasoning)                                      |
| Portal form submission                            | `portal`                                                    |
| CSV/XLSX import                                   | `import`                                                    |
| Sync initial load                                 | `import`                                                    |
| Quick Entry scan/submit                           | `quick_entry`                                               |
| Inline sub-table Add Row                          | `inline_sub_table`                                          |
| Record duplication                                | `duplicate`                                                 |
| Right-click → "Create linked from template"       | `template`                                                  |

**Note:** When an automation uses a template (Mode B), the source is `automation`, not `template`. The automation is the actor — the template is just a configuration detail. `source = template` means a human chose the template interactively. This distinction matters for loop prevention: "skip when source = automation" should catch all automation-created records, including those using templates.

---

## Table View & Permission Layer

### Who Creates Templates

Templates are definition-level objects. **Manager+ creates and edits templates**, consistent with fields, views, automations, and all other structural configuration. Templates participate in the draft/live workflow via the `publish_state` column. The separate `environment` column provides standard sandbox isolation (post-MVP), consistent with all other schema entities.

### Table View Template Scoping

The Table View architecture controls whether record creation is allowed (`allow_create` on views), which fields are visible, and which fields are editable. Templates add a fourth dimension: _which creation paths_ are available.

**Add `template_config` to the view's `view_config` JSONB** (DB: `views.view_config`):

```jsonc
{
  "view_config": {
    // ...existing config...
    "template_config": {
      "mode": "all",
      "template_ids": [],
      "require_template": false,
      "default_template_id": null,
    },
  },
}
```

### Template Config Modes

| Mode         | Behavior                                                                                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"all"`      | Team Members see every template on the table (filtered by `available_in` on the template itself). Default. Low-config.                                                                                                                                                                 |
| `"selected"` | Manager picks which templates appear in this view via `template_ids` array. A "Sales Pipeline" view might only show "New Lead" and "New Opportunity" templates, even though the Deals table also has "New Partner Deal" and "Internal Project" templates irrelevant to the sales team. |
| `"none"`     | No templates offered — just blank record creation (or no creation at all if `allow_create` is false).                                                                                                                                                                                  |

### `require_template` Flag

When true, the "+" button _only_ shows templates — there's no "blank record" option. For tables where unstructured record creation is a mistake: an invoice table where every record needs a type, a project table where every project needs a methodology template.

**Interaction matrix with `allow_create`:**

| `allow_create` | `require_template` | Behavior                                  |
| -------------- | ------------------ | ----------------------------------------- |
| false          | (irrelevant)       | No "+" button at all                      |
| true           | false              | "+" shows blank record + templates        |
| true           | true               | "+" shows only templates, no blank option |

### `default_template_id`

Pre-selects a template in the picker for this view. Does not auto-apply — the user still sees the picker with this template highlighted. For auto-apply behavior, use `is_default` on the template itself (see UX Flow > Single-Template Shortcut).

### Hidden Field Interaction

A view can hide fields via `field_config`. If a template pre-fills a hidden field, **the template still sets the value.** The field is hidden from the _view_, not from the _record_. This is consistent with how Table View field overrides already work — hidden fields are still queryable, still exist on the record, still fire automations.

This is a feature: a Manager can use templates to set internal fields (like a routing code or department tag) that Team Members never see or interact with. The template does the data entry the user shouldn't have to think about.

### Portal Templates

Portals have a different permission model — `portal_clients` with `record_scope`, not workspace roles. But the same template concept applies. The `available_in` field on `record_templates` includes `'portal'` as an option.

**Portal form blocks can reference specific templates** **[Post-MVP — App Designer block concept. MVP portals are simple Record View shares per glossary. This pattern applies when portals gain block-based layouts via the App Designer]:**

```jsonc
{
  "block_type": "form",
  "config": {
    "table_id": "tbl_xyz",
    "template_id": "tmpl_portal_request",
    "visible_fields": ["fld_a", "fld_b", "fld_c"],
    "editable_fields": ["fld_a", "fld_b"],
  },
}
```

The template sets default values for the form. The portal client can edit the fields they're allowed to. Fields that the template sets but the portal doesn't expose are silently populated — the client never knows they exist.

**Multiple portal entry points [Post-MVP]:** A portal page can have multiple form blocks, each using a different template: "Support Request" button uses `tmpl_support` (pre-fills category = Support, priority = Normal), "Feature Request" button uses `tmpl_feature` (pre-fills category = Feature, priority = Low, adds a feedback checklist). Same table, different templates, different visible fields. This is essentially free if templates exist.

### `available_in` Array Semantics

`available_in` on the template controls broad context eligibility. View-level `template_config.template_ids` further narrows within the `table_view` context. Both layers apply — a template must pass both to appear.

| Value         | Where Template Surfaces                                                |
| ------------- | ---------------------------------------------------------------------- |
| `all`         | Shorthand for all contexts. Default.                                   |
| `grid`        | Raw table "+" menu (Manager view).                                     |
| `table_view`  | Eligible for view `template_config` selection.                         |
| `portal`      | Eligible for portal form block `template_id` [post-MVP block concept]. |
| `automation`  | Available as `templateId` in Create Record action.                     |
| `quick_entry` | Appears in Quick Entry mode template picker.                           |
| `command_bar` | Appears as "Create: [name]" Command Bar command.                       |
| `api`         | Available via API `POST /records` with `template_id` param.            |

This lets a Manager create an automation-only template (internal use, never clutters the UI) or a portal-only template (clients see it, internal users don't).

### Permission Enforcement (Data Layer)

Following the existing pattern — enforce in `apps/web/src/data/`, not in components:

```typescript
// apps/web/src/data/record-templates.ts
export async function getTemplatesForContext(
  tableId: string,
  context: 'grid' | 'table_view' | 'portal' | 'quick_entry' | 'command_bar',
): Promise<RecordTemplate[]> {
  const tenantId = await getTenantId();
  const dbConn = getDbForTenant(tenantId, 'read');

  const templates = await dbConn
    .select()
    .from(recordTemplates)
    .where(
      and(
        eq(recordTemplates.tenantId, tenantId),
        eq(recordTemplates.tableId, tableId),
        eq(recordTemplates.publishState, 'live'), // Only published templates
        eq(recordTemplates.environment, 'live'), // Standard sandbox isolation rule
      ),
    )
    .orderBy(recordTemplates.sortOrder);

  return templates.filter((t) => {
    const availableIn = t.availableIn as string[];
    return availableIn.includes('all') || availableIn.includes(context);
  });
}

// For view context, caller further filters by template_config:
export async function getTemplatesForView(
  tableId: string,
  viewId: string,
): Promise<RecordTemplate[]> {
  const allTemplates = await getTemplatesForContext(tableId, 'table_view');
  const view = await getView(viewId);
  const templateConfig = view.viewConfig?.template_config;

  if (!templateConfig || templateConfig.mode === 'all') return allTemplates;
  if (templateConfig.mode === 'none') return [];
  if (templateConfig.mode === 'selected') {
    return allTemplates.filter((t) => templateConfig.template_ids.includes(t.id));
  }
  return allTemplates;
}
```

### Future: Team Lead Template Creation

Currently Manager+ only creates templates, consistent with everything definition-level. There's a future case for Team Leads (a Team Member with elevated privileges) creating templates scoped to their team's view. This ties into whatever granular permission system is built later. Flag for Post-MVP — Verticals & Advanced+.

---

## UX Flow

Three surfaces: template picker (creation time), template manager (configuration time), contextual creation shortcuts.

### Template Picker — Grid View (Desktop)

When a table has **no templates**, everything works exactly as today. No change. The persistent empty row at the bottom of the grid creates a blank record. The "+" toolbar button creates a blank record. Cmd+Shift+N creates a blank record.

When a table has **one or more templates**, the "+" toolbar button and Cmd+Shift+N open a dropdown:

```
┌─────────────────────────────────┐
│  + Blank record                 │
│  ───────────────────────────    │
│  📋 Client Onboarding           │
│  📋 Vendor Setup                │
│  📋 Internal Project            │
│  ───────────────────────────    │
│  ⚙️ Manage templates...         │
└─────────────────────────────────┘
```

**Rules:**

- "Blank record" is always first, always available — unless `require_template` is true on the view, in which case it's absent.
- Templates show icon + name, ordered by `sort_order`.
- If more than 5 templates, the list scrolls with a search filter at the top.
- "Manage templates..." links to the template manager (Manager+ only — hidden for Team Members and Viewers).
- **Hover tooltip** on each template shows description + which fields it sets (field names only, not values): "Sets: Status, Priority, Assignee, Due Date, Checklist." Helps users pick the right template without memorizing contents.

**Persistent empty row:** Always creates a blank record, even when templates exist. No template picker on the empty row. This is the fast path for power users — templates are for intentional, structured creation. The empty row is for speed.

**Keyboard flow:** Cmd+Shift+N opens the dropdown. Arrow keys navigate. Enter selects. Typing filters templates by name. Escape dismisses. Matches Command Bar interaction patterns.

**Template discovery nudge:** For tables with zero templates, no template-related UI appears anywhere — creation works exactly as if the template system doesn't exist. However, after a workspace has been active for 2+ weeks and a table with no templates accumulates 50+ records, the Command Bar contextual suggestion system (max 1 per session, dismissible) may suggest: "You create a lot of [table name] records. Set up templates to save time?" Tapping the suggestion navigates to the template manager. This nudge only fires once per table — dismissed or acted upon, it doesn't return.

### Single-Template Shortcut

If a table has exactly one template and it's marked `is_default: true`, the "+" toolbar button creates a record with that template applied immediately — no dropdown. The dropdown is still accessible via a small chevron arrow next to the "+" button (split button pattern). Optimizes the common case where a team has standardized on one record shape.

### Template Picker — Kanban View **[Post-MVP]**

> **Post-MVP:** Kanban is a post-MVP Table View type per glossary. This section describes template behavior when Kanban ships.

The "+" at the bottom of each column currently creates a record with that column's status value pre-filled. With templates, it becomes the same split button: click creates with the column's status (existing behavior), chevron opens the template picker.

**Contextual override:** When a template is selected, the template's field values apply _and_ the column's status value overrides the template's status value. Column context wins over template defaults — the user clicked "+" in the "In Progress" column, so the record is "In Progress" regardless of what the template says.

### Template Picker — Calendar View **[Post-MVP]**

> **Post-MVP:** Calendar is a post-MVP Table View type per glossary. This section describes template behavior when Calendar view ships.

Tapping an empty time slot creates a record with the date pre-filled (already specced in `tables-and-views.md`). With templates, same split button pattern. Template values apply, but the clicked date overrides the template's date field. Same principle as Kanban — contextual values from the view override template defaults.

**General rule:** View-contextual values (Kanban column status, Calendar slot date, inline sub-table parent link) always override template values for the field they control. The template sets everything else.

### Template Picker — Mobile (FAB)

The FAB tap opens a **bottom sheet** instead of immediately creating a record:

```
┌─────────────────────────────────────┐
│            New Record               │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  + Blank record             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📋 Client Onboarding       │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  📋 Vendor Setup            │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

Same rules: single default template skips the sheet. `require_template` removes blank option. Bottom sheet dismissable with swipe down. Thumb zone friendly.

### Post-Creation: Record View Behavior

When a record is created from a template, the Record View opens immediately with pre-filled values visible. Two UX details:

**Visual indicator:** Pre-filled fields have a subtle highlight animation on first open — a brief teal background fade (500ms ease-out) on each field that the template populated. Not persistent, not distracting — just enough to communicate "these values came from the template, you can change them." Fades after first view.

**Cursor focus:** Cursor focuses on the **first empty field**, not the first field overall. The template already filled in the boilerplate — put the user where they need to start typing. If the template filled everything, cursor goes to the record title (primary field).

### Template-Aware Undo

When a record is created from a template, Ctrl+Z / Cmd+Z within 5 seconds removes the entire record. The system knows this was a single atomic action (template application), so undo should reverse the whole thing, not just the last field edit. Standard undo toast: "Record created from Client Onboarding — Undo."

This builds trust — users experiment with templates more freely when they can instantly reverse.

### Quick Entry Integration

Quick Entry (specced in `tables-and-views.md` > Quick Entry mode) already has `default_values` in its config. Replace with a template reference:

```jsonc
{
  "mode": "quick_entry",
  "target_table_id": "tbl_xyz",
  "template_id": "tmpl_receiving",
  "scan_field_id": "fld_barcode",
  "entry_fields": ["fld_qty", "fld_location"],
}
```

The template handles all default values (movement type, status, warehouse location). Quick Entry shows only the entry fields for the user to fill on each scan. Eliminates duplication between Quick Entry's `default_values` and the template system. Quick Entry's existing `default_values` config key is deprecated in favor of `template_id`.

### Command Bar Integration

When a Manager creates a template with `available_in` including `'command_bar'`, the system auto-registers a command in `command_registry`:

```jsonc
{
  "command_key": "create_from_template_tmpl_abc",
  "label": "Create: Client Onboarding",
  "category": "create",
  "source": "system_template",
  "context_scopes": { "table_id": "tbl_xyz" },
}
```

User opens Command Bar → types "client onb..." → autocomplete shows "Create: Client Onboarding" → Enter → record created, Record View opens. Two keystrokes to a fully structured record.

**Lifecycle:** Command is auto-created when template is created with `command_bar` in `available_in`, auto-deleted when template is deleted or `command_bar` is removed from `available_in`. No manual command registration needed.

### Contextual Creation Shortcuts

Three surfaces where `$context_record` in `linked_records` enables one-click linked record creation.

**Right-click on record row:** Context menu includes "Create linked..." submenu showing templates from tables that have Linked Record fields pointing at this table:

```
Right-click on "Acme Corp" (Clients table)
  ├── Open record
  ├── Duplicate
  ├── Delete
  ├── ───────────
  ├── Create linked...
  │   ├── 📋 New Invoice (Invoices table)
  │   ├── 📋 New Project (Projects table)
  │   └── 📋 New Support Ticket (Tickets table)
```

Selecting "New Invoice" creates an invoice record using the template, with `$context_record` resolved to Acme Corp's record ID. The invoice is auto-linked to Acme Corp.

**Discovery:** The system finds these by querying cross-links — find all tables that have a Linked Record field pointing at the current table, then find templates on those tables that include `$context_record` in their `linked_records` config and have `'grid'` or `'table_view'` in `available_in`. Only templates where the link makes structural sense appear.

**Linked Record field "+" button:** In the Record View, clicking "+" on a Linked Record field shows template options alongside the existing search/create flow:

```
Link a record...
  [Search existing records          ]
  ─────────────────────────────────
  + Create blank record
  + Create from: Invoice Template
  + Create from: Quick Invoice
```

Templates shown are those on the target table that have the appropriate `available_in` context.

**Inline sub-table "Add Row":** The "+" at the bottom of an inline sub-table (invoice line items, project tasks) can offer templates for the child table. A "Standard Line Item" template might pre-fill tax rate, unit of measure, and account code. Same split button pattern as the grid "+".

---

## Template Manager (Configuration UI)

Accessed via "Manage templates..." in the picker dropdown, or via **Table Settings → Templates tab**. Manager+ only.

### Template List

```
Table Settings → Templates tab

┌──────────────────────────────────────────────────────────┐
│  Record Templates                              + New     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  📋 Client Onboarding                       ≡ ⚙️ 🗑  │
│  │  Sets 8 fields                                     │  │
│  │  Available in: Grid, Table Views, Portal            │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  📋 Vendor Setup                            ≡ ⚙️ 🗑  │
│  │  Sets 5 fields                                     │  │
│  │  Available in: Grid, Table Views                    │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  📋 Internal Project                 ⭐ Default ≡ ⚙️ 🗑  │
│  │  Sets 12 fields                                    │  │
│  │  Available in: All                                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- ≡ drag handle for reordering (`sort_order`).
- ⚙️ opens the template editor.
- 🗑 deletes with confirmation ("This template is used in 3 automations and 2 views. Delete anyway?").
- ⭐ badge marks the default template.
- Summary line shows field count and availability contexts.

### Template Editor

Clicking ⚙️ or "+ New" opens the template editor. The editor is a **record form** — it shows every field on the table, and the Manager fills in the values they want pre-populated. Uses the same field editors as the Record View (date pickers, select dropdowns, people pickers, checklist editor, etc.). The Manager is literally filling out a model record.

```
┌──────────────────────────────────────────────────────────────┐
│  Template name:  [Client Onboarding              ]           │
│  Description:    [Standard setup for new clients  ]          │
│  Icon:  [📋 ▾]   Color:  [🟢 ▾]                             │
│                                                              │
│  Available in:  ☑ Grid  ☑ Table Views  ☑ Portal              │
│                 ☑ Command Bar  ☑ Quick Entry                  │
│                 ☐ Automation only                             │
│                                                              │
│  ☐ Set as default template                                   │
│                                                              │
│  ── Field Values ──────────────────────────────────────────  │
│                                                              │
│  Status:      [Active ▾]                                     │
│  Priority:    [High ▾]                                       │
│  Assignee:    [$me (creating user) ▾]                        │
│  Due Date:    [$today + 14 days ▾]                           │
│  Checklist:   [✓ Send welcome email    ]                     │
│               [✓ Schedule kickoff      ]                     │
│               [✓ Create shared folder  ]                     │
│               [+ Add item              ]                     │
│  Notes:       [                        ]  ← empty, won't be set │
│                                                              │
│  ── Linked Records ──────────────────────────────────────    │
│                                                              │
│  Client:      [$context record ▾]                            │
│  Team:        [Default Team ▾]                               │
│                                                              │
│                       [Cancel]  [Save Template]              │
└──────────────────────────────────────────────────────────────┘
```

**Dynamic token UI:** Tokens (`$me`, `$today + N`, `$context_record`) appear as special chips in the field editors, selectable from a small token menu. Date fields get a toggle: "Specific date" vs "Relative to creation." People fields get "$me (creating user)" as an option alongside the normal people picker. Linked Record fields get "$context record" as an option alongside the normal record search.

**Empty vs. set indicator:** Fields left empty show a muted "Not set by template" label. This distinguishes "template explicitly sets this to empty string" from "template doesn't touch this field." Clicking a field reveals the editor; clearing a field and confirming resets it to "not set."

**System fields** (created_at, created_by, auto_number, etc.) are not shown in the template editor — they're always auto-populated and cannot be template-overridden.

**Read-only and computed fields** (formulas, lookups, rollups, counts) are not shown — they're derived from other values and cannot be directly set.

---

## Record Creation Flow (End-to-End)

### Step-by-Step Execution

1. **User triggers creation** — clicks "+" button, selects template from picker (or template is auto-applied via `is_default`)
2. **Resolve dynamic tokens** — server-side: `$me` → current user ID, `$today+Nd` → calculated date, `$context_record` → context record ID (if any)
3. **Build field values** — merge: `fields.default_value` ← `record_templates.canonical_data` (resolved tokens)
4. **Validate** — run merged values through `FieldTypeRegistry.validate()` for each field. Validation failures on template values are logged but don't block creation (the field is left at its default or null)
5. **Create record** — insert into `records` with merged `canonical_data`
6. **Create cross-link pairs** — for each entry in `linked_records`, create `cross_link_index` entries through the standard linking path
7. **Set creation source** — tag the creation event with `source: 'template'` and `template: { id, name }`
8. **Fire triggers** — "Record Created" trigger fires with full context including `source` and `template`
9. **Open Record View** — client receives new record, opens Record View with highlight animation on template-populated fields, cursor on first empty field
10. **Register undo** — 5-second undo window, full record deletion on undo

### Validation Failure Handling

If a template value fails validation at creation time (e.g., a referenced select option was deleted since the template was saved), the field is silently left at its field-level default or null. The record is still created. A warning is logged to the audit log: `template.validation_warning` with the field ID and reason. The Manager sees a notification in their template management UI: "Template 'Client Onboarding' has a validation issue — field 'Status' references a deleted option."

This is the right tradeoff — a stale template value shouldn't block record creation. The user can fix the value manually. The Manager gets notified to fix the template.

---

## API Surface

### `POST /api/v1/tables/{tableId}/records`

Existing endpoint, extended with optional `template_id`:

```jsonc
{
  "template_id": "tmpl_abc123", // optional — apply template before canonical_data
  "canonical_data": {
    // optional — overrides template values
    "fld_name": "Acme Corp",
  },
  "context_record_id": "rec_xyz", // optional — resolves $context_record in template
}
```

Resolution order: field defaults → template values → request `canonical_data`. The `canonical_data` in the request body are overrides, same semantics as automation `fieldOverrides`.

### `GET /api/v1/tables/{tableId}/templates`

Returns templates available to the requesting user in the specified context:

```
GET /api/v1/tables/{tableId}/templates?context=api
```

Response: array of `{ id, name, description, icon, color, canonical_data, linked_records, is_default }`. The `canonical_data` contain unresolved tokens (e.g., `$me`, `$today+14d`) — the caller can inspect what the template will do.

### Template CRUD

Standard REST endpoints, Manager+ only:

- `POST /api/v1/tables/{tableId}/templates` — create
- `PATCH /api/v1/tables/{tableId}/templates/{templateId}` — update
- `DELETE /api/v1/tables/{tableId}/templates/{templateId}` — delete
- `PATCH /api/v1/tables/{tableId}/templates/reorder` — bulk sort_order update

---

## Deletion Cascades & Edge Cases

| Event                         | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Template deleted**          | Automations referencing `templateId` in Create Record actions: action config becomes invalid, automation fails with descriptive error on next run, Manager notified. View `template_config.template_ids` entries: stale ID silently ignored (template just disappears from picker). Portal form block `template_id` [post-MVP]: form reverts to no-template behavior (blank record). Command Bar command auto-removed. Quick Entry config: falls back to no defaults. |
| **Field deleted**             | Template `canonical_data` entries referencing deleted field: silently ignored at creation time (key in JSONB has no matching field definition, so it's skipped). No template schema migration needed.                                                                                                                                                                                                                                                                 |
| **Select option deleted**     | Template `canonical_data` referencing deleted option ID: validation failure at creation time → field left at default (see Validation Failure Handling). Manager notified.                                                                                                                                                                                                                                                                                             |
| **Table deleted**             | All `record_templates` for the table deleted (cascade).                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Linked table deleted**      | `linked_records` entries referencing fields on deleted table: cross-link definition deleted, so link creation silently skipped at creation time.                                                                                                                                                                                                                                                                                                                      |
| **Referenced record deleted** | Static record IDs in `linked_records`: link creation silently skipped (target doesn't exist). No error — the rest of the template applies normally.                                                                                                                                                                                                                                                                                                                   |

---

## Real-Time Behavior

| Event                                                             | Effect                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Manager creates/edits/deletes template** (publish_state → live) | `template.updated` event broadcast to workspace. Clients with open template pickers on that table refresh their template list. |
| **Manager changes view template_config**                          | `view.updated` event (existing). Clients reload view config, template picker reflects new settings.                            |
| **Template validation issue detected**                            | `template.validation_warning` event to Manager users. Shown as a badge on the Templates tab in table settings.                 |

---

## What to Defer

**Template duplication and import/export.** Obvious features, second-order. A Manager who wants a similar template creates a new one — the editor is fast. Import/export matters for template marketplace or workspace migration, which is post-MVP.

**Template versioning.** Templates are lightweight config objects, not documents. The audit log captures changes. If someone breaks a template, they edit it. No version history UI needed.

**Template analytics.** "Which template gets used most" is interesting but it's a reporting concern. The audit log and `record_creation_source` context already capture template usage. Build a report later if needed.

**Template A/B testing.** Post-MVP concern if ever.

**AI-generated templates.** "Analyze my records and suggest a template based on the most common field value patterns." Compelling but requires the AI architecture to be mature. Post-MVP — Verticals & Advanced+ at earliest.

---

## Phase Implementation

| Phase                                | Work                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Core UX**                    | `record_templates` table in schema. Template CRUD (Manager+). Template editor UI in table settings. Template picker on "+" button (Grid; Kanban and Calendar are post-MVP view types). `record_creation_source` enum on Record Created trigger context (ships with or without templates — foundational). Single-template `is_default` auto-apply. Record View highlight animation + cursor focus. 5-second undo. Mobile bottom sheet picker. |
| **MVP — Core UX**                    | View `template_config` on view config JSONB (DB: `views.view_config`). All/selected/none modes in `getTemplatesForView()`. Portal form block `template_id` [post-MVP — App Designer block concept].                                                                                                                                                                                                                                          |
| **Post-MVP — Automations**           | Automation integration: `templateId` + `fieldOverrides` on Create Record action. `source` and `template` as filterable fields in Record Created trigger condition builder.                                                                                                                                                                                                                                                                   |
| **Post-MVP — Automations**           | Command Bar auto-registration for templates with `command_bar` in `available_in`.                                                                                                                                                                                                                                                                                                                                                            |
| **Post-MVP — Automations**           | Quick Entry `template_id` config (replaces `default_values`).                                                                                                                                                                                                                                                                                                                                                                                |
| **Post-MVP — Automations**           | Contextual creation shortcuts: right-click "Create linked...", Linked Record field "+" template options, inline sub-table template options.                                                                                                                                                                                                                                                                                                  |
| **Post-MVP — Verticals & Advanced+** | Recipe bundling (templates as part of automation recipe definitions).                                                                                                                                                                                                                                                                                                                                                                        |
| **Post-MVP — Verticals & Advanced+** | API `template_id` parameter on `POST /records`.                                                                                                                                                                                                                                                                                                                                                                                              |

---

## Claude Code Prompt Roadmap

> **⚠️ BUILD SEQUENCE NOTE:** The prompts below are a suggested decomposition of this feature into buildable units. They are **not a build plan**. The active phase build doc controls what to build and in what order. When creating a phase build doc, cherry-pick from these prompts and reorder as needed for the sprint's scope.

### Prompt 1 — Schema & CRUD

Create `record_templates` table migration, Drizzle schema, TypeScript types. Implement data layer: `getTemplatesForContext()`, `getTemplatesForView()`, `createTemplate()`, `updateTemplate()`, `deleteTemplate()` with cascade handling. Implement dynamic token resolution engine (reuse `$me` from view filters, add `$today+Nd` date arithmetic). Implement template value merge logic (field defaults → template → overrides) with `FieldTypeRegistry.validate()` integration. Write validation failure handling (skip invalid, log warning). Add `record_creation_source` enum to record creation code paths — update every call site. Unit tests: token resolution, value merging, validation failure handling, source enum on all creation paths.

### Prompt 2 — Template Manager UI

Build Template Manager panel in Table Settings. Template list with drag-to-reorder, default badge, availability summary. Template editor form reusing Record View field editors. Dynamic token chips in date/people/linked-record editors ($me, $today+N, $context_record). Empty-vs-set field indicators. System/computed field exclusion. Save/cancel flow with validation. "Manage templates..." link from picker dropdown (Manager+ only).

### Prompt 3 — Template Picker UX

Implement template picker dropdown on "+" toolbar button (Grid view; Kanban and Calendar are post-MVP view types — build extension point only). Split button pattern for single-default-template shortcut. Hover tooltip with description + field list. Keyboard navigation (arrows, enter, type-to-filter, escape). Mobile bottom sheet on FAB tap. **[Post-MVP] Kanban view:** column status overrides template status. **[Post-MVP] Calendar view:** slot date overrides template date. `require_template` mode (no blank option). Post-creation Record View: highlight animation (500ms teal fade), cursor-on-first-empty-field. 5-second undo for template-created records.

### Prompt 4 — Table View & Portal Scoping

Add `template_config` to view config JSONB (DB: `views.view_config`). Implement all/selected/none modes in `getTemplatesForView()`. Build view configuration UI for template scoping (in view tab settings: mode picker, template multi-select, require_template toggle, default_template_id picker). **[Post-MVP]** Implement portal form block `template_id` support — template values pre-fill form, hidden template fields silently populated. Test: view scoping filters correctly, portal templates apply [post-MVP], hidden field interaction works.

### Prompt 5 — Automation Integration

Add `source` and `template` to Record Created trigger execution context payload. Add `templateId` + `fieldOverrides` mode to Create Record action config. Builder UI: toggle between "Set fields manually" / "Use a record template" in Create Record action panel, template picker dropdown, overrides section. Add `source` and `template` as filterable condition fields on Record Created trigger (UI: radio buttons for "Any new record" / "From a specific template" / etc.). Test: trigger context includes source on all creation paths, template-based Create Record action resolves correctly, condition filtering works.

### Prompt 6 — Command Bar, Quick Entry & Contextual Shortcuts

Auto-register Command Bar commands for templates with `command_bar` in `available_in`. Lifecycle: create on template create, delete on template delete, update label on template rename. Replace Quick Entry `default_values` with `template_id` reference. Right-click context menu: "Create linked..." submenu discovery via cross-link query + template `$context_record` detection. Linked Record field "+" template options. Inline sub-table "Add Row" template options. Test: Command Bar commands appear/disappear correctly, Quick Entry uses template, contextual creation resolves $context_record.

---

## Key Architectural Decisions

| Decision                                                           | Rationale                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone table, not JSONB on `tables`                            | Templates are CRUD objects with lifecycle, accumulate over time, need FK relationships, need independent queries. JSONB on a hot row is wrong.                                                            |
| No `automation_id` FK on template                                  | Creates parallel execution path requiring dedup. Trigger system with `source` + `template` context handles all the same use cases through a single path.                                                  |
| `record_creation_source` enum ships independently                  | Fixes real automation correctness bugs (imports firing triggers, duplicates re-running onboarding) regardless of template adoption. Foundational.                                                         |
| `canonical_data` uses same JSONB shape as `records.canonical_data` | Same validation pipeline, same FieldTypeRegistry, no special-casing. Template is just a pre-filled record shape.                                                                                          |
| Dynamic tokens reuse existing resolution engines                   | `$me` already exists in view filters. Date arithmetic is a small extension. No new resolution infrastructure.                                                                                             |
| View-contextual values override template values                    | Kanban column status, Calendar slot date, inline sub-table parent link are user intent — the whole point of clicking _there_. Template provides the rest.                                                 |
| `available_in` as VARCHAR array, not single value                  | A template may need to appear in some contexts but not others. Array is the minimal correct model. `'{all}'` shorthand keeps the common case simple.                                                      |
| Hidden Table View fields still receive template values             | Consistent with existing Table View field_override semantics. Enables "invisible data entry" pattern where templates set routing/classification fields users shouldn't see.                               |
| `require_template` is per-view, not per-table                      | Different views on the same table may have different policies. Sales team requires templates, admin team doesn't.                                                                                         |
| Validation failures skip, don't block                              | A stale template value (deleted option, etc.) shouldn't prevent record creation. User can fix manually. Manager gets notified to fix template. Graceful degradation.                                      |
| Persistent empty grid row stays blank-only                         | The empty row is the fastest creation path. Adding template friction to it would slow down the most common interaction in the app. Templates are for intentional, structured creation via the "+" button. |
