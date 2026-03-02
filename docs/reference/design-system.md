# EveryStack — Design System

> **Reconciled: 2026-02-28** — Aligned with `GLOSSARY.md` (source of truth).
> **Changes this pass:**
> - "Interface Designer" → **App Designer** (2 occurrences, per glossary naming discipline)
> - "board view" → **Kanban view** in cross-refs (glossary term; post-MVP)
> - Tagged Kanban column headers and Calendar event color rules as **(post-MVP)** per glossary MVP scope
> - Tagged "wiki pages" in Pattern 1 Inline Create as **(post-MVP)**
> - Tagged Kanban/Calendar quick-create popovers as **(post-MVP)**
> - Removed legacy "Right Panel (Chat/Calendar tabs)" from Application Shell — replaced with glossary-aligned **Record View / Record Thread overlay** (right side) and **Quick Panels** (push-style panel between sidebar and main content)
> - Updated `panelBg` token description: "right panel" → Quick Panel / Record Thread backgrounds
> - Updated Foundations dimensions: removed legacy 360px right panel, added Record View overlay (60%) and Quick Panel (25%, between sidebar and main content) dimensions
> - "right panel chat" → **Record Thread panel** in Record View responsive table
> - Updated cross-references

> **Reference doc.** Color model, typography, spacing, component specs, application shell, responsive architecture, progressive disclosure, creation flow patterns.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `tables-and-views.md` (Grid view, Card view, Record View), `communications.md` (TipTap env 1 chat editor), `command-bar.md` (Command Bar compact/full specs), `mobile.md` (device tiers, ergonomic constraints, primary surfaces)
> Last updated: 2026-02-27

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Foundations | 44–57 | Dimensions: sidebar, main content, Quick Panel, Record View overlay, mobile breakpoints |
| Color Model — Hybrid Layout | 58–138 | Three-layer architecture: surface (fixed), workspace accent (admin-chosen), data palette (12 colors) |
| Process State Color Language | 139–152 | Semantic state colors: active, paused, completed, blocked, overdue, draft, pending |
| Text Contrast for Colored Surfaces | 153–162 | WCAG AA contrast rules, dark/light text selection algorithm |
| Typography Scale | 163–180 | Font sizes, weights, line heights, font family (Inter) |
| Spacing | 181–188 | 4px base unit, spacing scale from 4px to 64px |
| Component Specifications | 189–204 | Button variants, form fields, status badges, toggles, tooltips |
| Application Shell (Responsive) | 205–217 | Desktop/tablet/phone shell layout, sidebar collapse behavior |
| Responsive Architecture | 218–246 | Grid view column priority, Record View stacking, breakpoint transitions |
| Progressive Disclosure | 247–260 | Complexity levels, feature gating by plan tier, smart defaults |
| Shared Responsive Patterns | 261–273 | Collapsible sidebar, bottom sheets, swipe gestures |
| Ergonomic Design Constraints | 274–295 | Thumb zone mapping, one-handed use rules, touch targets |
| AI Credit Display Pattern | 296–312 | Credit badge, usage meter, cost preview, upgrade prompts |
| Creation Flow Patterns | 313–357 | 3 patterns: Inline Create, Wizard Create, Recipe Create; mapping discipline |

---

## Foundations

- **Fonts:** DM Sans (UI/headings), JetBrains Mono (code/technical)
- **Base unit:** 4px — all spacing multiples of 4
- **Border radius:** 8px standard, 12px large cards, 4px badges
- **Sidebar:** ~48px icon rail (collapsed) / ~280px two-zone expanded (icon rail + content zone). Expand toggle above avatar. Expanded state shows Quick Panel labels + Workspace tree (Boards → Workspaces).
- **Record View overlay:** 60% of main panel width (from right). With Record Thread: 55% + 25%.
- **Quick Panel (between sidebar and main content):** 25% of main panel width (push-style, workspace context). Sidebar remains collapsed at 48px; panel pushes main content right to 75%. In My Office context: 2/3 main panel rearrangement.
- **Header:** 52px height, workspace accent color background, white text/icons
- **Command Bar compact:** ~300px in header
- **Command Bar full:** ~640px centered overlay

---

## Color Model — Hybrid Layout

No dark/light mode toggle. One fixed appearance: always-dark sidebar, white content area, admin-chosen accent color on header bar. Clean, professional — similar to Slack, Linear, Notion.

### Surface Colors (Fixed)

| Token | Hex | Applied To |
|-------|-----|------------|
| `sidebarBg` | `#0F1419` | Sidebar background (always dark) |
| `sidebarBgHover` | `#1E2730` | Sidebar item hover |
| `sidebarText` | `#F1F5F9` | Sidebar primary text/icons |
| `sidebarTextMuted` | `#94A3B8` | Sidebar secondary text |
| `sidebarActive` | `rgba(255,255,255,0.12)` | Active nav item highlight |
| `contentBg` | `#FFFFFF` | Main content area |
| `panelBg` | `#F1F5F9` | Container headers, Quick Panel background, Record Thread background, table header row |
| `cardBg` | `#FFFFFF` | Cards, modals, dropdowns |
| `borderDefault` | `#E2E8F0` | Default borders |
| `borderSubtle` | `#F1F5F9` | Subtle dividers (grid lines, separators) |
| `bgElevated` | `#FFFFFF` | Elevated surfaces — shadow: `0 4px 16px rgba(0,0,0,0.08)` |
| `textPrimary` | `#0F172A` | Primary text |
| `textSecondary` | `#475569` | Secondary/descriptive text |
| `textTertiary` | `#94A3B8` | Placeholders, timestamps, captions |
| `success` | `#059669` | Success states |
| `warning` | `#D97706` | Warning states, in-progress |
| `error` | `#DC2626` | Error states |

### Workspace Accent Color (Admin-Chosen)

Selected during workspace setup (Settings > General > Branding). Applies **only to header bar** — not buttons, links, or badges.

**8 curated options:**

| Name | Hex | Tailwind Origin |
|------|-----|----------------|
| Teal | `#0D9488` | teal-600 |
| Ocean Blue | `#1D4ED8` | blue-700 |
| Indigo | `#4338CA` | indigo-700 |
| Deep Purple | `#7C3AED` | violet-600 |
| Rose | `#BE123C` | rose-700 |
| Amber | `#B45309` | amber-700 |
| Forest | `#15803D` | green-700 |
| Slate | `#334155` | slate-700 |

**Default:** Teal (`#0D9488`). All 8 pass ≥4.5:1 contrast with white text (WCAG AA).

**CSS:** `--accent` on `:root`, set from `tenants.settings.branding_accent_color`. Header renders `background-color: var(--accent)`.

**Where accent appears:** Header bar background, workspace logo badge in sidebar.

**Where accent does NOT appear:** Buttons, links, badges, pills, sidebar active state.

### Data Color Palette

13 colors for grids, Kanban views **(post-MVP)**, statuses, tags, conditional formatting, select options, calendar events. Each has two tones: **light** (pastel fills) and **saturated** (badges/dots).

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

**Usage rules:**
- **Cell fills / row tints:** Light tone, 100% opacity. Dark text always readable.
- **Status pills / badges / dots:** Saturated as background (white text) or as dot/icon on white.
- **Kanban column headers (post-MVP):** Saturated at ~10% opacity as background, saturated as 3px left-edge stripe.
- **Calendar events (post-MVP):** Saturated 3px left stripe, light background.

**Storage:** `color` enum on status options, select options, etc. Renderer looks up both tones. Default cycles through 13 colors.

---

## Process State Color Language

Universal across all surfaces:

| Color | Meaning | Token | Examples |
|---|---|---|---|
| **Red** | Failed, needs attention | `error` | Sync error, validation failure, automation failure |
| **Amber** | Processing, in progress | `warning` | Cascade updating, sync in progress, import running |
| **Green** | Succeeded | `success` | Sync complete, action confirmed (1–2s flash then normal) |

Green is always transient. Red and amber persist until resolved.

---

## Text Contrast for Colored Surfaces

Precomputed text color pairs meeting WCAG AA (4.5:1):
- **Light backgrounds** → `textPrimary` (`#0F172A`)
- **Dark backgrounds** → `#FFFFFF`

Stored as lookup map in design system constants. All renderers reference map, not runtime computation.

---

## Typography Scale

| Size | Use |
|------|-----|
| 11px | Timestamps, footnotes |
| 12px | Captions, badges |
| 13px | Body small |
| 14px | Body default |
| 16px | Body large, Command Bar input |
| 18px | H3 |
| 20px | H2 |
| 24px | H1 |
| 28px | Page title |

No arbitrary sizes. All text uses these 9 steps.

---

## Spacing

- **Card padding:** 20px
- **Section gaps:** 16px between cards, 28px between sections
- **Mobile bottom nav:** 56px

---

## Component Specifications

All primitives are **shadcn/ui**, customized via Tailwind + CSS custom properties. Complex compositions (grid, App Designer **(post-MVP)**, automation builder) compose shadcn primitives.

| Component | Spec |
|-----------|------|
| **Buttons** | Primary (`textPrimary` bg, white text), Default (white, border), Ghost (transparent). Sizes: md, sm. 600 weight, 8px radius, icon slot. |
| **Cards** | `cardBg`, 1px `borderDefault`, 12px radius, 20px padding. Hover: darker border + shadow. |
| **Badges** | 11px, 600 weight, 3px/8px padding, 5px radius. Variants: default, data-color, success, warning, error. |
| **Inputs** | White, 1px `borderDefault`, 8px radius. Focus: blue-600 border + glow shadow. |
| **Sidebar Nav** | 20px icon, white text. Active: `sidebarActive` bg, 600 weight, 3px white bar. Hover: `sidebarBgHover`. |
| **Command Bar Compact** | 300px, 36px height, white bg, search icon left, ⌘K right, 8px radius. |
| **Command Bar Full** | 640px centered overlay, 12px radius, white bg, deep shadow, 70vh max. |

---

## Application Shell (Responsive)

| Zone | Desktop (≥1440) | Tablet (≥768) | Mobile (<768) |
|------|----------------|--------------|--------------|
| Left Sidebar | ~48px icon rail, expands to ~280px via toggle button (above avatar). Always dark. | ~48px icon rail, expand on tap | Hidden, hamburger drawer (~280px, dark) |
| Header | 52px, accent bg, breadcrumbs + Command Bar + avatar | Condensed breadcrumbs + Command Bar + avatar | Page title + hamburger + search icon |
| Main Panel | White, fills remaining space | Fills remaining space | Full width |
| Record View / Record Thread (overlay) | Record View 60% from right. +Record Thread = 55% + 25%. Main dimmed behind. | Same proportions, overlay with scrim | Full-screen sheet. Record Thread via bottom tabs. |
| Quick Panels | Workspace context: 25% side panel, main pushes to 75%. My Office context: 2/3 main panel rearrangement. | Same | Bottom tab bar (Chat, Tasks, Calendar) |
| Bottom Nav | N/A | N/A | 56px fixed — Workspace: Home, Chat, Calendar, Workspaces, More; My Office: Tasks, Chat, Calendar, + |

---

## Responsive Architecture

**Breakpoints:** Desktop ≥1440px, Tablet ≥768px, Mobile <768px.

**Principle:** Desktop = Build, Tablet = Build & Operate, Mobile = Operate & Consume.

**Tablets are small computers, not wide phones.** Inline grid editing, side-by-side panels, condensed toolbars. Builder tools phased: view & light edit now, full touch builders post-MVP.

**Touch input on builder surfaces (≥1024px).** App Designer **(post-MVP)**, Automation Builder render desktop UI unchanged on 10"+ tablets. Two accommodations: (1) drag = long-press (200ms), (2) no hover-only interactions — tooltips on long-press, previews on tap.

### Table Grid View

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Layout | Full grid, horizontal scroll | Same, fewer columns | Card list. Toggle to grid available. |
| Toolbar | Full button bar | Collapsed to icons + "…" | Sticky: Search + Filter + "…" |
| Cell editing | Click → inline. Tab/Enter nav. | Tap → inline | Tap card → Record View (full-screen) |
| +New Record | Button below last row | Same | FAB, bottom-right, 56px |

### Record View

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Record View | Card in main panel + Record Thread panel | Card fills main panel. Record Thread overlay. | Full-screen. Record Thread via bottom sheet. |
| Expand Record | 800px modal, 80vh | 90% width, 85vh | Full-screen sheet, swipe down close |
| Field layout | Two-column grid | Two-column | Single column, stacked |

---

## Progressive Disclosure

**Three levels across all features:**

- **Level 1 — Default View (80%):** No jargon. Templates/recipes as entry points. 6–8 common actions. Feels complete.
- **Level 2 — Expanded View (15%):** One click deeper. Full option sets. Still visual, guided.
- **Level 3 — Power View (5%):** Expert mode. Custom code, raw expressions, cron syntax.

**Patterns:** Smart defaults + escape hatches, "Advanced" accordions collapsed by default, action tiering, contextual revelation, recipes as entry points.

**Mobile:** Level 1 is entire visible surface. Level 2 requires deliberate navigation. Level 3 not available on phone (tablet or desktop). Every mobile screen complete at Level 1.

---

## Shared Responsive Patterns

- **Touch targets:** Min 44×44px (WCAG 2.5.8). **48px action buttons. 56px primary actions** (FAB, submit, send).
- **Tap spacing:** 8px minimum gap between tappable elements.
- **Swipe:** Left = destructive, Right = primary, Long press = context menu.
- **Modals:** Desktop = centered (max 800px). Tablet = 90% width. Mobile = full-screen bottom sheet.
- **Action sheets:** Multi-option menus → bottom sheets on mobile.
- **Loading:** Skeleton screens (not spinners). Match layout shape. Pulse animation.
- **Pull to refresh:** All mobile lists/feeds. Haptic on trigger.
- **Keyboard avoidance:** Scroll input into view. Chat input above keyboard.

---

## Ergonomic Design Constraints

**Mandatory for phone layouts (<768px).** See `mobile.md` for full spec.

### Thumb Zone

| Zone | Position | Content |
|------|----------|---------|
| **Bottom (0–40%)** | Easiest reach | Primary actions (FAB, submit, send), bottom nav, chat input |
| **Middle (40–70%)** | Comfortable | Scrollable content (cards, messages, fields) |
| **Top (70–100%)** | Hardest reach | Navigation (back, close, title), destructive actions |

### One-Handed Use

- No essential interactions in top-left corner
- Horizontal swipe gestures, not vertical stretches
- Bottom sheets, not top modals
- Back via swipe-from-edge
- Submit/send/confirm always at bottom

---

## AI Credit Display Pattern

Credit cost shown **before** execution (informed consent), never during/after.

**Format:** `✨ N credits` in `textTertiary`, 11px. Badge on the action trigger (button, menu item, option card).

| Surface | Trigger Element | Example |
|---------|----------------|---------|
| Automation creation | AI-generated recipe card | `✨ 8 credits` |
| Portal creation | AI-Generated template card | `✨ 20 credits` |
| Command Bar (explicit `?`) | Search input | `✨ 1 credit` badge |
| Command Bar (organic AI) | AI result group header | `✨ AI-powered` label |

**Where credits never appear:** Results, output, confirmation dialogs, on-save indicators.

---

## Creation Flow Patterns

Three standard patterns. Every creation flow maps to exactly one.

### Pattern 1: Inline Create

**For:** Data records — created dozens of times daily.

Fast, contextual, template-optional. In-place, no wizard/modal (or minimal popover).

**Entry points:** Grid new-row, quick-create popover (Calendar view **(post-MVP)**, Kanban view **(post-MVP)** "+"), `/new record`, FAB, inline sub-table "Add Row", cross-link picker "Create new."

**Template integration:** Split button — primary = default template (or blank), chevron = picker.

**Applies to:** Table records, personal tasks, personal events, wiki pages **(post-MVP)**, chat messages.

### Pattern 2: Wizard Create

**For:** Configured entities requiring multi-step setup (bind to data, structural decisions).

2–3 steps max. Step 1 = starting-point picker. Final step = builder/editor with template applied.

**Standard steps:**
1. **Choose starting point** — Template cards (includes "Start from Scratch" and "AI-Generated")
2. **Connect to data** — Table picker, scoping field
3. **Name and configure** — Name, URL/slug, theme, settings

**Applies to:** Portals, forms.

### Pattern 3: Recipe Create

**For:** Logic entities where pre-built templates provide highest-leverage start.

Recipe-first (Level 1). "Start from scratch" secondary. AI-generated at Level 2.

**Standard flow:**
1. **Recipe picker** — Pre-built in plain language, by category
2. **Configure specifics** — Fill variables (which table, field, email)
3. **Review and activate**

**Applies to:** Automations, AI prompt templates.

### Mapping Discipline

When specifying a new creation flow in any doc, identify which pattern it follows. If a flow doesn't fit, redesign the flow — not the pattern. Three patterns is the maximum.
