# Inventory & Physical Asset Tracking — Platform Primitives

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Changes: (1) Replaced "Interface View" / "Interface system" / `interface_views` terminology with App Designer / App terminology per glossary naming discipline — Quick Entry is now described as a post-MVP App type built in the App Designer, not an "Interface View mode." (2) Replaced "board" view with "Kanban" per glossary view type names. (3) Replaced "Smart Doc merge fields" with "Document Template merge tags" per glossary document terminology. (4) Replaced "portal interfaces" with glossary-correct "Portal" (MVP simple) and "App" (post-MVP) terminology. (5) Added explicit MVP/post-MVP scope tags per glossary MVP Scope Summary — Primitives 1 and 3 are MVP (Adjust Field Value is a listed MVP action); Primitives 2, 4, 5, 6, 7 are post-MVP. (6) Updated cross-reference terminology to match glossary names.

> **Reference doc (Tier 3).** Inventory is not a vertical feature — it is 6 horizontal platform primitives composed into an Inventory Starter Template. Every primitive solves a general class of problem that appears across many business domains. The inventory use case requires all of them working together, making it an excellent forcing function for platform capability.
> Cross-references: `data-model.md` (Barcode field type in 41-type taxonomy, field system, FieldTypeRegistry), `automations.md` (Adjust Field Value action #38, Snapshot/Freeze action #39, Threshold Crossed trigger #16, inventory automation recipes), `tables-and-views.md` (Barcode field UX, default column widths), `ai-data-contract.md` (Barcode field AI translation), `mobile.md` (Camera Scanning & OCR — barcode/QR via zxing-js, Quick Entry mobile UX), `formula-engine.md` (UOM conversion via formula references), `app-designer.md` (Quick Entry as post-MVP App type for warehouse staff), `sync-engine.md` (record quota interaction with bulk receiving), `cross-linking.md` (Products → Suppliers, Stock Movements → Products relational patterns), `project-management.md` (pm_baselines pattern — Snapshot primitive generalizes this), `accounting-integration.md` (invoice snapshot pattern, running balance pattern via Adjust action), `agency-features.md` (asset tracking via Barcode field), `custom-apps.md` (Quick Entry as first-class App block type, Cart block atomic inventory decrement on transaction completion, POS barcode scanning integration, Warehouse Station template), `approval-workflows.md` (Snapshot action #39 generalizes approval-time `record_snapshot_hash` — same SHA-256 freeze-current-state pattern used for compliance hash on approval completion), `record-templates.md` (Quick Entry `template_id` config supersedes `default_values` — templates provide structured pre-fill for rapid scan/receiving workflows), `bulk-operations.md` (bulk edit "Adjust by" mode for Number fields with `allow_atomic_adjust: true` uses `adjustFieldValue()` for atomic quantity operations — bulk inventory adjustment pattern)
> Implements: `apps/web/src/actions/CLAUDE.md` (atomic delta mutation pattern), `packages/shared/db/CLAUDE.md` (server-side JSONB delta operation), `cockroachdb-readiness.md` (`adjustFieldValue` raw SQL tracked as CockroachDB compatibility surface — `jsonb_set` verified compatible)
> Last updated: 2026-02-27 — Glossary reconciliation. Prior: 2026-02-21 — Added `bulk-operations.md` cross-reference (bulk adjust pattern for atomic quantity operations).

---

## Strategic Rationale

Inventory tracking is a horizontal capability that the majority of SMBs require in some form. EveryStack's target market of 2–50 person businesses includes organizations that track physical goods, materials, supplies, or assets — even when their primary business is not retail or distribution: service businesses (plumbing, HVAC, cleaning), professional services (salons, dental, veterinary), production (print shops, bakeries), retail and food service, nonprofits, and internal operations (IT equipment, office supplies, marketing materials).

The common thread: they have stuff, they consume or sell stuff, and they need to know what they have and when to reorder. Not having inventory capabilities at or near MVP means turning away a significant portion of the target market.

---

## Current Architecture Assessment

### What Already Works

EveryStack's existing data model handles the catalog and relational side well. A Products table using the current record architecture supports product identity (text, files, auto-number for SKUs), financial data (currency, percent, formula), classification (single select, tags, status), relationships (linked records to Suppliers, Categories, Locations, Purchase Orders — including cross-base linking), aggregation (rollup, count, lookup), and visual browsing (Gallery, Kanban, Grid views).

### Where the Gaps Are

Six specific, well-defined gaps — ranging from a new field type to a fundamental mutation pattern. None require rethinking the core data model. They are additive capabilities.

---

## Primitive 1: Atomic Quantity Operations

**Priority:** Critical — foundational to the entire use case
**Scope:** MVP — Core UX (number field mutation extension)
**MVP scope:** ✅ **MVP** — underpins the "Adjust Field Value" action listed in glossary MVP actions
**Dependencies:** None — foundational

### Problem

The current architecture uses last-write-wins for all field edits. Quantity fields are fundamentally transactional. When a grocery store clerk scans 50 cans into receiving while a cashier sells 3 at the register, last-write-wins produces incorrect results.

**Race condition:** User A reads 100, User B reads 100. A writes 103 (received 3), B writes 97 (sold 3). Final value is 103 or 97 depending on timing. Correct answer is 100.

### Technical Approach

Introduce a delta operation at the API layer: `adjustFieldValue(recordId, fieldId, delta)` that executes as a single atomic Postgres statement. The SQL uses `jsonb_set` to compute the new value server-side rather than reading, computing client-side, and writing back.

```typescript
// Server Action — apps/web/src/actions/records.ts
export async function adjustFieldValue(input: AdjustFieldInput) {
  const { recordId, fieldId, delta } = adjustFieldSchema.parse(input);
  const tenantId = await getTenantId();

  // Atomic server-side increment/decrement
  await db.execute(sql`
    UPDATE records
    SET canonical_data = jsonb_set(
      canonical_data,
      ${`{${fieldId}}`}::text[],
      to_jsonb((canonical_data->>${{ fieldId }})::numeric + ${delta})
    ),
    updated_at = now()
    WHERE id = ${recordId}
    AND tenant_id = ${tenantId}
  `);
}
```

Implemented as an opt-in behavior on number fields via `config.allow_atomic_adjust: boolean`, plus a distinct automation action type (see Primitive 3). The number field's storage and display remain unchanged — only the mutation path adds the delta operation as an alternative to direct-set.

### Cross-Domain Value

| Domain             | Use Case                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ |
| Project Management | Multiple team members logging hours against the same task simultaneously             |
| Finance / Budgets  | Concurrent expense submissions reducing a shared budget pool                         |
| Event Management   | Ticket sales decrementing available capacity from multiple sales channels            |
| Voting / Scoring   | Team members simultaneously voting or scoring records                                |
| Credit Systems     | AI credit balances, loyalty points, internal currency adjusted by multiple processes |
| Resource Pools     | Shared equipment, meeting rooms, vehicle fleets with concurrent checkout/return      |

### Implementation Notes

- The `adjustFieldValue` Server Action follows the standard mutation pattern in `apps/web/src/actions/CLAUDE.md` — Zod validation, tenant isolation, audit log, real-time event, revalidation — but replaces the standard `UPDATE SET` with the atomic `jsonb_set` arithmetic.
- The raw SQL exception to the "Drizzle ORM Only" rule (root CLAUDE.md Rule #10) is acceptable here because Drizzle does not support atomic JSONB arithmetic expressions. The pattern is isolated to a single function in the data layer, documented with a `// Raw SQL: atomic JSONB delta — Drizzle cannot express this` comment.
- Formula fields that depend on an atomically adjusted field recompute normally — the dependency graph triggers on the `updated_at` change.
- Sync engine: atomic adjustments emit standard `record.updated` events. Outbound sync sees the final value, not the delta. No sync adapter changes needed.
- Audit log records the delta, not just the final value: `details: { fieldId, delta, previousValue, newValue }`.

---

## Primitive 2: Barcode / QR Code Field Type

**Priority:** Critical — the unlock for the entire vertical
**Scope:** MVP — Core UX (alongside the other field types in the taxonomy)
**MVP scope:** ⏳ **Post-MVP** — Barcode is not included in the glossary's MVP field categories (Text, Number, Date, Select/Multi-Select, Checkbox, Email, Phone, URL, Attachment, Linked Record, Auto-Number, Created/Modified timestamps)
**Dependencies:** Field type registry (MVP — Core UX), mobile camera scanning (MVP — Core UX Stream H)

### Field Type Specification

Added to the field type taxonomy as type #41 in Category 2 (Number) — or arguably its own category, but storage is string-based. See `data-model.md` for the canonical entry.

| Property                 | Value                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Key**                  | `barcode`                                                                                                                                                       |
| **Storage**              | string                                                                                                                                                          |
| **Config**               | `format` (auto \| upc \| ean \| code128 \| qr \| code39), `allow_manual_entry` (boolean, default: true), `unique` (boolean, default: true — enforced per table) |
| **Display**              | Rendered as text value + small barcode icon. Hover/click shows visual barcode rendering (via client-side library). QR codes render as thumbnail in grid cell.   |
| **Default column width** | 140px (already specified in `tables-and-views.md`)                                                                                                              |
| **Searchable**           | Yes — tsvector weight B                                                                                                                                         |

### Scan-to-Find-Record

The critical UX is a **scan-to-find-record mode**: scan a barcode, and the system immediately navigates to the matching record or offers to create one if no match exists.

**Desktop:** USB barcode scanners emit keystrokes. A focused input field in the Command Bar or a dedicated scan mode captures scans with near-zero additional development. Detection: rapid keystroke sequence (>5 chars in <100ms) ending with Enter.

**Mobile:** Camera-based scanning via `zxing-js` (already specified in `mobile.md` > Camera Scanning & OCR). The scan flow: camera opens → barcode decoded client-side → API lookup by barcode value → navigate to record or offer creation.

**API:** `GET /api/v1/records/lookup?field_type=barcode&value={scannedValue}&table_id={tableId}` — returns matching record or 404.

### Cross-Domain Value

| Domain             | Use Case                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| Asset Tracking     | IT departments scanning laptop/equipment asset tags for check-in/check-out       |
| Event Check-In     | Conference/event registration scanning attendee QR badges                        |
| Package / Mail     | Mailrooms or logistics teams scanning packages for tracking                      |
| Equipment Checkout | Libraries, tool cribs, AV departments scanning items for lending/return          |
| Field Inspections  | Scanning equipment tags during safety inspections to pull up maintenance history |
| Document Tracking  | Law firms or medical offices scanning barcoded file folders                      |

### Implementation Notes

- FieldTypeRegistry registration follows the standard pattern in `data-model.md` > Field Type Registry.
- `canonicalToAIContext()`: returns the barcode string value as-is. AI sees `"barcode": "012345678901"`.
- `aiToCanonical()`: accepts string, validates format if `config.format` is not `auto`, stores as string.
- `toExportValue()`: plain string. `toTemplateValue()`: plain string (for Document Template merge tags).
- Unique constraint enforcement: `CREATE UNIQUE INDEX` on `(tenant_id, table_id, canonical_data->>'{fieldId}')` when `config.unique: true`. Checked at insert/update time with friendly error message.
- Mobile scanning already specified in `mobile.md` — this field type is the storage target for those scans.

---

## Primitive 3: Adjust Field Automation Action

**Priority:** High — pairs with Atomic Operations to enable the transaction log pattern
**Scope:** Post-MVP — Automations (automation engine)
**MVP scope:** ✅ **MVP** — "Adjust Field Value" is explicitly listed as one of the 7 MVP automation actions in the glossary (atomic increment/decrement on a number field)
**Dependencies:** Atomic operations (Primitive 1) + automation engine (Post-MVP — Automations)

### Action Specification

**Action #38 — Adjust Field Value.** Increments or decrements a number field by a dynamic amount resolved from the execution context.

```typescript
// Action config
{
  action_type: "adjust_number_field",
  config: {
    target_record: "{{trigger.linked_record.product_id}}", // record to adjust
    target_field_id: "field_quantity",                       // number field to adjust
    delta_template: "{{trigger.record.quantity}}",           // amount (positive = add, negative = subtract)
    negate: true,  // optional: flip sign (useful for "sold" movements where quantity is stored as positive)
  }
}
```

Internally calls `adjustFieldValue()` from Primitive 1 — the same atomic server-side operation. Never reads-then-writes.

### The Transaction Log Pattern

This is the core inventory pattern: a new record in a **Stock Movements** table triggers an automation that reads the movement quantity and type, then atomically adjusts the product's quantity field. "Received 50" adds 50. "Sold 3" subtracts 3. "Damaged 2" subtracts 2. The product's quantity field is never directly edited — it is always the result of movements.

### Cross-Domain Value

| Domain                  | Use Case                                                   |
| ----------------------- | ---------------------------------------------------------- |
| Running Balances        | Invoice payments adjusting an outstanding balance          |
| Budget Drawdown         | Expense records reducing a department's remaining budget   |
| Capacity Management     | Booking confirmations decrementing available spots         |
| Point / Loyalty Systems | Customer actions adjusting loyalty point balances          |
| Hour Tracking           | Time entries incrementing logged hours on a project record |

---

## Primitive 4: Quick Entry / Rapid Scan App _(Post-MVP)_

**Priority:** High — essential UX for physical counting and receiving workflows
**Scope:** Post-MVP — Automations / Comms & Polish (depends on Barcode field + App Designer)
**MVP scope:** ⏳ **Post-MVP** — Quick Entry requires the App Designer (post-MVP per glossary). MVP Portals are simple single-record Record View shares and do not support specialized input modes. Quick Entry would be built as a post-MVP App type in the App Designer.
**Dependencies:** Barcode field (Primitive 2), App Designer (post-MVP), Portals (Post-MVP — Portals & Apps for Quick Portal access; post-MVP App Designer for full Quick Entry App)

### Workflow

1. Scan a barcode or tap to select a product from a filtered list.
2. System auto-finds the matching record, or offers to create one if no match exists.
3. Default quantity is +1, but the user can type a different number.
4. Each entry creates a movement record and atomically adjusts the product quantity.
5. A running tally is visible on screen showing progress and session totals.
6. Works on mobile devices — warehouse and stockroom staff are on phones and tablets.

### Technical Approach

Quick Entry is a **post-MVP App type** built in the App Designer — a stripped-down, focused application optimized for speed. It is not a Table View type but a custom App with a specialized layout:

- The App defines: target table (for new records), lookup field (barcode or text), default values, visible fields (minimal set), and the automation to trigger on each entry.
- On mobile: full-screen mode with large scan button, numeric keypad for quantity, and session summary.
- On tablet/desktop: split panel — scan/entry on left, running log on right.
- Warehouse staff access Quick Entry through a post-MVP custom Portal App without needing workspace accounts.

### Cross-Domain Value

| Domain                | Use Case                                                                   |
| --------------------- | -------------------------------------------------------------------------- |
| Time Logging          | Field workers rapidly logging time entries against projects                |
| Inspection Checklists | Safety inspectors scanning equipment tags and recording pass/fail          |
| Attendance Tracking   | Scanning employee/student badges for fast check-in                         |
| Field Data Collection | Agriculture, environmental, or construction workers capturing measurements |
| Order Fulfillment     | Warehouse pickers scanning items as they pull them for orders              |

---

## Primitive 5: Snapshot / Freeze Automation Action _(Post-MVP)_

**Priority:** Medium — enables stocktake reconciliation and baseline use cases
**Scope:** Post-MVP — Automations (automation engine)
**MVP scope:** ⏳ **Post-MVP** — Snapshot is not included in the glossary's 7 MVP automation actions (Send Email, Create Record, Update Record, Generate Document, Send Notification, Adjust Field Value, Send Webhook)
**Dependencies:** Automation engine (Post-MVP — Automations), Linked Record fields

### Action Specification

**Action #39 — Snapshot Linked Record Values.** Copies current values from linked records into fields on the triggering record — a point-in-time snapshot.

```typescript
// Action config
{
  action_type: "snapshot_linked_values",
  config: {
    source_link_field_id: "field_product_link",      // linked record field on trigger record
    field_mappings: [
      { source_field_id: "field_quantity", target_field_id: "field_expected_qty" },
      { source_field_id: "field_unit_cost", target_field_id: "field_snapshot_cost" },
    ],
    // For multi-link fields: creates one snapshot per linked record
    // or aggregates (sum/avg/first) depending on target field cardinality
  }
}
```

### Relationship to pm_baselines

The `pm_baselines` system in `project-management.md` already captures planned start/end/duration snapshots for project tasks. This Snapshot action is the **generalized version** of that bespoke baseline implementation. Post-MVP, the PM baseline system could potentially be refactored to use the universal Snapshot primitive internally, reducing special-case code.

### Cross-Domain Value

| Domain              | Use Case                                                   |
| ------------------- | ---------------------------------------------------------- |
| Project Baselines   | Snapshot planned dates/durations at project kick-off       |
| Invoice Line Items  | Freeze current price/rate/terms when generating an invoice |
| Audit Checkpoints   | Capture record state at the time an approval is granted    |
| Contract Terms      | Freeze negotiated rates at contract signing                |
| Performance Reviews | Capture metric values at start of review period            |

---

## Primitive 6: Threshold-Based Triggers _(Post-MVP)_

**Priority:** Medium — enables proactive alerts without manual monitoring
**Scope:** Post-MVP — Automations (automation trigger system)
**MVP scope:** ⏳ **Post-MVP** — Threshold Crossed is not included in the glossary's 6 MVP automation triggers (Record Created, Record Updated, Field Value Changed, Form Submitted, Button Clicked, Scheduled)
**Dependencies:** Automation trigger system (Post-MVP — Automations)

### Trigger Specification

**Trigger #16 — Threshold Crossed.** Monitors a specific numeric field crossing a configured boundary value. Fires **once** when the threshold is crossed, not on every subsequent edit that remains past the threshold.

```typescript
// Trigger config
{
  trigger_type: "threshold_crossed",
  config: {
    field_id: "field_quantity",
    operator: "less_than",          // less_than | greater_than | less_than_or_equal | greater_than_or_equal
    threshold_value: 10,            // static value
    // OR
    threshold_field_id: "field_reorder_point",  // dynamic: compare against another field on the same record
    direction: "falling",           // falling | rising | both — prevents re-firing on fluctuations
    cooldown_minutes: 60,           // optional: minimum time between re-fires for the same record
  }
}
```

**Performance:** More efficient than a generic formula-based trigger for high-volume operations. The trigger evaluates only when the monitored field changes (piggybacks on `field_value_changed` event), compares old vs new value against threshold, and fires only on the crossing event.

### Cross-Domain Value

| Domain            | Use Case                                                             |
| ----------------- | -------------------------------------------------------------------- |
| Budget Alerts     | Notify when spending reaches 80% of quarterly allocation             |
| SLA Monitoring    | Escalation when open ticket count exceeds team capacity              |
| Sales Pipeline    | Alert when deal value crosses threshold requiring executive approval |
| Capacity Warnings | Notify when registration hits 90% of venue capacity                  |
| Project Health    | Trigger review workflow when burn rate exceeds planned budget        |

---

## The Stocktake Workflow

A critical composed workflow that demonstrates how the 6 primitives work together. This is reconciliation — fundamentally different from day-to-day quantity adjustments.

> **Note:** The full Stocktake Workflow requires all 6 primitives, including post-MVP capabilities (Barcode field, Quick Entry App, Snapshot action, Threshold triggers). This workflow ships as a complete template post-MVP once all primitives are in place.

### Process

1. **Initiate a count session.** A person starts a count with a defined scope (all products, one location, one category, or a custom filter). The system records who, when, and what.
2. **Freeze expected quantities.** At count initiation, the Snapshot action (Primitive 5, post-MVP) captures current quantities for every product in scope. Transactions during the count do not change expected values.
3. **Count physical stock.** Quick Entry App (Primitive 4, post-MVP): scan barcode, enter quantity. Stripped-down interface — product identification and quantity only.
4. **Review discrepancies.** System displays every item where actual ≠ expected: expected 47, counted 42, variance −5. Zero-variance items confirmed correct.
5. **Resolve and finalize.** For each discrepancy: accept (creates adjustment movement) or flag for investigation. On finalization, adjustment movements fire and product quantities update to match reality.

### Data Architecture

Three interconnected tables, all built using standard EveryStack table and field types:

| Table                | Key Fields                                                                                                                                               | Purpose                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Products**         | Name, Barcode, Category, Quantity, Reorder Point, Unit Cost, Supplier Link                                                                               | Master catalog. Quantity maintained by movement automation, never direct edits.                                  |
| **Stock Movements**  | Product Link, Type (received / used / sold / damaged / adjusted / counted), Quantity, Date, User, Notes                                                  | The ledger. Every quantity change is a record. Automations drive all product quantity updates via atomic adjust. |
| **Inventory Counts** | Status (in progress / reviewing / finalized), Date, Counter, Scope, Count Lines (linked table: Product Link, Expected Qty, Actual Qty, Variance formula) | Stocktake sessions. Finalizing creates adjustment movements for every line with non-zero variance.               |

The reconciliation step is an automation: when a count's status changes to "finalized," for every count line where actual ≠ expected, create an adjustment movement in Stock Movements. That movement triggers the standard quantity-adjust automation on the product.

---

## Unit of Measure Handling

**Priority:** Low — deferrable beyond initial implementation.
**MVP scope:** ⏳ **Post-MVP** — requires the formula engine (post-MVP per glossary).

Businesses frequently buy, store, and consume in different units (pallets → bags → pounds). This could be addressed by adding UOM configuration to number fields with a conversion table, or by encouraging a separate Units lookup table that formulas reference. The conversion math flows through the formula engine: "received 2 pallets" evaluates as +96 bags via a formula referencing the conversion factor.

Most SMBs track in a single unit (each, bag, bottle, box) and do conversion manually. Full UOM support is a refinement, not a blocker.

---

## What Not to Build

Explicit boundaries to prevent overengineering for the SMB audience:

- **Warehouse bin/location management with pick paths.** Linked records to a Locations table covers multi-location. Physical warehouse optimization is ERP territory.
- **Serial number tracking.** A text field with unique constraint handles the basics for businesses that need it.
- **Batch and lot tracking with expiry management.** Critical for food/pharma but requires specialized compliance (FDA traceability, FEFO rotation logic) that exceeds a no-code platform's scope.
- **Full purchase order lifecycle.** Just tables, automations, and optionally a supplier portal. Existing architecture handles it — template pattern, not platform feature.
- **Demand forecasting and automated reorder.** Future AI capability. Threshold alerts cover the immediate need.

---

## Implementation Priority & Phase Mapping

| #   | Primitive                           | Priority | Target Phase             | MVP Scope   | Dependency                     |
| --- | ----------------------------------- | -------- | ------------------------ | ----------- | ------------------------------ |
| 1   | Atomic Quantity Operations          | Critical | MVP — Core UX            | ✅ MVP      | None — foundational            |
| 2   | Barcode Field Type + Scan-to-Lookup | Critical | MVP — Core UX            | ⏳ Post-MVP | Field type registry            |
| 3   | Adjust Field Value Action (#38)     | High     | Post-MVP — Automations   | ✅ MVP      | Atomic ops + automation engine |
| 4   | Quick Entry / Rapid Scan App        | High     | Post-MVP — Automations–7 | ⏳ Post-MVP | Barcode + App Designer         |
| 5   | Snapshot / Freeze Action (#39)      | Medium   | Post-MVP — Automations   | ⏳ Post-MVP | Automation engine              |
| 6   | Threshold-Based Triggers (#16)      | Medium   | Post-MVP — Automations   | ⏳ Post-MVP | Automation trigger system      |
| 7   | Unit of Measure Support             | Low      | Post-MVP                 | ⏳ Post-MVP | Formula engine                 |

**Template delivery:** The Inventory Starter Template ships as soon as all primitives are in place, targeting late Post-MVP — Comms & Polish or immediately post-MVP. The template is a pre-built base containing Products, Stock Movements, and Inventory Counts tables with automations pre-wired for quantity adjustments, low-stock alerts, and count reconciliation.

---

## Claude Code Prompt Roadmap

Covers Prompt 1: Atomic Quantity Operations, Prompt 2: Barcode Field Type, Prompt 3: Adjust Field Action + Snapshot Action, Prompt 4: Threshold Trigger, Prompt 5: Quick Entry App, Prompt 6: Inventory Starter Template.
Touches `field_value_changed` tables. See `data-model.md`, `inventory-capabilities.md`, `tables-and-views.md`.

> **⚠️ BUILD SEQUENCE NOTE:** The prompts below are a suggested decomposition of this feature into buildable units. They are **not a build plan**. The active phase build doc controls what to build and in what order. When creating a phase build doc, cherry-pick from these prompts and reorder as needed for the sprint's scope.

### Prompt 1: Atomic Quantity Operations

**Context to load:** `data-model.md` (number field config), `apps/web/src/actions/CLAUDE.md` (mutation pattern), `packages/shared/db/CLAUDE.md` (query patterns), `inventory-capabilities.md` (this doc, Primitive 1)

**Deliverables:**

1. Add `allow_atomic_adjust: boolean` to number field config in `data-model.md` field type registry.
2. Create `adjustFieldValue()` Server Action in `apps/web/src/actions/records.ts` following standard mutation pattern but with atomic JSONB delta SQL.
3. Create `/data` helper `atomicAdjustField()` in data layer with Drizzle + raw SQL escape hatch.
4. Audit log integration: log delta, previous value, new value.
5. Real-time event: standard `record.updated` with `mutation_type: 'atomic_adjust'` metadata.
6. Tests: concurrent adjust race condition test (2 simultaneous adjustments produce correct sum), negative balance test, non-number field rejection.

### Prompt 2: Barcode Field Type

**Context to load:** `data-model.md` (field type taxonomy, FieldTypeRegistry), `tables-and-views.md` (column widths, cell rendering), `ai-data-contract.md` (AI translation functions), `mobile.md` (Camera Scanning & OCR), `inventory-capabilities.md` (this doc, Primitive 2)

**Deliverables:**

1. Register `barcode` in FieldTypeRegistry with storage, config, validation, renderers.
2. Cell renderer: text value + barcode icon. Hover/click renders visual barcode. QR thumbnail in grid.
3. Unique index creation when `config.unique: true`.
4. `canonicalToAIContext()` and `aiToCanonical()` implementations.
5. Desktop scan detection: rapid keystroke listener (>5 chars in <100ms ending with Enter).
6. Record lookup API: `GET /api/v1/records/lookup?field_type=barcode&value=...&table_id=...`
7. Tests: unique constraint enforcement, format validation, scan detection, lookup API.

### Prompt 3: Adjust Field Action + Snapshot Action

**Context to load:** `automations.md` (action system, execution model, template resolution), `inventory-capabilities.md` (this doc, Primitives 3 + 5)

**Deliverables:**

1. Action #38 (Adjust Field Value): config schema, execution handler calling `atomicAdjustField()`, template resolution for dynamic delta. _(MVP)_
2. Action #39 (Snapshot Linked Record Values): config schema, execution handler reading linked records and copying field values. _(Post-MVP)_
3. Register both in action catalog with config UI components.
4. Tests: adjust action with template resolution, snapshot with multi-link fields, error handling for non-number target fields.

### Prompt 4: Threshold Trigger

**Context to load:** `automations.md` (trigger system, TriggerRegistry, deduplication), `inventory-capabilities.md` (this doc, Primitive 6)

**Deliverables:**

1. Trigger #16 (Threshold Crossed): config schema, detection logic piggybacking on `field_value_changed` events.
2. Crossing detection: compare old value vs threshold and new value vs threshold — fire only on the crossing event.
3. Direction filtering (falling/rising/both) and cooldown enforcement.
4. Dynamic threshold support (field reference instead of static value).
5. Register in TriggerRegistry.
6. Tests: crossing detection, direction filtering, cooldown, dynamic threshold, no-fire when already past threshold.

### Prompt 5: Quick Entry App

**Context to load:** `tables-and-views.md` (Table Views, view config), `app-designer.md` (App types, App block system), `mobile.md` (mobile input optimization), `inventory-capabilities.md` (this doc, Primitive 4)

**Deliverables:**

1. Quick Entry App type schema in the App Designer.
2. Quick Entry UI component: scan/select → quantity → confirm → running tally.
3. Mobile layout: full-screen with large scan button + numeric keypad.
4. Desktop/tablet layout: split panel (entry left, log right).
5. Portal App compatibility: Quick Entry available as a custom Portal App for warehouse staff.
6. Session tracking: entry count, session totals, undo last entry.
7. Tests: scan-to-entry flow, quantity adjustment, session totals, App access, mobile layout.

### Prompt 6: Inventory Starter Template

**Context to load:** `inventory-capabilities.md` (this doc — full spec), `automations.md` (recipe system), `tables-and-views.md` (template patterns)

**Deliverables:**

1. Template definition: Products, Stock Movements, Inventory Counts tables with field definitions.
2. Pre-wired automations: movement → quantity adjust, low-stock threshold → notification, count finalization → adjustment movements.
3. Quick Entry App pre-configured for receiving workflow.
4. Template installer: creates tables, fields, automations, and App from template definition.
5. Documentation: in-app onboarding guide for the template.

---

## Key Architectural Decisions

| Decision                                     | Rationale                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primitives, not features**                 | Every primitive is broadly useful. Inventory is the forcing function, not the product.                                                             |
| **Template as delivery vehicle**             | Progressive disclosure: the plumber does not need to understand atomic operations. They add products, log usage, and press "Count Inventory."      |
| **Atomic adjust as JSONB delta**             | Server-side computation eliminates race conditions. The raw SQL exception is isolated and documented.                                              |
| **Barcode as field type, not app feature**   | Integrates naturally with existing field system, formula engine, AI, sync, and permissions.                                                        |
| **Threshold triggers vs formula conditions** | Threshold triggers fire once on crossing. Formula conditions evaluate on every edit — too noisy for high-volume operations.                        |
| **Quick Entry as App type**                  | Built in the App Designer (post-MVP) rather than creating a parallel UX architecture. Reuses App block system and is Portal-compatible by default. |
| **Snapshot as automation action**            | Generalizes the pm_baselines pattern. Any record can snapshot linked values at any trigger point.                                                  |
| **UOM deferred**                             | Most SMBs track in single units. Formula engine handles conversion math when needed.                                                               |
