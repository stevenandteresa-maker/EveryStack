# UX/UI Conventions Audit

**Date:** 2026-03-03
**Scope:** Design system and UI code — all phases through Phase 1E
**Branch:** `feat/phase-1e-testing-infrastructure`
**Result:** 4 conventions followed, 2 deviations found, 8 not yet applicable, 7 foundation gaps

---

## Current State Summary

The codebase is at **Phase 1E (Testing Infrastructure)**. Phases 1A–1E are backend/infrastructure only. **No UI/design system work has been done.** The `apps/web/src/components/` directory is empty (only `.gitkeep`). There is no Tailwind CSS, no shadcn/ui, no CSS variables, no fonts, and no Zustand/TanStack Query/Virtual installed.

The only user-facing file is `apps/web/src/app/global-error.tsx` (Sentry error boundary) and a stub home page (`<h1>EveryStack is running.</h1>`).

---

## Conventions Followed

1. **File naming (kebab-case)** — All source files across the codebase use kebab-case consistently: `auth-context.ts`, `tenant-resolver.ts`, `pino-http.ts`, `job-wrapper.ts`, `check-role.ts`, `pii-registry.ts`, all 50 schema files, all test files. Zero deviations found.

2. **Export naming (PascalCase for types, camelCase for functions)** — Types like `AuthContext`, `ClerkUserEventData`, `ClerkWebhookEvent` are PascalCase. Functions like `resolveUser()`, `resolveTenant()`, `getAuthContext()` are camelCase. Database columns are snake_case. Constants like `PLATFORM_CSP`, `PORTAL_CSP` are SCREAMING_SNAKE_CASE.

3. **Test file naming patterns** — Unit tests use `[source].test.ts` (e.g., `errors.test.ts`, `roles.test.ts`). Integration tests use `[feature].integration.test.ts` (e.g., `auth-flow.integration.test.ts`, `webhook-user-created.integration.test.ts`). E2E directory exists at `apps/web/e2e/` (placeholder). All patterns match the skill spec.

4. **Component file organization (what exists)** — The `apps/web/src/components/` directory is empty, which is correct for Phase 1E. No components have been placed in unexpected locations. The `apps/web/src/lib/` directory correctly holds non-component utilities (auth, errors, tenant resolution).

---

## Deviations Found

### 1. Global Error Boundary — Inline Styles Instead of Tailwind

- **What the skill says:** Use Tailwind spacing utilities (`p-4`, `gap-6`, etc.). Base spacing unit is 4px. All UI uses Tailwind + CSS custom properties.
- **What the code does:** `global-error.tsx` uses inline `style={{}}` objects throughout (lines 31–79) with hardcoded pixel values, hex colors (`#666`, `#999`, `#0f766e`, `#374151`), and `fontFamily: 'system-ui, sans-serif'` instead of DM Sans.
- **Where:** `apps/web/src/app/global-error.tsx` (lines 31–79)
- **Risk level:** LOW — This is a Sentry error boundary that renders when the app itself fails. It intentionally avoids dependencies on the styling system so it can render even if CSS loading fails. However, the hardcoded teal color (`#0f766e`) couples it to a specific theme.
- **Suggested fix:** Keep inline styles (valid for error boundaries) but replace hardcoded teal with a neutral color. Add a code comment explaining why inline styles are used here.

### 2. Global Error Boundary — Hardcoded English Strings

- **What the skill says:** (From CLAUDE.md) No hardcoded English strings — all user-facing text through i18n.
- **What the code does:** Contains 5 hardcoded English strings: "Something went wrong" (line 43), "An unexpected error occurred..." (line 47), "Error Reference:" (line 51), "Try Again" (line 67), "Report Issue" (line 81).
- **Where:** `apps/web/src/app/global-error.tsx` (lines 43, 47, 51, 67, 81)
- **Risk level:** LOW — Error boundaries are a known i18n edge case. If the app fails to load, the i18n system may also be unavailable. These strings are acceptable as fallbacks but should eventually have i18n equivalents with the hardcoded strings as fallbacks.
- **Suggested fix:** Once i18n is set up, wrap these in a try/catch that attempts i18n lookup and falls back to the hardcoded English.

---

## Not Yet Applicable

These conventions describe Phase 3+ features that haven't been built yet. This is expected.

1. **Progressive disclosure (Simple Mode / Power Mode)** — Ships with Phase 3 features (Grid toolbar, Record View, Forms). No features exist to apply this to yet.

2. **View rendering patterns (Grid View)** — Virtual scrolling, cell renderers per field type, inline editing, column resizing. Ships in Phase 3A.

3. **View rendering patterns (Card View)** — Responsive card grid, record preview, click-to-open overlay. Ships in Phase 3B.

4. **Record View overlay** — Right-panel slide-in, field editing, activity feed, tab bar. Ships in Phase 3C.

5. **TipTap editor environments** — Chat editor (communications) and Smart Doc editor (documents). Ships in Phase 3G (communications) and Phase 3F (documents).

6. **E2E test patterns (Playwright)** — Feature-area spec files, workspace fixtures, mobile viewport tests. Ships incrementally with Phase 3 features. Playwright is not yet configured.

7. **Responsive / mobile-safe patterns** — Responsive Tailwind classes, mobile stacking. Ships with Phase 3 components. Phase 3H adds mobile-specific navigation.

8. **Accessibility patterns on components** — Focus indicators, `aria-label` on icon-only buttons, focus trapping in modals. Ships with Phase 3 component builds. (Note: the shadcn/ui primitives include these by default once installed.)

---

## Foundation Gaps

These are things the UX/UI skill assumes exist as foundations for Phase 3. **None of them have been built.** Each is automatically HIGH risk because every Phase 3 component will depend on them.

### Gap 1 — Tailwind CSS Not Installed

- **What Phase 3 assumes:** Tailwind is available for all styling (`p-4`, `gap-6`, `text-sm`, `grid-cols-1 md:grid-cols-2`, responsive utilities, etc.)
- **What exists:** No `tailwind.config.ts`, no `postcss.config.js`, no Tailwind in `package.json` dependencies.
- **Impact:** Every Phase 3 component cannot be built until this is set up.
- **Files missing:** `apps/web/tailwind.config.ts`, `apps/web/postcss.config.js`
- **Dependencies missing:** `tailwindcss`, `postcss`, `autoprefixer` in `apps/web/package.json`

### Gap 2 — Global CSS / CSS Variables Not Created

- **What Phase 3 assumes:** CSS variables for workspace theme (`--workspace-primary`, `--workspace-primary-foreground`), semantic colors (`--destructive`, `--warning`, `--success`), surface colors (`--sidebar-bg`, `--content-bg`), and data palette colors exist.
- **What exists:** No `globals.css` file. No CSS files anywhere in the app.
- **Impact:** The three-layer color architecture has no implementation. Components cannot reference theme colors.
- **Files missing:** `apps/web/src/app/globals.css`

### Gap 3 — shadcn/ui Not Installed

- **What Phase 3 assumes:** shadcn/ui primitives (Button, Dialog, Input, DropdownMenu, Tooltip, Select, Card, Tabs, Badge, etc.) are available for composition.
- **What exists:** No `components.json` config. No shadcn/ui in dependencies. `apps/web/src/components/ui/` does not exist.
- **Impact:** Every Phase 3 component that uses a button, input, dialog, or dropdown cannot be built.
- **Files missing:** `apps/web/components.json`, entire `apps/web/src/components/ui/` directory

### Gap 4 — Fonts Not Configured

- **What Phase 3 assumes:** DM Sans is the UI font, JetBrains Mono is the code/monospace font. Available via Tailwind's `font-sans` and `font-mono` utilities.
- **What exists:** No `next/font` imports. No font loading in `layout.tsx`. The error boundary falls back to `system-ui, sans-serif`.
- **Impact:** All Phase 3 UI will render in the browser's default font instead of DM Sans.
- **Files to update:** `apps/web/src/app/layout.tsx` (add `next/font/google` imports)

### Gap 5 — Tailwind Theme Not Configured for Three-Layer Color Architecture

- **What Phase 3 assumes:** Tailwind config extends the default theme with workspace accent colors (8 presets), semantic UI colors, and data palette colors. Classes like `bg-workspace-primary`, `text-destructive`, `text-success` work.
- **What exists:** No Tailwind config file at all.
- **Impact:** The three-layer color separation that prevents layer mixing cannot be enforced at the tooling level.
- **Files missing:** Custom color definitions in `apps/web/tailwind.config.ts`

### Gap 6 — No State Management Libraries

- **What Phase 3 assumes:** Zustand for client state (sidebar collapse, active widget, grid selection), TanStack Query for server state caching (records, views, fields), TanStack Virtual for grid virtualization.
- **What exists:** None of these are in `package.json`. No stores, no query client, no virtualization.
- **Impact:** Phase 3 Grid View, sidebar, and all data-fetching components have no state management foundation.
- **Dependencies missing:** `zustand`, `@tanstack/react-query`, `@tanstack/react-virtual`, `@tanstack/react-table`

### Gap 7 — i18n Framework Not Set Up

- **What Phase 3 assumes:** All user-facing strings go through i18n. Translation files exist in a locale directory. A framework (next-intl or similar) provides `useTranslations()` hooks.
- **What exists:** `scripts/check-i18n.ts` is a stub that always passes (contains `TODO: Replace stub with real hardcoded-string detection`). No i18n framework installed. No locale files.
- **Impact:** Every Phase 3 component will either hardcode English strings (violating CLAUDE.md) or block on i18n setup.

---

## MEMORY.md Discrepancy

MEMORY.md contains notes that don't match the current codebase state:

- *"shadcn/ui: 16 components installed, semantic colors mapped to Obsidian Teal tokens in tailwind config"* — **Not true on this branch.** No shadcn/ui components exist. No tailwind config exists.
- *"Tailwind: v3.4 (not v4) — uses traditional tailwind.config.ts approach"* — **No tailwind.config.ts found on this branch.**
- *"Grid shell built (TanStack Table + Virtual), shell redesign complete"* — **No grid or shell components on this branch.** Components directory is empty.
- *"New files (16): table-tabs.tsx, view-tabs.tsx..."* — **None of these files exist on this branch.**

These notes likely reference work from a different branch (`phase3/grid-core` per MEMORY.md, merged to main at `da1ed58`) that is not present on the current `feat/phase-1e-testing-infrastructure` branch. The MEMORY.md should be updated to clarify which branch these notes apply to.

---

## Summary

**Overall health: The backend foundation is excellent. The frontend foundation does not exist yet.**

Phases 1A–1E delivered solid infrastructure: strict TypeScript, 50-table Drizzle schema, Clerk auth with tenant isolation, Pino logging with trace propagation, comprehensive test factories, and security headers. Code conventions (naming, async/await, no-any, no-console) are followed with near-perfect consistency.

However, **all 7 foundation gaps are blockers for Phase 3**. No Tailwind, no shadcn/ui, no fonts, no CSS variables, no state management, and no i18n framework means Phase 3 cannot start until a design system setup phase is completed. This was likely planned as a separate phase (the skill references "Phase 1C — Design System" but the phase-context shows Phase 1C was actually "Auth & Tenant Isolation"). **A dedicated design system setup sprint should precede any Phase 3 work.**

The two deviations found (inline styles and hardcoded English in the error boundary) are both LOW risk since error boundaries intentionally avoid app dependencies. They should be noted but not block progress.
