# EveryStack — Bulk Operations

> **Glossary reconciliation: 2026-02-27 (rev 2)**
> Changes made to align with `GLOSSARY.md` (source of truth):
>
> - **DB table `interface_views` → `views`** throughout. Glossary DB Entity Quick Reference defines `Table View | views | id, tenant_id, table_id, view_type, config (JSONB)`. All code/schema references now use `views` as the canonical DB table name. Prior reconciliation incorrectly retained `interface_views` with mapping notes; glossary wins.
> - **"Interface" references** in permission context → "Table View" / "view" throughout.
> - **Approval workflow references** tagged **[Post-MVP]** where they describe approval-gated behavior (glossary: Approval workflows = Post-MVP). Core bulk operations remain MVP; approval-related exclusion logic is defensive scaffolding that's harmless when approvals don't exist.
> - **"Board/Calendar/Timeline views"** → **"Kanban/Calendar views"** per glossary naming; tagged **[Post-MVP]** (glossary MVP views: Grid + Card only). "Timeline" removed (not a glossary-defined view type).
> - **Formula cascade handling** section tagged **[Post-MVP]** (glossary: Formula engine = Post-MVP).
> - **Cross-link cascade references** remain as-is (cross-linking is MVP; cascade maintenance is part of MVP cross-link infrastructure).
> - **Phase tags reviewed**: MVP — Core UX bulk ops cross-checked against glossary MVP scope. Approval-dependent behaviors, formula cascades, and post-MVP view types clearly labeled.
> - **`gaps/tables-interface-boundaries.md` → `gaps/tables-views-boundaries.md`** — file renamed to align with glossary naming ("Table View" not "Interface"). Cross-reference in this doc updated.

> **Reference doc (Tier 3).** Multi-record selection model, bulk action toolbar, batch server action pattern, permission gating, approval workflow exclusion [post-MVP behavior], bulk edit field picker, bulk delete impact preview, audit log condensation for user-initiated bulk actions, real-time event batching, formula cascade throttling [post-MVP], automation trigger batching.
> Cross-references: `tables-and-views.md` (grid selection model, checkbox column, bulk actions toolbar, row behavior), `permissions.md` (workspace roles, field-level permissions, Table View operation flags), `gaps/tables-views-boundaries.md` (`allow_create`/`allow_edit`/`allow_delete` on Table View config — DB: `views`), `approval-workflows.md` (status transition enforcement, precondition evaluation, approval gates — excluded from bulk edit) [post-MVP], `audit-log.md` (seven-source attribution, bulk operation condensation — extended for user-initiated bulk), `automations.md` (batch mode triggers, debounce, rate caps, outbound webhook condensation), `realtime.md` (Redis pub/sub event bus — extended with batch event shape), `formula-engine.md` (dependency graph, cascade recalculation — bulk-aware throttling) [post-MVP], `cross-linking.md` (cascade engineering, display value maintenance, impact analysis), `sync-engine.md` (sync batch condensation pattern — reused for user bulk), `data-model.md` (canonical_data JSONB, records table), `inventory-capabilities.md` (atomic quantity operations — bulk adjust pattern), `record-templates.md` (bulk create from template)
> Last updated: 2026-02-27 — Glossary reconciliation rev 2 (DB table name `interface_views` → `views`). Prior: 2026-02-27 — Glossary reconciliation (naming, MVP scope tagging). Prior: 2026-02-21 — Initial specification from strategic design session.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                                                                                    | Lines   | Covers                                                            |
| ---------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Strategic Rationale                                                                                        | 50–57   | Why bulk operations, user scenarios                               |
| Core Design Principles                                                                                     | 58–71   | Binary gating, no partial success, undo-friendly                  |
| Selection Model                                                                                            | 72–87   | Checkbox column, shift-click range, 5K cap, select-all            |
| Bulk Actions Toolbar                                                                                       | 88–109  | 7 actions, toolbar UX, permission gating                          |
| Bulk Edit                                                                                                  | 110–158 | Multi-field edit dialog, preview, confirmation                    |
| Bulk Delete                                                                                                | 159–193 | Soft delete, confirmation dialog, undo window                     |
| Bulk Duplicate                                                                                             | 194–206 | Duplicate with/without links, naming convention                   |
| Bulk Assign                                                                                                | 207–214 | Assign people/status field to selected records                    |
| Bulk Export Selection                                                                                      | 215–228 | Export selected records to CSV/Excel                              |
| Bulk Trigger Automation                                                                                    | 229–254 | Run automation on selected records                                |
| Bulk Checklist Item Update **[Post-MVP — depends on approval workflows, which are post-MVP per glossary]** | 255–269 | Batch update checklist fields                                     |
| Batch Server Action Pattern                                                                                | 270–386 | Server-side bulk processing, transaction handling, error rollback |
| Audit Log Extension                                                                                        | 387–422 | Condensed audit entries, record_ids_affected[], truncation flag   |
| Real-Time Event Batching                                                                                   | 423–466 | Batch Socket.io events, condensation matching sync pattern        |
| Formula Cascade Handling **[Post-MVP — formula engine is post-MVP per glossary]**                          | 467–485 | Throttled formula recalculation after bulk edits                  |
| Automation Trigger Batching                                                                                | 486–501 | Deduplication for automation triggers from bulk operations        |
| Undo Behavior                                                                                              | 502–518 | Undo for ≤50 records, undo window, limitations                    |
| Mobile Behavior                                                                                            | 519–532 | Mobile bulk selection, action sheet, touch gestures               |
| Phase Implementation                                                                                       | 533–541 | MVP — Core UX delivery scope                                      |
| Key Architectural Decisions                                                                                | 542–560 | ADR-style decisions with rationale                                |
| Future Extensions                                                                                          | 561–571 | Deferred bulk operation features                                  |

---

## Strategic Rationale

The grid supports multi-select. The data layer supports batch Drizzle operations. The audit log supports condensation. The automation engine supports batch-mode triggers. But there is no spec connecting these pieces into a coherent bulk operations story. Any team managing records at scale — processing invoices, updating project statuses, reassigning accounts, closing out sprints — needs bulk operations as daily workflow. Without them, EveryStack forces users into repetitive single-record edits, which is the exact pain point the platform exists to eliminate.

The key design insight: **bulk operations split cleanly into gated and ungated actions.** Gated actions (delete, approval-dependent field changes) are binary — either fully permitted or fully excluded for the acting user. Ungated actions (normal field edits, duplicate, copy, assign, trigger automation) execute uniformly across the selection because nothing record-specific causes divergence. This eliminates the partial-success problem entirely, which is the hardest UX challenge in bulk operation design.

---

## Core Design Principles

1. **Binary gating, not partial success.** Every bulk action either applies to all selected records or is unavailable. The system never produces a mixed result where 180 records succeed and 20 fail. This is achieved by pre-resolving permission and eligibility before the action is offered.

2. **Approval-gated fields are excluded from bulk edit [Post-MVP behavior — approval workflows are post-MVP per glossary. This exclusion logic is defensive scaffolding: harmless when approvals don't exist, correct when they ship].** Status fields with `transitions.enabled: true` do not appear in the bulk edit field picker. Approval workflows exist because those transitions matter enough to evaluate individually. Bulk-overriding an approval gate is an anti-pattern, not a feature. Advancing records toward transitions (bulk-checking approval checklist items) is the legitimate bulk accelerator.

3. **Delete is a table-level permission gate.** Delete permission is resolved per role per Table View via `allow_delete` on the Table View config (DB: `views`). If the user can see the Delete button, they can delete everything they've selected. No per-record delete evaluation.

4. **Bulk actions are a UX layer over the same data primitives.** The batch server action wraps existing single-record data functions (from `apps/web/src/data/`) in a transaction. No new data access patterns. No special bulk-only Drizzle queries. The same `updateRecord()`, `deleteRecord()`, and `writeAuditLog()` functions, called in a loop within a single transaction, with condensed audit and batched real-time events.

5. **Progressive disclosure governs the toolbar.** The bulk actions toolbar appears only when 2+ records are selected. Actions that the user lacks permission for are hidden, not disabled. The toolbar is context-aware — available actions depend on the table, the user's role, and the Table View configuration.

---

## Selection Model

Defined in `tables-and-views.md` — summarized here for context.

**Row selection:** Always-visible checkbox column, pinned leftmost. Header checkbox selects all visible records. Selection respects active filters — filtered-out records are never selected, even via "select all."

**Selection ceiling:** The header checkbox selects all records matching the current view filter, not just the visible page. If a filtered view contains 2,400 records and the user clicks the header checkbox, all 2,400 are selected. The toolbar displays the count: "2,400 records selected."

**Selection cap:** Maximum 5,000 records per bulk operation. If "select all" would exceed 5,000, the toolbar shows: "5,000 of 12,340 records selected (bulk actions limited to 5,000)." The selection includes the first 5,000 records in the current sort order. This cap exists to keep batch transactions within reasonable database time limits and to prevent accidental mass mutations.

**Cross-view selection:** Selection does not persist across view switches. Navigating to a different view or changing the active filter clears the selection.

**Selection state:** Managed client-side as a `Set<string>` of record IDs. Not persisted. Not synced via real-time — each user's selection is local to their session.

---

## Bulk Actions Toolbar

The toolbar appears as a floating bar above the grid footer when 2+ records are selected via checkbox. It replaces the summary footer while visible.

### Toolbar Actions

| Action                 | Permission Gate                                                                                | Availability                                                                                                    | Phase |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- |
| **Delete selected**    | `allow_delete` on Table View config (DB: `views`)                                              | Table-level binary gate. Hidden if user lacks delete permission.                                                | 3     |
| **Edit field value**   | `allow_edit` on Table View config (DB: `views`) + field-level write                            | Field picker excludes read-only fields and approval-gated Status fields [approval gating is post-MVP behavior]. | 3     |
| **Duplicate selected** | `allow_create` on Table View config (DB: `views`)                                              | Creates copies of selected records. Hidden if user lacks create permission.                                     | 3     |
| **Copy selected**      | Always available when records selected                                                         | Copies to clipboard in tab-separated format (for pasting into spreadsheets).                                    | 3     |
| **Assign to user**     | `allow_edit` on Table View config + write access on a People/Assignee field                    | Shortcut for bulk edit on People field. Hidden if no editable People field exists on the table.                 | 3     |
| **Export selection**   | Always available when records selected                                                         | Exports selected records to CSV or XLSX. Respects field-level visibility — hidden fields excluded from export.  | 3     |
| **Run automation**     | `allow_edit` on Table View config + automation exists with Button/Manual trigger on this table | Opens picker filtered to eligible automations.                                                                  | 6     |

**Toolbar layout:** Left-aligned action buttons with icons + labels. Right-aligned: record count ("47 selected") and "×" deselect-all button. On mobile: the toolbar appears as a bottom sheet with the same actions in a vertical list.

**Toolbar rendering rule:** An action button appears in the toolbar only if the user has the required permission. No disabled-with-tooltip pattern — if you can't do it, you don't see it. This keeps the toolbar clean and avoids "why can't I click this?" confusion.

---

## Bulk Edit

The most complex toolbar action. "Edit field value" opens a popover anchored to the toolbar button.

### Field Picker

The popover contains a searchable field list. Fields are filtered:

**Included:** All fields where the user has read-write permission in the current Table View context.

**Excluded:**

- Fields the user has read-only or hidden permission on
- Status fields with `transitions.enabled: true` (approval-gated) **[Post-MVP behavior — approval workflows are post-MVP. In MVP, no fields will have `transitions.enabled: true`, so this exclusion is dormant scaffolding]**
- Formula fields (computed, not writable) **[Post-MVP — formula engine is post-MVP per glossary]**
- Rollup fields (computed, not writable) **[Post-MVP — rollups are post-MVP per glossary]**
- Created Time / Last Modified Time / Created By / Last Modified By (system-managed)
- Auto-number fields
- Linked Record fields (editing link relationships in bulk requires the record picker UX, which is a different interaction — see Future Extensions)

### Value Input

After selecting a field, the popover shows a value editor appropriate to the field type. This reuses the same cell editor components from the grid — the same dropdown for Single Select, the same date picker for Date, the same people picker for People/Assignee, and so on.

**Two edit modes:**

| Mode             | Behavior                                                                    | Available for            |
| ---------------- | --------------------------------------------------------------------------- | ------------------------ |
| **Set to value** | Replace the current value in all selected records with the specified value. | All editable field types |
| **Clear value**  | Set the field to null/empty in all selected records.                        | All nullable field types |

For Multi-Select fields, an additional mode:

| Mode               | Behavior                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| **Add options**    | Append the selected options to each record's existing values (no duplicates). |
| **Remove options** | Remove the selected options from each record's existing values.               |

For Number fields with `allow_atomic_adjust: true` (inventory quantities), an additional mode:

| Mode          | Behavior                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| **Adjust by** | Add or subtract a delta from each record's current value. Uses `adjustFieldValue()` for atomic operation. |

### Confirmation

After selecting field, mode, and value, the user clicks "Apply to N records." For bulk edits affecting ≤50 records, no confirmation dialog — the edit applies immediately with an undo toast (10-second window). For bulk edits affecting >50 records, a confirmation dialog: "Update [Field Name] to [Value] for [N] records?" with Cancel and Apply buttons.

---

## Bulk Delete

### Permission Gate

Delete availability is determined by `allow_delete` on the Table View config (DB: `views`). This is a binary gate per role per Table View. If the button is visible, the user can delete all selected records. No per-record evaluation.

### Impact Preview

When the user clicks "Delete selected," the system runs a lightweight impact query before showing the confirmation dialog. The query returns a `BulkDeleteImpactSummary`:

```typescript
interface BulkDeleteImpactSummary {
  recordCount: number;
  crossLinkCount: number; // Records in other tables linked to these records
  childRecordCount: number; // Records in sub-tables/child tables via parent link
  formulaDependentCount: number; // Records with formulas referencing these records
  automationTriggerCount: number; // Automations that will fire on deletion
  pendingApprovalCount: number; // Records with active approval requests
}
```

**Dialog content scales with impact:**

- **Zero impact** (no cross-links, no children, no dependencies): Simple confirmation: "Delete 47 records? This cannot be undone."
- **Low impact** (cross-links or formula dependents only): "Delete 47 records? This will affect 12 linked records in other tables and 3 formula calculations."
- **High impact** (children, pending approvals, or automation triggers): Full impact panel listing each category with counts. "Delete 47 records?" followed by impact breakdown. Requires typing "delete" to confirm (borrowed from destructive action pattern in workspace deletion).

The impact query must execute within 500ms. It uses indexed lookups on `cross_link_entries`, `records` (parent_record_id), and `approval_requests` — not full graph traversal.

### Execution

Bulk delete is a soft delete (as with single-record delete). Records are marked with `deleted_at` timestamp. For ≤50 records, an undo toast appears (10-second window) that can reverse the soft delete. For >50 records, no undo toast — the confirmation dialog is the safeguard.

---

## Bulk Duplicate

Creates copies of all selected records. Each copy follows the same rules as single-record duplication:

- New UUID for each record
- All field values copied except: auto-number (gets next value), Created Time/By and Last Modified Time/By (set to current), linked records (copied as-is — new records link to the same targets)
- Record names receive a " (copy)" suffix on the primary field if it's a Text type
- Created in the same table, same view context

**Record quota check:** Before executing, the system verifies the workspace has sufficient record quota for N new records. If the bulk duplicate would exceed the plan's record limit, the action is blocked with a message: "Cannot duplicate 200 records — workspace has 4,850 of 5,000 records used. Only 150 duplicates are possible." No partial execution.

---

## Bulk Assign

A shortcut for bulk edit on a People/Assignee field. The toolbar button opens a people picker directly (skipping the field selection step). If the table has multiple People/Assignee fields, the picker first asks which field to assign, then shows the people picker.

This exists as a dedicated toolbar action because assigning/reassigning work is the single most common bulk operation in project management, CRM, and operations workflows. The two-click path (click Assign → pick person) is meaningfully faster than the four-click path (click Edit → pick field → pick person → apply).

---

## Bulk Export Selection

Exports selected records to CSV or XLSX. The export respects field-level visibility — hidden fields are excluded. Column order matches the current view's column order.

**Format picker:** A small dropdown on the Export button: CSV or XLSX.

**Contents:** Only the selected records. Only visible fields (per the user's field-level permissions in the current Table View). Column headers are field names. Values are formatted for human readability (dates as ISO strings, select options as labels not IDs, people as display names, linked records as primary field values).

**Delivery:** File downloads immediately via browser download. No email delivery for bulk export — the selection cap (5,000 records) keeps file sizes manageable.

The existing table-level export (CSV/XLSX of all filtered rows) remains unchanged. Bulk export selection is additive — it exports only what's selected rather than the full filtered view.

---

## Bulk Trigger Automation

Available in Post-MVP — Automations when the automations engine ships. The user selects records and clicks "Run automation" in the toolbar.

### Automation Picker

A command-bar-style dropdown filtered to automations that meet all of:

- Defined on the current table
- Have a **Button Clicked** (#7) or **Command Bar / Manual** (#11) trigger type
- The user has permission to trigger (based on workspace role)
- The automation is active (not draft or paused)

The picker shows automation name, description (if set), and an icon. Keyboard-navigable with search.

### Execution

The automation receives the full array of selected record IDs via batch mode (as defined in `automations.md`). The automation's batch behavior depends on its design:

- **Loop-based automations** (containing a Loop action): Iterate over the record ID array, executing the action steps per record. Subject to the 1,000 iteration cap on Loop actions.
- **Non-loop automations:** Receive the array and process it according to their step logic. The automation author is responsible for designing steps that handle multiple records.

**Progress feedback:** A toast with a progress indicator: "Running [Automation Name] on 200 records..." The toast updates to "Complete" or "Failed (see automation log)" when the execution finishes. The user is not blocked — they can continue working while the automation runs asynchronously via BullMQ.

---

## Bulk Checklist Item Update **[Post-MVP — depends on approval workflows, which are post-MVP per glossary]**

Approval criteria (checklist items on approval-gated Status fields) can be bulk-updated. This is the legitimate accelerator for approval workflows — advancing records toward a transition by completing prerequisites, not forcing the transition itself.

**UX:** When the bulk edit field picker shows a Checklist field that serves as an approval precondition, the value editor displays the checklist items. The user can check or uncheck specific items across all selected records.

**Behavior:** For each selected record, the specified checklist items are set to checked (or unchecked). Each record's approval state is then individually re-evaluated. If a record's transition preconditions are now fully satisfied:

- **Mode 2 (Gated Transitions):** The status auto-advances per the normal auto-advance mechanism. `actor_type: 'system'` in the audit log.
- **Mode 3 (Approval Chain):** The checklist item is marked complete, but the approval chain still requires human sign-off. The record moves closer to approval but does not auto-advance.

This means a bulk checklist update on 50 records might cause 45 to auto-advance (their other preconditions were already met) and 5 to remain pending (they have incomplete items on other preconditions). This is not a partial-success problem — the bulk edit (setting the checklist value) succeeded uniformly on all 50 records. The subsequent auto-advance is a system-initiated consequence, not part of the bulk action itself.

---

## Batch Server Action Pattern

The canonical server action pattern (defined in `apps/web/src/actions/CLAUDE.md`) is single-record. Bulk operations require a batch variant.

### Pattern

```typescript
'use server';

import { z } from 'zod';
import { getTenantId, getUserId } from '@/lib/auth';
import { getTraceId } from '@everystack/logging';
import { writeAuditLog } from '@everystack/db/audit';
import { revalidatePath } from 'next/cache';

const bulkUpdateSchema = z.object({
  tableId: z.string().uuid(),
  recordIds: z.array(z.string().uuid()).min(1).max(5000),
  fieldId: z.string().uuid(),
  value: z.unknown(),
  mode: z.enum(['set', 'clear', 'add', 'remove', 'adjust']),
});

export async function bulkUpdateRecords(input: z.infer<typeof bulkUpdateSchema>) {
  const validated = bulkUpdateSchema.parse(input); // 1. Zod validation
  const tenantId = await getTenantId(); // 2. Tenant from Clerk
  const userId = await getUserId(); // 3. User from Clerk

  // 4. Permission check — field-level write access
  //    (resolved once for the user × field, not per record)
  await assertFieldWriteAccess(tenantId, userId, validated.tableId, validated.fieldId);

  // 5. Approval gate check — reject if field is approval-gated
  await assertNotApprovalGated(tenantId, validated.tableId, validated.fieldId);

  const result = await db.transaction(async (tx) => {
    // 6. Batch update — single Drizzle statement
    const updated = await batchUpdateFieldValue(tx, {
      tenantId,
      tableId: validated.tableId,
      recordIds: validated.recordIds,
      fieldId: validated.fieldId,
      value: validated.value,
      mode: validated.mode,
    });

    // 7. Condensed audit log — single entry for the batch
    await writeAuditLog(tx, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'record.bulk_updated',
      entityType: 'table',
      entityId: validated.tableId,
      details: {
        fieldId: validated.fieldId,
        mode: validated.mode,
        record_count: validated.recordIds.length,
        record_ids_affected: validated.recordIds.slice(0, 1000),
        truncated: validated.recordIds.length > 1000,
      },
      traceId: getTraceId(),
    });

    return updated;
  });

  // 8. Single batched real-time event (after commit)
  await publishToRedis(`t:${tenantId}:table:${validated.tableId}`, {
    event: 'record.updated.batch',
    payload: {
      recordIds: validated.recordIds,
      fieldId: validated.fieldId,
    },
  });

  // 9. Automation trigger (batch mode)
  await enqueueAutomationTrigger({
    tenantId,
    tableId: validated.tableId,
    event: 'record.updated',
    batchMode: true,
    recordIds: validated.recordIds,
    changedFieldIds: [validated.fieldId],
    actorType: 'user',
    actorId: userId,
  });

  revalidatePath(`/w/${tenantId}/...`);
  return { count: result.length };
}
```

### Key Differences from Single-Record Pattern

| Aspect             | Single-Record Pattern                                            | Batch Pattern                          |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------- |
| Input validation   | Single ID                                                        | Array of IDs, max 5,000                |
| Permission check   | Per-record (but no record-level perms, so effectively per-table) | Once per batch — same result           |
| DB operation       | Single insert/update/delete                                      | Batch Drizzle `WHERE id IN (...)`      |
| Audit log          | One entry per record                                             | One condensed entry per batch          |
| Real-time event    | One event per mutation                                           | One `*.batch` event per batch          |
| Automation trigger | One trigger per record                                           | One batch-mode trigger                 |
| Transaction scope  | Single record + audit                                            | All records + audit in one transaction |

### Batch Delete Pattern

Same structure as batch update, with `action: 'record.bulk_deleted'` and `event: 'record.deleted.batch'`. The impact summary query runs before the transaction begins (read-only, doesn't need transaction scope). Soft delete sets `deleted_at` on all records in a single `UPDATE ... WHERE id IN (...)` statement.

### Batch Duplicate Pattern

Batch duplicate inserts N new records in a single transaction. Each record gets a new UUID but copies field values from the source. The audit action is `record.bulk_created` with `source: 'duplicate'` in the details. Record quota is checked before the transaction begins — if the workspace would exceed its plan limit, the action is rejected entirely (no partial duplication).

---

## Audit Log Extension

The audit log (`audit-log.md`) defines bulk operation condensation for sync batches but explicitly states that user-initiated edits are "always individual." This spec extends condensation to user-initiated bulk actions.

### New Audit Actions

| Action                | Entity Type | Details                                                                                       |
| --------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `record.bulk_updated` | `table`     | `{ fieldId, mode, value_summary, record_count, record_ids_affected[], truncated }`            |
| `record.bulk_deleted` | `table`     | `{ record_count, record_ids_affected[], truncated, impact_summary }`                          |
| `record.bulk_created` | `table`     | `{ source: 'duplicate', record_count, record_ids_created[], source_record_ids[], truncated }` |

**Condensation rules (extending existing rules from `audit-log.md`):**

- User-initiated bulk operations affecting >1 record write a single condensed audit entry with `entity_type: 'table'` (not `'record'`).
- The `record_ids_affected` array is capped at 1,000 IDs, consistent with the sync batch pattern. For larger batches, the array is truncated with `"truncated": true`.
- Individual record-level audit entries are NOT written for bulk operations. The condensed entry is sufficient. The Record Activity tab queries both record-level entries AND table-level bulk entries where the record ID appears in the `record_ids_affected` array.
- `actor_type` is always `'user'` for toolbar-initiated bulk actions.

### Record Activity Tab Impact

The Record Activity tab on the Record View must include bulk action entries. When querying activity for a specific record, the query includes:

```sql
WHERE (entity_type = 'record' AND entity_id = $recordId)
   OR (entity_type = 'table' AND entity_id = $tableId
       AND action LIKE 'record.bulk_%'
       AND details->'record_ids_affected' ? $recordId)
```

The `?` operator checks if the record ID exists in the JSONB array. This is indexed via a GIN index on `details` — already specified in `audit-log.md` for the sync batch pattern.

Display in the Activity tab: "Status updated to Complete across 200 records by [User Name] — 2 hours ago." The activity entry links to the workspace audit log filtered to that specific bulk action for full details.

---

## Real-Time Event Batching

The Redis pub/sub layer (defined in `realtime.md`) currently publishes one event per mutation. Bulk operations publish a single batch event.

### Batch Event Shape

```typescript
// Single-record event (existing — unchanged)
{
  event: 'record.updated',
  payload: { recordId: string; }
}

// Batch event (new)
{
  event: 'record.updated.batch',
  payload: {
    recordIds: string[];
    fieldId?: string;       // Present for bulk edit (single field changed)
    truncated: boolean;     // True if recordIds array exceeds 1,000
    totalCount: number;     // Always accurate, even when truncated
  }
}
```

### Client Handling

Clients subscribed to the table channel receive the batch event and must handle it:

- **Grid view:** Invalidate and re-fetch the affected rows. For `record.updated.batch`, if `recordIds` count is ≤100, invalidate those specific rows. If >100 or `truncated`, invalidate the entire view query (full refresh).
- **Record View:** If the currently expanded record ID is in `recordIds`, re-fetch that record's data.
- **Kanban/Calendar views [post-MVP]:** Same invalidation logic as grid.
- **Record Activity tab:** Append the bulk action entry if the current record is affected.

### Event Types

| Event                  | Trigger                |
| ---------------------- | ---------------------- |
| `record.updated.batch` | Bulk edit, bulk assign |
| `record.deleted.batch` | Bulk delete            |
| `record.created.batch` | Bulk duplicate         |

---

## Formula Cascade Handling **[Post-MVP — formula engine is post-MVP per glossary]**

Bulk-updating a field that feeds into formulas triggers cascade recalculation. The formula engine's existing cascade infrastructure (defined in `formula-engine.md` and `cross-linking.md` > Cascade Engineering) handles this, but bulk operations can amplify cascade volume.

### Cascade Batching

When a bulk update modifies N records on a field that has formula dependents, the cascade system receives N invalidation signals. Rather than processing each individually:

1. **Debounce window:** The cascade system collects all invalidations arriving within a 100ms window after a batch event into a single cascade job.
2. **Single dependency graph walk:** The formula dependency graph is walked once to identify all affected computed fields (not once per record).
3. **Batch recalculation:** Affected formulas are recalculated for all N records in a single pass, using the existing chunk-based processing (5K-batch for large sets, as defined in `cross-linking.md`).
4. **Backpressure:** The existing per-tenant cascade concurrency limit (2 concurrent cascade jobs) and queue depth backpressure (skip sync poll if depth >500) apply to bulk-triggered cascades.

### Cross-Link Display Value Cascades

Bulk operations on a table with cross-links trigger display value maintenance on linked tables. The existing batched cascade system (defined in `cross-linking.md` > Cascade Engineering) handles this — display value updates are already designed for batch processing with adaptive chunk delays. No new mechanism needed.

---

## Automation Trigger Batching

Bulk operations fire automation triggers via the existing batch mode (defined in `automations.md` > Deduplication).

**Behavior:** When a bulk action completes, the server action enqueues a single automation trigger event with `batchMode: true` and the full `recordIds` array. The automation engine:

1. Evaluates which automations have triggers matching this event type + table.
2. For each matching automation, enqueues a single execution with the batch payload.
3. The automation receives the array of record IDs and processes them according to its step logic (Loop action for iteration, or batch-aware custom logic).

**Rate cap interaction:** A single bulk trigger counts as one execution against the automation's rate cap (100 executions/minute). It does not count as N executions. This prevents a single bulk operation from exhausting the rate cap.

**Outbound webhook condensation:** If the automation fires an outbound webhook, the existing condensation logic applies: >50 records in 5 seconds triggers a single `record.updated.batch` webhook delivery (defined in `automations.md` > Webhook Architecture).

---

## Undo Behavior

| Action                  | ≤50 records                                                                                       | >50 records                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Bulk edit               | Undo toast, 10-second window. Reverts all records to prior values.                                | No undo. Confirmation dialog is the safeguard.             |
| Bulk delete             | Undo toast, 10-second window. Reverses soft delete.                                               | No undo. Impact preview dialog + type "delete" to confirm. |
| Bulk duplicate          | Undo toast, 10-second window. Deletes the duplicated records.                                     | No undo. Record quota check serves as safeguard.           |
| Bulk assign             | Undo toast, 10-second window. Reverts assignee field.                                             | No undo. Confirmation dialog.                              |
| Bulk export             | N/A — non-destructive.                                                                            | N/A                                                        |
| Bulk trigger automation | No undo — automation side effects may not be reversible. Toast links to automation execution log. | Same.                                                      |

**Undo implementation:** For bulk operations with undo, the server action returns both the result and the prior values (a snapshot of the affected field for each record, taken within the same transaction before the update). The undo action replays these prior values in a new batch transaction. If the undo window expires, the prior values are discarded.

**Undo storage:** Prior values for undo are held in a Redis key with a 15-second TTL (5 seconds beyond the 10-second undo window, for network latency tolerance): `undo:bulk:{tenantId}:{actionId}`. The key contains the record IDs and their prior field values as a JSONB blob.

---

## Mobile Behavior

On mobile devices (phone form factor), bulk operations are available but adapted:

**Selection:** Long-press a record card to enter selection mode. Subsequent taps toggle selection. A floating action bar appears at the bottom with the selection count and available actions.

**Toolbar:** Bottom sheet with vertical action list (consistent with mobile patterns defined in `design-system.md` > Ergonomic Design Constraints). Same actions, same permission gating.

**Bulk edit:** Full-screen modal with field picker and value editor. Same field type exclusions.

**Bulk delete:** Same impact preview dialog, but rendered as a bottom sheet.

---

## Phase Implementation

| Phase                  | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Core UX          | Selection model (checkbox column, header select-all, selection cap 5,000). Bulk actions toolbar (appears on 2+ selection). **Delete selected** with impact preview dialog and `BulkDeleteImpactSummary`. **Edit field value** with field picker (approval-gated exclusion [post-MVP scaffolding — harmless when approvals don't exist], field type filtering), value editor, confirmation, undo toast. **Duplicate selected** with record quota check. **Copy selected** to clipboard. **Assign to user** shortcut. **Export selection** to CSV/XLSX. Batch server action pattern (`bulkUpdateRecords`, `bulkDeleteRecords`, `bulkDuplicateRecords`). Condensed audit log entries. Batch real-time events. Undo mechanism (Redis key with prior values). Mobile selection mode and bottom sheet toolbar. |
| Post-MVP — Automations | **Run automation** toolbar action with automation picker. Bulk checklist item update for approval criteria advancement [post-MVP — depends on approval workflows]. Automation batch-mode trigger integration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## Key Architectural Decisions

| Decision                                           | Resolution                                                                  | Rationale                                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partial success model                              | Eliminated entirely                                                         | Approval-gated fields excluded from bulk edit; delete is binary permission gate. No action can produce mixed results.                                            |
| Delete permission level                            | Table-level, per role, per Table View                                       | `allow_delete` on Table View config (DB: `views`). Binary gate. If visible, applies to all selected records.                                                     |
| Approval-gated field exclusion [post-MVP behavior] | Status fields with `transitions.enabled: true` hidden from bulk edit picker | Approval workflows exist for individual evaluation. Bulk override is an anti-pattern. Bulk checklist advancement is the legitimate accelerator.                  |
| Selection cap                                      | 5,000 records                                                               | Keeps batch transactions under ~10 seconds. Larger operations should use automations or scheduled jobs.                                                          |
| Undo threshold                                     | ≤50 records: undo toast. >50: confirmation dialog only                      | Small batches benefit from quick undo. Large batches need deliberate confirmation — undo of 5,000 records is itself a risky bulk operation.                      |
| Audit condensation                                 | One entry per bulk action, not per record                                   | Consistent with sync batch condensation pattern. Record Activity tab queries both individual and bulk entries.                                                   |
| Real-time batching                                 | Single `*.batch` event per bulk action                                      | Prevents event storms on connected clients. Client invalidation strategy scales with batch size.                                                                 |
| Formula cascade [post-MVP]                         | Debounce + single graph walk + batch recalculation                          | Reuses existing cascade infrastructure. No new mechanism needed.                                                                                                 |
| Batch server action location                       | `apps/web/src/actions/bulk.ts`                                              | Mirrors single-record action files. Cross-references `actions/CLAUDE.md` for the pattern.                                                                        |
| Export at selection level                          | Enabled                                                                     | Reverses the prior "No export at selection level" stance. Selection-scoped export is essential for workflows like "export these 50 invoices for the accountant." |
| Linked Record fields in bulk edit                  | Excluded from MVP — Core UX                                                 | Editing link relationships in bulk requires record picker UX that handles multi-record context. Deferred to future extension.                                    |
| Automation rate cap accounting                     | One bulk trigger = one execution                                            | Prevents a single bulk operation from consuming the full rate cap. The automation processes the batch internally.                                                |

---

## Future Extensions

**Bulk edit Linked Record fields:** A bulk "link to" or "unlink from" action requires a record picker that can handle the context of applying to N records. Deferred because the UX is complex — does the user pick one target record to link all selected records to, or does each selected record get a different link? The former is useful (assign all tasks to a milestone), the latter is rarely needed in bulk.

**Bulk status transition (with guardrails):** If demand emerges for bulk status changes on approval-gated fields, a possible future pattern: dry-run evaluation across all selected records, presented as a summary ("180 can transition, 12 need approval, 8 blocked"), with the option to apply the clean subset and create approval requests for the rest. Deliberately not in v1 — the complexity is high and the exclusion rule is clean.

**Scheduled bulk operations:** "Update all records matching this filter to [value] at [time]." Essentially a scheduled automation, but surfaced as a bulk action with a time picker. Natural extension once automations ship in Post-MVP — Automations.

**Bulk operations via API:** The batch server action pattern translates directly to a REST API endpoint: `POST /api/v1/tables/{tableId}/records/bulk-update` with the same input schema. Deferred to API launch phase.

**Bulk operations in portals:** Portal clients might need limited bulk actions (e.g., bulk-approve line items, bulk-download files). Requires portal-specific permission evaluation and scoping to the client's own records. Deferred to post-MVP.
