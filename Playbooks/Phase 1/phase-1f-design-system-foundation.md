# Phase 1F — Design System Foundation & i18n Framework

## Phase Context

### What Has Been Built
See `docs/skills/phase-context/SKILL.md` for the current build state. Key outputs from prior phases that this phase directly depends on:
- Turborepo + pnpm monorepo with `apps/web` Next.js App Router scaffold, `apps/worker`, `apps/realtime`, `packages/shared` (Phase 1A)
- ESLint + Prettier configuration with `no-console` and `no-any` rules (Phase 1A)
- GitHub Actions CI pipeline (lint → typecheck → test gates) (Phase 1A)
- TypeScript strict mode across all packages (Phase 1A)
- Vitest workspace config, Playwright E2E setup, test factories (Phase 1E)

### What This Phase Delivers
A complete design system foundation: shadcn/ui primitives customized to the EveryStack specification, a three-layer color architecture (fixed surfaces, admin-chosen accent, data palette), DM Sans + JetBrains Mono typography, a responsive application shell skeleton (sidebar, header, content area), and a functional i18n framework (next-intl) with a working `check:i18n` CI gate that enforces zero hardcoded English strings in UI components.

### What This Phase Does NOT Build
- Feature-specific component compositions — Grid view, Card view, Record View (Phase 3 — Core UX)
- Command Bar implementation (Phase 3B — Core UX)
- Mobile bottom navigation or hamburger drawer full implementation (Phase 3H — Core UX)
- My Office widget grid layout (Phase 3G — Core UX)
- Portal theming system (post-MVP)
- Chart or visualization components (post-MVP)
- Dark/light mode toggle (never — EveryStack uses a fixed hybrid layout)
- App Designer or any page builder components (post-MVP)

### Architecture Patterns for This Phase
- All UI primitives are **shadcn/ui**, customized via Tailwind + CSS custom properties — never build custom primitives when shadcn has them
- **Three-layer color system:** Fixed surface colors (sidebar dark, content white), admin-chosen accent (header bar only), 13-color data palette (cell fills, badges)
- **CSS logical properties** preferred: `margin-inline-start` not `margin-left`, `padding-block` not `padding-top/bottom`
- **No hardcoded English strings** — all user-facing text through next-intl `t()` function from the first line of UI code
- **Fonts:** DM Sans (UI/headings), JetBrains Mono (code/technical) — loaded via `next/font`
- **Base spacing unit:** 4px — all spacing in multiples of 4
- **Touch targets:** minimum 44×44px (WCAG 2.5.8)
- **No dark/light mode** — one fixed appearance: always-dark sidebar, white content area, admin-chosen accent header

### Mandatory Context for All Prompts
`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

### Skills for This Phase
Load these skill files before executing any prompt in this phase:
- `docs/skills/ux-ui/SKILL.md` — Color architecture, typography, component conventions, responsive patterns, accessibility
- `docs/skills/phase-context/SKILL.md` — Current build state, existing files/modules, active conventions

### i18n Developer Guide

**Pattern for all future sub-phases:** Every sub-phase that creates UI text must follow this i18n workflow:

1. **Import the hook:** `import { useTranslations } from 'next-intl';`
2. **Initialize with namespace:** `const t = useTranslations('FeatureName');` — namespace matches the top-level key in the messages JSON.
3. **Use for all visible text:** `<Button>{t('save')}</Button>` — never `<Button>Save</Button>`.
4. **Add keys to locale files:** `messages/en.json` gets the English string. `messages/es.json` gets a placeholder (can be the English string with a `[es]` prefix during development).
5. **Server Components:** Use `import { getTranslations } from 'next-intl/server';` and `const t = await getTranslations('FeatureName');` in async server components.
6. **Interpolation:** `t('greeting', { name: user.name })` with `"greeting": "Hello, {name}"` in the messages file.
7. **Plurals:** `t('itemCount', { count: items.length })` with ICU syntax in messages: `"itemCount": "{count, plural, one {# item} other {# items}}"`.
8. **What counts as "hardcoded English":** Any text content in JSX, string literals used as `placeholder`, `title`, `aria-label`, `alt`, button text, heading text, error messages, toast messages, or any string rendered to the user. Does NOT include: CSS class names, data attributes, enum values, log messages (Pino), test assertions, TypeScript type names, or file paths.
9. **CI enforcement:** `pnpm turbo check:i18n` scans all `.tsx` files in `apps/web/src/` for violations. This runs in CI pre-merge — it will block the PR if hardcoded English is found.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | Tailwind token system, CSS custom properties, and font installation | None | ~200 |
| 2 | Three-layer color architecture — surface tokens, accent colors, data palette, contrast map | 1 | ~180 |
| 3 | Install and customize core shadcn/ui primitives | 1 | ~200 |
| 4 | Typography scale, spacing utilities, and responsive breakpoint system | 1 | ~150 |
| CP-1 | Integration Checkpoint 1 (after Prompts 1–4) | 1–4 | — |
| 5 | Responsive application shell layout | 2, 3, 4 | ~250 |
| 6 | Install and configure next-intl for App Router i18n | 1 | ~200 |
| 7 | Wire i18n into application shell and build check-i18n CI script | 5, 6 | ~200 |
| CP-2 | Integration Checkpoint 2 (after Prompts 5–7) | 5–7 | — |

---

## Prompt 1: Tailwind Token System, CSS Custom Properties, and Font Installation

**Depends on:** None
**Skills:** ux-ui, phase-context
**Load context:** `design-system.md` lines 44–57 (Foundations), lines 58–138 (Color Model — Hybrid Layout), lines 163–180 (Typography Scale), lines 181–188 (Spacing)
**Target files:** `apps/web/tailwind.config.ts`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx` (font configuration), `apps/web/src/lib/fonts.ts`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1f-design-system` from `main`. Commit with message `feat(ui): configure Tailwind token system, CSS custom properties, and fonts [Phase 1F, Prompt 1]`

### Schema Snapshot
N/A — no schema changes.

### Task

**1. Configure Tailwind CSS with EveryStack design tokens.**

Extend `tailwind.config.ts` to map all EveryStack design tokens to CSS custom properties. The existing Tailwind config from Phase 1A should be extended, not replaced.

Add these to the Tailwind `theme.extend`:

**Colors** (referencing CSS custom properties):
```
colors: {
  sidebar: {
    bg: 'var(--sidebar-bg)',
    'bg-hover': 'var(--sidebar-bg-hover)',
    text: 'var(--sidebar-text)',
    'text-muted': 'var(--sidebar-text-muted)',
    active: 'var(--sidebar-active)',
  },
  content: {
    bg: 'var(--content-bg)',
  },
  panel: {
    bg: 'var(--panel-bg)',
  },
  card: {
    bg: 'var(--card-bg)',
  },
  border: {
    DEFAULT: 'var(--border-default)',
    subtle: 'var(--border-subtle)',
  },
  elevated: {
    bg: 'var(--bg-elevated)',
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    tertiary: 'var(--text-tertiary)',
  },
  state: {
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--error)',
  },
  accent: 'var(--accent)',
}
```

**Border radius:**
```
borderRadius: {
  sm: '4px',    // badges
  DEFAULT: '8px', // standard
  lg: '12px',   // large cards
}
```

**Spacing** (4px base, extend with named tokens):
```
spacing: {
  // Tailwind already has 4px-based spacing, but add semantic tokens:
  'card-padding': '20px',
  'section-gap': '16px',
  'section-gap-lg': '28px',
  'mobile-bottom-nav': '56px',
}
```

**2. Define all CSS custom properties in `globals.css`.**

Add a `:root` block with ALL surface color tokens from the design system:

```css
:root {
  /* Surface Colors (Fixed) */
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
  --success: #059669;
  --warning: #D97706;
  --error: #DC2626;

  /* Workspace Accent (default Teal — overridden per tenant) */
  --accent: #0D9488;

  /* Elevated surface shadow */
  --shadow-elevated: 0 4px 16px rgba(0, 0, 0, 0.08);

  /* Layout dimensions */
  --sidebar-width-collapsed: 48px;
  --sidebar-width-expanded: 280px;
  --header-height: 52px;
}
```

**3. Install and configure fonts via `next/font`.**

Create `apps/web/src/lib/fonts.ts`:
- Import `DM_Sans` from `next/font/google` with weights 400, 500, 600, 700 and `latin` subset.
- Import `JetBrains_Mono` from `next/font/google` with weights 400, 500 and `latin` subset.
- Export both font objects with CSS variable names: `--font-sans` and `--font-mono`.

Update `apps/web/src/app/layout.tsx`:
- Apply both font CSS variables to the `<html>` element's className.
- Set `DM_Sans` as the default body font.

Update `tailwind.config.ts`:
```
fontFamily: {
  sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
  mono: ['var(--font-mono)', 'monospace'],
}
```

### Acceptance Criteria
- [ ] `tailwind.config.ts` extends theme with all EveryStack color tokens, border radius, spacing, and font families
- [ ] `globals.css` defines all 17 surface color CSS custom properties plus accent, shadow, and layout dimension variables
- [ ] DM Sans loads as the default body font (verify by inspecting the rendered `<html>` element's font-family)
- [ ] JetBrains Mono is available via the `font-mono` Tailwind utility class
- [ ] `pnpm turbo build` completes with zero errors (fonts resolve, Tailwind config valid)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Component customizations (Prompt 3)
- Accent color switching logic or workspace settings integration (Prompt 2)
- Data palette constants (Prompt 2)
- Typography scale utility classes (Prompt 4)
- Application shell layout (Prompt 5)
- i18n framework (Prompt 6)

---

## Prompt 2: Three-Layer Color Architecture — Surface, Accent, Data Palette, and Contrast Map

**Depends on:** Prompt 1
**Skills:** ux-ui, phase-context
**Load context:** `design-system.md` lines 58–138 (Color Model — Hybrid Layout), lines 139–162 (Process State Color Language, Text Contrast)
**Target files:** `apps/web/src/lib/design-system/colors.ts`, `apps/web/src/lib/design-system/index.ts`
**Migration required:** No
**Git:** Commit with message `feat(ui): implement three-layer color architecture with accent, data palette, and contrast map [Phase 1F, Prompt 2]`

### Schema Snapshot
N/A — no schema changes. The `tenants.settings` JSONB column (created in Phase 1B) will eventually contain `branding_accent_color`, but this prompt does not read from the database.

### Task

**1. Create the workspace accent color constants.**

In `apps/web/src/lib/design-system/colors.ts`, export a typed constant for the 8 curated accent colors:

```typescript
export const WORKSPACE_ACCENT_COLORS = [
  { name: 'Teal', hex: '#0D9488', tailwind: 'teal-600' },
  { name: 'Ocean Blue', hex: '#1D4ED8', tailwind: 'blue-700' },
  { name: 'Indigo', hex: '#4338CA', tailwind: 'indigo-700' },
  { name: 'Deep Purple', hex: '#7C3AED', tailwind: 'violet-600' },
  { name: 'Rose', hex: '#BE123C', tailwind: 'rose-700' },
  { name: 'Amber', hex: '#B45309', tailwind: 'amber-700' },
  { name: 'Forest', hex: '#15803D', tailwind: 'green-700' },
  { name: 'Slate', hex: '#334155', tailwind: 'slate-700' },
] as const;

export const DEFAULT_ACCENT_COLOR = '#0D9488'; // Teal
```

All 8 pass ≥4.5:1 contrast ratio with white text (WCAG AA verified).

**2. Create a utility function to apply the accent color.**

```typescript
export function applyAccentColor(hex: string): void {
  document.documentElement.style.setProperty('--accent', hex);
}
```

This will be called by the workspace context provider in Phase 3. For now, it's a standalone utility.

**3. Create the 13-color data palette.**

Export a typed constant with both tones (light for cell fills, saturated for badges/dots):

```typescript
export const DATA_COLORS = [
  { name: 'Red', light: '#FEE2E2', saturated: '#DC2626' },
  { name: 'Orange', light: '#FFEDD5', saturated: '#EA580C' },
  { name: 'Amber', light: '#FEF3C7', saturated: '#D97706' },
  { name: 'Yellow', light: '#FEF9C3', saturated: '#CA8A04' },
  { name: 'Lime', light: '#ECFCCB', saturated: '#65A30D' },
  { name: 'Green', light: '#DCFCE7', saturated: '#16A34A' },
  { name: 'Teal', light: '#CCFBF1', saturated: '#0D9488' },
  { name: 'Cyan', light: '#CFFAFE', saturated: '#0891B2' },
  { name: 'Blue', light: '#DBEAFE', saturated: '#2563EB' },
  { name: 'Indigo', light: '#E0E7FF', saturated: '#4F46E5' },
  { name: 'Purple', light: '#EDE9FE', saturated: '#7C3AED' },
  { name: 'Pink', light: '#FCE7F3', saturated: '#DB2777' },
  { name: 'Gray', light: '#F1F5F9', saturated: '#64748B' },
] as const;
```

Include a `getDataColor(index: number)` function that cycles through the 13 colors.

**4. Create the text contrast lookup map.**

Precomputed text color pairs meeting WCAG AA (4.5:1 contrast):

```typescript
export const TEXT_CONTRAST_MAP: Record<string, string> = {
  // Light backgrounds → dark text
  '#FEE2E2': '#0F172A', '#FFEDD5': '#0F172A', '#FEF3C7': '#0F172A',
  '#FEF9C3': '#0F172A', '#ECFCCB': '#0F172A', '#DCFCE7': '#0F172A',
  '#CCFBF1': '#0F172A', '#CFFAFE': '#0F172A', '#DBEAFE': '#0F172A',
  '#E0E7FF': '#0F172A', '#EDE9FE': '#0F172A', '#FCE7F3': '#0F172A',
  '#F1F5F9': '#0F172A',
  // Saturated backgrounds → white text
  '#DC2626': '#FFFFFF', '#EA580C': '#FFFFFF', '#D97706': '#FFFFFF',
  '#CA8A04': '#FFFFFF', '#65A30D': '#FFFFFF', '#16A34A': '#FFFFFF',
  '#0D9488': '#FFFFFF', '#0891B2': '#FFFFFF', '#2563EB': '#FFFFFF',
  '#4F46E5': '#FFFFFF', '#7C3AED': '#FFFFFF', '#DB2777': '#FFFFFF',
  '#64748B': '#FFFFFF',
};

export function getContrastText(backgroundColor: string): string {
  return TEXT_CONTRAST_MAP[backgroundColor] ?? '#0F172A';
}
```

**5. Create the process state color language constants.**

```typescript
export const PROCESS_STATE_COLORS = {
  error: { token: 'error', hex: '#DC2626', meaning: 'Failed, needs attention' },
  warning: { token: 'warning', hex: '#D97706', meaning: 'Processing, in progress' },
  success: { token: 'success', hex: '#059669', meaning: 'Succeeded (transient)' },
} as const;
```

Green is always transient (1–2s flash then normal). Red and amber persist until resolved.

**6. Create the barrel export.**

`apps/web/src/lib/design-system/index.ts` re-exports everything from `colors.ts`.

**7. Write unit tests.**

Create `apps/web/src/lib/design-system/colors.test.ts`:
- Test that all 8 accent colors are defined and have valid hex values
- Test that `getDataColor()` cycles through 13 colors correctly
- Test that `getContrastText()` returns dark text for light backgrounds and white text for saturated backgrounds
- Test that `applyAccentColor()` sets the CSS custom property (mock `document.documentElement`)
- Test that `DEFAULT_ACCENT_COLOR` is Teal (#0D9488)

### Acceptance Criteria
- [ ] `WORKSPACE_ACCENT_COLORS` exports exactly 8 accent colors with name, hex, and tailwind fields
- [ ] `DATA_COLORS` exports exactly 13 data colors with light and saturated tones
- [ ] `getContrastText()` returns `#0F172A` for all 13 light tones and `#FFFFFF` for all 13 saturated tones
- [ ] `getDataColor(index)` wraps around at 13 (index 13 returns the same as index 0)
- [ ] All unit tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Accent color picker UI (Core UX — Settings > General > Branding)
- Database reads from `tenants.settings.branding_accent_color` (Phase 3 — workspace context provider)
- Kanban column header color rendering (post-MVP)
- Calendar event color rendering (post-MVP)
- Conditional formatting engine (Core UX)
- Dynamic theme generation or CSS-in-JS theming (portal theming is post-MVP)

---

## Prompt 3: Install and Customize Core shadcn/ui Primitives

**Depends on:** Prompt 1
**Skills:** ux-ui, phase-context
**Load context:** `design-system.md` lines 189–204 (Component Specifications)
**Target files:** `apps/web/components.json`, `apps/web/src/components/ui/*.tsx` (shadcn output), `apps/web/src/lib/utils.ts`
**Migration required:** No
**Git:** Commit with message `feat(ui): install and customize core shadcn/ui primitives [Phase 1F, Prompt 3]`

### Schema Snapshot
N/A — no schema changes.

### Task

**1. Initialize shadcn/ui in the web app.**

Run `npx shadcn@latest init` in `apps/web/`. Configure `components.json`:
- Style: `default`
- Base color: Use the EveryStack custom CSS variables (not a shadcn preset)
- CSS variables: `true`
- Components path: `src/components/ui`
- Utils path: `src/lib/utils.ts` (should use `clsx` + `tailwind-merge` via the `cn()` helper)

Ensure the shadcn initialization does NOT overwrite the `globals.css` or `tailwind.config.ts` customizations from Prompt 1. If it does, restore the EveryStack tokens and merge shadcn's required CSS variables alongside them.

**2. Install the following core primitives:**

```
Button, Input, Card, Dialog, DropdownMenu, Badge, Tooltip, Select,
Popover, Tabs, Sheet, Command, Label, Separator, ScrollArea, Skeleton
```

Use `npx shadcn@latest add <component>` for each.

**3. Customize primitives to match EveryStack component specs.**

After installation, modify the generated components:

**Button** (`button.tsx`):
- Variants: `primary` (textPrimary bg `#0F172A`, white text), `default` (white bg, `borderDefault` border), `ghost` (transparent bg)
- Sizes: `md` (default), `sm`
- Font weight: 600
- Border radius: 8px (`rounded`)
- Support an icon slot (left position)

**Card** (`card.tsx`):
- Background: `cardBg` (white)
- Border: 1px `borderDefault`
- Border radius: 12px (`rounded-lg`)
- Padding: 20px (`p-card-padding`)
- Hover state: darker border + shadow (`shadow-elevated`)

**Badge** (`badge.tsx`):
- Font size: 11px
- Font weight: 600
- Padding: 3px horizontal, 8px... wait — actually design-system.md says "3px/8px padding" which means 3px vertical, 8px horizontal
- Border radius: 5px
- Variants: `default`, `success`, `warning`, `error`, plus support for data-color variants (pass a color name to render with the data palette)

**Input** (`input.tsx`):
- Background: white
- Border: 1px `borderDefault`
- Border radius: 8px
- Focus state: blue-600 border + glow shadow (`ring-blue-600`)

**Skeleton** (`skeleton.tsx`):
- Pulse animation (shadcn default is fine)
- Should match layout shape — this is the convention for all loading states (no spinners)

**4. Create the `cn()` utility if not already present.**

`apps/web/src/lib/utils.ts` should export `cn()` using `clsx` + `tailwind-merge`:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Acceptance Criteria
- [ ] `components.json` is properly configured for the EveryStack monorepo paths
- [ ] All 16 shadcn/ui components are installed and importable
- [ ] Button renders 3 variants (primary, default, ghost) and 2 sizes (md, sm) with correct styling
- [ ] Card renders with 12px radius, 20px padding, 1px border, and hover shadow
- [ ] Badge renders at 11px font size with 5px radius and supports success/warning/error variants
- [ ] Input renders with 8px radius and blue-600 focus ring
- [ ] Skeleton uses pulse animation
- [ ] `cn()` utility merges Tailwind classes correctly
- [ ] ESLint and TypeScript compile with zero errors
- [ ] `pnpm turbo build` succeeds

### Do NOT Build
- Component Storybook or documentation pages
- Feature-specific compositions (DataTable, RecordCard, ChatFeed — Core UX)
- Command Bar component implementation (Core UX — Phase 3B)
- Any component not in the 16-component list above
- Dark mode variants (EveryStack uses fixed hybrid layout)

---

## Prompt 4: Typography Scale, Spacing Utilities, and Responsive Breakpoint System

**Depends on:** Prompt 1
**Skills:** ux-ui, phase-context
**Load context:** `design-system.md` lines 163–188 (Typography Scale, Spacing), lines 218–246 (Responsive Architecture), lines 261–273 (Shared Responsive Patterns)
**Target files:** `apps/web/src/lib/design-system/typography.ts`, `apps/web/src/lib/design-system/breakpoints.ts`, `apps/web/tailwind.config.ts` (extend), `apps/web/src/app/globals.css` (extend)
**Migration required:** No
**Git:** Commit with message `feat(ui): add typography scale, spacing utilities, and responsive breakpoint system [Phase 1F, Prompt 4]`

### Schema Snapshot
N/A — no schema changes.

### Task

**1. Define the 9-step typography scale.**

In `apps/web/src/lib/design-system/typography.ts`, export a typed constant:

```typescript
export const TYPOGRAPHY_SCALE = {
  'page-title': { size: '28px', weight: 700, lineHeight: '36px' },
  h1: { size: '24px', weight: 700, lineHeight: '32px' },
  h2: { size: '20px', weight: 600, lineHeight: '28px' },
  h3: { size: '18px', weight: 600, lineHeight: '24px' },
  'body-lg': { size: '16px', weight: 400, lineHeight: '24px' },
  body: { size: '14px', weight: 400, lineHeight: '20px' },
  'body-sm': { size: '13px', weight: 400, lineHeight: '18px' },
  caption: { size: '12px', weight: 400, lineHeight: '16px' },
  timestamp: { size: '11px', weight: 400, lineHeight: '14px' },
} as const;
```

No arbitrary sizes. All text uses these 9 steps.

**2. Add typography as Tailwind utilities.**

Extend `tailwind.config.ts` with `fontSize` entries mapping to the scale above. Each entry should include the font size and default line height:

```typescript
fontSize: {
  'page-title': ['28px', { lineHeight: '36px', fontWeight: '700' }],
  h1: ['24px', { lineHeight: '32px', fontWeight: '700' }],
  h2: ['20px', { lineHeight: '28px', fontWeight: '600' }],
  h3: ['18px', { lineHeight: '24px', fontWeight: '600' }],
  'body-lg': ['16px', { lineHeight: '24px' }],
  body: ['14px', { lineHeight: '20px' }],
  'body-sm': ['13px', { lineHeight: '18px' }],
  caption: ['12px', { lineHeight: '16px' }],
  timestamp: ['11px', { lineHeight: '14px' }],
}
```

**3. Define responsive breakpoints.**

In `apps/web/src/lib/design-system/breakpoints.ts`:

```typescript
export const BREAKPOINTS = {
  phone: { max: 767 },     // <768px
  tablet: { min: 768 },    // ≥768px
  desktop: { min: 1440 },  // ≥1440px
} as const;
```

Extend `tailwind.config.ts` screens if the default Tailwind breakpoints don't match:
```typescript
screens: {
  tablet: '768px',
  desktop: '1440px',
}
```

Note: Keep Tailwind's default `sm`, `md`, `lg`, `xl` breakpoints as well — just add the semantic `tablet` and `desktop` aliases. Prefer the semantic names in EveryStack code.

**4. Add touch target and tap spacing utilities.**

Add to `globals.css`:

```css
/* Touch target minimums (WCAG 2.5.8) */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}
.touch-target-lg {
  min-width: 48px;
  min-height: 48px;
}
.touch-target-primary {
  min-width: 56px;
  min-height: 56px;
}
/* Minimum tap spacing */
.tap-gap {
  gap: 8px;
}
```

**5. Add CSS logical property utilities or ESLint convention.**

Add a brief comment block in `globals.css` documenting the CSS logical properties convention:

```css
/*
 * CSS Logical Properties Convention:
 * Prefer margin-inline-start over margin-left
 * Prefer padding-block over padding-top/padding-bottom
 * Prefer inset-inline-start over left
 * Tailwind: use ms-* (margin-start), me-* (margin-end), ps-* (padding-start), pe-* (padding-end)
 */
```

Tailwind v3.3+ already supports logical property utilities (`ms-4`, `me-4`, `ps-4`, `pe-4`). No additional config needed — just document the convention.

**6. Update barrel export.**

Add `typography.ts` and `breakpoints.ts` to `apps/web/src/lib/design-system/index.ts`.

**7. Write unit tests.**

Create `apps/web/src/lib/design-system/typography.test.ts`:
- Test that TYPOGRAPHY_SCALE has exactly 9 entries
- Test that all font sizes are valid CSS values
- Test that no arbitrary sizes exist outside the scale

Create `apps/web/src/lib/design-system/breakpoints.test.ts`:
- Test that phone max is 767, tablet min is 768, desktop min is 1440
- Test that tablet and desktop breakpoints don't overlap

### Acceptance Criteria
- [ ] `TYPOGRAPHY_SCALE` exports exactly 9 type scale entries with size, weight, and lineHeight
- [ ] Tailwind `text-body`, `text-h1`, `text-page-title`, etc. utility classes work and render correct font sizes
- [ ] `tablet` and `desktop` responsive breakpoints work in Tailwind (e.g., `tablet:flex desktop:grid`)
- [ ] Touch target utility classes render correct minimum dimensions (44px, 48px, 56px)
- [ ] CSS logical property convention is documented in `globals.css`
- [ ] All unit tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Responsive layout components (Prompt 5)
- Mobile-specific bottom navigation bar (Phase 3H)
- Fluid typography or clamp-based scaling (not in spec — EveryStack uses fixed steps)
- Print stylesheets
- Animation utilities beyond skeleton pulse

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify all design system foundation work from Prompts 1–4 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo build` — successful build (fonts resolve, Tailwind config valid, shadcn components compile)
5. Manual verification: Create a temporary test page (`apps/web/src/app/design-test/page.tsx`) that renders:
   - A `<Button>` in all 3 variants (primary, default, ghost)
   - A `<Card>` with a `<Badge>` (success, warning, error variants)
   - An `<Input>` showing focus ring
   - A `<Skeleton>` element
   - Text in each of the 9 typography scale sizes
   - Verify DM Sans renders as the body font
   - Verify the sidebar-dark / content-white / accent-header color scheme is visible via CSS custom properties
6. Delete the test page after visual verification.

**Git:** Commit with message `chore(verify): integration checkpoint 1 — design tokens, primitives, and typography [Phase 1F, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Responsive Application Shell Layout

**Depends on:** Prompts 2, 3, 4
**Skills:** ux-ui, phase-context
**Load context:** `design-system.md` lines 44–57 (Foundations — dimensions), lines 205–217 (Application Shell — Responsive), lines 261–273 (Shared Responsive Patterns)
**Target files:** `apps/web/src/components/layout/app-shell.tsx`, `apps/web/src/components/layout/sidebar.tsx`, `apps/web/src/components/layout/header.tsx`, `apps/web/src/components/layout/main-content.tsx`, `apps/web/src/app/(app)/layout.tsx`
**Migration required:** No
**Git:** Commit with message `feat(ui): build responsive application shell with sidebar, header, and content area [Phase 1F, Prompt 5]`

### Schema Snapshot
N/A — no schema changes.

### Task

**1. Build the `AppShell` container component.**

`apps/web/src/components/layout/app-shell.tsx`:

This is the top-level layout wrapper for all authenticated pages. It composes the Sidebar, Header, and MainContent areas.

Layout structure:
```
┌─────────────────────────────────────────────────────┐
│ AppShell                                             │
│ ┌──────┬──────────────────────────────────────────┐  │
│ │      │  Header (52px, accent bg)                │  │
│ │      ├──────────────────────────────────────────┤  │
│ │ Side │                                          │  │
│ │ bar  │  MainContent (white bg, fills space)     │  │
│ │      │                                          │  │
│ │ 48/  │                                          │  │
│ │ 280  │                                          │  │
│ │      │                                          │  │
│ └──────┴──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

The shell uses CSS Grid or Flexbox. The sidebar is a fixed-width column; the header and content fill the remaining space.

**2. Build the `Sidebar` component.**

`apps/web/src/components/layout/sidebar.tsx`:

- Background: `sidebarBg` (`#0F1419`) — always dark
- Two states: collapsed (48px icon rail) and expanded (280px two-zone)
- Collapsed shows icon-only navigation items
- Expanded shows the icon rail + content zone (workspace tree placeholder)
- Toggle button positioned above avatar area
- Use `sidebarText` for primary text/icons, `sidebarTextMuted` for secondary text
- Active item uses `sidebarActive` background + 600 weight + 3px white left bar
- Hover uses `sidebarBgHover`
- Sidebar state persisted in localStorage (collapsed/expanded preference)
- Navigation items are placeholders for now — no actual routing, just visual slots:
  - Home icon
  - Workspaces icon (placeholder)
  - Settings icon (bottom)
  - Avatar area (bottom)

Desktop: Always visible, toggle between collapsed/expanded.
Tablet: Collapsed by default (48px icon rail), expandable on tap.
Mobile: Hidden by default — will be a hamburger drawer (implementation deferred to Phase 3H, but render nothing on mobile for now; a placeholder `<div>` is fine).

**3. Build the `Header` component.**

`apps/web/src/components/layout/header.tsx`:

- Height: 52px
- Background: `var(--accent)` (workspace accent color)
- Text/icons: white
- Layout: Flex row with:
  - Left: Breadcrumb area (placeholder text for now)
  - Center: Command Bar compact placeholder (300px wide, 36px height, white bg, search icon left, `⌘K` right, 8px radius) — just a static visual placeholder, no functionality
  - Right: Avatar placeholder (circle)
- Desktop: Full breadcrumbs + Command Bar + avatar
- Tablet: Condensed breadcrumbs + Command Bar + avatar
- Mobile: Page title + search icon (Command Bar and breadcrumbs hidden)

**4. Build the `MainContent` wrapper.**

`apps/web/src/components/layout/main-content.tsx`:

- Background: `contentBg` (white)
- Fills remaining space (flex-1 or grid area)
- Renders `children` passed from the route layout
- Padding: appropriate for content area
- Overflow: auto (content scrolls, shell stays fixed)

**5. Wire into the app route layout.**

Create or update `apps/web/src/app/(app)/layout.tsx` (the authenticated app route group):
- Wraps all authenticated pages in `<AppShell>`
- The `(app)` route group separates authenticated pages from public/portal routes

**6. Write component tests.**

Create component tests for AppShell, Sidebar, and Header:
- `app-shell.test.tsx`: Renders without crashing, contains sidebar + header + content areas
- `sidebar.test.tsx`: Renders collapsed by default, toggle expands to 280px, persists state to localStorage
- `header.test.tsx`: Renders with accent color background, shows Command Bar placeholder, adapts to breakpoints

### Acceptance Criteria
- [ ] `AppShell` renders a sidebar + header + content layout on desktop
- [ ] Sidebar renders at 48px collapsed width with icon-only items
- [ ] Sidebar expands to 280px when toggle is clicked
- [ ] Sidebar toggle state persists across page loads (localStorage)
- [ ] Sidebar uses all correct dark background tokens (`sidebarBg`, `sidebarBgHover`, `sidebarActive`)
- [ ] Header renders at 52px height with `var(--accent)` background color
- [ ] Header contains a static Command Bar compact placeholder (visual only)
- [ ] MainContent area is white (`contentBg`) and scrollable
- [ ] Layout adapts to tablet breakpoint (sidebar collapses)
- [ ] All component tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Actual navigation/routing logic in sidebar (Core UX)
- Command Bar functionality (Phase 3B)
- Quick Panel or Record View overlay areas (Core UX)
- Mobile hamburger drawer or bottom navigation (Phase 3H)
- Workspace tree / board hierarchy in sidebar (Core UX)
- Breadcrumb component with real route awareness (Core UX)
- User avatar dropdown with settings/logout (Core UX)

---

## Prompt 6: Install and Configure next-intl for App Router i18n

**Depends on:** Prompt 1
**Skills:** ux-ui, phase-context
**Load context:** `CLAUDE.md` lines 230–232 (TypeScript Rules — no hardcoded English strings), lines 95–98 (Key Commands — check:i18n)
**Target files:** `apps/web/src/i18n/request.ts`, `apps/web/src/i18n/routing.ts`, `apps/web/messages/en.json`, `apps/web/messages/es.json`, `apps/web/src/middleware.ts` (extend), `apps/web/next.config.ts` (extend), `apps/web/src/app/(app)/layout.tsx` (extend)
**Migration required:** No
**Git:** Commit with message `feat(i18n): install and configure next-intl with App Router and locale file structure [Phase 1F, Prompt 6]`

### Schema Snapshot
N/A — no schema changes.

### Task

**1. Install next-intl.**

```bash
cd apps/web && pnpm add next-intl
```

**2. Configure next-intl for the App Router.**

EveryStack uses a **non-routing approach** — we do NOT want `/en/dashboard` or `/es/dashboard` URL prefixes. The locale is determined by user preference (stored in user settings, defaulting to `en`). The URL structure stays clean.

Create `apps/web/src/i18n/request.ts`:
```typescript
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // For now, always return 'en'. In Core UX, this will read from user preferences.
  const locale = 'en';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Update `apps/web/next.config.ts` to use the next-intl plugin:
```typescript
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
// ... existing config
export default withNextIntl(nextConfig);
```

**3. Create the initial locale file structure.**

`apps/web/messages/en.json`:
```json
{
  "common": {
    "appName": "EveryStack",
    "loading": "Loading…",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "close": "Close",
    "search": "Search…",
    "noResults": "No results found"
  },
  "shell": {
    "sidebar": {
      "home": "Home",
      "workspaces": "Workspaces",
      "settings": "Settings",
      "expand": "Expand sidebar",
      "collapse": "Collapse sidebar"
    },
    "header": {
      "commandBarPlaceholder": "Search…",
      "commandBarShortcut": "⌘K"
    }
  }
}
```

`apps/web/messages/es.json`:
```json
{
  "common": {
    "appName": "EveryStack",
    "loading": "Cargando…",
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "close": "Cerrar",
    "search": "Buscar…",
    "noResults": "No se encontraron resultados"
  },
  "shell": {
    "sidebar": {
      "home": "Inicio",
      "workspaces": "Espacios de trabajo",
      "settings": "Configuración",
      "expand": "Expandir barra lateral",
      "collapse": "Contraer barra lateral"
    },
    "header": {
      "commandBarPlaceholder": "Buscar…",
      "commandBarShortcut": "⌘K"
    }
  }
}
```

The `es.json` file serves as a validation locale — it proves the i18n pipeline works end-to-end. It does not need to be production-quality Spanish.

**4. Wire the provider into the app layout.**

Update `apps/web/src/app/(app)/layout.tsx` to wrap children with `NextIntlClientProvider`:

```typescript
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <AppShell>{children}</AppShell>
    </NextIntlClientProvider>
  );
}
```

**5. Write a test to verify next-intl loads correctly.**

Create `apps/web/src/i18n/__tests__/i18n-setup.test.ts`:
- Test that `en.json` and `es.json` both parse as valid JSON
- Test that both locale files have the same top-level key structure (no missing namespaces)
- Test that no values in `en.json` are empty strings

### Acceptance Criteria
- [ ] `next-intl` is installed and configured with the next-intl plugin in `next.config.ts`
- [ ] `getRequestConfig()` returns `'en'` locale with English messages
- [ ] `messages/en.json` contains `common` and `shell` namespaces with all placeholder keys
- [ ] `messages/es.json` has the same key structure as `en.json`
- [ ] `NextIntlClientProvider` wraps the app layout and makes translations available to child components
- [ ] `useTranslations('common')` returns correct English strings in a component test
- [ ] `pnpm turbo build` succeeds with next-intl integrated
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Locale switcher UI (Core UX)
- User locale preference storage or reading from database (Core UX)
- URL-based locale routing (`/en/`, `/es/` prefixes — not used in EveryStack)
- Locale detection from browser `Accept-Language` header (future enhancement)
- Full Spanish translations (es.json is a validation placeholder only)
- RTL layout support (not in MVP scope)

---

## Prompt 7: Wire i18n Into Application Shell and Build check-i18n CI Script

**Depends on:** Prompts 5, 6
**Skills:** ux-ui, phase-context
**Load context:** `CLAUDE.md` lines 95–98 (Key Commands — check:i18n), lines 449–461 (Pre-Merge Gates — i18n completeness check)
**Target files:** `apps/web/src/components/layout/sidebar.tsx` (update), `apps/web/src/components/layout/header.tsx` (update), `apps/web/scripts/check-i18n.ts`, `apps/web/package.json` (add script), `turbo.json` (add pipeline entry)
**Migration required:** No
**Git:** Commit with message `feat(i18n): wire translations into shell components and build check-i18n CI script [Phase 1F, Prompt 7]`

### Schema Snapshot
N/A — no schema changes.

### Task

**1. Wire `useTranslations()` into the Sidebar component.**

Update `apps/web/src/components/layout/sidebar.tsx`:
- Import `useTranslations` from `next-intl`
- Initialize: `const t = useTranslations('shell.sidebar');`
- Replace ALL hardcoded English strings with `t()` calls:
  - "Home" → `t('home')`
  - "Workspaces" → `t('workspaces')`
  - "Settings" → `t('settings')`
  - "Expand sidebar" → `t('expand')` (aria-label on toggle button)
  - "Collapse sidebar" → `t('collapse')` (aria-label on toggle button)
- Any `aria-label`, `title`, or `placeholder` attributes with English text must also use `t()`

**2. Wire `useTranslations()` into the Header component.**

Update `apps/web/src/components/layout/header.tsx`:
- Import `useTranslations` from `next-intl`
- Initialize: `const t = useTranslations('shell.header');`
- Replace ALL hardcoded English strings with `t()` calls:
  - "Search…" placeholder → `t('commandBarPlaceholder')`
  - "⌘K" → `t('commandBarShortcut')`

**3. Build the `check-i18n.ts` CI script.**

Create `apps/web/scripts/check-i18n.ts`:

This script scans all `.tsx` files in `apps/web/src/` and reports any hardcoded English strings that should be using the i18n system.

**Detection rules:**
- Scan JSX text content: Any text node that contains alphabetic characters (not just whitespace, numbers, or symbols) is a violation.
- Scan string literal props: Props named `placeholder`, `title`, `aria-label`, `aria-description`, `alt` that contain English text are violations.
- Scan string literals in specific patterns: `toast(` or `toast.error(` etc. with hardcoded strings are violations.

**Exclusion rules (NOT violations):**
- Files in `__tests__/`, `*.test.tsx`, `*.test.ts`, `*.spec.ts` directories/files
- Import statements and require calls
- CSS class strings and Tailwind classes
- TypeScript type annotations and interface definitions
- `console.log`, `console.error` (should use Pino, but that's a lint rule, not i18n)
- `className` prop values
- Object keys and enum values
- String literals used as function arguments to non-rendering functions (e.g., `getDbForTenant('read')`)
- Comments
- `data-testid` and other `data-*` attributes
- Single-character strings or pure punctuation/symbols
- The literal strings `'use client'` and `'use server'`

**Output format:**
```
❌ i18n violations found:

  apps/web/src/components/layout/sidebar.tsx:42
    Hardcoded text: "Home"
    Suggestion: Use t('key') from useTranslations()

  apps/web/src/components/example.tsx:15
    Hardcoded prop placeholder="Enter name"
    Suggestion: Use t('key') for the placeholder prop

Found 2 violations in 2 files.
```

Exit code: 0 if no violations, 1 if violations found.

**Implementation approach:** Use TypeScript AST parsing (via `typescript` compiler API or a lightweight parser like `@babel/parser`) to properly parse JSX. Do NOT use regex-based detection — it will produce too many false positives. The script should:
1. Find all `.tsx` files in `apps/web/src/` (excluding test files)
2. Parse each file's AST
3. Walk JSX elements looking for:
   - `JSXText` nodes containing alphabetic characters
   - `JSXAttribute` nodes for tracked props (`placeholder`, `title`, `aria-label`, `aria-description`, `alt`) with `StringLiteral` values containing alphabetic characters
4. Report violations with file path and line number

**4. Register the script in the build pipeline.**

Add to `apps/web/package.json`:
```json
{
  "scripts": {
    "check:i18n": "tsx scripts/check-i18n.ts"
  }
}
```

Ensure `tsx` is available as a dev dependency (it should be from Phase 1A). If not, add it.

Add to `turbo.json` pipeline:
```json
{
  "check:i18n": {
    "dependsOn": []
  }
}
```

**5. Verify the script passes on current code.**

Run `pnpm turbo check:i18n` and confirm it finds zero violations (since Prompts 5 and 6 wired all shell text through `t()`).

**6. Verify the script catches violations.**

Temporarily add a hardcoded string to a component, run the script, and confirm it reports the violation. Remove the temporary change.

**7. Update component tests.**

Update `sidebar.test.tsx` and `header.test.tsx` to wrap components with `NextIntlClientProvider` (required for `useTranslations` to work in tests). The test utilities should include a helper for this:

Create `apps/web/src/test-utils/intl-wrapper.tsx`:
```typescript
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../messages/en.json';

export function IntlWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

### Acceptance Criteria
- [ ] Sidebar renders all text via `useTranslations('shell.sidebar')` — zero hardcoded English strings
- [ ] Header renders all text via `useTranslations('shell.header')` — zero hardcoded English strings
- [ ] `check-i18n.ts` script uses AST parsing (not regex) to detect hardcoded strings
- [ ] `pnpm turbo check:i18n` exits with code 0 on the current codebase (no violations)
- [ ] `pnpm turbo check:i18n` exits with code 1 when a hardcoded English string is added to a .tsx file (verified by temporary test)
- [ ] Script correctly excludes test files, CSS classes, imports, data attributes, and single-character strings
- [ ] Component tests pass with `IntlWrapper` providing translation context
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Locale switching logic or user preference storage (Core UX)
- Server-side translation for API error messages (later phases will handle this per domain)
- Translation management UI or import/export tools
- Automated translation via AI (post-MVP)
- ICU message format complexity beyond basic interpolation (add as needed in later phases)
- i18n for email templates (Phase 3C — Communications)

---

## Integration Checkpoint 2 (after Prompts 5–7)

**Task:** Verify the complete Phase 1F output — design system + application shell + i18n — integrates correctly and all CI gates pass.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — zero violations
4. `pnpm turbo test` — all pass
5. `pnpm turbo build` — successful production build
6. Manual verification:
   - Start the dev server (`pnpm dev`)
   - Navigate to the authenticated app shell
   - Verify: dark sidebar (collapsed at 48px), accent-colored header (Teal default), white content area
   - Click sidebar toggle — expands to 280px, shows labels via i18n
   - Verify all visible text comes from locale files (no hardcoded English)
   - Check browser dev tools: DM Sans as body font, correct CSS custom properties on `:root`
   - Resize browser: tablet breakpoint collapses sidebar, mobile hides sidebar
   - Check no console errors related to next-intl or missing translations

**Git:** Commit with message `chore(verify): integration checkpoint 2 — shell layout and i18n verified [Phase 1F, CP-2]`, then push branch to origin. Open PR to `main` with title "Phase 1F — Design System Foundation & i18n Framework".

Fix any failures before marking Phase 1F complete.

---

## Phase Complete Checklist

Before merging this PR, verify:

- [ ] All 7 implementation prompts completed
- [ ] Both integration checkpoints passed
- [ ] `pnpm turbo typecheck` — zero errors
- [ ] `pnpm turbo lint` — zero errors
- [ ] `pnpm turbo check:i18n` — zero violations (CI gate now functional)
- [ ] `pnpm turbo test` — all pass
- [ ] `pnpm turbo build` — successful
- [ ] Application shell renders correctly at desktop, tablet, and mobile breakpoints
- [ ] All UI text rendered through `useTranslations()` — no hardcoded English
- [ ] shadcn/ui primitives customized to EveryStack spec (Button variants, Card radius, Badge sizing, Input focus ring)
- [ ] Three-layer color architecture fully defined (surface tokens, accent colors, data palette, contrast map)
- [ ] Typography scale matches design-system.md (9 steps, no arbitrary sizes)
- [ ] Design system constants are typed and exported from `apps/web/src/lib/design-system/`

### Post-Merge Actions

1. **Tag the merge commit:** `v0.1.5-phase-1f`
2. **Update the phase-context skill:** Add Phase 1F outputs to `docs/skills/phase-context/SKILL.md`:
   - shadcn/ui primitives available at `apps/web/src/components/ui/`
   - Design system constants at `apps/web/src/lib/design-system/`
   - Application shell at `apps/web/src/components/layout/`
   - i18n messages at `apps/web/messages/`
   - i18n test wrapper at `apps/web/src/test-utils/intl-wrapper.tsx`
   - `check:i18n` CI gate is active
3. **Update the ux-ui skill:** Populate with the design system conventions established in this phase (color tokens, typography scale, component patterns, responsive breakpoints, i18n patterns)
4. **Next phase:** Phase 1G — Runtime Services: Real-Time Scaffold, Background Worker, File Upload
