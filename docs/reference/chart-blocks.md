# EveryStack — Chart Blocks & Aggregate Data Visualization

> **🔄 Reconciliation: 2026-02-27 (pass 2)** — Second alignment pass with GLOSSARY.md (source of truth). Changes: (1) "Portal" (when referring to App Designer outputs) → **"App"** throughout per glossary naming discipline — App Designer outputs are "Apps," MVP Quick Portals are "Portals." Renamed section headers, body text, code comments, prompts (~55 instances). (2) DB table `page_blocks` → **`app_blocks`** per glossary Database Entity Quick Reference. (3) File paths `src/components/interfaces/` → **`src/components/views/`** — "Interface" is a banned term per glossary. (4) File paths `src/components/portals/blocks/` → **`src/components/apps/blocks/`** — these are App blocks, not portal blocks. (5) "Portal designer" → **"App Designer"** (straggler in Phase table). (6) Clarified that chart blocks exist only in post-MVP Apps (App Designer), not in MVP Quick Portals. (7) Updated cross-reference annotations to use "App" terms.
>
> Prior (pass 1, 2026-02-27): "Interface" → "Table View" / "view." "board" → "kanban." Tagged post-MVP features. Updated cross-references.

> **⚠️ MOSTLY POST-MVP.** Per GLOSSARY.md: Kanban view is post-MVP, App Designer is post-MVP, DuckDB analytical layer is post-MVP, the `summary` Table View type is not in MVP scope. ProgressChart (MVP — Core UX) is nearest-to-MVP. NumberCard ships Post-MVP — Portals & Apps alongside Kanban view. Chart blocks in Apps require App Designer (post-MVP). MVP Quick Portals (Record View shares) do NOT support chart blocks.

> **Reference doc (Tier 3).** Shared chart rendering component system for aggregate data visualization across Table Views, Apps _(post-MVP)_, and Smart Docs. Defines chart type system, data binding modes (table aggregate + DuckDB analytical), the `summary` Table View type _(post-MVP)_, and the chart component library.
> Cross-references: `tables-and-views.md` (Table View architecture, `views.view_type` enum expansion, summary footer row aggregation pattern, Kanban view pipeline rollups _(post-MVP)_), `app-designer.md` (Chart block and Metric/KPI Card block in block library _(post-MVP)_, App theming, data binding modes), `smart-docs.md` (live data embeds in documents), `duckdb-context-layer-ref.md` (DuckDB `ContextResult` as chart data source _(post-MVP)_, `QueryPlan` for cross-base analytics), `schema-descriptor-service.md` (SDS field metadata for axis label resolution, option ID→label), `data-model.md` (field types, aggregation-compatible types), `design-system.md` (design system color palette, data palette, typography), `agency-features.md` (App chart block enhancements _(post-MVP)_ for `metric_snapshots` time-series, ad platform reporting), `accounting-integration.md` (Financial Command Center — 4-tab workspace-level Table View set with summary cards, trend charts, profitability tables), `project-management.md` (PM dashboards — burndown, utilization, budget vs actuals), `formula-engine.md` (ROLLUP aggregation pattern — charts share the aggregation vocabulary but operate at the view level, not the cell level), `ai-metering.md` (Admin AI Dashboard — usage charts), `mobile.md` (responsive chart rendering, touch interactions), `custom-apps.md` (dashboard summary blocks embedded in custom App pages _(post-MVP)_), `booking-scheduling.md` (scheduling analytics dashboard via `summary` Table View type _(post-MVP)_ — NumberCard metrics for bookings, conversion rates, no-show rates)
> Implements: `apps/web/src/components/CLAUDE.md` (component patterns), `packages/shared/db/CLAUDE.md` (query patterns)
> Source decisions: This document codifies the gap identified in the existing spec — chart rendering was referenced in app-designer.md (Chart block, Metric/KPI Card), agency-features.md (App chart block enhancements _(post-MVP)_), accounting-integration.md (Financial Command Center trend charts and summary cards), and project-management.md (PM dashboards) without being specified. This document provides the specification.
> Cross-references (cont.): `workspace-map.md` (chart data binding to tables produces `chart_aggregates` edges in topology graph — Mode A table aggregate and Mode B DuckDB analytical sources both represented)
> Last updated: 2026-02-27 — Glossary reconciliation pass 2 (see note above). Prior: 2026-02-27 pass 1 — initial glossary alignment. Prior: 2026-02-21 — Added `workspace-map.md` cross-reference. Prior: booking-scheduling.md backlink.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                                         | Lines     | Covers                                                                                           |
| --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| Purpose — Why Charts Are a Shared Primitive                     | 43–58     | Charts as reusable blocks across views, apps, docs                                               |
| Progressive Disclosure Mapping                                  | 59–68     | 3-level progressive disclosure for chart creation                                                |
| Chart Type System                                               | 69–352    | 8 chart types (NumberCard, ProgressChart, Bar, Line, Pie, Scatter, Area, Combo)                  |
| Data Binding — Two Modes                                        | 353–465   | Mode A: Table Aggregate (MVP-adjacent), Mode B: DuckDB Analytical (post-MVP)                     |
| The `summary` Table View Type (Post-MVP)                        | 466–573   | Dashboard-style view composed of chart blocks                                                    |
| Chart Rendering in Apps _(Post-MVP — App Designer Required)_    | 574–622   | Chart blocks in App Designer pages                                                               |
| Chart Rendering in Smart Docs                                   | 623–642   | Embedded charts in documents, snapshot rendering                                                 |
| Chart Component Library — Implementation                        | 643–758   | Recharts components, config-to-props mapping, responsive rendering                               |
| Data Model Additions                                            | 759–818   | chart_configs, metric_snapshots tables                                                           |
| Aggregate Query Engine                                          | 819–898   | SQL aggregation builder, grouping, time bucketing, cross-link aggregation                        |
| Kanban View Pipeline Rollup Integration                         | 899–915   | NumberCard/ProgressChart in Kanban column headers                                                |
| Permissions                                                     | 916–938   | Chart data access respects Table View permissions                                                |
| Phase Integration                                               | 939–976   | MVP — Core UX (NumberCard + ProgressChart) through Post-MVP — Verticals & Advanced (full system) |
| Claude Code Prompt Roadmap                                      | 977–1367  | 10-prompt implementation roadmap                                                                 |
| Appendix: Existing Specs That Reference Charts (Reconciliation) | 1368–1430 | Cross-reference audit for chart mentions across all docs                                         |
| Appendix: Future Extensions (Do Not Build Yet)                  | 1431–1445 | Deferred chart features                                                                          |

---

## Purpose — Why Charts Are a Shared Primitive

EveryStack already has strong aggregate data capabilities at the cell and row level — summary footer rows, grouped aggregation headers, Kanban view pipeline rollups _(post-MVP)_, ROLLUP formula fields, and the DuckDB Context Layer for AI-powered cross-base analytics. What's missing is the **visual rendering layer** that turns aggregate data into charts, KPI cards, sparklines, and trend visualizations.

Charts are referenced across the platform but never specified:

- **Apps** (`app-designer.md`) _(post-MVP)_: Block library lists "Chart" and "Metric/KPI Card" as data block types — unspecced.
- **Financial Command Center** (`accounting-integration.md`): Describes "four summary cards," "revenue breakdown," "trend charts" — no rendering spec.
- **PM Dashboards** (`project-management.md`): References "task completion pie, burndown, milestones, budget vs actuals" — no component definition.
- **Ad Platform Reporting** (`agency-features.md`): Describes "line charts (metric over time), bar charts (comparisons), KPI cards (with period deltas)" — no implementation detail.
- **Table View Architecture** (`tables-and-views.md`): Workspace-level Table Views are described as "aggregation dashboards, executive reporting" but the `views.view_type` enum has no dashboard/summary type.

This document defines **one chart component system** used everywhere — the same principle as the FieldTypeRegistry (one renderer per field type, used in grid, cards, Apps, Smart Docs) and the inline sub-table (one component, multiple rendering contexts).

---

## Progressive Disclosure Mapping

| Level        | User Experience                                                                                                                                                                                                                                                                                                                          | What's Visible                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1 (80%)** | Add a chart block to a Table View (summary type) or App page _(post-MVP)_. Pick a table, pick a field to aggregate, pick a chart type from the 8-type visual picker. Chart renders with sensible defaults (auto-detected axis labels, theme colors, responsive sizing). NumberCard and Progress bar are the most common starting points. | Chart type visual picker, table selector, field selector, auto-configured chart with theme defaults. Summary Table View type _(post-MVP)_.    |
| **L2 (15%)** | Customize chart: group-by field, time granularity (day/week/month/quarter/year), comparison period, color overrides, label formatting, filter conditions, multiple value series on one chart. Embed charts in Smart Docs via merge field syntax.                                                                                         | Full chart configuration panel (group-by, time grain, comparison, filters, series), Smart Doc chart embed blocks, sparkline in summary cards. |
| **L3 (5%)**  | Mode B — DuckDB analytical queries for cross-base chart data sources. Custom `QueryPlan` definitions, multi-table joins, window functions for running totals, portfolio-level aggregation across workspaces.                                                                                                                             | DuckDB query builder (Mode B data binding), cross-base analytics, advanced aggregation functions, analytical chart rendering.                 |

---

## Chart Type System

Eight chart types cover every visualization referenced in existing EveryStack specs. Each type has a defined data shape, configuration surface, and set of rendering contexts.

### Type Overview

| Chart Type    | Icon         | Data Shape                                   | Primary Use Cases                                                           |
| ------------- | ------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| `number_card` | `#`          | Single aggregate value + optional comparison | KPI cards, Financial Command Center summary cards, Kanban pipeline totals   |
| `bar`         | Bar chart    | Categories × values                          | Revenue by client, expenses by category, deals by stage                     |
| `stacked_bar` | Stacked bar  | Categories × value series                    | Revenue breakdown by source per month, expense composition                  |
| `line`        | Line chart   | Time series × value series                   | Monthly revenue trend, cash position over time, metric history              |
| `area`        | Area chart   | Time series × value series (stackable)       | Cumulative cash flow projection, pipeline value over time                   |
| `donut`       | Donut/ring   | Categories × values (proportional)           | Expense breakdown, pipeline by stage, task status distribution              |
| `progress`    | Progress bar | Current value + target                       | Budget burn, utilization %, retainer usage, project completion              |
| `sparkline`   | Mini line    | Compact time series (no axes)                | Inline trend indicator in table cells, summary cards, Kanban column headers |

### Chart Type Specifications

#### `number_card`

The most common chart type. Displays a single aggregate value prominently with optional comparison indicator. Maps directly to the "four summary cards" pattern in the Financial Command Center and the pipeline rollup display in Kanban view.

```
┌─────────────────────────────┐
│  Revenue            ▲ 12.4% │
│  $142,500                   │
│  vs $126,800 last month     │
│  ───────── sparkline ────── │  ← optional inline sparkline
└─────────────────────────────┘
```

**Configuration:**

```typescript
interface NumberCardConfig {
  chart_type: 'number_card';
  label: string; // Display label ("Revenue", "Open Deals", "Utilization")
  format: 'number' | 'currency' | 'percent' | 'duration';
  currency_code?: string; // ISO 4217, when format = 'currency'
  precision?: number; // Decimal places (default: 0 for number, 2 for currency)
  abbreviate?: boolean; // true → "$142.5K" instead of "$142,500" (default: true for values > 9,999)
  comparison?: {
    type: 'prior_period' | 'fixed_value' | 'field_aggregate';
    period_offset?: number; // -1 = prior period (default), -4 = same period last year, etc.
    fixed_value?: number; // When type = 'fixed_value'
    field_id?: string; // When type = 'field_aggregate' (e.g., compare actual vs budget)
    aggregation?: AggregationFunction; // For field_aggregate comparison
    label?: string; // "vs last month", "of $200K target", etc.
  };
  trend?: {
    // Optional sparkline at bottom of card
    enabled: boolean;
    periods: number; // How many periods to show (default: 6)
  };
  color_rule?: {
    // Conditional card accent color
    positive: 'green' | 'red'; // Is positive delta good (revenue) or bad (expenses)?
    thresholds?: { warn: number; danger: number }; // For progress-style coloring
  };
}
```

#### `bar`

Vertical or horizontal bar chart. Categories on one axis, aggregate values on the other. Supports single or multiple value series.

**Configuration:**

```typescript
interface BarChartConfig {
  chart_type: 'bar';
  orientation: 'vertical' | 'horizontal'; // Default: 'vertical'
  category_axis: {
    field_id: string; // The field to group by (select, status, people, linked record, date)
    label?: string; // Axis label override
    sort: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc' | 'natural'; // Default: 'value_desc'
    max_categories?: number; // Top N categories, remainder grouped as "Other" (default: 12)
  };
  value_series: ValueSeries[]; // 1–4 value series (multiple = grouped bars)
  show_values?: boolean; // Show value labels on bars (default: true when ≤ 8 categories)
  show_legend?: boolean; // Show legend (default: true when > 1 series)
}
```

#### `stacked_bar`

Same as bar but values stack within each category. Supports absolute and percentage (100%) stacking.

**Configuration:**

```typescript
interface StackedBarChartConfig {
  chart_type: 'stacked_bar';
  orientation: 'vertical' | 'horizontal';
  category_axis: CategoryAxis; // Same as bar
  stack_field_id: string; // Field that defines the segments within each bar
  value_series: ValueSeries; // Single value field to aggregate (stacking creates the series)
  stack_mode: 'absolute' | 'percent'; // 'percent' normalizes each bar to 100%
  max_segments?: number; // Top N segments, rest grouped as "Other" (default: 6)
  show_values?: boolean;
  show_legend?: boolean; // Default: true
}
```

#### `line`

Time-series line chart. X-axis is always a date/time field. Supports multiple value series for comparison.

**Configuration:**

```typescript
interface LineChartConfig {
  chart_type: 'line';
  time_axis: {
    field_id: string; // Date or datetime field
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
    range?: {
      // Default: auto-fit to data
      type: 'relative' | 'absolute';
      relative_periods?: number; // e.g., 6 = last 6 periods at the given granularity
      start?: string; // ISO date, for absolute range
      end?: string;
    };
    label?: string;
  };
  value_series: ValueSeries[]; // 1–4 lines
  interpolation: 'linear' | 'monotone' | 'step'; // Default: 'monotone' (smooth curves)
  show_points?: boolean; // Show data points on line (default: true when ≤ 12 points)
  show_area?: boolean; // Fill area under line (default: false — use 'area' type for filled)
  show_legend?: boolean;
  annotations?: ChartAnnotation[]; // Horizontal reference lines, vertical event markers
}
```

#### `area`

Filled area chart. Same configuration as `line` with additional stacking support. Used for cumulative visualizations (cash flow projections, pipeline value over time).

**Configuration:**

```typescript
interface AreaChartConfig {
  chart_type: 'area';
  time_axis: TimeAxis; // Same as line
  value_series: ValueSeries[];
  stack_mode?: 'none' | 'absolute' | 'percent'; // Default: 'none' (overlapping areas)
  interpolation: 'linear' | 'monotone' | 'step';
  opacity?: number; // Fill opacity 0–1 (default: 0.3)
  show_legend?: boolean;
  annotations?: ChartAnnotation[];
}
```

#### `donut`

Proportional ring chart. Shows category distribution as segments of a circle. Center displays total or label.

**Configuration:**

```typescript
interface DonutChartConfig {
  chart_type: 'donut';
  category_field_id: string; // Field to segment by
  value_series: ValueSeries; // Single value to aggregate per segment
  max_segments?: number; // Top N, rest as "Other" (default: 8)
  center_label?: 'total' | 'count' | 'custom'; // What to show in the donut hole
  center_custom_text?: string; // When center_label = 'custom'
  show_legend?: boolean; // Default: true
  show_values?: boolean; // Show value labels on segments (default: false — too cluttered)
  show_percent?: boolean; // Show percentage labels (default: true)
}
```

#### `progress`

Single-value progress indicator with a target. Used for budget burn, utilization rates, retainer usage, project completion. Renders as a horizontal bar, radial gauge, or large number with arc — configurable.

**Configuration:**

```typescript
interface ProgressChartConfig {
  chart_type: 'progress';
  label: string;
  current_value: ValueSeries; // Single aggregate producing the "current" number
  target: {
    type: 'fixed' | 'field_aggregate';
    fixed_value?: number; // e.g., 100 for percentage, $50,000 for budget
    field_id?: string; // e.g., budget field
    aggregation?: AggregationFunction;
  };
  format: 'percent' | 'currency' | 'number' | 'duration';
  currency_code?: string;
  display_style: 'bar' | 'radial' | 'number'; // Default: 'bar'
  thresholds?: {
    healthy: number; // Green below this (or above, depending on direction)
    warning: number; // Amber
    danger: number; // Red
  };
  invert_color?: boolean; // true = lower is better (expense burn), false = higher is better (utilization)
}
```

#### `sparkline`

Minimal inline trend indicator with no axes, labels, or legends. Designed for embedding in number_card trend slots, table grid cells (future), and compact dashboard layouts. Renders as a small SVG line.

**Configuration:**

```typescript
interface SparklineConfig {
  chart_type: 'sparkline';
  time_axis: {
    field_id: string;
    granularity: 'day' | 'week' | 'month';
    periods: number; // How many data points (default: 6)
  };
  value_series: ValueSeries; // Single value
  height_px?: number; // Default: 32
  width_px?: number; // Default: 120
  show_endpoint_dots?: boolean; // Show dots on first and last point (default: true)
  color?: string; // Override theme color
}
```

### Shared Type Definitions

```typescript
interface ValueSeries {
  field_id: string; // Field to aggregate
  aggregation: AggregationFunction;
  label?: string; // Series label for legend (defaults to "{aggregation} of {field_name}")
  color?: string; // Override auto-assigned color from palette
}

type AggregationFunction = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max' | 'median';

interface CategoryAxis {
  field_id: string;
  label?: string;
  sort: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc' | 'natural';
  max_categories?: number;
}

interface TimeAxis {
  field_id: string;
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  range?: {
    type: 'relative' | 'absolute';
    relative_periods?: number;
    start?: string;
    end?: string;
  };
  label?: string;
}

interface ChartAnnotation {
  type: 'horizontal_line' | 'vertical_line';
  value: number | string; // Number for horizontal (y-value), ISO date string for vertical (x-position)
  label?: string; // "Target: $100K", "Launch Date"
  color?: string;
  style: 'solid' | 'dashed'; // Default: 'dashed'
}
```

### Field Type Compatibility for Aggregation

Not every field type can serve as a chart axis or value. This matrix defines compatibility — enforced in the chart configuration UI.

| Field Type                                  | As Value (aggregate)                      | As Category (group by)              | As Time Axis           |
| ------------------------------------------- | ----------------------------------------- | ----------------------------------- | ---------------------- |
| number, currency, percent, duration, rating | ✅ All aggregations                       | ❌                                  | ❌                     |
| progress                                    | ✅ (avg, min, max)                        | ❌                                  | ❌                     |
| single_select, status                       | ✅ (count only)                           | ✅                                  | ❌                     |
| multi_select                                | ✅ (count only)                           | ✅ (each tag = separate category)   | ❌                     |
| people, created_by, updated_by              | ✅ (count only)                           | ✅                                  | ❌                     |
| linked_record                               | ✅ (count only)                           | ✅ (by display field)               | ❌                     |
| checkbox                                    | ✅ (count where true, count where false)  | ✅ (true/false as categories)       | ❌                     |
| date, created_time, last_modified_time      | ❌                                        | ✅ (bucketed by granularity)        | ✅                     |
| text, text_area, email, url, phone          | ❌                                        | ✅ (unique values, limited utility) | ❌                     |
| formula, rollup, lookup                     | Depends on output type — map to the above | Depends on output type              | Depends on output type |
| attachment, smart_doc, barcode              | ❌                                        | ❌                                  | ❌                     |

The chart configuration UI shows only compatible fields in each picker based on this matrix. No error state needed — incompatible options are never offered.

---

## Data Binding — Two Modes

Charts need aggregate data. Two binding modes serve different complexity levels, following EveryStack's progressive disclosure principle.

### Mode A: Table Aggregate (Simple — 80% of Charts)

The chart points at one table, picks a value field and aggregation function, and optionally groups by a category or time field. This is conceptually identical to the summary footer row aggregation — the same operation, different renderer.

**Execution:** Runs as a Postgres aggregate query against the records table. Single-table, indexed, fast. No DuckDB involvement.

```typescript
interface TableAggregateBinding {
  mode: 'table_aggregate';
  source_table_id: string;
  filters?: FilterRule[]; // Same filter grammar as view filters, supports $me
  // The chart type config (above) defines which fields and aggregations to compute.
  // This binding provides the table context and pre-filters.
}
```

**Query generation:** The chart renderer builds a Postgres query based on the chart type's configuration:

```sql
-- Example: bar chart of deal value by stage
SELECT
  canonical_data->>'fld_stage' AS category,         -- category_axis.field_id
  SUM((canonical_data->>'fld_value')::numeric) AS value  -- value_series[0]
FROM records
WHERE table_id = $1
  AND tenant_id = $2
  AND deleted_at IS NULL
  AND (canonical_data->>'fld_status') != 'Lost'    -- chart-level filters
GROUP BY canonical_data->>'fld_stage'
ORDER BY value DESC
LIMIT 12;                                         -- max_categories
```

**Option ID → label resolution:** When the category axis is a `single_select`, `status`, or `multi_select` field, the query returns option IDs. The chart renderer resolves these to human-readable labels using the field's `options` array from `fields.config` — same pattern as DuckDB Context Layer type coercion and the `canonicalToAIContext()` read path. People fields resolve to display names via workspace membership lookup.

**Permission enforcement:** The query includes the user's permission filters (same filters applied to grid views). View `base_filters` and tab `filters` layer on top. A chart never shows data the user wouldn't see in a table view of the same data.

**Caching:** Chart aggregate queries are cached with a short TTL (30 seconds). Cache key: `chart:{chart_block_id}:{user_id}:{filter_hash}`. Invalidated on any record mutation in the source table (via the existing real-time pub/sub channel). This prevents chart queries from running on every page load while keeping data fresh.

### Mode B: DuckDB Analytical (Power — 20% of Charts)

For charts that need cross-base JOINs, multi-table aggregations, or complex computed metrics, the chart binds to a DuckDB `QueryPlan`. The DuckDB Context Layer (`duckdb-context-layer-ref.md`) already returns `ContextResult` with typed columns and rows — this is exactly the shape a chart component needs.

```typescript
interface DuckDBAnalyticalBinding {
  mode: 'duckdb_analytical';
  query_plan: QueryPlan; // Full DuckDB QueryPlan (see duckdb-context-layer-ref.md)
  column_mapping: {
    // Map ContextResult columns to chart axes
    category_column?: string; // Column alias for category axis
    time_column?: string; // Column alias for time axis
    value_columns: string[]; // Column alias(es) for value series
    series_column?: string; // Column alias for multi-series (creates one line/bar per unique value)
  };
}
```

**Example:** Financial Command Center "Revenue Trend" chart — needs data from `financial_summary` (materialized table) which itself aggregates across invoices, time entries, and accounting snapshots:

```sql
-- analytical_sql in QueryPlan
SELECT
  period_month AS month,
  actual_revenue AS accounting_revenue,
  invoiced_revenue AS everystack_invoiced,
  collected_revenue AS collected
FROM financial_summary
WHERE tenant_id = $tenant
ORDER BY period_month ASC
```

The chart maps `month` to the time axis and the three revenue columns to three line series.

**When to use Mode B:** Mode B is appropriate when the chart's data source is not a single EveryStack table, or when the aggregation logic exceeds what a simple GROUP BY can express. Specific triggers:

- Cross-base data (e.g., deals from CRM base + invoices from Finance base)
- The `financial_summary` or `financial_snapshots` materialized tables
- The `metric_snapshots` time-series table (ad platform metrics)
- Multi-step computed metrics (e.g., "win rate by contact segment" requires JOIN + conditional aggregation)
- Any query that would require DuckDB's analytical SQL capabilities

**Mode B is not available in MVP — Core UX.** It ships in Post-MVP — Verticals & Advanced when DuckDB Context Layer is production-ready. Charts that will eventually use Mode B are built first with Mode A against intermediate materialized tables (like `financial_summary`), then upgraded to Mode B queries when available.

### Mode C: Static / Metric Snapshots (Time-Series History)

A specialized variant of Mode A for `metric_snapshots` data (ad platform metrics) and `financial_snapshots` (accounting reports). These tables store historical time-series data that doesn't fit the standard records table pattern.

```typescript
interface MetricSnapshotBinding {
  mode: 'metric_snapshot';
  snapshot_table: 'metric_snapshots' | 'financial_snapshots';
  record_id?: string; // For metric_snapshots: which campaign/ad record
  record_ids?: string[]; // Multi-record comparison mode
  metric_field_id?: string; // For metric_snapshots: which metric
  report_type?: string; // For financial_snapshots: profit_loss | balance_sheet | etc.
  date_range: {
    type: 'relative' | 'absolute';
    relative_periods?: number;
    granularity: 'day' | 'week' | 'month';
    start?: string;
    end?: string;
  };
  aggregation?: 'sum' | 'avg' | 'last'; // How to aggregate within each period bucket (default: 'sum' for metrics, 'last' for snapshots)
}
```

This mode ships in Post-MVP — Verticals & Advanced alongside ad platform connectors and accounting integration.

---

## The `summary` Table View Type (Post-MVP)

### The Gap

The current `views.view_type` enum supports: `record | table | kanban | list | timeline | gantt | calendar | smart_doc`. All of these display **individual records** in different layouts. None display **aggregate data visualizations**.

The Financial Command Center spec describes tabs with "four summary cards" and "trend charts" but has no view type to render them. The workspace-level Table View example in `tables-and-views.md` lists four Table View tabs — but what's actually needed is a dashboard layout with charts.

### The Solution: `summary` View Type

Add `summary` to the `views.view_type` enum. A summary tab contains an **arrangement of chart blocks** in a grid layout rather than a list of records.

```
views.view_type: record | table | kanban | list | timeline | gantt | calendar | smart_doc | summary
```

A summary tab's `view_config` JSONB stores a layout definition and an array of chart block configurations:

```typescript
interface SummaryViewConfig {
  layout: SummaryLayout;
  blocks: SummaryBlock[];
}

interface SummaryLayout {
  columns: number; // Grid columns: 1, 2, 3, or 4 (default: 2)
  gap_px: number; // Gap between blocks (default: 16)
}

interface SummaryBlock {
  id: string; // Unique within this tab (UUID)
  position: {
    column: number; // 0-indexed column position
    row: number; // 0-indexed row position
    column_span?: number; // How many columns to span (default: 1)
    row_span?: number; // How many rows to span (default: 1)
  };
  block_type: 'chart' | 'divider' | 'heading';
  chart_config?: ChartTypeConfig; // Union of all chart type configs (NumberCardConfig | BarChartConfig | ...)
  data_binding?: DataBinding; // Union: TableAggregateBinding | DuckDBAnalyticalBinding | MetricSnapshotBinding
  heading_text?: string; // When block_type = 'heading'
  min_height_px?: number; // Minimum block height (default: varies by chart type)
}
```

### Layout Behavior

The summary tab layout uses CSS Grid. The Manager configures the grid column count and places chart blocks into positions. Blocks auto-flow into the next available position if placement is not explicit.

**Default layouts by chart type** (when the Manager adds a chart block without specifying position):

| Chart Type           | Default Span      | Default Min Height |
| -------------------- | ----------------- | ------------------ |
| `number_card`        | 1 column, 1 row   | 120px              |
| `bar`, `stacked_bar` | 2 columns, 2 rows | 300px              |
| `line`, `area`       | 2 columns, 2 rows | 300px              |
| `donut`              | 1 column, 2 rows  | 280px              |
| `progress`           | 1 column, 1 row   | 100px              |
| `sparkline`          | 1 column, 1 row   | 80px               |

**Responsive behavior:**

- **Desktop (≥1024px):** Full grid layout as configured.
- **Tablet (768–1023px):** Collapse to max 2 columns. Blocks that spanned 3–4 columns become 2.
- **Mobile (<768px):** Single column stack. All blocks become full-width. Charts maintain minimum height. Number cards stack in a 2×N grid (two per row) for density.

### Summary Tab in the Financial Command Center

The Financial Command Center (`accounting-integration.md` Section 7) maps directly to summary tabs:

```
Table View set: "Financial Command Center" (scope: workspace)
├── Tab 1: "This Month" — summary view type
│   ├── Row 1: 4× number_card (Revenue, Expenses, Net Income, Cash Position)
│   ├── Row 2: bar (Revenue by Client) + stacked_bar (Expense Breakdown)
│   └── Row 3: line (Cash Flow Calendar — timeline alternative)
│
├── Tab 2: "Profitability" — table view type (with color-coded rows)
│   └── Standard table view: Client profitability table with formulas
│
├── Tab 3: "Forecast" — summary view type
│   ├── Row 1: area (Cash Flow Projection 30/60/90 days)
│   ├── Row 2: stacked_bar (Revenue Pipeline: committed/probable/possible)
│   └── Row 3: table view inline (Upcoming Receivables — still a table, embedded in summary layout)
│
└── Tab 4: "Trends" — summary view type
    ├── Row 1: line (Revenue Trend 12 months) spanning full width
    ├── Row 2: line (Expense Trend) + line (Profit Trend)
    └── Row 3: 4× number_card (YoY Revenue Δ, YoY Expense Δ, Avg Collection Days, Team Utilization)
```

### Summary Tab for PM Dashboards

```
Table View set: "Project Health" (scope: base)
├── Tab 1: "Overview" — summary view type
│   ├── Row 1: 3× number_card (Active Projects, Total Budget, Budget Remaining)
│   ├── Row 2: donut (Tasks by Status) + bar (Hours by Team Member)
│   └── Row 3: progress × N (per-project budget burn — one progress block per active project)
│
├── Tab 2: "Tasks" — kanban view type (by status)
├── Tab 3: "Timeline" — gantt view type
└── Tab 4: "Workload" — summary view type
    ├── Row 1: bar (Utilization by Person — horizontal, colored by threshold)
    └── Row 2: stacked_bar (Allocation by Project per Person)
```

---

## Chart Rendering in Apps _(Post-MVP — App Designer Required)_

App chart blocks (`app-designer.md` > Block Library > Data category: "Chart" and "Metric/KPI Card") are rendered using the same chart component library. The App context adds theming and scoping.

> **⚠️ MVP Quick Portals** (externally-shared Record View of a single record) **do NOT support chart blocks.** Chart blocks require the App Designer (post-MVP). This entire section describes post-MVP App-type portals.

### App Chart Block Configuration _(Post-MVP)_

In the App Designer, when a Manager adds a Chart block, the property panel Content Tab shows:

1. **Chart type picker:** Visual grid of the 8 chart types with preview thumbnails.
2. **Data binding:** Table picker → field pickers for value/category/time (same as Table View charts). Filters include the App's `record_scope` (client identity filter) automatically.
3. **Chart options:** Type-specific configuration (axis labels, legend position, annotation lines, etc.).

### App Metric/KPI Card Block _(Post-MVP)_

The "Metric/KPI Card" block in the App block library is specifically the `number_card` chart type. Same component, App-themed. The App Designer offers this as a separate block type for discoverability — "I want to show a big number" is a different mental model than "I want a chart."

### App Theming Integration

Chart components accept a `theme` prop that overrides default colors:

```typescript
interface ChartTheme {
  palette: string[]; // Category colors (bars, donut segments, line series)
  background: string; // Chart area background
  text_primary: string; // Axis labels, value labels
  text_secondary: string; // Axis ticks, legends
  grid_color: string; // Grid lines
  positive_color: string; // Green equivalent for positive deltas
  negative_color: string; // Red equivalent for negative deltas
  font_family: string; // Inherits from App theme
}
```

In workspace Table Views, the theme resolves from the design system (`design-system.md`). In Apps _(post-MVP)_, the theme resolves from the App's `theme` configuration. The chart component is agnostic — it renders whatever theme it receives.

### App Chart Block Data Scoping _(Post-MVP)_

App charts apply three filter layers (same as all App data blocks, per `app-designer.md` > Record Scope Architecture):

1. **Chart-level filters:** Static filters configured on the chart block (e.g., "Status = Active").
2. **Record scope:** Automatic identity-based filter — the App client sees only aggregate data from their own records.
3. **Block visibility rules:** Conditional logic from the App Logic tab.

**Critical:** An App chart's aggregate values must only include records within the client's scope. The aggregate query's WHERE clause includes the record_scope filter before aggregation — not after. A client viewing a "Revenue by Month" chart sees only their own revenue, not the total across all clients.

---

## Chart Rendering in Smart Docs

Smart Docs can embed live chart blocks using a merge field syntax. When a Smart Doc template includes a chart block, the chart renders with live data when the document is viewed and as a static image when exported to PDF.

```
{#chart:revenue_by_month}
  chart_type: line
  source_table: Invoices
  value_field: Total
  aggregation: sum
  time_field: Issue Date
  granularity: month
  range: last 6 months
{/chart:revenue_by_month}
```

Smart Doc chart embed details are specified in `smart-docs.md` when that document is expanded. This document defines the rendering component; Smart Docs defines the merge field syntax and PDF static rendering.

---

## Chart Component Library — Implementation

### Library Choice: Recharts

**Decision: Use Recharts as the charting library.**

Rationale:

- **React-native:** Declarative component API that fits EveryStack's React/Next.js stack. No imperative D3 wrangling.
- **Composable:** Each chart is assembled from primitives (XAxis, YAxis, Bar, Line, Tooltip, Legend, etc.). EveryStack chart type configs map cleanly to Recharts component props.
- **Responsive:** Built-in `ResponsiveContainer` that handles resize. Works with EveryStack's responsive breakpoints.
- **Lightweight:** ~45KB gzipped. Smaller than Nivo (~80KB) or full D3 setups.
- **Themeable:** Accepts color props — integrates with design system tokens.
- **Already available in artifacts:** Recharts is in EveryStack's dependency tree for the React artifact renderer.
- **SSR-compatible:** Works with Next.js server rendering for App pages.

Alternatives considered:

- **Tremor:** Beautiful pre-styled components, but adds an opinionated design layer that may conflict with App theming. Better suited when you want Tremor's look; we need full theme control.
- **Chart.js:** Canvas-based. Not React-native (react-chartjs-2 wrapper is thin). Harder to theme dynamically. Better for very large datasets due to canvas performance.
- **Nivo:** D3-based, richer animation, heavier. Good for one-off visualizations; overkill for a component system.
- **Raw D3:** Maximum flexibility, maximum effort. Not justified when Recharts covers all 8 chart types.

### Component Architecture

```
src/components/charts/
├── ChartRenderer.tsx              ← Universal entry point: takes ChartTypeConfig + data → renders correct chart
├── types.ts                       ← All TypeScript interfaces from this document
├── data-binding/
│   ├── useTableAggregate.ts       ← React hook: executes Mode A aggregate query, returns chart data
│   ├── useDuckDBAnalytical.ts     ← React hook: calls DuckDB Context Layer, maps ContextResult to chart data
│   ├── useMetricSnapshot.ts       ← React hook: queries metric_snapshots / financial_snapshots
│   └── types.ts                   ← ChartDataResult: { categories: string[], series: { label, data }[], loading, error }
├── renderers/
│   ├── NumberCard.tsx             ← number_card renderer (custom, not Recharts — simpler as styled div)
│   ├── BarChart.tsx               ← bar + stacked_bar renderer (Recharts BarChart)
│   ├── LineChart.tsx              ← line renderer (Recharts LineChart)
│   ├── AreaChart.tsx              ← area renderer (Recharts AreaChart)
│   ├── DonutChart.tsx             ← donut renderer (Recharts PieChart with innerRadius)
│   ├── ProgressChart.tsx          ← progress renderer (custom — styled div with fill bar or SVG arc)
│   └── SparklineChart.tsx         ← sparkline renderer (Recharts LineChart, minimal — no axes/legend)
├── shared/
│   ├── ChartTooltip.tsx           ← Unified tooltip component across all chart types
│   ├── ChartLegend.tsx            ← Unified legend component
│   ├── ChartEmptyState.tsx        ← "No data" / "No records match filters" state
│   ├── ChartLoadingState.tsx      ← Skeleton shimmer matching chart dimensions
│   ├── ChartErrorState.tsx        ← Error display with retry button
│   ├── useChartTheme.ts           ← Hook: resolves theme from design system or App theme
│   └── palette.ts                 ← Default color palette (8 colors for series/categories)
└── config-ui/
    ├── ChartTypePickerPanel.tsx   ← Visual grid to choose chart type
    ├── ChartConfigPanel.tsx       ← Property panel for chart configuration (field pickers, aggregation, etc.)
    └── ChartPreview.tsx           ← Live preview in configuration mode
```

### `ChartRenderer` — Universal Entry Point

```typescript
interface ChartRendererProps {
  config: ChartTypeConfig; // Union of all chart type configs
  binding: DataBinding; // Union of all data binding modes
  theme?: ChartTheme; // Override (Apps, post-MVP). Defaults to design system theme.
  height?: number; // Explicit height override
  width?: number; // Explicit width override (usually auto from container)
  interactive?: boolean; // Enable tooltips, click handlers (default: true)
  onCategoryClick?: (category: string) => void; // Drill-down handler (click bar → filter table to that category)
  className?: string;
}
```

`ChartRenderer` is the only component imported by consumers (Table View summary tabs, App blocks _(post-MVP)_, Smart Docs). It internally delegates to the correct renderer based on `config.chart_type`.

### Color Palette

Default 8-color palette for chart series and categories. Derived from the first 8 saturated tones of the design system's 13-color data palette:

| Index | Name   | Hex       | Usage                           |
| ----- | ------ | --------- | ------------------------------- |
| 0     | Red    | `#DC2626` | First series / primary category |
| 1     | Orange | `#EA580C` | Second series                   |
| 2     | Amber  | `#D97706` | Third series                    |
| 3     | Yellow | `#CA8A04` | Fourth series                   |
| 4     | Lime   | `#65A30D` | Fifth series                    |
| 5     | Green  | `#16A34A` | Sixth series                    |
| 6     | Teal   | `#0D9488` | Seventh series                  |
| 7     | Blue   | `#2563EB` | Eighth series                   |

Categories beyond 8 cycle through the palette with reduced opacity (80%, then 60%). The "Other" catch-all category always renders in `textSecondary` gray.

Semantic colors (not from palette):

- **Positive delta:** `#16A34A` (Green)
- **Negative delta:** `#DC2626` (Red)
- **Neutral delta:** `textSecondary`

These match the design system's existing status colors used in conditional row coloring and validation error states.

### Interaction Behaviors

| Interaction           | Behavior                                                                                                                                                                                                | All Chart Types?             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Hover tooltip**     | Shows value(s) for the hovered point/bar/segment. Formatted per field type (currency with symbol, percent with %, etc.).                                                                                | All except sparkline         |
| **Click category**    | Fires `onCategoryClick` callback. In Table Views, this applies a filter to other tabs showing that category's records (master-detail pattern). In Apps _(post-MVP)_, navigates to a filtered list page. | bar, stacked_bar, donut      |
| **Click time point**  | Fires callback with date range for that period. In Table Views, filters other tabs to records in that time window.                                                                                      | line, area                   |
| **Legend toggle**     | Click legend item to show/hide that series. State is local (not persisted).                                                                                                                             | bar, stacked_bar, line, area |
| **Responsive resize** | Charts re-render on container resize. Recharts `ResponsiveContainer` handles this.                                                                                                                      | All                          |
| **Number card tap**   | On mobile, tap expands to show sparkline and comparison detail.                                                                                                                                         | number_card                  |

### Loading, Empty, and Error States

**Loading:** Skeleton shimmer matching the chart's approximate shape. Number cards show a pulsing rectangle. Bar/line charts show gray placeholder bars/lines. Same animation style as grid skeleton rows (`tables-and-views.md` > Loading & Empty States).

**Empty (no records match filters):** Illustration + "No data" + contextual message. If the chart has filters, show "No records match the current filters." If the table is empty, show "No records yet." Consistent with grid empty state.

**Error (query failure):** Error message + "Retry" button. Shows the error stage (filter error, query timeout, permission denied). For Mode B (DuckDB), includes the DuckDB error message so the admin can debug the QueryPlan.

---

## Data Model Additions

### `views` — View Type Expansion

```sql
-- Expand view_type enum
ALTER TYPE view_type_enum ADD VALUE 'summary';
```

No new table needed. The `summary` view type stores its layout and chart blocks in the existing `view_config` JSONB column on `views`. The `SummaryViewConfig` shape (defined above) is the schema for `view_config` when `view_type = 'summary'`.

### App `app_blocks` — Chart Block Types _(Post-MVP)_

App chart blocks use the `app_blocks` table (per glossary Database Entity Quick Reference: `App Block (post-MVP) | app_blocks | id, page_id, block_type, config (JSONB)`). The block_type values for charts:

```
app_blocks.block_type: ... | 'chart' | 'metric_card'
```

The `config` JSONB column on `app_blocks` stores the chart type configuration and data binding. Shape:

```typescript
interface ChartBlockConfig {
  chart_config: ChartTypeConfig; // Which chart type and its options
  data_binding: DataBinding; // How data is fetched
  // App-specific overrides (post-MVP):
  show_title?: boolean; // Show chart title above the chart (default: true)
  title_text?: string; // Override auto-generated title
  card_style?: boolean; // Wrap in a Card Container automatically (default: true)
}
```

### Aggregate Query Cache

```sql
CREATE TABLE chart_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cache_key VARCHAR(512) NOT NULL,               -- chart:{block_id}:{user_id}:{filter_hash}
  result JSONB NOT NULL,                         -- ChartDataResult
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,               -- created_at + 30 seconds
  UNIQUE (tenant_id, cache_key)
);

-- Index for lookup and TTL cleanup
CREATE INDEX idx_chart_cache_lookup ON chart_cache (tenant_id, cache_key) WHERE expires_at > NOW();
CREATE INDEX idx_chart_cache_ttl ON chart_cache (expires_at);
```

**Cache invalidation:** Two mechanisms:

1. **TTL-based:** 30-second expiry. A nightly cleanup job deletes expired rows.
2. **Event-driven:** When a record mutation event fires on a table, all chart_cache entries referencing that table are invalidated. The existing real-time WebSocket pub/sub channel (`realtime.md`) carries these events.

**Alternative consideration:** Redis cache instead of Postgres table. Redis is simpler for TTL management and already runs in the stack. If Redis is available at chart query time (it should be — it's used for session and presence), use Redis with `SET chart:{key} {result} EX 30` instead of the Postgres table. The Postgres table is the fallback if Redis is not preferred for this use case.

**Decision: Use Redis.** The chart cache is ephemeral, short-lived, and benefits from Redis's native TTL. No Postgres table needed. Cache key pattern: `chart:{tenant_id}:{block_id}:{user_id}:{filter_hash}`. Value: JSON-serialized `ChartDataResult`. TTL: 30 seconds. Invalidation: on record mutation, delete keys matching `chart:{tenant_id}:*` for the affected table (use Redis SCAN or maintain a reverse index set `chart_tables:{tenant_id}:{table_id}` → set of cache keys).

---

## Aggregate Query Engine

The chart data binding layer needs a query execution module that generates and runs aggregate SQL against Postgres. This is distinct from the DuckDB Context Layer (which handles cross-base analytical queries) — this module handles single-table aggregations for Mode A.

### Query Builder

```typescript
interface AggregateQuery {
  table_id: string;
  tenant_id: string;
  user_id: string; // For permission filtering
  value_fields: Array<{
    field_id: string;
    aggregation: AggregationFunction;
    alias: string;
  }>;
  group_by?: {
    field_id: string;
    field_type: string; // Needed for option ID→label resolution
    alias: string;
    max_groups?: number; // Top N + "Other"
  };
  time_bucket?: {
    field_id: string;
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
    alias: string;
  };
  filters?: FilterRule[]; // View-level filters + chart-level filters + permission filters
  comparison?: {
    period_offset: number; // -1 = prior period
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
}
```

**Query generation strategy:**

1. Build the base WHERE clause: `table_id`, `tenant_id`, `deleted_at IS NULL`, permission filters, chart filters.
2. Add GROUP BY if `group_by` or `time_bucket` is specified.
3. For `time_bucket`, use Postgres `date_trunc()`: `date_trunc('month', (canonical_data->>'fld_date')::timestamp)`.
4. For aggregations, use Postgres aggregate functions against extracted JSONB values: `SUM((canonical_data->>'fld_value')::numeric)`.
5. Apply `LIMIT` for max_categories / max_groups.
6. For comparison (prior period), run two queries: current period and comparison period. The chart renderer computes the delta.

**All queries are parameterized.** Filter values are never interpolated. The same SQL safety discipline applies here as in the DuckDB Context Layer and sync engine queries.

### Result Shape

```typescript
interface ChartDataResult {
  // For category charts (bar, donut):
  categories?: Array<{
    label: string; // Resolved: option label, user name, display field value
    raw_value: string; // Original value (option ID, user ID, etc.) for drill-down
    values: Record<string, number>; // { series_alias: aggregate_value }
  }>;

  // For time-series charts (line, area):
  time_points?: Array<{
    period: string; // ISO date string (start of period)
    label: string; // Formatted: "Jan 2026", "Week 7", "Q1 2026"
    values: Record<string, number>;
  }>;

  // For single-value charts (number_card, progress):
  current_value?: number;
  comparison_value?: number; // From comparison query
  delta?: number; // current - comparison
  delta_percent?: number; // (current - comparison) / comparison × 100

  // Metadata
  total_records: number; // Records included in aggregation
  truncated: boolean; // True if max_categories/groups was applied
  truncated_label?: string; // "and 15 more" or "+$45,200 in Other"
  query_time_ms: number;
}
```

---

## Kanban View Pipeline Rollup Integration

Kanban view pipeline rollups (`tables-and-views.md` > Kanban View > Pipeline Value Rollups) are already specced as:

> **Per-column summary:** Below each column header: record count + sum of a configurable value field.
> **Summary bar at top:** Total records, total value, weighted total across all columns.

These are `number_card` chart instances embedded in Kanban view chrome — not standalone chart blocks, but using the same rendering component. Specifically:

- **Per-column summary:** Rendered as a compact `number_card` (no sparkline, no comparison) below each kanban column header.
- **Summary bar:** A row of compact `number_card` components in the Kanban view toolbar area.
- **Weighted pipeline:** The Kanban view's probability weighting is a domain-specific calculation that feeds into the `number_card`'s display value. The Kanban view computes the weighted value; the `number_card` just renders it.

`NumberCard.tsx` ships in Post-MVP — Portals & Apps alongside Kanban view (Kanban is post-MVP per GLOSSARY.md:678). `ProgressChart.tsx` ships in MVP — Core UX for progress field cell rendering (no Kanban dependency).

---

## Permissions

### Chart Configuration Permissions

| Action                                        | Required Role                    | Notes                                          |
| --------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| Create summary tab in Table View              | Manager+                         | Same as creating any Table View tab            |
| Configure chart blocks in summary tab         | Manager+                         | Same as configuring Table View tab view_config |
| Add Chart block in App Designer               | Manager+ (App owner)             | Same as adding any App block _(post-MVP)_      |
| View chart data                               | Viewer+ (with table read access) | Charts respect all existing permission layers  |
| Interact with chart (tooltips, legend toggle) | Viewer+                          | Read-only interaction, no data mutation        |
| Click-to-drill-down (filter other tabs)       | Team Member+                     | Requires ability to apply filters              |

### Data Access Permissions in Charts

Charts inherit the same permission model as the view they're in:

- **Table View summary tab:** View `base_filters` + `$me` token + tab `filters` + field-level visibility. If the chart references a field the user can't see, that value series is omitted (not an error — silently excluded, same as hidden columns in grid view).
- **App chart block _(post-MVP)_:** App record_scope + block filters + block visibility rules.
- **Chart referencing cross-table data (Mode B):** DuckDB Context Layer permission enforcement applies — see `duckdb-context-layer-ref.md` > Security Considerations > Permission Enforcement.

---

## Phase Integration

| Phase                                               | Chart Deliverables                                                                                                                                                                                                                                                                                                               | Depends On                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **MVP — Core UX**                                   | `ProgressChart.tsx` component (used for percent/progress field cells — already specced in `tables-and-views.md`). Chart color palette definition. `ChartRenderer.tsx` shell (renders progress only).                                                                                                                             | Design system                                                                         |
| **Post-MVP — Portals & Apps (Kanban + Charts)**     | `NumberCard.tsx` component (Kanban view pipeline rollup display). Full chart component library (all 8 types). App Chart block and Metric/KPI Card block. App chart theming. Mode A data binding (table aggregate). `useTableAggregate` hook. Redis chart cache. Aggregate query builder. Chart configuration UI in App Designer. | Kanban view, App Designer, App data binding                                           |
| **Post-MVP — Portals & Apps → Table View backfill** | `summary` Table View type. Summary tab layout system. Chart blocks in Table View summary tabs. Mode A data binding for Table Views. Master-detail drill-down (chart click → filter other tabs).                                                                                                                                  | Table View architecture (MVP — Core UX), chart components (Post-MVP — Portals & Apps) |
| **Post-MVP — Comms & Polish (Comms)**               | Smart Doc chart embeds (merge field syntax + PDF static rendering).                                                                                                                                                                                                                                                              | Smart Docs (Post-MVP — Documents), chart components (Post-MVP — Portals & Apps)       |
| **Post-MVP — Verticals & Advanced (Post-MVP)**      | Mode B (DuckDB analytical binding). Mode C (metric snapshot binding). Financial Command Center summary tabs. PM dashboard summary tabs. Ad platform metric charts. `financial_summary` and `metric_snapshots` chart integration.                                                                                                 | DuckDB Context Layer, accounting integration, ad platform connectors                  |

### MVP — Core UX Scope (Minimal — ProgressChart Only)

Only one component ships in MVP — Core UX:

1. **`ProgressChart.tsx`** — renders a progress bar. Used for progress field cell rendering (already specced in `tables-and-views.md` > Cell Type Rendering > Percent/Progress).

`NumberCard.tsx` ships in Post-MVP — Portals & Apps alongside Kanban view (its primary consumer). The component is standalone (no Kanban code dependency), but without Kanban there's no place to render it in MVP.

### Post-MVP — Portals & Apps Scope (Full Chart System)

This is the main chart delivery phase. Everything needed for App Chart blocks _(post-MVP)_ and the `summary` Table View type ships here:

- All 8 chart type renderers
- `ChartRenderer.tsx` universal entry point
- Mode A data binding (`useTableAggregate` hook + aggregate query builder)
- Redis chart cache
- Chart configuration UI (type picker, field pickers, aggregation selector)
- App Chart block and Metric/KPI Card block integration _(post-MVP)_
- `summary` view type for Table View tabs
- Summary tab layout system
- Chart theming (design system + App themes _(post-MVP)_)
- Loading, empty, and error states
- Interaction behaviors (tooltip, legend toggle, click-to-drill)

---

## Claude Code Prompt Roadmap

> **⚠️ BUILD SEQUENCE NOTE:** The prompts below are a suggested decomposition of this feature into buildable units. They are **not a build plan**. The active phase build doc controls what to build and in what order. When creating a phase build doc, cherry-pick from these prompts and reorder as needed for the sprint's scope.

### Prompt 1: Chart Type Definitions and Shared Types

```
Define the TypeScript types for the EveryStack chart block system.

File: `src/components/charts/types.ts`

Create interfaces for:
- All 8 chart type configs: NumberCardConfig, BarChartConfig, StackedBarChartConfig, LineChartConfig, AreaChartConfig, DonutChartConfig, ProgressChartConfig, SparklineConfig
- ChartTypeConfig (discriminated union of all 8)
- Shared types: ValueSeries, AggregationFunction, CategoryAxis, TimeAxis, ChartAnnotation
- Data binding: TableAggregateBinding, DuckDBAnalyticalBinding, MetricSnapshotBinding, DataBinding (union)
- ChartTheme interface
- ChartDataResult (the shape returned by data binding hooks)
- ChartRendererProps
- SummaryViewConfig, SummaryLayout, SummaryBlock (for the summary Table View type *(post-MVP)*)

Also create:
- AGGREGATION_FUNCTIONS constant array
- FIELD_AGGREGATION_COMPATIBILITY map (field type → allowed aggregation functions, from the compatibility matrix in this doc)
- DEFAULT_CHART_PALETTE (8 colors from the data palette)
- DEFAULT_BLOCK_SIZES map (chart type → default column span, row span, min height)

Types only, no implementation. Add JSDoc comments explaining each chart type's purpose and primary use cases.
```

### Prompt 2: NumberCard Component

```
Implement the ProgressChart component — the only chart type shipping in MVP — Core UX (for progress field cell rendering). NumberCard ships post-MVP alongside Kanban view.

Reference docs to read first:
- `chart-blocks.md` — this document, NumberCardConfig spec
- `design-system.md` — design system colors, typography

File: `src/components/charts/renderers/NumberCard.tsx`

A React component that renders a single aggregate value prominently with:
1. Label text (top, textSecondary color, 12px)
2. Primary value (large, 28px bold, formatted per config: number, currency, percent, duration)
3. Delta indicator (optional): green ▲ or red ▼ with percentage and comparison label
4. Sparkline (optional): compact trend line at bottom using a minimal SVG line (no Recharts dependency — keep MVP — Core UX lightweight)

Props:
- value: number
- label: string
- format: 'number' | 'currency' | 'percent' | 'duration'
- currency_code?: string
- precision?: number
- abbreviate?: boolean (default: true for values > 9,999)
- comparison_value?: number (triggers delta display)
- comparison_label?: string ("vs last month")
- positive_is_good?: boolean (default: true — determines green/red direction)
- trend_data?: number[] (triggers sparkline display)
- theme?: ChartTheme (defaults to design system)
- className?: string

Use Tailwind classes. Apply the design system's CSS custom properties for theming.

Value formatting helper: create `src/components/charts/shared/formatValue.ts` with a function that formats numbers per the config (currency symbols, thousands separators, abbreviation like "$142.5K", percentage formatting, duration as "2h 30m").

Add unit tests for:
- All format types
- Abbreviation logic (1000 → "1K", 1500000 → "1.5M", 999 → "999")
- Delta calculation and direction
- Theme token application

Also create `src/components/charts/shared/ChartEmptyState.tsx` and `src/components/charts/shared/ChartLoadingState.tsx` — simple placeholder components used across all chart types.
```

### Prompt 3: ProgressChart Component

```
Implement the ProgressChart component — the second MVP — Core UX chart type.

Reference docs to read first:
- `chart-blocks.md` — ProgressChartConfig spec
- `design-system.md` — colors, spacing

File: `src/components/charts/renderers/ProgressChart.tsx`

Three display styles in one component:
1. 'bar' — horizontal fill bar with label and value. Height: 24px bar + 16px label area.
2. 'radial' — SVG arc/ring showing progress as a partial circle. Diameter: matches container width, max 200px.
3. 'number' — large number with a thin arc above it (like a gauge).

Props:
- current: number
- target: number
- label: string
- format: 'percent' | 'currency' | 'number' | 'duration'
- display_style: 'bar' | 'radial' | 'number'
- thresholds?: { healthy: number; warning: number; danger: number }
- invert_color?: boolean (true = lower is better)
- currency_code?: string
- theme?: ChartTheme
- className?: string

Color logic:
- Below healthy threshold: `textPrimary` (or negative color if invert_color)
- Between healthy and warning: amberPrimary
- Between warning and danger: red
- Above danger: deep red

All three styles use pure SVG + Tailwind (no Recharts). Keep the component self-contained.

Add unit tests for threshold color logic, all three display styles, format combinations, and invert_color behavior.
```

### Prompt 4: ChartRenderer Shell and Kanban View Integration

```
Create the ChartRenderer entry point and integrate NumberCard into Kanban view pipeline rollups.

Reference docs to read first:
- `chart-blocks.md` — ChartRendererProps, Kanban view integration section
- `tables-and-views.md` — Kanban View > Pipeline Value Rollups

File: `src/components/charts/ChartRenderer.tsx`

A React component that:
1. Takes ChartRendererProps (config + data binding + theme)
2. Switches on config.chart_type
3. For MVP — Core UX: renders ProgressChart only. NumberCard added post-MVP. Other types render a placeholder: "Chart type coming soon" with the chart type icon.
4. Wraps in error boundary — chart rendering errors never crash the page

File: `src/components/charts/index.ts`
Export ChartRenderer, NumberCard, ProgressChart, and all types.

Kanban view integration:
Modify the Kanban view component to use NumberCard for pipeline rollups:
- Per-column summary: compact NumberCard below each kanban column header
  - value = count of records in column + sum of configured value field
  - format = currency (from value field config)
  - label = column name
  - No comparison, no sparkline — keep compact
- Summary bar: row of NumberCards in Kanban toolbar
  - Total records, total value, weighted total
  - Comparison: prior period delta if data available

The Kanban view computes aggregate values locally from its loaded records and passes them as props — no server-side aggregate query needed in Post-MVP — Portals & Apps.
```

### Prompt 5: Recharts Chart Renderers

```
Implement the remaining 5 chart type renderers using Recharts.

Reference docs to read first:
- `chart-blocks.md` — all chart type configs and interaction behaviors
- `design-system.md` — color palette

Install recharts if not already in dependencies.

Files to create:
- `src/components/charts/renderers/BarChart.tsx` — handles both 'bar' and 'stacked_bar' chart types (stacking is a prop, not a separate component). Recharts BarChart with XAxis, YAxis, Bars, Tooltip, Legend.
- `src/components/charts/renderers/LineChart.tsx` — Recharts LineChart. Support multiple series, interpolation modes, data point dots, annotations (ReferenceLine).
- `src/components/charts/renderers/AreaChart.tsx` — Recharts AreaChart. Same as line but with gradient fill. Support stack modes.
- `src/components/charts/renderers/DonutChart.tsx` — Recharts PieChart with innerRadius (donut hole). Center label component. Segment click handler.
- `src/components/charts/renderers/SparklineChart.tsx` — Recharts LineChart in minimal mode: no XAxis, no YAxis, no grid, no tooltip. Just the line + optional endpoint dots.

Shared components to create:
- `src/components/charts/shared/ChartTooltip.tsx` — custom Recharts tooltip component. Formatted values (currency, percent, etc.). Consistent styling across chart types.
- `src/components/charts/shared/ChartLegend.tsx` — custom Recharts legend. Click to toggle series visibility. Horizontal layout, wraps on overflow.
- `src/components/charts/shared/palette.ts` — DEFAULT_CHART_PALETTE with the 8-color data palette.

All renderers must:
1. Accept ChartDataResult as data prop (not raw records — data binding hooks handle that)
2. Accept ChartTheme for color overrides
3. Wrap in ResponsiveContainer for auto-sizing
4. Apply design system theme tokens
5. Handle empty data gracefully (show ChartEmptyState)
6. Fire onCategoryClick / onTimePointClick callbacks for drill-down

Update ChartRenderer.tsx to route all 8 chart types to the correct renderer.

Add visual regression tests if possible, otherwise unit tests for data transformation and prop mapping.
```

### Prompt 6: Aggregate Query Builder

```
Implement the server-side aggregate query builder for Mode A (table aggregate) data binding.

Reference docs to read first:
- `chart-blocks.md` — Aggregate Query Engine section, AggregateQuery interface
- `data-model.md` — canonical_data JSONB structure, field types
- `tables-and-views.md` — filtering grammar (same filter rules as grid filters)

File: `src/services/chart-aggregate/query-builder.ts`

Export a function `buildAggregateQuery(query: AggregateQuery): { sql: string; params: any[] }` that:

1. Builds a parameterized SELECT with aggregate functions on JSONB-extracted field values
2. Applies GROUP BY for category_field or date_trunc for time_bucket
3. Applies WHERE clause: table_id, tenant_id, deleted_at IS NULL, user permission filters, chart-level filters
4. Applies ORDER BY based on group_by.sort config
5. Applies LIMIT for max_groups / max_categories
6. All values are parameterized — never interpolate.
7. Handles "Other" aggregation: when max_groups is applied, a second query (or CTE) computes the aggregate for remaining records not in the top N, labeled as "Other"

Type-aware JSONB extraction:
- Numbers: `(canonical_data->>$1)::numeric` — cast to numeric for SUM/AVG/MIN/MAX
- Dates: `(canonical_data->>$1)::timestamp` for date_trunc
- Selects: `canonical_data->>$1` as text for GROUP BY (returns option IDs — resolver handles label mapping)
- People: `canonical_data->>$1` as text (returns user IDs — resolver handles name mapping)

File: `src/services/chart-aggregate/label-resolver.ts`

Export a function `resolveLabels(results: RawAggregateRow[], groupByFieldId: string, fieldMeta: FieldDefinition): ResolvedRow[]` that:
1. For single_select/status/multi_select fields: maps option IDs to labels using fields.config.options[]
2. For people fields: maps user IDs to display names
3. For linked record fields: maps record IDs to display field values
4. Passes through text, date, and other types unchanged

File: `src/services/chart-aggregate/executor.ts`

Export a function `executeAggregateQuery(query: AggregateQuery, db: DatabaseConnection, sds: SchemaDescriptorService): Promise<ChartDataResult>` that:
1. Builds the SQL using query-builder
2. Executes against the Postgres connection pool
3. Resolves labels
4. Shapes the result into ChartDataResult format
5. Measures query_time_ms

Add comprehensive unit tests for query builder (every aggregation function, GROUP BY variants, time bucketing, parameterization safety) and integration tests for the full executor flow.
```

### Prompt 7: Data Binding Hooks

```
Implement the React data binding hooks that connect chart components to the aggregate query engine and Redis cache.

Reference docs to read first:
- `chart-blocks.md` — Data Binding modes, Redis caching strategy
- `realtime.md` — WebSocket pub/sub for cache invalidation

File: `src/components/charts/data-binding/useTableAggregate.ts`

A React hook that:
1. Accepts: TableAggregateBinding + ChartTypeConfig + user context (userId, tenantId)
2. Builds an AggregateQuery from the binding and chart config
3. Checks Redis cache first (key pattern: chart:{tenantId}:{blockId}:{userId}:{filterHash})
4. On cache miss: calls the aggregate query executor (server action or API route)
5. Caches result in Redis with 30-second TTL
6. Returns: { data: ChartDataResult | null, loading: boolean, error: Error | null, refetch: () => void }
7. Subscribes to WebSocket channel for the source table — on record mutation event, invalidates cache and refetches

File: `src/components/charts/data-binding/useChartData.ts`

A unified hook that switches on binding.mode and delegates to the correct hook:
- 'table_aggregate' → useTableAggregate
- 'duckdb_analytical' → placeholder (returns error: "DuckDB charts available in Post-MVP — Verticals & Advanced")
- 'metric_snapshot' → placeholder (returns error: "Metric history charts available in Post-MVP — Verticals & Advanced")

File: `src/actions/chart-aggregate.ts` (server action)

A server action that:
1. Accepts the AggregateQuery
2. Validates permissions (user has access to the referenced table and fields)
3. Calls executeAggregateQuery
4. Returns ChartDataResult

Add tests for cache hit/miss behavior, real-time invalidation, and error handling.
```

### Prompt 8: Summary View Type for Table Views

```
Implement the 'summary' Table View type *(post-MVP)* — a grid layout of chart blocks.

Reference docs to read first:
- `chart-blocks.md` — summary view type section, SummaryViewConfig, responsive behavior
- `tables-and-views.md` — Table View architecture, views table schema

Database migration:
- Add 'summary' to the view_type_enum enum (or handle as a new valid value if using VARCHAR)

File: `src/components/views/SummaryTab.tsx`

A React component that:
1. Reads SummaryViewConfig from the tab's view_config JSONB
2. Renders a CSS Grid layout with the configured column count and gap
3. For each SummaryBlock: renders ChartRenderer with the block's chart_config and data_binding
4. Supports block types: 'chart' (delegates to ChartRenderer), 'divider' (styled HR), 'heading' (styled H3)
5. Handles column_span and row_span for blocks that span multiple grid cells
6. Responsive: collapses to 2 columns on tablet, 1 column on mobile (number_cards stay 2-per-row on mobile)
7. Loading state: all chart blocks show skeleton simultaneously on initial load

File: `src/components/views/SummaryTabConfigPanel.tsx`

The Manager's configuration panel for a summary tab (shown in the Table View setup UI):
1. Grid column count picker (1, 2, 3, 4)
2. "Add Block" button → ChartTypePickerPanel (visual grid of 8 chart types)
3. For each block: inline chart configuration panel (field pickers, aggregation, options)
4. Drag-and-drop block reordering
5. Block resize handles (change column_span and row_span)
6. Delete block button

Wire into the existing Table View tab creation flow: when Manager adds a new tab, "Summary" appears as a view type option alongside Table, Kanban, Gantt, etc. Selecting "Summary" creates a tab with an empty SummaryViewConfig and opens the config panel.

Add tests for layout rendering, responsive behavior, and configuration persistence.
```

### Prompt 9: Chart Configuration UI

```
Implement the chart configuration UI — the property panel Managers use to set up chart blocks.

Reference docs to read first:
- `chart-blocks.md` — all chart type configs, field compatibility matrix

File: `src/components/charts/config-ui/ChartTypePickerPanel.tsx`

A visual grid showing all 8 chart types as cards with:
- Chart type icon
- Name ("Bar Chart", "Line Chart", etc.)
- One-line description
- Hover: animated preview

File: `src/components/charts/config-ui/ChartConfigPanel.tsx`

Context-sensitive configuration form that adapts to the selected chart type:

1. **Common section (all types):** Data source table picker. Filters builder (reuse existing filter UI component).

2. **Value section:** Field picker filtered to aggregation-compatible fields (using FIELD_AGGREGATION_COMPATIBILITY map). Aggregation function dropdown (count, sum, avg, min, max, median). For multi-series types: "Add Series" button (up to 4).

3. **Category section (bar, stacked_bar, donut):** Field picker filtered to groupable fields. Sort order dropdown. Max categories slider (2-20).

4. **Time section (line, area):** Date field picker. Granularity dropdown (day/week/month/quarter/year). Range: relative picker ("Last N periods") or absolute date range.

5. **Display section (type-specific):** Orientation toggle (bar). Stack mode toggle (stacked_bar, area). Interpolation picker (line, area). Center label picker (donut). Display style picker (progress). Show/hide toggles: values, legend, grid lines, annotations.

6. **Comparison section (number_card):** Comparison type: prior period / fixed value / field aggregate. Period offset picker. "Positive is good" toggle. Show trend sparkline toggle.

File: `src/components/charts/config-ui/ChartPreview.tsx`

Live preview that re-renders the chart as the Manager changes configuration. Uses sample data (5-8 fake data points) when no table is bound yet. Switches to real data once a table and fields are selected.

Use existing UI patterns: dropdown selects from shadcn/ui, field pickers from the existing field selector component, filter builder from the existing view filter UI.
```

### Prompt 10: App Chart Block Integration

```
Integrate the chart component system into the App Designer as Chart and Metric/KPI Card blocks (post-MVP — App Designer required).

Reference docs to read first:
- `chart-blocks.md` — App rendering section, theming, data scoping
- `app-designer.md` — block library, property panel, data binding modes, record scope

File: `src/components/apps/blocks/ChartBlock.tsx`

An App block component that:
1. Renders ChartRenderer with App theme applied
2. Wraps in Card Container by default (configurable)
3. Shows chart title above the chart (configurable)
4. Applies App record_scope filter to the data binding before aggregation
5. Handles the three App filter layers: chart-level → record scope → block visibility rules
6. Responsive rendering per App viewport breakpoints

File: `src/components/apps/blocks/MetricCardBlock.tsx`

A convenience wrapper that:
1. Renders NumberCard (number_card chart type) with App styling
2. Pre-configured for the common "show a big number" use case
3. Simpler property panel: just label, table, field, aggregation, comparison toggle

App Designer integration:
- Add "Chart" and "Metric/KPI Card" to the data block palette in the App Designer sidebar
- When dragged onto canvas, open the chart configuration panel (same ChartConfigPanel, wrapped in App property panel chrome)
- "Chart" opens with chart type picker first; "Metric/KPI Card" skips straight to NumberCard configuration

App theming:
- Create `src/components/charts/shared/useChartTheme.ts` hook that:
  1. In workspace context: resolves from design system CSS custom properties
  2. In App context: resolves from App theme JSONB (colors, typography)
  3. Returns a ChartTheme object

Data scoping:
- The App chart's useTableAggregate hook receives the App client's record_scope as an additional filter
- This filter is applied in the WHERE clause BEFORE aggregation — ensuring aggregate values only include the client's records
- The filter is non-removable by the App client (it's injected server-side, not client-side)

Add integration tests verifying that App record scoping correctly limits chart aggregation.
```

---

## Appendix: Existing Specs That Reference Charts (Reconciliation)

This section documents how existing specs map to the chart system defined here, ensuring no gaps remain.

### `app-designer.md` > Block Library

| Spec Reference                                     | Resolution                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Chart" data block                                 | → `ChartBlock.tsx` App block _(post-MVP)_, renders any of the 8 chart types                                                                         |
| "Metric/KPI Card" data block                       | → `MetricCardBlock.tsx` App block _(post-MVP)_, renders `number_card` chart type                                                                    |
| "Data-bound blocks (lists, charts): 60s" cache TTL | → Redis chart cache with 30s TTL (more aggressive than App spec — chart data changes more frequently than list layout). App list blocks retain 60s. |

### `agency-features.md` > App Chart Block Enhancements _(Post-MVP)_

| Spec Reference                                      | Resolution                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| "Line charts (metric over time)"                    | → `line` chart type with Mode C (metric_snapshot binding)                  |
| "Bar charts (comparisons)"                          | → `bar` chart type with Mode A (table_aggregate binding)                   |
| "KPI cards (with period deltas)"                    | → `number_card` chart type with comparison config                          |
| "Data tables"                                       | → Standard App Table/List block _(post-MVP)_ (not a chart type)            |
| "New data source: Metric History"                   | → Mode C `MetricSnapshotBinding` with `snapshot_table: 'metric_snapshots'` |
| "Comparison mode: two metrics on same chart"        | → `line` chart type with 2 value series                                    |
| "Multi-record mode: compare campaigns on one chart" | → Mode C with `record_ids[]` array                                         |

### `accounting-integration.md` > Financial Command Center

| Spec Reference                                                      | Resolution                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| "Four summary cards (Revenue, Expenses, Net Income, Cash Position)" | → 4× `number_card` in summary tab, Mode A against `financial_summary`                     |
| "Revenue Breakdown" (invoices by client)                            | → `bar` chart, Mode A against Invoices table with GROUP BY client                         |
| "Expense Breakdown" (P&L categories)                                | → `stacked_bar` chart, Mode B against `financial_snapshots`                               |
| "Cash Flow Calendar" (timeline of inflows/outflows)                 | → Table View tab with `view_type: 'timeline'` (not a chart — uses existing timeline view) |
| "Revenue trend chart: Monthly revenue over 6-12 months"             | → `line` chart, Mode A against `financial_summary`                                        |
| "Expense trend chart"                                               | → `line` chart, Mode A against `financial_summary`                                        |
| "Profit trend chart"                                                | → `line` chart, Mode A against `financial_summary`                                        |

### `project-management.md` > PM Dashboards

| Spec Reference                                           | Resolution                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Task completion pie"                                    | → `donut` chart type, Mode A against tasks table grouped by status                                    |
| "Burndown"                                               | → `area` chart type, Mode A with time_bucket against tasks (completed_at date field)                  |
| "Milestones"                                             | → Not a chart — rendered as timeline view tab or table view with milestone filter                     |
| "Overdue list"                                           | → Not a chart — rendered as table view tab with overdue filter                                        |
| "Budget vs actuals"                                      | → `bar` chart with 2 value series (budget field, actual spend rollup) or `progress` chart per project |
| "Workload view: per-person allocation chart vs capacity" | → `bar` (horizontal) with `progress`-style threshold coloring, Mode A grouped by assignee             |

### `tables-and-views.md` > Kanban View Pipeline Rollups

| Spec Reference                                                   | Resolution                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| "Per-column summary: record count + sum"                         | → Compact `number_card` below each column header               |
| "Weighted pipeline: sum × probability"                           | → Kanban view computes weighted value, passes to `number_card` |
| "Summary bar at top: total records, total value, weighted total" | → Row of `number_card` components in Kanban toolbar            |

### `ai-metering.md` > Admin AI Dashboard

| Spec Reference                             | Resolution                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Admin AI dashboard" (usage visualization) | → `summary` Table View type with `line` chart (AI usage over time), `bar` chart (usage by model), `number_card` (total credits used, remaining budget) |

---

## Appendix: Future Extensions (Do Not Build Yet)

1. **Chart-to-chart drill-down:** Click a bar segment in one chart → all other charts on the same summary tab filter to that category. Requires a shared filter context across blocks in a summary tab.

2. **Real-time streaming charts:** For live dashboards (e.g., call center volume), charts update via WebSocket push rather than polling/cache. Requires a streaming data source mode.

3. **AI-generated charts:** "Show me revenue by client" in the command bar → AI generates a chart configuration and renders it inline. Uses the SDS to identify appropriate fields and the chart type system to configure the visualization.

4. **Chart export:** Export individual charts as PNG/SVG for inclusion in emails or external presentations. Recharts supports `toDataURL()` for this.

5. **Calculated chart fields:** Computed value series that don't map to a single field — e.g., "margin = revenue - cost." Currently requires a formula field on the table. Future: in-chart computed series.

6. **Composite charts:** Mixed chart types on the same axes — e.g., bar chart for revenue with a line overlay for margin %. Recharts `ComposedChart` supports this. Add as a ninth chart type when needed.

7. **Pivot table view type:** For users who need spreadsheet-style cross-tabulation. This is a table-like view type, not a chart, but shares the aggregation query engine.
