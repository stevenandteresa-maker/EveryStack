# Decisions Log

Running log of tactical decisions made during build sessions. Newest first.
For architectural decisions with alternatives considered, use a full ADR
in `docs/decisions/` instead. This log captures smaller, within-session
choices that don't warrant an ADR but that downstream agents need to know.

## How to Use This File

**Who writes:** Build Agent (Step 3) and Architect Agent (Step 0).
**Who reads:** All agents. Any agent can reference this log to understand
why something was done a certain way without Steven re-explaining it.
**When to write:** After making a tactical decision during a build or
doc prep session — choosing one approach over another, deferring something,
or resolving an ambiguity in the spec.

### Entry Format

```
### YYYY-MM-DD — [Sub-phase ID] — [Short Title]

**Decision:** [What was decided, in one sentence.]

**Rationale:** [Why this approach was chosen. 1–3 sentences.]

**Alternatives rejected:** [What else was considered and why it lost. Optional — omit if the decision was straightforward.]

**Affects:** [Which files, modules, or downstream units this impacts.]
```

### When to Use This vs. an ADR

```
Was this a choice between 2+ viable architectural approaches?
  → Yes → Write an ADR (docs/decisions/NNN-*.md)
  → No  → Was this a within-session tactical call?
            → Yes → Log it here
            → No  → No record needed
```

---

## Log

### 2026-03-13 — 3B-i — Exclude Impact Analysis & Convert to Native Table from build scope

**Decision:** Impact Analysis and Convert to Native Table are excluded from the 3B-i build despite appearing in the phase division doc's Includes list, because `cross-linking.md` explicitly marks both sections as Post-MVP per GLOSSARY.md scope labels.

**Rationale:** The reference doc was updated on 2026-03-13 with scope labels: "Impact Analysis *(Post-MVP)*" (lines 496–531) and "Convert to Native Table *(Post-MVP)*" (lines 533–582). Per CLAUDE.md hierarchy rule, GLOSSARY.md is the ultimate authority for scope definitions, and reference docs are authoritative on architecture and behavior. The phase division doc predates the scope label update and included these features in error.

**Alternatives rejected:** Building impact analysis and convert-to-native as additional units — rejected because GLOSSARY.md is the scope authority and both are clearly labeled Post-MVP. Building stubs/extension points only — rejected because the subdivision strategy says don't build post-MVP extensions; the cross-link data model already has the schema hooks needed.

**Affects:** 3B-i subdivision doc (5 units instead of 7), phase division doc (Includes list is stale for these two items).

<!-- Newest entries go here, above older entries. -->
