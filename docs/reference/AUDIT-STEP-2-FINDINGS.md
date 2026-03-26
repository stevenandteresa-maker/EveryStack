# Audit Step 2 — MANIFEST Integrity: Findings

**Date:** 2026-03-01  
**Auditor:** Claude (per DOCUMENTATION-AUDIT-PLAN.md, Step 2)  
**Source tarball:** `everystack-post-step1-fixed_tar.gz`  
**Output tarball:** `everystack-post-step2-fixed.tar.gz`

---

## Executive Summary

MANIFEST.md is structurally sound. File existence, scope map accuracy, dependency claims, and Known Issues resolutions all check out. Three categories of issues were found and fixed in the output tarball:

1. **One description mismatch** (Critical): audit-log.md table entry said "Six-source" but the doc and MANIFEST header both said seven-source. Fixed.
2. **Systematic line count drift** (Moderate): All 34 files with delta > 5 were consistently _larger_ than MANIFEST claimed — caused by reconciliation notes added during the 2026-02-27/28 sweep. All counts updated.
3. **Two docs missing from Scope Map** (Moderate): `formula-engine.md` and `mobile-navigation-rewrite.md` were in the MANIFEST tables but absent from the Reference Doc Scope Map. Added.

---

## Findings Table

| #   | MANIFEST Line              | File                              | Issue                                                                                                                                                                                                                    | Severity          | Fix Applied                                                                                                                                            |
| --- | -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | §Permissions & Audit table | `audit-log.md`                    | Table entry says "Six-source attribution" but doc has 7 actor_types (added `api_key` + `actor_label`). MANIFEST header reconciliation note already acknowledged the update but the table row was never corrected.        | **Critical**      | Updated to "Seven-source attribution (user/sync/automation/portal_client/agent/system/api_key)" and added `actor_label` + `platform-api.md` cross-ref. |
| 2   | All table rows             | 34 files                          | Line counts in MANIFEST are all lower than actual. Consistent pattern: every doc grew by 7–62 lines due to reconciliation notes added during the 2026-02-27/28 audit sweep. MANIFEST was not refreshed afterward.        | **Moderate**      | All line counts updated to match `wc -l` actuals. Largest deltas: `data-model.md` (+62), `app-designer.md` (+45), `permissions.md` (+40).              |
| 3   | §Meta table                | `GLOSSARY.md`                     | MANIFEST says 775 lines, actual is 876 (+101). Step 1 fixes expanded the glossary significantly.                                                                                                                         | **Moderate**      | Updated to 876.                                                                                                                                        |
| 4   | §Reference Doc Scope Map   | `formula-engine.md`               | Listed in MANIFEST table (Post-MVP — Advanced Views & Workflows) and cross-referenced by 5 docs, but missing from the Scope Map section. Claude Code building Post-MVP — Verticals & Advanced would not know to load it. | **Moderate**      | Added to Post-MVP — Verticals & Advanced scope.                                                                                                        |
| 5   | §Reference Doc Scope Map   | `mobile-navigation-rewrite.md`    | Listed in MANIFEST table (MVP — Draft) and cross-referenced by `meetings.md`, but missing from the Scope Map section.                                                                                                    | **Low**           | Added to MVP — Core UX scope.                                                                                                                          |
| 6   | §Reference Doc Scope Map   | `session-log.md`                  | Not in Scope Map.                                                                                                                                                                                                        | **No fix needed** | Historical doc; not a buildable scope target. Correct to omit.                                                                                         |
| 7   | §Reference Doc Scope Map   | `gaps/portals-client-auth.md`     | Not in Scope Map.                                                                                                                                                                                                        | **No fix needed** | Status: MERGED into `app-designer.md`. Not active. Correct to omit.                                                                                    |
| 8   | §Reference Doc Scope Map   | `gaps/tables-views-boundaries.md` | Not in Scope Map.                                                                                                                                                                                                        | **No fix needed** | Status: SUPERSEDED. Not active. Correct to omit.                                                                                                       |

---

## Check-by-Check Results

Covers Check 1 — File Existence ✅, Check 2 — Scope Map Accuracy ✅ (after fixes), Check 3 — Description Accuracy ✅ (after fix), Check 4 — Line Counts ✅ (after fix), Check 5 — Dependency Claims ✅, Manifest Statistics ✅.
See `claude.md`, `interface-designer.md`, `session-log.md`.

### Check 1 — File Existence ✅

Every file listed in the MANIFEST document tables exists in the tarball. Every file in the tarball appears in MANIFEST. The three "ghost" names found in the raw text (`claude.md`, `interface-designer.md`, `gaps/tables-interface-boundaries.md`) are all properly contextualized:

- `claude.md` — explicitly noted as the repo root CLAUDE.md, not a reference doc
- `interface-designer.md` — appears only in Known Issues (marked resolved) and reconciliation contexts
- `gaps/tables-interface-boundaries.md` — appears only in Known Issues (marked resolved) and reconciliation contexts

**Verdict:** Pass.

### Check 2 — Scope Map Accuracy ✅ (after fixes)

All scope map entries reference real files. Two active docs were missing from the map (findings #4 and #5 above). After fixes, all active reference docs appear in at least one scope entry. Three intentional omissions: `session-log.md` (historical), `gaps/portals-client-auth.md` (merged), `gaps/tables-views-boundaries.md` (superseded).

**Verdict:** Pass after fix.

### Check 3 — Description Accuracy ✅ (after fix)

Spot-checked 13 specific claims across 7 files. All matched reality except the audit-log.md "Six-source" → "Seven-source" mismatch (finding #1). Key verifications:

- `permissions.md`: All 5 roles present (Owner/Admin/Manager/Team Member/Viewer) ✓
- `design-system.md`: "always-dark sidebar" confirmed ✓
- `sync-engine.md`: FieldTypeRegistry present ✓
- `forms.md`: Cloudflare Turnstile present ✓
- `data-model.md`: canonical_data JSONB confirmed ✓
- `audit-log.md`: 7 actor_types confirmed (user/sync/automation/portal_client/agent/system/api_key) ✓

**Verdict:** Pass after fix.

### Check 4 — Line Counts ✅ (after fix)

34 of 61 docs had line counts exceeding MANIFEST claims by more than 5 lines. Pattern is completely consistent: every delta is positive (files grew), caused by reconciliation notes added during the 2026-02-27/28 audit pass. All counts updated in the output tarball.

27 files were already within tolerance (≤5 line delta).

**Verdict:** Pass after fix.

### Check 5 — Dependency Claims ✅

All cross-reference pairs spot-checked are bidirectional:

- `data-model.md` ↔ `sync-engine.md` ✓
- `permissions.md` ↔ `data-model.md` ✓
- `cross-linking.md` ↔ `permissions.md` ✓
- `platform-api.md` ↔ `data-model.md` ✓

Known Issues section: All 5 items are marked resolved with strikethrough, and independent verification confirms the stale references are gone from body text (only appear in reconciliation note contexts).

**Verdict:** Pass.

### Manifest Statistics ✅

- Total docs: 63 (59 main + 4 gap) — confirmed: 57 reference + 1 historical + 1 meta = 59 main; 4 gap docs.
- MVP-relevant, Post-MVP, Historical, Meta counts consistent with table assignments.

**Verdict:** Pass.

---

## Fixes Applied in Output Tarball

Only `MANIFEST.md` was modified. No reference docs were changed.

1. Updated audit-log.md table entry: "Six-source" → "Seven-source", added `actor_label` mention and `platform-api.md` cross-ref
2. Updated all 61 doc line counts to match actual `wc -l` values
3. Updated GLOSSARY.md line count from 775 → 876
4. Added `formula-engine.md` to Post-MVP — Verticals & Advanced in Scope Map
5. Added `mobile-navigation-rewrite.md` to MVP — Core UX in Scope Map

---

## Recommendations Before Step 3

No blockers for proceeding. The fixes above are all in-MANIFEST corrections — no reference doc content was changed. Step 3 (Terminology Discipline) can proceed immediately against this output tarball.

---

## How to Verify

```bash
# Extract the output tarball
tar xzf everystack-post-step2-fixed.tar.gz

# Verify audit-log description fix
grep -n "Seven-source" MANIFEST.md

# Verify no line count deltas > 5
python3 -c "
import re, os
with open('MANIFEST.md') as f: m = f.read()
for match in re.finditer(r'\| \x60((?:gaps/)?[a-z][-a-z0-9]*\.md)\x60 \| (\d+) \|', m):
    fn, cl = match.group(1), int(match.group(2))
    if os.path.exists(fn):
        al = sum(1 for _ in open(fn))
        if abs(al - cl) > 5: print(f'MISMATCH: {fn} claims {cl}, actual {al}')
print('Done')
"

# Verify formula-engine in scope map
grep "formula-engine" MANIFEST.md | grep -i "scope map\|Verticals"

# Verify mobile-navigation-rewrite in scope map
grep "mobile-navigation-rewrite" MANIFEST.md | grep -i "core ux"
```
