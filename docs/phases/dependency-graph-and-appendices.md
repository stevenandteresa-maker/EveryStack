# EveryStack — Dependency Graph & Appendices

> Generated: 2026-03-02; Updated: 2026-03-05 (CP-001/CP-002 cascade: +1J sub-phase, schema counts, 3C two-thread model, 3E-i portal scope expansion, 3G-ii per-tenant My Office)
> Input: 5 phase division files + `dependency-map.md` + `phase-extraction-notes.json` + `docs/changes/CP-IMPACT-MAP.md`
> Total sub-phases: **35**
> Total estimated prompts: **346**

## Section Index

| Section | Lines | Summary |
|---------|-------|---------|
| Master Dependency Graph | 22–197 | Per-phase DAG of all 35 sub-phases with unlock and dependency edges |
| Critical Path | 199–265 | Earliest-start computation, project-wide and Phase 6 critical path chains |
| Parallel Tracks | 267–352 | Ten named execution tracks (A--J) with maximum parallelism windows |
| Appendix A: Reference Doc Loading Summary | 354–438 | Per-doc line-range assignments to sub-phases and unreferenced doc inventory |
| Appendix B: Post-MVP Exclusion Checklist | 440–477 | Enumerated post-MVP features that must not appear in any sub-phase Includes |
| Appendix C: Cross-Cutting Concerns Registry | 479–500 | Eleven cross-cutting concerns with establishment points and inheritance chains |
| Validation Summary | 502–514 | Verification that all sub-phases, critical paths, and exclusions are accounted for |

---

## Master Dependency Graph

Directed acyclic graph of all 35 MVP sub-phases across Phases 1--6 with dependency and unlock edges. Covers Foundation, Sync, Core UX, Automations, AI, and API. Source: five phase-division files plus CP-001/CP-002 impact map.

### Phase 1: Foundation (10 sub-phases, ~86 prompts)

```
1A (Monorepo, CI Pipeline, Dev Environment)
  → depends on: —
  → unlocks: 1B, 1C, 1D, 1E, 1F, 1G, 1H, 1I

1B (Database Schema, Connection Pooling, Tenant Routing)
  → depends on: 1A
  → unlocks: 1C, 1D, 1E, 1G, 1H, 1I, Phase 2

1C (Authentication, Tenant Isolation, Workspace Roles)
  → depends on: 1A, 1B
  → unlocks: 1G, 1I, Phase 2, Phase 3

1D (Observability, Security Hardening)
  → depends on: 1A, 1B
  → unlocks: 1G, 1H, 1I, Phase 2, Phase 3

1E (Testing Infrastructure)
  → depends on: 1A, 1B, 1C
  → unlocks: All subsequent sub-phases (test utilities available)

1F (Design System Foundation)
  → depends on: 1A
  → unlocks: 1J, 1G, 1H, 2B, Phase 3 (every UI component)

1G (Runtime Services: Real-Time, Worker, File Upload)
  → depends on: 1A, 1B, 1C, 1D
  → unlocks: Phase 2, Phase 3

1H (AI Service Layer)
  → depends on: 1A, 1B, 1D
  → unlocks: 3B-ii, 5A, Phase 3 (Command Bar AI)

1I (Audit Log Helper, Platform API Auth Skeleton)
  → depends on: 1A, 1B, 1C, 1D
  → unlocks: Phase 2 (audit helper), Phase 3, Phase 6

1J (CP Migration, Multi-Tenant Auth & Navigation Shell)
  → depends on: 1A, 1B, 1C, 1F
  → parallel with: 1I (no dependency)
  → unlocks: Phase 2 (correct multi-tenant foundation), all Phase 3 sub-phases (Core UX renders inside sidebar tree)
```

### Phase 2: Sync (3 sub-phases, 36 prompts)

```
2A (FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter)
  → depends on: 1A, 1B, 1C, 1D, 1E, 1G
  → unlocks: 2B, 2C, 3A-i, 4A, 5A

2B (Synced Data Performance, Outbound Sync, Conflict Resolution)
  → depends on: 2A, 1F, 1G, 1I
  → unlocks: 2C, 3A-i

2C (Notion Adapter, Error Recovery, Sync Dashboard)
  → depends on: 2A, 2B, 1F, 1G
  → unlocks: Phase 3 (full sync operational with 2 platform adapters)
```

### Phase 3 — First Half: Core UX (7 sub-phases, 82 prompts)

```
3A-i (Grid View Core: Layout, Cell Renderers & Inline Editing)
  → depends on: 1A, 1B, 1C, 1F, 2A, 2B
  → unlocks: 3A-ii, 3B-i, 3E-ii, 3F-ii, 3F-iii, 3H-i

3A-ii (View Features, Record View, Card View & Data Import)
  → depends on: 3A-i, 1D, 1F, 1G
  → unlocks: 3A-iii, 3B-i, 3C, 3E-i, 3E-ii, 3F-i, 3F-ii, 3F-iii, 3G, 3H-i

3A-iii (Field-Level Permissions: Model, Resolution & Config UI)
  → depends on: 3A-i, 3A-ii, 1C, 1E, 1G
  → unlocks: 3B-i, 3B-ii, 3C, 3D, 3E-i, 3F-ii, 3F-iii, 6A, 6B

3B-i (Cross-Linking Engine)
  → depends on: 3A-i, 3A-ii, 3A-iii, 2A, 1B, 1I
  → unlocks: 3B-ii, 3D, 3F-ii, 5A, 6A, 6B

3B-ii (Schema Descriptor Service & Command Bar)
  → depends on: 3A-iii, 3B-i, 1H, 1B, 1F
  → unlocks: 3D, 3F-i, 3G, 5A, 5B, 6B

3C (Record Thread, DMs, Notifications & System Email)
  → depends on: 3A-ii, 1J, 1D, 1F, 1G, 1I
  → unlocks: 3E-i, 3G-i, 3G-ii, 3H-ii, 4B

3D (Document Templates & PDF Generation)
  → depends on: 3A-i, 3A-iii, 3B-i, 1F, 1G, 1H
  → unlocks: 4B, 5B
```

### Phase 3 — Second Half: Core UX (9 sub-phases, ~86 prompts)

```
3E-i (Quick Portals: Auth, Record Scoping & Client Management)
  → depends on: 3A-ii, 3A-iii, 3C, 1J, 1B, 1C, 1D, 1F, 1G, 1I
  → unlocks: 3E-ii, 3H

3E-ii (Quick Forms: Builder, Submission Pipeline & Embed)
  → depends on: 3A-i, 3A-ii, 2A, 1B, 1F, 1G
  → unlocks: 3H-i, 4B

3F-i (Field Groups, Per-Field Emphasis & Enhanced Hide/Show Panel)
  → depends on: 3A-i, 3A-ii, 3B-ii, 1F
  → unlocks: 3H-i

3F-ii (Bulk Operations: Selection, Actions, Batch Server Pattern & Undo)
  → depends on: 3A-i, 3A-ii, 3A-iii, 3B-i, 1G, 1I
  → unlocks: 3H-i

3F-iii (Record Templates: CRUD, Template Picker & View Scoping)
  → depends on: 3A-i, 3A-ii, 3A-iii, 1B, 1F
  → unlocks: 3H-i

3G-i (Settings Page & Audit Log UI)
  → depends on: 3C, 3A-ii, 3A-iii, 3B-ii, 1C, 1F, 1G, 1H, 1I
  → unlocks: 3H-ii

3G-ii (My Office, Personal Notes & Quick Panel Expansion)
  → depends on: 3A-ii, 3C, 3B-ii, 1J, 1B, 1F
  → unlocks: 3H-ii

3H-i (Mobile Feature Adaptation: Views, Records, Input & Gestures)
  → depends on: 3A-i, 3A-ii, 3A-iii, 3B-i, 3E-ii, 3F-i, 3F-ii, 3F-iii, 1F
  → unlocks: 3H-ii

3H-ii (Mobile Infrastructure: Navigation, Offline, PWA & Notifications)
  → depends on: 3H-i, 3G-i, 3G-ii, 3C, 3B-ii, 1F, 1G
  → unlocks: — (terminal within Phase 3)
```

### Phase 4: Automations (2 sub-phases, 22 prompts)

```
4A (Trigger System, Execution Engine & Builder UI)
  → depends on: 1A, 1B, 1C, 1D, 1G, 1I, 2A
  → unlocks: 4B, 5B

4B (Action Implementations, Webhooks, Testing & Status Field Governance)
  → depends on: 4A, 3A-i, 3A-ii, 3C, 3D, 3E-ii, 1F, 1G, 1I
  → unlocks: 6A
```

### Phase 5: AI (2 sub-phases, 19 prompts)

```
5A (AI Data Contract Implementations & Context Builder)
  → depends on: 1E, 1H, 2A, 3B-i, 3B-ii
  → unlocks: 5B

5B (User-Facing AI Features & Metering Dashboards)
  → depends on: 5A, 4A, 3A-ii, 3B-ii, 3D, 1F, 1H
  → unlocks: — (terminal within Phase 5)
```

### Phase 6: API (2 sub-phases, 15 prompts)

```
6A (Data API: Record CRUD, Filtering & Batch Operations)
  → depends on: 1B, 1I, 2A, 3A-iii, 3B-i, 4A, 4B
  → unlocks: — (terminal)

6B (Schema API, File Upload API & SDS Endpoint)
  → depends on: 1B, 1G, 1I, 3A-iii, 3B-i, 3B-ii
  → unlocks: — (terminal)
```

**Cycle check: No cycles detected.** All dependencies flow forward — lower-numbered sub-phases never depend on higher-numbered ones. Within Phase 3, the hierarchy is strictly layered: 3A → 3B → {3C, 3D} → {3E, 3F} → 3G → 3H.

---

## Critical Path

Longest dependency chains through the sub-phase DAG, determining overall project duration and Phase 6 availability. Relates to the parallel tracks enumerated in the next section.

The critical path is the longest dependency chain through the DAG. Each sub-phase's earliest start is determined by the longest path to it through its dependencies.

**Earliest-start computation (sub-phase count from 1A):**

| Sub-phase | Earliest Start (step) | Bottleneck Dependency |
|-----------|----------------------|----------------------|
| 1A | 1 | — |
| 1B | 2 | 1A |
| 1C | 3 | 1B |
| 1D | 3 | 1B (parallel with 1C) |
| 1E | 4 | 1C |
| 1F | 2 | 1A (parallel with 1B) |
| 1G | 4 | 1C, 1D (both needed) |
| 1H | 4 | 1D |
| 1I | 4 | 1C, 1D (both needed) |
| 1J | 4 | 1C, 1F (both needed; parallel with 1I) |
| 2A | 5 | 1G |
| 2B | 6 | 2A |
| 2C | 7 | 2B |
| 3A-i | 7 | 2B |
| 3A-ii | 8 | 3A-i |
| 3A-iii | 9 | 3A-ii |
| 3B-i | 10 | 3A-iii |
| 3B-ii | 11 | 3B-i |
| 3C | 9 | 3A-ii |
| 3D | 11 | 3B-i |
| 3E-i | 10 | 3A-iii, 3C (both needed; 1J at step 4 is not the bottleneck) |
| 3E-ii | 9 | 3A-ii |
| 3F-i | **12** | **3B-ii** |
| 3F-ii | 11 | 3B-i |
| 3F-iii | 10 | 3A-iii |
| 3G-i | 12 | 3B-ii (via 3C dep chain) |
| 3G-ii | 12 | 3B-ii (via 3C dep chain) — parallel with 3G-i |
| 3H-i | **13** | **3F-i** |
| 3H-ii | **14** | **3H-i** |
| 4A | 6 | 2A |
| 4B | 12 | 3D |
| 5A | 12 | 3B-ii |
| 5B | 13 | 5A |
| 6A | 13 | 4B |
| 6B | 12 | 3B-ii |

### Critical Path (Project-Wide)

```
1A → 1B → 1C → 1G → 2A → 2B → 3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii → 3F-i → 3H-i → 3H-ii
```

**Length:** 14 sub-phases
**Estimated prompts on critical path:** 152 (8 + 13 + 5 + 9 + 13 + 12 + 12 + 13 + 10 + 12 + 10 + 10 + 11 + 14)

This is the sequence that determines overall project duration. Delay in any of these 14 sub-phases delays the entire project. Note: 3G-i and 3G-ii are both off the critical path (Track D); 3H-ii requires both to complete before starting.

### Critical Path to Phase 6 (API)

```
1A → 1B → 1C → 1G → 2A → 2B → 3A-i → 3A-ii → 3A-iii → 3B-i → 3D → 4B → 6A
```

**Length:** 13 sub-phases
**Estimated prompts:** 143 (8 + 13 + 5 + 9 + 13 + 12 + 12 + 13 + 10 + 12 + 10 + 10 + 9 + 9)

---

## Parallel Tracks

Ten named execution tracks identifying sub-phases that can run concurrently with the critical path. Used for scheduling and resource allocation across build sessions. Relates to the critical path analysis above and the dependency graph at the top of this document.

These sub-phases can proceed independently of the critical path, given their dependencies are met:

### Track A — Critical Path (14 sub-phases)
```
1A → 1B → 1C → 1G → 2A → 2B → 3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii → 3F-i → 3H-i → 3H-ii
```

### Track B — Infrastructure (parallel during Phase 1)
```
After 1A:  1F (Design System) — no dependency on 1B
After 1B:  1D (Observability) — parallel with 1C
After 1C:  1E (Testing) — parallel with 1G
After 1D:  1H (AI Service) — parallel with 1G, 1I
After 1C+1D: 1I (Audit/API Auth) — parallel with 1G
After 1C+1F: 1J (CP Migration + Nav Shell) — parallel with 1I
```
These 6 sub-phases (1D, 1E, 1F, 1H, 1I, 1J) run alongside the critical path. 1J depends on 1C+1F (both already merged) and completes at step 5, well before any Phase 3 sub-phase starts.

### Track C — Sync Completion (off critical path after 2B)
```
2B → 2C (Notion + Error Recovery + Dashboard)
```
2C extends from the critical path at 2B but doesn't block any Phase 3 sub-phase that isn't also blocked by 2B. 2C can run in parallel with 3A-i.

### Track D — Communications & Settings (branches at 3A-ii)
```
3A-ii → 3C (Communications) → 3G-i (Settings/Audit) → 3H-ii
                             → 3G-ii (My Office/Notes) → 3H-ii
```
3C branches off the critical path at step 8 (3A-ii). Both 3G-i and 3G-ii depend on 3B-ii from the critical path (step 11) and can start in parallel once 3C completes. 3G-i (11 prompts) and 3G-ii (12 prompts) run parallel to each other. This track merges back at 3H-ii, which requires both 3G-i and 3G-ii to complete.

### Track E — Documents (branches at 3B-i)
```
3B-i → 3D (Documents) → 4B (Automation Actions)
```
3D branches off the critical path at step 10 (3B-i). 4B additionally needs 4A, 3C, 3E-ii.

### Track F — Automations & API (branches at 2A and 3D)
```
2A → 4A (Triggers/Engine) → 4B → 6A (Data API)
```
4A can start as early as step 6 (after 2A), but 4B is gated on 3D (step 11). 6A follows at step 13.

### Track G — AI Features (branches at 3B-ii)
```
3B-ii → 5A (AI Data Contract) → 5B (AI Features)
```
5A starts at step 12 (after 3B-ii). 5B additionally needs 4A. 5B completes at step 13.

### Track H — Schema API (branches at 3B-ii)
```
3B-ii → 6B (Schema API + File Upload)
```
6B can start at step 12, parallel with 5A, 3F-i, and 3G.

### Track I — Portals & Forms (branches at 3A-ii / 3A-iii)
```
3A-iii → 3E-i (Portals)
3A-ii  → 3E-ii (Forms) → 3H-i
```
Portals and Forms are independent of each other and run parallel with the critical path through 3B-i → 3B-ii → 3F-i.

### Track J — Bulk Ops & Templates (branches at 3A-iii / 3B-i)
```
3B-i   → 3F-ii (Bulk Operations) → 3H-i
3A-iii → 3F-iii (Record Templates) → 3H-i
```
Both feed into 3H-i but are shorter than the critical path through 3F-i.

### Maximum Parallelism Windows

| After Step | Sub-phases that can run concurrently |
|------------|-------------------------------------|
| After 1B (step 2) | 1C, 1D, 1F (3 parallel) |
| After 1C+1D (step 3–4) | 1E, 1G, 1H, 1I, 1J (5 parallel) |
| After 2B (step 6) | 2C, 3A-i (2 parallel) |
| After 3A-iii (step 9) | 3E-i, 3E-ii, 3F-iii (3 parallel, plus 3B-i on critical path) |
| After 3B-i (step 10) | 3D, 3F-ii, 4A (3 parallel, plus 3B-ii on critical path) |
| After 3B-ii (step 11) | 3F-i, 3G-i, 3G-ii, 5A, 6B (5 parallel) |
| After 3F-i + others (step 12) | 3H-i, 4B, 5B (gated by different deps) |

---

## Appendix A: Reference Doc Loading Summary

Per-document inventory of line-range assignments to MVP sub-phases, plus a list of documents not referenced by any sub-phase (post-MVP, operational, or meta-documents). Used by the Planner Agent for context manifest curation.

| Document | Total Lines | Sub-phases | Sections Used | Lines Referenced |
|----------|-------------|------------|---------------|-----------------|
| CLAUDE.md | 461 | 1A, 1C | Full doc (context) | ~461 |
| data-model.md | 595 | 1B | Lines 24–574 | ~490 |
| database-scaling.md | 513 | 1B, 2B | Lines 29–222, 486–498 | ~192 |
| cockroachdb-readiness.md | 355 | 1B | Lines 291–331 | ~41 |
| compliance.md | 432 | 1B, 1D | Lines 198–217 (1B), 32–196, 219–243 (1D) | ~185 |
| permissions.md | 475 | 1C, 3A-iii | Lines 43–86, 409–475 (1C); 90–448 (3A-iii) | ~461 |
| observability.md | 173 | 1D | Full doc | ~173 |
| testing.md | 1011 | 1A, 1E | Lines 693–886 (1A); 34–692, 887–1002 (1E) | ~967 |
| design-system.md | 357 | 1F | Full doc | ~357 |
| realtime.md | 220 | 1G | Foundation scaffold portions | ~150 |
| files.md | 340 | 1G | Lines 29–340 | ~312 |
| ai-architecture.md | 376 | 1H, 5A, 5B | Lines 40–250, 366–376 (1H); 182–250, 366–376 (5A); 48–60, 234–241 (5B) | ~296 |
| ai-data-contract.md | 220 | 1H, 5A, 5B | Foundation portions (1H); 60–221 (5A); 152–167 (5B) | ~220 |
| ai-metering.md | 438 | 1H, 5B | Lines 43–212, 304–337, 425–438 (1H); 214–281 (5B) | ~288 |
| audit-log.md | 351 | 1I, 3G-i | Lines 26–151, 181–351 (1I); 152–180 (3G-i) | ~325 |
| platform-api.md | 1172 | 1I, 6A, 6B | Lines 36–272 (1I); 257–459 (6A); 460–603, 1050–1089 (6B) | ~624 |
| vertical-architecture.md | 556 | 1I | Lines 29–472+ (strategy context, read-only) | ~444 |
| navigation.md | ~400 | 1J | Full doc (sidebar tree, tenant switching, contextual clarity, portal display) | ~400 |
| operations.md | 491 | 1A | Scattered (~80 lines) | ~80 |
| sync-engine.md | 1079 | 2A, 2B, 2C | Lines 30–416, 459–513 (2A); 417–458, 514–772 (2B); 488–513, 773–1079 (2C) | ~1079 |
| field-groups.md | 569 | 2C, 3F-i | Lines 276–326 (2C); 35–275, 393–569 (3F-i) | ~469 |
| tables-and-views.md | 842 | 3A-i, 3A-ii | Lines 27–365 (3A-i); 366–842 (3A-ii) | ~796 |
| gaps/tables-views-boundaries.md | 536 | 3A-iii | Lines 20–100 (reference context, not code-generative) | ~80 |
| cross-linking.md | 573 | 3B-i | Lines 31–567 | ~537 |
| schema-descriptor-service.md | 539 | 3B-ii | Lines 45–237 | ~193 |
| command-bar.md | 163 | 3B-ii | Full doc | ~163 |
| communications.md | 458 | 3C | Lines 29–440 | ~412 |
| email.md | 300 | 3C | Lines 10–49 | ~40 |
| smart-docs.md | 421 | 3D | Lines 49–229, 331–414 | ~265 |
| portals.md | 559 | 3E-i | Lines 45–461 (Part 1 only) | ~417 |
| forms.md | 182 | 3E-ii | Full doc | ~182 |
| bulk-operations.md | 571 | 3F-ii | Lines 50–228, 270–532 | ~441 |
| record-templates.md | 863 | 3F-iii | Lines 46–215, 264–437, 803–837 | ~380 |
| settings.md | 113 | 3G-i | Full doc | ~113 |
| my-office.md | 360 | 3G-ii, 3H-ii | Full doc (3G-ii); 279–360 (3H-ii) | ~360 |
| mobile.md | 1232 | 3H-i, 3H-ii | Lines 58–191, 276–384, 739–822 (3H-i); 100–140, 440–641, 901–1213 (3H-ii) | ~890 |
| mobile-navigation-rewrite.md | 550 | 3H-i, 3H-ii | Lines 164–306, 225–236, 361–374 (3H-i); 52–163, 237–267, 375–550 (3H-ii) | ~556 |
| automations.md | 527 | 4A, 4B | Lines 29–318, 448–511 (4A); 179–447 (4B) | ~527 |
| approval-workflows.md | 706 | 4B | Lines 38–144 (Modes 1+2 only) | ~107 |

**Total MVP reference docs:** 39
**Total lines across all reference docs:** ~39,829 (from `phase-extraction-notes.json`)
**Total lines referenced by MVP sub-phases:** ~11,243 (approximate, with some overlap between sub-phases sharing sections)

### Docs NOT Referenced by Any Sub-phase

These documents exist in `docMetadata` but are not assigned to any MVP sub-phase. They are either post-MVP, operational, or meta-documents:

| Document | Total Lines | Reason Not Referenced |
|----------|-------------|---------------------|
| GLOSSARY.md | 876 | Strategy context / glossary (not a build input) |
| MANIFEST.md | 259 | Document index (not a build input) |
| session-log.md | 736 | Historical decision log |
| AUDIT-STEP-{1–10}-FINDINGS.md | 1,482 total | Audit process artifacts |
| accounting-integration.md | 838 | Post-MVP — Accounting Integration |
| agency-features.md | 328 | Post-MVP — Agency Features |
| agent-architecture.md | 636 | Post-MVP — AI Agents |
| ai-field-agents-ref.md | 1,523 | Post-MVP — AI Field Agents |
| app-designer.md | 1,061 | Post-MVP — Portals & Apps |
| booking-scheduling.md | 1,156 | Post-MVP — Portals & Apps (Fast-Follow) |
| chart-blocks.md | 1,446 | Post-MVP (ProgressChart renderer bundled with 3A-i cell renderers) |
| custom-apps.md | 821 | Post-MVP — Custom Apps |
| document-designer.md | 629 | Post-MVP — Documents |
| document-intelligence.md | 727 | Post-MVP (schema stubs in 1B, activation deferred) |
| duckdb-context-layer-ref.md | 935 | Post-MVP — AI Agents |
| embeddable-extensions.md | 882 | Post-MVP — Custom Apps |
| formula-engine.md | 382 | Post-MVP |
| inventory-capabilities.md | 464 | Post-MVP (`adjustFieldValue()` utility in 1B, full feature deferred) |
| meetings.md | 641 | Post-MVP |
| personal-notes-capture.md | 875 | Post-MVP (full Evernote-competitor only — wiki tables, `is_personal` column on `tables`, file-first capture, voice, offline, embedding search; simplified MVP subset defined in GLOSSARY.md and built in 3G-ii; **do NOT load this doc as build context for 3G-ii**) |
| project-management.md | 144 | Post-MVP |
| self-hosted-ai.md | 277 | Post-MVP — Self-Hosted AI |
| vector-embeddings.md | 238 | Post-MVP |
| workspace-map.md | 1,628 | Post-MVP — Verticals & Advanced |
| gaps/automations-execution-triggers-webhooks.md | 689 | Gap doc (content merged into automations.md) |
| gaps/knowledge-base-live-chat-ai.md | 461 | Post-MVP |
| gaps/portals-client-auth.md | 16 | Content merged into app-designer.md |

---

## Appendix B: Post-MVP Exclusion Checklist

Enumerated list of features permanently excluded from all MVP sub-phases with common-trap flags. Sourced from `dependency-map.md` section 5.2 and phase-division Excludes lists.

These features must NOT appear in any sub-phase's "Includes" section. Sourced from `dependency-map.md` §5.2.

- [ ] **Kanban view** — Post-MVP (soon after). Common trap: frequently assumed MVP.
- [ ] **List, Gantt, Calendar, Gallery views** — Post-MVP
- [ ] **Formula engine** — Post-MVP. Common trap: frequently assumed MVP.
- [ ] **Rollups and aggregations** — Post-MVP
- [ ] **AI Agents (autonomous multi-step)** — Post-MVP — AI Agents. Common trap: `agent_sessions` table created in Foundation but runtime is post-MVP.
- [ ] **App Designer (visual page builder)** — Post-MVP — Portals & Apps. Common trap: confused with MVP Quick Portals/Forms.
- [ ] **Custom Apps (POS, websites, internal apps)** — Post-MVP — Custom Apps
- [ ] **Visual automation canvas (branching, conditions)** — Post-MVP — Automations. Common trap: MVP uses step-by-step list builder only.
- [ ] **Full-featured portals (multi-page, multi-record)** — Post-MVP — Portals & Apps
- [ ] **Self-hosted AI / data residency** — Post-MVP — Self-Hosted AI
- [ ] **DuckDB analytical layer** — Post-MVP — AI Agents
- [ ] **Vector embeddings / semantic search** — Post-MVP
- [ ] **Booking / Scheduling** — Post-MVP — Portals & Apps (Fast-Follow)
- [ ] **Approval workflows Mode 3 (approval chains)** — Post-MVP — Automations. Note: Modes 1+2 (status transition governance) ARE MVP in 4B.
- [ ] **Personal Notes — full Evernote competitor** (workspace-scoped personal tables, file-first capture, voice, offline/IndexedDB, embedding search, web clipper, ENEX import) — Post-MVP. Note: **Personal Notes (simplified MVP)** — text-only `user_notes` scratchpad across 4 surfaces — IS in MVP scope, built in 3G-ii. Do not confuse with the full spec in `personal-notes-capture.md`.
- [ ] **Wiki / Knowledge Base** — Post-MVP
- [ ] **Full communications hub (omnichannel)** — Post-MVP — Comms & Polish
- [ ] **Workspace Map** — Post-MVP — Verticals & Advanced
- [ ] **Time tracking, asset library, ad platforms** — Post-MVP — Agency Features
- [ ] **Commerce embeds, live chat widget** — Post-MVP — Custom Apps
- [ ] **Document App type (canvas → PDF)** — Post-MVP — Documents
- [ ] **MCP Server/Client** — Post-MVP
- [ ] **Provider Evaluation Framework** — Post-MVP
- [ ] **Smart Doc field type** — Post-MVP
- [ ] **Smart Doc co-editing (Hocuspocus)** — Post-MVP
- [ ] **Connected inbox / outbound CRM email** — Post-MVP
- [ ] **Portal themes / custom domains** — Post-MVP
- [ ] **SAML SSO / SCIM provisioning** — Post-MVP (Enterprise)
- [ ] **Agency Console** — Post-MVP (CP-002 decision: `/agency` route, "Acting as Agency" banner, workspace transfer UI, white-label mode, agency onboarding all deferred; `tenant_relationships` table + `effective_memberships` view created in 1J as forward-infrastructure)
- [ ] **CockroachDB regional routing** — Post-MVP (Enterprise)

---

## Appendix C: Cross-Cutting Concerns Registry

Eleven cross-cutting concerns (tenant isolation, FieldTypeRegistry, canonical JSONB, etc.) with their establishment sub-phase and full inheritance chain. Relates to `CLAUDE.md` Architecture Fundamentals and the phase-division docs.

These concerns are established once and inherited by all downstream sub-phases. Sourced from `dependency-map.md` §3.

| Concern | Established In | Inherited By |
|---------|---------------|-------------|
| **Tenant Isolation** (`tenant_id` on every query, RLS) | 1B (schema), 1C (`getTenantId()`) | All subsequent sub-phases — every DB query, every Server Action, every data function |
| **Environment Column** (`'live'` filter on definition tables) | 1B (schema enforcement) | All sub-phases querying tables, fields, cross_links, views, record_templates, automations, document_templates |
| **Design System Tokens** (Obsidian Teal, DM Sans, spacing) | 1F | All Phase 3+ UI sub-phases: 3A-i through 3H-ii, 4B (builder UI), 5B (AI dashboards), 6B (none — API only) |
| **Permission Model (RBAC)** | 1C (5 workspace roles, `checkRole()`) | All sub-phases requiring auth checks: 2A–2C (sync tenant context), 3A-i+ (all Core UX), 4A–4B, 5B, 6A–6B |
| **Permission Model (Field-Level)** | 3A-iii (full 3-state permissions, resolution algorithm) | 3B-i (cross-link permission resolution), 3B-ii (SDS filtered schema), 3E-i (portal field visibility), 3F-ii (bulk edit field picker), 3G (settings section gating), 5A (AI context filtered), 6A (API field filtering), 6B (schema API filtering) |
| **FieldTypeRegistry** | 2A (registry pattern + ~40 field type registrations) | 3A-i (cell renderers), 3A-ii (Record/Card View), 3B-i (linked record field type), 3D (merge tags), 3E-ii (form validation), 3F-ii (bulk edit), 3F-iii (template validation), 4A (trigger field matching), 5A (`canonicalToAIContext`/`aiToCanonical`), 6A (API canonical formatting) |
| **Canonical JSONB Pattern** (`records.canonical_data`) | 1B (schema), 2A (population via adapters) | All sub-phases reading/writing record data: 3A-i+, 3B-i, 3D, 3E-i, 3E-ii, 4A–4B, 5A, 6A |
| **Error Handling Patterns** (typed errors, error boundary) | 1D (typed error classes, Sentry) | All Server Actions, route handlers, portal endpoints across all phases |
| **i18n** (`t('key')` for all UI strings) | 1A (config), 1F (first UI components) | All UI sub-phases: every component in 3A-i through 3H-ii, 4A–4B (builder UI), 5B (AI dashboards) |
| **AIService Abstraction** (capability tiers, provider adapter) | 1H (skeleton + Anthropic adapter) | 3B-ii (Command Bar NL search), 3D (AI draft wiring), 5A (full data contract), 5B (all AI features) |
| **Audit Trail** (`writeAuditLog()`, seven-source attribution) | 1I (table + helper, `user` + `system` actors) | 2A (sync-originated mutations), 2B (conflict resolution), 3A-iii (denied attempt logging), 3B-i (cross-link mutations), 3C (message deletion), 3E-i (`portal_client` actor), 3F-ii (bulk condensation), 3F-iii (template CRUD), 3G-i (settings changes), 4A–4B (automation execution, `system` actor for status transitions), 6A (`api_key` actor) |
| **Real-Time Event Bus** (Redis pub/sub + Socket.io) | 1G (scaffold, room model) | 2A–2C (sync status push), 3A-ii (multi-user collaboration, grid live updates), 3A-iii (permission invalidation push), 3C (chat message delivery, presence), 3E-i (portal cache invalidation), 3F-ii (batch events), 3G-i (settings push), 3H-ii (mobile notifications), 4B (webhook delivery events) |

---

## Validation Summary

- [x] **Every sub-phase appears in the dependency graph:** 35 sub-phases verified (10 + 3 + 7 + 9 + 2 + 2 + 2)
- [x] **No cycles in the graph:** All dependencies flow forward; no sub-phase depends on a later sub-phase
- [x] **Critical path identified:** 14 sub-phases (1A → 1B → 1C → 1G → 2A → 2B → 3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii → 3F-i → 3H-i → 3H-ii) — unchanged; 1J (step 4) completes before 3A-i (step 7) and does not extend the critical path
- [x] **Critical path to Phase 6:** 13 sub-phases ending at 6A
- [x] **Every MVP reference doc appears in Appendix A:** 39 docs with sub-phase assignments and line ranges (+ navigation.md for 1J)
- [x] **Non-referenced docs flagged:** 27 docs identified as post-MVP, operational, or meta-documents; personal-notes-capture.md updated to reflect simplified MVP in 3G-ii vs full Evernote-competitor spec
- [x] **Post-MVP checklist complete:** 28 excluded features from `dependency-map.md` §5.2 plus additional exclusions from phase division files; Agency Console, "Acting as Agency" banner, workspace transfer UI, white-label mode, agency onboarding added as post-MVP per CP-002 decision
- [x] **Every cross-cutting concern from `dependency-map.md` appears in Appendix C:** 11 concerns with establishment points and inheritance chains; 3G references updated to 3G-i/3G-ii
- [x] **Total sub-phase count matches phase file sums:** 10 + 3 + 7 + 9 + 2 + 2 + 2 = **35**
- [x] **Total prompt estimate:** ~**346** (86 + 36 + 82 + 86 + 22 + 19 + 15)
- [x] **CP-001/CP-002 changes applied:** Schema migration, middleware update, and navigation shell bundled in 1J; 3C thread model updated to two-thread; 3E-i portal scope expanded; 3G-ii My Office per-tenant; 4B portal write-back confirmed; Agency Console deferred to post-MVP
