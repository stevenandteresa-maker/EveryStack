# Phase 3B-i — Cross-Linking Engine — Prompting Roadmap

## Overview

- **Sub-phase:** 3B-i — Cross-Linking Engine
- **Playbook:** `docs/Playbooks/playbook-phase-3b-i.md`
- **Subdivision doc:** `docs/subdivisions/3b-i-subdivision.md`
- **Units:** 5 — (1) Cross-Link Types, Validation Schemas & Registry, (2) Cross-Link Definition CRUD & Record Linking, (3) Query-Time Resolution & Permission Intersection, (4) Display Value Cascade & Scalability Infrastructure, (5) Link Picker UI
- **Estimated duration:** 5–7 sessions across all 6 lifecycle steps
- **Prior sub-phase:** Phase 3A-iii (Field-Level Permissions) — merged to main

## Section Index

| Section | Summary |
|---------|---------|
| Overview | Sub-phase metadata, 5 units, 5-7 session estimate, parallel opportunities after Unit 2 |
| Step 3 — Build Execution | 12 prompts in 5 units: types/schemas, CRUD/linking, L0-L2 resolution, cascade processor, Link Picker UI |
| Step 4 — Review | Reviewer Agent verification with per-unit contract checks |
| Step 5 — Docs Sync | MODIFICATIONS.md template for all created/modified files |

---

## STEP 0 — DOC PREP (Architect Agent)

### What This Step Does

**This step is already complete.** The Architect Agent ran doc prep for Phase 3B-i, verifying `cross-linking.md`, `data-model.md`, `permissions.md`, and the glossary. The `docs/` branch was merged to main. The playbook at `docs/Playbooks/playbook-phase-3b-i.md` was produced against the updated docs.

No action needed. Proceed to Step 3.

---

## STEP 1 — PLAYBOOK GENERATION

### What This Step Does

**This step is already complete.** You already have the playbook for this sub-phase — it was produced before this roadmap.

The playbook is at: `docs/Playbooks/playbook-phase-3b-i.md`

No action needed. Proceed to Step 3.

---

## STEP 2 — PROMPTING ROADMAP GENERATION

**This step is already complete.** You're reading the output of Step 2. Proceed to Step 3.

---

## STEP 3 — BUILD + VERIFY EXECUTION

Step 3 alternates between BUILD sessions and VERIFY sessions in separate Claude Code contexts. BUILD contexts are focused on writing code with full playbook/reference context. VERIFY contexts are focused on running tests and fixing failures with full testing knowledge. This keeps each context lean and within budget.

This sub-phase is organized into **5 units**. Each unit represents a coherent slice of the build with defined inputs and outputs. You'll see unit headers marking where each unit starts and what it produces.

**Important note on parallel units:** After Unit 2 completes, Units 3, 4, and 5 can be built in any order — they don't depend on each other. They all depend on Unit 2. You'll build them sequentially (one at a time), but if anything blocks one unit, you can skip ahead to another.

### Setup

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b build/3b-i-cross-linking
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Find the "3B-i — Cross-Linking Engine" section.
All units should show `pending`. No changes needed yet.
```

---

### ═══ UNIT 1: Cross-Link Types, Validation Schemas & Registry ═══

**What This Unit Builds:**
This is the foundation layer — it creates all the shared definitions that every other unit in this phase will import. Think of it like defining the vocabulary and rules before writing the story. It defines what a "cross-link" is in the system, what a "linked record" looks like in the database, and what limits exist (like max 500 links per record). It also teaches the system's field type engine about the new "linked record" field type.

**What Comes Out of It:**
When done, the system knows what a cross-link is, what shapes are valid, and how to read/write cross-link data in the database's canonical format. Other units can import these definitions to build on top of them.

**What It Needs from Prior Work:**
Nothing — this is the first unit. It uses the existing field type system and database schema that were built in prior phases.

---

### BUILD SESSION A — Unit 1, Prompts 1–2

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 1 to `in-progress`.
Add branch name: `build/3b-i-cross-linking`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 1: Cross-Link Types and Constants

**What This Builds:**
This creates the TypeScript types that define what a cross-link is — relationship types (many-to-one, one-to-many), the shape of linked record data stored in the database, scope filters that control which records can be linked, and system-wide limits. It also creates two utility functions: one to extract cross-link data from a record, and one to write it.

**What You'll See When It's Done:**
Claude Code will create one new file (`packages/shared/sync/cross-link-types.ts`) and one test file. You should see all tests passing.

**How Long This Typically Takes:** 5–10 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 1, Prompt 1.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 1 (search for "## Prompt 1:")

Read these context files:
- docs/reference/cross-linking.md lines 47–130 (Data Model — cross_links table, cross_link_index, field value shape, card_fields, link_scope_filter)
- docs/reference/cross-linking.md lines 444–456 (Creation Constraints — limit constants)
- packages/shared/sync/field-registry.ts (FieldTypeRegistry — understand the existing pattern)
- packages/shared/sync/types.ts (FieldTransform interface)
- packages/shared/db/schema/cross-links.ts (existing Drizzle schema)
- packages/shared/db/schema/cross-link-index.ts (existing Drizzle schema)
- packages/shared/db/schema/records.ts (canonicalData shape reference)

Create `packages/shared/sync/cross-link-types.ts` with:

1. `RelationshipType` — type union `'many_to_one' | 'one_to_many'`.

2. `RELATIONSHIP_TYPES` — const object `{ MANY_TO_ONE: 'many_to_one', ONE_TO_MANY: 'one_to_many' } as const`.

3. `LinkScopeCondition` — type for a single scope filter condition: `{ field_id: string; operator: 'eq' | 'neq' | 'in' | 'not_in' | 'contains' | 'is_empty' | 'is_not_empty'; value?: unknown }`.

4. `LinkScopeFilter` — type for the scope filter JSONB shape: `{ conditions: LinkScopeCondition[]; logic: 'and' | 'or' }`.

5. `LinkedRecordEntry` — type for a single linked record in the canonical field value: `{ record_id: string; table_id: string; display_value: string; _display_updated_at: string }`.

6. `CrossLinkFieldValue` — type for the complete cross-link field value in canonical JSONB: `{ type: 'cross_link'; value: { linked_records: LinkedRecordEntry[]; cross_link_id: string } }`.

7. `CROSS_LINK_LIMITS` — const object with:
   - `MAX_LINKS_PER_RECORD: 500`
   - `DEFAULT_LINKS_PER_RECORD: 50`
   - `MAX_DEFINITIONS_PER_TABLE: 20`
   - `MAX_DEPTH: 5`
   - `DEFAULT_DEPTH: 3`
   - `CIRCUIT_BREAKER_THRESHOLD: 1000`

8. `extractCrossLinkField(canonicalData: Record<string, unknown>, fieldId: string): CrossLinkFieldValue | null` — safely extracts and type-narrows a cross-link field value from canonical JSONB. Returns `null` if the field doesn't exist or isn't a cross-link type.

9. `setCrossLinkField(canonicalData: Record<string, unknown>, fieldId: string, value: CrossLinkFieldValue): Record<string, unknown>` — returns a new canonical data object with the cross-link field value set. Does not mutate the input.

Export everything. Write unit tests in `packages/shared/sync/__tests__/cross-link-types.test.ts` covering:
- `extractCrossLinkField` returns correct shape from valid canonical JSONB
- `extractCrossLinkField` returns `null` for missing field, wrong type, malformed data
- `setCrossLinkField` merges correctly without mutating input
- `setCrossLinkField` overwrites existing cross-link field value

Do NOT build: Zod validation schemas (Prompt 2), FieldTypeRegistry registration (Prompt 2), database queries, server actions, or Impact Analysis types (Post-MVP).

Git: Commit with message `feat(cross-link): add cross-link types, constants and canonical field utilities [Phase 3B-i, Prompt 1]`
```

[CHECKPOINT]
```
Look for:
- New file at packages/shared/sync/cross-link-types.ts
- New test file at packages/shared/sync/__tests__/cross-link-types.test.ts
- All tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 2: Zod Schemas and Field Type Registration

**What This Builds:**
This creates the validation rules that protect the system from bad data when creating or updating cross-links. It also registers the "linked record" as a recognized field type in the system's field type engine, so the sync engine and grid know how to handle it.

**What You'll See When It's Done:**
Claude Code will create two new files (schemas and field type registration) plus two test files. All tests should pass.

**How Long This Typically Takes:** 5–10 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 1, Prompt 2.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 2 (search for "## Prompt 2:")

Read these context files:
- docs/reference/cross-linking.md lines 47–130 (Data Model — link_scope_filter, card_fields)
- docs/reference/cross-linking.md lines 289–296 (Cross-Link + Sync Interaction — sync neutrality)
- packages/shared/sync/cross-link-types.ts (just created in Prompt 1)
- packages/shared/sync/field-registry.ts (FieldTypeRegistry — to understand the registration pattern)
- packages/shared/sync/types.ts (FieldTransform interface)

**Part A: Zod Schemas** — Create `packages/shared/sync/cross-link-schemas.ts`:

1. `linkScopeConditionSchema` — validates a single scope filter condition. `operator` must be one of `eq|neq|in|not_in|contains|is_empty|is_not_empty`. `value` is optional (not required for `is_empty`/`is_not_empty`).

2. `linkScopeFilterSchema` — validates the full scope filter: `{ conditions: linkScopeConditionSchema[], logic: 'and' | 'or' }`. Conditions array can be empty (no filter).

3. `createCrossLinkSchema` — validates creation input:
   - `name` (string, 1–255 chars)
   - `sourceTableId` (uuid)
   - `sourceFieldId` (uuid)
   - `targetTableId` (uuid)
   - `targetDisplayFieldId` (uuid)
   - `relationshipType` (enum: `many_to_one | one_to_many`)
   - `reverseFieldId` (uuid, optional)
   - `linkScopeFilter` (optional, uses `linkScopeFilterSchema`)
   - `cardFields` (array of uuid strings, optional, default `[]`)
   - `maxLinksPerRecord` (integer, min 1, max `CROSS_LINK_LIMITS.MAX_LINKS_PER_RECORD`, optional, default `CROSS_LINK_LIMITS.DEFAULT_LINKS_PER_RECORD`)
   - `maxDepth` (integer, min 1, max `CROSS_LINK_LIMITS.MAX_DEPTH`, optional, default `CROSS_LINK_LIMITS.DEFAULT_DEPTH`)

4. `updateCrossLinkSchema` — validates update input. All fields optional except at least one must be provided. Same constraints as create for each field.

5. `linkRecordsSchema` — validates: `{ crossLinkId: uuid, sourceRecordId: uuid, targetRecordIds: uuid[] (1–500 items) }`.

6. `unlinkRecordsSchema` — validates: `{ crossLinkId: uuid, sourceRecordId: uuid, targetRecordIds: uuid[] (1–500 items) }`.

**Part B: FieldTypeRegistry Registration** — Create `packages/shared/sync/cross-link-field-type.ts`:

Register the `linked_record` field type in FieldTypeRegistry for the `canonical` platform with identity transform (canonical → canonical, no conversion needed since cross-links are EveryStack-native, not platform-synced). The `toCanonical` and `fromCanonical` transforms should validate the `CrossLinkFieldValue` shape and pass through. Import and call the registration at module load so it auto-registers when imported.

**Tests:** Write unit tests in `packages/shared/sync/__tests__/cross-link-schemas.test.ts`:
- `createCrossLinkSchema` accepts valid input, rejects missing required fields, rejects invalid relationship types
- `linkScopeFilterSchema` validates correct operators, rejects invalid operators
- `linkRecordsSchema` rejects empty `targetRecordIds`, rejects >500 items
- `updateCrossLinkSchema` rejects when no fields provided
- Boundary values: `maxLinksPerRecord` at 0, 1, 500, 501; `maxDepth` at 0, 1, 5, 6

Write unit tests in `packages/shared/sync/__tests__/cross-link-field-type.test.ts`:
- `linked_record` field type registered in FieldTypeRegistry for `canonical` platform
- Identity transform: `toCanonical` passes through valid `CrossLinkFieldValue`
- `toCanonical` returns null/empty for invalid shapes

Do NOT build: Database queries or server actions (Unit 2), platform-specific adapters for Airtable/Notion, Impact Analysis schemas (Post-MVP).

Git: Commit with message `feat(cross-link): add Zod schemas and FieldTypeRegistry registration for linked_record [Phase 3B-i, Prompt 2]`
```

[CHECKPOINT]
```
Look for:
- New file at packages/shared/sync/cross-link-schemas.ts
- New file at packages/shared/sync/cross-link-field-type.ts
- New test files for both
- All tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

### VERIFY SESSION A — Unit 1, Prompts 1–2 — Completes Unit 1

**What This Step Does:**
This runs the full test suite against everything Unit 1 built. It also checks that Unit 1 produced everything it promised (its interface contract).

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-i, Unit 1 (Prompts 1–2):
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: confirm these exports resolve correctly by checking the source files:

Interface contract verification (Unit 1):
- [ ] [CONTRACT] `RelationshipType`, `RELATIONSHIP_TYPES` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `LinkScopeFilter`, `LinkScopeCondition` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `CrossLinkFieldValue`, `LinkedRecordEntry` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `CROSS_LINK_LIMITS` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `extractCrossLinkField`, `setCrossLinkField` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `createCrossLinkSchema`, `updateCrossLinkSchema`, `linkScopeFilterSchema`, `linkRecordsSchema`, `unlinkRecordsSchema` exported from `packages/shared/sync/cross-link-schemas.ts`
- [ ] [CONTRACT] `linked_record` field type registered in FieldTypeRegistry for `canonical` platform in `packages/shared/sync/cross-link-field-type.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 1–2, unit 1 complete [Phase 3B-i, VP-1]"
git push origin build/3b-i-cross-linking
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 1 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session A — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 1–2 (Unit 1)

### Files Created
- packages/shared/sync/cross-link-types.ts
- packages/shared/sync/cross-link-schemas.ts
- packages/shared/sync/cross-link-field-type.ts
- packages/shared/sync/__tests__/cross-link-types.test.ts
- packages/shared/sync/__tests__/cross-link-schemas.test.ts
- packages/shared/sync/__tests__/cross-link-field-type.test.ts

### Files Modified
- [list any modified files Claude Code touched]

### Schema Changes
- None

### New Domain Terms Introduced
- None (RelationshipType, CrossLinkFieldValue, LinkScopeFilter already in GLOSSARY)
```

---

### ═══ UNIT 2: Cross-Link Definition CRUD & Record Linking ═══

**What This Unit Builds:**
This is the operational core — it builds the ability to create, read, update, and delete cross-link definitions (the rules for how two tables connect), plus the ability to actually link and unlink individual records. When someone says "connect this Client record to that Project record," this unit makes that happen. It also enforces all the rules: permission checks, link limits, scope filters, and audit logging.

**What Comes Out of It:**
When done, the system can create cross-link definitions, link records to each other, validate that links are allowed, and clean everything up when links or definitions are deleted. All operations are logged and permission-checked.

**What It Needs from Prior Work:**
This unit uses the types, schemas, and utilities from Unit 1, which you just built.

---

### BUILD SESSION B — Unit 2, Prompts 3–4

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 2 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 3: Cross-Link Data Functions and Permission Checks

**What This Builds:**
This creates the "read" side of cross-linking — functions to look up cross-link definitions, validate whether a link is allowed, and check if a user has permission to create or modify cross-links. These are the building blocks that the create/update/delete actions (next prompt) will use.

**What You'll See When It's Done:**
Claude Code will extend the existing `apps/web/src/data/cross-links.ts` file with 5 new functions and add integration tests. Tests should pass (requires Docker for the database).

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 2, Prompt 3.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 3 (search for "## Prompt 3:")

Read these context files:
- docs/reference/cross-linking.md lines 47–130 (Data Model)
- docs/reference/cross-linking.md lines 444–456 (Creation Constraints)
- docs/reference/cross-linking.md lines 458–494 (Cross-Link Creation & Modification Permissions)
- apps/web/src/data/cross-links.ts (existing file — extend it, keep existing functions)
- packages/shared/sync/cross-link-types.ts (Unit 1 output — import types and constants)
- packages/shared/auth/check-role.ts (resolveEffectiveRole, checkRole patterns)
- packages/shared/db/schema/cross-links.ts (Drizzle schema)
- packages/shared/db/schema/cross-link-index.ts (Drizzle schema)
- packages/shared/db/schema/records.ts (records table)
- apps/web/src/actions/record-actions.ts (server action pattern reference)

Extend `apps/web/src/data/cross-links.ts` with these new data functions (keep existing `getLinkedRecords()` and `getLinkedRecordCount()` untouched):

1. `getCrossLinkDefinition(tenantId: string, crossLinkId: string): Promise<CrossLink | null>` — fetch a single cross-link definition by ID, tenant-scoped.

2. `listCrossLinkDefinitions(tenantId: string, tableId: string): Promise<CrossLink[]>` — list all cross-link definitions where `source_table_id = tableId`, ordered by `created_at`.

3. `getCrossLinksByTarget(tenantId: string, targetTableId: string): Promise<CrossLink[]>` — reverse lookup: all definitions pointing at `targetTableId`.

4. `validateLinkTarget(tenantId: string, crossLinkId: string, targetRecordId: string): Promise<{ valid: boolean; reason?: string }>` — validates:
   - Target record exists and belongs to correct target table
   - Target record is not archived/deleted
   - Scope filter passes (evaluate `link_scope_filter` conditions against target record's canonical data)
   - Same-record self-link blocked
   - Link count under `max_links_per_record` limit

5. `checkCrossLinkPermission(tenantId: string, userId: string, sourceTableId: string, targetTableId: string, operation: 'create' | 'structural' | 'operational'): Promise<boolean>` — permission check:
   - `create` / `structural`: Must be Manager of both tables (same base), or Admin/Owner (cross-base)
   - `operational`: Must be Manager of either table
   - Uses `resolveEffectiveRole()` on both source and target table workspaces

Write integration tests in `apps/web/src/data/__tests__/cross-links.integration.test.ts` (extend existing):
- `getCrossLinkDefinition` returns correct definition, returns null for wrong tenant
- `listCrossLinkDefinitions` returns only definitions for specified table
- `getCrossLinksByTarget` returns reverse lookups correctly
- `validateLinkTarget` rejects archived records, scope filter violations, same-record self-links
- `checkCrossLinkPermission` enforces Manager/Admin/Owner rules per operation type
- `testTenantIsolation()` for all new data functions

Do NOT build: Server actions for CRUD (Prompt 4), record linking/unlinking (Prompt 5), display value cascade (Unit 4).

Git: Commit with message `feat(cross-link): add data functions for definitions, validation and permission checks [Phase 3B-i, Prompt 3]`
```

[CHECKPOINT]
```
Look for:
- Extended apps/web/src/data/cross-links.ts with 5 new functions
- Integration tests added or extended
- All tests passing (Docker must be running for integration tests)
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 4: Cross-Link Definition CRUD Server Actions

**What This Builds:**
This creates the server actions for creating, updating, and deleting cross-link definitions. These are the mutations — when a user creates a new connection between two tables, or modifies the settings of an existing one, or removes one entirely. Each action enforces permissions, validates input, and logs the change.

**What You'll See When It's Done:**
Claude Code will create a new server actions file and tests. Tests should pass.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 2, Prompt 4.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 4 (search for "## Prompt 4:")

Read these context files:
- docs/reference/cross-linking.md lines 47–130 (Data Model)
- docs/reference/cross-linking.md lines 444–456 (Creation Constraints)
- docs/reference/cross-linking.md lines 458–494 (Permissions)
- docs/reference/cross-linking.md lines 406–411 (Audit Log Condensation)
- apps/web/src/data/cross-links.ts (data functions from Prompt 3)
- packages/shared/sync/cross-link-schemas.ts (Zod schemas from Unit 1)
- packages/shared/sync/cross-link-types.ts (types and constants from Unit 1)
- apps/web/src/actions/record-actions.ts (server action pattern reference)
- packages/shared/db/schema/cross-links.ts (Drizzle schema)
- packages/shared/db/schema/fields.ts (fields table — for reverse field creation)

Create `apps/web/src/actions/cross-link-actions.ts` with definition CRUD server actions following the pattern in `apps/web/src/actions/record-actions.ts`:

1. `createCrossLinkDefinition(input)`:
   - Validate input with `createCrossLinkSchema`
   - Check tenant boundary: both `sourceTableId` and `targetTableId` belong to calling user's tenant
   - Enforce `MAX_DEFINITIONS_PER_TABLE` limit
   - Check permission via `checkCrossLinkPermission(tenantId, userId, sourceTableId, targetTableId, 'create')`
   - Create reverse field on target table if `reverseFieldId` requested
   - Insert `cross_links` row
   - Write audit log: `action: 'cross_link.created'`
   - Return the created `CrossLink`

2. `updateCrossLinkDefinition(id, input)`:
   - Validate input with `updateCrossLinkSchema`
   - Fetch existing definition, verify tenant ownership
   - Determine if change is structural or operational:
     - Structural: `targetTableId`, `relationshipType`, `reverseFieldId` → requires `structural` permission
     - Operational: `name`, `linkScopeFilter`, `targetDisplayFieldId`, `cardFields`, `maxLinksPerRecord`, `maxDepth` → requires `operational` permission
   - Check appropriate permission
   - Update the row
   - Write audit log: `action: 'cross_link.updated'` with `changes` detail
   - Return updated `CrossLink`

3. `deleteCrossLinkDefinition(id)`:
   - Fetch definition, verify tenant ownership
   - Check `structural` permission
   - Delete all `cross_link_index` entries (cascade handled by FK)
   - Clear canonical field values from source records
   - If `reverseFieldId` exists, delete the reverse field
   - Delete the `cross_links` row
   - Write audit log: `action: 'cross_link.deleted'`

All actions extract `tenantId` and `userId` from Clerk session context.

Write unit tests in `apps/web/src/actions/__tests__/cross-link-actions.test.ts`:
- Create succeeds with valid input, creates reverse field when requested
- Create blocked by `MAX_DEFINITIONS_PER_TABLE` limit
- Create blocked by permission denial
- Update distinguishes structural vs operational permission checks
- Delete cascades: removes index entries, clears canonical field values, removes reverse field

Do NOT build: Record linking/unlinking (Prompt 5), display value cascade on delete (Unit 4), Impact Analysis modal (Post-MVP).

Git: Commit with message `feat(cross-link): add cross-link definition CRUD server actions [Phase 3B-i, Prompt 4]`
```

[CHECKPOINT]
```
Look for:
- New file at apps/web/src/actions/cross-link-actions.ts
- New test file at apps/web/src/actions/__tests__/cross-link-actions.test.ts
- All tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

### BUILD SESSION C — Unit 2, Prompts 5–6

Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 5: Record Link and Unlink Actions

**What This Builds:**
This creates the ability to actually link and unlink individual records — the core user-facing operation. When a user picks a record in the Link Picker and says "connect these," this is the code that makes it happen. It creates index entries for fast lookup, updates the source record's stored data with the linked record's display value, and validates everything first.

**What You'll See When It's Done:**
Claude Code will extend the cross-link actions file with two new actions (`linkRecords`, `unlinkRecords`) and create a stub module for the cascade system. Integration tests should pass.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 2, Prompt 5.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 5 (search for "## Prompt 5:")

Read these context files:
- docs/reference/cross-linking.md lines 47–130 (Data Model — cross_link_index, field value shape)
- docs/reference/cross-linking.md lines 444–456 (Creation Constraints — max links, cycle detection)
- apps/web/src/actions/cross-link-actions.ts (extend — add link/unlink actions)
- apps/web/src/data/cross-links.ts (data functions from Prompt 3)
- packages/shared/sync/cross-link-types.ts (types and utilities from Unit 1)
- packages/shared/sync/cross-link-schemas.ts (linkRecordsSchema, unlinkRecordsSchema)
- packages/shared/db/schema/cross-link-index.ts (Drizzle schema)
- packages/shared/db/schema/records.ts (records table)

Add to `apps/web/src/actions/cross-link-actions.ts`:

1. `linkRecords(input)`:
   - Validate input with `linkRecordsSchema`
   - Fetch cross-link definition, verify tenant ownership
   - For each target record: validate via `validateLinkTarget()`, check link count
   - Insert `cross_link_index` entries (batch, ON CONFLICT DO NOTHING)
   - Update source record's `canonical_data` using `setCrossLinkField()`:
     - Read existing value or initialize empty
     - Append new `LinkedRecordEntry` items with display_value from target
     - Write updated canonical data back
   - Enqueue display value cascade job (stub for now)
   - Write audit log: `action: 'cross_link.records_linked'` with `record_ids` array

2. `unlinkRecords(input)`:
   - Validate input
   - Delete `cross_link_index` entries for specified pairs
   - Update source record's `canonical_data`: remove unlinked entries
   - Enqueue display value cascade job (stub)
   - Write audit log: `action: 'cross_link.records_unlinked'`

**Cycle detection note:** Cycles are allowed at link time. Detection happens at query time (Unit 3) via `visited` set with bounded iteration.

Create `apps/web/src/lib/cross-link-cascade.ts` as a stub module:
```typescript
export async function enqueueCascadeJob(
  tenantId: string,
  targetRecordId: string,
  priority: 'high' | 'low',
): Promise<void> {
  // TODO: Unit 4 — implement BullMQ cascade processor
}
```

Write integration tests:
- `linkRecords` creates index entries and updates canonical JSONB correctly
- `linkRecords` respects `max_links_per_record` limit
- `linkRecords` rejects invalid targets
- `linkRecords` skips duplicate links (ON CONFLICT DO NOTHING)
- `unlinkRecords` removes index entries and updates canonical JSONB
- Link/unlink audit log entries created

Do NOT build: Cascade processor (Unit 4), Link Picker UI (Unit 5), bulk deletion cascade (Unit 4).

Git: Commit with message `feat(cross-link): add record link/unlink actions with index maintenance [Phase 3B-i, Prompt 5]`
```

[CHECKPOINT]
```
Look for:
- Extended apps/web/src/actions/cross-link-actions.ts with linkRecords and unlinkRecords
- New stub at apps/web/src/lib/cross-link-cascade.ts
- Integration tests passing (Docker required)
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 6: Test Factory Extension and Integration Tests

**What This Builds:**
This creates a comprehensive test factory for cross-links — a helper that sets up a complete cross-link test scenario in one call (definition + records + index entries + canonical field values). It also adds thorough end-to-end integration tests covering the full lifecycle: create a definition, link records, verify data, unlink, delete, verify cleanup.

**What You'll See When It's Done:**
Claude Code will extend the factories file and the integration test file. All tests should pass.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 2, Prompt 6.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 6 (search for "## Prompt 6:")

Read these context files:
- docs/reference/cross-linking.md lines 47–130 (Data Model — for test fixture shapes)
- packages/shared/testing/factories.ts (existing factories — extend)
- apps/web/src/data/__tests__/cross-links.integration.test.ts (existing tests — extend)
- apps/web/src/actions/cross-link-actions.ts (server actions from Prompts 4–5)
- apps/web/src/data/cross-links.ts (data functions from Prompt 3)

1. Extend `packages/shared/testing/factories.ts` with `createTestCrossLinkWithIndex(overrides?)`:
   - Creates complete cross-link test fixture: definition + source/target records + index entries + canonical field values
   - Accepts overrides for definition fields, record count, links per record
   - Returns `{ crossLink, sourceRecords, targetRecords, indexEntries }`
   - Uses existing `createTestCrossLink` and `createTestRecord` factories internally

2. Comprehensive integration tests — extend `apps/web/src/data/__tests__/cross-links.integration.test.ts`:
   - End-to-end: create definition → link records → verify index → verify canonical JSONB → unlink → verify cleanup
   - `getCrossLinkDefinition` tenant isolation via `testTenantIsolation()`
   - `listCrossLinkDefinitions` returns only definitions for specified table
   - `getCrossLinksByTarget` returns correct reverse lookups
   - `validateLinkTarget` comprehensive edge cases
   - Permission tests: Manager creates same-base link, Team Member denied, Admin creates cross-base
   - Create → delete → verify cascade
   - Max definitions per table enforcement

Do NOT build: Resolution functions (Unit 3), cascade processor (Unit 4), UI components (Unit 5).

Git: Commit with message `test(cross-link): add cross-link factory and comprehensive integration tests [Phase 3B-i, Prompt 6]`
```

[CHECKPOINT]
```
Look for:
- Extended packages/shared/testing/factories.ts with createTestCrossLinkWithIndex
- Extended integration tests with comprehensive coverage
- All tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

### VERIFY SESSION B — Unit 2, Prompts 3–6 — Completes Unit 2

**What This Step Does:**
This runs the full test suite against everything Unit 2 built. It also checks that Unit 2 produced everything it promised (its interface contract).

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-i, Unit 2 (Prompts 3–6):
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met

Interface contract verification (Unit 2):
- [ ] [CONTRACT] `getCrossLinkDefinition()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `listCrossLinkDefinitions()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `getCrossLinksByTarget()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `validateLinkTarget()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `checkCrossLinkPermission()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `createCrossLinkDefinition()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `updateCrossLinkDefinition()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `deleteCrossLinkDefinition()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `linkRecords()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `unlinkRecords()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `createTestCrossLinkWithIndex()` exported from `packages/shared/testing/factories.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 3–6, unit 2 complete [Phase 3B-i, VP-2]"
git push origin build/3b-i-cross-linking
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 2 to `passed-review`.

Open MODIFICATIONS.md. Add session blocks for Sessions B and C:

## Session B — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 3–4 (Unit 2, first half)

### Files Created
- apps/web/src/actions/cross-link-actions.ts
- apps/web/src/actions/__tests__/cross-link-actions.test.ts

### Files Modified
- apps/web/src/data/cross-links.ts (added 5 new data functions)
- apps/web/src/data/__tests__/cross-links.integration.test.ts (extended)

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session C — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 5–6 (Unit 2, second half)

### Files Created
- apps/web/src/lib/cross-link-cascade.ts (stub — replaced in Unit 4)

### Files Modified
- apps/web/src/actions/cross-link-actions.ts (added linkRecords, unlinkRecords)
- packages/shared/testing/factories.ts (added createTestCrossLinkWithIndex)
- apps/web/src/data/__tests__/cross-links.integration.test.ts (extended)

### Schema Changes
- None

### New Domain Terms Introduced
- None
```

---

### ═══ UNIT 3: Query-Time Resolution & Permission Intersection ═══

**What This Unit Builds:**
This builds the "read" side of cross-linking — what happens when the system needs to show linked records to a user. There are three levels: Level 0 is for the grid (instant — just reads pre-stored display values, zero database queries). Level 1 is for Record View (one efficient query to get full linked records). Level 2 is for document templates that need to traverse chains of links (A links to B, B links to C). It also builds the permission layer that ensures users only see fields they're allowed to see on the linked records.

**What Comes Out of It:**
When done, the grid can show linked record names instantly, Record View can show full linked record details, and document templates can traverse link chains. All of this respects field-level permissions.

**What It Needs from Prior Work:**
This unit uses types from Unit 1 and data functions from Unit 2.

**Note:** Units 3, 4, and 5 can be built in any order — they all depend on Unit 2, but not on each other.

---

### BUILD SESSION D — Unit 3, Prompts 7–8

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 3 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 7: L0/L1 Resolution and Permission Intersection

**What This Builds:**
This creates the two most common ways to read linked records. L0 is what the grid calls — it just reads pre-computed display values from the record's stored data, so it's instant with zero database queries. L1 is what Record View calls — it does one efficient database query to load the full details of all linked records. It also builds the permission filter that ensures users only see fields they're authorized for on the target table.

**What You'll See When It's Done:**
Claude Code will create a new file (`apps/web/src/data/cross-link-resolution.ts`) with 4 functions and add integration tests.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 3, Prompt 7.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 7 (search for "## Prompt 7:")

Read these context files:
- docs/reference/cross-linking.md lines 132–235 (Query-Time Resolution — L0/L1/L2 patterns, depth limiting, permission intersection, performance targets)
- packages/shared/sync/cross-link-types.ts (Unit 1 — types and extraction utility)
- apps/web/src/data/cross-links.ts (Unit 2 — getCrossLinkDefinition and existing functions)
- apps/web/src/data/permissions.ts (getFieldPermissions)
- packages/shared/auth/permissions/resolve.ts (resolveFieldPermission)
- packages/shared/db/schema/cross-links.ts (Drizzle schema)
- packages/shared/db/schema/cross-link-index.ts (index table)
- packages/shared/db/schema/records.ts (records table)

Create `apps/web/src/data/cross-link-resolution.ts`:

1. `resolveLinkedRecordsL0(canonicalData, fieldId)` — pure extraction from canonical JSONB via `extractCrossLinkField()`. Zero database queries. This is what the grid calls.

2. `resolveLinkedRecordsL1(tenantId, recordId, crossLinkId, opts?)` — fetch linked record IDs from `cross_link_index`, single `IN` query for full records. Paginate (default limit 100). Order by index `created_at` ASC.

3. `resolveLinkedRecordPermissions(tenantId, userId, crossLink, targetTableId)` — load `card_fields` from definition, resolve user's field permissions on target table, intersect. If `card_fields` empty, use all non-hidden fields.

4. `filterLinkedRecordByPermissions(record, permittedFieldIds)` — strip non-permitted fields from canonical_data. Zero permitted fields → minimal `{ id, canonicalData: {} }`.

Write integration tests:
- L0: extracts display values from canonical JSONB with zero database queries
- L1: returns full linked records, paginated, ordered by creation time
- Permission intersection: card_fields intersected with user's target table permissions
- Zero permitted fields → minimal shape returned
- Tenant isolation for L1

Do NOT build: L2 traversal (Prompt 8), circuit breaker (Prompt 8), display value cascade (Unit 4), Link Picker UI (Unit 5).

Git: Commit with message `feat(cross-link): add L0/L1 resolution and permission intersection [Phase 3B-i, Prompt 7]`
```

[CHECKPOINT]
```
Look for:
- New file at apps/web/src/data/cross-link-resolution.ts
- Integration tests added
- All tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 8: L2 Bounded Traversal and Circuit Breaker

**What This Builds:**
This creates the deepest level of cross-link resolution — the ability to traverse chains of links across multiple levels (A→B→C→D). This is used by document templates for merge-tag resolution. It includes safety features: a circuit breaker that stops if any level has over 1,000 records (to prevent runaway queries), cycle detection so A→B→C→A doesn't loop forever, and a hard depth cap of 5 levels.

**What You'll See When It's Done:**
Claude Code will extend the resolution file with L2 traversal and add integration tests including cycle detection and circuit breaker tests.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 3, Prompt 8.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 8 (search for "## Prompt 8:")

Read these context files:
- docs/reference/cross-linking.md lines 152–207 (L2 Resolution, Depth Limiting, Circuit Breaker)
- apps/web/src/data/cross-link-resolution.ts (Prompt 7 output — extend this file)
- packages/shared/sync/cross-link-types.ts (CROSS_LINK_LIMITS for circuit breaker threshold)

Add to `apps/web/src/data/cross-link-resolution.ts`:

1. `LinkedRecordTree` type:
   ```typescript
   interface LinkedRecordTree {
     root: string;
     levels: Array<{ depth: number; records: DbRecord[] }>;
     truncated: boolean;
     truncationReason?: 'circuit_breaker' | 'max_depth';
   }
   ```

2. `resolveLinkedRecordsL2(tenantId, recordId, crossLinkId, maxDepth?)`:
   - Iterative bounded traversal with `visited` Set for cycle detection
   - Per-definition `maxDepth` respected, hard cap at `CROSS_LINK_LIMITS.MAX_DEPTH` (5)
   - Circuit breaker: if any level > `CROSS_LINK_LIMITS.CIRCUIT_BREAKER_THRESHOLD` (1000) records, stop, return truncated result
   - Apply permission intersection at each level

Write integration tests:
- L2 implements bounded traversal with visited set for cycle detection
- L2 stops at maxDepth (default from definition, hard cap at 5)
- Circuit breaker triggers at >1000 records, returns truncated result with warning flag
- Cycle detection: create A→B→C→A cycle, verify no infinite loop, each record appears once
- Permission intersection applied at each level
- Performance: L1 with 20 links <50ms, L2 two-level 20→100 <200ms

Do NOT build: Multi-hop cascade propagation (Post-MVP), deep traversal beyond 5 levels, rollups across cross-links.

Git: Commit with message `feat(cross-link): add L2 bounded traversal with circuit breaker [Phase 3B-i, Prompt 8]`
```

[CHECKPOINT]
```
Look for:
- Extended apps/web/src/data/cross-link-resolution.ts with L2 traversal
- LinkedRecordTree type exported
- Integration tests including cycle detection and circuit breaker
- All tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

### VERIFY SESSION C — Unit 3, Prompts 7–8 — Completes Unit 3

**What This Step Does:**
This runs the full test suite against everything Unit 3 built and verifies the interface contract.

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-i, Unit 3 (Prompts 7–8):
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met

Interface contract verification (Unit 3):
- [ ] [CONTRACT] `resolveLinkedRecordsL0()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordsL1()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordsL2()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `LinkedRecordTree` type exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordPermissions()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `filterLinkedRecordByPermissions()` exported from `apps/web/src/data/cross-link-resolution.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 7–8, unit 3 complete [Phase 3B-i, VP-3]"
git push origin build/3b-i-cross-linking
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 3 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session D — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 7–8 (Unit 3)

### Files Created
- apps/web/src/data/cross-link-resolution.ts
- apps/web/src/data/__tests__/cross-link-resolution.integration.test.ts

### Files Modified
- [list any modified files]

### Schema Changes
- None

### New Domain Terms Introduced
- LinkedRecordTree (new type for L2 resolution results)
```

---

### ═══ UNIT 4: Display Value Cascade & Scalability Infrastructure ═══

**What This Unit Builds:**
This builds the background system that keeps linked record display values up to date. When someone changes a target record's name (e.g., renames a Client), all the source records that link to it need their cached display value updated. This unit builds the job queue, the processor that does the updating (with smart optimizations like content hash skipping), and safety mechanisms like backpressure detection and integrity checks.

**What Comes Out of It:**
When done, display values update automatically in the background when target records change. The system handles high volumes through batching, skips unnecessary updates via content hash comparison, and can detect and repair any data drift.

**What It Needs from Prior Work:**
This unit uses types from Unit 1 and the cross-link index data from Unit 2.

**Note:** Units 3, 4, and 5 can be built in any order — they all depend on Unit 2, but not on each other.

---

### BUILD SESSION E — Unit 4, Prompts 9–10

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 4 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 9: Queue Registration and Cascade Processor

**What This Builds:**
This creates the BullMQ job queue for cross-link cascade updates and the processor that handles them. When a target record's display field changes, a job is queued. The processor reads the new display value, checks if it actually changed (via content hash — skips about 70% of jobs), and if changed, updates all source records in batches of 500. It includes a single-hop rule: cascade events don't trigger further cascades, preventing infinite chains.

**What You'll See When It's Done:**
Claude Code will create new files for queue types, the cascade processor, and replace the cascade stub from Prompt 5. Tests should pass.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 4, Prompt 9.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 9 (search for "## Prompt 9:")

Read these context files:
- docs/reference/cross-linking.md lines 268–287 (Display Value Maintenance — staleness, refresh triggers, content hash)
- docs/reference/cross-linking.md lines 298–368 (Scalability — cascade fan-out, batched execution, concurrency, single-hop rule)
- packages/shared/queue/constants.ts (existing QUEUE_NAMES)
- packages/shared/queue/types.ts (BaseJobData, QueueJobDataMap)
- apps/worker/src/lib/base-processor.ts (BaseProcessor class)
- apps/worker/src/queues.ts (queue initialization pattern)
- apps/web/src/lib/cross-link-cascade.ts (stub from Prompt 5 — replace)
- packages/shared/sync/cross-link-types.ts (Unit 1 types)
- packages/shared/db/schema/cross-link-index.ts (index table)
- packages/shared/realtime/events.ts (existing REALTIME_EVENTS)

1. Queue registration — extend `packages/shared/queue/constants.ts`:
   - Add `'cross-link'` to `QUEUE_NAMES`

2. Job data types — extend `packages/shared/queue/types.ts`:
   - `CrossLinkCascadeJobData` extending `BaseJobData`: `{ tenantId, targetRecordId, priority, reason }`
   - `CrossLinkIndexRebuildJobData` extending `BaseJobData`: `{ tenantId, crossLinkId }`
   - Update `QueueJobDataMap`

3. Cascade processor — create `apps/worker/src/processors/cross-link/cascade.ts`:
   - `processCrossLinkCascade(job)`:
     - Read target record display value, compute content hash
     - If unchanged → skip (~70% skip path)
     - If changed → query index for affected records, batch update in chunks of 500 with 10ms sleep
     - Use `_display_updated_at` ordering guard
     - Publish ONE `records.batch_updated` event per affected source table
     - Single-hop rule: if `reason === 'display_value_refresh'`, return immediately

4. Per-tenant concurrency — configure in `apps/worker/src/queues.ts`:
   - Register `cross-link` queue with group concurrency of 2 keyed on `tenantId`

5. Replace cascade stub — update `apps/web/src/lib/cross-link-cascade.ts`:
   - `enqueueCascadeJob(tenantId, targetRecordId, priority)`: real BullMQ enqueue with jobId for dedup

Write unit tests:
- Content hash skip: unchanged → no updates
- Content hash changed: updates in batches of 500
- Single-hop rule: `reason: 'display_value_refresh'` → immediate return
- `_display_updated_at` ordering: stale update → no-op
- One event per affected source table
- Job deduplication

Do NOT build: Backpressure check (Prompt 10), index integrity check (Prompt 10), bulk deletion cascade (Prompt 10).

Git: Commit with message `feat(cross-link): add display value cascade processor with content hash, batching and single-hop rule [Phase 3B-i, Prompt 9]`
```

[CHECKPOINT]
```
Look for:
- Extended packages/shared/queue/constants.ts and types.ts
- New file at apps/worker/src/processors/cross-link/cascade.ts
- Updated apps/web/src/lib/cross-link-cascade.ts (stub replaced)
- Unit tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 10: Backpressure, Integrity Check and Bulk Deletion

**What This Builds:**
This adds the safety and scaling mechanisms on top of the cascade processor. Backpressure detection tells the sync scheduler to slow down when the cascade queue is congested. Bulk deletion handles cleanup when an entire table is deleted. The integrity check periodically samples the data to detect drift and triggers a full rebuild if needed. Think of these as the guardrails that keep the cascade system healthy.

**What You'll See When It's Done:**
Claude Code will extend the cascade module and create two new processor files. Tests should pass.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 4, Prompt 10.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 10 (search for "## Prompt 10:")

Read these context files:
- docs/reference/cross-linking.md lines 369–442 (Scalability — job dedup, sync backpressure, bulk deletion, display value ordering, index consistency & rebuild)
- apps/web/src/lib/cross-link-cascade.ts (extend — add backpressure)
- apps/worker/src/processors/cross-link/cascade.ts (Prompt 9 output — reference)
- packages/shared/realtime/events.ts (extend — add DISPLAY_VALUE_UPDATED)
- apps/worker/src/index.ts (worker entry point — register processors)

1. Backpressure — extend `apps/web/src/lib/cross-link-cascade.ts`:
   - `checkCascadeBackpressure(tenantId)`: reads Redis counter, returns true if >500 pending jobs
   - Increment counter on enqueue, decrement on job completion

2. Bulk deletion cascade:
   - When table soft-deleted → batch 5,000 entries, clear dead links, 50ms sleep between batches
   - One `records.batch_updated` event per affected source table

3. Index rebuild processor — `apps/worker/src/processors/cross-link/index-rebuild.ts`:
   - `processIndexRebuild(job)`: delete all index entries for definition, rebuild from canonical_data in batches of 1,000

4. Integrity check — `apps/worker/src/processors/cross-link/integrity-check.ts`:
   - `scheduleIntegrityCheck(tenantId, crossLinkId)`: samples 100/500/1,000 entries by table size
   - If >1% drift → enqueue full rebuild + log alert
   - Failed/timed-out cascade jobs trigger immediate check

5. Real-time event — extend `packages/shared/realtime/events.ts`:
   - Add `DISPLAY_VALUE_UPDATED` to `REALTIME_EVENTS`

6. Worker entry — update `apps/worker/src/index.ts`:
   - Register cross-link cascade and index rebuild processors

Write unit tests:
- `checkCascadeBackpressure` returns true when >500 pending
- Bulk deletion: clears dead links in batches of 5,000
- Index rebuild: deletes and recreates from canonical data
- Integrity check: detects >1% drift, triggers rebuild
- `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED` exists

Do NOT build: Cascade visualization UI (Post-MVP), multi-hop propagation (Post-MVP).

Git: Commit with message `feat(cross-link): add backpressure, bulk deletion cascade, integrity check and index rebuild [Phase 3B-i, Prompt 10]`
```

[CHECKPOINT]
```
Look for:
- Extended apps/web/src/lib/cross-link-cascade.ts with checkCascadeBackpressure
- New file at apps/worker/src/processors/cross-link/index-rebuild.ts
- New file at apps/worker/src/processors/cross-link/integrity-check.ts
- Extended packages/shared/realtime/events.ts with DISPLAY_VALUE_UPDATED
- Updated apps/worker/src/index.ts with processor registration
- All tests passing
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

### VERIFY SESSION D — Unit 4, Prompts 9–10 — Completes Unit 4

**What This Step Does:**
This runs the full test suite against everything Unit 4 built and verifies the interface contract.

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-i, Unit 4 (Prompts 9–10):
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Verify `enqueueCascadeJob` is no longer a stub — check that the import from `cross-link-cascade.ts` connects to real BullMQ queue

Interface contract verification (Unit 4):
- [ ] [CONTRACT] `QUEUE_NAMES['cross-link']` in `packages/shared/queue/constants.ts`
- [ ] [CONTRACT] `CrossLinkCascadeJobData`, `CrossLinkIndexRebuildJobData` in `packages/shared/queue/types.ts`
- [ ] [CONTRACT] `processCrossLinkCascade()` in `apps/worker/src/processors/cross-link/cascade.ts`
- [ ] [CONTRACT] `processIndexRebuild()` in `apps/worker/src/processors/cross-link/index-rebuild.ts`
- [ ] [CONTRACT] `enqueueCascadeJob()` in `apps/web/src/lib/cross-link-cascade.ts`
- [ ] [CONTRACT] `checkCascadeBackpressure()` in `apps/web/src/lib/cross-link-cascade.ts`
- [ ] [CONTRACT] `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED` in `packages/shared/realtime/events.ts`
- [ ] [CONTRACT] `scheduleIntegrityCheck()` in `apps/worker/src/processors/cross-link/integrity-check.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 9–10, unit 4 complete [Phase 3B-i, VP-4]"
git push origin build/3b-i-cross-linking
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 4 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session E — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 9–10 (Unit 4)

### Files Created
- apps/worker/src/processors/cross-link/cascade.ts
- apps/worker/src/processors/cross-link/index-rebuild.ts
- apps/worker/src/processors/cross-link/integrity-check.ts
- apps/worker/src/processors/cross-link/__tests__/cascade.test.ts

### Files Modified
- packages/shared/queue/constants.ts (added 'cross-link' to QUEUE_NAMES)
- packages/shared/queue/types.ts (added CrossLinkCascadeJobData, CrossLinkIndexRebuildJobData)
- apps/web/src/lib/cross-link-cascade.ts (replaced stub with real implementation)
- packages/shared/realtime/events.ts (added DISPLAY_VALUE_UPDATED)
- apps/worker/src/index.ts (registered cross-link processors)
- apps/worker/src/queues.ts (registered cross-link queue)

### Schema Changes
- None

### New Domain Terms Introduced
- None
```

---

### ═══ UNIT 5: Link Picker UI ═══

**What This Unit Builds:**
This is the user-facing component — the dialog that opens when a user clicks a linked record cell in the grid or Record View. It provides search (type to find records to link), recent links (quick access to recently linked records), inline record creation (create a new record and link it in one step), and two selection modes: single-link for many-to-one relationships (click to pick one) and multi-link for one-to-many relationships (check multiple, then confirm).

**What Comes Out of It:**
When done, users can click a linked record field, search for records to link, see their recent links, create new records inline, and manage links — all through a polished dialog with keyboard navigation.

**What It Needs from Prior Work:**
This unit uses types from Unit 1, CRUD actions from Unit 2, and permission resolution from Unit 3.

**Note:** Units 3, 4, and 5 can be built in any order — they all depend on Unit 2, but not on each other.

---

### BUILD SESSION F — Unit 5, Prompts 11–12

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 5 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 11: Link Picker Core — Search, Recent, and Selection Modes

**What This Builds:**
This creates the Link Picker dialog — the main UI for linking records. It includes a search field that queries the target table, a "recent links" section showing the last 5 records you linked, and two selection modes based on the relationship type. For many-to-one (e.g., "assign to one client"), clicking a result selects it and closes. For one-to-many (e.g., "tag multiple projects"), you check boxes and click "Done."

**What You'll See When It's Done:**
Claude Code will create several new component files in `apps/web/src/components/cross-links/` plus data functions. The dev server should show the Link Picker when you click a linked record cell.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 5, Prompt 11.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 11 (search for "## Prompt 11:")

Read these context files:
- docs/reference/cross-linking.md lines 237–266 (Link Picker UX — search, recent, inline create, single/multi-link, mobile, card_fields config)
- docs/reference/cross-linking.md lines 94–113 (Cross-Link Field Value — display value shape for chips)
- apps/web/src/data/cross-links.ts (existing data functions — extend with search/recent)
- packages/shared/sync/cross-link-types.ts (Unit 1 types)
- apps/web/src/actions/cross-link-actions.ts (Unit 2 — linkRecords, unlinkRecords)
- apps/web/src/data/cross-link-resolution.ts (Unit 3 — resolveLinkedRecordPermissions)
- apps/web/src/components/grid/cells/ (existing cell renderers — integration point)

1. Data functions — extend `apps/web/src/data/cross-links.ts`:
   - `searchLinkableRecords(tenantId, crossLinkId, query, opts?)` — tsvector prefix matching on target table's display field, apply scope filter, paginate to 100
   - `getRecentLinkedRecords(tenantId, crossLinkId, userId, limit?)` — last N records (default 5) linked by this user

2. `LinkPickerProvider` — context managing Link Picker state: `isOpen`, `crossLinkId`, `sourceRecordId`, `mode` (single/multi), `selectedIds`

3. `useLinkPicker` hook — `open()`, `close()`, `select()`, `confirm()`, `remove()`

4. `LinkPicker` — Dialog + Command (cmdk) search, recent section, keyboard navigation, single-link mode (click to select), multi-link mode (checkbox accumulation)

5. `LinkPickerSearchResults` — renders results with card_fields, permission-aware field filtering, scroll-to-load pagination

All user-facing strings through next-intl i18n.

Do NOT build: Inline record creation form (Prompt 12), LinkedRecordChip enhanced component (Prompt 12), grid/RecordView integration (Prompt 12).

Git: Commit with message `feat(cross-link): add Link Picker with search, recent links and selection modes [Phase 3B-i, Prompt 11]`
```

[CHECKPOINT]
```
Look for:
- New files in apps/web/src/components/cross-links/ (link-picker.tsx, link-picker-provider.tsx, use-link-picker.ts, link-picker-search-results.tsx)
- Extended apps/web/src/data/cross-links.ts with searchLinkableRecords, getRecentLinkedRecords
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 12: Inline Create, LinkedRecordChip, and Grid/RecordView Integration

**What This Builds:**
This adds three finishing pieces: (1) an inline create form at the bottom of the Link Picker so users can create and link a new record in one step, (2) enhanced linked record chips with display values, click-to-open-target, remove buttons, and a shimmer animation when display values are being updated, and (3) wiring the Link Picker into the grid cell and Record View so everything works end-to-end.

**What You'll See When It's Done:**
The full cross-linking UI should work: click a linked record cell in the grid → Link Picker opens → search, select, or create records → linked record chips appear in the cell with display values.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-i (Cross-Linking Engine), Unit 5, Prompt 12.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-i.md — Prompt 12 (search for "## Prompt 12:")

Read these context files:
- docs/reference/cross-linking.md lines 237–266 (Link Picker UX — inline create, card_fields config)
- docs/reference/cross-linking.md lines 94–113 (Cross-Link Field Value — display value shape)
- apps/web/src/components/cross-links/ (Prompt 11 output — all Link Picker components)
- apps/web/src/components/grid/cells/ (existing cell renderers — Linked Record renderer)
- apps/web/src/components/record-view/ (Record View — linked field rendering)
- apps/web/src/actions/cross-link-actions.ts (link/unlink actions)

1. `LinkPickerInlineCreate`:
   - "+ New [target table name]" button at bottom of Link Picker
   - Compact form showing card_fields from the cross-link definition
   - Creates new record AND links it in one action
   - On success: closes inline create, adds to results, auto-selects

2. `LinkedRecordChip`:
   - Shows display_value with click to open target record's Record View
   - Shimmer animation while cascade in-flight (stale `_display_updated_at`)
   - Remove button (x) in edit mode
   - Truncation with tooltip

3. Grid cell integration:
   - Linked Record cell click → open Link Picker via `useLinkPicker().open()`
   - Display linked records as `LinkedRecordChip` components
   - Wrap with `LinkPickerProvider`

4. Record View integration:
   - Linked record fields open Link Picker on click
   - Display as `LinkedRecordChip` list with add/remove

All user-facing strings through next-intl i18n.

Write component tests:
- `LinkPickerInlineCreate.test.tsx`: renders form, creates and links record
- `LinkedRecordChip.test.tsx`: renders display value, remove button, shimmer state

Do NOT build: Mobile bottom sheet (Post-MVP/3H-i), drag-and-drop reordering (Post-MVP), Workspace Map visualization (Post-MVP).

Git: Commit with message `feat(cross-link): add inline create, LinkedRecordChip and grid/RecordView integration [Phase 3B-i, Prompt 12]`
```

[CHECKPOINT]
```
Look for:
- New files: link-picker-inline-create.tsx, linked-record-chip.tsx
- Modified grid cell renderer and Record View components
- Component tests added
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

### VERIFY SESSION E — Unit 5, Prompts 11–12 — Completes Unit 5 (Phase Complete)

**What This Step Does:**
This is the final verification for the entire phase. It runs the full test suite, checks i18n compliance (since we built UI), and verifies all of Unit 5's interface contract. It also does a full end-to-end integration check across all 5 units.

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-i, Unit 5 (Prompts 11–12) — FINAL PHASE VERIFICATION:
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met

Interface contract verification (Unit 5):
- [ ] [CONTRACT] `LinkPicker` exported from `apps/web/src/components/cross-links/link-picker.tsx`
- [ ] [CONTRACT] `LinkPickerProvider` exported from `apps/web/src/components/cross-links/link-picker-provider.tsx`
- [ ] [CONTRACT] `useLinkPicker()` exported from `apps/web/src/components/cross-links/use-link-picker.ts`
- [ ] [CONTRACT] `LinkedRecordChip` exported from `apps/web/src/components/cross-links/linked-record-chip.tsx`
- [ ] [CONTRACT] `LinkPickerSearchResults` exported from `apps/web/src/components/cross-links/link-picker-search-results.tsx`
- [ ] [CONTRACT] `LinkPickerInlineCreate` exported from `apps/web/src/components/cross-links/link-picker-inline-create.tsx`
- [ ] [CONTRACT] `searchLinkableRecords()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `getRecentLinkedRecords()` exported from `apps/web/src/data/cross-links.ts`

Full phase integration check:
- [ ] End-to-end: create cross-link definition → link records → see display values in grid (L0) → open Record View and see full linked records (L1) → verify Link Picker search works → unlink → verify cleanup
- [ ] Display value cascade: update target record display field → cascade updates source records → grid reflects new value
- [ ] Permission intersection: user with limited permissions sees only permitted card_fields in Link Picker

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
All integration checks must pass.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 11–12, unit 5 and phase 3B-i complete [Phase 3B-i, VP-5]"
git push origin build/3b-i-cross-linking
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 5 to `passed-review`.
Confirm all 5 units now show `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session F — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 11–12 (Unit 5)

### Files Created
- apps/web/src/components/cross-links/link-picker.tsx
- apps/web/src/components/cross-links/link-picker-provider.tsx
- apps/web/src/components/cross-links/use-link-picker.ts
- apps/web/src/components/cross-links/link-picker-search-results.tsx
- apps/web/src/components/cross-links/link-picker-inline-create.tsx
- apps/web/src/components/cross-links/linked-record-chip.tsx
- apps/web/src/components/cross-links/__tests__/LinkPickerInlineCreate.test.tsx
- apps/web/src/components/cross-links/__tests__/LinkedRecordChip.test.tsx

### Files Modified
- apps/web/src/data/cross-links.ts (added searchLinkableRecords, getRecentLinkedRecords)
- apps/web/src/components/grid/cells/ (Linked Record cell — Link Picker integration)
- apps/web/src/components/record-view/ (linked field — Link Picker integration)

### Schema Changes
- None

### New Domain Terms Introduced
- None
```

---

### FINAL — Open Pull Request

[GIT COMMAND]
```
git push origin build/3b-i-cross-linking
```

Open a PR titled **"[Step 3] Phase 3B-i — Cross-Linking Engine"**.

List all units completed and their deliverables in the PR description:
- **Unit 1:** Cross-Link Types, Validation Schemas & Registry — shared types, Zod schemas, FieldTypeRegistry registration
- **Unit 2:** Cross-Link Definition CRUD & Record Linking — data functions, server actions, test factory
- **Unit 3:** Query-Time Resolution & Permission Intersection — L0/L1/L2 resolution, permission filtering
- **Unit 4:** Display Value Cascade & Scalability Infrastructure — BullMQ cascade processor, backpressure, integrity check
- **Unit 5:** Link Picker UI — search, recent, inline create, LinkedRecordChip, grid/RecordView integration

[DECISION POINT]
```
If PR looks good:
  → Merge (squash). Delete branch. Proceed to Step 4.

If something is wrong:
  → Do NOT merge. Open Claude Code and paste fix instructions.
  → After fix, push and re-check the PR.
```

---

## STEP 4 — REVIEW (Reviewer Agent)

Covers What This Step Does, 4.1 — Generate the build diff, 4.2 — Run the Reviewer Agent.

### What This Step Does

An independent Claude session reviews the build against acceptance criteria and verifies that every unit's interface contract was fulfilled.

### 4.1 — Generate the build diff

[GIT COMMAND]
```
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-3b-i-diff.txt
```

### 4.2 — Run the Reviewer Agent

Open a NEW Claude.ai session. Upload these files:
- `docs/Playbooks/playbook-phase-3b-i.md` (playbook)
- `docs/subdivisions/3b-i-subdivision.md` (subdivision doc)
- `/tmp/phase-3b-i-diff.txt` (diff)
- `CLAUDE.md`
- `docs/reference/GLOSSARY.md`

[PASTE INTO CLAUDE]
```
You are the Reviewer Agent for EveryStack Phase 3B-i (Cross-Linking Engine).

Your task: review the attached diff against the playbook and subdivision doc's acceptance criteria.

For each of the 5 units, verify:
1. All acceptance criteria from the playbook are met
2. All [CONTRACT] exports exist at the specified paths
3. Tests exist and cover the specified scenarios
4. No code violates CLAUDE.md rules (no raw SQL, no switch on field types, no console.log, etc.)
5. Tenant isolation tests exist for all data functions
6. i18n compliance (no hardcoded English strings in UI components)

Output format:
- For each unit: PASS or FAIL with specific findings
- Overall verdict: PASS or FAIL
- If FAIL: list the specific items that need fixing

Rules:
- Be strict on [CONTRACT] items — missing exports are automatic FAIL
- Be strict on tenant isolation tests — missing tests are automatic FAIL
- Be lenient on implementation details — multiple valid approaches exist
- Do NOT suggest refactoring or improvements — only flag violations of acceptance criteria
```

[DECISION POINT]
```
If PASS:
  → Proceed to Step 5.

If FAIL:
  → Open Claude Code. Paste the specific fix instructions from the reviewer.
  → Fix, commit, push.
  → Re-run the reviewer with the updated diff.
  → Repeat until PASS.
```

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

Covers What This Step Does, 5.1 — Create the fix branch, 5.2 — Run the Docs Agent, 5.3 — Review and merge, 5.4 — Tag if milestone.

### What This Step Does

Bring docs back into alignment after the build. The Docs Agent reads MODIFICATIONS.md to know exactly what changed.

### 5.1 — Create the fix branch

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b fix/post-3b-i-docs-sync
```

### 5.2 — Run the Docs Agent

[PASTE INTO CLAUDE CODE]
```
You are the Docs Agent for EveryStack, running after Phase 3B-i (Cross-Linking Engine).

Read these files:
- MODIFICATIONS.md — session blocks for this sub-phase's builds (Sessions A through F)
- TASK-STATUS.md — all 5 units should show `passed-review`
- docs/reference/MANIFEST.md
- docs/reference/GLOSSARY.md
- docs/reference/cross-linking.md

Tasks:
1. Update MANIFEST.md line counts for any reference docs that changed during the build.
2. Update GLOSSARY.md if any new domain terms were introduced during the build that aren't already defined. Check MODIFICATIONS.md "New Domain Terms" sections.
3. Verify cross-references in cross-linking.md still point to correct line ranges in other docs.
4. Archive completed session blocks in MODIFICATIONS.md (move from active to archive section).
5. Update TASK-STATUS.md: change all 5 unit statuses from `passed-review` to `docs-synced`.
6. Update the "Completed" date for the 3B-i section in TASK-STATUS.md to today's date.

Forbidden:
- Do NOT modify application code
- Do NOT create new reference docs
- Only touch docs/ files, MODIFICATIONS.md, and TASK-STATUS.md
```

### 5.3 — Review and merge

[CHECKPOINT]
```
Review the diff:
  git diff main...fix/post-3b-i-docs-sync
Look for:
- MANIFEST line counts match actual file sizes
- No stale cross-references
- No new terms missing from GLOSSARY
- MODIFICATIONS.md sessions archived
- TASK-STATUS.md units show `docs-synced`
```

[GIT COMMAND]
```
git add -A
git commit -m "docs: post-Phase-3B-i docs sync (MANIFEST, GLOSSARY, cross-refs)"
git push origin fix/post-3b-i-docs-sync
```

Open a PR titled **"[Step 5] Phase 3B-i — Post-Build Docs Sync"**.
Review the diff. Merge to main. Delete the branch.

### 5.4 — Tag if milestone

[DECISION POINT]
```
Phase 3B-i (Cross-Linking Engine) is a significant milestone — this is the
core differentiator feature.

If you want to tag:
  → git tag -a v0.3.0-phase-3b-i -m "Phase 3B-i: Cross-Linking Engine complete"
  → git push origin v0.3.0-phase-3b-i

If you want to skip tagging:
  → Proceed to next sub-phase.
```

---

## NEXT SUB-PHASE

Phase 3B-i (Cross-Linking Engine) is complete. Next: **Phase 3B-ii (Schema Descriptor Service & Command Bar)**.

Return to Step 0 for Phase 3B-ii.
