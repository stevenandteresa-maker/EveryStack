# Formula Engine

> **⚠️ GLOSSARY RECONCILIATION — 2026-02-27**
> Reconciled against `GLOSSARY.md` (source of truth). Changes:
> - **Scope tagged as Post-MVP.** The glossary's MVP Explicitly Excludes table lists "Formula engine | Post-MVP" and "Rollups and aggregations | Post-MVP." The entire feature is deferred.
> - **No naming drift found.** This doc already uses glossary-correct terminology: "Cross-Link" for cross-table references, `canonical_data` for JSONB storage, `tenant_id` for multi-tenant isolation, "Table View" for view references, "Record View" where applicable.
> - Cross-references unchanged (all target docs still exist under current names).
> - Phase implementation table retained as-is — phases describe internal build order once post-MVP work begins, not MVP scope.

> **🔴 POST-MVP — This entire document describes a post-MVP feature.** Per GLOSSARY.md, the formula engine, rollups, and aggregations are all explicitly excluded from MVP scope. Do not build evaluation logic, dependency graph, or ROLLUP/LOOKUP resolution unless explicitly scoped into a post-MVP phase. The MVP — Foundation schema stub (`formula_dependencies` table) may ship with MVP as a no-op schema reservation.

> Architecture for formula field evaluation, dependency tracking, and recalculation cascades.
> Cross-references: `inventory-capabilities.md` (UOM conversion via formula references — deferred, low priority), `chart-blocks.md` (ROLLUP >10K record handoff — large aggregations should use dashboard chart visualizations rather than cell formulas; shared aggregation vocabulary), `approval-workflows.md` (formula precondition type — transition rules can use formula expressions evaluated via parser + evaluator to gate status changes; truthy result = precondition satisfied), `workspace-map.md` (formula dependency graph produces `formula_depends` edges between tables in the topology graph — cross-table formula references via ROLLUP or lookup visible as edges), `bulk-operations.md` (bulk-aware cascade throttling — N invalidation signals debounced into single 100ms cascade job, single dependency graph walk, batch recalculation in 5K-chunk passes, per-tenant cascade concurrency limit 2 and queue depth backpressure apply to bulk-triggered cascades)
> Last updated: 2026-02-27 — Glossary reconciliation. Prior: 2026-02-21 — Added `bulk-operations.md` cross-reference (bulk-aware cascade debounce and batch recalculation). Prior: `workspace-map.md` cross-reference.

---

## Overview

A formula field computes a value from other fields in the same record, or from fields in cross-linked records. Formulas are defined by Managers, stored as expressions, and evaluated by the system — users see the computed result as a read-only field.

**Examples:**
- `{Due Date} - TODAY()` → days until deadline
- `{Unit Price} * {Quantity}` → line total
- `IF({Status} = "Overdue", "🔴", "🟢")` → status indicator
- `LOOKUP({Client}.{Email})` → value from a cross-linked record

---

## Evaluation Model

### Where Formulas Are Evaluated

**Server-side only.** Formulas are evaluated in the web app (Server Actions on record mutation) and the worker service (on sync completion, bulk recalculation). Never in the browser.

**Why not client-side:** Formulas can reference cross-linked records that the client doesn't have loaded. They can use functions that require DB lookups (`LOOKUP`, `COUNTA` across linked records). Server evaluation ensures consistent results and prevents data leakage across permission boundaries.

### When Formulas Are Evaluated

| Trigger | Evaluator | Scope |
|---------|-----------|-------|
| Record created | Server Action | All formula fields in the new record |
| Record field edited | Server Action | Formula fields that depend on the changed field (via dependency graph) |
| Cross-linked target record changed | Worker (BullMQ job) | Formula fields in source records that reference the changed target via `LOOKUP` |
| Inbound sync batch completes | Worker | All formula fields in synced records (batch recalculation) |
| Formula field definition changed | Worker | All records in the table (full recalculation, background) |
| Manual recalculation request | Worker | All records in the table |

**Additional consumer — approval transition preconditions:** The formula evaluator is also invoked by the approval enforcement layer when evaluating `formula`-type transition preconditions. A formula expression is evaluated against the current record; a truthy result means the precondition is satisfied and the status transition is allowed. Same parser, same evaluator, same resource limits — the enforcement layer calls `FormulaEvaluator.evaluate()` inline during the precondition check. See `approval-workflows.md` > Precondition Types > `formula`.

### Evaluation Execution

```typescript
interface FormulaEvaluator {
  evaluate(
    expression: string,
    record: CanonicalRecord,
    fieldDefinitions: FieldDefinition[],
    crossLinkResolver: CrossLinkResolver  // Fetches linked record values on demand
  ): FormulaResult;
}

interface FormulaResult {
  value: CanonicalValue;        // Computed result in canonical form
  resultType: FieldType;        // Inferred type (number, text, date, boolean)
  dependencies: FieldDependency[];  // Fields this formula read (for dependency tracking)
  errors: FormulaError[];       // Division by zero, null reference, type mismatch, etc.
}
```

---

## Expression Language

### Supported Operations

| Category | Operations |
|----------|-----------|
| Arithmetic | `+`, `-`, `*`, `/`, `%`, `^` (power) |
| Comparison | `=`, `!=`, `>`, `<`, `>=`, `<=` |
| Logical | `AND()`, `OR()`, `NOT()`, `IF()`, `SWITCH()` |
| Text | `CONCAT()`, `LEFT()`, `RIGHT()`, `MID()`, `LEN()`, `TRIM()`, `UPPER()`, `LOWER()`, `FIND()`, `SUBSTITUTE()` |
| Numeric | `SUM()`, `AVERAGE()`, `MIN()`, `MAX()`, `ROUND()`, `FLOOR()`, `CEILING()`, `ABS()` |
| Date | `TODAY()`, `NOW()`, `DATEADD()`, `DATEDIFF()`, `YEAR()`, `MONTH()`, `DAY()`, `WEEKDAY()` |
| Cross-link | `LOOKUP({Link Field}.{Target Field})`, `COUNTA({Link Field})`, `ROLLUP({Link Field}.{Target Field}, "sum")` |
| Conditional | `IF(condition, then, else)`, `SWITCH(value, pattern1, result1, ..., default)`, `BLANK()` |
| Type | `VALUE()` (text→number), `TEXT()` (number→text), `DATEVALUE()` |

### Field References

Fields referenced by name in curly braces: `{Field Name}`. Resolved against the record's table field definitions. Field rename updates the expression stored in the formula config (application-layer find/replace on save).

### Cross-Link References

> **Post-MVP:** LOOKUP and ROLLUP functions depend on the formula engine, which is post-MVP. Cross-Link display in Table Views and Record Views (showing linked record data) is MVP; formula-based LOOKUP/ROLLUP evaluation is not.

`LOOKUP({Client}.{Email})` resolves to: find the record linked via the "Client" Cross-Link field → read its "Email" field value. If multiple records are linked, returns an array (or the first, depending on function).

`ROLLUP({Line Items}.{Amount}, "sum")` resolves to: find all records linked via "Line Items" → extract "Amount" field → apply aggregation function.

---

## Expression Parser & AST

### Parser Architecture

**Technology: PEG.js (peggy) parser generator.** Formulas are parsed into an AST at definition save time, not at evaluation time. The grammar is small (~200 lines) and compiles to a JavaScript parser that runs in <1ms for any reasonable expression.

**Why not eval/Function constructor:** Untrusted user expressions must never be executed as raw JavaScript. The formula engine evaluates an AST, never string code. This is the security boundary.

### Grammar (Simplified)

```peg
Expression = Comparison / Term
Comparison = Term CompOp Term
Term = Factor (('+' / '-') Factor)*
Factor = Unary (('*' / '/' / '%') Unary)*
Unary = ('-' / 'NOT')? Atom
Atom = FunctionCall / FieldRef / CrossLinkRef / Literal / '(' Expression ')'
FunctionCall = Identifier '(' ArgumentList? ')'
FieldRef = '{' FieldName '}'
CrossLinkRef = '{' LinkFieldName '}' '.' '{' TargetFieldName '}'
Literal = Number / String / Boolean
```

### AST Node Types

```typescript
type FormulaAST =
  | { type: 'literal'; value: number | string | boolean }
  | { type: 'field_ref'; fieldName: string; fieldId?: string }     // Resolved at save
  | { type: 'cross_link_ref'; linkFieldName: string; targetFieldName: string;
      linkFieldId?: string; targetFieldId?: string }               // Resolved at save
  | { type: 'function_call'; name: string; args: FormulaAST[] }
  | { type: 'binary_op'; op: string; left: FormulaAST; right: FormulaAST }
  | { type: 'unary_op'; op: string; operand: FormulaAST };
```

**Field resolution at save time:** When a formula is saved, the parser produces raw AST with field names. A resolution pass then maps `{Field Name}` → `fieldId` using the table's field definitions. If a field name doesn't exist, the save is rejected with an error: "Field '{Field Name}' not found in this table." This prevents runtime reference errors.

### Validation at Save Time

Before a formula definition is persisted, these checks run in order:

1. **Parse** — expression syntax valid (PEG grammar)
2. **Resolve field references** — all `{Field Name}` map to existing field IDs
3. **Resolve cross-link references** — `{Link}.{Target}` maps to valid cross-link definition + target field
4. **Type check** — arithmetic operations have numeric operands, comparisons have compatible types, function arguments match expected types (warning, not error — some mismatches resolve at runtime)
5. **Circular reference detection** — DFS on dependency graph (see below)
6. **Persist AST** — stored in `fields.config` as compiled AST JSON, not raw expression text (though the raw text is stored alongside for display)

### Evaluation Sandbox

The formula evaluator is a **tree-walking interpreter** over the AST. It has no access to `eval()`, `Function()`, `require()`, or any Node.js globals.

```typescript
function evaluateNode(
  node: FormulaAST,
  ctx: EvaluationContext
): CanonicalValue {
  switch (node.type) {
    case 'literal': return node.value;
    case 'field_ref': return ctx.getFieldValue(node.fieldId!);
    case 'cross_link_ref': return ctx.resolveCrossLink(node.linkFieldId!, node.targetFieldId!);
    case 'function_call': return ctx.callFunction(node.name, node.args.map(a => evaluateNode(a, ctx)));
    case 'binary_op': return applyBinaryOp(node.op, evaluateNode(node.left, ctx), evaluateNode(node.right, ctx));
    case 'unary_op': return applyUnaryOp(node.op, evaluateNode(node.operand, ctx));
  }
}
```

**Resource limits per evaluation:**
- Max AST depth: 50 nodes (prevents deeply nested expressions)
- Max evaluation time: 100ms (enforced via `AbortController` timeout)
- Max cross-link resolutions per evaluation: 10 (prevents fan-out via chained LOOKUPs)
- Max ROLLUP record set: 10,000 records (returns error if exceeded, suggests adding a scope filter to the cross-link)

---

## Dependency Graph

### What It Tracks

A directed acyclic graph (DAG) mapping each formula field to the fields it reads:

```typescript
interface FieldDependency {
  sourceFieldId: string;      // The formula field
  dependsOnFieldId: string;   // The field it reads
  dependsOnTableId: string;   // Same table or cross-linked table
  dependencyType: 'local' | 'cross_link';  // Same record or linked record
}
```

### Storage

Dependencies are computed when a formula definition is saved and stored in a `formula_dependencies` table:

| Column | Type | Purpose |
|--------|------|---------|
| `tenant_id` | UUID | |
| `formula_field_id` | UUID | The formula field |
| `depends_on_field_id` | UUID | Field it reads |
| `depends_on_table_id` | UUID | Table the dependency is in |
| `dependency_type` | VARCHAR | `'local'` or `'cross_link'` |

**Index:** `(tenant_id, depends_on_field_id)` — for answering "which formulas need recalculation when this field changes?"

### Recalculation Cascade

When field X changes in record R:

```
1. Query formula_dependencies: which formula fields depend on field X?
   → Returns formula fields F1, F2 in the same table
   → Returns formula fields F3, F4 in other tables (cross-link dependencies)

2. Local dependencies (F1, F2): Evaluate immediately in the same Server Action
   → Update record R's canonical_data with new formula values
   → Check: do any other formulas depend on F1 or F2? (chained formulas)
     → If yes, evaluate those too (max chain depth: 10)

3. Cross-link dependencies (F3, F4): Enqueue BullMQ job
   → Job finds all records in F3/F4's tables that link to record R
   → Batch-evaluates affected formulas
   → Publishes real-time events for affected tables
```

**Chain depth limit:** Formulas that depend on other formulas create chains. Max chain depth: 10. Beyond 10, the evaluation stops and logs a warning. This prevents pathological chain explosions.

---

## Circular Reference Detection

Circular references are detected at **formula definition time** (when the Manager saves the formula), not at evaluation time.

**Algorithm:** When saving a formula field definition:
1. Parse the expression to extract field references
2. Build the dependency set for this formula
3. Walk the dependency graph from this formula's dependencies, following chains
4. If the walk encounters the formula field itself, reject with error: "Circular reference detected: {Field A} → {Field B} → {Field A}"

**Implementation:** Simple DFS with visited set. The dependency graph is small per-table (typically <100 fields, <20 formulas). Detection is near-instant.

**Cross-link circularity:** Also detected. If Table A has a formula that reads from Table B via cross-link, and Table B has a formula that reads from Table A via cross-link, that's a circular dependency. Detected the same way — the dependency graph spans tables.

---

## Error Handling

| Error | Behavior |
|-------|----------|
| Division by zero | Cell displays `#DIV/0!`. Value stored as `{ error: "DIV_ZERO" }`. |
| Null/empty reference | `BLANK()` propagation. `{Field}` returns null if field is empty. Arithmetic with null → null. |
| Type mismatch | Cell displays `#TYPE!`. e.g., `{Name} + 5` where Name is text. |
| Cross-link target not found | Cell displays `#REF!`. Linked record was deleted. |
| Circular reference | Blocked at save time. Never reaches evaluation. |
| Chain depth exceeded | Cell displays `#DEPTH!`. Formula depends on too many chained formulas. |
| Evaluation timeout | Cell displays `#TIMEOUT!`. Single formula evaluation capped at 100ms. |

Errors are stored in the canonical JSONB as `{ "type": "formula", "value": { "error": "DIV_ZERO", "expression": "..." } }` so the grid renderer can show appropriate error indicators.

---

## Performance

### Single Record Evaluation

Target: <10ms for a formula with local dependencies. <50ms for a formula with one cross-link LOOKUP.

**Optimization: evaluation context cache.** Cross-link LOOKUP results are cached in the `EvaluationContext` for the duration of a single record's evaluation. If a record's formula F1 and F2 both LOOKUP the same cross-linked record, the linked record is fetched once.

```typescript
class EvaluationContext {
  private crossLinkCache = new Map<string, CanonicalRecord[]>();
  
  async resolveCrossLink(linkFieldId: string, targetFieldId: string): Promise<CanonicalValue> {
    if (!this.crossLinkCache.has(linkFieldId)) {
      const linked = await this.fetchLinkedRecords(linkFieldId);
      this.crossLinkCache.set(linkFieldId, linked);
    }
    const records = this.crossLinkCache.get(linkFieldId)!;
    // Return single value (LOOKUP) or array (for ROLLUP to aggregate)
    return records.length === 1
      ? records[0].canonicalData.fields[targetFieldId]
      : records.map(r => r.canonicalData.fields[targetFieldId]);
  }
}
```

### ROLLUP Performance at Scale

ROLLUP aggregates across linked records: `ROLLUP({Line Items}.{Amount}, "sum")`. If a record has 500 linked line items, the evaluator must fetch all 500 records and extract one field from each.

**Performance targets:**

| Linked Record Count | Fetch Time | Aggregation | Total |
|---------------------|-----------|-------------|-------|
| ≤50 | <20ms | <1ms | <25ms |
| 50–500 | <50ms | <5ms | <60ms |
| 500–5,000 | <200ms | <10ms | <220ms |
| 5,000–10,000 | <500ms | <20ms | <550ms |
| >10,000 | Rejected | — | Returns `#LIMIT!` error |

**Why 10,000 cap:** ROLLUP fetches full records (not individual fields) due to canonical JSONB structure. At 10K records × ~2KB each = 20MB of data read per formula evaluation. Beyond this, the formula should use a dashboard aggregation or report, not a cell formula.

**Optimization: ROLLUP-specific batch fetch.** Instead of fetching full records, a ROLLUP can use a targeted query that extracts only the aggregated field:

```sql
SELECT canonical_data->'fields'->$targetFieldId->>'value' as val
FROM records
WHERE tenant_id = $1 AND id = ANY($linkedRecordIds) AND deleted_at IS NULL;
```

This reduces data transfer by ~90% for records with many fields.

### Formula Result Caching

Formula results are **stored in `canonical_data`** alongside the expression, not recomputed on read:

```jsonb
{
  "type": "formula",
  "value": {
    "expression": "{Unit Price} * {Quantity}",
    "result": 250.00,
    "resultType": "number",
    "evaluatedAt": "2026-02-12T10:30:00Z",
    "error": null
  }
}
```

**Grid reads never evaluate formulas.** The grid reads `result` from JSONB like any other field. Formulas are only re-evaluated on dependency change (via the recalculation cascade) or on explicit refresh.

**Staleness indicator:** If `evaluatedAt` is older than the record's `updated_at`, the UI shows a subtle refresh icon. This only happens if a background recalculation job is still in progress.

### Bulk Recalculation

When a formula definition changes, all records in the table need recalculation.

**Connection budget analysis:**

```
Worker DB pool: 10 connections (from PgBouncer budget)
Concurrent batches: 4 (leaves 6 connections for other worker jobs)
Batch size: 500 records
Each batch: ~200ms (read 500 records, evaluate, write back)
Throughput: 4 batches × 500 records / 200ms ≈ 10,000 records/sec

50K-record table: ~5 seconds (local formulas)
50K-record table: ~30 seconds (cross-link formulas, due to linked record fetches)
500K-record table: ~50 seconds (local), ~5 minutes (cross-link)
```

**Progress tracking:** BullMQ job updates a Redis key `job:{jobId}:progress` with `{ processed, total, startedAt }`. The UI polls this (or receives via real-time push) to show "Recalculating formulas… 12,000 of 50,000 records."

**Cancellation:** If the formula definition is edited again while a recalculation job is running, the running job is cancelled (BullMQ `job.moveToFailed()`) and a new job is enqueued with the updated expression.

### Real-Time Behavior

| Table Type | Formula Recalculation Timing |
|-----------|------------------------------|
| Native table, local formula | Synchronous in Server Action. User sees updated value immediately. |
| Native table, cross-link formula | Asynchronous (BullMQ job, <10s). Grid updates via real-time push. |
| Synced table, any formula | Asynchronous (after sync settles). Formulas recalculated in the same job that processes inbound sync. |

### Interaction with Cross-Link Scope Filters

When a cross-link's `link_scope_filter` is modified, records that previously linked to now-excluded targets retain their existing links and formula values. The scope filter affects **new link creation**, not existing data. However, ROLLUP formulas continue to aggregate across all linked records (including those that no longer match the filter). This is intentional — changing a filter shouldn't silently alter calculated values.

---

## Phase Implementation

> **Note:** All phases below are post-MVP. Phase numbering reflects internal build order once this feature is greenlit, not MVP scope.

| Phase | Formula Work |
|-------|-------------|
| MVP — Foundation | `formula_dependencies` table in schema. No evaluation logic. |
| MVP — Core UX | PEG grammar (peggy), AST types, expression parser, tree-walking evaluator, sandbox with resource limits, dependency graph builder, circular reference detection, local formula evaluation in Server Actions, basic function library (arithmetic, comparison, text, date). Cross-link LOOKUP/ROLLUP with evaluation context cache. Grid rendering of formula results + error indicators. Save-time validation (parse → resolve → type-check → cycle-detect). |
| MVP — Core UX+ | Bulk recalculation job with progress tracking + cancellation, recalculation cascade for cross-link changes, ROLLUP batch fetch optimization, formula performance monitoring via OpenTelemetry. |
