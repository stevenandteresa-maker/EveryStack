# Subdivision Strategy

How to decompose a sub-phase into tightly scoped build units. This
document is to the Planner Agent what PLAYBOOK-GENERATION-STRATEGY.md
is to playbook generation — it defines the principles, heuristics, and
constraints that govern decomposition.

The Planner Agent reads this document before producing any subdivision
doc. The Build Agent never reads this document — it consumes the
subdivision doc output, not the strategy itself.

---

## Core Principle

**Quality is in the planning, not the execution.** Better input context
beats better reasoning. If a build produces poor results, the fix is
more thorough subdivision and tighter context curation — not smarter
build prompts. The Planner's ability to identify natural seams, curate
minimal-but-sufficient context, and define clear interface contracts
between units is what makes everything downstream work.

---

## What a Subdivision Doc Is

A subdivision doc sits between a sub-phase and its playbook in the
document hierarchy:

```
Phase Division → Sub-phase → Subdivision Doc → Playbook → Build Prompts
```

It breaks a sub-phase into **units** — the smallest pieces of work that
can be built, reviewed, and verified independently. Each unit carries
enough context for a Build Agent to execute without loading the full
sub-phase spec, and enough contract definition for a Reviewer Agent to
verify without understanding the broader architecture.

A subdivision doc is NOT:
- A playbook (it doesn't contain prompts or acceptance criteria)
- A spec (it doesn't define features — those live in reference docs)
- A task list (it doesn't track status — that's TASK-STATUS.md)

It IS:
- A decomposition plan with explicit seams and contracts
- A context budget for each unit
- A dependency map between units within the sub-phase

---

## Finding Natural Seams

Seams are the boundaries where one unit ends and another begins. Good
seams produce units that are internally cohesive and externally
decoupled. Bad seams produce units that constantly reach into each
other's territory.

### Seam Heuristics (in priority order)

#### 1. Data Layer → Service Layer → UI Layer

The most reliable seam in EveryStack's architecture. Almost every
sub-phase has work at all three layers, and they naturally sequence:

- **Data unit:** Schema definitions (Drizzle), migrations, RLS policies,
  test factories. Produces: table types, column types, migration files.
- **Service unit:** Data access functions (`getDbForTenant` queries),
  server actions, BullMQ job processors. Produces: exported function
  signatures, return types.
- **UI unit:** React components, views, navigation. Consumes: the
  function signatures and types from the service unit.

This seam works because each layer has a clear output contract (types
from schema, functions from services, components from UI) and each
subsequent layer consumes the prior layer's exports.

#### 2. CRUD Boundaries

Within a single layer, separate Create/Read/Update/Delete into distinct
units when the sub-phase touches multiple operations on the same entity.
This is especially useful for service-layer decomposition:

- **Create unit:** Insert functions, validation, default values.
  Produces: `createX()` signature and return type.
- **Read unit:** Query functions, filters, pagination, sorting.
  Produces: `getX()`, `listX()` signatures and return types.
- **Mutation unit:** Update and delete functions, permission checks,
  cascading effects. Produces: `updateX()`, `deleteX()` signatures.

Only use this seam when the sub-phase genuinely implements multiple CRUD
operations. If a sub-phase only adds a read path, don't force-split it.

#### 3. Tenant Isolation Boundaries

Any unit that introduces a new tenant-scoped table or data access
function should be self-contained enough to include its own
`testTenantIsolation()` tests. Don't split a table definition into one
unit and its tenant isolation tests into another — the Reviewer needs to
verify them together.

#### 4. Cross-Cutting Concern Boundaries

Some work doesn't fit neatly into a single layer:

- **Error handling plumbing** — AppError definitions, ErrorCode
  additions, error boundary components. Often best as the first unit
  so downstream units can use the error types.
- **Translation keys** — i18n namespace setup, key definitions. Can be
  a standalone unit or folded into the UI unit.
- **Type definitions** — Shared types that multiple units need. Best as
  Unit 1 if they're truly shared, or folded into the data unit if
  they're schema-derived.

### Seam Anti-Patterns

**Horizontal slicing by file count.** Don't split "first 5 files" and
"next 5 files." File count is not a meaningful seam — it produces units
with arbitrary boundaries and no interface contracts.

**Splitting by estimated effort.** Don't create units sized to "about
one session each." Size units by architectural cohesion, then check
whether the resulting context budget fits. If it doesn't, subdivide
further along architectural lines.

**Splitting tests from implementation.** Never put implementation in one
unit and its tests in another. The Reviewer Agent verifies tests and
implementation together — separating them breaks the review.

**Splitting schema from migration.** The Drizzle schema definition and
its migration file must be in the same unit. They are verified together
and a schema without a migration (or vice versa) is not independently
useful.

---

## Writing Interface Contracts

An interface contract defines what a unit produces that downstream units
consume. It is the single most important element of the subdivision doc
because it converts the Reviewer's job from "does the diff look right?"
to "does the diff fulfill the contract?"

### What a Contract Contains

For each unit, the contract specifies:

**Exports** — the exact function names, component names, or type names
that this unit creates and that other units will import:

```
Produces:
  - Type: `WorkspaceRecord` (from packages/shared/db/schema/workspaces.ts)
  - Type: `InsertWorkspaceRecord` (Drizzle insert type)
  - Migration: 0042_create_workspaces.ts
  - Factory: `createTestWorkspace()` (from packages/shared/testing/factories/)
```

**Shapes** — for types and functions, enough signature detail that a
downstream unit can write code against it before the upstream unit is
built:

```
Produces:
  - `getWorkspaceById(tenantId: string, workspaceId: string): Promise<WorkspaceRecord | null>`
  - `listWorkspacesByTenant(tenantId: string, opts: PaginationOpts): Promise<PaginatedResult<WorkspaceRecord>>`
```

**Side effects** — migrations run, queues registered, routes added:

```
Side effects:
  - Registers BullMQ queue: `workspace-sync`
  - Adds route: `/app/[tenantSlug]/workspaces/[workspaceId]`
```

### Contract Granularity

The contract should be specific enough that:

1. A downstream unit can write `import { X } from '...'` statements
   against it before the upstream unit is built.
2. The Reviewer Agent can mechanically verify every contract item exists
   in the diff.
3. A failure in one unit can be assessed for contract-breaking impact
   on downstream units by reading contracts alone.

The contract should NOT:

- Specify implementation details (how the function works internally)
- Dictate code structure (file organization within the unit)
- Include optional or aspirational outputs ("might also add...")

### Contract Notation

Use this consistent format in every subdivision doc:

```markdown
### Unit N: [Name]

**Produces:**
- `ExportName` — [type/function/component] from `path/to/file.ts`
- `ExportName(param: Type): ReturnType` — [brief purpose]

**Consumes:**
- `ExportName` from Unit M — [how it's used]

**Side Effects:**
- [migration, route, queue, etc.] — or "None"
```

---

## Curating Context Manifests

Each unit in the subdivision doc carries a context manifest — the exact
doc sections and source files the Build Agent needs to execute the
unit's prompts. This is the mechanism that enforces context discipline.

### The Context Budget Test

A unit passes the context budget test if its full context load fits
within ~40% of a Claude Code context window. The remaining 60% is
reserved for:

- CLAUDE.md (~10%)
- GLOSSARY.md (~10%)
- The actual code being written and iterated on (~30%)
- Headroom for tool outputs, errors, and iteration (~10%)

**If a unit fails the context budget test, it must be subdivided
further.** Never solve a context budget failure by trimming context —
that produces a unit with insufficient information. Instead, find a
seam within the unit and split it.

### What Goes in a Context Manifest

**Doc sections** — Referenced by document name and line range (using
section indexes). Only the specific sections the Build Agent needs, not
the full document:

```markdown
**Context Manifest:**
- `data-model.md` § Workspaces (lines 142–198)
- `data-model.md` § Tenant Isolation Patterns (lines 45–72)
- `sync-engine.md` § Adapter Interface (lines 210–245)
- `CLAUDE.md` § CockroachDB Safeguards (always loaded)
- `GLOSSARY.md` (always loaded)
```

**Source files** — Existing code files the Build Agent needs to read
(not write) to implement the unit:

```markdown
**Source Files:**
- `packages/shared/db/schema/index.ts` — existing schema exports
- `packages/shared/testing/factories/index.ts` — factory pattern reference
- `apps/web/src/data/tenants.ts` — reference for getDbForTenant pattern
```

**Prior unit outputs** — If this unit consumes another unit's exports,
list the specific files that will exist after the prior unit completes:

```markdown
**From Prior Units:**
- Unit 1 output: `packages/shared/db/schema/workspaces.ts`
- Unit 1 output: `packages/shared/testing/factories/workspaces.ts`
```

### What Does NOT Go in a Context Manifest

- Full reference docs (always use section ranges)
- Playbook content from other sub-phases
- Source files the unit won't directly read or import from
- "Nice to have" context ("this might be helpful...")
- Other skills' SKILL.md files (the Build Agent loads its own skill)

### Manifest Verification

Before finalizing a subdivision doc, the Planner should verify each
context manifest by asking:

1. Could the Build Agent write the code with ONLY this context plus
   CLAUDE.md and GLOSSARY.md? If not, what's missing?
2. Is there anything in the manifest the Build Agent won't directly
   reference? If so, remove it.
3. Do the line ranges still match the current section indexes? (Check
   MANIFEST.md for recent line count changes.)

---

## Dependency Ordering

Units within a subdivision doc form a dependency chain. The Planner
must make this chain explicit.

### Dependency Rules

1. **No circular dependencies.** If Unit A consumes Unit B's output and
   Unit B consumes Unit A's output, the seam is wrong. Re-split.
2. **Minimize chain depth.** A sub-phase with 6 strictly sequential
   units is fragile — a failure in Unit 2 blocks everything. Look for
   opportunities to parallelize: Units 3 and 4 might both consume
   Unit 2's output without depending on each other.
3. **Make the critical path explicit.** Identify which units are on the
   longest dependency chain. These are the units that most benefit from
   tight context curation and thorough interface contracts.
4. **First unit has no external contract dependencies.** The first unit
   in any subdivision should consume only existing codebase files and
   reference docs — never another unit's output.

### Dependency Notation

```markdown
## Dependency Graph

Unit 1: Schema & Types
  ↓
Unit 2: Data Access Functions (consumes Unit 1 types)
  ↓           ↓
Unit 3: UI    Unit 4: Worker Jobs
Components    (consumes Unit 2 functions)
(consumes
Unit 2 functions)
  ↓           ↓
Unit 5: Integration (consumes Units 3 + 4)
```

Parallel units (same indentation, same upstream dependency) can be built
in any order or simultaneously.

---

## Subdivision Doc Template

Every subdivision doc follows this structure. The Planner fills in each
section.

```markdown
# Subdivision Doc: [Sub-Phase ID] — [Sub-Phase Name]

## Big-Picture Anchor

[One paragraph: what this sub-phase accomplishes in the platform, how it
connects to prior and subsequent sub-phases, and what the user gains
when it's complete.]

## Dependency Graph

[ASCII dependency diagram showing unit ordering and parallelization
opportunities.]

---

### Unit 1: [Name]

**Big-Picture Anchor:** [1–2 sentences on where this unit fits.]

**RSA Classification:** [D / SH / PJ]
**RSA Rationale:** [1–2 sentences. What makes this unit deterministic,
structured, or judgment-dependent? Reference the specific spec sections
that do or don't fully specify the output.]

**Produces:**
- [Interface contract — exports, types, side effects]

**Consumes:**
- [What it needs from prior units or existing codebase]

**Context Manifest:**
- [Doc sections with line ranges]
- [Source files]
- [Prior unit outputs]

**Acceptance Criteria:**
- [ ] [Scoped from playbook to this unit]
- [ ] [Each criterion independently verifiable]

**Estimated Complexity:** [Low / Medium / High — based on number of
files touched, new patterns introduced, and integration surface area]

---

### Unit 2: [Name]
[Same structure]

---

### Unit N: [Name]
[Same structure]

---

## Cross-Unit Integration Points

[List of specific points where units interact — shared types, import
chains, route nesting, queue registration. This section helps the
Reviewer Agent verify that the units compose correctly after all are
built.]

## Context Budget Verification

| Unit | RSA | Doc Sections | Source Files | Prior Outputs | Est. Tokens | Passes |
|------|-----|-------------|-------------|---------------|-------------|--------|
| 1    | D   | 3 sections  | 2 files     | 0             | ~X,XXX      | Yes    |
| 2    | SH  | 2 sections  | 3 files     | 2 (Unit 1)    | ~X,XXX      | Yes    |
| ...  | ... | ...         | ...         | ...           | ...         | ...    |

[If any unit exceeds ~40% budget, document the further subdivision plan.]
```

---

## When to Subdivide Further

A unit should be split further when any of these are true:

1. **Context budget exceeded.** The manifest estimate exceeds ~40%.
   Split along the next applicable seam heuristic.
2. **Multiple interface contracts.** The unit produces exports consumed
   by two or more different downstream units with unrelated purposes.
   This suggests two units merged into one.
3. **Mixed acceptance criteria.** The unit's criteria span unrelated
   concerns (e.g., "schema migration runs" AND "component renders
   correctly"). If the criteria don't all relate to the same
   architectural layer, there's likely a seam.
4. **High estimated complexity with broad surface area.** A unit that
   touches 8+ files across multiple directories is probably two units.
5. **Unclear failure isolation.** If a failure in this unit would be
   hard to diagnose because the unit does too many things, split it.

---

## When NOT to Subdivide

Resist the urge to over-decompose. A unit that's too small creates:

- Overhead in contract management (more contracts = more things to
  verify)
- Artificial dependency chains (10 sequential units are worse than 5)
- Fragmented git history (micro-commits that don't represent meaningful
  work)

**Minimum viable unit:** A unit should represent a coherent slice of
functionality that a Reviewer can evaluate in a single pass and that
produces at least one meaningful export. If a unit's entire output is
a single type alias or a config constant, it's too small — fold it
into an adjacent unit.

---

## Reasoning Surface Audit (RSA)

Every unit in a subdivision doc carries an RSA classification. This
classification tells the Planner, Playbook Author, Reviewer, and
Steven how much spec coverage exists for the unit's work.

### Classification Rules

1. **Classify at the unit level, not the prompt level.** The Planner
   classifies units during Gate 1. The Playbook Author may refine
   per-prompt in Step 1, but the unit classification is the primary
   signal.

2. **Default to SH.** Most build units are Structured Handoffs — the
   spec says what to build, the builder decides how. Only classify D
   when the spec genuinely leaves zero implementation choices. Only
   classify PJ when the spec genuinely has a gap.

3. **PJ units trigger a pre-build decision gate.** Before Step 3
   begins, all PJ-classified units are surfaced to Steven. He either
   resolves the gap (upgrading to SH or D) or confirms the builder
   should use judgment. This prevents build surprises.

4. **RSA rationale is mandatory.** A bare "D" or "SH" without
   rationale is not useful. The rationale must reference specific
   spec sections that do or don't cover the unit's work. Example:
   "D — data-model.md § threads (lines 312–348) fully specifies
   all columns, FKs, and constraints. No implementation choices."

5. **Mixed units inherit the highest classification.** If a unit has
   3 D behaviors and 1 SH behavior, classify the unit as SH. If it
   has 5 SH behaviors and 1 PJ behavior, classify as PJ and document
   which behavior is the PJ concern.

### Classification Heuristics

**Classify as D when:**
- The data-model.md table definition fully specifies columns, types,
  FKs, and constraints
- The reference doc gives an explicit algorithm, formula, or config
  schema
- The acceptance criteria are binary spec-match checks ("column X
  exists with type Y")
- A prior sub-phase established a pattern and this unit repeats it
  for a new entity

**Classify as SH when:**
- The spec defines the interface but not the internal implementation
- Multiple valid implementation approaches exist within the spec's
  constraints
- The builder chooses data structures, caching strategies, or error
  retry semantics
- The acceptance criteria test behavior ("records are tenant-isolated")
  not structure

**Classify as PJ when:**
- The spec says "TBD" or leaves a gap
- An edge case isn't addressed in the reference doc
- A UX decision depends on runtime behavior you haven't measured
- The builder would need to ask Steven "what should happen when...?"

### The PJ Pre-Build Gate

Pure Judgment prompts MUST be surfaced to Steven as a batch before
Step 3 begins. For each PJ prompt, Steven either:
1. **Makes the decision** → classification upgrades to SH or D, doc
   gets updated in Step 0, prompt gets rewritten
2. **Confirms judgment call** → builder proceeds with their best
   judgment, Steven reviews the output with extra attention

This is the highest-value behavior RSA introduces: catching spec gaps
before they become build surprises.

### RSA in the Context Budget Verification Table

Add an RSA column to the existing table:

| Unit | RSA | Doc Sections | Source Files | Prior Outputs | Est. Tokens | Passes |
|------|-----|-------------|-------------|---------------|-------------|--------|
| 1    | D   | 3 sections  | 2 files     | 0             | ~X,XXX      | Yes    |
| 2    | SH  | 2 sections  | 3 files     | 2 (Unit 1)    | ~X,XXX      | Yes    |
| 3    | PJ  | 4 sections  | 1 file      | 1 (Unit 2)    | ~X,XXX      | Yes    |

### What RSA Data Is For

This classification data serves three purposes:

1. **Immediate (L1):** Calibrates review depth and surfaces spec gaps
   before the build starts. The Reviewer spends minimal time on D
   prompts, standard time on SH, and extra scrutiny on PJ.

2. **Training data for L3:** Every classified unit becomes training
   data for AbleSpec's Decomposition Engine. When AbleSpec's L3
   classification automates build-time RSA for a user's project, it
   draws on patterns validated against EveryStack's build history.
   The RSA Rationale text is especially valuable — it captures the
   *reasoning* behind classifications, not just the labels.

3. **Methodology validation for L4:** The distribution of D/SH/PJ
   across EveryStack's build validates the classification framework
   itself. If 80% of prompts are SH, that tells us the sweet spot
   for spec coverage. This informs how AbleSpec eventually helps
   users classify their own AI agents' behaviors (L4).

---

## Worked Example

Sub-phase: 3C — Omnichannel Messaging (hypothetical)

**Seam analysis:**
- Data layer: New `thread_messages` and `thread_participants` tables
- Service layer: CRUD for messages, participant management, real-time
  broadcasting
- UI layer: Thread view component, message composer, participant list
- Cross-cutting: Notification queue registration, translation keys

**Subdivision:**

```
Unit 1: Schema & Types (Data)
  - RSA: D — data-model.md fully specifies thread_messages and
    thread_participants columns, FKs, constraints, and JSONB shapes.
  - Produces: table types, migration, test factories
  - Estimated: Low complexity

Unit 2: Message CRUD (Service)
  - RSA: SH — communications.md specifies the message model and
    delivery requirements but builder chooses query patterns,
    pagination strategy, and optimistic update implementation.
  - Produces: createMessage, getThreadMessages, markAsRead functions
  - Estimated: Medium complexity

Unit 3: Participant Management (Service)
  - RSA: SH — communications.md defines participant roles and
    permissions but builder decides on invitation flow and removal
    cascade behavior.
  - Produces: add/remove/list participant functions
  - Estimated: Medium complexity

Unit 4: Real-Time Broadcasting (Service + Worker)
  - RSA: PJ — communications.md says "real-time message delivery"
    but doesn't specify the transport mechanism (WebSocket, SSE,
    polling). Builder must decide. **Surface to Steven before build.**
  - Produces: Socket.io event handlers, BullMQ job processor
  - Estimated: High complexity

Unit 5: Thread View UI (Interface)
  - RSA: SH — ui-ux.md defines the thread layout and component
    hierarchy but builder decides on virtualization strategy and
    scroll behavior.
  - Produces: ThreadView, MessageComposer, ParticipantList components
  - Estimated: Medium complexity
```

**Why this decomposition works:**
- Units 2 and 3 are parallel (both consume Unit 1, don't depend on
  each other)
- Units 4 and 5 are parallel (both consume Units 2+3)
- Each unit has a clear interface contract
- Each unit can be reviewed independently
- The critical path is: 1 → 2 → 4 (or 1 → 2 → 5)
