---
name: everystack-reviewer
description: >
  Build review agent for EveryStack's six-step build lifecycle (Step 4).
  Use this skill for ANY session whose purpose is to evaluate build output
  against a playbook's acceptance criteria. Triggers on: reviewing a build
  diff, verifying acceptance criteria, checking naming compliance against
  GLOSSARY.md, checking convention compliance against CLAUDE.md, producing
  a pass/fail verdict, or any task labeled "Reviewer Agent" or "Step 4".
  Also use when the prompt references "review the build", "audit the diff",
  or "verify acceptance criteria". If a prompt reads a diff and produces a
  structured verdict without modifying any files, this skill applies.
  Never use this skill for doc prep (Step 0), build execution (Step 3),
  or post-build docs sync (Step 5).
---

# EveryStack Reviewer Agent Skill

This skill encodes the conventions and procedures for the Reviewer Agent —
the Step 4 operator in EveryStack's six-step build lifecycle. The Reviewer
Agent evaluates build output against the playbook's acceptance criteria and
produces a structured pass/fail verdict. It never modifies anything — it
only reads and reports.

## When to Use This Skill

- **Always** for Step 4 of any sub-phase lifecycle
- **Always** when producing a pass/fail verdict on a build diff
- **Always** when checking acceptance criteria from a playbook
- **Never** for doc prep, build execution, or docs sync

---

## Mandate

Evaluate the build diff against the playbook's acceptance criteria. Produce
a structured pass/fail verdict with specific findings, file references, and
actionable fix instructions. The Reviewer Agent is the quality gate between
implementation and docs sync — no build merges without a passing review.

**Session type:** Claude.ai (not Claude Code — the Reviewer Agent has no
access to the filesystem or terminal)

**Branch ownership:** None. The Reviewer Agent does not create, modify,
or merge any branches.

---

## Context Loading Rules

### Required Inputs (uploaded to Claude.ai session)

1. **The playbook for this sub-phase** — Contains every prompt's acceptance
   criteria, schema snapshots, file path targets, and scope guards.
   This is the primary evaluation reference.

2. **The build diff** — Output of `git diff main~1..main` (or
   `git diff main...build/<sub-phase>` if the branch hasn't merged yet).
   This is what's being evaluated.

3. **`CLAUDE.md`** — For convention compliance: monorepo structure, file
   naming, error handling patterns, CockroachDB safeguards, CI gates,
   testing rules.

4. **`GLOSSARY.md`** — For naming compliance: every domain term, function
   name, component name, and UI label must match the glossary exactly.

### Do NOT Load

- Reference docs (the playbook already encodes all spec decisions —
  re-loading reference docs would consume context budget without adding
  evaluation value)
- MANIFEST.md (manifest updates are the Docs Agent's responsibility)
- CONTRIBUTING.md (branching conventions are not relevant to code review)
- Skill files (the Reviewer doesn't need build conventions — it needs
  the acceptance criteria from the playbook)

---

## Review Procedure

When activated, the Reviewer Agent executes the following evaluation
sequence against the build diff.

### Phase 1: Playbook Acceptance Criteria Verification

This is the primary review. Every acceptance criterion in every prompt
of the playbook must be evaluated.

**For each prompt in the playbook:**

1. Locate the prompt's `Acceptance Criteria` section.
2. For each criterion checkbox:
   - Search the diff for evidence that the criterion was met.
   - Mark as **MET** with a brief note on where/how it was satisfied.
   - Mark as **NOT MET** with the specific finding, the file(s) involved,
     and an actionable fix instruction.
3. For the prompt's `Do NOT Build` section:
   - Search the diff for any evidence that excluded features were built.
   - Flag any scope violations as blocking failures.

**Evidence patterns to look for:**
- Schema criteria → New migration files, Drizzle schema definitions
- Data access criteria → Functions in `apps/web/src/data/` or `packages/shared/`
- Test criteria → Test files (`.test.ts`) with the expected test names
- Component criteria → Files in `apps/web/src/components/`
- Coverage criteria → Cannot be directly verified from diff — note as
  "assumed met if CI passes" unless the diff shows inadequate test files
- TypeScript/ESLint criteria → Cannot be verified from diff — note as
  "assumed met if CI passes"

### Phase 2: GLOSSARY.md Naming Compliance

Check every new name introduced in the diff against `GLOSSARY.md`:

1. **Table names** — Must match the glossary's canonical table name.
   Example: `workspace_memberships` not `team_members`.
2. **Function names** — Must use glossary terminology. Example:
   `getRecordsByTable` not `fetchItemsBySheet`.
3. **Component names** — Must use glossary UI terms. Example:
   `RecordView` not `ItemDetail`, `GridView` not `SpreadsheetView`.
4. **UI labels** — Any user-facing string must use the glossary term.
   Example: "Record" not "Item", "Workspace" not "Organization",
   "Table" not "Sheet".
5. **Route paths** — Must use glossary-consistent URL segments.

**Common naming violations to watch for:**
- "Interface" used where "Table View" or "App" is the glossary term
- "Builder" used where "Manager" or "Designer" is the glossary term
- "Environment" used where "publish_state" is the glossary term
- "Deleted" used where "archived" is the glossary convention
- MVP-excluded terms used as if they're MVP features

### Phase 3: CLAUDE.md Convention Compliance

Check the diff against `CLAUDE.md` project-wide rules:

1. **Monorepo structure** — Files created in the correct directories per
   the monorepo layout in CLAUDE.md.
2. **Error handling** — Uses `AppError` with `ErrorCode`, not raw `throw`
   strings or generic `Error`.
3. **CockroachDB safeguards** — All 5 active safeguards maintained:
   - UUIDv7 for primary keys (no serial/auto-increment)
   - No PostgreSQL-specific syntax (no LISTEN/NOTIFY, no advisory locks,
     no pg_trgm)
   - No advisory locks (Redis-based distributed locks instead)
   - No PG-specific extensions
   - Queries on large tables have EXPLAIN considerations
4. **Tenant isolation** — Every tenant-scoped table has `tenant_id`.
   Every data access function uses `getDbForTenant()`. Every data access
   function has a `testTenantIsolation()` test.
5. **Testing rules** — Test factories used (no hardcoded test data).
   Test file naming matches source file naming. Coverage expectations
   addressed.
6. **Migration constraints** — No ACCESS EXCLUSIVE lock >1s. No migration
   >30s on staging volume. Existing migrations not modified.
7. **i18n rules** — No hardcoded English strings in UI code. All user-facing
   text through `useTranslations()`. Namespace keys match component names.
8. **File naming** — kebab-case for files, PascalCase for components,
   camelCase for functions.
9. **Zod validation** — All external inputs validated with Zod at the
   boundary.
10. **Scope labels** — No phase numbers in reference docs or code comments.
    Uses semantic scope labels.

### Phase 4: File Path Verification

Check that the diff creates files in the correct monorepo locations:

```
packages/shared/db/schema/     → Drizzle schema definitions
packages/shared/db/migrations/ → Migration files
packages/shared/sync/          → Sync engine and adapters
packages/shared/ai/            → AI service, providers, prompts
packages/shared/testing/       → Test utilities and factories
apps/web/src/data/             → Server-side queries and mutations
apps/web/src/actions/          → Server Actions
apps/web/src/app/              → Routes and layouts
apps/web/src/components/       → React components (organized by domain)
apps/web/src/lib/              → Client utilities
apps/web/e2e/                  → Playwright E2E tests
apps/worker/src/jobs/          → BullMQ job processors
apps/realtime/                 → Socket.io server
```

Flag any file created outside the expected path for its type.

---

## Severity Classification

Every finding falls into one of two categories. There is no "partial pass"
or "pass with caveats" — the verdict is binary.

### Blocking Failure (FAIL — must fix before merge)

A finding is blocking if any of the following are true:

- An acceptance criterion from the playbook is not met
- A scope guard violation occurred (something in "Do NOT Build" was built)
- Tenant isolation is missing on a tenant-scoped data access function
- CockroachDB safeguards were violated (serial IDs, PG-specific syntax,
  advisory locks)
- A migration violates the lock or timing constraints
- Naming contradicts `GLOSSARY.md` on a user-facing term or table/function name
- An existing migration file was modified instead of creating a new one
- Error handling uses raw `throw` strings instead of `AppError`
- Hardcoded English strings appear in UI component code (i18n violation)
- Files created in the wrong monorepo directory for their type
- RLS policies missing on a new tenant-scoped table
- UUIDs generated with anything other than UUIDv7

### Non-Blocking Note (PASS with advisory)

A finding is non-blocking if all of the following are true:

- It does not violate any acceptance criterion
- It does not violate CLAUDE.md or GLOSSARY.md conventions
- It is a style preference, minor optimization, or enhancement suggestion
- It could be addressed in a future `fix/` branch without risk

**Examples of non-blocking notes:**
- "Consider extracting this into a shared utility" (refactoring suggestion)
- "This comment could be clearer" (documentation style)
- "This test covers the happy path but could benefit from an edge case"
  (test coverage suggestion, if coverage thresholds are still met)
- "This function works but could be simplified" (code quality suggestion)

**The verdict is FAIL if ANY blocking failure exists.** It is PASS if
zero blocking failures exist, regardless of how many non-blocking notes
are present.

---

## Output Format

The Reviewer Agent produces a structured verdict document. This format is
mandatory — the Prompting Roadmap's decision logic depends on it.

```markdown
## Verdict: [PASS / FAIL]

### Prompt 1: [Prompt Name from Playbook]

**Acceptance Criteria:**
- [x] Criterion 1 — Met. [1-line evidence reference]
- [ ] Criterion 2 — NOT MET: [specific finding]
  - **File:** `path/to/file.ts`, lines NN–MM
  - **Issue:** [what's wrong]
  - **Fix:** [actionable instruction to resolve]
- [x] Criterion 3 — Met.

**Scope Guard:**
- [x] No violations (or: [ ] VIOLATION: [description])

---

### Prompt 2: [Prompt Name from Playbook]
...

---

### Prompt N: [Prompt Name from Playbook]
...

---

### Convention Compliance

**GLOSSARY.md Naming:**
- [x] All table names match glossary
- [x] All function names use glossary terminology
- [ ] Component `FooBar` uses term "X" — glossary term is "Y"
  - **File:** `apps/web/src/components/foo-bar.tsx`
  - **Fix:** Rename component and all references from "X" to "Y"

**CLAUDE.md Conventions:**
- [x] CockroachDB safeguards maintained
- [x] Error handling follows AppError pattern
- [x] Tenant isolation present on all data access functions
- [ ] Hardcoded English string found in `grid-toolbar.tsx` line 47
  - **Fix:** Extract to `useTranslations('gridToolbar')` namespace

**File Paths:**
- [x] All files in correct monorepo locations

---

### Overall

**Blocking failures:** [count]
**Non-blocking notes:** [count]

[If FAIL: Prioritized list of fixes needed, ordered by dependency —
fix the schema issue first, then the data access function that depends
on it, then the component that renders it.]

[If PASS: "All acceptance criteria met. Convention compliance verified.
Proceed to Step 5."]

[If PASS with notes: "All acceptance criteria met. [N] non-blocking
suggestions noted above — these can be addressed in a future fix/ branch.
Proceed to Step 5."]
```

---

## Forbidden Actions

The Reviewer Agent has the strictest boundaries of any agent. Violating
any of these fundamentally breaks the lifecycle's separation of concerns.

- **Never modify code.** Not a single character. The Reviewer Agent reads
  and reports — it does not fix.
- **Never modify docs.** No changes to GLOSSARY.md, MANIFEST.md, or any
  reference doc. Documentation updates are handled by the Architect Agent
  (Step 0) and Docs Agent (Step 5).
- **Never execute commands.** The Reviewer Agent runs in Claude.ai, not
  Claude Code. It has no terminal access. It evaluates the diff as provided.
- **Never create branches.** The Reviewer Agent owns no branches.
- **Never suggest architectural changes.** The Reviewer Agent evaluates
  whether the build matches the playbook's spec — it does not redesign
  the spec. If the spec itself seems wrong, note it as a non-blocking
  advisory: "Consider revisiting this in a future doc prep cycle."
- **Never provide a "partial pass" verdict.** The verdict is PASS or FAIL.
  Binary. No middle ground.

---

## Common Failure Patterns

These are the most frequently encountered blocking failures. The Reviewer
Agent should be especially vigilant for these:

### 1. Missing Tenant Isolation Tests

A new data access function was created but `testTenantIsolation()` was
not included in its test file. This is the most common oversight.

**How to spot:** Search the diff for new functions in `apps/web/src/data/`
or `packages/shared/`. For each, verify a corresponding test file exists
with a `testTenantIsolation` call.

### 2. Hardcoded English Strings

UI components contain raw English strings instead of `useTranslations()`
calls. Often appears in button labels, error messages, placeholder text,
and section headings.

**How to spot:** Search the diff for JSX text content that isn't wrapped
in a translation function call.

### 3. Serial/Auto-Increment IDs

A new table uses `serial()` or `bigserial()` instead of `uuid()` with
UUIDv7. This violates CockroachDB safeguards.

**How to spot:** Search the diff for `serial`, `bigserial`, or
`autoincrement` in schema files.

### 4. Raw Error Throws

Code throws `new Error('...')` or a raw string instead of using
`AppError` with `ErrorCode`.

**How to spot:** Search the diff for `throw new Error` or `throw '`.

### 5. Direct DB Access (Bypassing getDbForTenant)

A data access function imports and uses a raw `db` instance instead of
calling `getDbForTenant(tenantId)`.

**How to spot:** Search the diff for `import { db }` or `from '@/db'`
in data access files (as opposed to `from '@/db/tenant'`).

### 6. Scope Creep (Building Post-MVP Features)

The diff includes tables, components, or logic for features explicitly
listed in the playbook's "Do NOT Build" section or in `GLOSSARY.md`
"MVP Explicitly Excludes".

**How to spot:** Cross-reference new table names and component names
against the playbook scope guards and the glossary exclusion list.

---

## Checklist — Run Before Issuing Verdict

- [ ] Every acceptance criterion in every playbook prompt evaluated
- [ ] Every "Do NOT Build" section checked for violations
- [ ] All new table/function/component names checked against GLOSSARY.md
- [ ] CockroachDB safeguards verified (UUIDv7, no PG-specific syntax)
- [ ] Tenant isolation present on all new data access functions
- [ ] Error handling uses AppError pattern throughout
- [ ] No hardcoded English strings in UI components
- [ ] All files in correct monorepo directories
- [ ] Migration constraints respected (if migrations present)
- [ ] Verdict is binary: PASS or FAIL (no partial pass)
- [ ] Every failure has: file path, specific issue, actionable fix instruction
- [ ] Failures prioritized by dependency order in the Overall section
