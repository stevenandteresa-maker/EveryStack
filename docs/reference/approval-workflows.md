# EveryStack — Approval Workflows

> **⚠️ POST-MVP — This entire feature is post-MVP per GLOSSARY.md.** Approval workflows are explicitly excluded from MVP scope. This document defines the post-MVP design for reference and planning. Do not build or design for this unless explicitly told otherwise.

> **Reference doc (Tier 3).** Status field transition enforcement, approval rules, multi-step approval chains (max 3), auto-verify and manual attestation requirements, live-resolving approval panels, approval queue, enforcement layer, data model, UI surfaces, portal client approvals, notifications, real-time events.
> Cross-references: `data-model.md` (Status field type config, fields, records), `automations.md` (approval-triggered notifications, escalation automations, Wait for Event, template resolution), `permissions.md` (workspace roles govern transition permissions, field-level access unaffected by approval state), `app-designer.md` (portal Approval Block, portal client as approver, record scoping), `audit-log.md` (approval events extend audit trail, seven-source attribution), `tables-and-views.md` (Record View layout, approval section placement), `design-system.md` (progressive disclosure, ergonomic constraints), `mobile.md` (swipe-right-to-approve, notification tiers, actionable push), `my-office.md` (right panel Approvals tab, My Office approval card), `communications.md` (record thread system messages for approval events), `agency-features.md` (timesheet approval workflow — domain-specific pattern now subsumed by generic system), `inventory-capabilities.md` (Snapshot action #39 generalizes approval-time record hash)
> Cross-references (cont.): `workspace-map.md` (ApprovalWorkflowNode in topology graph — mode, transition count, pending approvals; approval_governs edges from workflow to table; side_effect_triggers edges from workflow to automations; approval real-time events trigger incremental map updates), `bulk-operations.md` (approval-gated Status fields with `transitions.enabled: true` excluded from bulk edit field picker — approval workflows exist for individual evaluation, bulk override is anti-pattern; bulk checklist item update is the legitimate accelerator — advancing records toward transitions by completing prerequisites; per-record auto-advance after bulk checklist update is a system consequence, not part of the bulk action)
>
> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Added post-MVP banner per glossary MVP scope summary. (2) Renamed "Expand Record" → "Record View" throughout (glossary term). (3) Renamed "Interface Designer" → "App Designer" (glossary naming discipline). (4) Renamed "Board view" → "Kanban view" (glossary view type name). (5) Fixed "interfaces" → "apps" in draft/live environment reference. (6) Updated cross-reference from "Expand Record layout" → "Record View layout" in header.
> Last updated: 2026-02-27 — Glossary reconciliation (see above). Prior: 2026-02-21 — Added `bulk-operations.md` cross-reference.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                            | Lines   | Covers                                                                                  |
| -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| Core Design Principles                             | 38–51   | Progressive complexity, status field as foundation, non-blocking UX                     |
| Status Field Operating Modes                       | 52–71   | 3 modes: simple select → gated transitions → approval chains                            |
| Status Field Config Enhancement                    | 72–144  | TransitionPrecondition (5 types), allowed transitions, auto-advance                     |
| Approval Rules                                     | 145–236 | 3 approver types, escalation, parallel/sequential approvals                             |
| Approval Requests (Runtime)                        | 237–329 | Request lifecycle, assignment, notification, expiration                                 |
| Approval Activity Log                              | 330–370 | Approval history, comments, audit trail                                                 |
| Enforcement Layer                                  | 371–453 | <50ms enforcement, middleware integration, bypass rules                                 |
| Real-Time Events                                   | 454–467 | Socket.io events for approval status changes                                            |
| Redis Key Patterns                                 | 468–479 | Caching for transition rules, pending approvals                                         |
| UI Surfaces                                        | 480–628 | 7 UI surfaces: field config, record view, sidebar badge, my tasks, grid, portal, mobile |
| Override Policy                                    | 629–648 | Admin override rules, emergency bypass, audit logging                                   |
| Relationship to Existing Domain-Specific Approvals | 649–664 | How this replaces ad-hoc approval patterns                                              |
| Audit Log Integration                              | 665–680 | Approval events in audit log, actor attribution                                         |
| Phase Implementation                               | 681–690 | Mode 1+2 MVP — Core UX, Mode 3 Post-MVP — Automations                                   |
| Key Architectural Decisions                        | 691–706 | ADR-style decisions with rationale                                                      |

---

## Core Design Principles

1. **An approval is a dependency, not a decoration.** When a record requires approval, the platform enforces it. The record cannot advance past the gate until the approval clears. This is not advisory — it is a hard constraint.

2. **If the system can verify it, the system verifies it.** Auto-verifiable preconditions (required fields populated, checklist complete, linked records in correct state, numeric thresholds met) are checked programmatically and displayed as already-checked items. The human approver focuses on judgment calls that require a human.

3. **Approvals gate transitions, not records.** A pending approval blocks a specific status transition. All other fields remain fully editable. Work continues unimpeded on everything except the gated transition.

4. **Simplicity is default, complexity is optional.** The Status field has three operating modes, each a superset of the previous. No user encounters approval complexity unless they configure it.

5. **Progressive disclosure governs all surfaces.** Level 1: simple select (default). Level 2: gated transitions with auto-advance. Level 3: multi-step approval chains with human sign-off.

---

## Status Field Operating Modes

The Status field (`field_type: 'status'`) operates in one of three modes, determined entirely by its configuration. There is no mode selector — behavior emerges from what the Manager configures.

### Mode 1: Simple Select (Default)

What exists today. Any user with write access can set the field to any option. `config.transitions.enabled` is `false` (or absent). Zero enforcement, zero friction. Most Status fields stay here permanently.

### Mode 2: Gated Transitions

Transitions are defined with preconditions — required fields, checklist completion, linked record states, formulas — but no human approver. When all preconditions on a transition are satisfied, the status **auto-advances** without anyone manually changing it. The system handles the ceremony.

Example: "This task can't move to Done until the checklist is complete." The moment the last checklist item is checked, the status transitions automatically. `actor_type: 'system'` in the audit log. Record thread system message: "Status changed to Done — all requirements met."

### Mode 3: Approval Chain

Everything in Mode 2, plus a human decision gate. Preconditions must be met **and** designated approvers must sign off. The submitter triggers the approval by changing status to the trigger value (e.g., "In Review"). The status cannot advance to the target value (e.g., "Approved") until all approval steps complete.

---

## Status Field Config Enhancement

The Status field's `config` JSONB in `fields` is extended with a `transitions` key. All existing Status field functionality is preserved — `transitions` is additive and optional.

```typescript
// Extension to Status field config JSONB (fields.config)
interface StatusFieldConfig {
  // Existing — unchanged
  options: { id: string; label: string; color: string; category: string }[];
  categories: string[]; // not_started | in_progress | done | closed
  done_values: string[];
  default_option_id: string;

  // NEW — transition enforcement
  transitions?: {
    enabled: boolean; // false = unrestricted (Mode 1, backward compatible)
    mode: 'open' | 'defined_only'; // open = all allowed unless explicitly restricted
    // defined_only = only explicitly defined transitions permitted
    rules: StatusTransitionRule[];
  };
}

interface StatusTransitionRule {
  id: string; // stable UUID
  from_status_id: string | '__any__'; // source status (or wildcard)
  to_status_id: string; // target status
  allowed_roles: ('owner' | 'admin' | 'manager' | 'team_member' | 'viewer')[];
  allowed_user_field_id?: string; // person field — "only the assigned user can transition"
  preconditions: TransitionPrecondition[];
  requires_approval: boolean; // if true, links to approval_rule
  approval_rule_id?: string; // FK to approval_rules.id
}

interface TransitionPrecondition {
  id: string;
  type:
    | 'required_fields'
    | 'linked_record_status'
    | 'checklist_complete'
    | 'formula'
    | 'approval_cleared';
  config: Record<string, unknown>; // type-specific (see Precondition Types)
  severity: 'hard_block' | 'warning';
  message_template: string; // user-facing: "All subtasks must be complete"
}
```

### Precondition Types

| Type                   | Config Shape                                                                           | Evaluation                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `required_fields`      | `{ field_ids: string[] }`                                                              | All listed fields have non-null, non-empty values on the record                                    |
| `checklist_complete`   | `{ field_id: string }`                                                                 | The checklist field has all items `completed: true`                                                |
| `linked_record_status` | `{ link_field_id: string, target_status_field_id: string, required_category: string }` | All linked records have their status in the required category                                      |
| `formula`              | `{ expression: string }`                                                               | Formula evaluates to truthy against current record values (uses formula engine parser + evaluator) |
| `approval_cleared`     | `{ approval_rule_id: string }`                                                         | An approved `approval_request` exists for this record matching the rule                            |

### Severity Levels

| Severity     | Behavior                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hard_block` | Transition is impossible. UI disables the option. API rejects the write. Only Admin/Owner force-clear with reason and audit trail can bypass. Default for `approval_cleared` preconditions.  |
| `warning`    | Transition is allowed after user confirmation. Dialog explains what's unsatisfied. Decision is logged. Default starting point for `required_fields` — Managers can escalate to `hard_block`. |

### Auto-Advance (Mode 2)

When a Status field has `transitions.enabled: true` and transition rules contain preconditions but `requires_approval: false`, the system evaluates preconditions **reactively** on related data changes:

1. A `record.updated` event fires (e.g., checklist item completed, linked record status changed).
2. The approval engine checks: does this record's current status have an outbound transition rule where all preconditions are now satisfied?
3. If yes, execute the status change with `actor_type: 'system'`.
4. Record thread system message: "Status changed to [target] — all requirements met."

This piggybacks on the same `record.updated` event listener that powers automation trigger detection and approval auto-verification. The listener only fires for records on tables with governed Status fields — zero overhead elsewhere.

---

## Approval Rules

### `approval_rules` Table

Config-overlay pattern, consistent with `pm_table_config`, `invoice_table_config`, and other EveryStack config tables. One rule per approval requirement, scoped to a table. Multiple rules per table allowed (different transitions can have different approval requirements).

| Column            | Type             | Purpose                                                                                                     |
| ----------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`              | UUID             | PK                                                                                                          |
| `tenant_id`       | UUID             | FK → tenants                                                                                                |
| `table_id`        | UUID             | FK → tables                                                                                                 |
| `name`            | VARCHAR          | User-facing label ("Design Review", "Budget Approval")                                                      |
| `description`     | TEXT (nullable)  | Optional explanation                                                                                        |
| `trigger_type`    | VARCHAR          | `'status_transition'` (v1 — extensible later)                                                               |
| `trigger_config`  | JSONB            | `{ status_field_id, from_status_id, to_status_id }`                                                         |
| `steps`           | JSONB            | Ordered array of ApprovalStepDefinition (max 3)                                                             |
| `on_approved`     | JSONB (nullable) | Side effects on full approval (e.g., status auto-transition)                                                |
| `on_rejected`     | JSONB (nullable) | Side effects on rejection (e.g., return to draft status)                                                    |
| `override_policy` | JSONB            | `{ allowed_roles: ['owner','admin'], require_reason: true }`                                                |
| `sla_config`      | JSONB (nullable) | `{ deadline_hours, escalation_user_field_id, reminder_hours[] }`                                            |
| `enabled`         | BOOLEAN          | Active/inactive toggle                                                                                      |
| `publish_state`   | VARCHAR          | `'live'` or `'draft'` — same draft/live authoring workflow as automations (status) and apps (publish_state) |
| `created_by`      | UUID             |                                                                                                             |
| `created_at`      | TIMESTAMPTZ      |                                                                                                             |
| `updated_at`      | TIMESTAMPTZ      |                                                                                                             |

**Why `steps` is JSONB, not a separate table:** Same reasoning as `automations.steps`. The step list is always read and written as a unit, always small (max 3 steps × max ~10 requirements each), and there is no query pattern that needs "find all step 2s across all approval rules." JSONB keeps it self-contained.

### ApprovalStepDefinition (within `steps` JSONB array)

```typescript
interface ApprovalStepDefinition {
  id: string; // stable UUID per step
  position: number; // 1, 2, or 3 — execution order
  name: string; // "Team Lead Review", "Finance Sign-off"

  // Who approves
  approver_type: 'role' | 'user_field' | 'specific_user';
  approver_role?: string; // when type = 'role': any workspace role
  approver_field_id?: string; // when type = 'user_field': FK to a People field on the table
  approver_user_id?: string; // when type = 'specific_user': FK to users

  // What they verify
  requirements: ApprovalRequirement[];

  // Step-level SLA override (inherits from rule-level sla_config if absent)
  deadline_hours?: number;
}

interface ApprovalRequirement {
  id: string;
  type: 'auto_verify' | 'manual_attestation';

  // For auto_verify — system evaluates programmatically
  auto_config?: {
    check_type:
      | 'required_fields'
      | 'linked_record_status'
      | 'checklist_complete'
      | 'numeric_threshold'
      | 'formula';
    config: Record<string, unknown>; // { field_ids: [...] }, { link_field_id, ... }, etc.
  };

  // For manual_attestation — approver checks manually
  label?: string; // "Reviewed design for brand consistency"

  // User-facing description
  description: string;
}
```

### On Completion Side Effects

```typescript
interface ApprovalOnApproved {
  auto_transition?: {
    status_field_id: string;
    target_status_id: string; // move status to this value
  };
  notify_submitter?: boolean; // default: true
  run_automation_id?: string; // optionally trigger an automation
}

interface ApprovalOnRejected {
  auto_transition?: {
    status_field_id: string;
    target_status_id: string; // return to draft/revision status
  };
  require_comment: boolean; // default: true — rejections must explain why
  notify_submitter?: boolean; // default: true
}
```

---

## Approval Requests (Runtime)

### `approval_requests` Table

One row per approval request per record. System-managed — not a user field. This is the runtime instance of an approval rule applied to a specific record.

| Column                 | Type                   | Purpose                                                                        |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `id`                   | UUID                   | PK                                                                             |
| `tenant_id`            | UUID                   | FK → tenants                                                                   |
| `approval_rule_id`     | UUID                   | FK → approval_rules                                                            |
| `record_id`            | UUID                   | FK → records                                                                   |
| `table_id`             | UUID                   | FK → tables (denormalized for query performance)                               |
| `status`               | VARCHAR                | `'pending'` \| `'approved'` \| `'rejected'` \| `'withdrawn'` \| `'overridden'` |
| `current_step`         | INTEGER (nullable)     | Active step (1-indexed). Null when complete.                                   |
| `submitted_by`         | UUID                   | FK → users or portal_clients                                                   |
| `submitted_by_type`    | VARCHAR                | `'user'` \| `'portal_client'` \| `'automation'`                                |
| `submitted_at`         | TIMESTAMPTZ            |                                                                                |
| `submitted_note`       | TEXT (nullable)        | Optional context from submitter                                                |
| `completed_at`         | TIMESTAMPTZ (nullable) |                                                                                |
| `completed_status`     | VARCHAR (nullable)     | Final outcome: `'approved'` \| `'rejected'` \| `'overridden'`                  |
| `override_by`          | UUID (nullable)        | FK → users (Admin/Owner who force-cleared)                                     |
| `override_reason`      | TEXT (nullable)        | Required when overridden                                                       |
| `record_snapshot_hash` | VARCHAR (nullable)     | SHA-256 of record state at completion                                          |
| `metadata`             | JSONB                  | Extensible (portal context, automation context)                                |
| `created_at`           | TIMESTAMPTZ            |                                                                                |
| `updated_at`           | TIMESTAMPTZ            |                                                                                |

**Indexes:**

- `(tenant_id, record_id, status)` — "does this record have a pending approval?" Hot path for precondition enforcement.
- `(tenant_id, table_id, status, submitted_at)` — approval queue queries per table.
- `(tenant_id, status, current_step)` — dashboard queries.

### `approval_step_instances` Table

Per-step state within an approval request. Separate table (not JSONB on `approval_requests`) because step state changes independently and frequently during the approval process, and direct queries like "show me everything waiting for my approval across all tables" require indexed access.

| Column                 | Type                   | Purpose                                                                  |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------ |
| `id`                   | UUID                   | PK                                                                       |
| `tenant_id`            | UUID                   | FK → tenants                                                             |
| `approval_request_id`  | UUID                   | FK → approval_requests                                                   |
| `step_definition_id`   | VARCHAR                | Matches ApprovalStepDefinition.id from the rule's steps JSONB            |
| `position`             | INTEGER                | 1, 2, or 3                                                               |
| `status`               | VARCHAR                | `'waiting'` \| `'active'` \| `'approved'` \| `'rejected'` \| `'skipped'` |
| `assigned_to`          | UUID (nullable)        | Resolved approver user ID (resolved at activation time)                  |
| `assigned_to_type`     | VARCHAR                | `'user'` \| `'portal_client'`                                            |
| `activated_at`         | TIMESTAMPTZ (nullable) | When this step became actionable                                         |
| `deadline_at`          | TIMESTAMPTZ (nullable) | SLA deadline                                                             |
| `decided_at`           | TIMESTAMPTZ (nullable) |                                                                          |
| `decision`             | VARCHAR (nullable)     | `'approved'` \| `'rejected'` \| `'revision_requested'`                   |
| `decision_comment`     | TEXT (nullable)        |                                                                          |
| `requirements_state`   | JSONB                  | Live state of each requirement (see below)                               |
| `record_snapshot_hash` | VARCHAR (nullable)     | SHA-256 at time of decision                                              |
| `created_at`           | TIMESTAMPTZ            |                                                                          |
| `updated_at`           | TIMESTAMPTZ            |                                                                          |

**Indexes:**

- `(assigned_to, status)` — "what's waiting for me to approve?" Most important query for the approver experience.
- `(approval_request_id, position)` — step chain traversal.
- `(tenant_id, deadline_at)` WHERE `status = 'active'` — SLA monitoring cron job.

### Requirements State JSONB

The live-resolving checklist state. Auto-verify items update in real time as related data changes. Manual attestation items update when the approver checks them.

```typescript
interface RequirementState {
  requirement_id: string; // matches ApprovalRequirement.id from rule
  type: 'auto_verify' | 'manual_attestation';
  satisfied: boolean;

  // For auto_verify — system populates
  auto_result?: {
    checked_at: string; // ISO timestamp
    passed: boolean;
    details: string; // "All 5 required fields populated" or "Description is empty"
    canonical_data?: Record<string, unknown>; // snapshot of checked values at evaluation time
  };

  // For manual_attestation — approver populates
  attestation?: {
    checked: boolean;
    checked_by: string; // user ID
    checked_at: string; // ISO timestamp
  };
}
```

**Why JSONB on the step:** Requirements state is always read/written with its parent step, changes frequently during approval, and is small (max ~10 requirements per step). Separate table would add a join to every approval panel render. JSONB updates atomically with the step row.

---

## Approval Activity Log

### `approval_activity` Table

Append-only event log for approval-specific history. Separate from the general `audit_log` because approval activity needs its own query patterns, richer structure, and no retention pruning. The general audit log still captures status field changes.

| Column                | Type            | Purpose                                                       |
| --------------------- | --------------- | ------------------------------------------------------------- |
| `id`                  | UUID            | PK                                                            |
| `tenant_id`           | UUID            | FK → tenants                                                  |
| `approval_request_id` | UUID            | FK → approval_requests                                        |
| `step_instance_id`    | UUID (nullable) | FK → approval_step_instances (null for request-level events)  |
| `event_type`          | VARCHAR         | See event catalog below                                       |
| `actor_id`            | UUID            |                                                               |
| `actor_type`          | VARCHAR         | `'user'` \| `'portal_client'` \| `'automation'` \| `'system'` |
| `details`             | JSONB           | Event-specific data                                           |
| `created_at`          | TIMESTAMPTZ     |                                                               |

**Event catalog:**

| Event Type                 | Details JSONB                                 | When                                    |
| -------------------------- | --------------------------------------------- | --------------------------------------- |
| `submitted`                | `{ from_status, to_status, note }`            | Record submitted for approval           |
| `step_activated`           | `{ step_position, assigned_to, deadline_at }` | Step becomes active, approver notified  |
| `requirement_auto_checked` | `{ requirement_id, passed, details }`         | System re-evaluated an auto-verify item |
| `requirement_attested`     | `{ requirement_id, label }`                   | Approver checked a manual attestation   |
| `reminder_sent`            | `{ reminder_number, channel }`                | SLA reminder dispatched                 |
| `escalated`                | `{ escalated_to, reason }`                    | SLA breach triggered escalation         |
| `step_approved`            | `{ comment, snapshot_hash }`                  | Approver approved this step             |
| `step_rejected`            | `{ comment }`                                 | Approver rejected this step             |
| `revision_requested`       | `{ comment, fields_to_revise }`               | Approver sent back for revision         |
| `withdrawn`                | `{ reason }`                                  | Submitter withdrew the request          |
| `overridden`               | `{ reason, override_by }`                     | Admin/Owner force-cleared               |
| `resubmitted`              | `{ previous_request_id }`                     | Resubmitted after rejection             |

**Indexes:** `(approval_request_id, created_at)` — chronological timeline per request. `(tenant_id, actor_id, created_at)` — "my approval activity."

**Retention:** Workspace lifetime. No pruning. Approval history is compliance-relevant.

---

## Enforcement Layer

The enforcement layer intercepts Status field writes and evaluates transition rules before allowing the change. This is the foundation everything else depends on.

### Server Action Flow

When a field update targets a Status field:

**Step 1: Detect governed transition.** Check `fields.config.transitions.enabled`. If `false`, pass through — zero performance cost for ungoverned fields. If `true`, load current status value (from) and requested value (to). Look up the matching `StatusTransitionRule`. If `mode` is `defined_only` and no rule exists for this from→to pair, reject: "This status change is not allowed."

**Step 2: Check role and user permissions.** Resolve the acting user's workspace role against the rule's `allowed_roles`. If `allowed_user_field_id` is set, resolve the field value on the record and check whether the acting user matches. Reject if unauthorized: "Only Managers can move records to this status."

**Step 3: Evaluate all preconditions.** Iterate through the rule's `preconditions` array. All preconditions are evaluated — not short-circuited — so the user sees everything that's blocking in a single response.

| Precondition Type      | Evaluation                                                                        |
| ---------------------- | --------------------------------------------------------------------------------- |
| `required_fields`      | Check each listed field on the record for non-null, non-empty value               |
| `checklist_complete`   | Load checklist field, verify all items `completed: true`                          |
| `linked_record_status` | Query linked records via cross-link, check status categories                      |
| `formula`              | Evaluate expression via formula engine against current record values              |
| `approval_cleared`     | Query `approval_requests` for record where rule matches and `status = 'approved'` |

**Step 4: Collect results and decide.**

```typescript
interface PreconditionResult {
  precondition_id: string;
  type: string;
  severity: 'hard_block' | 'warning';
  passed: boolean;
  message: string;
  details?: {
    missing_fields?: { id: string; name: string }[];
    incomplete_records?: { id: string; title: string }[];
    checklist_progress?: { completed: number; total: number };
    approval_status?: { step: number; total: number; assignee_name: string };
  };
}
```

- **Any `hard_block` failed:** Write rejected. HTTP 422 with `precondition_failed` error code. All results (passed and failed) returned so the client renders the full picture.
- **Only `warning` failed:** Client shows warnings with confirmation dialog. Second request with `confirm_warnings: true` and a one-time confirmation token (Redis, 60s TTL) proceeds with the write.
- **All passed:** Write proceeds normally.

**Step 5: Create approval request on trigger.** If the new status matches an approval rule's `trigger_config.from_status_id` → `to_status_id`, the system creates an `approval_request` row and the first `approval_step_instance`. Publishes `approval.requested` via real-time. Notifies the first step's assigned approver.

**Step 6: No blocking of other fields.** The enforcement layer only intercepts writes to the governed Status field. All other field writes pass through unchanged regardless of approval state.

### Approval Engine Status Write

When the approval engine itself writes a status change (after all approval steps are completed, or on Admin override), it bypasses precondition evaluation via an internal system-level flag. This flag is only available to the approval engine's internal code path — not to user-configured automations. `actor_type: 'system'` in the audit log.

### Automation and Sync Behavior

**Automations:** Automation actions that update a governed Status field go through the same enforcement layer. If preconditions aren't met, the automation step fails per its error strategy (stop/skip/retry). Automations do not bypass business rules.

**Sync engine:** Inbound sync status changes that violate preconditions create a sync conflict (reuses existing conflict resolution UI from `sync-engine.md`) rather than silently rejecting or accepting.

### Auto-Verify Runtime Evaluation

When a `record.updated` event fires for a record that has an active approval request:

1. Look up active `approval_step_instances` for this record where `status = 'active'`.
2. For each step, iterate over `requirements_state` entries where `type = 'auto_verify'`.
3. Re-evaluate each auto-verify check against the current record state.
4. If the result changed, update `requirements_state` JSONB on the step instance.
5. Publish `approval.requirement_updated` via real-time service.

This piggybacks on the same `record.updated` event listener that powers automation trigger detection. The listener only evaluates records with active approvals — a quick indexed lookup on `approval_requests(record_id, status)`.

### Performance Characteristics

| Operation                                | Added Latency | Notes                                                 |
| ---------------------------------------- | ------------- | ----------------------------------------------------- |
| Status write on ungoverned field         | 0ms           | `transitions.enabled` check is a config property read |
| Status write on governed field (pass)    | <50ms         | Precondition evaluation against record data           |
| Status write with `linked_record_status` | <100ms        | Cross-link query is the most expensive check          |
| Auto-verify re-evaluation                | <30ms         | Triggered on related record change, indexed lookup    |

Redis cache `approval:record:{recordId}` (60s TTL) prevents repeated Postgres lookups for the same blocked transition.

---

## Real-Time Events

| Event                          | Channel             | Payload                                                    | Subscribers                                                           |
| ------------------------------ | ------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `approval.requested`           | `tenant:{tenantId}` | `{ requestId, recordId, tableId, submittedBy, ruleName }`  | Approver notification, queue refresh                                  |
| `approval.step_activated`      | `tenant:{tenantId}` | `{ requestId, stepId, assignedTo, stepName }`              | Next approver notification                                            |
| `approval.requirement_updated` | `record:{recordId}` | `{ requestId, stepId, requirementId, satisfied, details }` | Live-resolving checklist on approval panel                            |
| `approval.decided`             | `tenant:{tenantId}` | `{ requestId, recordId, decision, decidedBy }`             | Submitter notification, status field gate refresh, cache invalidation |
| `approval.overridden`          | `tenant:{tenantId}` | `{ requestId, recordId, overrideBy, reason }`              | Audit notification to rule owner                                      |

The `approval.requirement_updated` event on the `record:{recordId}` channel powers the live-resolving UX — when someone fills in a required field while the approver has the approval panel open, the auto-verify item flips to green in real time without page refresh.

---

## Redis Key Patterns

| Prefix                                          | Usage                                                               | TTL           | Eviction      |
| ----------------------------------------------- | ------------------------------------------------------------------- | ------------- | ------------- |
| `cache:t:{tenantId}:approval:record:{recordId}` | Active approval state for a record (pending request + current step) | **Yes** (60s) | LRU evictable |
| `cache:t:{tenantId}:approval:queue:{tableId}`   | Approval queue for a table (pending count, recent items)            | **Yes** (30s) | LRU evictable |
| `cache:t:{tenantId}:approval:myqueue:{userId}`  | "My pending approvals" count for notification badge                 | **Yes** (30s) | LRU evictable |
| `rl:approval:reminder:{requestId}:{stepId}`     | Rate limiter for reminder nudges (prevent spam)                     | **Yes** (1h)  | Self-expiring |
| `approval:confirm:{token}`                      | One-time warning confirmation token                                 | **Yes** (60s) | Self-expiring |

---

## UI Surfaces

### Surface 1: Status Field Blocked State

When a user clicks a governed Status field, all options render in the dropdown. Options blocked by preconditions are **visible but dimmed** with a small lock icon. Hiding options would be confusing — the user needs to know the option exists but is gated.

Clicking a dimmed option transitions the dropdown into a **precondition panel** — an expansion showing the full precondition checklist:

- **Green check:** Satisfied preconditions.
- **Red X:** Unsatisfied data conditions with actionable detail (which fields are empty, which subtasks are incomplete — with direct links to the relevant records or fields).
- **Lock icon:** Pending approval with status context (step N of M, assigned to whom, how long ago).
- **"Send Reminder" button:** Appears only for pending approvals. Dispatches a nudge notification to the assigned approver. Rate-limited by `rl:approval:reminder` Redis key.

For `warning`-severity preconditions, the option is amber instead of dimmed, and a "Proceed Anyway" button appears with a confirmation step.

This precondition panel is a shared component attached to the Status field renderer — identical in grid view, Record View, Kanban view, and everywhere else the status field appears.

**Responsive:** On mobile, the precondition panel renders as a bottom sheet. "Send Reminder" becomes a full-width button in the thumb zone.

### Surface 2: Submission Experience

When a status change triggers an approval rule, the user sees a **submission confirmation panel** before the approval request is created:

- Auto-verify preconditions displayed with current state (green checks or red X). Submit button disabled if any auto-verify items fail.
- Who will be notified (step 1 approver, step 2 approver) — the submitter knows what they're triggering.
- Optional note field for context ("Client meeting Thursday, hoping for sign-off before then"). Stored in `approval_requests.submitted_note`.
- Cancel / Submit buttons. Submit creates the approval request and changes the status to the trigger value.

Post-submit: subtle success indicator — "Submitted for Design Review · Sarah notified." Disappears after 3 seconds.

**Responsive:** On mobile, submission confirmation renders as a bottom sheet. Submit button in the thumb zone.

### Surface 3: Approval Panel on Record

A dedicated section in the **Record View main panel**, positioned after regular fields and before inline sub-tables. `bgElevated` background with subtle `success` left border. Collapse/expand toggle — expanded when active, collapsed when complete.

**Active approval (approver's view):**

Section header: rule name, step progress (Step 1 of 2), submitted by whom and when.

Requirements as a **mixed checklist:**

- **Auto-verified items:** Green check or red X with evaluated value in parentheses (e.g., "Budget ≤ $5,000 ($4,200)"). Label `(auto)` in `textSecondary`. Update in real time via `approval.requirement_updated` events. Not interactive — the system handles these.
- **Manual attestation items:** Interactive checkboxes. Approver checks as they complete review. Each check persists immediately to `requirements_state` JSONB (optimistic client update, server action write).

Submitter's note displayed if present.

Comment field for the approver's decision rationale.

Three action buttons:

- **Request Revision:** Returns record to submitter. Status moves to configured revision state.
- **Reject:** Requires a comment (comment field becomes required with red border if clicked without text). Ends the approval.
- **Approve:** Disabled (dimmed, `textSecondary`, no pointer cursor) until all requirements — auto and manual — are satisfied. When the last item clears, the button transitions to active (`success`) with a subtle pulse animation.

**Completed approval (everyone's view):**

Collapsed to single-line summary by default: "✓ Design Review — Approved Feb 18 · 2 steps." One click to expand the full timeline: each step with approver name, decision, attestation items checked, comment, and timestamp. Record snapshot hash shown in `textSecondary` 11px — compliance-relevant but not visually dominant.

**Overridden approval:**

Amber warning icon: "⚠ Design Review — Overridden by James (Admin) · Feb 18." Override reason displayed. Cannot be hidden or minimized.

**Non-approver's view during active approval:**

Read-only: approval status, active step, assigned approver, time pending. "Send Reminder" available if past SLA deadline. No attestation checkboxes or action buttons.

**Responsive:** On tablet, same layout, narrower. On mobile, approval section is a full-width card in single-column record layout. Action buttons stack vertically in thumb zone. Swipe-right-to-approve on the approval card triggers the Approve action (only when all requirements are satisfied) — consistent with the existing "swipe right = primary action (complete, approve)" pattern in `design-system.md`.

### Surface 4: Approval Queue (Right Panel Tab)

New tab in the right panel tab architecture:

| Tab       | Icon                    | When Available                  | Phase                  |
| --------- | ----------------------- | ------------------------------- | ---------------------- |
| Approvals | ✓ (checkmark in circle) | When user has pending approvals | Post-MVP — Automations |

Tab only appears when the user has ≥1 active approval assigned to them. No empty tab for non-approvers.

**360px right panel layout:** Sorted by urgency — overdue first (past SLA deadline, `accent` background on card), then by age (oldest pending first). Each card shows: record title, rule name, source table, time since submission, requirements readiness summary.

Readiness summary is key: "All requirements ready ✓" in `success` color tells the approver they can act immediately. "2 of 4 requirements ready" in `textSecondary` tells them something is still pending.

Clicking a card opens Record View scrolled to the approval section.

**Badge:** Numeric badge on tab icon (teal background, white text, 12px) with pending approval count. Same count on the 🔔 notification bell in header when panel is closed.

**My Office integration:** New card in the My Office home page grid — "Pending Approvals." Shows same queue content. For users with approvals across multiple workspaces, grouped by workspace.

**Mobile:** Accessible via bottom navigation "More" → "My Approvals" or from notification center.

### Surface 5: Notifications

| Event                                    | Tier                | Channels     | Content                                                          |
| ---------------------------------------- | ------------------- | ------------ | ---------------------------------------------------------------- |
| Approval requested (you're the approver) | **Action Required** | Push + email | "[Record] needs your approval: [Rule Name]"                      |
| Step activated (you're next in chain)    | **Action Required** | Push + email | "Your turn: [Record] · [Rule Name] Step 2"                       |
| Submission approved                      | **Informational**   | Push         | "[Record] approved by [Approver]"                                |
| Submission rejected                      | **Action Required** | Push + email | "[Record] rejected by [Approver]: [comment preview]"             |
| Revision requested                       | **Action Required** | Push + email | "[Approver] requested changes on [Record]"                       |
| SLA reminder                             | **Informational**   | Push         | "Reminder: [Record] awaiting your approval (2 days)"             |
| SLA escalation                           | **Action Required** | Push + email | "[Record] approval overdue · Escalated from [Original Approver]" |
| Approval overridden                      | **Informational**   | Push         | "[Admin] overrode approval on [Record]: [reason]"                |
| Manual nudge from submitter              | **Informational**   | Push         | "[Submitter] is waiting on your approval for [Record]"           |

**Actionable push notifications:** "Approval requested" and "Step activated" include action buttons on mobile push. "View" opens the record. "Review & Approve" deep-links to the record scrolled to the approval section (only shown when all auto-verify requirements are already satisfied).

**Desktop in-app notifications:** Approval notifications render as rich cards in the bell dropdown with record title, rule name, readiness, and "Open" button. Teal left border distinguishes from regular notifications.

**Email:** Includes requirements checklist state as a table, submitter's note, and "Review in EveryStack" button. Approve/reject buttons are intentionally NOT in the email — decisions must happen in-platform where live requirements state is current and the audit trail is captured.

**Record thread integration:** Approval events appear as system messages in the record's chat thread: "Alex submitted for Design Review · Sarah notified" and "Sarah approved Design Review · Step 1 of 2 complete" with the approver's comment inline if present. Consistent with the existing pattern where field changes appear as system messages in record threads. See `mobile.md` > Record Thread Behavior.

### Surface 6: Configuration UI

**Level 1 — Status field config (inline):**

When a Manager edits a Status field and enables transitions, each transition rule gets an "Add requirement" dropdown. One option is "Require approval." Selecting it opens an inline mini-form: approval name, approver (pick a role or person field), optional checklist items, "Advanced: multi-step, SLA →" link to the full editor. Covers the 80% case in 30 seconds without leaving the field editor.

**Level 2 — Table Settings → Approvals tab:**

Dedicated tab in table settings alongside Fields, Views, Permissions, Automations. Lists all approval rules on the table: name, trigger transition, step count, approver summary, SLA, active/draft status.

Clicking Edit opens the **rule editor** — a vertical stepper showing the approval chain:

- Trigger: which status transition initiates this approval.
- Steps 1–3: each with approver type/assignment, deadline, and requirements list. Requirements list distinguishes auto-verify (bolt icon, configured by pointing at fields/conditions) from manual attestation (person icon, free-text labels). Drag to reorder.
- On Completion: what happens when approved (auto-transition, notifications) and when rejected (return to status, require comment).
- Override Policy: who can force-clear, whether reason is required.
- Escalation: SLA breach notification target, reminder schedule.

Save Draft / Save & Activate buttons. Follows the existing draft/live `publish_state` pattern.

**Level 3 — AI-assisted (Command Bar):**

Natural language: "/approval set up a two-step review for invoices over $5,000 where finance approves first then the CFO signs off." AI generates the approval rule configuration, presents in the Level 2 editor for review. Same pattern as AI-generated automations. 8 credits.

### Surface 7: Portal Approval Experience

For client-facing approvals, the existing portal **Approval Block** connects to the approval engine. The App Designer wires an Approval Block to a specific approval rule. When a portal client views a record with an active approval where they are the assigned approver (resolved via portal record scoping identity), the block renders:

- Auto-verified items already checked.
- Manual attestation items for the client to confirm.
- Comment field.
- Approve / Request Revision buttons.

Portal approval block respects portal theming (Manager-configured colors, fonts, radius from App Designer). Adapts to the portal's visual language rather than showing the internal design system.

On portal client approval: `approval_step_instances` updated with `actor_type: 'portal_client'`. Internal team sees "Approved by Acme Corp (portal)" in the record's approval timeline.

---

## Override Policy

Approvals enforce hard gates, but authorized users can force-clear when business reality demands it. The override mechanism is deliberately inconvenient — it should be rare.

| Role                 | Can Override                                                                 | Requirements                                               |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Owner                | Always                                                                       | Reason required (free text, stored in `approval_activity`) |
| Admin                | Always                                                                       | Reason required                                            |
| Manager              | Only if explicitly added to `override_policy.allowed_roles` (not by default) | Reason required                                            |
| Team Member / Viewer | Never                                                                        | —                                                          |

Override actions:

1. Admin/Owner opens the approval panel on the record.
2. Clicks "Override" (red ghost button, not prominent).
3. Required: free-text reason explaining why the approval is being bypassed.
4. Confirmation dialog: "This will skip the approval process and advance the record. This action is logged and cannot be undone."
5. On confirm: `approval_requests.status` → `'overridden'`, `override_by` and `override_reason` populated. Status field advances to the target value. `approval_activity` event logged with `event_type: 'overridden'`. `approval.overridden` real-time event published. Notification sent to the rule creator.

---

## Relationship to Existing Domain-Specific Approvals

The generic approval system subsumes several existing domain-specific approval patterns:

| Domain Pattern                               | Current Spec                                                                                  | Migration Path                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timesheet approval (agency-features.md)      | Hardcoded Draft → Submit → Approve/Reject, "any Manager+" as approver, no multi-level routing | Expressible as a 1-step approval rule on the time entries status field. `approver_type: 'role'`, `approver_role: 'manager'`. Bulk approve via approval queue. |
| Expense approval (accounting-integration.md) | Logging → submission → approval → push to accounting                                          | 1-2 step approval rule with threshold-based routing. On-approved side effect: trigger accounting push automation.                                             |
| Asset status (agency-features.md)            | Draft → Approved status on documents table                                                    | 1-step approval rule. `approver_type: 'user_field'` pointing at the author/owner field.                                                                       |
| Portal approval block (app-designer.md)      | Standalone approve/revision widget                                                            | Now connected to the approval engine. Portal client can be resolved as approver for client-facing approval steps.                                             |
| Agent approval gates (agent-architecture.md) | Risk-tiered action approval for AI agents                                                     | Remains separate. Agent approvals are about action permissions (can the agent do X?), not record state transitions. Different system, different UX.           |

The generic system does not replace agent approval gates — those operate at a fundamentally different level (action permission vs. record lifecycle).

---

## Audit Log Integration

Approval events extend the existing audit log with new action types:

| Action                  | `actor_type`                              | When                                      |
| ----------------------- | ----------------------------------------- | ----------------------------------------- |
| `approval.submitted`    | `user` \| `portal_client` \| `automation` | Approval request created                  |
| `approval.step_decided` | `user` \| `portal_client`                 | Approver made a decision                  |
| `approval.completed`    | `system`                                  | All steps done, status auto-transitioning |
| `approval.overridden`   | `user`                                    | Admin/Owner force-cleared                 |
| `approval.withdrawn`    | `user`                                    | Submitter withdrew request                |

These supplement the general `record.updated` audit entries that capture the actual status field value changes. The approval audit entries capture the _process_ context around those changes.

---

## Phase Implementation

| Phase                               | Approval Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Core UX**                   | Status field `transitions` config enhancement (modes 1 + 2 only). Transition rules with `allowed_roles`, `allowed_user_field_id`, and preconditions (required_fields, checklist_complete, linked_record_status, formula). Auto-advance behavior. Precondition panel in Status field dropdown. No approval system yet — pure transition governance.                                                                                                                                                                                                                                                                        |
| **Post-MVP — Automations**          | Full approval system. `approval_rules`, `approval_requests`, `approval_step_instances`, `approval_activity` tables. Mode 3 (approval chains, max 3 steps). Enforcement layer `approval_cleared` precondition. Auto-verify + manual attestation requirements with live-resolving state. Approval panel on Record View. Approval queue (right panel tab + My Office card). Notifications (all tiers). SLA monitoring + escalation. Override policy. Configuration UI (inline Level 1 + table Approvals tab Level 2). Portal approval block integration. AI-assisted rule creation (Level 3). Record thread system messages. |
| **Post-MVP — Verticals & Advanced** | Timesheet approval migration to generic system. Expense approval migration. Asset status approval migration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

---

## Key Architectural Decisions

| Decision                                   | Resolution                                                                               | Rationale                                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status field operating modes               | 3 modes (simple select → gated transitions → approval chain), no mode selector           | Progressive disclosure. Complexity is optional. Behavior emerges from configuration.                                                                                   |
| Approval state storage                     | System-managed tables (`approval_requests`, `approval_step_instances`), not a field type | Approval is metadata about the record's lifecycle, not a data value. Similar to record threads and audit log — platform capability that attaches to any table.         |
| Max approval steps                         | 3 sequential                                                                             | Covers 95%+ of SMB patterns. Beyond 3 starts feeling enterprise and adds builder complexity that doesn't serve the 2-50 employee market.                               |
| Precondition severity                      | Hard block (default for approvals) + Warning (with confirmation)                         | Enforcement is the default posture. Warnings available for softer requirements during process adoption.                                                                |
| Override mechanism                         | Admin/Owner only, reason required, loudly logged                                         | Business reality requires escape hatches. Override is deliberately inconvenient and fully audited.                                                                     |
| Auto-advance (Mode 2)                      | System writes status change when all preconditions are satisfied                         | Removes human ceremony where no human judgment is needed. The system handles the bookkeeping.                                                                          |
| Approval rule steps as JSONB               | Same reasoning as `automations.steps`                                                    | Always read/written as unit, small data (max 3 steps), no cross-rule step queries needed.                                                                              |
| Separate `approval_step_instances` table   | Not JSONB on `approval_requests`                                                         | Steps change independently and frequently. Direct queries needed ("what's waiting for me across all tables").                                                          |
| Portal client as approver                  | Resolved via portal record scoping identity                                              | Enables client sign-off workflows (deliverable approval, contract review) through existing portal infrastructure.                                                      |
| Agent approval gates remain separate       | Different system from record approval workflows                                          | Agent approvals concern action permissions (risk-tiered). Record approvals concern lifecycle state transitions. Different problem, different data model, different UX. |
| Enforcement applies to automations         | Automations cannot bypass transition rules                                               | Business rules are universal. Automation steps fail per error strategy if preconditions unmet.                                                                         |
| Sync conflicts for precondition violations | Inbound sync creates conflict rather than silent reject/accept                           | Manager visibility and control via existing conflict resolution UI.                                                                                                    |
