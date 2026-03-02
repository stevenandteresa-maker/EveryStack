# Portal Client Auth Model

> **Glossary Reconciliation — 2026-02-27**
> Aligned with `GLOSSARY.md` (source of truth).
> Changes: Renamed "Interface Designer" → "App Designer" per glossary naming discipline. Tagged post-MVP scope on App Designer block references. Fixed redundant product name note.

> **MERGED.** All content from this gap doc has been incorporated into `app-designer.md`.
> Merged on: 2026-02-12
>
> Key reconciliation decisions:
>
> - Portals are standalone (`portals` table), NOT `interface_definitions`
> - Auth supports both password and magic link (Manager chooses per portal)
> - Record scoping is identity-based via `linked_record_id` on `portal_clients` → CRM record
> - Field name: `record_scope` (resolved at query time from `linked_record_id` + `scoping_config`)
> - All display config (filters, sort, fields, colors) done in App Designer blocks (post-MVP) — no Table View references
> - Product name: EveryStack
