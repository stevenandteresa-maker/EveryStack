# EveryStack — Command Bar

> **Reference doc.** Unified command prompt, slash commands, AI interaction model, guide mode, command registry, private tasks, keyboard shortcuts.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (user_tasks, command_registry schema), `communications.md` (@ messaging routes to threads), `automations.md` (automations registered as slash commands), `schema-descriptor-service.md` (permission-filtered schema for AI context)
> Last updated: 2026-02-27 — Aligned with GLOSSARY.md. Scoped slash catalog to MVP features (~18 commands). Removed personal notes, approval, workspace map, field group commands (post-MVP).

---

## Unified Command Prompt

Single persistent input in the toolbar handling four intent paths through one interface. Intent detection handles routing; the user never thinks about modes.

**Compact state layout:** `🔍 Ask or do anything...  🔔●  ⌘K  ──  ⏱  📅  👤` — always visible in toolbar. Persists across navigation (lives in application shell, never unmounts).

| Input | Mode | Behavior |
|-------|------|----------|
| Just type | **Search / AI** | Hybrid search + conversational AI. Results in modal. |
| Question | **Guide Mode** | "How do I...?" → persistent guide overlay. |
| `@` | **Communication** | Contextual messaging. Routes to threads. |
| `/` | **Commands** | Slash command dropdown. Permission-aware. Fuzzy-filtered. |
| 🔔 click | **Notifications** | Opens notification feed. |
| `⌘K` | **Activate** | Expands compact bar to full power mode. |

**Permission-Scoped AI (non-negotiable):**
- AI calls same API endpoints as frontend — every query/action goes through RBAC middleware
- Context provider pre-filtered by user permissions — AI doesn't know about inaccessible entities
- Permission envelope with every AI request: user_id, workspace_id, role, base_permissions[], table_permissions[]
- Every AI-executed action logged with user_id in audit trail
- Schema Descriptor Service provides permission-filtered workspace schema for AI sessions

**Confirmation Architecture:**
- **Actions — always confirm:** AI shows preview card, user clicks Confirm/Cancel. Never executes without click.
- **Guide Mode — show, don't do:** AI highlights UI elements, tells user what to click. Pre-filling allowed but user must confirm/save.
- **Search/Read — no confirmation:** Results display immediately.

---

## Guide Mode

When AI detects a question, it activates a persistent guide overlay strip at the bottom of the screen (48px, application shell).

- **Shows only current step** — one at a time: "Step 2 of 5: Click + New Automation [Show me] [Skip] ×"
- **"Show me" spotlights target** — pulsing teal ring, rest of page dims.
- **Auto-advances on completion** — AI watches for expected action.
- **Persists across navigation** — survives page changes, picks up where left off.
- **Handles detours** — user clicks away, strip shows current step as reminder.
- **Context provider:** Shell-level React context feeds semantic app state snapshot (current page, selected elements, open panels, workspace schema) to AI.

**Contextual Suggestions (Passive):** AI occasionally surfaces proactive hints. One per session max. Dismissable, disableable in settings.

**Model allocation:** Intent classification: Haiku (1 credit). Simple commands: Haiku. Guide Mode sessions: Sonnet (3–5 credits).

---

## Command Bar Setup Modal

Triggered by `/command prompt setup`. Large modal, three tabs:

- **My Commands (all users):** Drag reorder, toggle visibility, organized by category. Per-user, per-workspace. Reset to Defaults.
- **Manage Commands (Manager+):** Create/edit/delete workspace custom commands. Register automations as slash commands.
- **Notifications (all users):** Per-category toggles for in-app (always on) and push. Categories: Chat, Tasks, Portals, Automations, Documents, System.

---

## Private Personal Tasks

`user_tasks` table belongs to the **user**, not the tenant.

| Column | Purpose |
|--------|---------|
| id | Primary key |
| user_id | Owner (private) |
| title | Task description |
| completed | Boolean |
| due_date | Optional deadline |
| sort_order | Manual reorder |
| parent_task_id | Nullable — subtasks |
| linked_record_id | Nullable — ties to assigned record |
| linked_tenant_id | Nullable — workspace association |

- Private: only visible to owning user
- Subtasks via parent_task_id tree
- Two types: standalone to-dos, personal subtask breakdowns of assigned tasks
- Created via My Office Tasks widget or `/todo` command

---

## Command Registry

Extensible slash command system. Managers+ register automations as commands.

| Column | Purpose |
|--------|---------|
| id | Primary key |
| tenant_id | Nullable (null = system command) |
| command_key | Slash trigger (e.g., `todo`) |
| label | Display name |
| description | Help text |
| category | Navigation, Create, Automate, Communication, Custom |
| source | `system` \| `automation` \| `custom` |
| automation_id | Nullable — links to automation if source=automation |
| context_scopes | JSONB — where it appears: global, table_view, record_detail, chat |
| permission_required | Minimum role |
| sort_order | Display priority |

---

## Slash Command Catalog (MVP)

Type `/` → dropdown with top contextual suggestions, then all commands with fuzzy search. Permission-aware. Customizable order via `/command prompt setup`.

**Parameter input:** Simple commands inline (`/todo Buy groceries` + Enter). Complex commands open modal.

| Category | Commands |
|---|---|
| **Navigation** | `/goto [entity]` (fuzzy search any base/table/record), `/office` (My Office) |
| **Record Creation** | `/new record` (current table), `/todo [text]` (personal to-do), `/event [text]` (personal calendar event) |
| **Data Operations** | `/print` (print/PDF current view) |
| **Communication** | `/dm @[user] [text]` (direct message), `/thread [text]` (start thread on context), `/status [emoji] [text]` (presence), `/mute` (mute current thread) |
| **Document Generation** | `/generate doc [template]` (from template for current record), `/templates` (browse templates) |
| **Automation** | `/create automation` (open wizard), `/automations` (go to list) |
| **Settings** | `/settings` (workspace), `/command prompt setup` (customize), `/invite [email]` (invite to workspace) |
| **Utility** | `/timer` (start/stop tracker), `/remind [time] [text]` (personal reminder), `/saved` (bookmarked messages), `/suggest a feature`, `/vote on feature` |
| **AI Actions** | `/summarize` (current/selected records), `/draft [type]` (email/message), `/ask [question]` (about your data) |

**Post-MVP commands:** `/translate`, `/analyze`, `/classify`, `/approval`, `/note`, `/voice-note`, `/clip-file`, `/notebook`, `/search-notes`, workspace map navigation commands, field group navigation.

---

## AI Prompt Template Model

**Prompt templates vs automations — clear distinction:**
- **Prompt template:** User-initiated, on-demand. AI runs → user reviews → accept/edit/reject. Always human-in-the-loop.
- **Automation:** System-initiated on trigger. Runs without involvement.

**Primary interaction — natural language:**
1. User types naturally (not just slash commands)
2. AI rephrases request to verify understanding
3. User confirms → AI executes → output previewed with accept/edit/reject
4. After 3 similar requests, AI suggests saving as template
5. User accepts → becomes personal slash command

**Template access levels:**
- **Personal:** Default. Saved to user's command list, only visible to them.
- **Manager-created:** Visible to workspace members (scoped by role).

**AI slash commands as shortcuts:** `/summarize`, `/draft`, `/ask` are convenience entry points. Power users skip them and talk naturally.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open Command Bar |

---

## Feature Suggestion System

- **`/suggest a feature`** (all users): Submission form — title, description, category, priority, optional attachment. Context auto-captured.
- **`/vote on feature`** (all users): Browse/search existing suggestions. Upvote (one per user). See Planned/In Progress items.
