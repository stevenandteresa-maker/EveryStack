# Step 3 — Terminology Discipline: Findings

**Auditor:** Claude  
**Date:** 2026-03-01  
**Input tarball:** `everystack-post-step2-fixed.tar.gz`  
**Docs scanned:** 63 (59 main + 4 gap)

---

## Summary

| Check                        | Scanned | Findings              | Fixed |
| ---------------------------- | ------- | --------------------- | ----- |
| 1. Banned terms in body text | 63 docs | 3                     | 3     |
| 2. Role name confusion       | 63 docs | 0 (5 false positives) | —     |
| 3. Phase number references   | 63 docs | 0 (1 false positive)  | —     |
| 4. Non-canonical plan names  | 63 docs | 2                     | 2     |
| 5. Informal synonyms         | 63 docs | 1                     | 1     |
| **Totals**                   |         | **6**                 | **6** |

---

## Findings Table

| #   | File                    | Line(s)  | Banned Term                       | Should Be                             | Severity | Status    |
| --- | ----------------------- | -------- | --------------------------------- | ------------------------------------- | -------- | --------- |
| 1   | `ai-metering.md`        | 42       | "comms hub"                       | Record Thread & Chat terminology      | Moderate | **Fixed** |
| 2   | `GLOSSARY.md`           | 299      | "Document interface type"         | "Document App type"                   | Moderate | **Fixed** |
| 3   | `GLOSSARY.md`           | 690      | "Document interface type"         | "Document App type"                   | Moderate | **Fixed** |
| 4   | `booking-scheduling.md` | 509      | "free tier" (EveryStack branding) | "Freelancer plan"                     | Moderate | **Fixed** |
| 5   | `booking-scheduling.md` | 515      | "Free/Standard plans"             | "Freelancer/Starter plans"            | Moderate | **Fixed** |
| 6   | `testing.md`            | 600, 612 | `/bases/test-base/` in URL paths  | `/w/test-workspace/tables/test-table` | Low      | **Fixed** |

---

## Detailed Findings

Covers Finding 1 — `ai-metering.md:42` — "comms hub", Findings 2–3 — `GLOSSARY.md:299, 690` — "interface type", Findings 4–5 — `booking-scheduling.md:509, 515` — Non-canonical plan names, Finding 6 — `testing.md:600, 612` — "/bases/" in URL paths.

### Finding 1 — `ai-metering.md:42` — "comms hub"

**Before:**

```
| Record Thread & Chat | ... | **MVP** (Record Thread) / **Post-MVP** (full comms hub) |
```

**After:**

```
| Record Thread & Chat | ... | **MVP** (Record Thread) / **Post-MVP** (full thread & chat features) |
```

**Rationale:** "Comms Hub" / "Communications Hub" is a banned term per GLOSSARY.md § Naming Discipline. The correct surface names are "Record Thread" (record-level) and "Chat" (personal DM/group).

---

### Findings 2–3 — `GLOSSARY.md:299, 690` — "interface type"

**Before:**

```
Full Document interface type in App Designer...
| Document interface type (App Designer canvas → PDF) | Post-MVP |
```

**After:**

```
Full Document App type in App Designer...
| Document App type (App Designer canvas → PDF) | Post-MVP |
```

**Rationale:** The GLOSSARY's own Naming Discipline table bans "Interface types" → use "App types" instead. These occurrences were in GLOSSARY body text (definitions section and scope table), not in the "Do NOT Use" table itself.

---

### Findings 4–5 — `booking-scheduling.md:509, 515` — Non-canonical plan names

**Before:**

```
│  Powered by EveryStack (free tier)            │
...
- "Powered by EveryStack" branding on Free/Standard plans. Removed on Professional+.
```

**After:**

```
│  Powered by EveryStack (Freelancer plan)      │
...
- "Powered by EveryStack" branding on Freelancer/Starter plans. Removed on Professional+.
```

**Rationale:** GLOSSARY.md § Plan Tiers defines five canonical plan names: Freelancer, Starter, Professional, Business, Enterprise. "Free tier" and "Standard" are not canonical names.

---

### Finding 6 — `testing.md:600, 612` — "/bases/" in URL paths

**Before:**

```javascript
await page.goto('/w/test-workspace/bases/test-base/tables/test-table');
```

**After:**

```javascript
await page.goto('/w/test-workspace/tables/test-table');
```

**Rationale:** GLOSSARY bans "base" as a synonym for workspace. The URL path `/w/test-workspace/` already identifies the workspace; the `/bases/test-base/` segment introduced a non-existent entity layer. EveryStack's hierarchy is Tenant → Board → Workspace → Table.

---

## False Positives (Correctly Excluded)

| Source                                        | Term Found                               | Reason Excluded                                                              |
| --------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `CLAUDE.md:351`                               | "Phase 3"                                | Instructional text: `❌ Never write "Phase 3"` — not a violation             |
| `ai-architecture.md:222`                      | "Context Builder"                        | AI architecture component name (builds context for prompts), not a user role |
| `schema-descriptor-service.md:20`             | "Context Builder"                        | Same — AI component cross-reference                                          |
| `self-hosted-ai.md:159`                       | "Context Builder"                        | Same — AI component cross-reference                                          |
| `vector-embeddings.md:125, 127`               | "Context Builder"                        | Same — AI component cross-reference                                          |
| `cockroachdb-readiness.md:314`                | "free tier"                              | Refers to CockroachDB Serverless vendor tier, not EveryStack plan            |
| `email.md:15`                                 | "Free tier"                              | Refers to Cloudflare Email Workers vendor tier, not EveryStack plan          |
| `accounting-integration.md:5`                 | "bases"                                  | Inside reconciliation note block                                             |
| `field-groups.md:329`                         | "bases"                                  | Inside glossary alignment note block                                         |
| `GLOSSARY.md:701–706`                         | "Interface Designer", etc.               | Inside the "Do NOT Use" table itself (definitional)                          |
| `GLOSSARY.md:680, 705–706`                    | "Communications Hub", "My Office panels" | Inside the Naming Discipline table or MVP scope table (definitional)         |
| `design-system.md:5`                          | "Interface Designer"                     | Inside reconciliation note: `> "Interface Designer" → **App Designer**`      |
| `embeddable-extensions.md:39, 852`            | "Communications Hub"                     | Inside scope/reconciliation notes with `⚠️` markers                          |
| `gaps/knowledge-base-live-chat-ai.md:19, 346` | "Communications Hub"                     | Inside reconciliation notes; line 346 explicitly says "not a valid term"     |

---

## Checks with Zero Findings

Covers Check 2 — Role Name Confusion, Check 3 — Phase Number References, Check 4 — Plan Name References (partial), Check 5 — Informal Synonyms (partial).
Touches `base_connections` tables. See `session-log.md`.

### Check 2 — Role Name Confusion

Scanned all 63 docs for "Builder" and "Editor" used as role names. All occurrences are legitimate component names:

- "Automation Builder" — UI component
- "Context Builder" — AI architecture component
- "Template Builder", "Form Builder", etc. — UI components
- "Smart Doc Editor", "TipTap editor", etc. — editor components

No instance of "Builder" or "Editor" used as a workspace or tenant role. Canonical roles confirmed clean: Owner, Admin, Manager, Team Member, Viewer.

### Check 3 — Phase Number References

Scanned all 63 docs (excluding `session-log.md` and `MANIFEST.md`) for "Phase 1" through "Phase 4". Only occurrence: `CLAUDE.md:351` which is an instruction telling Claude Code to never use phase numbers. All reference docs use scope labels (MVP — Foundation, Post-MVP — Automations, etc.) correctly.

### Check 4 — Plan Name References (partial)

Beyond the two booking-scheduling.md findings above, scanned for "Free plan", "Basic plan", "Pro plan", "Team plan", "Growth plan", "Premium plan", "Standard plan". Zero non-canonical EveryStack plan references found. Vendor tier references (CockroachDB, Cloudflare, Resend) correctly excluded.

### Check 5 — Informal Synonyms (partial)

Beyond the testing.md URL finding above, scanned for:

- "base" meaning workspace — 0 findings (all "base" references are external platform bases or compound terms like `base_connections`)
- "portal designer" — 0 findings (correctly using "App Designer" everywhere)
- "Unified Inbox" — 0 findings
- "Interface View" — 0 findings (correctly using "Table View" everywhere)

---

## Files Modified

| File                    | Change                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `ai-metering.md`        | Line 42: "full comms hub" → "full thread & chat features"              |
| `GLOSSARY.md`           | Line 299: "Document interface type" → "Document App type"              |
| `GLOSSARY.md`           | Line 690: "Document interface type" → "Document App type"              |
| `booking-scheduling.md` | Line 509: "free tier" → "Freelancer plan"                              |
| `booking-scheduling.md` | Line 515: "Free/Standard plans" → "Freelancer/Starter plans"           |
| `testing.md`            | Lines 600, 612: `/bases/test-base/` removed from URL paths             |
| `MANIFEST.md`           | Not modified — all changes were character-level, line counts unchanged |

---

## Verification Commands

```bash
# Extract tarball
tar xzf everystack-post-step3-fixed.tar.gz

# Verify no banned terms remain (outside exclusion zones)
grep -rn "comms hub" *.md gaps/*.md | grep -v "GLOSSARY.md" | grep -v "AUDIT-" | grep -v session-log
grep -rn "interface type" *.md gaps/*.md | grep -v "AUDIT-"
grep -rn "Free/Standard" *.md gaps/*.md
grep -rn "/bases/" *.md gaps/*.md

# Verify canonical plan names in booking-scheduling
grep -n "Freelancer\|Starter" booking-scheduling.md

# Verify no phase numbers in reference docs
grep -rn "Phase [1-4]" *.md gaps/*.md | grep -v session-log | grep -v AUDIT | grep -v MANIFEST | grep -v CLAUDE.md
```
