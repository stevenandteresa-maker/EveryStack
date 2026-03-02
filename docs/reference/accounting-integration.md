# EveryStack — Accounting Integration

> **⚠️ Entire document is post-MVP (Post-MVP — Accounting Integration).** All features described here are post-MVP unless explicitly noted otherwise. See GLOSSARY.md § MVP Scope Summary.

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Changes: (1) "Interface View(s)" → "App" / "App page" (post-MVP App Designer output) per glossary naming discipline; (2) "Interface summary blocks" → "App blocks"; (3) "Smart Doc template" → "Document Template"; (4) "Finance base" → "Finance workspace"; (5) "Expand Record view" → "Record View"; (6) "portal page" / "portal dashboard" / "portal chart blocks" → clarified as post-MVP App portal features; (7) "reads across all bases" → "reads across all workspaces"; (8) "shared Interface" → "shared App"; (9) Updated cross-references to match renamed terms; (10) Confirmed dependency table uses correct glossary terms (Table Views, Document Templates).

> **Sub-document.** Accounting platform connectors (QuickBooks, Xero, 1C), invoice lifecycle, expense/bill management, financial command center dashboards, AI financial intelligence.
> Cross-references: `data-model.md` (invoice_table_config, financial_snapshots schema), `automations.md` (actions #31–37, accounting triggers, recipes), `sync-engine.md` (Transactional Entity Sync), `agency-features.md` (time tracking → invoicing bridge, billing rates), `app-designer.md` (invoice App portal, financial summary App blocks), `ai-architecture.md` (Context Builder financial data sources), `agent-architecture.md` (Report Builder agent financial tools), `tables-and-views.md` (Table Tab Colors, Inline Sub-Table Display, select_dropdown display style), `compliance.md` (API key encryption, audit trail), `inventory-capabilities.md` (Adjust Number Field #38 for running balance patterns, Snapshot/Freeze #39 for invoice line item price freezing), `custom-apps.md` (POS transaction → invoice creation pattern, Stripe Terminal payment reconciliation, Cart completion creates order records that feed accounting pipeline), `approval-workflows.md` (expense approval lifecycle subsumed by generic approval system — 1-2 step approval rule with threshold-based routing, on-approved side effect triggers accounting push automation; migration in Post-MVP — Verticals & Advanced)
> Scope: Post-MVP — Accounting Integration. All features in this document are post-MVP.
> Last updated: 2026-02-27 — Glossary reconciliation (see note above). Prior: 2026-02-21 — Expense workflow step 3: added explicit reference to generic approval system implementation from `approval-workflows.md`. Prior: 2026-02-19 — Initial creation. Full spec for Post-MVP — Accounting Integration.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| 1. Integration Architecture & Platform Coverage | 35–100 | Apideck/Merge unified API, QuickBooks/Xero/1C support |
| 2. Accounting Data Model — Finance Tables | 101–273 | invoice_table_config, expense_table_config, financial snapshots |
| 3. Accounting Sync Engine — Adapter Specification | 274–395 | UnifiedAccountingAdapter, transactional sync, reconciliation |
| 4. Automation Actions — Accounting | 396–449 | 7 automation actions (#31–37) for invoicing and expenses |
| 5. Invoice Lifecycle — End-to-End Workflow | 450–517 | Draft → sent → paid flow, payment tracking, reminders |
| 6. Expense Lifecycle & Budget Tracking | 518–582 | Expense capture, approval, budget monitoring |
| 7. Financial Command Center — Dashboard & Apps (Post-MVP) | 583–663 | 4-tab financial dashboard app |
| 8. AI Financial Intelligence | 664–734 | AI briefings, anomaly detection, cash flow forecasting |
| 9. Chart of Accounts & Tax Rate — Remote Reference Fields | 735–769 | Accounting reference data, field mapping |
| 10. Multi-Currency Handling | 770–787 | Exchange rates, currency conversion, multi-currency invoices |
| 11. Retainer Management | 788–809 | Retainer tracking, drawdown, top-up workflows |
| Phase Integration | 810–838 | Post-MVP — Accounting Integration delivery scope |

---

## 1. Integration Architecture & Platform Coverage

### Design Philosophy

EveryStack enhances accounting software — it does not replace it. The accounting platform remains source of truth for financial totals, tax compliance, and regulatory reporting. EveryStack adds what accounting platforms cannot: project-level cost visibility, cross-linked invoice traceability to tasks and time entries, forward-looking pipeline forecasts, and AI-driven financial analysis.

### Supported Platforms

| Platform | Market | Direction | Notes |
|----------|--------|-----------|-------|
| QuickBooks Online | US, UK, AU, CA | Action-oriented bidirectional | Dominant US SMB platform. REST API v3. |
| Xero | UK, AU, NZ, global | Action-oriented bidirectional | Strong internationally. OAuth 2.0. |
| 1C | Russia, CIS | Action-oriented bidirectional | Dominant in Russian-speaking markets. Different API architecture. |

**Direction model — "action-oriented bidirectional":** Unlike database sync adapters (Airtable/Notion) which mirror entire tables bidirectionally, accounting connectors are asymmetric:

| Data Type | Direction | Mechanism |
|-----------|-----------|-----------|
| Chart of Accounts | Inbound only | Polling (CoA changes rarely). Read-only reference table in EveryStack. |
| Tax Rates | Inbound only | Polling. Read-only reference table. |
| Contacts (Customers/Vendors) | Bidirectional | Push on create/update in EveryStack. Pull on create/update in accounting. |
| Invoices | Outbound primary | Push when Invoice status → Sent. Inbound status/payment sync via webhook. |
| Payments | Bidirectional | Push Stripe portal payments to accounting. Pull payments recorded in accounting. |
| Bills / Expenses | Bidirectional | Push project expenses to accounting. Pull bills entered by bookkeeper. |
| Purchase Orders | Outbound primary | Push PO on approval. Inbound status sync. |
| Journal Entries | Outbound only | Push revenue recognition entries, adjustments. |
| Financial Reports (P&L, Balance Sheet, Cash Flow) | Inbound only | Nightly snapshot sync via report API endpoints. |

### Architectural Decision: Unified Accounting API

**Decision: Use a unified accounting API (Apideck or Merge). Do not build native adapters per platform.**

Rationale: Unified APIs normalize the data model across 20+ accounting platforms behind one integration. They handle OAuth token management, platform-specific quirks (Xero journal reversal patterns, QuickBooks rate limits, 1C's architecture differences), webhook normalization, and ongoing API version migrations.

Cost: $300–600/month vs. 3–6 months engineering per native adapter × 3 platforms.

Implementation: One `UnifiedAccountingAdapter` implementing the existing adapter interface pattern (`toCanonical` / `fromCanonical`). Users see "Connect QuickBooks" / "Connect Xero" / "Connect 1C" in the UI — the unified API routes to the correct platform behind the scenes.

### Connection Model

Accounting connectors extend the existing `base_connections` pattern:

```
base_connections.platform enum expanded:
  airtable | notion | smartsuite | quickbooks | xero | 1c | unified_accounting

base_connections.config JSONB (for accounting):
  {
    unified_api_connection_id: string,   // Apideck/Merge connection ID
    platform: "quickbooks" | "xero" | "1c",
    company_name: string,                // From accounting platform
    base_currency: string,               // ISO 4217 (USD, GBP, EUR, RUB)
    fiscal_year_start_month: number,     // 1-12
    coa_sync_enabled: boolean,
    tax_rate_sync_enabled: boolean,
    report_sync_enabled: boolean,
    report_sync_schedule: "nightly" | "weekly",
    last_coa_sync_at: timestamp,
    last_report_sync_at: timestamp
  }
```

OAuth flow follows the existing base_connections pattern: Settings > Connections > Add Connection > Accounting > Choose Platform > OAuth redirect > Authorize > Connection established. Credential storage via unified API — EveryStack stores only the unified API connection reference, not raw OAuth tokens.

---

## 2. Accounting Data Model — Finance Tables

### Architectural Decision: Config Overlay, Not Table Type

**Decision: Invoices, expenses, and other financial records use standard `table` type with config overlays. No new `table_type` enum values.**

Rationale: Matches the `time_tracking_config` / `pm_table_config` / `calendar_table_config` pattern. Any table can gain financial capabilities via config. Templates provide the instant-start experience (pre-populated fields, default tab color, pre-applied config).

### `invoice_table_config`

One per table with invoice tracking enabled. Maps existing fields to invoice semantic roles.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| table_id | UUID → tables.id | Which table has invoice tracking |
| client_field_id | UUID → fields.id | Linked Record → Clients table |
| invoice_number_field_id | UUID → fields.id | Auto Number or Text field |
| issue_date_field_id | UUID → fields.id | Date field |
| due_date_field_id | UUID → fields.id | Date or Formula field (issue_date + payment_terms) |
| status_field_id | UUID → fields.id | Status field (Draft, Sent, Partially Paid, Paid, Overdue, Void) |
| subtotal_field_id | UUID → fields.id | Rollup or Formula field |
| tax_field_id | UUID → fields.id | Formula field |
| total_field_id | UUID → fields.id | Formula field (subtotal + tax) |
| amount_paid_field_id | UUID → fields.id | Currency or Rollup field |
| balance_due_field_id | UUID → fields.id | Formula field (total - amount_paid) |
| external_invoice_id_field_id | UUID → fields.id | Text field (read-only, accounting platform ID) |
| line_items_field_id | UUID → fields.id | Linked Record field → Line Items table |
| payment_terms_source | ENUM: client_field | fixed | `client_field`: resolve from client record. `fixed`: use default_payment_days. |
| default_payment_days | INTEGER | Default: 30. Used when payment_terms_source = fixed. |
| auto_overdue | BOOLEAN | Default: true. Automation marks Sent/Partially Paid → Overdue when past due. |
| connection_id | UUID (nullable) → base_connections.id | Which accounting connection pushes/pulls invoices. |

### `expense_table_config`

One per table with expense tracking enabled. Maps fields to expense semantic roles.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| table_id | UUID → tables.id | Which table has expense tracking |
| amount_field_id | UUID → fields.id | Currency field |
| date_field_id | UUID → fields.id | Date field |
| vendor_field_id | UUID → fields.id | Linked Record → Vendors/Contacts table |
| project_field_id | UUID → fields.id | Linked Record → Projects table |
| client_field_id | UUID → fields.id | Linked Record → Clients table (for pass-through billing) |
| account_code_field_id | UUID → fields.id | Linked Record → Chart of Accounts table |
| category_field_id | UUID → fields.id | Single Select (Travel, Software, Subcontractor, etc.) |
| status_field_id | UUID → fields.id | Status field (Draft, Submitted, Approved, Paid, Rejected) |
| billable_field_id | UUID → fields.id | Checkbox (billable to client?) |
| reimbursable_field_id | UUID → fields.id | Checkbox (reimbursable to employee?) |
| receipt_field_id | UUID → fields.id | File Attachment field |
| external_bill_id_field_id | UUID → fields.id | Text field (accounting platform bill ID) |
| connection_id | UUID (nullable) → base_connections.id | Accounting connection |

### `financial_snapshots`

Time-series storage for accounting report data. Evolution of `metric_snapshots` pattern for financial reports.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| connection_id | UUID → base_connections.id | Which accounting connection |
| report_type | ENUM: profit_loss \| balance_sheet \| cash_flow \| aged_receivables \| aged_payables | Report category |
| period_start | DATE | Report period start |
| period_end | DATE | Report period end |
| report_data | JSONB | Structured rows — see Report Data Shapes below |
| currency | VARCHAR(3) | ISO 4217 currency code |
| pulled_at | TIMESTAMPTZ | When this snapshot was fetched |

Indexes: (tenant_id, report_type, period_end), (tenant_id, connection_id, pulled_at).

Retention: All snapshots retained indefinitely (monthly data, low volume — ~5 rows per month per report type).

**Report Data Shapes:**

Profit & Loss `report_data`:
```json
{
  "sections": [
    {
      "name": "Revenue",
      "type": "income",
      "rows": [
        { "account_code": "4000", "account_name": "Consulting Revenue", "amount": 45000.00 },
        { "account_code": "4100", "account_name": "Design Revenue", "amount": 12000.00 }
      ],
      "total": 57000.00
    },
    {
      "name": "Cost of Sales",
      "type": "cogs",
      "rows": [...],
      "total": 22000.00
    },
    {
      "name": "Operating Expenses",
      "type": "expense",
      "rows": [
        { "account_code": "6000", "account_name": "Rent", "amount": 3000.00 },
        { "account_code": "6100", "account_name": "Utilities", "amount": 500.00 },
        { "account_code": "6200", "account_name": "Salaries", "amount": 18000.00 },
        { "account_code": "6300", "account_name": "Software Subscriptions", "amount": 2000.00 }
      ],
      "total": 23500.00
    }
  ],
  "summary": {
    "total_revenue": 57000.00,
    "total_cogs": 22000.00,
    "gross_profit": 35000.00,
    "total_expenses": 23500.00,
    "net_income": 11500.00
  }
}
```

Balance Sheet `report_data`:
```json
{
  "sections": [
    { "name": "Assets", "type": "asset", "rows": [...], "total": 125000.00 },
    { "name": "Liabilities", "type": "liability", "rows": [...], "total": 45000.00 },
    { "name": "Equity", "type": "equity", "rows": [...], "total": 80000.00 }
  ],
  "summary": {
    "total_assets": 125000.00,
    "total_liabilities": 45000.00,
    "total_equity": 80000.00,
    "cash_and_equivalents": 47000.00
  }
}
```

### `financial_summary`

Materialized aggregation table combining accounting snapshots with EveryStack-native data. Populated nightly by automation after accounting sync completes.

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| tenant_id | UUID | Workspace scoping |
| period_month | DATE | First day of month (2026-01-01, 2026-02-01, etc.) |
| currency | VARCHAR(3) | Base currency from accounting connection |
| actual_revenue | DECIMAL | From P&L snapshot: total_revenue |
| actual_cogs | DECIMAL | From P&L snapshot: total_cogs |
| actual_expenses | DECIMAL | From P&L snapshot: total_expenses (overhead) |
| actual_net_income | DECIMAL | From P&L snapshot: net_income |
| cash_position | DECIMAL | From Balance Sheet: cash_and_equivalents |
| accounts_receivable | DECIMAL | From Balance Sheet or Aged Receivables |
| accounts_payable | DECIMAL | From Balance Sheet or Aged Payables |
| invoiced_revenue | DECIMAL | From EveryStack invoices table (sum of Total where issue_date in period) |
| collected_revenue | DECIMAL | From EveryStack payments table (sum where date in period) |
| outstanding_invoices | DECIMAL | From EveryStack: sum of Balance Due where Status ∈ {Sent, Partially Paid, Overdue} |
| overdue_invoices | DECIMAL | From EveryStack: sum of Balance Due where Status = Overdue |
| project_labor_cost | DECIMAL | From time_entries: sum(duration_minutes / 60 × billing_rate_snapshot) for period |
| project_expenses | DECIMAL | From EveryStack expenses table: sum where date in period |
| unbilled_labor | DECIMAL | From time_entries: billable = true, invoiced = false, sum of hours × rate |
| pipeline_weighted | DECIMAL | From pipeline/proposals: sum(value × probability) for expected close in next 90 days |
| retainer_monthly | DECIMAL | Sum of active retainer agreements' monthly amounts |
| team_utilization_pct | DECIMAL | Billable hours / available hours for period |
| avg_collection_days | DECIMAL | Average days between invoice issue_date and payment date for period |
| updated_at | TIMESTAMPTZ | Last materialization time |

Indexes: (tenant_id, period_month).

One row per month per tenant. The materialization automation creates/updates the row for the current month and recalculates the prior month (in case late-arriving data changes it).

---

## 3. Accounting Sync Engine — Adapter Specification

### Transactional vs. Tabular Sync

Existing sync adapters (Airtable, Notion, SmartSuite) handle **tabular sync**: external platform has tables/databases with rows mapping 1:1 to EveryStack records. The adapter maps field-to-field, row-to-record.

Accounting adapters handle **transactional entity sync**: the accounting platform stores structured entities (Invoice with nested LineItems, TaxLines, LinkedTransactions) that must be decomposed into multiple EveryStack records across multiple tables, or composed from multiple records into a single API call.

### UnifiedAccountingAdapter Interface

```
interface UnifiedAccountingAdapter extends BaseAdapter {
  // Entity-level operations (not table-level)
  pushInvoice(invoiceRecord, lineItemRecords, config): ExternalInvoiceResult
  pushPayment(paymentRecord, invoiceRef, config): ExternalPaymentResult
  pushContact(contactRecord, contactType, config): ExternalContactResult
  pushBill(expenseRecord, config): ExternalBillResult
  pushPurchaseOrder(poRecord, lineItems, config): ExternalPOResult
  pushJournalEntry(lines, date, memo, config): ExternalJournalResult

  // Reference data pull
  pullChartOfAccounts(connectionId): AccountRecord[]
  pullTaxRates(connectionId): TaxRateRecord[]

  // Status sync (inbound)
  pullInvoiceStatus(externalInvoiceId): { status, amountPaid, payments[] }
  pullPayments(since: timestamp): PaymentRecord[]

  // Report sync (inbound)
  pullReport(reportType, periodStart, periodEnd): ReportData

  // Webhook handler
  handleWebhook(event): SyncAction[]
}
```

### Inbound Sync: Chart of Accounts

Polling-based. CoA changes rarely (monthly at most). Sync job runs on connection setup and then weekly.

Flow: Pull all accounts from unified API → For each account, upsert a record in the designated CoA table in EveryStack (matched on external_account_id) → Mark inactive accounts.

Field mapping:

| Accounting Platform Field | EveryStack Field Type | Purpose |
|--------------------------|----------------------|---------|
| code | Text | Account code (4000, 6100, etc.) |
| name | Text | Account name |
| type | Single Select | Revenue, Expense, Asset, Liability, Equity |
| sub_type | Single Select | Current Asset, Fixed Asset, COGS, Operating Expense, etc. |
| status | Status | Active, Archived |
| external_account_id | Text (read-only) | Platform ID for sync matching |

The CoA table is marked read-only in EveryStack (users cannot create/edit records manually). Changes flow from accounting platform only.

### Inbound Sync: Financial Reports

Nightly sync job (configurable to weekly for lower-tier plans).

Flow: For each enabled report type → Call unified API report endpoint with current month period → Store as `financial_snapshots` row → After all reports pulled, run Financial Summary materialization automation.

Report types pulled:
- Profit & Loss (current month MTD + prior complete month)
- Balance Sheet (as of today)
- Cash Flow Statement (current month MTD)
- Aged Receivables (as of today, bucketed: current, 1-30, 31-60, 61-90, 90+)
- Aged Payables (as of today, same buckets)

### Outbound Sync: Invoice Push

Triggered by automation action (not continuous sync). When Invoice status changes to "Sent":

1. Read invoice record + resolve all field values via `invoice_table_config` mapping
2. Read all linked line item records via `line_items_field_id`
3. Resolve client → external contact ID (push contact first if not yet synced)
4. For each line item: resolve account code → external account ID, resolve tax rate → external tax rate ID
5. Compose unified API Invoice object: { customer_id, invoice_number, issue_date, due_date, line_items: [{ description, quantity, unit_price, account_id, tax_rate_id }] }
6. Call `pushInvoice()` → receive external_invoice_id
7. Store external_invoice_id on the invoice record

### Outbound Sync: Payment Push (Stripe → Accounting)

When Stripe portal payment succeeds (existing portal payment webhook):

1. Existing flow: create Payment record in EveryStack, update invoice Amount Paid
2. New step: automation action pushes payment to accounting platform
3. Call `pushPayment()` with amount, date, method="credit_card", linked to external_invoice_id
4. Store external_payment_id on payment record

### Inbound Sync: Payment Status

Two mechanisms:

**Webhook (preferred):** QuickBooks and Xero both support webhooks. Unified API normalizes webhook events. When "payment created" or "invoice updated" event received → look up invoice by external_invoice_id → update EveryStack Payment records and Invoice amount_paid/status.

**Polling (fallback):** For platforms without webhook support or as backup. Hourly job: `pullPayments(since: last_check)` → match to invoices by external_invoice_id → create/update Payment records.

### Sync Conflict Strategy

Accounting data is source of truth for financial totals. Explicit conflict resolution:

| Field Category | Source of Truth | Rationale |
|----------------|----------------|-----------|
| Amounts (totals, payments, balances) | Accounting platform | Accountant's numbers are authoritative |
| Status (paid, overdue) | Computed from amounts | Derives from payment state |
| Metadata (descriptions, notes, categories) | Last-write-wins | Non-financial, either source acceptable |
| Line item details | EveryStack (pre-push) | EveryStack is where lines are created |
| Contact info | Last-write-wins | Updated in either system |

### Rate Limits

Platform rate limit registry entries (extends existing `sync-engine.md` registry):

| Platform | Limit | Scope | Strategy |
|----------|-------|-------|----------|
| QuickBooks Online | 500 req/min | Per company (realm) | Token bucket with 80% target |
| Xero | 5,000 req/day, 60 req/min | Per tenant | Daily budget allocation + per-minute bucket |
| 1C | Varies by deployment | Per instance | Configurable per connection |
| Unified API (Apideck) | Varies by plan | Per API key | Governed by unified API plan tier |

---

## 4. Automation Actions — Accounting

### New Actions (added to Full Action Catalog)

| # | Action | Config Fields | Output |
|---|--------|--------------|--------|
| 31 | **Create Invoice in Accounting** | `connectionId`, `invoiceRecordSelector`, `lineItemTableId`, `fieldMapping` (auto-resolved from invoice_table_config if present) | `{ externalInvoiceId, externalUrl }` |
| 32 | **Record Payment in Accounting** | `connectionId`, `invoiceRecordSelector`, `amount` (template), `date`, `paymentMethod`, `depositAccountId` | `{ externalPaymentId }` |
| 33 | **Create/Update Contact in Accounting** | `connectionId`, `recordSelector`, `contactType` (customer \| vendor), `fieldMapping` | `{ externalContactId }` |
| 34 | **Create Bill in Accounting** | `connectionId`, `expenseRecordSelector`, `fieldMapping` (auto-resolved from expense_table_config if present) | `{ externalBillId }` |
| 35 | **Create Journal Entry** | `connectionId`, `lines[]` (each: accountId, debit template, credit template, description template), `date`, `memo` | `{ externalJournalId }` |
| 36 | **Create Purchase Order in Accounting** | `connectionId`, `poRecordSelector`, `lineItemTableId`, `fieldMapping` | `{ externalPOId }` |
| 37 | **Fetch Account Balance** | `connectionId`, `accountCode`, `asOfDate` | `{ balance, currency }` |

### New Triggers

| Trigger | Event Source | Payload |
|---------|-------------|---------|
| **Payment Received in Accounting** | Webhook from accounting platform via unified API | `{ externalPaymentId, externalInvoiceId, amount, date }` |
| **Invoice Status Changed in Accounting** | Webhook / polling | `{ externalInvoiceId, oldStatus, newStatus }` |
| **Bill Created in Accounting** | Webhook / polling | `{ externalBillId, vendorName, amount, date }` |

### Pre-Built Automation Recipes

**Recipe 1: "Invoice from Completed Tasks"**
- Trigger: Button click on selected task records (or "When Task status → Done AND billable = true AND billing_milestone = 'Bill on completion'")
- Steps: Find/create draft invoice for client → Loop over tasks → For each task: create line item record (description = task name, quantity = sum of time_entries.duration_minutes / 60, rate = resolved billing rate, account code = default revenue account) → Link line item to invoice and task → Mark task as invoiced = true → Compute totals

**Recipe 2: "Monthly Billing Cycle"**
- Trigger: Scheduled — first of month
- Steps: Find all tasks where billing_milestone = "Bill monthly" AND invoiced = false AND completed in prior month → Group by client → For each client: create invoice → Loop over client's tasks → Create line items → Link and mark invoiced

**Recipe 3: "Send Invoice to Accounting + Client"**
- Trigger: When Invoice status → Sent
- Steps: Create Invoice in Accounting (action #31) → Generate PDF via Document Template (action #11) → Send email with PDF + portal payment link (action #7) → Create notification for PM (action #14)

**Recipe 4: "Overdue Invoice Reminder"**
- Trigger: Scheduled — daily
- Steps: Find invoices where due_date < today AND status ∈ {Sent, Partially Paid} → Update status → Overdue → For each: notify PM (action #14) → Optionally send client reminder email (configurable)

**Recipe 5: "Stripe Payment → Accounting"**
- Trigger: Portal Stripe payment webhook (existing)
- Steps: Create Payment record linked to invoice → Update invoice Amount Paid → If Amount Paid ≥ Total: status → Paid → Record Payment in Accounting (action #32)

**Recipe 6: "Monthly Revenue Recognition"**
- Trigger: Scheduled — first of month
- Steps: Find all projects with deferred revenue (contract value, progress field, previously recognized amount) → For each: compute delta = (progress_pct × contract_value) - previously_recognized → Create Journal Entry (action #35) with debit: Deferred Revenue, credit: Revenue, amount = delta → Update previously_recognized field

**Recipe 7: "Financial Summary Materialization"**
- Trigger: Scheduled — nightly, after report sync completes
- Steps: Read latest financial_snapshots for current month → Query EveryStack invoices, payments, expenses, time_entries → Compute all financial_summary columns → Upsert financial_summary row for current month and prior month

---

## 5. Invoice Lifecycle — End-to-End Workflow

### Table Structure (Template: "Finance — Invoicing")

Template creates three tables in a "Finance" workspace with amber tab colors:

**Invoices table** (type: table, config: invoice_table_config applied)
Fields: Invoice # (Auto Number), Client (Linked Record → Clients), Project (Linked Record → Projects), Issue Date (Date), Due Date (Formula: issue_date + client.payment_terms), Line Items (Linked Record → Invoice Line Items, display: inline_table), Subtotal (Rollup: sum of line items amount), Tax (Formula: subtotal × tax_rate), Total (Formula: subtotal + tax), Amount Paid (Currency), Balance Due (Formula: total - amount_paid), Status (Status: Draft, Sent, Partially Paid, Paid, Overdue, Void), External Invoice ID (Text, read-only), Payment Date (Date), Stripe Receipt URL (URL), Notes (Text Area).

**Invoice Line Items table** (type: table)
Fields: Invoice (Linked Record → Invoices), Task (Linked Record → Tasks, nullable), Description (Text), Quantity (Number — hours or units), Rate (Currency — hourly or unit rate), Amount (Formula: quantity × rate), Account Code (Linked Record → Chart of Accounts, display.style: select_dropdown), Tax Rate (Percent), Sort Order (Number, hidden).

The Linked Record field from Invoices → Line Items is configured with `display.style: "inline_table"` (see `tables-and-views.md` > Inline Sub-Table Display). Line items appear as an embedded editable grid within the invoice Record View.

**Payments table** (type: table)
Fields: Invoice (Linked Record → Invoices), Amount (Currency), Date (Date), Method (Single Select: Bank Transfer, Credit Card, Check, Stripe, Other), External Payment ID (Text, read-only), Reference (Text — check number, transaction reference), Notes (Text Area).

**Chart of Accounts table** (type: table, read-only, inbound sync)
Fields: Account Code (Text), Name (Text), Type (Single Select: Revenue, Expense, Asset, Liability, Equity), Sub-Type (Single Select), Active (Checkbox). Populated by accounting connector inbound sync. Users cannot create/edit records.

**Tax Rates table** (type: table, read-only, inbound sync)
Fields: Name (Text), Rate (Percent), Type (Single Select: Sales Tax, VAT, GST), Region (Text), Active (Checkbox), External Tax Rate ID (Text). Populated by accounting connector inbound sync.

### Invoice Creation: Three Trigger Patterns

**Manual from selected tasks:** PM opens Tasks table → filters to Done, billable, not invoiced → selects multiple records → right-click → "Create Invoice" (Button field action or context menu firing automation Recipe 1). Automation creates invoice record, iterates over tasks, creates line items pulling hours and rates from time entries, links everything, sets status = Draft.

**Automation on task completion:** Trigger: "When Task status → Done AND billable = true AND billing_milestone = 'Bill on completion'" → automation creates/finds draft invoice for this task's client → creates line item → links to task → marks invoiced.

**Scheduled monthly billing:** Trigger: "First of month" → automation queries tasks (billing_milestone = "Bill monthly", invoiced = false, completed in prior month) → groups by client → creates one invoice per client with all line items (Recipe 2).

### Rate Resolution for Line Items

When creating a line item from a task's time entries, the rate is resolved via the billing_rates hierarchy (defined in `agency-features.md`):

1. User + Client + Activity type → most specific rate
2. User + Client → user's rate for this client
3. User + Activity → user's rate for this work type
4. Client + Activity → client rate for this work type
5. User → user's default rate
6. Client → client's default rate
7. Activity → activity default rate
8. Workspace default → fallback

The resolved rate is already snapshotted on `time_entries.billing_rate_snapshot`. Line item Rate field copies from this snapshot. Quantity = sum of `time_entries.duration_minutes / 60` for the task.

### Invoice Sent → Push to Accounting

When PM changes status Draft → Sent (or clicks "Send Invoice" button):

1. **Push to accounting platform** via Action #31. Maps: client → Customer (push Contact first via Action #33 if not synced), line items → InvoiceLines with account codes and tax rates. Returns external_invoice_id → stored on record.

2. **Generate PDF** via Document Template (Action #11). Professional invoice with branding, line items table, payment terms, bank details.

3. **Send to client** via email (Action #7) with PDF attachment and "Pay Now" portal link. If client has portal access, invoice appears in their portal automatically (post-MVP App portal bound to Invoices table, record-scoped to client).

4. **Start due date clock.** Due Date formula computes from issue date + payment terms. Overdue automation (Recipe 4) picks it up when date passes.

### Payment Reconciliation

**Path A — Client pays via portal (Stripe):** Existing Stripe integration handles payment intent. Webhook fires → Recipe 5 creates Payment record, updates invoice Amount Paid. If fully paid, status → Paid. Same automation pushes payment to accounting (Action #32).

**Path B — Client pays outside portal:** Accountant records payment in QuickBooks/Xero. Inbound payment sync detects it (webhook or polling) → creates Payment record in EveryStack → updates invoice Amount Paid → status → Paid or Partially Paid.

**Partial payments:** Payment record created for partial amount. Invoice Amount Paid reflects partial sum. Balance Due formula shows remainder. Status → Partially Paid.

---

## 6. Expense Lifecycle & Budget Tracking

### Expense Table Structure (Template: "Finance — Expenses")

**Expenses table** (type: table, config: expense_table_config applied)
Fields: Description (Text), Amount (Currency), Date (Date), Vendor (Linked Record → Contacts), Project (Linked Record → Projects), Client (Linked Record → Clients), Account Code (Linked Record → Chart of Accounts, display.style: select_dropdown), Category (Single Select: Travel, Software, Subcontractor, Ad Spend, Office Supplies, Equipment, Other), Status (Status: Draft, Submitted, Approved, Paid, Rejected), Billable (Checkbox), Reimbursable (Checkbox), Receipt (File Attachment), External Bill ID (Text, read-only), Submitted By (People), Approved By (People), Notes (Text Area).

### Expense Workflow

1. **Logging:** Team member creates expense record — fills in amount, vendor, category, attaches receipt, links to project if project-related. Status = Draft.

2. **Submission:** Team member sets status → Submitted. Notification sent to Manager (via automation).

3. **Approval:** Manager reviews, changes status → Approved or Rejected (with note). If rejected, team member fixes and resubmits. Implementation: uses the generic approval system from `approval-workflows.md` — 1-2 step approval rule with threshold-based routing (e.g., expenses over $1,000 require second approver). On-approved side effect triggers the accounting push automation in step 4. Migrated from domain-specific logic in Post-MVP — Verticals & Advanced (see `approval-workflows.md` > Relationship to Existing Domain-Specific Approvals).

4. **Push to accounting:** When status → Approved, automation fires Action #34 (Create Bill in Accounting). Maps vendor → Vendor, amount, account code, date. Returns external_bill_id.

5. **Payment tracking:** When bill paid in accounting platform, inbound sync updates status → Paid.

### Project Profitability (Extends `agency-features.md`)

With expenses tracked, profitability calculations become complete:

```
Project Gross Margin =
  (Invoiced Revenue)
  − (Labor Cost: sum of time_entries hours × billing_rate_snapshot)
  − (Project Expenses: sum of Expenses where project = this project)

Fully Loaded Margin =
  Gross Margin − (Allocated Overhead)

Allocated Overhead =
  (Total monthly overhead from P&L) × (Project's share of billable hours / Total billable hours)
```

Labor cost already exists via `agency-features.md` time tracking. Project expenses are the new addition. Allocated overhead comes from `financial_snapshots` P&L data.

### Budget Tracking

Each project can have a Budget field (Currency). Budget tracking shows:

| Metric | Source | Calculation |
|--------|--------|-------------|
| Budget | Project record Budget field | Fixed value set by PM |
| Labor Spent | time_entries for this project | sum(hours × rate) where status = approved |
| Expenses Spent | Expenses table linked to project | sum(amount) where status ∈ {Approved, Paid} |
| Total Spent | | Labor Spent + Expenses Spent |
| Committed (not yet spent) | | Estimated remaining hours × avg rate + approved-but-unpaid expenses |
| Remaining | | Budget − Total Spent − Committed |
| Burn Rate | | Total Spent / elapsed project days |
| Projected Overrun | | If burn_rate × remaining_days > Remaining, flag |

These are Formula/Rollup field computations on the project record. No new infrastructure needed — the formula engine and cross-link rollups handle this.

### Purchase Orders

**PO table** (type: table) with fields: PO # (Auto Number), Vendor (Linked Record), Project (Linked Record), Description (Text), Amount (Currency), Status (Status: Draft, Pending Approval, Approved, Ordered, Received, Cancelled), Approved By (People), External PO ID (Text).

Workflow: Create PO → Submit for approval (portal or internal) → Approved → Push to accounting (Action #36) → When goods/services received, status → Received → Link to corresponding expense/bill when it arrives.

PO-to-Bill matching: When a bill arrives from accounting (inbound sync), automation checks for open POs with matching vendor and approximate amount. If found, links the expense to the PO and flags if amount exceeds PO (for review).

---

## 7. Financial Command Center — Dashboard & Apps (Post-MVP)

### Architecture

The Financial Command Center is a **workspace-level App** (post-MVP, built in App Designer). It pulls from multiple tables across the workspace using the materialized `financial_summary` table as its primary data source, supplemented by direct table bindings for real-time drill-down.

Tabs use the `summary` App page type from `chart-blocks.md` — a grid layout of chart blocks (number_cards, bar charts, line charts) rather than record-based views. See `chart-blocks.md` > Summary Tab in the Financial Command Center for the complete tab-to-chart-block mapping.

### Tab 1: "This Month" — Operating Dashboard

**Data source:** `financial_summary` row for current month + direct bindings to Invoices and Expenses tables.

**Layout:**

Top section — four summary cards (App summary blocks):
- **Revenue:** `financial_summary.actual_revenue` (from accounting) with delta indicator vs. prior month
- **Expenses:** `financial_summary.actual_expenses + actual_cogs` with delta vs. prior month
- **Net Income:** `financial_summary.actual_net_income` with delta vs. prior month. Color: green if positive, red if negative.
- **Cash Position:** `financial_summary.cash_position` (from Balance Sheet). With runway indicator: cash_position / avg monthly burn = "X months runway"

Middle section — two-column layout:
- **Left: Revenue Breakdown** — Invoices table grouped by Client, filtered to current month, showing sum of Total per client. Progress bar against client's monthly retainer or project budget.
- **Right: Expense Breakdown** — Combined view: P&L expense categories from `financial_snapshots.report_data` sections (rent, salaries, software, etc.) + project expenses from EveryStack Expenses table. Unified category list with amounts.

Bottom section — Cash Flow Calendar:
- Timeline showing expected inflows (invoices by due date, retainer payments) and expected outflows (recurring bills extrapolated from P&L history, known upcoming payments).
- Implemented as an App page tab with `view_type: 'timeline'` bound to a computed data source combining invoice due dates and projected expenses.

### Tab 2: "Profitability" — Project & Client Economics

**Data source:** Direct table bindings to Projects, Invoices, Time Entries, Expenses.

**Layout:**

Per-client profitability table: Client name, Total Invoiced (Rollup), Labor Cost (Rollup from time entries), Project Expenses (Rollup), Gross Margin (Formula), Margin % (Formula). Sorted by margin % — green/amber/red color coding.

Per-project profitability table: Project name, Budget, Total Spent (labor + expenses), Invoiced, Collected, Gross Margin, Margin %. Budget burn indicator.

Team utilization summary: Per-user rows showing available hours, billable hours, utilization %. Color-coded: green ≥ 70%, amber 50-70%, red < 50%.

Overhead allocation: Total overhead from P&L (rent + salaries + software + etc.), divided across active projects proportional to billable hours. Shows "fully loaded" project cost.

### Tab 3: "Forecast" — Forward-Looking Projections

**Data source:** `financial_summary` for historical actuals, Invoices for receivables, pipeline/proposals table for weighted pipeline.

**Layout:**

Cash flow projection (30/60/90 days):
- Starting point: current cash position (from Balance Sheet)
- Add: expected inflows — outstanding invoices by projected payment date (due date + historical avg days late per client), retainer renewals, weighted pipeline
- Subtract: expected outflows — recurring expenses (extrapolated from P&L monthly averages), known large upcoming expenses
- Result: projected cash balance line by week

Revenue pipeline: Weighted pipeline from proposals/deals table. Grouped by expected close month. Shows committed (signed projects) vs. probable (weighted) vs. possible (low probability).

Upcoming receivables: Invoices sorted by due date. Color-coded by age. Client payment history indicator (avg days to pay).

### Tab 4: "Trends" — Historical Analysis

**Data source:** `financial_summary` time-series (one row per month).

**Layout:**

Revenue trend chart: Monthly revenue over 6–12 months. Line chart with actual revenue.
Expense trend chart: Monthly total expenses.
Profit trend chart: Monthly net income.
Cash balance trend: Monthly cash position from Balance Sheet snapshots.

Key ratios over time: Gross margin %, net margin %, avg collection days, utilization %, revenue per employee.

Year-over-year comparison where data exists: current month vs. same month prior year.

### Portal Variants

**Client-facing invoice App portal (post-MVP):** App portal bound to Invoices table, record-scoped to client. Shows: list of invoices with status, total, balance due. "Pay Now" button on unpaid invoices (Stripe). Download PDF. Statement summary card.

**Leadership financial overview:** Internal App (or shared App) with same dashboard tabs but accessible via portal URL. For business owners who want a mobile-friendly financial view without logging into the full workspace.

---

## 8. AI Financial Intelligence

### Weekly Financial Briefing (Automated)

**Implementation:** Scheduled automation (Recipe 7 variant, running weekly — Sunday evening or Monday morning).

**Automation steps:**
1. Read current `financial_summary` for this month and prior month
2. Read outstanding invoices (overdue, due this week, due next week)
3. Read recent payments received (this week)
4. Read pipeline changes (new proposals, proposals that progressed/stalled)
5. Read team utilization for current week
6. Call AI: Generate Text (Action #24) with structured prompt:

```
Prompt template:
You are a financial analyst for {{workspace.name}}. Generate a concise weekly financial briefing.

Current financial state:
- Cash position: {{financial_summary.cash_position}}
- Monthly revenue (MTD): {{financial_summary.actual_revenue}}
- Monthly expenses (MTD): {{financial_summary.actual_expenses}}
- Net income (MTD): {{financial_summary.actual_net_income}}
- Outstanding invoices: {{financial_summary.outstanding_invoices}}
- Overdue invoices: {{financial_summary.overdue_invoices}}

This week's activity:
- Payments received: {{payments_this_week}}
- New invoices sent: {{invoices_sent_this_week}}
- Overdue details: {{overdue_invoice_details}}

Pipeline: {{pipeline_summary}}
Team utilization: {{utilization_pct}}%

Generate a 4-6 sentence briefing highlighting: key numbers, action items (overdue follow-ups, upcoming large payments/receivables), and any concerns (cash flow timing, utilization drop, pipeline thinning). Be specific — reference client names and amounts.
```

7. Send briefing via email (Action #7) to workspace owner/admin, and/or create notification (Action #14).

### Monthly Strategy Session (Agent-Powered)

**Implementation:** Report Builder agent type (defined in `agent-architecture.md`) with financial data sources in its tool set.

**Agent configuration:**
- Agent type: `report_builder`
- Default scope: workspace-level (reads across all workspaces)
- Available data sources: `financial_summary`, `financial_snapshots`, Invoices table, Expenses table, Time Entries, Projects, Pipeline/Proposals, Resource Profiles, Billing Rates
- Approval mode: `supervised` (read-only analysis, no mutations)

**Example interactions:**

User: "Should I hire another developer?"
Agent: Pulls utilization data → current team utilization 87%. Pulls financial summary → monthly overhead $45K, monthly revenue $62K. Pulls pipeline → $80K committed for Q2 vs. $186K target. Synthesizes: "Your team is running at 87% utilization which is above the sustainable 70-80% range. A new developer at $8K/month raises your break-even to $53K/month. Your Q2 pipeline covers this if the Initech deal closes. Recommendation: make the hire contingent on Initech close, or bring on a contractor at a higher hourly rate with lower commitment."

User: "What if I lose my biggest client?"
Agent: Identifies biggest client by revenue → pulls all invoices, retainer amount, projects. Computes: revenue lost, team hours freed, overhead still owed. Synthesizes impact on cash flow, suggests mitigation (accelerate pipeline, reduce discretionary spend, reassign team to other projects).

### Scenario Calculators (Interface-Powered)

Pre-built App page tabs with editable input fields that recompute projections:

**Revenue Scenario:** Inputs: "Average ticket change %" (slider), "Order volume change" (number), "Collection days change" (number). Computations use `financial_summary` actuals as baseline. Output: projected monthly revenue, projected cash flow impact, projected net income change.

**Cost Scenario:** Inputs: "New hire salary" (currency), "New hire start date", "Expense change %" (slider). Output: projected monthly burn increase, runway impact, break-even revenue required.

**What-If Scenario:** Free-form. User adjusts any variable via slider/input → formula fields recompute all downstream metrics using `financial_summary` as baseline. Shows current state, projected state, and delta side-by-side.

Implementation: Either as a dedicated App page tab with input fields (using Formula fields with variables) or as an interactive React component rendered via App portal. The formula engine's ability to reference other fields and compute chains handles the cascading calculations.

---

## 9. Chart of Accounts & Tax Rate — Remote Reference Fields

### UX Pattern: Linked Record with Select Dropdown Display

When a user picks an account code on an invoice line item, the options come from the synced Chart of Accounts table. Technically this is a Linked Record field with `max_links: 1` pointing to the CoA table. But the UX should feel like a dropdown select, not a record link picker.

**Configuration:**

```
fields.config for CoA Linked Record:
{
  target_table_id: "<coa_table_id>",
  cross_link_id: "<auto>",
  relationship: "many_to_one",
  max_links: 1,
  display_field_id: "<account_name_field_id>",
  allow_create: false,           // Users can't create new accounts
  display: {
    style: "select_dropdown",    // NEW: renders as dropdown instead of record picker
    search_fields: ["<code_field_id>", "<name_field_id>"],
    option_template: "{{code}} — {{name}}",  // e.g., "4000 — Consulting Revenue"
    group_by_field_id: "<type_field_id>",     // Groups: Revenue, Expense, Asset, etc.
    filter: { "<active_field_id>": true }     // Only show active accounts
  }
}
```

**Behavior:** Clicking the field opens a dropdown (not a record link modal) showing CoA entries grouped by type, searchable by code or name. Selecting an entry links the record. The cell displays "4000 — Consulting Revenue" in compact text format.

**Same pattern applies to:** Tax Rates field on line items, Vendor selection on expenses (if the vendors table is synced from accounting).

This is a general-purpose enhancement to the Linked Record field type — `display.style: "select_dropdown"` — applicable anywhere a Linked Record with `max_links: 1` should feel like a single select whose options come from another table. Documented in `tables-and-views.md` and `data-model.md`.

---

## 10. Multi-Currency Handling

### Strategy: Transaction Currency in EveryStack, Conversion in Accounting

EveryStack stores and displays amounts in the transaction currency (the currency on each invoice/expense). The accounting platform handles conversion to the base currency, tracks exchange rate gains/losses, and reports in base currency.

**Per-record currency:** Invoice records have a Currency field. If the client is billed in USD but the business base currency is GBP, the invoice shows amounts in USD. The accounting platform converts when the invoice is pushed.

**Dashboard aggregation problem:** The Financial Command Center needs to sum invoices across currencies. Two approaches:

**Approach A (recommended for MVP):** Dashboard totals come from `financial_snapshots` P&L and Balance Sheet data, which the accounting platform has already converted to base currency. EveryStack-native totals (outstanding invoices, pipeline) are displayed per-currency when mixed, or converted using a simple exchange rate reference.

**Approach B (post-MVP enhancement):** Maintain an `exchange_rates` reference table with daily rates (pulled from a free API like exchangerate.host or from the accounting platform). Formula fields compute converted amounts: `total_base = total × exchange_rate`. Dashboard rollups use the converted amounts.

**Post-MVP — Accounting Integration scope:** Approach A only. Multi-currency invoicing works (each invoice has its currency), but dashboard totals rely on accounting platform conversions. Approach B is a Post-MVP — Self-Hosted AI or post-MVP enhancement if international user demand warrants it.

---

## 11. Retainer Management

### Retainer Agreement Structure

**Retainer Agreements table** (type: table) with fields: Client (Linked Record → Clients), Monthly Amount (Currency), Included Hours (Number), Overage Rate (Currency — per hour over included), Billing Cycle Day (Number — day of month billing runs), Start Date (Date), End Date (Date, nullable — null = ongoing), Status (Status: Active, Paused, Ended), Current Period Hours Used (Rollup — from time entries for current billing period), Hours Remaining (Formula: included_hours - current_period_hours_used), Overage Hours (Formula: MAX(0, current_period_hours_used - included_hours)), Period Invoice Amount (Formula: monthly_amount + (overage_hours × overage_rate)).

### Retainer Billing Automation

Scheduled automation running on billing cycle day for each active retainer:
1. Query time_entries for the retainer's client, billable = true, within the current billing period
2. Compute total hours used, overage if any
3. Create invoice: flat retainer line item (monthly_amount) + overage line item (overage_hours × overage_rate) if applicable
4. Mark time entries as invoiced
5. Push to accounting (Action #31)
6. Send to client via portal/email

### Portal Retainer Dashboard

Client App portal page (post-MVP) showing: current period hours used vs. included (progress bar), hours remaining, overage indicator, history of prior months' usage. Uses App chart blocks for visual display.

---

## Phase Integration

### Dependencies

| Dependency | Phase | Required For |
|------------|-------|-------------|
| Automation engine | Post-MVP — Automations | Invoice creation recipes, accounting push actions, overdue reminders |
| Portal + Stripe | Post-MVP — Portals & Apps | Client invoice portal, payment collection |
| Document Templates | Post-MVP — Documents | Invoice PDF generation |
| Time tracking | Post-MVP — Agency Features | Billable hours → line items, rate resolution |
| Cross-linking | MVP — Core UX | Invoice ↔ Line Items ↔ Tasks ↔ Projects ↔ Clients |
| App Designer (post-MVP) | MVP — Core UX | Financial Command Center dashboard |
| Inline Sub-Table | MVP — Core UX | Line item editing UX (see `tables-and-views.md`) |
| AI actions | Post-MVP — Automations | Weekly briefing generation |
| Agent runtime | Post-MVP — AI Agents | Monthly strategy sessions, scenario analysis |

### Post-MVP — Accounting Integration Work Stream

Accounting Integration ships as Post-MVP — Accounting Integration, after time tracking which provides the billable hours data that invoicing consumes.

### Layered Delivery

| Layer | Contents | Ships With |
|-------|----------|-----------|
| **Layer 1: Connector + Actions** | Unified API integration, OAuth connect, CoA/Tax Rate inbound sync, Actions #31-37, invoice push, payment status sync | Post-MVP — Accounting Integration core |
| **Layer 2: Lifecycle + Recipes** | Invoice creation recipes, expense workflow, overdue automation, portal invoice page, Stripe→accounting sync | Post-MVP — Accounting Integration core |
| **Layer 3: Financial Command Center** | financial_snapshots inbound sync, financial_summary materialization, 4-tab dashboard App (post-MVP App Designer) | Post-MVP — Accounting Integration (may extend into 8f) |
| **Layer 4: AI Intelligence** | Weekly briefing automation, scenario calculators | Post-MVP — Accounting Integration (briefing) + Post-MVP — AI Agents (interactive sessions) |
| **Layer 5: Advanced** | Retainer management, PO workflow, revenue recognition, multi-currency Approach B | Post-MVP, demand-driven |
