# Phase 1F — Design System Foundation

## Phase Context

### What Has Been Built

**Phase 1A — Monorepo, CI Pipeline, Dev Environment (complete, merged to main):**
Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI (lint → typecheck → test). ESLint + Prettier config. `tsconfig` strict mode. `.env.example`.

**Phase 1B — Database Schema, Connection Pooling, Tenant Routing (complete, merged to main):**
Drizzle schema for all 50 MVP tables (Tiers 0–7). PgBouncer connection pooling config. `getDbForTenant()` with read/write routing. RLS policies enforcing tenant isolation. UUIDv7 primary key generation. Initial migration files.

**Phase 1C — Authentication, Tenant Isolation, Workspace Roles (complete, merged to main):**
Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities (`checkRole()`, `requireRole()`). `PermissionDeniedError` shape.

**Phase 1D — Observability, Security Hardening (complete, merged to main):**
Pino + `pino-http` structured logging. `traceId` via `AsyncLocalStorage`. Sentry DSN integration. OpenTelemetry basic instrumentation. Security headers middleware. Encryption at rest/in transit config. Webhook signature verification pattern. Typed error classes (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`).

**Phase 1E — Testing Infrastructure (complete, merged to main):**
Vitest workspace config for monorepo. Playwright E2E setup. Test data factories for all core tables. `testTenantIsolation()` helper. Mock Clerk session utilities. MSW mock setup. `docker-compose.test.yml` for CI.

### What This Phase Delivers

A fully tokenized design system foundation that every subsequent UI component in EveryStack will build on. When complete, `apps/web` will have: shadcn/ui primitives installed and themed to the Obsidian Teal identity, a three-layer color architecture (surface tokens, workspace accent, data palette) implemented as CSS custom properties and Tailwind utilities, DM Sans + JetBrains Mono typography, a responsive application shell skeleton (dark sidebar + accent header + white content area), and shared responsive patterns enforcing touch targets and progressive disclosure.

### What This Phase Does NOT Build

- Feature-specific component compositions (Grid view, Card view, Record View — Core UX)
- Chart components or data visualization (post-MVP)
- Portal theming or portal-specific styling (post-MVP)
- Mobile-specific bottom navigation or bottom tab bar (Core UX Phase 3H)
- Widget grid layout for My Office (Core UX)
- Command Bar implementation (Core UX — only the design token placeholders ship here)
- App Designer or any spatial layout tools (post-MVP)
- Dark mode / light mode toggle (EveryStack uses a fixed hybrid appearance)
- Kanban column headers or Calendar event color rules (post-MVP)
- Actual workspace accent color persistence to the database (the `tenants.settings.branding_accent_color` read path ships here; the Settings UI for changing it ships in Core UX)

### Architecture Patterns for This Phase

1. **CSS custom properties as the single source of truth.** All color, spacing, and typography tokens are defined as CSS variables on `:root` in `globals.css`. Tailwind references these variables. Components reference Tailwind classes. No hardcoded hex values in component code.

2. **shadcn/ui primitives, never custom primitives.** All base components (Button, Input, Card, Dialog, Badge, etc.) come from shadcn/ui, customized via Tailwind + CSS custom properties. Complex compositions in later phases compose these primitives — they never replace them.

3. **Three-layer color architecture.** Layer 1 (surface tokens) is fixed and never changes. Layer 2 (workspace accent) is admin-chosen, applied only to the header bar. Layer 3 (data palette) is a 13-color set with light + saturated tones for data visualization. These three layers are independent — changing one never affects the others.

4. **CSS logical properties.** All directional styles use `margin-inline-start` / `padding-block-end` / etc., never `margin-left` / `padding-bottom`. This ensures future RTL language support without refactoring.

5. **Responsive-first.** Every layout component considers three breakpoints: Desktop ≥1440px, Tablet ≥768px, Mobile <768px. Touch targets are minimum 44×44px (WCAG 2.5.8). Loading states use skeleton screens, never spinners.

6. **No hardcoded English strings.** All user-facing text uses `t('key')` i18n. This phase produces structural components with minimal user-facing text, but any labels (tooltip text, aria-labels) must go through i18n.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or CSS tokens. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | Tailwind config, globals.css, font installation, typography + spacing scales | None | ~250 |
| 2 | Surface color tokens + text contrast + process state colors | 1 | ~200 |
| 3 | Workspace accent color system + data color palette | 1 | ~220 |
| CP-1 | Integration Checkpoint 1 (after Prompts 1–3) | 1–3 | — |
| 4 | shadcn/ui CLI initialization + core component installation | 1, 2 | ~180 |
| 5 | Component theme customization (Button, Card, Badge, Input, sidebar nav) | 4 | ~200 |
| 6 | Application shell layout skeleton (sidebar, header, content area) | 2, 3, 5 | ~280 |
| 7 | Responsive architecture + CSS logical properties + touch targets | 6 | ~200 |
| CP-2 | Integration Checkpoint 2 (after Prompts 4–7) | 4–7 | — |
| 8 | Shared responsive patterns + loading skeletons + AI credit display | 5, 7 | ~200 |
| CP-3 | Final Integration Checkpoint (after Prompt 8) | All | — |

---

## Prompt 1: Tailwind Config Foundation, Font Installation, Typography + Spacing Scales

**Depends on:** None (first prompt in phase — but assumes Phase 1A web app scaffold exists)
**Load context:** `design-system.md` lines 44–57 (Foundations), lines 163–188 (Typography Scale + Spacing)
**Target files:**
- `apps/web/tailwind.config.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx` (modify — add font loading)
- `apps/web/src/lib/fonts.ts`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1f-design-system` from `main`. Commit with message `feat(design): tailwind config, font installation, typography and spacing scales [Phase 1F, Prompt 1]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Set up the Tailwind + CSS custom property foundation that the entire design system builds on.**

1. **Font installation.** Create `apps/web/src/lib/fonts.ts` using `next/font/google` to load:
   - **DM Sans** — weights: 400, 500, 600, 700. Variable: `--font-dm-sans`. Used for all UI text and headings.
   - **JetBrains Mono** — weights: 400, 500. Variable: `--font-jetbrains-mono`. Used for code blocks, technical data, monospace contexts.
   
   Export the font objects. In `layout.tsx`, apply both font CSS variables to the `<html>` element's className.

2. **Tailwind config.** In `apps/web/tailwind.config.ts`, extend the theme:
   - `fontFamily`: `sans` → `var(--font-dm-sans)`, `mono` → `var(--font-jetbrains-mono)`
   - `fontSize`: Define the 9-step typography scale as Tailwind utilities. Each maps to a fixed pixel size with appropriate line-height:

     | Tailwind Class | Size | Use |
     |----------------|------|-----|
     | `text-xs` | 11px / 0.6875rem | Timestamps, footnotes |
     | `text-caption` | 12px / 0.75rem | Captions, badges |
     | `text-body-sm` | 13px / 0.8125rem | Body small |
     | `text-body` | 14px / 0.875rem | Body default |
     | `text-body-lg` | 16px / 1rem | Body large, Command Bar input |
     | `text-h3` | 18px / 1.125rem | H3 headings |
     | `text-h2` | 20px / 1.25rem | H2 headings |
     | `text-h1` | 24px / 1.5rem | H1 headings |
     | `text-page-title` | 28px / 1.75rem | Page titles |

     Each entry should include a `lineHeight` value (use 1.5 for body sizes, 1.3 for headings, 1.2 for page titles).

   - `spacing`: Extend with the 4px base unit scale. Add named tokens: `spacing-1` (4px), `spacing-2` (8px), `spacing-3` (12px), `spacing-4` (16px), `spacing-5` (20px), `spacing-6` (24px), `spacing-7` (28px), `spacing-8` (32px), `spacing-10` (40px), `spacing-12` (48px), `spacing-16` (64px).
   - `borderRadius`: `DEFAULT` → 8px, `lg` → 12px, `sm` → 4px (badges).
   - `screens`: Preserve Tailwind's default breakpoints but ensure `md: '768px'` (tablet), `lg: '1024px'`, `xl: '1440px'` (desktop) are explicitly set.

3. **globals.css skeleton.** In `apps/web/src/app/globals.css`, add a `:root` block with placeholder comments for the three color layers (surface, accent, data) — these will be populated in Prompts 2 and 3. Add the base spacing variable: `--spacing-base: 4px`. Import Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`). Add a `@layer base` block that sets `font-family`, `font-size` (14px default), and `line-height` (1.5) on `body`.

4. **No arbitrary sizes.** Add an ESLint rule or a Tailwind config comment documenting: "All text must use one of the 9 typography steps. No arbitrary `text-[17px]` values."

### Acceptance Criteria

- [ ] DM Sans loads at weights 400, 500, 600, 700 — visible in browser dev tools on any page
- [ ] JetBrains Mono loads at weights 400, 500 — visible in browser dev tools when `font-mono` class applied
- [ ] `tailwind.config.ts` exports the 9-step typography scale, 4px spacing scale, and border radius tokens
- [ ] `globals.css` has `:root` block with `--spacing-base: 4px` and placeholder comments for color layers
- [ ] `pnpm turbo typecheck` passes with zero errors
- [ ] `pnpm turbo lint` passes with zero errors
- [ ] Body text renders in DM Sans at 14px by default

### Do NOT Build

- Color tokens (Prompts 2 and 3)
- shadcn/ui installation (Prompt 4)
- Application shell layout (Prompt 6)
- Dark mode variables or media query detection (EveryStack has no dark mode)
- Custom font files — use `next/font/google` CDN loading

---

## Prompt 2: Surface Color Tokens, Text Contrast Map, Process State Colors

**Depends on:** Prompt 1
**Load context:** `design-system.md` lines 58–103 (Color Model — Surface Colors), lines 139–162 (Process State Color Language + Text Contrast)
**Target files:**
- `apps/web/src/app/globals.css` (modify — populate `:root` surface tokens)
- `apps/web/tailwind.config.ts` (modify — add surface color mappings)
- `apps/web/src/lib/design-tokens/colors.ts`
**Migration required:** No
**Git:** Commit with message `feat(design): surface color tokens, text contrast map, process state colors [Phase 1F, Prompt 2]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Implement Layer 1 of the three-layer color architecture: the fixed surface tokens that define EveryStack's visual identity.**

1. **CSS custom properties.** In `globals.css` `:root`, define all surface color tokens from the design system spec:

   ```css
   /* Layer 1 — Surface Colors (fixed, never change) */
   --sidebar-bg: #0F1419;
   --sidebar-bg-hover: #1E2730;
   --sidebar-text: #F1F5F9;
   --sidebar-text-muted: #94A3B8;
   --sidebar-active: rgba(255, 255, 255, 0.12);
   --content-bg: #FFFFFF;
   --panel-bg: #F1F5F9;
   --card-bg: #FFFFFF;
   --border-default: #E2E8F0;
   --border-subtle: #F1F5F9;
   --bg-elevated: #FFFFFF;
   --text-primary: #0F172A;
   --text-secondary: #475569;
   --text-tertiary: #94A3B8;
   --color-success: #059669;
   --color-warning: #D97706;
   --color-error: #DC2626;
   ```

   Also define the elevated surface shadow: `--shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.08)`.

2. **Tailwind color mappings.** In `tailwind.config.ts`, extend `colors` to reference CSS variables using the `hsl` / CSS var pattern. Map each surface token to a semantic Tailwind class name:
   - `sidebar.DEFAULT`, `sidebar.hover`, `sidebar.text`, `sidebar.muted`, `sidebar.active`
   - `content.bg`
   - `panel.bg`
   - `card.bg`
   - `border.DEFAULT`, `border.subtle`
   - `elevated.bg`
   - `text.primary`, `text.secondary`, `text.tertiary`
   - `state.success`, `state.warning`, `state.error`

   Use the CSS variable references so that Tailwind classes like `bg-sidebar` or `text-text-primary` resolve to the custom property values.

3. **Text contrast lookup map.** Create `apps/web/src/lib/design-tokens/colors.ts` with:
   - A `TEXT_CONTRAST_MAP` constant: a Record mapping background hex values to their WCAG AA-compliant text color (`#0F172A` for light backgrounds, `#FFFFFF` for dark backgrounds).
   - A `getContrastText(bgHex: string): string` function that looks up the precomputed map. Fall back to a luminance calculation if the color isn't in the map.
   - Pre-populate the map with all surface tokens and all 8 accent colors (from the design system spec — Teal `#0D9488`, Ocean Blue `#1D4ED8`, Indigo `#4338CA`, Deep Purple `#7C3AED`, Rose `#BE123C`, Amber `#B45309`, Forest `#15803D`, Slate `#334155`). All 8 pass ≥4.5:1 contrast with white text.

4. **Process state color language.** In the same `colors.ts` file, export a `PROCESS_STATE_COLORS` constant:
   ```typescript
   export const PROCESS_STATE_COLORS = {
     error: { token: 'var(--color-error)', hex: '#DC2626', meaning: 'Failed, needs attention' },
     warning: { token: 'var(--color-warning)', hex: '#D97706', meaning: 'Processing, in progress' },
     success: { token: 'var(--color-success)', hex: '#059669', meaning: 'Succeeded (transient — flash then revert)' },
   } as const;
   ```

5. **Export barrel.** Create `apps/web/src/lib/design-tokens/index.ts` that re-exports from `colors.ts`.

### Acceptance Criteria

- [ ] All 17 surface color CSS custom properties are defined in `globals.css` `:root`
- [ ] Tailwind config maps surface tokens to semantic class names — `bg-sidebar`, `text-text-primary`, `bg-state-success` all resolve correctly
- [ ] `getContrastText()` returns `#FFFFFF` for all 8 accent color hexes and `#0F172A` for `#FFFFFF` / `#F1F5F9`
- [ ] `TEXT_CONTRAST_MAP` covers all surface tokens and accent colors
- [ ] `PROCESS_STATE_COLORS` exports the three semantic states with token references and hex values
- [ ] Unit tests verify `getContrastText()` for all surface and accent colors
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Workspace accent color system (Prompt 3)
- Data color palette (Prompt 3)
- Dynamic color switching or theming provider (no dark mode exists)
- Runtime luminance calculation as the primary path (use the precomputed map; luminance is fallback only)

---

## Prompt 3: Workspace Accent Color System + Data Color Palette

**Depends on:** Prompt 1
**Load context:** `design-system.md` lines 104–138 (Workspace Accent Color + Data Color Palette)
**Target files:**
- `apps/web/src/app/globals.css` (modify — add accent + data palette CSS variables)
- `apps/web/tailwind.config.ts` (modify — add accent + data palette mappings)
- `apps/web/src/lib/design-tokens/accent-colors.ts`
- `apps/web/src/lib/design-tokens/data-palette.ts`
- `apps/web/src/lib/design-tokens/index.ts` (modify — re-export new modules)
**Migration required:** No
**Git:** Commit with message `feat(design): workspace accent color system, 13-color data palette [Phase 1F, Prompt 3]`

### Schema Snapshot

N/A — no schema changes. The `tenants` table has a `settings` JSONB column (defined in Phase 1B) where `branding_accent_color` will be stored. This prompt does NOT modify the schema — it reads the accent value and applies it as a CSS variable.

### Task

**Implement Layers 2 and 3 of the three-layer color architecture: admin-chosen accent and data palette.**

1. **Workspace accent color system.** Create `apps/web/src/lib/design-tokens/accent-colors.ts`:

   - Export `WORKSPACE_ACCENT_COLORS` — an array of 8 curated color objects:
     ```typescript
     export const WORKSPACE_ACCENT_COLORS = [
       { name: 'Teal', hex: '#0D9488', tailwindOrigin: 'teal-600' },
       { name: 'Ocean Blue', hex: '#1D4ED8', tailwindOrigin: 'blue-700' },
       { name: 'Indigo', hex: '#4338CA', tailwindOrigin: 'indigo-700' },
       { name: 'Deep Purple', hex: '#7C3AED', tailwindOrigin: 'violet-600' },
       { name: 'Rose', hex: '#BE123C', tailwindOrigin: 'rose-700' },
       { name: 'Amber', hex: '#B45309', tailwindOrigin: 'amber-700' },
       { name: 'Forest', hex: '#15803D', tailwindOrigin: 'green-700' },
       { name: 'Slate', hex: '#334155', tailwindOrigin: 'slate-700' },
     ] as const;
     ```
   - Export `DEFAULT_ACCENT_COLOR = '#0D9488'` (Teal).
   - Export `isValidAccentColor(hex: string): boolean` that validates against the 8 curated options.
   - Export a Zod schema `accentColorSchema` that validates the hex is one of the 8 options.

   In `globals.css` `:root`, add: `--accent: #0D9488;` (default Teal). Document: "Set dynamically from `tenants.settings.branding_accent_color` at render time."

   In `tailwind.config.ts`, add `accent: { DEFAULT: 'var(--accent)' }` to colors. This enables `bg-accent` and `text-accent`.

   **Where accent appears:** Header bar background, workspace logo badge in sidebar. **Where accent does NOT appear:** Buttons, links, badges, pills, sidebar active state. Add a code comment in the accent color file documenting this constraint.

2. **Data color palette.** Create `apps/web/src/lib/design-tokens/data-palette.ts`:

   - Export `DATA_COLORS` — an array of 13 color objects, each with `name`, `light` (pastel fill hex), and `saturated` (badge/dot hex):

     | Name | Light | Saturated |
     |------|-------|-----------|
     | Red | `#FEE2E2` | `#DC2626` |
     | Orange | `#FFEDD5` | `#EA580C` |
     | Amber | `#FEF3C7` | `#D97706` |
     | Yellow | `#FEF9C3` | `#CA8A04` |
     | Lime | `#ECFCCB` | `#65A30D` |
     | Green | `#DCFCE7` | `#16A34A` |
     | Teal | `#CCFBF1` | `#0D9488` |
     | Cyan | `#CFFAFE` | `#0891B2` |
     | Blue | `#DBEAFE` | `#2563EB` |
     | Indigo | `#E0E7FF` | `#4F46E5` |
     | Purple | `#EDE9FE` | `#7C3AED` |
     | Pink | `#FCE7F3` | `#DB2777` |
     | Gray | `#F1F5F9` | `#64748B` |

   - Export `getDataColor(index: number): DataColor` that cycles through the 13 colors (modulo).
   - Export `getDataColorByName(name: string): DataColor | undefined` for named lookups.
   - Document the usage rules as JSDoc:
     - Cell fills / row tints → light tone, 100% opacity, dark text always readable.
     - Status pills / badges / dots → saturated as background (white text) or as dot/icon on white.
   - TypeScript type: `DataColor = { name: string; light: string; saturated: string; }`.

3. **Tailwind data color utilities.** In `tailwind.config.ts`, add the 13 data colors under a `data` color group so that classes like `bg-data-red-light` and `bg-data-red-saturated` are available. Use CSS custom properties defined in `globals.css` for the data palette so they're overridable.

4. **Update barrel export.** Add `accent-colors.ts` and `data-palette.ts` to `apps/web/src/lib/design-tokens/index.ts`.

### Acceptance Criteria

- [ ] `WORKSPACE_ACCENT_COLORS` exports 8 colors, all passing ≥4.5:1 contrast with white text
- [ ] `--accent` CSS variable defaults to `#0D9488` (Teal) in `:root`
- [ ] `bg-accent` Tailwind class resolves to `var(--accent)`
- [ ] `isValidAccentColor()` returns `true` for all 8 curated hexes and `false` for arbitrary colors
- [ ] `DATA_COLORS` exports exactly 13 colors, each with `light` and `saturated` hex values
- [ ] `getDataColor(0)` returns Red, `getDataColor(13)` wraps to Red (modulo cycling)
- [ ] Tailwind classes `bg-data-red-light` and `bg-data-red-saturated` resolve correctly
- [ ] Unit tests verify all accent and data palette utilities
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Accent color Settings UI or color picker (Core UX — Settings page)
- Accent color persistence to database (the read path from `tenants.settings` is a render-time concern, not a design token concern)
- Kanban column header coloring rules (post-MVP)
- Calendar event color rules (post-MVP)
- Conditional formatting color assignment logic (Core UX)

---

## Integration Checkpoint 1 (after Prompts 1–3)

**Task:** Verify all design token infrastructure integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (including new unit tests for color utilities)
4. Verify in browser: load the Next.js dev server. Inspect `:root` — all CSS custom properties from Prompts 1–3 should be present. Body text should render in DM Sans at 14px.
5. Verify Tailwind classes: Create a temporary test page at `apps/web/src/app/design-test/page.tsx` that renders samples of each surface color, accent color, and a few data palette colors. Visually confirm no broken tokens.

**Git:** Commit with message `chore(verify): integration checkpoint 1 — design tokens complete [Phase 1F, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 4.

---

## Prompt 4: shadcn/ui CLI Initialization + Core Component Installation

**Depends on:** Prompts 1, 2
**Load context:** `design-system.md` lines 189–204 (Component Specifications)
**Target files:**
- `apps/web/components.json` (created by shadcn/ui init)
- `apps/web/src/components/ui/` (shadcn/ui component files — created by CLI)
- `apps/web/src/lib/utils.ts` (shadcn/ui `cn()` utility)
**Migration required:** No
**Git:** Commit with message `feat(design): shadcn/ui CLI init, install core component primitives [Phase 1F, Prompt 4]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Initialize shadcn/ui in the web app and install the core component primitives that all future UI compositions will build on.**

1. **Initialize shadcn/ui.** Run the shadcn/ui CLI init command in `apps/web/`:
   - Style: "default"
   - Base color: Use the custom CSS variables already defined (not a shadcn preset)
   - CSS variables: Yes
   - Tailwind config path: `tailwind.config.ts`
   - Components alias: `@/components`
   - Utils alias: `@/lib/utils`

   This creates `components.json` and the `cn()` utility in `apps/web/src/lib/utils.ts`. The `cn()` function merges Tailwind classes using `clsx` + `tailwind-merge`.

2. **Install core primitives.** Use the shadcn/ui CLI `add` command to install each of these components:

   | Component | Why It's Needed |
   |-----------|----------------|
   | `button` | All interactive actions across the platform |
   | `input` | All form text inputs |
   | `card` | Content containers (records, settings sections, wizard steps) |
   | `dialog` | Modals (record expand, confirmation, creation wizards) |
   | `dropdown-menu` | Context menus, action menus, overflow menus |
   | `badge` | Status pills, tags, counts, data color indicators |
   | `tooltip` | Hover/focus info on icons, truncated text, action buttons |
   | `select` | Dropdowns for role pickers, field type selectors, filter values |
   | `popover` | Quick-create popovers, filter builders, color pickers |
   | `tabs` | Record View tabs, settings sections |
   | `sheet` | Mobile bottom sheets, slide-out panels |
   | `command` | Command Bar (⌘K) — shadcn command palette primitive |
   | `separator` | Visual dividers between sections |
   | `skeleton` | Loading state placeholders |
   | `label` | Form field labels |
   | `switch` | Toggle settings |
   | `textarea` | Multi-line text inputs |
   | `scroll-area` | Custom scrollbars for sidebar, panels |
   | `avatar` | User avatars in header, sidebar, members list |
   | `alert` | Inline messages (error, warning, info) |

3. **Verify CSS variable integration.** After installation, check each component file in `apps/web/src/components/ui/`. Ensure they reference the CSS custom properties defined in Prompt 2 (e.g., `bg-background` should map to `--content-bg`, `text-foreground` should map to `--text-primary`). If shadcn/ui defaults don't align with EveryStack's token names, update the CSS variable mappings in `globals.css` to bridge:
   - shadcn's `--background` → set to `var(--content-bg)` value
   - shadcn's `--foreground` → set to `var(--text-primary)` value
   - shadcn's `--border` → set to `var(--border-default)` value
   - shadcn's `--ring` → set to a focus ring color (use `#2563EB` — blue-600)
   - shadcn's `--primary` → set to `var(--text-primary)` value (for primary buttons)
   - shadcn's `--primary-foreground` → set to `#FFFFFF`
   - shadcn's `--destructive` → set to `var(--color-error)` value
   - shadcn's `--muted` → set to `var(--panel-bg)` value
   - shadcn's `--muted-foreground` → set to `var(--text-secondary)` value
   - shadcn's `--accent` → set to `var(--panel-bg)` value (for hover highlights — NOT the workspace accent)
   - shadcn's `--card` → set to `var(--card-bg)` value

   **Important:** shadcn/ui's `--accent` variable is for component hover states (dropdowns, command items). This is different from EveryStack's workspace `--accent` (header bar color). Name the EveryStack workspace accent `--ws-accent` in globals.css to avoid collision, and update the Tailwind accent mapping from Prompt 3 accordingly: `accent: { DEFAULT: 'var(--ws-accent)' }`.

4. **Skeleton component configuration.** Verify the installed `skeleton.tsx` uses a pulse animation and renders with the `--panel-bg` color. This component will be the standard loading state pattern — no spinner components should exist.

### Acceptance Criteria

- [ ] `components.json` exists in `apps/web/` with correct paths
- [ ] `cn()` utility works — merging two Tailwind class strings produces deduplicated output
- [ ] All 20 component files exist in `apps/web/src/components/ui/`
- [ ] shadcn/ui CSS variables in `globals.css` are mapped to EveryStack surface tokens
- [ ] No CSS variable naming collision between shadcn's `--accent` and EveryStack's workspace accent (renamed to `--ws-accent`)
- [ ] `Skeleton` component renders with pulse animation and `--panel-bg` color
- [ ] `pnpm turbo typecheck` passes with zero errors
- [ ] `pnpm turbo lint` passes with zero errors

### Do NOT Build

- Custom component variants yet (Prompt 5)
- Application shell layout (Prompt 6)
- Feature-specific component compositions (Core UX)
- Custom scrollbar styling beyond what `scroll-area` provides
- Animation library or motion system (not in MVP scope)

---

## Prompt 5: Component Theme Customization

**Depends on:** Prompt 4
**Load context:** `design-system.md` lines 189–204 (Component Specifications)
**Target files:**
- `apps/web/src/components/ui/button.tsx` (modify)
- `apps/web/src/components/ui/card.tsx` (modify)
- `apps/web/src/components/ui/badge.tsx` (modify)
- `apps/web/src/components/ui/input.tsx` (modify)
- `apps/web/src/components/ui/textarea.tsx` (modify)
- `apps/web/src/lib/design-tokens/sidebar-nav.ts`
**Migration required:** No
**Git:** Commit with message `feat(design): component theme customization — Button, Card, Badge, Input, sidebar nav [Phase 1F, Prompt 5]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Customize the shadcn/ui primitives to match EveryStack's design system specification.**

1. **Button variants.** Modify `button.tsx` to implement the three EveryStack button variants via the existing `variants` pattern (shadcn/ui uses `cva`):

   | Variant | Background | Text | Border | Notes |
   |---------|-----------|------|--------|-------|
   | `default` (primary) | `--text-primary` (#0F172A) | white | none | 600 weight, 8px radius. The dark button. |
   | `outline` | white | `--text-primary` | 1px `--border-default` | For secondary actions |
   | `ghost` | transparent | `--text-secondary` | none | For toolbar buttons, less prominent actions |
   | `destructive` | `--color-error` | white | none | Delete, remove actions |

   Sizes: `md` (default — 36px height, 14px text), `sm` (32px height, 13px text). Icon slot support (leading or trailing icon via children composition — no prop needed, just ensure padding works with an icon + text child).

2. **Card styling.** Modify `card.tsx`:
   - Background: `var(--card-bg)`
   - Border: 1px `var(--border-default)`
   - Border radius: 12px (`rounded-lg`)
   - Padding: 20px
   - Hover state: darker border (`--text-tertiary`) + elevated shadow (`var(--shadow-elevated)`)

3. **Badge variants.** Modify `badge.tsx` to add EveryStack-specific variants:
   - `default`: neutral gray background, dark text
   - `success`: green background (`--color-success`), white text
   - `warning`: amber background (`--color-warning`), white text
   - `error`: red background (`--color-error`), white text
   - `data-color`: accepts a `colorName` prop (one of the 13 data palette names). Renders with the saturated color as background and white text. Falls back to `default` if invalid.

   All badges: 11px text, 600 weight, 3px vertical / 8px horizontal padding, 4px border radius (`rounded-sm`).

4. **Input + Textarea focus styling.** Modify `input.tsx` and `textarea.tsx`:
   - Background: white
   - Border: 1px `var(--border-default)`
   - Border radius: 8px
   - Focus: `border-color: #2563EB` (blue-600) + `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1)` (glow effect)
   - Placeholder text: `var(--text-tertiary)`

5. **Sidebar nav item constants.** Create `apps/web/src/lib/design-tokens/sidebar-nav.ts` exporting a `SIDEBAR_NAV_STYLES` constant object:
   ```typescript
   export const SIDEBAR_NAV_STYLES = {
     iconSize: 20,          // px
     textColor: 'var(--sidebar-text)',
     activeBackground: 'var(--sidebar-active)',
     activeFontWeight: 600,
     activeIndicator: '3px solid white',  // left bar
     hoverBackground: 'var(--sidebar-bg-hover)',
   } as const;
   ```
   This will be consumed by the sidebar component in Prompt 6.

6. **Command Bar token constants.** Create `apps/web/src/lib/design-tokens/command-bar.ts` exporting:
   ```typescript
   export const COMMAND_BAR_STYLES = {
     compact: { width: 300, height: 36, borderRadius: 8 },
     full: { width: 640, maxHeight: '70vh', borderRadius: 12 },
   } as const;
   ```
   The Command Bar component itself ships in Core UX — only the dimensional tokens ship here.

### Acceptance Criteria

- [ ] Button renders correctly in all 4 variants (default, outline, ghost, destructive) at both sizes (md, sm)
- [ ] Card has 12px radius, 20px padding, hover effect with elevated shadow
- [ ] Badge renders all 5 variants; `data-color` variant with `colorName="Blue"` shows saturated blue background with white text
- [ ] Input/Textarea focus shows blue-600 border with glow shadow
- [ ] `SIDEBAR_NAV_STYLES` and `COMMAND_BAR_STYLES` constants are exported and type-safe
- [ ] Component tests verify all button variants render with correct classes
- [ ] Component tests verify badge `data-color` variant applies correct data palette color
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Command Bar component implementation (Core UX)
- Sidebar component implementation (Prompt 6 — only tokens here)
- Feature-specific button compositions (e.g., "Add Record" button with icon)
- Animated transitions between button states
- Tooltip content or trigger logic (shadcn/ui default is sufficient)

---

## Prompt 6: Application Shell Layout Skeleton

**Depends on:** Prompts 2, 3, 5
**Load context:** `design-system.md` lines 44–57 (Foundations dimensions), lines 205–217 (Application Shell Responsive)
**Target files:**
- `apps/web/src/components/shell/app-shell.tsx`
- `apps/web/src/components/shell/sidebar.tsx`
- `apps/web/src/components/shell/header-bar.tsx`
- `apps/web/src/components/shell/main-content.tsx`
- `apps/web/src/components/shell/index.ts`
- `apps/web/src/app/(workspace)/layout.tsx` (modify or create — workspace layout)
**Migration required:** No
**Git:** Commit with message `feat(design): application shell layout — sidebar, header, content area [Phase 1F, Prompt 6]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Build the responsive application shell that wraps every workspace page.**

1. **AppShell component.** Create `apps/web/src/components/shell/app-shell.tsx` as the root layout wrapper. It renders three children: Sidebar (left), HeaderBar (top of content area), and MainContent (remaining space). Uses CSS Grid or Flexbox — no absolute positioning.

2. **Sidebar component.** Create `apps/web/src/components/shell/sidebar.tsx`:
   - **Collapsed state (default):** 48px wide icon rail. Dark background (`--sidebar-bg`). Shows icon-only navigation items vertically. Expand toggle button (⟷) positioned above the user avatar area at the bottom.
   - **Expanded state:** ~280px wide with two zones — 48px icon rail + ~232px content zone. Content zone shows labels next to icons and a workspace tree placeholder. Same dark background.
   - **Toggle behavior:** Clicking the expand toggle transitions between 48px and 280px. Use CSS transition (200ms ease) for smooth animation. Store sidebar state in a Zustand store (`useSidebarStore`) so it persists across navigations.
   - **Desktop (≥1440px):** Full sidebar behavior as described.
   - **Tablet (≥768px):** Same as desktop — 48px icon rail, expand on tap.
   - **Mobile (<768px):** Sidebar is hidden by default. A hamburger button in the header opens it as a 280px overlay drawer (using the shadcn/ui `Sheet` component) with a dark scrim behind it.
   - Use CSS logical properties: `inline-size` (not `width`), `margin-inline-start` (not `margin-left`).
   - Render placeholder navigation items (Home icon, Workspace icon, Settings icon) to verify layout. Actual navigation items ship in Core UX.

3. **HeaderBar component.** Create `apps/web/src/components/shell/header-bar.tsx`:
   - Height: 52px
   - Background: `var(--ws-accent)` (workspace accent color)
   - Text/icons: white (guaranteed ≥4.5:1 contrast with all 8 accent options)
   - Contents (left to right): Breadcrumb placeholder, flexible spacer, Command Bar compact placeholder (300px × 36px container — just the shell, not functional), user avatar placeholder
   - Mobile: Page title + hamburger button (left) + search icon (right). No breadcrumbs, no Command Bar compact.

4. **MainContent component.** Create `apps/web/src/components/shell/main-content.tsx`:
   - Background: `var(--content-bg)` (white)
   - Takes up all remaining space after sidebar and header
   - Renders `{children}` — this is where page content goes
   - Has appropriate padding (20px on desktop, 16px on tablet, 12px on mobile)
   - Scroll container — content scrolls vertically, shell (sidebar + header) stays fixed

5. **Workspace layout.** Create or modify `apps/web/src/app/(workspace)/layout.tsx` to wrap children in `<AppShell>`. This layout applies to all workspace routes. The shell does NOT apply to portal routes, auth routes, or the onboarding wizard.

6. **Barrel export.** Create `apps/web/src/components/shell/index.ts` re-exporting `AppShell`, `Sidebar`, `HeaderBar`, `MainContent`.

### Acceptance Criteria

- [ ] AppShell renders a three-zone layout: sidebar left, header top-right, content below header
- [ ] Sidebar starts collapsed at 48px, expand toggle animates to 280px (200ms ease)
- [ ] Sidebar uses `--sidebar-bg` (#0F1419) background — always dark
- [ ] Header renders with `var(--ws-accent)` background (defaults to Teal)
- [ ] Header height is 52px, white text/icons
- [ ] Content area is white, scrollable, with responsive padding
- [ ] On mobile (<768px): sidebar is hidden, hamburger opens it as a Sheet overlay
- [ ] On mobile: header shows page title + hamburger + search icon only
- [ ] `useSidebarStore` (Zustand) persists expanded/collapsed state across navigations
- [ ] All directional CSS uses logical properties (`inline-size`, `margin-inline-start`, etc.)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] All user-facing text (aria-labels, tooltips) uses `t('key')` i18n

### Do NOT Build

- Actual navigation items or workspace tree (Core UX)
- Command Bar functionality (Core UX — only the 300px placeholder shell)
- Record View overlay or Quick Panel panel (Core UX)
- User avatar dropdown menu (Core UX)
- Breadcrumb logic or page title resolution (Core UX)
- Bottom navigation bar for mobile (Core UX Phase 3H)
- My Office widget grid layout (Core UX)

---

## Prompt 7: Responsive Architecture, CSS Logical Properties, Touch Targets

**Depends on:** Prompt 6
**Load context:** `design-system.md` lines 218–295 (Responsive Architecture, Shared Responsive Patterns, Ergonomic Design Constraints)
**Target files:**
- `apps/web/src/lib/design-tokens/breakpoints.ts`
- `apps/web/src/lib/design-tokens/touch-targets.ts`
- `apps/web/src/hooks/use-breakpoint.ts`
- `apps/web/src/lib/design-tokens/index.ts` (modify — re-export new modules)
**Migration required:** No
**Git:** Commit with message `feat(design): responsive breakpoints, touch target utilities, use-breakpoint hook [Phase 1F, Prompt 7]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Establish the responsive architecture utilities that all subsequent UI components will consume.**

1. **Breakpoint constants.** Create `apps/web/src/lib/design-tokens/breakpoints.ts`:
   ```typescript
   export const BREAKPOINTS = {
     phone: 0,
     tablet: 768,
     desktop: 1440,
   } as const;

   export type DeviceTier = 'phone' | 'tablet' | 'desktop';

   /** Design principle — from design-system.md:
    * Desktop = Build
    * Tablet = Build & Operate
    * Mobile = Operate & Consume
    */
   ```

2. **useBreakpoint hook.** Create `apps/web/src/hooks/use-breakpoint.ts`:
   - Returns the current `DeviceTier` based on window width.
   - Uses `window.matchMedia` for efficient updates (not resize event polling).
   - Returns `'desktop'` during SSR (safe default).
   - Also exports convenience booleans: `isPhone`, `isTablet`, `isDesktop`.
   - Debounce is not needed — `matchMedia` listeners fire only on threshold crossing.

3. **Touch target constants.** Create `apps/web/src/lib/design-tokens/touch-targets.ts`:
   ```typescript
   export const TOUCH_TARGETS = {
     /** WCAG 2.5.8 minimum — all interactive elements */
     minimum: 44,
     /** Standard action buttons */
     action: 48,
     /** Primary actions: FAB, submit, send */
     primary: 56,
     /** Minimum gap between tappable elements */
     tapSpacing: 8,
   } as const;
   ```

4. **Tailwind utility classes for touch targets.** In `tailwind.config.ts`, add custom utilities or extend `minWidth` / `minHeight` with:
   - `min-touch` → 44px × 44px (WCAG minimum)
   - `min-touch-action` → 48px × 48px (action buttons)
   - `min-touch-primary` → 56px × 56px (primary actions like FAB)

5. **Responsive pattern documentation.** Create `apps/web/src/lib/design-tokens/responsive-patterns.ts` exporting constants for shared responsive behaviors:
   ```typescript
   export const RESPONSIVE_PATTERNS = {
     modal: {
       desktop: { maxWidth: 800, position: 'center' },
       tablet: { maxWidth: '90%', position: 'center' },
       phone: { maxWidth: '100%', position: 'bottom-sheet' },
     },
     swipeGestures: {
       left: 'destructive',
       right: 'primary',
       longPress: 'context-menu',
     },
     dragDelay: 200, // ms — long-press delay for touch drag on builder surfaces
   } as const;
   ```

6. **Update barrel export.** Add `breakpoints.ts`, `touch-targets.ts`, and `responsive-patterns.ts` to the design-tokens index.

### Acceptance Criteria

- [ ] `BREAKPOINTS` exports phone (0), tablet (768), desktop (1440) constants
- [ ] `useBreakpoint()` returns `'desktop'` on SSR, correct tier on client
- [ ] `useBreakpoint()` updates when window crosses 768px or 1440px thresholds (verified with test)
- [ ] `TOUCH_TARGETS` exports minimum (44), action (48), primary (56), tapSpacing (8) constants
- [ ] Tailwind `min-touch`, `min-touch-action`, `min-touch-primary` utility classes work
- [ ] `RESPONSIVE_PATTERNS` exports modal and swipe gesture constants
- [ ] Unit tests verify `useBreakpoint` returns correct tier for widths 375, 768, 1440
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Actual responsive component variants (Core UX builds responsive Grid, Record View, etc.)
- Bottom sheet component (Sheet from shadcn/ui is sufficient; responsive routing logic ships in Core UX)
- Pull-to-refresh implementation (Core UX)
- Keyboard avoidance logic (Core UX)
- Haptic feedback API integration (Core UX mobile phase)

---

## Integration Checkpoint 2 (after Prompts 4–7)

**Task:** Verify all components and shell layout integrate correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (including new component tests)
4. `pnpm turbo test -- --coverage` — thresholds met on new files
5. Manual verification: Start dev server. Navigate to a workspace route. Confirm:
   - Dark sidebar at 48px (collapsed) on left
   - Teal header bar at 52px height
   - White content area fills remaining space
   - Sidebar expand toggle works (smooth 200ms transition to 280px)
   - Resize browser below 768px: sidebar hides, hamburger appears, header simplifies
6. Verify the design-test page (from CP-1) still renders correctly with shadcn/ui components.

**Git:** Commit with message `chore(verify): integration checkpoint 2 — components and shell layout [Phase 1F, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 8.

---

## Prompt 8: Shared Responsive Patterns, Loading Skeletons, AI Credit Display Pattern

**Depends on:** Prompts 5, 7
**Load context:** `design-system.md` lines 261–312 (Shared Responsive Patterns, AI Credit Display Pattern)
**Target files:**
- `apps/web/src/components/ui/loading-skeleton.tsx`
- `apps/web/src/components/ui/bottom-sheet-wrapper.tsx`
- `apps/web/src/components/ui/ai-credit-badge.tsx`
- `apps/web/src/lib/design-tokens/progressive-disclosure.ts`
**Migration required:** No
**Git:** Commit with message `feat(design): loading skeletons, responsive wrappers, AI credit badge, progressive disclosure constants [Phase 1F, Prompt 8]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Build the shared UI pattern components that multiple features will reuse.**

1. **Loading skeleton compositions.** Create `apps/web/src/components/ui/loading-skeleton.tsx` with pre-built skeleton layouts:
   - `TableSkeleton` — mimics a grid layout: header row + 6 data rows with varying column widths. Uses the shadcn/ui `Skeleton` primitive. Matches the spacing and proportions of the eventual Grid view.
   - `CardSkeleton` — mimics a Card view card: avatar circle + 3 text lines + badge placeholder.
   - `RecordViewSkeleton` — mimics the Record View: two-column layout with field label + value placeholders.
   - `PageSkeleton` — generic page loading: header bar skeleton + content area with 3 card skeletons.

   All skeletons use `var(--panel-bg)` as the fill color and pulse animation. No spinners anywhere.

2. **BottomSheetWrapper component.** Create `apps/web/src/components/ui/bottom-sheet-wrapper.tsx`:
   - A responsive wrapper that renders `Dialog` on desktop/tablet and `Sheet` (bottom slide-up) on mobile.
   - Uses the `useBreakpoint()` hook from Prompt 7.
   - Props: `open`, `onOpenChange`, `children`, `title` (for accessibility).
   - Desktop/tablet: Renders as centered Dialog (max-width 800px on desktop, 90% on tablet).
   - Mobile: Renders as Sheet with `side="bottom"`, swipe-down to close.
   - This is a layout convenience component — features use `<BottomSheetWrapper>` instead of deciding between Dialog and Sheet themselves.

3. **AI Credit Badge component.** Create `apps/web/src/components/ui/ai-credit-badge.tsx`:
   - Props: `credits: number` (the cost to display).
   - Renders: `✨ {credits} credit(s)` in `--text-tertiary` color, 11px text.
   - Uses i18n for the text: `t('ai.creditBadge', { count: credits })`.
   - This is the universal pattern for showing AI credit cost **before** execution. It is placed on the action trigger (button, menu item, option card) — never on results, outputs, or confirmations.
   - Export as a named export.

4. **Progressive disclosure constants.** Create `apps/web/src/lib/design-tokens/progressive-disclosure.ts`:
   ```typescript
   export const DISCLOSURE_LEVELS = {
     /** Level 1 — Default View (80%): No jargon, templates as entry points, 6–8 common actions */
     default: 1,
     /** Level 2 — Expanded View (15%): Full option sets, still visual and guided */
     expanded: 2,
     /** Level 3 — Power View (5%): Expert mode, custom code, raw expressions */
     power: 3,
   } as const;

   export type DisclosureLevel = typeof DISCLOSURE_LEVELS[keyof typeof DISCLOSURE_LEVELS];

   /**
    * Mobile constraint: Level 1 is the entire visible surface.
    * Level 2 requires deliberate navigation. Level 3 is NOT available on phone.
    */
   export const MOBILE_MAX_DISCLOSURE_LEVEL = 2;
   ```

5. **Update barrel exports.** Re-export `progressive-disclosure.ts` from the design-tokens index.

### Acceptance Criteria

- [ ] `TableSkeleton` renders a pulsing grid-like layout with header + 6 rows
- [ ] `CardSkeleton` renders a pulsing card layout with avatar, text lines, badge
- [ ] `RecordViewSkeleton` renders a pulsing two-column field layout
- [ ] `PageSkeleton` composes header + card skeletons for full-page loading state
- [ ] All skeletons use `var(--panel-bg)` fill and pulse animation — no spinners
- [ ] `BottomSheetWrapper` renders as Dialog on desktop, Sheet on mobile
- [ ] `AiCreditBadge` renders `✨ 5 credits` for `credits={5}` in tertiary color at 11px
- [ ] `AiCreditBadge` uses i18n for credit text
- [ ] `DISCLOSURE_LEVELS` exports three levels with correct numeric values
- [ ] `MOBILE_MAX_DISCLOSURE_LEVEL` is 2
- [ ] Component tests for all skeleton variants, BottomSheetWrapper, and AiCreditBadge
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Feature-specific skeleton variants (Grid view loading, Record View loading — those are refined in Core UX)
- AI credit metering logic or budget checking (Phase 1H — AI Service Layer)
- Progressive disclosure container component with show/hide behavior (Core UX)
- Pull-to-refresh (Core UX)
- Haptic feedback (Core UX)
- Creation flow pattern components (Inline Create, Wizard Create, Recipe Create — Core UX)

---

## Final Integration Checkpoint (after Prompt 8)

**Task:** Verify the complete Phase 1F design system foundation is integrated and production-ready.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met on all new files
5. Manual verification — start dev server and confirm:
   - Application shell renders correctly at all three breakpoints (resize browser to 375px, 768px, 1440px+)
   - Sidebar collapse/expand works with smooth transition
   - Header uses Teal accent by default
   - Skeleton loading states render with pulse animation
   - `AiCreditBadge` renders with sparkle emoji and credit count
   - All text is DM Sans (body) or JetBrains Mono (code contexts)
6. Clean up the temporary design-test page created in CP-1 (or keep it as a Storybook-like reference — team preference).
7. Verify no hardcoded hex values exist in any component file (all colors should reference CSS variables or Tailwind classes).

**Git:** Commit with message `chore(verify): final integration checkpoint — Phase 1F complete [Phase 1F, CP-3]`, push branch to origin, then open PR to main with title **"Phase 1F — Design System Foundation"**.

---

## Dependency Graph Summary

```
Prompt 1 (Tailwind + Fonts + Typography + Spacing)
  ├── Prompt 2 (Surface Colors + Contrast + Process States)
  │     └── Prompt 4 (shadcn/ui Init + Install)
  │           └── Prompt 5 (Component Theme Customization)
  │                 ├── Prompt 6 (Application Shell Layout) ← also depends on 2, 3
  │                 │     └── Prompt 7 (Responsive Architecture + Touch Targets)
  │                 └── Prompt 8 (Shared Patterns + Skeletons + AI Credit Badge) ← also depends on 7
  └── Prompt 3 (Accent Colors + Data Palette)
        └── Prompt 6 (Application Shell Layout)
```

**Critical path:** 1 → 2 → 4 → 5 → 6 → 7 → 8
**Parallel opportunity:** Prompts 2 and 3 can be executed in parallel after Prompt 1.
