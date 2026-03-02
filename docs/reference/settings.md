# EveryStack — Settings Architecture

> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Replaced "portal designer" with "portal configuration panel" — MVP portals are Record View configurations with auth wrappers, not App Designer outputs. (2) Tagged "portal custom domain list" in Branding as post-MVP. (3) Tagged "CockroachDB region selection" in Advanced as post-MVP.

> **Reference doc (Tier 3).** Workspace settings page layout, navigation, section taxonomy, setting ownership (who can change what), mobile behavior.
> Cross-references: `CLAUDE.md` (workspace roles, permission model), `design-system.md` (progressive disclosure, responsive architecture), `permissions.md` (role-based access), `ai-metering.md` (AI credit visibility, plan limits), `communications.md` (notification preferences), `booking-scheduling.md` (working hours, default calendar), `compliance.md` (data privacy settings, GDPR), `command-bar.md` (`/settings` slash command), `my-office.md` (personal preferences vs workspace settings)
> Last updated: 2026-02-27 — Glossary reconciliation (see note above). Prior: 2026-02-23 — Added accent color picker to Branding section; removed dark/light mode from personal preferences (no toggle — single fixed appearance). Prior: Initial specification from UX audit finding D5-3.

---

## Design Principle

Settings are where configuration complexity goes to live. The goal is: **a Manager changes 3-5 settings when setting up, and then rarely returns.** Settings should never be the primary workflow for any task — feature-specific configuration happens in context (field settings in the field config panel, automation settings in the automation builder, portal settings in the portal configuration panel). The Settings page is for workspace-wide defaults and administrative functions.

---

## Settings Page Layout

Full-page route: `/workspace/{id}/settings`. Accessible via sidebar gear icon (bottom of nav) and `/settings` Command Bar command.

**Layout:** Left sidebar navigation (240px) + content area (fills remaining, max 720px centered). No right panel. Clean, form-oriented layout.

### Section Navigation

Sections are grouped by audience — settings a Manager touches monthly at top, settings an Admin touches once at bottom.

| Section             | Icon          | Accessible By                           | Summary                                                                                                                                                                                          |
| ------------------- | ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **General**         | Settings gear | Manager+                                | Workspace name, timezone, week start day, date/number format, working hours, default calendar                                                                                                    |
| **Members & Roles** | Users         | Admin+                                  | Invite members, assign roles, manage seats (builder vs consumer), pending invitations, deactivated users                                                                                         |
| **Billing & Plan**  | Credit card   | Owner only                              | Current plan, usage meters (records, automations, AI credits, storage), upgrade/downgrade, payment method, invoice history                                                                       |
| **AI & Credits**    | Sparkle       | Admin+                                  | AI credit balance, auto-top-up settings, credit usage breakdown by feature, AI model preferences (default tier)                                                                                  |
| **Integrations**    | Plug          | Manager+ (connect), Admin+ (disconnect) | Connected services overview (sync platforms, email, payments, storage, calendar). Quick status view — detailed config in Automation Builder's Integrations tab                                   |
| **Branding**        | Palette       | Manager+                                | **Accent color picker** (8 curated colors — applies to header bar), workspace logo, default portal theme, email template branding (logo, colors, footer), portal custom domain list _(post-MVP)_ |
| **Notifications**   | Bell          | All roles (personal)                    | Per-user notification preferences: in-app, email digest frequency, push notification categories, mute schedule. Personal setting — not workspace-wide.                                           |
| **Data & Privacy**  | Shield        | Admin+                                  | Data retention policies, export workspace data, GDPR tools (PII registry link, right-to-erasure), audit log access, API key management                                                           |
| **Advanced**        | Terminal      | Owner only                              | Danger zone: transfer ownership, delete workspace. Environment configuration (if applicable). CockroachDB region selection _(post-MVP — Enterprise)_                                             |

### Section Layout Pattern

Every section follows the same layout:

1. **Section header** — Section name (20px, `textPrimary`, 600 weight) + one-line description (`textSecondary`, 14px)
2. **Setting groups** — Labeled groups of related settings, separated by subtle dividers. Each group has a group label (14px, `textSecondary`, 500 weight, uppercase).
3. **Setting rows** — Label (left, 14px) + control (right-aligned: toggle, select, text input, or button). Description text below label in `textTertiary`. Two-column on desktop (label/control side-by-side), single-column stacked on mobile.
4. **Save behavior** — Settings auto-save on change (toggle, select) or on blur (text inputs). No explicit save button. Success confirmation: subtle green checkmark animation next to the changed control (1.5s, then fades).

### Progressive Disclosure in Settings

- **Level 1:** General, Members & Roles, Notifications. These are the sections most users ever touch.
- **Level 2:** Billing, AI & Credits, Integrations, Branding. Manager/Admin territory.
- **Level 3:** Data & Privacy, Advanced. Rare, high-impact settings.

The sidebar shows all sections (no hiding), but sections the user can't access due to role are visible with a lock icon and "Requires [Role]" tooltip. This teaches users what settings exist without creating dead ends.

---

## Personal vs Workspace Settings

Settings that affect the entire workspace (General, Members, Billing, Branding, Data) live in the workspace Settings page. Settings that affect only the current user (Notifications, display preferences) could live either in Settings or in the user's profile menu.

**Decision:** Notifications live in Settings (under the user's personal section) because they're workspace-scoped (different notification preferences per workspace). Display preferences (language, date format override) live in the user profile menu (top-right avatar → Preferences) because they're global across all workspaces. Note: there is no dark/light mode toggle — the platform has a single fixed appearance (see `design-system.md > Color Model`).

---

## Functional Specification

### API & Persistence

Settings are stored in two locations:

| Setting scope                                        | Storage                                           | Table                           |
| ---------------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| Workspace settings (General, Branding, Integrations) | `workspaces.settings` JSONB                       | `workspaces`                    |
| Notification preferences                             | `user_notification_preferences.preferences` JSONB | `user_notification_preferences` |
| Billing & Plan                                       | `tenants.plan` + Stripe metadata                  | `tenants`                       |
| AI & Credits                                         | `ai_usage_log` aggregates + `tenants.plan` limits | Multiple                        |
| Member management                                    | `workspace_memberships`                           | `workspace_memberships`         |

**Server Actions:** Each settings section has a dedicated Server Action (e.g., `updateWorkspaceGeneral`, `updateBranding`, `updateNotificationPreferences`). Server Actions validate input, check role permissions, write to DB, and publish a real-time event (`workspace.settings_updated`) so other connected admins see changes immediately.

### Validation & Constraints

| Setting        | Validation                                                                              |
| -------------- | --------------------------------------------------------------------------------------- |
| Workspace name | 1–100 chars, no leading/trailing whitespace                                             |
| Timezone       | Must be valid IANA timezone string                                                      |
| Week start day | `'sunday'` or `'monday'`                                                                |
| Accent color   | Must be one of the 8 curated hex values                                                 |
| Workspace logo | Image file, max 2MB, min 64×64px, max 512×512px. Stored via `files.md` upload pipeline. |
| Working hours  | Start < End, valid 24h format                                                           |

### Concurrent Edit Handling

Settings use last-write-wins (no optimistic locking). If two admins change different fields simultaneously, both writes succeed (JSONB merge at field level). If two admins change the same field, the last write wins. A real-time event notifies the other admin: the setting value updates live in their UI. No conflict modal — settings changes are infrequent and low-stakes enough that last-write-wins is acceptable.

### Plan Enforcement

When a user navigates to a settings section that requires a higher plan tier (e.g., custom domains on Freelancer plan), the section renders normally but gated controls show: disabled state + "Upgrade to Professional" inline badge. Clicking the badge opens the Billing & Plan section with the relevant plan highlighted. The server rejects any Server Action that attempts to set a value beyond the current plan's limits, returning a `PLAN_LIMIT_EXCEEDED` error with the required plan tier.

### Audit Logging

All settings changes write to `audit_log`: `action: 'settings.updated'`, `metadata: { section, field, oldValue, newValue }`. Workspace name changes, role changes, and member additions/removals are always logged. Notification preference changes are NOT logged (personal, high-frequency, low-impact).

---

## Mobile Behavior

Settings page renders as a single-column stacked layout on phone. Section navigation becomes a top-level list — tap a section to navigate into it (push navigation, back arrow to return to section list). No sidebar on mobile.

All setting controls use mobile-optimized inputs: toggles (44px touch target), native select pickers, full-width text inputs with appropriate keyboard types.

**Danger zone actions** (delete workspace, transfer ownership) require additional confirmation on mobile: type workspace name to confirm, biometric auth if available.
