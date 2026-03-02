# EveryStack — Project Management Architecture

> **Reconciliation note (2026-02-27):** Reconciled with `GLOSSARY.md` (source of truth).
> Changes: (1) Renamed "Board view/Board View" → "Kanban" per glossary. (2) Removed banned "Interface" term from Dashboard View description; replaced with glossary-compliant phrasing. (3) Updated MVP scope labels on PM views — per glossary, MVP Table Views are Grid + Card only; List, Kanban, Gantt, Calendar, Gallery are post-MVP. Timeline is not a glossary-defined Table View type. PM internal phasing preserved as roadmap but "(MVP)" label on PM Milestone 1 updated to note glossary scope conflict. (4) Updated cross-references to use "Table View" terminology per glossary. (5) Tagged post-MVP features throughout. (6) Renamed "board_status" field → "kanban_status" for consistency. (7) Replaced "grid view" with "Grid View" (capitalized per glossary convention).

> **Sub-document.** PM table type, dependencies, Timeline, Gantt, baselines, resources, critical path, auto-scheduling, PM views.
> Cross-references: `data-model.md` (pm_table_config, record_dependencies, resource_profiles schema), `tables-and-views.md` (Table View types including Gantt — post-MVP), `inventory-capabilities.md` (Snapshot/Freeze action #39 generalizes pm_baselines pattern — post-MVP refactoring opportunity), `chart-blocks.md` (PM dashboard tabs — burndown area charts, utilization bar charts, budget progress bars, task status donut charts), `booking-scheduling.md` (shared tables: workspace_calendars for working day definitions, calendar_exceptions for holidays, resource_profiles for per-user capacity — booking availability engine consumes these)
> Last updated: 2026-02-27 — Glossary reconciliation. Prior: 2026-02-21.

---

## Project Management Architecture

When `table_type = projects`, the table gains PM capabilities. Built on three pillars: configuration (`pm_table_config`), dependency graph (`record_dependencies`), and supporting infrastructure (calendars, baselines, resources).

### Progressive Disclosure Mapping

| Level        | User Experience                                                                                                                                                          | What's Visible                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **L1 (80%)** | Create a projects table, get task hierarchy with indentation (Tab/Shift+Tab), assignees, statuses, due dates. Grid View with grouping. Kanban for status-based workflow. | Task list with nesting, drag-and-drop reorder, "Add subtask" buttons, Kanban by status, basic Timeline (bars on date axis). |
| **L2 (15%)** | Dependencies (FS/SS/FF/SF), manual "Shift dependents" button, Timeline with dependency arrows, overallocation warnings, milestone markers.                               | Dependency picker on records, Timeline arrows, overallocation red bar, milestone diamonds, duration vs dates toggle.        |
| **L3 (5%)**  | Critical path visualization, baselines (plan vs actual overlay), working calendars, resource profiles, constraint types, auto-scheduling mode. Professional+ features.   | Critical path red accents, baseline ghosted bars, calendar exception management, resource capacity settings, Gantt view.    |

> **Note (glossary scope):** Per GLOSSARY.md, MVP Table Views are Grid + Card only. Kanban, List, Gantt, Calendar, and Gallery are post-MVP Table View types. The PM-specific views below (List, Kanban, Timeline, Gantt) follow the PM internal phasing roadmap and are **post-MVP** relative to the platform's overall MVP scope.

### Self-Referential Nesting

Task hierarchy via a self-referential linked-record field. `pm_table_config.parent_field_id` points to this field. Records with no parent are root-level (projects/phases). Unlimited depth. Multiple project trees in one table.

- Root records serve double duty: project container (client, budget, scope) AND task tree root
- Users never fill in "Parent Task" manually — UI handles via indentation, drag-and-drop, "Add subtask" buttons
- Tab key indents (makes subtask), Shift+Tab outdents (like Asana)

### PM Table Config

One `pm_table_config` per projects-type table. Maps field IDs to PM roles:

**Required fields:** title, assignee, status, completed_values, start_date, end_date (or duration), parent

**Optional fields:** progress, priority, milestone, color, estimated_hours, actual_start, actual_end, remaining_duration, cost, allocation_pct, constraint_type, constraint_date, scheduling_mode, kanban_status, card_fields, task_display_fields, default_task_view

### Dependencies (`record_dependencies`)

- Predecessor/successor with type (FS, SS, FF, SF) and lag_days (positive=delay, negative=overlap)
- Scoped to single table (no cross-table dependencies)
- Cycle detection on insert/update — reject circular chains
- `is_active` boolean for soft-disable without deleting
- Powers Gantt arrows and critical path calculation

### Working Calendars

- `workspace_calendars`: defines working days (default Mon-Fri)
- `calendar_exceptions`: holidays, half-days, special working days
- Duration calculations use calendar to convert between calendar and working days
- Different teams/projects can use different calendars

### Baselines (Plan vs Actual)

- `pm_baselines`: named snapshots ("Original Plan", "Post-Rescope")
- `pm_baseline_snapshots`: frozen copy of each task's dates at baseline time
- Gantt overlays baseline as ghosted bars behind current bars
- Variance indicators when current end > baseline end

### Resource Management

- `resource_profiles`: per-user hours_per_week, cost_per_hour, availability_exceptions
- Workload view: allocated hours vs capacity per person per time period

**Overallocation warnings (post-MVP — PM roadmap MVP — Foundation):**

- When viewing Timeline grouped by assignee, overlapping tasks exceeding capacity show a red overallocation indicator on that day/week.
- Red bar above person's swim lane showing overallocated days.
- **No auto-fix.** Manager sees conflict and manually adjusts (drag task, reassign, or adjust scope).
- Data source: task assignee + start/end dates + effort estimate field (optional number field, hours/day).

**Resource leveling: Post-MVP (PM roadmap Post-MVP — Portals & Apps). Decided 2026-02-10.**
Full resource leveling (auto-rescheduling tasks so no person is double-booked) requires workload calculation per person per day, task priority ranking, splitting/stretching tasks, respecting dependencies/constraints, and iterative optimization. 4–6 weeks of work alone. Overallocation warnings cover 80% of the value at 5% of the effort.

### Critical Path

**Post-MVP (PM roadmap MVP — Core UX) — visual only, no auto-scheduling. Decided 2026-02-10.**

- Computed from dependency graph + durations via recursive CTEs
- Forward pass (earliest start/finish) + backward pass (latest start/finish)
- Float = LF - EF. Zero float = critical path
- **Visual:** Tasks on critical path get red left-border accent in Timeline/Gantt view. Non-critical tasks stay normal. Toggle in toolbar: "Show critical path" (default: off).
- **Float display:** Each task shows slack (days it can slip without affecting project end date). Critical path tasks show 0. Visible as tooltip on Timeline bar + optional column in Grid View.
- **Informational only:** Critical path highlights which tasks matter most — it does not move or schedule anything. Auto-scheduling based on critical path optimization deferred to PM roadmap Post-MVP — Portals & Apps.

### Auto-Scheduling & Cascading Dates

**Two scheduling modes per task:**

- **Manually scheduled (default):** User sets dates by hand. Dependencies exist as visual arrows but don't auto-cascade.
- **Auto-scheduled:** System calculates dates from dependencies + constraints. Predecessor slip cascades to successors.

**Cascading date behavior. Decided 2026-02-10:**

- **Opt-in per view:** Toggle in Timeline view toolbar: "Auto-cascade dates" (default: off). When off, dependencies are visual only.
- **How it works:** When a task's end date changes and it has finish-to-start or start-to-start dependencies, all downstream dependent tasks shift by the same delta. Duration stays the same — start and end dates move together.
- **Scope:** Only affects tasks within the current table's dependency chain. Cross-table dependencies don't cascade.
- **Atomic undo:** Single Cmd+Z undoes the entire cascade as one action. Toast: "Shifted 7 tasks by +3 days. Undo?"
- **Fixed constraint handling:** If a downstream task has a constraint (Must Finish On, Finish No Later Than), cascade stops at that task with warning badge: "⚠️ Can't shift — fixed deadline constraint."
- **Manual cascade button:** Timeline toolbar has "Shift dependents" button that triggers cascade on demand for the selected task.

**Constraint types:** ASAP, ALAP, Must Start On, Must Finish On, Start No Earlier/Later Than, Finish No Earlier/Later Than.

**Cascade execution:** Async via BullMQ to avoid blocking UI. Optimistic update shows projected positions immediately; server confirms.

**Phasing:** Timeline with dependencies as visual arrows + manual "Shift dependents" button ships first. Auto-cascade toggle follows. All post-MVP per glossary.

### Project Management Views

> **Glossary scope note:** Per GLOSSARY.md, MVP Table Views are Grid + Card only. All PM-specific views below (List, Kanban, Timeline, Gantt, Project List, Project Detail) are **post-MVP**. They are phased via the PM internal roadmap below.

**Project List** (entry point, post-MVP): Root-level records as cards. Shows project name, key fields (card_fields), progress bar, task count, status. [+ New Project] creates root record.

**List View** (default task view, Asana-style, post-MVP): Indented nested list. Expand/collapse. Inline editing. Drag to reorder or re-parent. "+ Add task" at each level.

**Kanban** (post-MVP): Cards grouped by status columns. Drag between columns. Nesting flattened; parent shown as label on card.

**Timeline View (post-MVP)**: Horizontal bars on calendar axis. Grouped by parent. **Basic dependency arrows** (finish-to-start, start-to-start) shown as connector lines between bars. Zoom: day/week/month/quarter. Drag to reschedule, resize to change duration. Executive-friendly. **Decided 2026-02-10: Timeline with basic dependency arrows is the first PM visual tool; full Gantt deferred further.**

> **Note:** Timeline is not a glossary-defined Table View type. It is a PM-specific visualization that functions as a simplified Gantt. The glossary lists Gantt as a post-MVP Table View type.

**Gantt View (post-MVP)**: Full PM Gantt. Nested tree left side, timeline right side. Bars, milestones (◆), dependency arrows, critical path highlight, baseline overlay, progress fill. Drag to reschedule, resize, create dependencies. Auto-schedule cascade on changes. Zoom: day/week/month/quarter/year. Today marker. Requires custom Canvas/D3 build for full control.

**Project Detail View (post-MVP)**: Top zone = project info card (root record fields). Bottom zone = task views with [List][Kanban][Timeline][Gantt] tabs. [+ Add Task] creates child of project.

### Post-MVP PM Views

- **Workload View**: Per-person allocation chart vs capacity. Red when over-allocated.
- **Portfolio View**: All projects as summary rows. Health indicators (on track/at risk/off track). Executive view.
- **Dashboard View**: Chart blocks tab with PM-specific visualizations. Task completion donut, burndown area chart, milestone list, overdue table, budget vs actuals progress bars. See `chart-blocks.md` for PM dashboard specs.

### PM Internal Roadmap

> **Note:** This PM-specific phasing is the internal build order for project management features. Per GLOSSARY.md, all PM views beyond Grid + Card are **post-MVP** relative to the platform's overall MVP. The labels below reflect PM feature sequencing, not platform MVP scope.

| Phase          | Capabilities                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PM Milestone 1 | List view, Kanban, Timeline with basic dependency arrows + manual "Shift dependents" button, project list/detail, nesting, pm_table_config, overallocation warnings |
| PM Milestone 2 | Sub-items, Progress (auto), advanced dependency types (FF, SF), working calendars, recurring tasks                                                                  |
| PM Milestone 3 | Auto-cascade toggle, critical path visual (red accent + float), full Gantt view, baseline overlay, baselines, workload view, portfolio view                         |
| PM Milestone 4 | Time tracking (timer, entries, timesheet, profitability), dashboards, resource leveling, multi-project Gantt                                                        |

---
