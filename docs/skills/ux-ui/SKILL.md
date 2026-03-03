---
name: everystack-ux-ui
description: >
  Frontend engineering and design system patterns for EveryStack's workspace UI.
  Use this skill for ANY prompt that builds React components, page layouts,
  views (Grid, Card, Record), navigation, modals, forms, interactive editors,
  or any user-facing interface. Triggers on: component creation, view rendering,
  design system usage, responsive layouts, shadcn/ui components, TipTap editors,
  progressive disclosure patterns, mobile-safe layouts, color architecture,
  or anything in apps/web/src/components, apps/web/src/app, or e2e tests.
  Also use when the prompt references three-layer color, DM Sans, spacing scale,
  Command Bar, Record View, or portal UI. If a prompt builds something a user
  will see or interact with, this skill applies.
---

# EveryStack UX/UI Skill

This skill encodes the frontend engineering and design system conventions
for EveryStack. It ensures visual consistency, accessibility, and the
progressive disclosure philosophy across all user-facing features.

## When to Use This Skill

- **Always** for Phase 1C (Design System)
- **Always** for all Phase 3 sub-phases (3A–3H)
- **Selectively** for Phase 4 (automation step builder UI), Phase 5
  (AI feature affordances), Phase 6 (API key management UI)
- **Combine with backend skill** when a prompt touches both data access
  and component rendering (common in Phase 3)

---

## Design System Foundation

### Typography

| Role | Font | Loaded via |
|------|------|------------|
| **UI text** | DM Sans | `apps/web/src/lib/fonts.ts` (next/font/google) |
| **Code / data** | JetBrains Mono | `apps/web/src/lib/fonts.ts` (next/font/google) |

**9-step type scale** (defined in `apps/web/src/lib/design-system/typography.ts`):

| Step | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| `page-title` | 28px | 700 | 36px | Page headings |
| `h1` | 24px | 700 | 32px | Section headings |
| `h2` | 20px | 600 | 28px | Subsection headings |
| `h3` | 18px | 600 | 24px | Card titles |
| `body-lg` | 16px | 400 | 24px | Emphasized body |
| `body` | 14px | 400 | 20px | Default body text |
| `body-sm` | 13px | 400 | 18px | Secondary text |
| `caption` | 12px | 400 | 16px | Labels, helper text |
| `timestamp` | 11px | 400 | 14px | Timestamps, metadata |

**Rule:** No arbitrary font sizes. All text uses one of these 9 steps via Tailwind classes or the `TYPOGRAPHY_SCALE` constant.

### Three-Layer Color Architecture

Defined in `apps/web/src/lib/design-system/colors.ts`. Three independent layers that compose without conflict:

**Layer 1 — Workspace Accent (8 colors):**
- Set per workspace in Settings, applied to the header bar
- CSS variable: `--workspace-accent` (set via `applyAccentColor(hex)`)
- 8 curated colors: Teal (#0D9488), Ocean Blue (#1D4ED8), Indigo (#4338CA), Deep Purple (#7C3AED), Rose (#BE123C), Amber (#B45309), Forest (#15803D), Slate (#334155)
- All pass >= 4.5:1 contrast ratio with white text (WCAG AA)
- Default: Teal (#0D9488)

**Layer 2 — Semantic / Process States (Fixed):**
- Error: #DC2626, Warning: #D97706, Success: #059669
- Exposed as `PROCESS_STATE_COLORS` constant
- Hard-coded in the design system, not themeable

**Layer 3 — Data Colors (13-color palette):**
- For statuses, tags, select options, row tints
- Each color has two tones: `light` (pastel fill) and `saturated` (badge/dot)
- 13 colors: Red, Orange, Amber, Yellow, Lime, Green, Teal, Cyan, Blue, Indigo, Purple, Pink, Gray
- Access via `getDataColor(index)` (cycles through palette)
- Text contrast via `getContrastText(bgColor)` — precomputed lookup, no runtime calculation

**Surface tokens** (CSS custom properties in `globals.css`):
- `--background`, `--foreground`, `--card`, `--muted`, `--accent`, `--border`, etc.
- Sidebar uses dedicated tokens: `--sidebar-background: #1E293B`, `--sidebar-foreground`, etc.

**Rule:** Never mix layers. A workspace accent color should never be used for data annotation, and a semantic color should never be user-configurable.

### Spacing Scale

Base unit: 4px. All spacing multiples of 4. Use Tailwind's default spacing scale:
- **Card padding:** `p-4` (16px)
- **Section gaps:** `gap-6` (24px)
- **Inline element gaps:** `gap-2` (8px)
- **Modal padding:** `p-6` (24px)
- **Grid cell padding:** `px-3 py-2` (12px / 8px)
- **Touch targets:** minimum 44x44px (WCAG 2.5.8)

### Responsive Breakpoints

Defined in `apps/web/src/lib/design-system/breakpoints.ts` and registered as Tailwind screen aliases:

| Name | Range | Purpose |
|------|-------|---------|
| `phone` | < 768px | Operate & Consume |
| `tablet` | >= 768px | Build & Operate |
| `desktop` | >= 1440px | Build |

Use semantic breakpoint names (`phone:`, `tablet:`, `desktop:`) alongside standard Tailwind (`sm`, `md`, `lg`, `xl`).

### shadcn/ui Components (16 installed)

Located at `apps/web/src/components/ui/`. Configured via `apps/web/components.json`.

**Installed primitives:** Badge, Button, Card, Command, Dialog, DropdownMenu, Input, Label, Popover, ScrollArea, Select, Separator, Sheet, Skeleton, Tabs, Tooltip.

```typescript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
```

**Customizations applied:**
- Button: EveryStack-specific variant classes, accent color integration
- Card: Radius matched to design tokens
- Badge: Sizing aligned to data palette
- Input: Focus ring using accent color

**Rules:**
- Always use shadcn/ui primitives when they exist — never build custom
  buttons, inputs, dialogs, dropdowns, or tooltips from scratch
- Extend with composition, not duplication
- shadcn components are in `apps/web/src/components/ui/`
- EveryStack-specific compound components are in `apps/web/src/components/`

### Application Shell Layout

Defined in `apps/web/src/components/layout/`:

| Component | File | Description |
|-----------|------|-------------|
| `AppShell` | `app-shell.tsx` | Root: sidebar + header + content, `block-size: 100dvh` |
| `Sidebar` | `sidebar.tsx` | Dark (#1E293B), collapsible 48px/280px, workspace nav |
| `Header` | `header.tsx` | Accent-colored, 52px height, command bar placeholder |
| `MainContent` | `main-content.tsx` | White content area, scrollable |

**Sidebar store:** `apps/web/src/stores/sidebar-store.ts` (Zustand) — `collapsed` state + `setCollapsed` / `toggleCollapsed`.

**Layout rule:** No dark/light mode toggle. Hybrid layout: always-dark sidebar, white content, admin-chosen accent header.

### i18n Patterns

Framework: next-intl with non-routing locale strategy.

**Key files:**
- `apps/web/messages/en.json` — English translations (source of truth)
- `apps/web/messages/es.json` — Spanish translations
- `apps/web/src/i18n/request.ts` — Locale request config
- `apps/web/src/test-utils/intl-wrapper.tsx` — IntlWrapper for component tests
- `scripts/check-i18n.ts` — AST-based CI gate (`pnpm turbo check:i18n`)

**Usage in components:**
```tsx
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('namespace');
  return <h1>{t('title')}</h1>;
}
```

**Testing with translations:**
```tsx
import { IntlWrapper } from '@/test-utils/intl-wrapper';

render(<IntlWrapper><MyComponent /></IntlWrapper>);
```

**Rules:**
- No hardcoded English strings in UI code — CI enforces this
- All user-facing text through `useTranslations()`
- Namespace keys match component/feature names

---

## Progressive Disclosure Philosophy

This is EveryStack's core UX principle. Every interface has two modes:

**Simple Mode (default):**
- Shows the essential controls only
- First-time users can accomplish the task without confusion
- No configuration panels, advanced options, or power-user shortcuts visible

**Power Mode (opt-in):**
- Revealed via "Advanced" toggles, gear icons, or Command Bar shortcuts
- Adds filtering, bulk operations, custom configurations
- Never removes Simple Mode controls — only adds to them

**Implementation pattern:**
```tsx
const [showAdvanced, setShowAdvanced] = useState(false);

return (
  <div>
    {/* Always visible — Simple Mode */}
    <CoreControls />

    {/* Progressive disclosure toggle */}
    <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}>
      {showAdvanced ? 'Hide options' : 'More options'}
    </Button>

    {/* Power Mode — conditionally rendered */}
    {showAdvanced && <AdvancedControls />}
  </div>
);
```

**Rule:** If you're unsure whether a control belongs in Simple or Power mode,
default to Power mode. It's easier to promote a control than to demote one.

---

## View Rendering Patterns

### Grid View (Table)

- Virtual scrolling for large datasets (react-virtual or similar)
- Cell renderers per field type (text, number, date, status, etc.)
- Inline editing on double-click (not modal)
- Column resizing and reordering (drag handles)
- Fixed first column (record name) on horizontal scroll

**Cell renderer pattern:**
```tsx
// apps/web/src/components/views/grid/cell-renderers/
export function TextCellRenderer({ value, field, onEdit }: CellRendererProps) {
  // Read-only display
  // Double-click → inline edit mode
  // Blur or Enter → save via onEdit callback
}
```

Each field type gets its own renderer file. The Grid view dispatches
to the correct renderer based on `field.field_type`.

### Card View

- Responsive grid: 1 column mobile, 2 columns tablet, 3+ columns desktop
- Card shows: record name, 3–5 configured fields, status badge
- Click card → opens Record View overlay

### Record View (Overlay)

- Slides in from right as an overlay panel (not a new page)
- Left column: field values (editable)
- Right column: activity feed, linked records, attachments
- Tab bar at bottom: Details | Activity | Links
- Close via X button, Escape key, or clicking backdrop

**Important:** Record View is an overlay on top of the current view,
not a route change. The URL updates (for shareability) but the Grid/Card
view remains rendered behind the overlay.

---

## Responsive / Mobile-Safe Patterns

**For non-mobile prompts (Phases 3A–3G):**
- Use responsive Tailwind classes on all layouts
- Grid → single column on mobile breakpoints
- Avoid fixed widths — use `max-w-` and percentage-based layouts
- Do NOT build mobile-specific navigation or bottom bars
  (that's Phase 3H)

**Pattern:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid that stacks on mobile */}
</div>
```

**Phase 3H (Mobile) adds:**
- Bottom tab navigation bar (two-layer)
- Quick Panels (swipe-up drawers)
- Single-column Record View (no side panel)
- Workspace tile selector (home screen)
- Touch-optimized hit targets (min 44px)

---

## Component File Organization

```
apps/web/src/components/
├── ui/                  → shadcn/ui primitives (do not modify)
├── views/
│   ├── grid/            → Grid view components + cell renderers
│   ├── card/            → Card view components
│   └── record/          → Record View overlay
├── navigation/
│   ├── sidebar.tsx       → Workspace sidebar
│   ├── command-bar.tsx   → Command Bar (⌘K)
│   └── breadcrumbs.tsx   → Context breadcrumbs
├── forms/               → Form components (Quick Forms)
├── portals/             → Portal shell and auth screens
├── communications/      → Thread, message, DM components
├── documents/           → Smart Doc editor (TipTap env 2)
├── automations/         → Step builder, trigger/action cards
├── ai/                  → AI affordance UI (Smart Fill, suggestions)
└── shared/              → Cross-cutting components (loading, empty states)
```

**Naming:** PascalCase for components, kebab-case for files.
`grid-toolbar.tsx` exports `GridToolbar`.

---

## TipTap Editor Environments

EveryStack uses TipTap in two distinct configurations:

**Environment 1 — Chat Editor (Communications):**
- Compact, single-line default (expands on multiline input)
- Minimal toolbar: bold, italic, link, mention, emoji
- Enter sends message, Shift+Enter adds newline
- Used in: Record Thread, DMs, group DMs

**Environment 2 — Smart Doc Editor (Documents):**
- Full-page editor with floating toolbar
- Rich formatting: headings, lists, tables, images, code blocks
- Merge tags: `{{field.name}}`, `{{record.id}}`, `{{workspace.name}}`
- AI draft button: generates content from record context
- Used in: Smart Docs, document templates

**Rule:** Never mix environments. The chat editor should never get
document-level features, and the Smart Doc editor should never behave
like a chat input.

---

## E2E Testing (Playwright)

E2E tests live in `apps/web/e2e/`:

```typescript
// apps/web/e2e/grid-view.spec.ts
import { test, expect } from '@playwright/test';
import { createTestWorkspace } from './fixtures/workspace';

test('Grid view renders records with correct field values', async ({ page }) => {
  const { workspace, records } = await createTestWorkspace();
  await page.goto(`/workspace/${workspace.id}/table/${records[0].tableId}`);
  // ... assertions
});
```

**Rules:**
- One spec file per feature area
- Use fixtures for workspace/tenant setup
- Test the critical user path, not every permutation
- Mobile viewport tests go in `e2e/mobile/` (Phase 3H only)

---

## Accessibility Baseline

- All interactive elements have visible focus indicators
- Color is never the sole indicator of state (always pair with icon or text)
- Form inputs have associated labels (even if visually hidden)
- Modal dialogs trap focus
- Escape key closes overlays and dropdowns
- `aria-label` on icon-only buttons

---

## Checklist Before Every UI Commit

- [ ] Components use shadcn/ui primitives (not custom recreations)
- [ ] Color usage follows three-layer architecture (no layer mixing)
- [ ] Layout is responsive (stacks on mobile breakpoints)
- [ ] Progressive disclosure: default state is Simple Mode
- [ ] Text uses DM Sans / JetBrains Mono (no other fonts)
- [ ] Font sizes from 9-step typography scale only (no arbitrary sizes)
- [ ] All user-facing strings use `useTranslations()` (no hardcoded English)
- [ ] `pnpm turbo check:i18n` passes
- [ ] Interactive elements have focus indicators
- [ ] Loading states use skeleton screens (not spinners)
- [ ] Empty states exist for zero-data scenarios
- [ ] E2E test covers the critical user path
- [ ] No mobile-specific UI outside Phase 3H
