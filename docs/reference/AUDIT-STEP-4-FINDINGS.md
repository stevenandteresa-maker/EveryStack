# Step 4 — Cross-Reference Integrity: Findings

**Auditor:** Claude  
**Date:** 2026-03-01  
**Input tarball:** `everystack-post-step3-fixed.tar.gz`  
**Docs scanned:** 67 files (59 main + 4 gap + 3 audit findings + MANIFEST)  
**Total cross-references found:** 1,922 unique

---

## Summary

| Check                      | Result                          | Findings    | Fixed                        |
| -------------------------- | ------------------------------- | ----------- | ---------------------------- |
| 1. File exists             | 1,922 refs checked              | 1 (2 lines) | Noted (pending creation)     |
| 2. Section exists          | 28 § refs checked               | 9           | 9                            |
| 3. Circular references     | 163 bidirectional pairs checked | 0           | —                            |
| 4. Orphan docs             | 63 docs checked                 | 0           | —                            |
| 5. Stale rename references | 63 docs checked                 | 0           | —                            |
| **Totals**                 |                                 | **10**      | **9 fixed, 1 informational** |

---

## Findings Table

| #   | Source File            | Line     | References                                                              | Issue                                                                                                                     | Severity |
| --- | ---------------------- | -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | `document-designer.md` | 463, 504 | `docx-template-engine-prompts.md`                                       | File marked "pending creation" — does not exist                                                                           | Info     |
| 2   | `GLOSSARY.md`          | 635      | `sync-engine.md` §Plan-Based Record Quotas                              | Heading does not exist; actual: §Record Quota Enforcement                                                                 | Moderate |
| 3   | `GLOSSARY.md`          | 636      | `sync-engine.md` §Plan-Based Record Quotas                              | Same as #2                                                                                                                | Moderate |
| 4   | `GLOSSARY.md`          | 637      | `ai-metering.md` §Credit Allocation                                     | Heading does not exist; actual: §Monthly Credit Budgets by Tier                                                           | Moderate |
| 5   | `GLOSSARY.md`          | 638      | `ai-metering.md` §Rate Limiting                                         | No rate limiting heading exists in `ai-metering.md`; closest: §AIService Wrapper Implementation + §Plan Limits for Agents | Moderate |
| 6   | `GLOSSARY.md`          | 639      | `portals.md` §Plan Limits                                               | Heading does not exist; actual: §Portal Client Limits — MVP                                                               | Moderate |
| 7   | `GLOSSARY.md`          | 640      | `portals.md` §Plan Limits                                               | Same as #6                                                                                                                | Moderate |
| 8   | `data-model.md`        | 99       | `smart-docs.md` §mergeTag node                                          | Heading does not exist; `mergeTag` is a row in the §Custom EveryStack Node Definitions table                              | Moderate |
| 9   | `data-model.md`        | 165      | `platform-api.md` §Tenant Creation + `GLOSSARY.md` §Platform-level keys | Both headings wrong; actual: §Tenant Management API and §Platform API                                                     | Moderate |
| 10  | `platform-api.md`      | 801      | `portals.md` §Portal Access                                             | Heading does not exist; actual: §`portal_access` Table                                                                    | Low      |
| 11  | `platform-api.md`      | 819      | `smart-docs.md` §mergeTag node                                          | Same as #8                                                                                                                | Low      |

---

## Detailed Findings

Covers Finding 1 — `document-designer.md:463, 504` — Missing file (pending creation), Findings 2–7 — `GLOSSARY.md` quota dimension table — Six stale § references, Finding 8 — `data-model.md:99` + Finding 11 — `platform-api.md:819` — §mergeTag node, Finding 9 — `data-model.md:165` — Two stale § references on one line, Finding 10 — `platform-api.md:801` — §Portal Access.
Touches `portal_access` tables. See `docx-template-engine-prompts.md`, `sync-engine.md`, `ai-metering.md`.

### Finding 1 — `document-designer.md:463, 504` — Missing file (pending creation)

**Status:** Informational — no fix applied.

Two references to `docx-template-engine-prompts.md`, both explicitly marked as "pending creation":

Line 463:

> Engine: EveryStack's homegrown pizzip-based template engine... Build spec: `docx-template-engine-prompts.md` **(pending creation** — covers pizzip XML surgery, tag parser, loop/conditional walker, image replacer, filter pipeline).

Line 504:

> Build prompts will be documented in `docx-template-engine-prompts.md` **(pending creation)**.

**Action:** When the DOCX template engine build spec is created, add it to the tarball and MANIFEST.md. No reference change needed — the intent is correct.

---

### Findings 2–7 — `GLOSSARY.md` quota dimension table — Six stale § references

The "Quota dimensions" table in §Plan Tiers referenced section headings that were renamed during reconciliation. All six have been corrected:

| Row              | Old § Reference                            | New § Reference                                             |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Record quota     | `sync-engine.md` §Plan-Based Record Quotas | §Record Quota Enforcement                                   |
| Base connections | `sync-engine.md` §Plan-Based Record Quotas | §Record Quota Enforcement                                   |
| AI credits       | `ai-metering.md` §Credit Allocation        | §Monthly Credit Budgets by Tier                             |
| AI concurrent    | `ai-metering.md` §Rate Limiting            | §AIService Wrapper Implementation + §Plan Limits for Agents |
| Portal count     | `portals.md` §Plan Limits                  | §Portal Client Limits — MVP                                 |
| Portal access    | `portals.md` §Plan Limits                  | §Portal Client Limits — MVP                                 |

**Root cause:** Section headings in target docs were updated during the 2026-02-27 reconciliation pass, but the GLOSSARY quota dimension table's § pointers were never refreshed.

---

### Finding 8 — `data-model.md:99` + Finding 11 — `platform-api.md:819` — §mergeTag node

`mergeTag` is a row inside the "Custom EveryStack Node Definitions" table in `smart-docs.md`, not a section heading.

**Before:** `See smart-docs.md §mergeTag node`  
**After:** `See smart-docs.md §Custom EveryStack Node Definitions`

---

### Finding 9 — `data-model.md:165` — Two stale § references on one line

**Before:** `platform-api.md §Tenant Creation, GLOSSARY.md §Platform-level keys`  
**After:** `platform-api.md §Tenant Management API, GLOSSARY.md §Platform API`

- `§Tenant Creation` → actual heading is `### Create Tenant` under `## Tenant Management API`
- `§Platform-level keys` → not a heading; it's a bold paragraph under `### Platform API`

---

### Finding 10 — `platform-api.md:801` — §Portal Access

**Before:** `See portals.md §Portal Access`  
**After:** `See portals.md §\`portal_access\` Table`

The `portal_access` table documentation is under the heading `### \`portal_access\` Table`, not "Portal Access."

---

## Checks with Zero Findings

### Check 3 — Circular References ✅

163 bidirectional reference pairs identified (normal for a densely cross-referenced doc set). Scanned all pairs for "details in" / "see X for details" patterns where both sides defer to each other — **zero circular deference found.** All bidirectional pairs contain substantive content on both sides.

### Check 4 — Orphan Docs ✅

Every doc in the tarball (excluding meta-docs: MANIFEST.md, GLOSSARY.md, CLAUDE.md, session-log.md, AUDIT-\* files) is referenced by at least one other doc. **Zero orphans.**

### Check 5 — Stale Rename References ✅

Scanned all 63 docs (excluding session-log.md and AUDIT files) for references to old filenames (`interface-designer.md`, `claude.md`, `gaps/tables-interface-boundaries.md`) outside of reconciliation notes. **Zero stale rename references in body text.** All remaining old-name references are correctly inside reconciliation notes documenting the rename history.

---

## Excluded from Findings (Correctly Contextualized)

| Source                          | Reference                                                                   | Reason Excluded                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `AUDIT-STEP-2-FINDINGS.md` (×6) | `claude.md`, `interface-designer.md`, `gaps/tables-interface-boundaries.md` | Audit findings doc — documents ghost references, not a live cross-ref                  |
| `MANIFEST.md` Known Issues (×6) | `interface-designer.md`, `claude.md`, `gaps/tables-interface-boundaries.md` | All in resolved (strikethrough) Known Issues section                                   |
| `session-log.md` (×3)           | `claude.md`                                                                 | Historical doc — excluded from all checks                                              |
| `app-designer.md:18`            | `interface-designer.md`                                                     | Inside reconciliation note: "Renamed file `interface-designer.md` → `app-designer.md`" |
| `bulk-operations.md:12`         | `gaps/tables-interface-boundaries.md`                                       | Inside reconciliation note: "file renamed to align with glossary"                      |
| `record-templates.md:5`         | `interface-designer.md`                                                     | Inside reconciliation note: "Fixed stale cross-reference"                              |
| `data-model.md:174`             | `portals.md` §Quick Portal → App Portal Conversion                          | Heading is "Quick Portal → App Portal Conversion (Post-MVP)" — match within tolerance  |

---

## Files Modified

| File              | Changes                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `GLOSSARY.md`     | Lines 635–640: Six § references corrected to match actual section headings                |
| `data-model.md`   | Line 99: §mergeTag node → §Custom EveryStack Node Definitions                             |
| `data-model.md`   | Line 165: §Tenant Creation → §Tenant Management API; §Platform-level keys → §Platform API |
| `platform-api.md` | Line 801: §Portal Access → §`portal_access` Table                                         |
| `platform-api.md` | Line 819: §mergeTag node → §Custom EveryStack Node Definitions                            |
| `MANIFEST.md`     | Not modified — all changes were character-level, line counts unchanged                    |

---

## Verification Commands

```bash
tar xzf everystack-post-step4-fixed.tar.gz

# Verify GLOSSARY quota table references updated
sed -n '633,644p' GLOSSARY.md

# Verify data-model.md fixes
grep "Custom EveryStack Node Definitions" data-model.md
grep "Tenant Management API" data-model.md

# Verify platform-api.md fixes
grep "portal_access.*Table" platform-api.md
grep "Custom EveryStack Node Definitions" platform-api.md

# Verify no stale § references remain
grep -rn "§Plan-Based Record Quotas\|§Credit Allocation\|§Plan Limits\|§mergeTag node\|§Tenant Creation\|§Portal Access\|§Platform-level keys" *.md gaps/*.md | grep -v AUDIT | grep -v session-log
```
