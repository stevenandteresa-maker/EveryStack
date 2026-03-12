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

<!-- Newest entries go here, above older entries. -->
