# EveryStack — Workspace Map

> **⚠️ Reconciliation Note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Changes: (1) "Smart Doc" → "Document Template" throughout to match glossary naming; (2) "Interfaces" → "Apps" and "Interface Designer" → "App Designer" per naming discipline; (3) "portal designer" / "Website designer" → "App Designer" per glossary; (4) Updated DB references — Apps use separate `apps` table post-MVP, not shared `portals` table with `type` column; (5) Updated `tables-and-views.md` cross-reference to remove old "Interface architecture" / `interface_views` terminology; (6) Clarified automation trigger/action counts as post-MVP scope (MVP = 6 triggers, 7 actions); (7) Added post-MVP labels throughout; (8) "default interface" → "default Table View"; (9) Updated `custom-apps.md` cross-reference to reflect glossary DB entity split.

> **🏷️ MVP Status: POST-MVP (Post-MVP — Verticals & Advanced).** The Workspace Map is explicitly listed as post-MVP in the glossary MVP Scope Summary. All content in this document describes post-MVP functionality. The map's value is proportional to workspace complexity — it requires most subsystems (sync, cross-links, automations, portals, documents, AI) to exist before it's meaningful.

> **Reference doc (Tier 3).** Full-screen interactive topology visualization of an entire EveryStack workspace — tables, Cross-Links, sync connections, Automations, Portals, Apps (post-MVP), Document Templates, AI field agents (post-MVP), approval workflows (post-MVP), and their interconnections. Defines the topology graph model, node types and rendering, edge types and semantics, layout engine, interaction model, impact analysis overlay, filtering and search, performance strategy, and the Workspace Map route.
> Cross-references: `schema-descriptor-service.md` (SDS `describe_workspace()` and `describe_links()` as primary data sources for the topology graph, `WorkspaceDescriptor` JSON shape, permission-filtered schema), `cross-linking.md` (Cross-Link definitions, `cross_links` table, relationship types, `CrossLinkImpactAnalysis` interface, impact analysis 3-tier consequence model, cascade engineering), `automations.md` (Automation data model, trigger sources, action targets, MVP: 6 triggers × 7 actions; post-MVP: 22 triggers × 42 actions, step configs with table/field references, webhook architecture), `portals.md` (Portal data model, MVP: Record View config with auth wrapper using `portals` table; post-MVP: full App Designer portals, data binding modes, record scoping, publish status), `custom-apps.md` (post-MVP Apps use separate `apps` / `app_pages` / `app_blocks` tables per glossary DB entity split, Cart/Transaction block table references, Stripe Terminal config), `smart-docs.md` (Document Template merge field references to tables/fields, template → table dependency), `sync-engine.md` (sync connections, `SyncConfig` and `SyncTableConfig`, platform adapters, sync status, sync filters, orphaned records), `ai-field-agents-ref.md` (post-MVP: AIFieldAgentConfig, field references — LocalFieldRef, LinkedFieldRef, MultiHopFieldRef, aggregate context via DuckDB), `approval-workflows.md` (post-MVP: approval rules overlay on status fields, status transition dependencies, approval_rules config), `formula-engine.md` (post-MVP: formula dependency graph, circular reference detection, cross-link scope filter interaction), `chart-blocks.md` (chart data binding to tables, Mode A table aggregate, Mode B DuckDB analytical), `embeddable-extensions.md` (post-MVP: Website Mode, Live Chat Widget, Commerce Embed — all reference tables), `booking-scheduling.md` (post-MVP: bookable table config, calendar view dependencies), `communications.md` (Record Thread, notification routing), `tables-and-views.md` (Table View architecture, view types, Workspace table hierarchy), `data-model.md` (schema, field system, FieldTypeRegistry), `permissions.md` (workspace roles govern map access — Manager+ can view full map, Team Members see simplified version), `design-system.md` (design system, workspace accent color, surface tokens, responsive layout, application shell), `mobile.md` (tablet rendering — map is desktop/tablet only, phone redirects to simplified list view), `observability.md` (error indicators sourced from sync failures, automation failures), `realtime.md` (live topology updates via real-time events — sync status changes, automation run completions, portal publish events)
> Implements: `apps/web/src/components/CLAUDE.md` (component patterns), `packages/shared/ai/CLAUDE.md` (SDS consumption patterns)
> Source decisions: Inspired by Make Grid (auto-generated automation dependency map) but fundamentally broader — EveryStack owns the data layer, logic layer, surface layer, and intelligence layer, enabling a true full-stack operations topology that no automation-only platform can produce.
> Last updated: 2026-02-27 — Glossary reconciliation.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                                  | Lines     | Covers                                                                 |
| -------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| Strategic Rationale                                      | 44–80     | Why a topology visualization, competitive gap, target users            |
| Core Design Principles                                   | 81–94     | Read-only, schema-derived, progressive complexity, performance ceiling |
| Access & Responsive Behavior                             | 95–129    | Desktop full-screen, tablet, mobile list fallback, Command Bar entry   |
| Topology Graph Model                                     | 130–485   | 14 node types, 28 edge types, 5 cluster types, node/edge schemas       |
| Layout Engine                                            | 486–545   | Dagre + d3-force hybrid, layered force-directed, cluster containment   |
| Node Rendering                                           | 546–620   | React Flow custom nodes, 3 semantic zoom levels, visual encoding       |
| Interaction Model                                        | 621–737   | Selection, multi-select, context menu, search, minimap, keyboard nav   |
| Impact Analysis Overlay                                  | 738–817   | BFS traversal, 3-tier severity, impact cascade visualization           |
| Toolbar and Controls                                     | 818–883   | Zoom, filter, layout toggle, legend, export                            |
| Workspace Map Route                                      | 884–926   | Route architecture, data loading, URL state                            |
| Data Sources & Graph Generation                          | 927–1052  | Schema queries, graph builder, SDS integration                         |
| Performance Strategy                                     | 1053–1096 | 500-node soft cap, virtualization, incremental updates, Web Workers    |
| Responsive Behavior                                      | 1097–1148 | Breakpoint adaptations, touch gestures, mobile list view               |
| Permissions                                              | 1149–1166 | Role-based visibility, filtered graph per user role                    |
| Empty States & Onboarding                                | 1167–1202 | Progressive empty states, guided first experience                      |
| Real-Time Updates                                        | 1203–1223 | Incremental graph updates via Socket.io events                         |
| Phase Integration                                        | 1224–1239 | Post-MVP — Workspace Map delivery scope                                |
| Claude Code Prompt Roadmap                               | 1240–1592 | 10-prompt implementation roadmap                                       |
| Key Architectural Decisions                              | 1593–1612 | ADR-style decisions with rationale                                     |
| Future Extensions (Post-Post-MVP — Verticals & Advanced) | 1613–1625 | Deferred features                                                      |

---

## Strategic Rationale

### The Problem

As an EveryStack workspace matures, the number of interconnections grows superlinearly. A workspace with 5 bases, 30 tables, 20 cross-links, 15 automations, 3 portals, 5 doc templates, and 10 AI field agents has hundreds of implicit dependencies. When a Manager asks "what happens if I rename this field?" or "what would break if I disconnect this sync?", the answer requires tracing through every subsystem. Today that's invisible — the Manager has to hold the entire topology in their head.

### The Opportunity

EveryStack is uniquely positioned to build this. Unlike Make (which only sees automation-to-app connections) or Airtable (which can't see beyond its own base boundaries), EveryStack owns every layer:

- **Data Layer:** Tables, cross-base links, sync connections, formulas, field dependencies
- **Logic Layer:** Automations, approval workflows, threshold triggers, scheduled jobs
- **Surface Layer:** Portals, Apps (post-MVP), websites, embeddable commerce/chat, Document Templates
- **Intelligence Layer:** AI field agents, DuckDB analytical queries, semantic search embeddings

The Workspace Map makes this full topology visible, navigable, and actionable.

### Competitive Positioning

| Platform       | What Their "Map" Can Show                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Make Grid**  | Automation → automation and automation → external app connections. No data relationships, no UI surfaces, no AI dependencies.                                |
| **Airtable**   | No map feature. Base-internal linked records are visible in the field list but no topology view exists. Cannot see cross-base anything.                      |
| **SmartSuite** | No map feature. Solution-internal links only.                                                                                                                |
| **Monday.com** | No map feature. Board-level views only.                                                                                                                      |
| **EveryStack** | Full-stack topology: sync sources → tables → Cross-Links → Automations → Portals → Document Templates → AI agents. Everything connected, everything visible. |

### Sales & Retention Value

The Workspace Map serves three strategic purposes:

1. **Onboarding & demos:** Show prospects how their fragmented data will become a connected system. The map is the visual proof of the "superbase layer" value proposition.
2. **Day-to-day governance:** Managers can trace dependencies before making changes. Reduces "I broke something and I don't know what" incidents.
3. **Lock-in visibility:** The map makes the moat visible. Cross-base links crossing platform boundaries are visually distinct. Every portal, automation, and document that touches a cross-link is value that exists only on EveryStack.

---

## Core Design Principles

1. **Auto-generated, never manual.** The map is always derived from live workspace metadata. Users never draw boxes or connect lines. The system reads the topology from existing config tables and renders it. Zero setup, zero maintenance.

2. **Read-only visualization, not a builder.** The map does not modify anything. It is a lens, not an editor. Clicking a node navigates to the relevant builder (automation builder, App Designer, Table View, etc.) — the map itself never mutates workspace state.

3. **Impact analysis is the killer feature.** Seeing the topology is useful. Seeing what _would break_ if you changed something is transformative. Every node supports "Show Impact" — highlighting all downstream dependencies.

4. **Progressive detail.** The default view shows high-level node clusters (bases, automation groups, portal groups). Zooming in reveals individual tables, fields, and connection details. Zooming out collapses detail. The map is useful at every zoom level.

5. **Performance-first.** Workspaces can have 50+ tables, 100+ cross-links, 50+ automations, and dozens of surfaces. The map must render smoothly at any scale. Canvas-based rendering, virtualized off-screen nodes, layout computed server-side and cached.

---

## Access & Responsive Behavior

### Role-Scoped Map Views

The Workspace Map renders differently based on workspace role. The topology data is the same — the difference is which interactions are available and how nodes outside the user's permission scope are presented.

| Role              | Graph Visibility                     | Impact Analysis         | Node Click → Navigate                                                                               | Nodes Outside Scope                                      |
| ----------------- | ------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Owner / Admin** | Full topology — all nodes, all edges | Available on every node | Opens relevant builder                                                                              | N/A — full access                                        |
| **Manager**       | Full topology — all nodes, all edges | Available on every node | Opens relevant builder                                                                              | N/A — Managers see all workspace entities                |
| **Team Member**   | Full topology — all nodes visible    | Disabled                | Taps navigate to entity only if user has access; otherwise shows tooltip "Ask a Manager for access" | Dimmed at 40% opacity, name visible, no detail expansion |
| **Viewer**        | Full topology — all nodes visible    | Disabled                | Read-only — no navigation on tap                                                                    | Dimmed at 40% opacity, name visible                      |

**Rationale:** Team Members and Viewers benefit from seeing the full topology for orientation ("this is how the workspace is connected") without needing administrative interactions. Dimming nodes outside their access scope rather than hiding them preserves the map's primary value — making the workspace's shape visible — while respecting permission boundaries. Impact analysis is Manager+ only because its purpose is pre-change governance.

### Phone Fallback (<768px)

The Workspace Map canvas does not render on phone. Instead, the Map route shows a **grouped entity list** — a navigable inventory of workspace entities that provides the orientation value of the map without attempting a graph visualization on 375px.

**Layout:** Collapsible section groups, each with entity count badge:

- **Bases** — expandable, showing tables as nested list (icon + name + record count). Tap table → navigate to table view.
- **Automations** — flat list with status dot (green/gray/red), name, one-line trigger summary. Tap → navigate to automation builder.
- **Apps** _(post-MVP)_ — flat list with type badge (Portal/App/Form/Website/Widget), publish status badge, name. Tap → navigate to App Designer (if on tablet) or read-only preview (if on phone, per capability gating rules).
- **Document Templates** — flat list with template name and bound table. Tap → navigate to Document Template editor.
- **Sync Connections** — flat list with platform icon, connection name, status badge. Tap → navigate to sync settings.

**Search:** Sticky search bar at top filters all groups simultaneously. Same keyboard-first behavior as Command Bar entity search (Channel 2).

**Empty groups:** Hidden entirely. A workspace with no automations doesn't show the Automations section.

**No impact analysis on phone.** The grouped list is navigational, not analytical.

---

## Topology Graph Model

The Workspace Map renders a directed graph where nodes are workspace entities and edges are dependencies between them. The graph is computed server-side from existing metadata tables and served as a JSON structure to the client.

### TopologyGraph Interface

```typescript
interface TopologyGraph {
  workspace_id: string;
  generated_at: string; // ISO timestamp
  schema_version_hash: string; // From SDS — cache invalidation key
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  clusters: TopologyCluster[]; // Visual grouping containers
  stats: TopologyStats; // Summary counts for the header bar
}

interface TopologyStats {
  bases: number;
  tables: number;
  total_records: number;
  sync_connections: number;
  cross_links: number;
  automations: number;
  portals: number;
  apps: number;
  document_templates: number; // Glossary term: "Document Template" (not "Smart Doc")
  ai_field_agents: number; // Post-MVP
  approval_workflows: number; // Post-MVP
  websites: number;
  commerce_embeds: number;
  chat_widgets: number;
}
```

### Node Types

Every entity that participates in the workspace topology is represented as a node. Each node type has a distinct visual treatment, icon, and set of metadata.

```typescript
type TopologyNode =
  | SyncSourceNode
  | BaseNode
  | TableNode
  | AutomationNode
  | PortalNode
  | AppNode // Post-MVP: App Designer output, uses `apps` table
  | DocumentTemplateNode // Glossary: "Document Template" (formerly "SmartDocNode")
  | AIFieldAgentNode // Post-MVP
  | ApprovalWorkflowNode // Post-MVP
  | WebhookNode
  | WebsiteNode // Post-MVP: App type built in App Designer
  | CommerceEmbedNode // Post-MVP
  | ChatWidgetNode // Post-MVP
  | ExternalServiceNode;

// ── Sync Sources ──────────────────────────────────────────

interface SyncSourceNode {
  type: 'sync_source';
  id: string; // sync_connection.id
  platform: 'airtable' | 'smartsuite' | 'notion' | 'google_sheets' | 'excel_online';
  platform_base_name: string; // Name of the source base/workspace on the platform
  status: 'healthy' | 'stale' | 'error' | 'paused' | 'disconnected';
  last_sync_at: string | null;
  table_count: number; // Number of tables synced from this source
  total_records: number; // Sum of synced records across all tables
  error_message?: string; // When status = 'error'
}

// ── Bases & Tables ────────────────────────────────────────

interface BaseNode {
  type: 'base';
  id: string; // base.id
  name: string;
  color: string; // Base color from workspace config
  table_count: number;
  total_records: number;
  is_synced: boolean; // Has at least one sync connection
  sync_source_id?: string; // If synced, which sync source
}

interface TableNode {
  type: 'table';
  id: string; // table.id
  base_connection_id: string; // Parent base connection (base_connections.id)
  name: string;
  record_count: number;
  field_count: number;
  is_synced: boolean;
  sync_status?: 'healthy' | 'stale' | 'error' | 'paused';
  has_approval_workflows: boolean; // Any status field has transition governance
  has_ai_agents: boolean; // Any field is an AI field agent
  has_formulas: boolean; // Any formula fields
  has_booking_config: boolean; // booking_enabled table config
  key_fields: {
    // Top 5 fields for tooltip display
    name: string;
    type: string;
  }[];
}

// ── Logic Layer ───────────────────────────────────────────

interface AutomationNode {
  type: 'automation';
  id: string; // automation.id
  name: string;
  status: 'active' | 'inactive' | 'error';
  trigger_type: string; // Post-MVP: from 22 trigger types (MVP: 6 triggers)
  trigger_table_id: string | null; // Table that triggers this automation (null for scheduled/webhook)
  action_table_ids: string[]; // Tables that actions read from or write to
  last_run_at: string | null;
  last_run_status: 'success' | 'failure' | 'running' | null;
  run_count_30d: number; // Execution count last 30 days
  failure_count_30d: number;
  uses_webhook: boolean; // Has inbound or outbound webhook actions
  uses_external_service: boolean; // Has email, Slack, Stripe, etc. actions
  external_services: string[]; // ['email', 'stripe', 'slack', ...]
}

interface ApprovalWorkflowNode {
  type: 'approval_workflow';
  id: string; // Composite: table_id + status_field_id
  table_id: string; // Table containing the governed status field
  status_field_name: string;
  mode: 2 | 3; // Gated transitions or approval chain
  transition_count: number; // Number of governed transitions
  step_count: number; // Max approval steps (0 for Mode 2)
  pending_approvals: number; // Current queue depth
}

interface WebhookNode {
  type: 'webhook';
  id: string; // webhook_endpoint.id
  direction: 'inbound' | 'outbound';
  url_pattern: string; // Display-safe URL (masked for security)
  event_types: string[];
  linked_automation_ids: string[]; // Automations that use this webhook
  last_delivery_at: string | null;
  last_delivery_status: 'success' | 'failure' | null;
}

// ── Surface Layer ─────────────────────────────────────────

interface PortalNode {
  type: 'portal';
  id: string; // portals.id (glossary: `portals` table with record_view_config_id)
  name: string;
  status: 'published' | 'draft' | 'unpublished';
  page_count: number;
  bound_table_ids: string[]; // Tables referenced by data bindings in blocks
  scoping_table_id?: string; // Client scoping table (e.g., CRM contacts)
  client_count: number; // Registered portal clients
  has_payments: boolean; // Contains Stripe payment block
  has_forms: boolean; // Contains form blocks
  has_charts: boolean; // Contains chart or metric blocks
  has_approval_blocks: boolean; // Contains portal approval block
  has_booking_blocks: boolean; // Contains scheduler block
  custom_domain?: string;
}

interface AppNode {
  type: 'app';
  id: string; // apps.id (post-MVP: separate `apps` table per glossary)
  name: string;
  status: 'published' | 'draft' | 'unpublished';
  app_type_hint: 'pos' | 'kiosk' | 'warehouse' | 'dispatch' | 'custom'; // Inferred from blocks
  bound_table_ids: string[];
  has_cart: boolean; // Contains Cart/Transaction block
  has_stripe_terminal: boolean;
  has_quick_entry: boolean;
  kiosk_mode: boolean;
}

interface DocumentTemplateNode {
  type: 'document_template'; // Glossary: "Document Template" (formerly 'smart_doc')
  id: string; // document_templates.id
  name: string;
  source_table_id: string; // Table that provides merge fields
  referenced_field_ids: string[]; // Fields used in merge field syntax
  referenced_cross_link_ids: string[]; // Cross-links traversed for related data
  output_format: 'pdf' | 'docx';
  has_chart_embeds: boolean; // Contains chart merge fields
  generation_count_30d: number;
}

interface WebsiteNode {
  type: 'website';
  id: string; // apps.id (post-MVP: Website is an App type built in App Designer)
  name: string;
  status: 'published' | 'draft';
  page_count: number;
  bound_table_ids: string[]; // Tables referenced by data blocks
  has_commerce: boolean; // Contains commerce embed integration
  has_chat_widget: boolean; // Chat widget embedded on site
  custom_domain?: string;
}

interface CommerceEmbedNode {
  type: 'commerce_embed';
  id: string; // commerce_embed.id
  name: string;
  embed_type: 'single_product' | 'catalog' | 'custom_amount';
  product_table_id?: string; // For catalog mode
  transaction_table_id: string; // Where payment records land
  transaction_count_30d: number;
  revenue_30d: number;
}

interface ChatWidgetNode {
  type: 'chat_widget';
  id: string; // chat_widget.id
  name: string;
  status: 'active' | 'inactive';
  linked_crm_table_id?: string; // CRM table for auto-linking visitors
  conversation_count_30d: number;
  embedded_on_website_id?: string; // If embedded on an EveryStack website
}

// ── Intelligence Layer ────────────────────────────────────

interface AIFieldAgentNode {
  type: 'ai_field_agent';
  id: string; // fields.id (where field_type = 'ai_field_agent')
  name: string; // Field name
  table_id: string; // Table this field belongs to
  output_type: string; // text, number, single_select, etc.
  local_field_refs: string[]; // Field IDs on the same table
  linked_field_refs: {
    // Cross-link field references
    cross_link_id: string;
    field_id: string;
  }[];
  multi_hop_refs: {
    // Multi-hop traversals
    path: string[]; // Array of cross_link_ids
    field_id: string;
  }[];
  has_aggregate_context: boolean; // Uses DuckDB analytical query
  aggregate_table_ids: string[]; // Tables in aggregate context QueryPlan
  trigger_mode: 'manual' | 'on_create' | 'on_field_change' | 'scheduled';
  run_count_30d: number;
  credit_cost_30d: number;
}

// ── External Services ─────────────────────────────────────

interface ExternalServiceNode {
  type: 'external_service';
  id: string; // Derived: service name slug
  service:
    | 'email'
    | 'stripe'
    | 'slack'
    | 'twilio'
    | 'google_drive'
    | 'dropbox'
    | 'quickbooks'
    | 'xero'
    | 'google_calendar'
    | 'outlook_calendar'
    | 'zoom'
    | 'custom_api';
  display_name: string;
  status: 'connected' | 'disconnected' | 'error';
  connected_at: string | null;
  used_by_automation_ids: string[]; // Automations that use this service
}
```

### Edge Types

Edges represent typed, directed dependencies between nodes. Each edge type has a distinct visual style (color, dash pattern, thickness) and semantic meaning.

```typescript
interface TopologyEdge {
  id: string; // Deterministic: `${source_type}:${source_id}->${target_type}:${target_id}:${edge_type}`
  source_node_id: string;
  target_node_id: string;
  edge_type: EdgeType;
  label?: string; // Short label displayed on hover or when zoomed in
  metadata?: Record<string, any>; // Edge-type-specific data
  strength: 'critical' | 'normal' | 'weak'; // Visual weight — critical = thick, normal = standard, weak = thin/dashed
}

type EdgeType =
  | 'sync_feeds' // Sync source → table (data flows in)
  | 'cross_link' // Table → table (cross-base link)
  | 'native_link' // Table → table (same-base link, dimmer)
  | 'formula_depends' // Table → table (formula references field in linked table)
  | 'automation_triggers_from' // Table → automation (record change triggers)
  | 'automation_writes_to' // Automation → table (action creates/updates records)
  | 'automation_reads_from' // Automation → table (action reads/queries records — lighter than writes)
  | 'automation_calls_service' // Automation → external service (email, Stripe, etc.)
  | 'portal_displays' // Portal → table (data binding reads from)
  | 'portal_scoped_by' // Portal → table (client scoping references)
  | 'portal_writes_to' // Portal → table (form submissions, status updates)
  | 'app_binds_to' // App → table (data binding)
  | 'app_transacts_to' // App → table (Cart/Transaction block → orders/line items)
  | 'doc_merges_from' // Document Template → table (merge field source)
  | 'doc_traverses_link' // Document Template → cross_link (template traverses a link for related data)
  | 'ai_agent_reads' // AI field agent → table (local or linked field reference)
  | 'ai_agent_hops' // AI field agent → cross_link (multi-hop traversal)
  | 'ai_agent_aggregates' // AI field agent → table (DuckDB aggregate context)
  | 'approval_governs' // Approval workflow → table (status transition enforcement)
  | 'webhook_receives' // Webhook → automation (inbound webhook triggers)
  | 'webhook_sends' // Automation → webhook (outbound delivery)
  | 'website_displays' // Website → table (data binding)
  | 'commerce_sells_from' // Commerce embed → table (product catalog)
  | 'commerce_records_to' // Commerce embed → table (transaction records)
  | 'chat_links_to' // Chat widget → table (CRM auto-linking)
  | 'booking_manages' // Booking config → table (bookable table)
  | 'chart_aggregates' // Chart (in portal/app/interface) → table (aggregate source)
  | 'automation_chains' // Automation → automation (Run Automation action)
  | 'side_effect_triggers'; // Approval workflow → automation (on-approved/on-rejected fires automation)
```

### Edge Visual Styles

| Edge Type                  | Color (Dark Mode)                            | Color (Light Mode)   | Dash Pattern   | Thickness | Arrow                     |
| -------------------------- | -------------------------------------------- | -------------------- | -------------- | --------- | ------------------------- |
| `sync_feeds`               | `hsl(200, 70%, 55%)`                         | `hsl(200, 70%, 40%)` | Solid          | 2px       | → (into table)            |
| `cross_link`               | `hsl(170, 65%, 50%)` (Teal — brand emphasis) | `hsl(170, 65%, 35%)` | Solid          | 2.5px     | ↔ (bidirectional)         |
| `native_link`              | `hsl(220, 30%, 55%)`                         | `hsl(220, 30%, 45%)` | Solid          | 1.5px     | ↔                         |
| `automation_triggers_from` | `hsl(40, 85%, 55%)` (Amber)                  | `hsl(40, 85%, 40%)`  | Solid          | 2px       | → (into automation)       |
| `automation_writes_to`     | `hsl(40, 85%, 55%)`                          | `hsl(40, 85%, 40%)`  | Solid          | 2px       | → (into table)            |
| `automation_reads_from`    | `hsl(40, 85%, 55%)`                          | `hsl(40, 85%, 40%)`  | Dashed (6, 4)  | 1.5px     | → (into automation)       |
| `automation_calls_service` | `hsl(280, 50%, 55%)` (Purple)                | `hsl(280, 50%, 40%)` | Solid          | 1.5px     | → (into service)          |
| `portal_displays`          | `hsl(140, 60%, 50%)` (Green)                 | `hsl(140, 60%, 35%)` | Solid          | 2px       | → (into portal)           |
| `portal_scoped_by`         | `hsl(140, 60%, 50%)`                         | `hsl(140, 60%, 35%)` | Dotted (3, 3)  | 1.5px     | → (into portal)           |
| `portal_writes_to`         | `hsl(140, 60%, 50%)`                         | `hsl(140, 60%, 35%)` | Solid          | 2px       | → (into table)            |
| `doc_merges_from`          | `hsl(30, 75%, 55%)` (Orange)                 | `hsl(30, 75%, 40%)`  | Solid          | 1.5px     | → (into doc)              |
| `ai_agent_reads`           | `hsl(260, 65%, 60%)` (Violet)                | `hsl(260, 65%, 40%)` | Solid          | 1.5px     | → (into agent)            |
| `ai_agent_hops`            | `hsl(260, 65%, 60%)`                         | `hsl(260, 65%, 40%)` | Dashed (8, 4)  | 2px       | → (along cross-link)      |
| `approval_governs`         | `hsl(350, 70%, 55%)` (Red-pink)              | `hsl(350, 70%, 40%)` | Solid          | 2px       | → (into table)            |
| `automation_chains`        | `hsl(40, 85%, 55%)`                          | `hsl(40, 85%, 40%)`  | Dashed (10, 5) | 2px       | → (into child automation) |

Cross-link edges (`cross_link`) use the brand teal color and are rendered thicker than native links. This is deliberate — cross-links are the moat, and the map should make them visually prominent.

### Cluster Model

Nodes are grouped into visual clusters for spatial organization. Clusters have a colored background region, a label, and collapsible behavior.

```typescript
interface TopologyCluster {
  id: string;
  type: 'base' | 'automation_group' | 'portal_group' | 'external_services' | 'intelligence';
  label: string;
  color: string; // Background tint color (low opacity)
  node_ids: string[]; // Nodes belonging to this cluster
  position?: { x: number; y: number }; // Layout-computed position
  collapsed: boolean; // When true, shows as a single summary node
}
```

**Cluster Types:**

| Cluster           | Contains                                   | Background Color         | Collapsed Label                             |
| ----------------- | ------------------------------------------ | ------------------------ | ------------------------------------------- |
| Base cluster      | BaseNode + child TableNodes                | Base color at 8% opacity | "Sales Pipeline (8 tables, 12.4K records)"  |
| Automation group  | All AutomationNodes + WebhookNodes         | Amber at 6% opacity      | "15 Automations (12 active, 3 inactive)"    |
| Portal group      | All PortalNodes + AppNodes + WebsiteNodes  | Green at 6% opacity      | "3 Portals, 2 Apps, 1 Website"              |
| External services | All ExternalServiceNodes + SyncSourceNodes | Blue at 6% opacity       | "Connected: Airtable, Stripe, Gmail, Slack" |
| Intelligence      | All AIFieldAgentNodes                      | Violet at 6% opacity     | "10 AI Agents (4 tables)"                   |

---

## Layout Engine

### Layout Strategy

The map uses a **layered force-directed layout** computed server-side and cached. The layout algorithm arranges nodes in conceptual layers with force simulation for edge optimization.

**Layer Zones (left to right):**

```
┌──────────────┐   ┌──────────────────────────────────┐   ┌──────────────────────────┐
│              │   │                                    │   │                          │
│  SOURCES     │──▶│          DATA CORE                │──▶│       SURFACES           │
│              │   │                                    │   │                          │
│  Sync        │   │  Bases → Tables → Cross-Links      │   │  Portals                 │
│  Connections │   │  Formulas                          │   │  Apps (post-MVP)         │
│  Webhooks    │   │  Approval Workflows                │   │  Websites                │
│  (inbound)   │   │                                    │   │  Document Templates      │
│              │   │        ┌──────────────┐            │   │  Commerce Embeds         │
│              │   │        │  LOGIC       │            │   │  Chat Widgets            │
│              │   │        │  Automations │            │   │                          │
│              │   │        │  AI Agents   │            │   │  External Services       │
│              │   │        └──────────────┘            │   │  (outbound)              │
└──────────────┘   └──────────────────────────────────┘   └──────────────────────────┘
```

Data flows left-to-right conceptually: external platforms sync data IN from the left, tables and logic live in the center, surfaces and outputs project data OUT to the right. This mirrors the user's mental model of "data comes in → we process it → we expose it."

### Layout Algorithm

```typescript
interface LayoutConfig {
  algorithm: 'layered_force'; // Dagre for initial placement + d3-force for refinement
  layer_spacing: 400; // px between layer zones
  node_spacing: 80; // Minimum px between nodes in same layer
  cluster_padding: 40; // px padding inside cluster background
  edge_routing: 'orthogonal_smooth'; // Right-angle edges with rounded corners
  iterations: 300; // Force simulation iterations (server-side)
}
```

**Server-Side Computation:**

1. **Dagre pass:** Assign nodes to layers based on dependency direction. Sync sources → layer 0. Tables → layer 1. Automations and AI agents → layer 2. Surfaces → layer 3. External services (outbound) → layer 3.
2. **Force simulation pass (d3-force):** Refine positions within layers. Minimize edge crossings. Cluster cohesion forces keep base members together. Edge length forces pull connected nodes closer.
3. **Cache:** Layout is stored in Redis (`cache:t:{tenantId}:workspace_map_layout`) and invalidated on schema changes (using `schema_version_hash` from SDS). Layout computation targets < 500ms for a 100-node graph.

### Zoom Levels

The map supports continuous zoom via scroll/pinch with three conceptual detail levels:

| Zoom Level             | Threshold     | What's Visible                                                                                                                                |
| ---------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview** (default) | Fit-to-screen | Clusters as labeled rectangles. Cross-link edges between clusters visible. Stats in each cluster. Individual nodes not rendered.              |
| **Standard**           | 60–150%       | Individual nodes visible with icons and names. All edges rendered. Key metadata on hover. Cluster backgrounds visible as subtle tint regions. |
| **Detail**             | 150%+         | Nodes show expanded cards with record counts, status indicators, field lists. Edge labels visible. Full metadata panel on click.              |

**Semantic zoom** renders different node representations at different zoom levels without user action. This is critical for performance — at overview zoom, the renderer draws ~10 cluster rectangles instead of 100+ individual nodes.

---

## Node Rendering

### Node Visual Design

All nodes follow a consistent card pattern: icon + label + status indicator, with type-specific color accents.

```
Standard Node (60–150% zoom):
┌─ 2px left accent ──────────────────┐
│  🔄  Airtable — Sales Pipeline     │  ← icon + platform + name
│  ●  Healthy · 8 tables · 12.4K     │  ← status dot + summary
└────────────────────────────────────┘
   160px wide × 52px tall

Expanded Node (150%+ zoom):
┌─ 2px left accent ──────────────────────────┐
│  🔄  Airtable — Sales Pipeline             │
│  ●  Healthy · Last sync: 2 min ago         │
│  ─────────────────────────────────────────  │
│  Tables:                                    │
│    Deals (2,340)  Contacts (8,100)          │
│    Activities (15,200)  ...+5 more          │
└────────────────────────────────────────────┘
   240px wide × variable height
```

### Node Icons and Colors

| Node Type         | Icon                                            | Accent Color                         | Accent Meaning        |
| ----------------- | ----------------------------------------------- | ------------------------------------ | --------------------- |
| Sync Source       | Platform logo (Airtable/SmartSuite/Notion icon) | Platform brand color                 | Data origin           |
| Base              | Stacked layers icon                             | Base-assigned color                  | Data container        |
| Table             | Grid/table icon                                 | Inherits base color                  | Data entity           |
| Automation        | Zap/lightning icon                              | Amber `hsl(40, 85%, 55%)`            | Logic/processing      |
| Approval Workflow | Shield-check icon                               | Red-pink `hsl(350, 70%, 55%)`        | Governance            |
| Webhook           | Arrow-right-left icon                           | Amber (lighter)                      | External integration  |
| Portal            | Globe icon                                      | Green `hsl(140, 60%, 50%)`           | External surface      |
| App (post-MVP)    | Layout-grid icon                                | Green (shifted) `hsl(160, 60%, 50%)` | Internal surface      |
| Website           | Monitor icon                                    | Green (lighter)                      | Public surface        |
| Commerce Embed    | Credit-card icon                                | Green + Stripe purple accent         | Payment surface       |
| Chat Widget       | Message-circle icon                             | Green + chat blue accent             | Communication surface |
| Document Template | File-text icon                                  | Orange `hsl(30, 75%, 55%)`           | Document output       |
| AI Field Agent    | Brain/sparkles icon                             | Violet `hsl(260, 65%, 60%)`          | Intelligence          |
| External Service  | Service-specific icon                           | Purple `hsl(280, 50%, 55%)`          | External dependency   |

Icons sourced from `lucide-react` (already in the design system dependency tree).

### Node Status Indicators

Each node type has status-relevant visual indicators:

**Sync Sources:**

- Green dot: Healthy (last sync < 2× sync interval)
- Yellow dot: Stale (last sync > 2× interval but < 10×)
- Red dot: Error (sync failures, auth expired)
- Gray dot: Paused or disconnected

**Automations:**

- Green dot: Active, last run succeeded
- Red dot + pulse animation: Active, last run failed (requires attention)
- Gray dot: Inactive
- Blue spinner: Currently running

**Portals / Apps / Websites:**

- Green dot: Published
- Yellow dot: Draft (never published)
- Gray dot: Unpublished (was published, now disabled)

**AI Field Agents:**

- Green dot: Healthy (runs succeeding)
- Yellow dot: High credit usage warning (> 80% of daily limit)
- Red dot: Errors in recent runs

---

## Interaction Model

### Canvas Interactions

| Interaction        | Desktop                                         | Tablet                      |
| ------------------ | ----------------------------------------------- | --------------------------- |
| **Pan**            | Click + drag on canvas background               | Two-finger drag             |
| **Zoom**           | Scroll wheel / pinch trackpad                   | Pinch gesture               |
| **Select node**    | Click node                                      | Tap node                    |
| **Multi-select**   | Shift + click, or drag selection rectangle      | Long-press + tap additional |
| **Open entity**    | Double-click node                               | Double-tap node             |
| **Show impact**    | Right-click node → "Show Impact"                | Long-press → context menu   |
| **Fit to view**    | `Ctrl/Cmd + 0` or toolbar button                | Toolbar button              |
| **Center on node** | Search → select result → map pans/zooms to node | Same                        |

### Node Click Behavior

Single-clicking a node selects it and opens the **Detail Panel** — a 360px right-side panel (same pattern as the automation builder and App Designer right panels).

**Detail Panel Content by Node Type:**

**Table Detail Panel:**

```
┌─────────────────────────────────────────┐
│  📊  Deals                          ✕   │
│  Sales Pipeline base                     │
│  ─────────────────────────────────────── │
│  2,340 records · 18 fields               │
│  Synced from Airtable · Healthy          │
│                                          │
│  ▸ Fields (18)                           │
│     Deal Name (text)                     │
│     Value (currency)                     │
│     Stage (single_select)                │
│     Client ↗ (cross_link → Contacts)     │
│     ...                                  │
│                                          │
│  ▸ Connected To                          │
│     Incoming:                            │
│       Airtable sync (healthy)            │
│     Outgoing:                            │
│       → Contacts (cross_link)            │
│       → Invoice Generator (document_template)    │
│       → Deal Won automation (trigger)    │
│       → Client Portal (data binding)     │
│       → Deal Score (ai_field_agent)      │
│                                          │
│  ▸ Approval Workflows                    │
│     Stage field: 3 governed transitions  │
│     2 pending approvals                  │
│                                          │
│  [ Open Table ]  [ Show Impact ]         │
└─────────────────────────────────────────┘
```

**Automation Detail Panel:**

```
┌─────────────────────────────────────────┐
│  ⚡  Deal Won Notification          ✕   │
│  Active · Last run: 5 min ago            │
│  ─────────────────────────────────────── │
│  Trigger: Field Value Changed            │
│    Table: Deals                          │
│    Field: Stage → "Closed Won"           │
│                                          │
│  Actions (4 steps):                      │
│    1. Create Record → Invoices table     │
│    2. Generate Document → Invoice PDF    │
│    3. Send Email → client contact        │
│    4. Send Notification → deal owner     │
│                                          │
│  ▸ Performance (30 days)                 │
│     142 runs · 3 failures · 98% success  │
│     Avg duration: 2.4s                   │
│                                          │
│  ▸ Dependencies                          │
│     Reads from: Deals, Contacts          │
│     Writes to: Invoices                  │
│     Services: Email (Resend), Stripe     │
│                                          │
│  [ Open in Builder ]  [ Show Impact ]    │
└─────────────────────────────────────────┘
```

### Double-Click Navigation

Double-clicking any node navigates to that entity's builder/editor:

| Node Type         | Navigation Target                                                                     |
| ----------------- | ------------------------------------------------------------------------------------- |
| Sync Source       | Sync Settings dashboard for this connection                                           |
| Table             | Table View (default view)                                                             |
| Automation        | Automation builder (full-screen)                                                      |
| Portal            | Portal configuration (MVP Quick Portal) / App Designer (post-MVP App Designer portal) |
| App               | App Designer (post-MVP)                                                               |
| Website           | App Designer (post-MVP)                                                               |
| Document Template | Template editor                                                                       |
| AI Field Agent    | Field configuration panel in table settings                                           |
| Approval Workflow | Status field configuration in table settings                                          |
| External Service  | Integration settings page                                                             |

Navigation opens in the same browser tab. The map state (zoom, pan, selection) is preserved in session storage so the user can press Back to return to the exact same map position.

### Context Menu

Right-click (desktop) or long-press (tablet) on a node opens a context menu:

| Menu Item                 | Action                                                                |
| ------------------------- | --------------------------------------------------------------------- |
| **Show Impact**           | Activates impact analysis overlay for this node (see Impact Analysis) |
| **Show Connections Only** | Filters the map to show only this node and its direct connections     |
| **Open in New Tab**       | Navigates to the entity's builder in a new tab                        |
| **Copy Link**             | Copies a deep link to the map centered on this node                   |
| **Hide from Map**         | Temporarily hides this node (session-only, not persisted)             |

---

## Impact Analysis Overlay

### How It Works

Impact analysis answers: **"If I change or remove this entity, what else would be affected?"**

When the user activates "Show Impact" on a node, the map transitions into impact analysis mode:

1. **The selected node** pulses with a glow effect.
2. **All directly affected nodes** are highlighted with colored borders matching their impact severity.
3. **All unaffected nodes** fade to 20% opacity.
4. **Affected edges** animate with a flowing particle effect (directional dots moving along the edge) showing the direction of impact propagation.
5. **An impact summary card** appears above the map canvas.

### Impact Severity Tiers

Reuses the 3-tier consequence model from `cross-linking.md` > Impact Analysis & User Communication, extended to all node types:

| Tier       | Label         | Color                     | Meaning                                                                                                               |
| ---------- | ------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Tier 1** | Breaking      | Red `hsl(0, 70%, 55%)`    | Entity would fail or produce errors. E.g., automation triggers from a table that would be disconnected.               |
| **Tier 2** | Degraded      | Amber `hsl(40, 85%, 55%)` | Entity would lose data or functionality but not break. E.g., portal chart loses one of its data sources.              |
| **Tier 3** | Informational | Blue `hsl(210, 60%, 55%)` | Entity references this node but impact is minimal. E.g., a Document Template has a merge field that would show empty. |

### Impact Computation

Impact analysis is computed server-side by traversing the topology graph from the selected node outward. The traversal follows edge directions and applies impact rules per edge type:

```typescript
interface ImpactAnalysisResult {
  source_node_id: string;
  analysis_type: 'removal' | 'disconnection' | 'field_change' | 'rename';
  affected_nodes: {
    node_id: string;
    tier: 1 | 2 | 3;
    reason: string; // Human-readable: "This automation triggers when Deals.Stage changes"
    edge_path: string[]; // Chain of edge IDs from source to this node
  }[];
  summary: {
    tier_1_count: number;
    tier_2_count: number;
    tier_3_count: number;
    total_affected: number;
  };
  ai_summary?: string; // AI-generated natural language impact summary (optional, 2 credits)
}
```

**Impact propagation rules by edge type:**

| If you remove/change...    | Edge Type                                                                                        | Downstream Impact                                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A sync connection          | `sync_feeds`                                                                                     | Tier 1: All tables fed by this sync (data stops updating). Tier 1: All automations triggered by those tables. Tier 2: All portals/docs that display data from those tables.                                                                                                           |
| A table                    | `cross_link`, `automation_triggers_from`, `portal_displays`, `doc_merges_from`, `ai_agent_reads` | Tier 1: Every entity that reads from or writes to this table.                                                                                                                                                                                                                         |
| A cross-link               | `cross_link`                                                                                     | Tier 1: AI agents with multi-hop refs through this link. Tier 2: Portals displaying cross-linked data. Tier 2: Document Templates merging cross-linked fields. Tier 3: Formulas referencing linked record values.                                                                     |
| A field (rename or delete) | (Field-level — traverses all edges from parent table)                                            | Tier 1: Automation conditions or actions referencing this field. Tier 1: Formula fields depending on this field. Tier 2: AI agents with this field in their prompt. Tier 2: Document Template merge fields referencing this field. Tier 3: Portal/App blocks filtering by this field. |
| An automation              | `automation_chains`, `side_effect_triggers`                                                      | Tier 1: Child automations called via Run Automation. Tier 2: Approval workflows with on-approved/on-rejected side effects targeting this automation.                                                                                                                                  |
| A portal/app               | `portal_displays`, `portal_writes_to`                                                            | Tier 3: Informational only — removal doesn't affect data integrity.                                                                                                                                                                                                                   |

### Impact Summary Card

Displayed above the canvas when impact analysis is active:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Impact Analysis: Removing "Airtable — Sales Pipeline" sync          │
│                                                                        │
│  🔴 4 Breaking    🟡 6 Degraded    🔵 3 Informational    ✕ Close     │
│                                                                        │
│  8 tables would stop syncing · 5 automations would fail ·             │
│  2 portals would show stale data · 3 docs would have empty fields    │
│                                                                        │
│  [ Generate AI Summary (2 credits) ]                                   │
└────────────────────────────────────────────────────────────────────────┘
```

**AI Summary** (optional, on-demand): When clicked, invokes the AI architecture with a prompt constructed from the `ImpactAnalysisResult` to produce a natural language summary. Example output: _"Disconnecting the Airtable Sales Pipeline sync would immediately stop data updates for 8 tables including Deals, Contacts, and Activities. The 'Deal Won Notification' and 'Monthly Revenue Report' automations would begin failing. Your Client Portal would continue to display data but it would become stale. Your Invoice Generator template references 3 fields from synced tables that would show empty values."_

---

## Toolbar and Controls

### Map Toolbar (Top Bar)

The Workspace Map is a full-screen route (`/workspace/{workspaceId}/map`) with a 48px top toolbar. The toolbar follows the same pattern as the automation builder toolbar.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ←  Workspace Map           [🔍 Search...]   [Filter ▾]   [◎] [−] [+] [⟳]  │
└──────────────────────────────────────────────────────────────────────────────┘
 Back   Title                  Search          Filter     Fit  Zoom  Refresh
```

| Control       | Behavior                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **← Back**    | Returns to previous route (workspace home, table view, etc.)                                                                                                                           |
| **Search**    | Expandable search field. Searches all node names and metadata. Results appear as a dropdown — selecting a result pans/zooms the map to center on that node and opens the detail panel. |
| **Filter**    | Dropdown with toggleable filters (see Filter System below)                                                                                                                             |
| **◎ Fit**     | Zoom-to-fit: adjusts zoom and pan to show all visible nodes                                                                                                                            |
| **− / +**     | Zoom out / zoom in (10% increments)                                                                                                                                                    |
| **⟳ Refresh** | Force-regenerate the topology graph (bypasses cache)                                                                                                                                   |

### Filter System

The filter dropdown allows toggling visibility of node types and filtering by status. Filters are session-persisted (not workspace-persisted — each user's view is independent).

```
┌───────────────────────────────────┐
│  Filters                      ✕   │
│  ─────────────────────────────── │
│  Show Layers:                     │
│  ☑ Data (tables, sync, links)     │
│  ☑ Logic (automations, webhooks)  │
│  ☑ Surfaces (portals, apps, docs) │
│  ☑ Intelligence (AI agents)       │
│  ☐ External Services              │
│                                   │
│  Status:                          │
│  ☑ Healthy                        │
│  ☑ Errors / Failures              │
│  ☑ Inactive / Draft               │
│                                   │
│  Sync Sources:                    │
│  ☑ Airtable                       │
│  ☑ SmartSuite                     │
│  ☐ Notion (hidden)                │
│                                   │
│  Bases:                           │
│  ☑ Sales Pipeline                 │
│  ☑ Operations                     │
│  ☐ HR (hidden)                    │
│                                   │
│  [ Reset Filters ]                │
└───────────────────────────────────┘
```

When a filter hides nodes, their edges also hide. Edges whose both endpoints are visible remain visible.

### Minimap

A 180×120px minimap in the bottom-right corner shows the full topology at thumbnail scale with a viewport rectangle indicating the current visible area. Click-drag on the minimap to pan. The minimap follows the same pattern used in Figma and other canvas tools.

The minimap is collapsible via a chevron toggle. Hidden by default on tablet viewports < 1024px.

---

## Workspace Map Route

### Route Architecture

```
/workspace/{workspaceId}/map                    — Full workspace map
/workspace/{workspaceId}/map?focus={nodeId}     — Map centered on specific node
/workspace/{workspaceId}/map?impact={nodeId}    — Map with impact analysis active for node
/workspace/{workspaceId}/map?filter={preset}    — Map with preset filter applied
```

**Deep linking:** The `focus` query parameter centers the map on a specific node and opens its detail panel. This enables cross-linking from anywhere in the platform — e.g., the sync settings page can link to "View in Workspace Map" to show the sync source in context.

### Workspace Navigation Integration

The Workspace Map appears in the workspace navigation sidebar as a top-level item:

```
┌──────────────────────────┐
│  EveryStack              │
│  ────────────────────── │
│  🏠  Home                │
│  🗺️  Workspace Map       │  ← New entry
│  📊  Sales Pipeline      │
│  📊  Operations          │
│  ⚡  Automations         │
│  🌐  Portals             │
│  ...                     │
└──────────────────────────┘
```

### Command Bar Integration

The Workspace Map is accessible via the Command Bar (`command-bar.md`):

| Command                        | Action                            |
| ------------------------------ | --------------------------------- |
| `Go to Workspace Map`          | Opens `/workspace/{id}/map`       |
| `Show impact of [entity name]` | Opens map with `?impact={nodeId}` |
| `Find [entity name] on map`    | Opens map with `?focus={nodeId}`  |

---

## Data Sources & Graph Generation

### Source Data

The topology graph is generated by reading from existing metadata tables. **No new tables are required** — the map is a pure read-only projection of existing workspace config.

| Data Source                   | What It Provides                                                       | Tables / APIs Read                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Schema Descriptor Service** | Bases, tables, fields, cross-links, field types, record counts         | `describe_workspace()`, `describe_links()`                                                                                           |
| **Sync Engine config**        | Sync connections, platform sources, sync status, sync filters          | `sync_connections`, `sync_configs`, `sync_table_configs`                                                                             |
| **Automations config**        | Automation definitions, trigger/action table refs, status, run history | `automations` table, `automation_runs` (aggregate stats)                                                                             |
| **Portal config**             | Portal definitions, data bindings                                      | MVP: `portals` (with `record_view_config_id`); post-MVP App Designer portals: `apps`, `app_pages`, `app_blocks` (data_binding JSONB) |
| **Document Templates**        | Template definitions, merge field references                           | `document_templates` (merge_fields JSONB)                                                                                            |
| **AI Field Agent config**     | Agent configs, field references, aggregate context                     | `fields` where `field_type = 'ai_field_agent'` (config JSONB)                                                                        |
| **Approval workflow config**  | Status field transition rules, approval rules                          | `fields` where `field_type = 'status'` (config.transitions JSONB), `approval_rules`                                                  |
| **Connected services**        | External service connections, OAuth tokens (existence only)            | `connected_services` (or equivalent OAuth token store)                                                                               |
| **Webhook endpoints**         | Inbound/outbound webhook registrations                                 | `webhook_endpoints`                                                                                                                  |
| **Commerce / Chat**           | Commerce embed configs, chat widget configs                            | `commerce_embeds`, `chat_widgets`                                                                                                    |
| **Booking config**            | Bookable table configurations                                          | `calendar_table_config` where `booking_enabled = true`                                                                               |
| **Run statistics**            | Automation run counts, AI agent run counts, generation counts          | Aggregate queries on `automation_runs`, `ai_agent_runs` (30-day window)                                                              |

### Graph Generation Pipeline

```typescript
// Server Action: generateTopologyGraph
// Called on map load if cache miss, or on explicit refresh

async function generateTopologyGraph(tenantId: string, userId: string): Promise<TopologyGraph> {
  // 1. Read workspace schema via SDS (permission-filtered for this user)
  const schema = await sds.describeWorkspace(tenantId, userId);
  const links = await sds.describeLinks(tenantId, userId);

  // 2. Read sync connections
  const syncConnections = await db.query(/* sync_connections for tenant */);

  // 3. Read automations with trigger/action table analysis
  const automations = await db.query(/* automations for tenant, with step analysis */);

  // 4. Read portals (MVP: record_view_config) and apps (post-MVP: app_pages + app_blocks with data bindings)
  const portals = await db.query(/* portals + apps/app_blocks with data_binding */);

  // 5. Read Document Templates with merge field analysis
  const docTemplates = await db.query(/* document_templates for tenant */);

  // 6. Read AI field agent configs
  const aiAgents = await db.query(/* fields where type = ai_field_agent */);

  // 7. Read approval workflow configs
  const approvalConfigs = await db.query(/* fields where type = status AND transitions */);

  // 8. Read connected services, webhooks, commerce, chat
  const services =
    await db.query(/* connected_services, webhook_endpoints, commerce_embeds, chat_widgets */);

  // 9. Read run statistics (30-day aggregates)
  const runStats = await db.query(/* aggregate automation_runs, ai_agent_runs */);

  // 10. Build nodes
  const nodes = buildNodes(
    schema,
    links,
    syncConnections,
    automations,
    portals,
    docTemplates,
    aiAgents,
    approvalConfigs,
    services,
    runStats,
  );

  // 11. Build edges by analyzing config references
  const edges = buildEdges(
    nodes,
    schema,
    links,
    automations,
    portals,
    docTemplates,
    aiAgents,
    approvalConfigs,
  );

  // 12. Build clusters
  const clusters = buildClusters(nodes, schema);

  // 13. Compute layout
  const layout = computeLayout(nodes, edges, clusters);

  // 14. Compute stats
  const stats = computeStats(nodes);

  return {
    workspace_id: tenantId,
    generated_at: new Date().toISOString(),
    schema_version_hash: schema.version_hash,
    nodes,
    edges,
    clusters,
    stats,
  };
}
```

### Edge Extraction from Config

The most nuanced part of graph generation is extracting edges from existing JSONB configs. Each subsystem stores references differently:

**Automations → Tables:** Each automation step (JSONB array) contains a `config` object with table/field references. The step `type` determines which config keys to inspect:

- Trigger step: `config.table_id` → `automation_triggers_from` edge
- Create Record action: `config.target_table_id` → `automation_writes_to` edge
- Update Record action: `config.table_id` → `automation_writes_to` edge
- Find Records action: `config.table_id` → `automation_reads_from` edge
- Send Email action: → `automation_calls_service` edge to email service node
- Webhook action: → `webhook_sends` edge
- Run Automation action: `config.automation_id` → `automation_chains` edge

**Portals → Tables:** For MVP Quick Portals, edges are derived from the portal's `record_view_config_id` (bound to one table). For post-MVP App Designer portals/apps, each `app_block` has a `data_binding` JSONB (see `portals.md` > Block `data_binding` JSONB Shape):

- `data_binding.source.table_id` → `portal_displays` edge
- `data_binding.source.view_id` (resolved to table) → `portal_displays` edge
- Form blocks with `data_binding.target_table_id` → `portal_writes_to` edge
- Portal `scoping_config.scoping_table_id` → `portal_scoped_by` edge

**Document Templates → Tables:** Template merge field syntax `{{table.field}}` is parsed:

- Source table → `doc_merges_from` edge
- Cross-link traversals in merge paths → `doc_traverses_link` edge

**AI Field Agents → Tables/Links:** `AIFieldAgentConfig` contains explicit references:

- `field_references` (LocalFieldRef) → `ai_agent_reads` edge to same table
- `field_references` (LinkedFieldRef) → `ai_agent_reads` edge to linked table + `ai_agent_hops` edge to cross-link
- `field_references` (MultiHopFieldRef) → `ai_agent_hops` edges along each cross-link in path
- `aggregate_context.query_plan.sources[].table_id` → `ai_agent_aggregates` edge

**Formula Fields → Fields/Tables:** Formula dependency graph (from `formula-engine.md`):

- Field references within formulas → `formula_depends` edges between tables (when referencing linked record values via ROLLUP or lookup)

### Caching Strategy

```
Redis Key: cache:t:{tenantId}:workspace_map_graph
TTL: 300 seconds (5 minutes)
Invalidation: schema_version_hash change (piggybacked on SDS cache invalidation events)
```

**Invalidation triggers** (via real-time events already in the platform):

- `schema.updated` → table/field/cross-link structural changes
- `sync.connection_updated` → sync status changes
- `automation.updated` → automation config changes
- `portal.published` / `portal.updated` → portal changes
- `automation.run_completed` → updates run stats (debounced — stat refresh every 60s, not per-run)

The map client maintains a WebSocket subscription to `tenant:{tenantId}` channel and listens for `workspace_map.invalidated` events. On invalidation, the client shows a subtle "Map updated — click to refresh" toast rather than auto-refreshing (which would be disorienting if the user is mid-interaction).

---

## Performance Strategy

### Rendering Technology

**Canvas-based rendering via React + HTML5 Canvas** (not SVG DOM). At 100+ nodes with edges, SVG DOM performance degrades due to the sheer number of DOM elements. Canvas rendering keeps the element count at 1 (the canvas element) with all drawing handled programmatically.

**Library recommendation: `@xyflow/react` (React Flow v12).**

React Flow is purpose-built for node-based graph UIs. It handles:

- Canvas panning and zooming with hardware acceleration
- Node rendering as React components (overlaid on the canvas coordinate system)
- Edge routing with multiple path types (bezier, step, smoothstep)
- Minimap component built-in
- Fit-to-view, center-on-node
- Multi-selection, drag-selection rectangle
- Keyboard shortcuts
- Touch/mobile support
- Virtualization of off-screen nodes (critical for large graphs)

React Flow renders nodes as positioned `<div>` elements (not canvas-drawn), which means nodes are accessible, interactive, and styleable with Tailwind. Edges are rendered as SVG paths within the React Flow viewport. This is the right tradeoff — nodes need to be interactive (click, hover, context menu) while edges just need to be visible.

### Performance Targets

| Metric                          | Target                  | Strategy                                                  |
| ------------------------------- | ----------------------- | --------------------------------------------------------- |
| **Initial render** (cold cache) | < 2s for 100-node graph | Server-side layout computation, graph JSON ~50KB gzipped  |
| **Initial render** (warm cache) | < 500ms                 | Redis cache for both graph and layout                     |
| **Zoom/pan**                    | 60fps                   | React Flow hardware-accelerated viewport transform        |
| **Node count limit**            | 500 nodes (soft cap)    | Beyond 500, force cluster-collapsed default view          |
| **Edge count limit**            | 2,000 edges (soft cap)  | Edge bundling for parallel edges between same node pair   |
| **Impact analysis**             | < 200ms                 | Server-side graph traversal, cached per-node              |
| **Detail panel open**           | < 100ms                 | Node metadata included in graph JSON, no additional fetch |

### Large Workspace Handling

For workspaces exceeding 500 nodes:

1. **Auto-collapse clusters** — default to overview zoom with all clusters collapsed. The user expands clusters on demand.
2. **Edge bundling** — multiple edges between the same two nodes (e.g., 3 automations that all trigger from the same table) are bundled into a single thick edge with a count badge. Hover to see individual edges.
3. **Lazy detail loading** — run statistics (30-day counts) are loaded on-demand when a node is clicked, not included in the initial graph payload. This reduces initial payload by ~30%.
4. **Viewport culling** — React Flow natively virtualizes nodes outside the visible viewport. Off-screen nodes are not rendered to the DOM.

---

## Responsive Behavior

### Desktop (≥ 1280px)

Full experience. Full-screen canvas with toolbar, minimap, and detail panel. Detail panel is 360px on the right side, pushing the canvas viewport.

### Tablet (768px – 1279px)

Full experience with adaptations:

- Detail panel opens as a bottom sheet (40% height) instead of right panel
- Minimap hidden by default (toggle available)
- Touch interactions: pinch-to-zoom, two-finger-pan, tap-to-select, long-press for context menu
- Node sizes slightly reduced (140px standard width)

### Phone (< 768px)

**The full map is not rendered on phone.** The graph topology is too dense for a phone-width screen to be useful. Instead, the phone route shows a **simplified list view**:

```
┌──────────────────────────────────┐
│  ←  Workspace Map                │
│  ──────────────────────────────  │
│  🔍 Search entities...           │
│                                  │
│  ▸ Data (30 tables, 3 sources)   │
│    🔄 Airtable — Sales ●        │
│    🔄 SmartSuite — Ops  ●       │
│    📊 Deals (2,340)              │
│    📊 Contacts (8,100)           │
│    ...                           │
│                                  │
│  ▸ Logic (15 automations)        │
│    ⚡ Deal Won Notification ●    │
│    ⚡ Monthly Report       ●    │
│    ...                           │
│                                  │
│  ▸ Surfaces (6)                  │
│    🌐 Client Portal (published)  │
│    📱 POS Terminal (published)   │
│    ...                           │
│                                  │
│  ▸ Intelligence (10 AI agents)   │
│    🧠 Deal Score                 │
│    🧠 Client Summary             │
│    ...                           │
└──────────────────────────────────┘
```

Tapping an entity on the phone list view navigates directly to that entity's builder. No detail panel. "Show Impact" is not available on phone — the visualization requires canvas space that a phone cannot provide.

---

## Permissions

| Action                           | Owner | Admin | Manager | Team Member                 | Viewer |
| -------------------------------- | ----- | ----- | ------- | --------------------------- | ------ |
| View Workspace Map               | ✅    | ✅    | ✅      | ✅ (simplified — see below) | ❌     |
| View all node types              | ✅    | ✅    | ✅      | ❌ (data layer only)        | ❌     |
| Impact Analysis                  | ✅    | ✅    | ✅      | ❌                          | ❌     |
| AI Impact Summary                | ✅    | ✅    | ✅      | ❌                          | ❌     |
| Double-click navigate to builder | ✅    | ✅    | ✅      | ✅ (to accessible entities) | ❌     |

**Team Member simplified view:** Team Members see the Data layer (tables, cross-links, sync status) but not the Logic or Surface layers (automations, portals, AI agents). This aligns with the permission model — Team Members don't configure automations or portals, so showing them those nodes adds complexity without actionable value.

**Viewer exclusion:** Viewers have read-only access to individual views. The Workspace Map exposes structural metadata about the entire workspace (automation names, portal configurations, sync sources) which exceeds Viewer-level access. Viewers accessing `/map` are shown a friendly "Workspace Map requires Team Member access or above" message.

**Permission filtering:** The topology graph is generated using SDS `describe_workspace()` which already applies permission filtering per user. Tables and fields the user cannot access are excluded from the graph. This ensures the map never leaks structural information beyond the user's permission scope.

---

## Empty States & Onboarding

### New Workspace (< 3 tables)

For workspaces that haven't built much yet, the map shows a motivational empty state:

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│              🗺️                                            │
│                                                            │
│         Your Workspace Map                                 │
│                                                            │
│   As you connect data sources, build automations,          │
│   and create portals, your workspace map will grow         │
│   to show how everything is connected.                     │
│                                                            │
│   [ Connect a Data Source ]   [ Create a Table ]           │
│                                                            │
│   Currently: 2 tables · 1 cross-link · 0 automations      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### First-Time Map Tutorial

On the first visit to the Workspace Map, a 3-step coach mark overlay introduces the feature:

1. **"This is your Workspace Map"** — Points to the canvas. "It shows how all your tables, automations, portals, and AI agents are connected."
2. **"Click any node to see details"** — Points to a table node. "Double-click to jump to that entity."
3. **"Right-click for Impact Analysis"** — Points to a node. "See what would be affected if you changed or removed something."

Coach marks dismiss on click and don't show again (tracked via `localStorage` preference, synced to user preferences on the server for cross-device consistency).

---

## Real-Time Updates

The Workspace Map subscribes to real-time events via the existing WebSocket infrastructure (`realtime.md`). Rather than re-rendering the entire graph on every event, the map applies incremental updates:

| Event                                                 | Map Response                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `schema.table_created` / `schema.table_deleted`       | Add/remove table node. Re-layout adjacent nodes.                                |
| `schema.field_created` / `schema.field_deleted`       | Update table node metadata (field count). If cross-link field, add/remove edge. |
| `sync.status_changed`                                 | Update sync source node status indicator.                                       |
| `sync.connection_created` / `sync.connection_deleted` | Add/remove sync source node and edges.                                          |
| `automation.status_changed`                           | Update automation node status indicator.                                        |
| `automation.run_completed`                            | Update automation node last run status (debounced).                             |
| `portal.published` / `portal.unpublished`             | Update portal node status indicator.                                            |
| `approval.requested` / `approval.decided`             | Update approval workflow node pending count.                                    |

**Debouncing:** High-frequency events (automation runs, sync status pings) are debounced to a maximum of 1 update per 5 seconds to prevent map flickering.

**Full refresh fallback:** If > 10 incremental updates accumulate within 30 seconds, the client discards the incremental queue and fetches a fresh graph from the server. This prevents desynchronization between the client graph and the server state.

---

## Phase Integration

| Phase                                               | Map Deliverables                                                                                                                                                                                                                                                                                                                                                                                                                                 | Depends On                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Post-MVP — Verticals & Advanced**                 | Full Workspace Map implementation. Topology graph generator. React Flow canvas with all node types for Data and Logic layers. Edge rendering. Cluster layout. Zoom levels with semantic zoom. Detail panel for all node types. Search and filter. Impact analysis (Tier 1–3). AI impact summary. Minimap. Desktop + tablet + phone list view. Permissions. Real-time incremental updates. Caching. Command Bar integration. Workspace nav entry. | SDS (MVP — Core UX), Automations (Post-MVP — Automations), Portals (Post-MVP — Portals & Apps), Document Templates (Post-MVP — Documents), AI Field Agents (MVP — Core UX), Approval Workflows (MVP — Core UX/6), Cross-linking (MVP — Core UX), Sync Engine (MVP — Sync), Real-time (MVP — Core UX) |
| **Post-MVP — Verticals & Advanced (Surface layer)** | Portal, App, Website, Commerce Embed, Chat Widget node types. All surface-layer edge types. Surface cluster.                                                                                                                                                                                                                                                                                                                                     | Portals (Post-MVP — Portals & Apps), Apps / App Designer (Post-MVP — Custom Apps, post-MVP), Embeddable Extensions (Post-MVP — Portals & Apps (Fast-Follow)/9c), Workspace Map core (Post-MVP — Verticals & Advanced)                                                                                |
| **Post-MVP — Custom Apps & Live Chat+**             | Export as image/PDF (for stakeholder presentations). Shareable read-only map link (for agency clients). Time-travel mode (show map state at a previous date using audit log). Map-based automation creation ("connect these two tables" → automation wizard).                                                                                                                                                                                    | Workspace Map core (Post-MVP — Verticals & Advanced)                                                                                                                                                                                                                                                 |

### Post-MVP — Verticals & Advanced Scope (Core)

The full Workspace Map ships in Post-MVP — Verticals & Advanced because it requires most subsystems to exist before it can visualize them meaningfully. Building it earlier would result in a sparse, unimpressive map. By Post-MVP — Verticals & Advanced, a typical workspace has: sync connections (MVP — Sync), tables with Cross-Links (MVP — Core UX), Automations (Post-MVP — Automations), Portals (Post-MVP — Portals & Apps), Document Templates (Post-MVP — Documents), AI agents (MVP — Core UX), and approval workflows (MVP — Core UX/6). This is the critical mass that makes the map valuable.

**Exception — early preview:** A minimal "connection preview" could ship as early as MVP — Core UX in the cross-link creation wizard — showing a small subgraph of the tables being connected. This is not the full Workspace Map but uses the same graph rendering infrastructure (React Flow) as a foundation.

---

## Claude Code Prompt Roadmap

> **⚠️ BUILD SEQUENCE NOTE:** The prompts below are a suggested decomposition of this feature into buildable units. They are **not a build plan**. The active phase build doc controls what to build and in what order. When creating a phase build doc, cherry-pick from these prompts and reorder as needed for the sprint's scope.

### Prompt 1: Topology Graph Types and Generator Foundation

```
Define the TypeScript types and server action foundation for the EveryStack Workspace Map.

Reference docs to read first:
- `workspace-map.md` — this document, full spec
- `schema-descriptor-service.md` — SDS output schema, describe_workspace(), describe_links()
- `data-model.md` — table schema, field types

Files to create:
1. `src/lib/workspace-map/types.ts` — All interfaces: TopologyGraph, TopologyNode (all 14 subtypes), TopologyEdge, EdgeType, TopologyCluster, TopologyStats, ImpactAnalysisResult, LayoutConfig
2. `src/lib/workspace-map/constants.ts` — Edge visual styles map (EdgeType → color/dash/thickness), node icon map, cluster config, zoom level thresholds, performance limits

Types only, no implementation. Add JSDoc comments. Export everything.
Ensure EdgeType is a string union with all 28 edge types from the spec.
Ensure each TopologyNode subtype has a `type` discriminator field for exhaustive switch/case.
```

### Prompt 2: Graph Generator — Node Builder

```
Implement the node-building phase of the topology graph generator.

Reference docs to read first:
- `workspace-map.md` — Node Types section, Data Sources section
- `schema-descriptor-service.md` — describe_workspace() output shape
- `sync-engine.md` — sync connection data model
- `automations.md` — automation data model, step config shapes
- `portals.md` — portal data model, block data_binding
- `ai-field-agents-ref.md` — AIFieldAgentConfig shape

File: `src/lib/workspace-map/build-nodes.ts`

Create `buildNodes()` function that:
1. Reads SDS workspace descriptor → creates BaseNode + TableNode for each base/table
2. Reads sync_connections → creates SyncSourceNode per connection
3. Reads automations table → creates AutomationNode per automation (parse step JSONB to extract trigger_table_id, action_table_ids, external_services)
4. Reads portals table → creates PortalNode (type=portal), AppNode (type=app), WebsiteNode (portal_mode=website)
5. Reads app_blocks (post-MVP) with data_binding → resolves bound_table_ids per portal/app
6. Reads document_templates → creates DocumentTemplateNode (parse merge_fields to extract referenced_field_ids, referenced_cross_link_ids)
7. Reads fields where field_type = 'ai_field_agent' → creates AIFieldAgentNode (parse config for field refs)
8. Reads fields where field_type = 'status' AND config.transitions → creates ApprovalWorkflowNode
9. Reads connected_services → creates ExternalServiceNode per service
10. Reads webhook_endpoints → creates WebhookNode
11. Reads commerce_embeds, chat_widgets → creates respective nodes
12. Reads aggregate run stats (30-day) from automation_runs and ai_agent_runs

Use Drizzle ORM for all queries. Respect tenant_id isolation. Each query should be independent and parallelizable (Promise.all).

Add unit tests for node creation from mock data — at minimum test that each node type is correctly created with all required fields.
```

### Prompt 3: Graph Generator — Edge Builder

```
Implement the edge-building phase of the topology graph generator.

Reference docs to read first:
- `workspace-map.md` — Edge Types section, Edge Extraction from Config section
- `cross-linking.md` — cross_links table, relationship types
- `automations.md` — step config shapes, 22 triggers, 42 actions
- `portals.md` — block data_binding JSONB shape
- `ai-field-agents-ref.md` — AIFieldAgentConfig, LocalFieldRef, LinkedFieldRef, MultiHopFieldRef

File: `src/lib/workspace-map/build-edges.ts`

Create `buildEdges()` function that:
1. Cross-links from SDS describe_links() → cross_link edges (teal, thick) + native_link edges (dimmer)
2. Parse each automation's step array:
   - Trigger step config.table_id → automation_triggers_from
   - Create/Update actions config.target_table_id → automation_writes_to
   - Find/Query actions config.table_id → automation_reads_from
   - External service actions → automation_calls_service
   - Run Automation config.automation_id → automation_chains
   - Webhook actions → webhook_sends
3. Parse each app_block's data_binding (post-MVP App Designer outputs):
   - data_binding.source.table_id → portal_displays / app_binds_to / website_displays
   - Form block targets → portal_writes_to
   - Portal scoping_config → portal_scoped_by
4. Parse Document Template merge fields → doc_merges_from + doc_traverses_link
5. Parse AI field agent configs:
   - LocalFieldRef → ai_agent_reads (same table)
   - LinkedFieldRef → ai_agent_reads + ai_agent_hops
   - MultiHopFieldRef → chain of ai_agent_hops
   - aggregate_context → ai_agent_aggregates
6. Approval workflow transitions → approval_governs
7. Formula dependency graph → formula_depends (cross-table only)
8. Commerce embed → commerce_sells_from + commerce_records_to
9. Chat widget → chat_links_to

Each edge gets a deterministic ID: `${source_type}:${source_id}->${target_type}:${target_id}:${edge_type}`
Assign strength: cross_link = 'critical', writes_to/triggers = 'normal', reads = 'weak'
Deduplicate: if the same edge (same source, target, type) would be created twice, keep one and increment a `count` metadata field.

Add comprehensive unit tests: mock a workspace with 5 tables, 3 cross-links, 2 automations, 1 portal, 1 Document Template, 1 AI agent. Assert all expected edges are generated with correct types and directions.
```

### Prompt 4: Graph Generator — Layout Engine and Caching

```
Implement the layout computation and caching for the Workspace Map.

Reference docs to read first:
- `workspace-map.md` — Layout Engine section, Caching Strategy section
- `design-system.md` — spacing scale, responsive breakpoints

Files:
1. `src/lib/workspace-map/layout.ts` — Layout computation
2. `src/lib/workspace-map/cache.ts` — Redis caching with invalidation
3. `src/lib/workspace-map/generate.ts` — Top-level generateTopologyGraph() server action

Layout algorithm:
1. Use `dagre` (npm package) for initial layered layout:
   - Layer 0: SyncSourceNodes
   - Layer 1: BaseNodes + TableNodes (tables clustered by base)
   - Layer 2: AutomationNodes + AIFieldAgentNodes + ApprovalWorkflowNodes
   - Layer 3: PortalNodes + AppNodes + WebsiteNodes + DocumentTemplateNodes + ExternalServiceNodes
2. Apply cluster padding (40px) around base groups
3. Node spacing: 80px minimum between nodes in same layer
4. Layer spacing: 400px between layers
5. Edge routing: use dagre's built-in edge routing (orthogonal paths)

Caching:
- Redis key: `cache:t:{tenantId}:workspace_map_graph`
- TTL: 300 seconds
- Invalidation: on schema_version_hash change
- Generate on cache miss only

Top-level server action:
- Check Redis cache → return if valid
- Call buildNodes(), buildEdges(), buildClusters(), computeLayout()
- Assemble TopologyGraph
- Store in Redis
- Return to client

Performance target: < 500ms for 100-node graph generation. Use Promise.all for parallel DB queries.
Add timing instrumentation logging via Pino (observability.md pattern).
```

### Prompt 5: React Flow Canvas — Core Map Component

```
Implement the Workspace Map React page and core canvas component.

Reference docs to read first:
- `workspace-map.md` — Canvas interactions, Toolbar, Route Architecture, Zoom Levels
- `design-system.md` — Application shell, design system, workspace accent color

Install: `npm install @xyflow/react dagre`

Files:
1. `src/app/(platform)/workspace/[workspaceId]/map/page.tsx` — Route page, loads graph via server action
2. `src/components/workspace-map/WorkspaceMap.tsx` — Main component: React Flow canvas + toolbar + minimap
3. `src/components/workspace-map/MapToolbar.tsx` — 48px top toolbar with back, search, filter, zoom controls
4. `src/components/workspace-map/MapMinimap.tsx` — 180×120px minimap (React Flow MiniMap component wrapper)

WorkspaceMap component:
- Receives TopologyGraph as prop
- Converts TopologyNodes → React Flow nodes (positioned by layout data)
- Converts TopologyEdges → React Flow edges (with custom edge styles per EdgeType)
- Configures React Flow: fitView on initial load, smooth zoom, panning, multi-selection
- Handles semantic zoom: listen to onViewportChange, toggle node detail level based on zoom
- Preserves map state (zoom, pan, selection) in sessionStorage for back-button restoration

Toolbar:
- Search: controlled input, filters nodes client-side, selecting a result calls reactFlowInstance.fitView({nodes: [selectedNode]})
- Filter: dropdown popover with layer and status toggles (filter state in React state, applies to node/edge visibility)
- Zoom controls: +/- buttons calling reactFlowInstance.zoomIn()/zoomOut(), fit-to-view button
- Refresh: calls server action to regenerate graph

Apply design system. Workspace accent color for emphasis elements. Surface tokens via CSS custom properties. Full-screen route (no workspace sidebar — sidebar collapses, same pattern as automation builder).
```

### Prompt 6: Custom Node Components

```
Implement the custom React Flow node components for each topology node type.

Reference docs to read first:
- `workspace-map.md` — Node Rendering section, Node Icons and Colors, Node Status Indicators
- `design-system.md` — typography, spacing, colors

Files (one component per node type category):
1. `src/components/workspace-map/nodes/SyncSourceNode.tsx` — Platform logo, sync status, table/record counts
2. `src/components/workspace-map/nodes/DataNode.tsx` — Renders BaseNode and TableNode (semantic zoom: compact at standard zoom, expanded at detail zoom)
3. `src/components/workspace-map/nodes/AutomationNode.tsx` — Zap icon, status dot (with pulse animation for failures), trigger type badge
4. `src/components/workspace-map/nodes/SurfaceNode.tsx` — Renders PortalNode, AppNode, WebsiteNode, CommerceEmbedNode, ChatWidgetNode (shared card layout, different icons per type)
5. `src/components/workspace-map/nodes/DocumentTemplateNode.tsx` — File icon, source table label, output format badge
6. `src/components/workspace-map/nodes/AIAgentNode.tsx` — Brain/sparkles icon, trigger mode badge, credit usage indicator
7. `src/components/workspace-map/nodes/ExternalServiceNode.tsx` — Service icon, connection status
8. `src/components/workspace-map/nodes/ApprovalNode.tsx` — Shield-check icon, mode badge, pending count
9. `src/components/workspace-map/nodes/ClusterNode.tsx` — Collapsed cluster summary: label + stats + expand button

Each node component:
- Accepts the typed TopologyNode data as props
- Renders a card with 2px left color accent, icon, label, status dot, summary line
- At 'detail' zoom level (prop: `detailLevel: 'compact' | 'standard' | 'detail'`), expands to show additional metadata
- Has React Flow Handle components for edge connections (source on right, target on left)
- Uses lucide-react icons
- Uses surface tokens and workspace accent color via CSS custom properties

Icons: Use lucide-react — RefreshCw (sync), Database (base), Table (table), Zap (automation), Globe (portal), LayoutGrid (app), Monitor (website), CreditCard (commerce), MessageCircle (chat), FileText (doc), Brain (AI), ShieldCheck (approval), Webhook (webhook), Plug (external service).
```

### Prompt 7: Detail Panel and Node Navigation

```
Implement the detail panel that opens when a node is selected, and double-click navigation.

Reference docs to read first:
- `workspace-map.md` — Node Click Behavior section, Detail Panel Content, Double-Click Navigation, Context Menu
- `design-system.md` — panel patterns, typography

Files:
1. `src/components/workspace-map/DetailPanel.tsx` — 360px right panel (desktop) or bottom sheet (tablet), renders detail content per node type
2. `src/components/workspace-map/details/TableDetail.tsx` — Fields list, connections list, approval info, Open Table + Show Impact buttons
3. `src/components/workspace-map/details/AutomationDetail.tsx` — Trigger info, action steps, performance stats, dependencies
4. `src/components/workspace-map/details/PortalDetail.tsx` — Page count, bound tables, client count, publish status
5. `src/components/workspace-map/details/AIAgentDetail.tsx` — Field refs, hop visualization, aggregate sources, credit usage
6. `src/components/workspace-map/details/GenericDetail.tsx` — Fallback for simpler node types (webhook, commerce, chat, external service)
7. `src/components/workspace-map/NodeContextMenu.tsx` — Right-click context menu with Show Impact, Show Connections Only, Open in New Tab, Copy Link, Hide

DetailPanel:
- Opens on node selection (React Flow onNodeClick)
- Closes on canvas click or ✕ button
- Switches content based on selected node's `type` discriminator
- "Connected To" section: lists all edges connected to this node, grouped by direction (incoming/outgoing), with node names as clickable links (clicking pans map to that node)
- "Open [Entity]" button: navigates to entity builder (same tab)
- "Show Impact" button: triggers impact analysis mode

Double-click handler:
- React Flow onNodeDoubleClick → navigate to entity URL based on node type
- Before navigating, save map state to sessionStorage: { zoom, pan, selectedNodeId, filters }
- On map page load, check sessionStorage for saved state and restore

Context menu:
- Use @radix-ui/react-context-menu (already in shadcn)
- Positioned at cursor on right-click
- Long-press on tablet triggers same menu (React Flow touchHoldTime)
```

### Prompt 8: Impact Analysis

```
Implement the impact analysis system — the Workspace Map's killer feature.

Reference docs to read first:
- `workspace-map.md` — Impact Analysis Overlay section, Impact Severity Tiers, Impact Computation, Impact Summary Card
- `cross-linking.md` — CrossLinkImpactAnalysis, 3-tier consequence model
- `ai-architecture.md` — AI prompt patterns for generating natural language summaries

Files:
1. `src/lib/workspace-map/impact-analysis.ts` — Server-side impact computation: BFS graph traversal from selected node, applying impact propagation rules per edge type, returning ImpactAnalysisResult
2. `src/lib/workspace-map/impact-rules.ts` — Impact propagation rule definitions: edge_type → {downstream_tier, propagation_condition} for each of the 28 edge types
3. `src/components/workspace-map/ImpactOverlay.tsx` — Client-side overlay: dims unaffected nodes (opacity 0.2), highlights affected nodes with colored borders (red/amber/blue per tier), animates affected edges with flowing dots
4. `src/components/workspace-map/ImpactSummaryCard.tsx` — Floating card above canvas: tier counts, plain-text summary, "Generate AI Summary" button
5. `src/lib/workspace-map/impact-ai-summary.ts` — AI summary generator: builds prompt from ImpactAnalysisResult, calls AI provider for natural language summary (2 credits)

Impact computation algorithm:
1. Start at selected node
2. BFS outward following edges in the forward direction
3. For each reached node, determine impact tier based on the edge type and propagation rules
4. If a node is reached via multiple paths, use the highest (most severe) tier
5. Track the edge_path for each affected node (for visualization)
6. Stop traversal at depth 5 (prevent infinite chains)
7. Return ImpactAnalysisResult

Impact overlay UX:
- Activated via "Show Impact" button in detail panel or context menu
- Escape key or "✕ Close" on summary card deactivates
- While active, clicking a different node runs impact analysis on that node instead
- Affected edge animation: CSS animation on SVG path stroke-dashoffset (flowing dots effect)

AI summary:
- Optional, user-initiated (button click, costs 2 credits)
- Prompt: "You are analyzing the impact of [removing/changing] [entity name] in a workspace. Here are the affected entities: [structured data from ImpactAnalysisResult]. Write a 2-3 sentence plain-language summary explaining what would break, what would degrade, and what the user should know before making this change."
- Response displayed in the summary card
- Cached per (node_id, schema_version_hash) for 5 minutes
```

### Prompt 9: Phone List View and Responsive Adaptations

```
Implement the phone list view and tablet adaptations for the Workspace Map.

Reference docs to read first:
- `workspace-map.md` — Responsive Behavior section, Phone list view
- `mobile.md` — device tier strategy, ergonomic constraints
- `design-system.md` — responsive breakpoints, thumb zone rules

Files:
1. `src/components/workspace-map/MobileListView.tsx` — Phone (< 768px) list view: collapsible sections for Data, Logic, Surfaces, Intelligence. Each item shows icon + name + status dot. Tap → navigate to entity builder.
2. `src/components/workspace-map/MapBottomSheet.tsx` — Tablet detail panel: bottom sheet (40% height) with drag handle, same content as desktop DetailPanel but in bottom-sheet layout.

MobileListView:
- Receives same TopologyGraph data as desktop (no separate API)
- Groups nodes by layer: Data (sync sources, bases, tables), Logic (automations, approval workflows, webhooks), Surfaces (portals, apps, websites, docs, commerce, chat), Intelligence (AI agents)
- Each section header shows count. Sections are collapsible (accordion).
- Items sorted: errors first, then active, then inactive
- Search bar at top filters all items
- Tapping an item navigates to its builder (same behavior as double-click on desktop)
- No impact analysis on phone (too visual for small screen)

WorkspaceMap responsive wrapper:
- Use `useMediaQuery` to detect viewport width
- < 768px → render MobileListView
- 768px–1279px → render canvas map + MapBottomSheet for detail
- ≥ 1280px → render canvas map + right DetailPanel

Tablet adaptations:
- Minimap hidden by default, toggle in toolbar
- Node touch targets: minimum 48px tap area (per design-system.md ergonomic constraints)
- Context menu via long-press (300ms threshold)
```

### Prompt 10: Real-Time Updates and Command Bar Integration

```
Implement real-time incremental updates and Command Bar integration for the Workspace Map.

Reference docs to read first:
- `workspace-map.md` — Real-Time Updates section, Command Bar Integration
- `realtime.md` — WebSocket transport, room model, Redis pub/sub
- `command-bar.md` — command registration pattern

Files:
1. `src/components/workspace-map/useMapRealtime.ts` — Custom hook: subscribes to `tenant:{tenantId}` channel, listens for workspace_map.invalidated and entity-specific events, applies incremental updates to React Flow state, debounces high-frequency events (5s), falls back to full refresh after 10 accumulated updates in 30s
2. `src/lib/workspace-map/incremental-update.ts` — Functions to apply incremental changes to a TopologyGraph: addNode, removeNode, updateNodeStatus, addEdge, removeEdge, updateStats
3. `src/lib/workspace-map/emit-invalidation.ts` — Server-side: emit `workspace_map.invalidated` event on schema/automation/portal changes (add to existing event handlers, not new infrastructure)

Real-time update flow:
1. Map component calls useMapRealtime(tenantId)
2. Hook subscribes to WebSocket channel
3. On event, determines update type:
   - schema.table_created → addNode(TableNode) + addEdges for parent base connection
   - automation.status_changed → updateNodeStatus(automationId, newStatus)
   - sync.status_changed → updateNodeStatus(syncSourceId, newStatus)
   - automation.run_completed → updateNodeStatus (debounced)
4. Updates React Flow nodes/edges arrays via setState
5. Shows toast "Map updated" for structural changes (new nodes/edges), silent for status changes
6. After 10 accumulated updates in 30s → show "Map has changed significantly — Refresh?" toast

Command Bar commands (register in existing command registry):
- "Go to Workspace Map" → router.push(`/workspace/${id}/map`)
- "Show impact of..." → opens search modal, user types entity name, on selection → router.push(`/workspace/${id}/map?impact=${nodeId}`)
- "Find on map..." → opens search modal → router.push(`/workspace/${id}/map?focus=${nodeId}`)
```

---

## Key Architectural Decisions

| #   | Decision                                                  | Rationale                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Read-only visualization, not an editor                    | The map is a lens. Every entity already has its own builder (automation builder, App Designer, Table View). Adding edit capabilities to the map would duplicate UI and create confusing affordances. Clicking navigates to the right builder.                                                                                         |
| 2   | Server-side graph generation, client-side rendering       | The graph generation queries 10+ tables and computes layout. Doing this client-side would require exposing raw metadata APIs and would be slow. Server-side generation returns a single JSON payload. Client only handles rendering and interaction.                                                                                  |
| 3   | React Flow (not D3, not Cytoscape)                        | React Flow is purpose-built for node-based UIs in React. It handles virtualization, panning, zooming, and edge routing out of the box. D3 would require building all of that from scratch. Cytoscape is more academic/scientific and doesn't produce the polished, branded visual quality we need.                                    |
| 4   | No new database tables                                    | The map reads existing metadata tables only. Adding a `topology_graph` table would create a synchronization problem. By computing the graph on demand from live metadata, the map is always accurate.                                                                                                                                 |
| 5   | SDS as primary data source                                | SDS already exposes the workspace schema in a condensed, permission-filtered format. Reusing SDS ensures the map respects existing permission boundaries without duplicating permission logic.                                                                                                                                        |
| 6   | Cluster-based semantic zoom                               | At workspace scale (50+ tables), showing all nodes at once is overwhelming. Clusters group related nodes (by base, by subsystem) and collapse at low zoom levels. This is how humans naturally organize complex systems — zoom out to see the big picture, zoom in to see details.                                                    |
| 7   | Impact analysis server-side, not client-side              | Impact propagation rules are complex and depend on edge types, cascade rules, and permission boundaries. Computing impact client-side would require sending all rules to the browser and would be hard to maintain. Server-side computation is cached per-node and returns a clean result set.                                        |
| 8   | Phone gets list view, not canvas                          | A topology graph with 50+ nodes and 100+ edges on a 375px-wide screen is useless. Rather than building a compromised touch experience, the phone shows a structured, searchable list that serves the same navigation purpose.                                                                                                         |
| 9   | AI impact summary is optional and on-demand               | Not all users want or need an AI-generated summary. Making it a button click (2 credits) rather than automatic respects the user's AI credit budget and keeps the core map experience fast.                                                                                                                                           |
| 10  | Post-MVP — Verticals & Advanced delivery, not earlier     | The map's value is proportional to workspace complexity. Before Post-MVP — Verticals & Advanced, most workspaces won't have enough subsystems connected to justify the feature. Post-MVP — Verticals & Advanced is the inflection point where sync + tables + cross-links + automations + portals + docs + AI agents are all present. |
| 11  | Edge type taxonomy matches existing subsystem boundaries  | Each edge type maps cleanly to one subsystem's dependency pattern (automation reads/writes, portal displays, doc merges, AI agent reads). This 1:1 mapping makes the edge extraction code maintainable — each subsystem's edge builder is independent.                                                                                |
| 12  | Deterministic edge IDs                                    | Edge IDs are derived from source, target, and type — not randomly generated. This enables efficient diffing for incremental real-time updates. If the same logical edge exists in both the old and new graph, it keeps the same ID and React Flow doesn't re-render it.                                                               |
| 13  | Cross-link edges visually prominent (thicker, brand teal) | Cross-links are the moat. The map should make them impossible to miss. A user glancing at their map should immediately see which connections span platform boundaries — reinforcing the value that only EveryStack provides.                                                                                                          |

---

## Future Extensions (Post-Post-MVP — Verticals & Advanced)

These are not in scope for the initial implementation but inform architectural decisions:

| Extension                             | Description                                                                                                                                                                   | Why It's Deferred                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Export as image/PDF**               | Render the current map view as a high-resolution PNG or PDF for presentations and stakeholder reports                                                                         | Requires server-side canvas rendering (Puppeteer or similar). Nice-to-have, not core.                                    |
| **Shareable read-only link**          | Generate a temporary URL that shows a static snapshot of the map to non-workspace members (e.g., agency sharing with clients)                                                 | Requires a new access control surface (public links with expiry). Complex security implications.                         |
| **Time-travel mode**                  | Show the workspace map as it existed at a previous date, using audit log data to reconstruct historical topology                                                              | Requires historical schema snapshots. Extremely valuable for debugging "what changed?" but high implementation cost.     |
| **Map-based automation creation**     | Right-click two table nodes → "Create automation between these tables" → launches automation builder with trigger and target pre-configured                                   | Requires deep integration between map and automation builder. Great UX but not MVP.                                      |
| **Diff view**                         | Compare two snapshots of the map (e.g., last week vs today) with additions/removals highlighted                                                                               | Requires versioned snapshots. Valuable for change management.                                                            |
| **Embeddable map widget**             | Embed a read-only, branded mini-map in a portal page showing clients how their data flows                                                                                     | Requires extracting the renderer into an embeddable component. Strong agency value.                                      |
| **AI-powered workspace optimization** | AI analyzes the topology and suggests improvements: "This automation reads from Table A and writes to Table B, but there's no cross-link between them — would one be useful?" | Requires agent architecture (Post-MVP — Verticals & Advanced+). Transform the map from visibility tool to advisory tool. |
