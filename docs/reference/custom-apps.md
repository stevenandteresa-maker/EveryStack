# EveryStack — Custom Apps & Point of Sale

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Key changes: (1) Renamed "Interface Designer" → "App Designer" throughout per glossary naming discipline; (2) Renamed "interface types" → "app types"; (3) Replaced "Interface" (when meaning Table View) → "Table View"; (4) Clarified that the entire document is **post-MVP** — Custom Apps are explicitly excluded from MVP per glossary; (5) Corrected the six-type taxonomy — Table Views are NOT App Designer outputs per glossary, and MVP portals/forms use the Record View layout, not the App Designer; (6) Updated cross-references to use glossary-standard terms.

> **⚠️ POST-MVP — This entire document describes post-MVP functionality.** Per GLOSSARY.md MVP Scope Summary, Custom Apps (POS, websites, internal apps) and the App Designer (visual page builder) are explicitly excluded from MVP.

> **Reference doc (Tier 3).** Internal custom apps built on the App Designer engine. Extends the App Designer to serve workspace users (not just external clients), enabling POS terminals, front-desk kiosks, dispatch boards, warehouse terminals, and other purpose-built operational apps. Custom Apps are one of the post-MVP app types produced by the App Designer (see GLOSSARY.md: App types include Custom Portal, Internal App, Website, App Form, Document). Defines the App entity, auth context switching, permission-based data scoping, the Cart/Transaction block, kiosk mode, Stripe Terminal integration (external reader + Tap to Pay), and the Capacitor native shell for NFC payment acceptance.
> Cross-references: `GLOSSARY.md` (source of truth — naming, scope, architecture), `app-designer.md` (App Designer architecture, block model, theme system, data binding modes, container rules, canvas behavior, property panel, PWA offline tiers, caching infrastructure, Stripe payment block, publish flow), `tables-and-views.md` (Table View architecture — complementary not competitive, Quick Entry mode, `views` table), `inventory-capabilities.md` (Barcode field, atomic quantity operations, Quick Entry mode, scan-to-find-record), `mobile.md` (Capacitor decision framework, PWA capabilities, NFC scanning section, service worker caching, biometric auth readiness, performance budgets), `automations.md` (automation triggers from app events, receipt/invoice generation actions), `accounting-integration.md` (invoice creation patterns, payment reconciliation, Stripe webhook handling), `permissions.md` (workspace roles, `$me` context variable, field permissions), `data-model.md` (schema, field types, cross-link patterns), `cross-linking.md` (Orders → Line Items relational pattern), `chart-blocks.md` (dashboard summary blocks in app pages), `smart-docs.md` (receipt/invoice generation via Smart Doc templates), `design-system.md` (design system palette, kiosk-mode typography scaling), `compliance.md` (PCI DSS scope for Stripe Terminal, Capacitor app store compliance), `agency-features.md` (time tracking timer widget — embeddable in app pages), `record-templates.md` (app form blocks support `template_id` for pre-fill; Cart/Transaction block completion flow creates records with `record_creation_source` context)
> Implements: `apps/web/src/components/CLAUDE.md` (component patterns), `apps/web/src/actions/CLAUDE.md` (Server Action patterns), `packages/shared/db/CLAUDE.md` (query patterns)
> Cross-references (cont.): `workspace-map.md` (AppNode in topology graph — apps use `apps` table post-MVP per GLOSSARY.md; Cart/Transaction block table references produce `app_binds_to` and `app_transacts_to` edges; app_type_hint inferred from blocks)
> Last updated: 2026-02-27 — Reconciled with GLOSSARY.md. Renamed Interface Designer → App Designer throughout. Marked entire doc as post-MVP. Corrected app type taxonomy.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                          | Lines   | Covers                                                          |
| ------------------------------------------------ | ------- | --------------------------------------------------------------- |
| Strategic Rationale                              | 41–68   | Internal apps on App Designer engine, POS hero use case         |
| Architecture: Post-MVP App Types                 | 69–92   | 7 app types, type-specific capabilities                         |
| Data Model Additions                             | 93–176  | apps, app_pages, app_blocks tables, cart_sessions               |
| Route Architecture                               | 177–210 | App routes, nested page routing, URL structure                  |
| Cart / Transaction Block                         | 211–363 | Session-scoped Zustand state, 9-step atomic completion          |
| Stripe Terminal Integration                      | 364–530 | 3 paths (external reader, Tap to Pay, Smart Reader)             |
| Kiosk Mode                                       | 531–578 | Full-screen locked mode, session auto-reset, inactivity timeout |
| App Creation Flow                                | 579–605 | Wizard, starter templates, type selection                       |
| App Navigation in Workspace                      | 606–615 | Sidebar placement, app switching                                |
| App-Specific Block Enhancements                  | 616–653 | Blocks added for internal app use cases                         |
| Audit Trail for App Actions                      | 654–681 | App-specific audit events, actor_type tracking                  |
| Caching & Performance                            | 682–702 | App page caching, block-level updates                           |
| Redis Key Patterns (New)                         | 703–712 | Redis keys for cart sessions, app state                         |
| Plan Limits                                      | 713–728 | App count and page limits per plan tier                         |
| MVP Feature Split (All Post-MVP per GLOSSARY.md) | 729–764 | Scope boundaries                                                |
| Phase Implementation Summary (All Post-MVP)      | 765–776 | Post-MVP — Custom Apps+ delivery scope                          |
| Starter Templates                                | 777–821 | POS Terminal, Front Desk Kiosk, Warehouse Station templates     |

---

## Strategic Rationale

The App Designer is a general-purpose visual page builder — 12-column grid, recursive block tree, data binding, theming, drag-and-drop canvas. Limiting it to external-facing client portals undersells the infrastructure. The same engine that builds a client dashboard can build a POS terminal, a warehouse receiving station, or a dispatch board.

**The gap today:** Table Views are opinionated, fast to set up, and view-based — a Manager spins one up in 30 seconds. But Table Views can't produce a POS screen with a product grid on the left, a cart on the right, a barcode scanner at the top, and a payment button at the bottom. That's a spatial layout problem, and the App Designer already solves spatial layout.

**The opportunity:** Add an "internal app" mode to the App Designer. Same designer, same blocks, same themes — different auth wrapper and data scoping model. This opens a massive surface area of use cases that no competitor in the no-code space handles well, especially combined with EveryStack's cross-base data connectivity.

### Competitive Positioning

Custom apps position EveryStack against Claris/FileMaker, Glide, Softr, Stacker, and AppSheet — platforms that let SMBs build internal apps from their data. None of them offer cross-base linking. None integrate barcode scanning, payment processing, offline queuing, and a visual App Designer in one platform. The combination of "build your own POS" + "your phone is the terminal" + "it all connects to your existing EveryStack data" is genuinely differentiated.

### Use Cases (Non-Exhaustive)

| App Type                        | Primary Audience                   | Key Blocks                                                                |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| **Point of Sale**               | Retail, food service, salons       | Product Table/List, Cart, Payment (Stripe Terminal), Receipt Button       |
| **Front Desk / Check-In Kiosk** | Gyms, clinics, coworking           | Search/Lookup, Form Input, Appointment List, Check-In Button              |
| **Warehouse Terminal**          | Receiving, picking, packing        | Barcode Scanner (Quick Entry), Cart/Batch, Quantity Input, Confirm Button |
| **Dispatch Board**              | Field service, delivery, HVAC      | Map block, Job List, Status Updater, Assignment Controls                  |
| **Time Clock / Attendance**     | Any team-based business            | Employee Lookup, Clock In/Out Button, Shift Summary, Timer Widget         |
| **Order Intake**                | Restaurants, print shops, bakeries | Menu/Catalog List, Cart, Special Instructions Form, Submit Button         |
| **Inspection Station**          | Manufacturing QC, property mgmt    | Checklist Form, Photo Upload, Pass/Fail Buttons, Defect Log               |

POS is the **hero use case** — it exercises the most primitives (product lookup, barcode scanning, cart state management, payment processing, receipt generation, inventory adjustment) and has the broadest market appeal.

---

## Architecture: Post-MVP App Types

> **GLOSSARY.md alignment note:** The glossary defines App types as post-MVP outputs of the App Designer: Custom Portal, Internal App, Website, App Form, Document. **Table Views are NOT app types** — they are workspace-level views with predefined structures (Grid, Card, Kanban, etc.) and live in the `views` DB table. MVP portals and forms use the Record View layout engine, not the App Designer. The taxonomy below describes the post-MVP App Designer outputs only.

The App Designer produces multiple app types across two categories. All share the same designer engine, block model, and themes. Differences are auth context, data scoping, and rendering target. This section focuses on the **Internal App** type; see `app-designer.md` for the complete taxonomy.

|                  | **Custom Portal**    | **Internal App**   | **Widget**              | **App Form**           | **Website**           |
| ---------------- | -------------------- | ------------------ | ----------------------- | ---------------------- | --------------------- |
| **Category**     | External             | Internal           | Internal                | External               | External              |
| **Auth**         | Portal client        | Workspace (Clerk)  | Workspace (Clerk)       | None                   | None                  |
| **Data Scoping** | Identity-based       | Permission + `$me` | Permission + `$me`      | Write-only             | Static/optional       |
| **Designer**     | App Designer         | App Designer       | App Designer            | App Designer           | App Designer          |
| **Layout**       | Spatial (4-zone)     | Spatial (4-zone)   | Responsive to container | Form-specific          | Spatial (4-zone)      |
| **Rendering**    | `/portal/{slug}/*`   | `/app/{slug}/*`    | My Office grid cell     | Embed / standalone URL | Public URL            |
| **DB Table**     | `apps` (type=portal) | `apps` (type=app)  | `apps` (type=widget)    | `apps` (type=form)     | `apps` (type=website) |

> **DB table note (GLOSSARY.md):** Per the glossary, post-MVP App Designer outputs use the `apps` table (not `portals`). The glossary states: "The old docs used the `portals` table to store all App Designer outputs... The `portals` DB table from old docs should be split: `portals` for simple record-sharing, `forms` for record-creation forms, and (post-MVP) `apps` for App Designer outputs."

**App types share the `apps` table.** The `type` column (`'portal' | 'app' | 'form' | 'website' | 'widget'`) distinguishes them. The block model (`app_pages`, `app_blocks`), designer UI, theme system, and publish flow are identical. Only the auth wrapper, data scoping, and route architecture differ.

**Table Views remain entirely separate.** Table Views are not in the `apps` table. They use the `views` table with their own scope (per GLOSSARY.md: `views` table with `id`, `tenant_id`, `table_id`, `view_type`, `config (JSONB)`). The value of Table Views is speed and structure. The value of App Designer apps is flexibility and spatial layout. These serve different needs — don't blur the line.

---

## Data Model Additions

> **GLOSSARY.md alignment note:** Per the glossary, post-MVP App Designer outputs use the `apps` table (with `app_pages` and `app_blocks`), not the `portals` table. The data model below uses `apps` to align with the glossary's DB Entity Quick Reference. During implementation, the migration path from the old `portals`-based schema to the `apps`-based schema should follow the glossary's guidance.

### `apps` Table — Key Columns for Internal Apps

| Column       | Type             | Change       | Purpose                                                                                                                       |
| ------------ | ---------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `id`         | UUID             | **Existing** | Primary key (per GLOSSARY.md `apps` table)                                                                                    |
| `tenant_id`  | UUID             | **Existing** | Workspace that owns this app                                                                                                  |
| `type`       | VARCHAR          | **Existing** | `'portal'`, `'app'`, `'form'`, `'website'`, or `'widget'`. The app types share the same `apps` table and App Designer engine. |
| `name`       | VARCHAR          | **Existing** | Display name                                                                                                                  |
| `theme`      | JSONB            | **Existing** | Theme configuration                                                                                                           |
| `status`     | VARCHAR          | **Existing** | Draft / Published / Unpublished                                                                                               |
| `app_config` | JSONB (nullable) | **New**      | App-specific configuration. NULL for portals. See App Config below                                                            |

All existing App Designer columns remain unchanged. Internal Apps use the same `theme`, `navigation`, `app_pages`, and `app_blocks` infrastructure.

**Migration:** When implementing custom apps, add the `app_config` JSONB column to the `apps` table. Zero-downtime, backward compatible.

### App Config JSONB Shape

```typescript
interface AppConfig {
  // Auth & access
  accessMode: 'role_minimum' | 'user_list';
  roleMinimum?: WorkspaceRole; // e.g., 'team_member' — all roles at or above
  allowedUserIds?: string[]; // Explicit user list (alternative to role_minimum)

  // Kiosk mode
  kioskMode: boolean; // Fullscreen, no workspace chrome
  kioskAutoLock?: {
    // Optional inactivity lock
    timeoutSeconds: number; // e.g., 300 (5 minutes)
    requirePin: boolean; // PIN to unlock (not full re-auth)
    pinHash?: string; // bcrypt hash of 4-6 digit PIN
  };

  // Stripe Terminal (in-person payments)
  stripeTerminal?: {
    enabled: boolean;
    locationId: string; // Stripe Terminal Location ID
    readerType: 'external' | 'tap_to_pay' | 'both';
    tipConfig?: {
      enabled: boolean;
      presets: number[]; // e.g., [15, 18, 20, 25] (percentages)
      customAllowed: boolean;
    };
  };

  // Transaction defaults
  transactionConfig?: {
    targetTableId: string; // Where completed transactions create records (e.g., Orders)
    lineItemTableId?: string; // Where line items create records (e.g., Order Items)
    lineItemLinkFieldId?: string; // Cross-link field on line items pointing to parent order
    autoNumberFieldId?: string; // Auto-number field for transaction/receipt numbers
    quantityAdjustFieldId?: string; // Field on product table for atomic inventory decrement
  };
}
```

### App Scoping Configuration

Unlike portals (which use identity-based scoping via `linked_record_id`), apps use **permission-based scoping** derived from workspace roles and the `$me` context variable.

Apps do not use portal-style scoping. Instead, data visibility in apps is governed by:

1. **Workspace permissions** — the logged-in user's role determines table/field access (same as anywhere in the workspace)
2. **App-level base filters** — optional filters set on each app page, equivalent to Table View `base_filters` (e.g., `Assigned To = $me`, `Location = $currentLocation`)
3. **Block-level filters** — per-block filters in the Content tab (same as portal block filters)

```typescript
interface AppPageScopingConfig {
  baseFilters?: FilterRule[]; // Page-level filters, support $me variable
  // $me resolves to the authenticated workspace user's ID
  // $currentLocation resolves to device geolocation (if permission granted)
}
```

Stored in `app_pages.layout_config.app_scoping` (JSONB, nullable). NULL for portal-type pages. The data resolver checks `apps.type` and branches:

- `type = 'portal'` → identity-based scoping via `scoping_config` + `linked_record_id`
- `type = 'app'` → permission-based scoping via workspace roles + page/block filters

---

## Route Architecture

Apps authenticate via Clerk (workspace users), not the portal client auth system. They need a separate route group that includes Clerk middleware.

```
apps/web/src/app/(platform)/app/[appSlug]/
  ├── layout.tsx              ← Clerk session middleware, theme injection, kiosk mode wrapper
  ├── [...slug]/page.tsx      ← App page renderer (reuses PortalPageRenderer component)
  └── settings/page.tsx       ← App settings (Manager+ only)
```

**Key difference from portal routes:** The `/app/*` route group lives inside `(platform)` — it goes through Clerk middleware. The `/portal/*` route group lives inside `(portal)` — it bypasses Clerk and uses the portal client session system.

**Shared rendering:** Both routes use the same `PageBuilderRenderer` component (factored out from portal rendering). The renderer accepts a `context` prop that determines scoping behavior:

```typescript
interface PageBuilderContext {
  type: 'portal' | 'app';
  tenantId: string;

  // Portal context
  portalClientId?: string;
  linkedRecordId?: string;
  scopingConfig?: PortalScopingConfig;

  // App context
  workspaceUserId?: string;
  workspaceRole?: WorkspaceRole;
  baseFilters?: FilterRule[];
}
```

---

## Cart / Transaction Block

The genuinely new primitive. A stateful container that accumulates items from user interactions, shows running totals, and on "Complete" creates records in target tables.

### Block Type

Category: **Action** (alongside Button, Link, File Download).

Block type identifier: `cart`

### Behavior

The Cart block is a **session-scoped state container**. It accumulates line items during a user's interaction session and commits them as records on completion. Think of it as a multi-record form that builds incrementally from product selections rather than sequential field inputs.

### Cart State (Client-Side)

Cart state lives entirely in client memory (React state via Zustand store) during the session. It is NOT persisted to the server until "Complete Transaction" is triggered. This is intentional:

- **Speed:** Adding items is instantaneous (no network round-trip)
- **Offline:** Cart works without connectivity until payment/completion
- **Atomicity:** The entire transaction commits as one batch, not item-by-item
- **Abandonment:** Abandoned carts leave zero server-side footprint

```typescript
interface CartState {
  items: CartItem[];
  metadata: Record<string, unknown>; // Custom fields (e.g., customer name, table number)
  createdAt: string; // Session start

  // Computed (derived, not stored)
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  itemCount: number;
}

interface CartItem {
  id: string; // Client-generated UUID (for reorder/remove)
  sourceRecordId: string; // Record ID from the product/service table
  name: string; // Display name (from primary field)
  unitPrice: number; // Price at time of add (snapshotted)
  quantity: number; // Default 1, adjustable
  modifiers?: CartItemModifier[]; // Optional (e.g., size, extras, customizations)
  notes?: string; // Free-text per-item notes
  discountPercent?: number; // Per-item discount
  taxRate?: number; // Per-item tax rate (inherited from product or cart default)
}

interface CartItemModifier {
  name: string;
  priceAdjustment: number; // Can be positive (add-on) or negative (discount)
}
```

### Cart Block Config (App Designer)

Configured in the Content tab of the property panel when a Cart block is selected:

```typescript
interface CartBlockConfig {
  // Data binding — which table are items sourced from?
  sourceTableId: string; // Product/service catalog table
  priceFieldId: string; // Currency field for unit price
  nameFieldId?: string; // Defaults to primary field
  imageFieldId?: string; // Attachment field for product thumbnail
  taxRateFieldId?: string; // Number/percent field for per-item tax

  // Cart behavior
  allowQuantityEdit: boolean; // +/- buttons on each line item (default: true)
  allowItemRemove: boolean; // Swipe-to-remove or X button (default: true)
  allowItemNotes: boolean; // Per-item notes field (default: false)
  allowDiscounts: boolean; // Per-item or cart-level discount (default: false)
  defaultTaxRate?: number; // Applied when item has no tax rate field (e.g., 0.08 for 8%)

  // Display
  showItemImages: boolean; // Thumbnail next to each line item (default: true)
  showRunningTotal: boolean; // Sticky total bar at bottom (default: true)
  compactMode: boolean; // Reduced line height for small screens (default: false)

  // Completion
  completionActions: CartCompletionAction[];
}

interface CartCompletionAction {
  type:
    | 'create_order'
    | 'adjust_inventory'
    | 'run_automation'
    | 'generate_document'
    | 'process_payment';
  config: Record<string, unknown>; // Per-action config (see Completion Flow)
}
```

### Adding Items to Cart

Items enter the cart via interaction with other blocks on the same page. The Cart block exposes a page-scoped action: `addToCart(recordId, quantity?)`.

**Trigger patterns:**

| Source Block               | Interaction                              | Result                                                                      |
| -------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Table/List block           | Row click or "Add" button on row         | Adds product record to cart (quantity 1)                                    |
| Table/List block           | "Add" button with quantity input         | Adds product record with specified quantity                                 |
| Barcode scan (Quick Entry) | Scan barcode → record lookup             | Adds matched product to cart (quantity 1), or increments if already in cart |
| Button block               | Configured with `addToCart` action       | Adds a specific record or prompts selection                                 |
| Search/Lookup input        | Type product name → select from dropdown | Adds selected product to cart                                               |

**Duplicate handling:** If a product already in the cart is added again, the existing line item's quantity increments by 1 (or by the specified quantity). This is the expected POS behavior — scanning the same barcode twice means "2 of this item," not two separate line items.

### Completion Flow

When the user triggers "Complete Transaction" (via a Button block configured with `completeCart` action), the following sequence executes as a single server-side batch:

```
1. Validate cart state (non-empty, all prices resolved)
2. If payment required → collect payment first (see Stripe Terminal Integration)
3. Create parent record in target table (e.g., Orders):
   - Auto-number field populated (receipt/transaction number)
   - Total, item count, payment status, timestamp fields populated
   - $me (workspace user) set as created_by
   - Custom metadata fields mapped from cart metadata
4. Create child records in line item table (e.g., Order Items):
   - One record per cart line item
   - Cross-link to parent order via configured link field
   - Product reference, quantity, unit price, line total, modifiers, notes
5. If inventory adjustment configured:
   - For each line item: adjustFieldValue(product.recordId, quantityFieldId, -item.quantity)
   - Uses atomic delta operation (see inventory-capabilities.md > Primitive 1)
6. If automation configured:
   - Emit domain event: `app.transaction_completed`
   - Automation can generate receipt (Smart Doc), send email, update CRM, etc.
7. If document generation configured:
   - Generate receipt/invoice from Smart Doc template with transaction data
8. Clear cart state
9. Show completion confirmation (configurable: receipt summary, "Next Customer" button, auto-reset timer)
```

**Atomicity:** Steps 3–6 execute in a single database transaction. If any step fails, the entire transaction rolls back. Payment (step 2) is collected first but not captured until the database transaction succeeds — uses Stripe's two-step authorization pattern (authorize → capture). If the DB transaction fails after payment authorization, the authorization is voided.

### Cart Offline Behavior

When the device is offline, the cart continues to function for item accumulation (client-side state). Completion behavior depends on whether payment is required:

**No payment required (e.g., warehouse batch, internal order):**

- Completion queues the entire transaction in IndexedDB
- Sync indicator shows amber: "1 pending transaction"
- On reconnection: queue replays, records created, inventory adjusted
- Conflict detection: if a product's quantity went negative during offline, flag for Manager review

**Payment required (POS):**

- Payment cannot be processed offline (Stripe Terminal requires connectivity)
- Cart state preserved in IndexedDB to survive app restarts
- "Process when online" option: queue the transaction, process payment on reconnection
- Alternative: if the Stripe Terminal M2 reader has stored-and-forward capability, leverage that (reader holds encrypted payment data until connectivity returns)

---

## Stripe Terminal Integration

Three integration paths, layered by capability and implementation effort. All three produce the same end result (a successful Stripe PaymentIntent) — they differ in hardware requirements and native code dependencies.

### Path 1: External Reader via JS SDK (Post-MVP — Custom Apps — No Native Code)

The Stripe Terminal JavaScript SDK communicates with external readers over the internet. The reader connects to Stripe's cloud, and the JS SDK orchestrates the payment flow.

**Supported readers:**

- Stripe Reader M2 ($59, Bluetooth, pocket-sized)
- BBPOS WisePOS E ($249, countertop, touchscreen)
- Stripe Reader S700 ($349, Android-based smart terminal)

**Integration point:** The existing Payment block (Post-MVP — Portals & Apps (Fast-Follow), Stripe Elements for online card entry) gains a second mode: "In-Person Payment (Stripe Terminal)." The block's Content tab in the App Designer shows a toggle: "Online Card Entry" | "In-Person Reader."

```typescript
interface PaymentBlockConfig {
  mode: 'online' | 'terminal' | 'both'; // 'both' shows reader first, falls back to manual

  // Online mode (existing Stripe Elements config)
  stripeElements?: {
    /* ... existing config ... */
  };

  // Terminal mode (new)
  stripeTerminal?: {
    locationId: string; // Stripe Terminal Location
    readerDiscovery: 'internet' | 'bluetooth' | 'tap_to_pay';
    tipConfig?: TipConfig;
    receiptConfig?: {
      printReceipt: boolean; // For readers with printers (S700)
      emailReceipt: boolean; // Send via Resend
      showOnScreen: boolean; // Display receipt summary in-app
    };
  };
}
```

**Payment flow (external reader):**

```
1. Cart "Complete" button pressed
2. App creates PaymentIntent server-side (amount from cart total)
3. Stripe Terminal JS SDK discovers connected reader
4. SDK sends PaymentIntent to reader → reader displays "Tap or Insert Card"
5. Customer taps/inserts card on the reader
6. Reader processes payment → result returned to JS SDK
7. On success: proceed with cart completion flow (record creation, inventory adjust)
8. On failure: show error, allow retry or alternative payment method
```

**Stripe Connect integration:** EveryStack uses Stripe Connect. Each workspace's Stripe account is a Connected Account. Terminal readers are registered to the Connected Account's Location. PaymentIntents are created with `on_behalf_of` set to the Connected Account.

### Path 2: Tap to Pay via Capacitor Native Shell (Post-MVP — Native App & Tap to Pay/10 — Requires Native App)

Stripe Terminal's Tap to Pay feature turns the user's phone into a contactless card reader — no external hardware. This requires native SDK access (iOS Terminal SDK or Android Terminal SDK) because the phone's NFC payment antenna is not accessible from web browsers.

**Architecture:** A thin Capacitor native shell wraps the EveryStack web app. The web view renders the entire app UI (built in the App Designer). The native shell exists solely to provide a JavaScript bridge to the Stripe Terminal native SDK for the NFC payment moment.

```
┌─────────────────────────────────────────────────┐
│  Capacitor Native Shell (iOS / Android)          │
│  ┌─────────────────────────────────────────────┐ │
│  │  WebView                                     │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │  EveryStack App (App Designer UI)       │ │ │
│  │  │  Product grid, cart, totals — all web    │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  │                    ↕ JS Bridge                │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │  Capacitor Plugin: Stripe Terminal       │ │ │
│  │  │  - discoverReaders()                     │ │ │
│  │  │  - connectTapToPayReader()               │ │ │
│  │  │  - collectPaymentMethod()                │ │ │
│  │  │  - processPayment()                      │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│  Native: Stripe Terminal iOS/Android SDK          │
│  Native: NFC Entitlement (Apple) / NFC API (Goog)│
└─────────────────────────────────────────────────┘
```

**Capacitor plugin:** A custom Capacitor plugin wrapping the Stripe Terminal React Native SDK (which works in both iOS and Android). The plugin exposes three methods to the web layer:

```typescript
// Capacitor plugin interface (web-side)
interface StripeTerminalPlugin {
  initialize(config: { locationId: string }): Promise<void>;

  collectPayment(params: {
    amount: number; // In smallest currency unit (cents)
    currency: string; // e.g., 'usd'
    paymentIntentClientSecret: string;
  }): Promise<{ status: 'succeeded' | 'failed'; error?: string }>;

  cancelPayment(): Promise<void>;
}
```

**Apple Tap to Pay entitlement process:**

1. Request development entitlement from Apple Developer account
2. Integrate Stripe Terminal iOS SDK with `SCPDiscoveryMethodTapToPay`
3. Test internally with development entitlement
4. Request distribution entitlement (requires Apple review of the app)
5. Submit app to App Store with Tap to Pay capability

**Device requirements:**

- **iOS:** iPhone XS or later, iOS 16.4+ (for PIN entry support), Apple Developer account
- **Android:** NFC-equipped device, Google-certified for Tap to Pay, Android 9+

**Tap to Pay payment flow:**

```
1. Cart "Complete" button pressed (web layer)
2. Web creates PaymentIntent server-side → receives clientSecret
3. Web calls Capacitor bridge: StripeTerminal.collectPayment({ clientSecret, amount, currency })
4. Native layer activates NFC → phone displays "Ready for Payment" animation
5. Customer taps card/phone on the device
6. Stripe Terminal SDK processes contactless payment
7. Result returned via JS bridge to web layer
8. On success: proceed with cart completion flow
```

**Connection to existing Capacitor decision framework:** The Capacitor shell designed in `mobile.md` (2–4 week effort, same codebase in WebView) would include the Stripe Terminal plugin alongside push notifications, biometrics, and other native capabilities. Tap to Pay is an additional trigger for the Capacitor decision — and a compelling one, because "turn your phone into a cash register" is a strong market message.

### Path 3: Stripe Smart Reader (Niche — Dedicated Hardware)

Stripe's S700 reader is an Android-based touchscreen device that can run custom Android apps. EveryStack's app (via Capacitor Android build) could be deployed directly to S700 devices as a dedicated POS terminal.

This is not a priority path but worth noting for businesses that want purpose-built hardware (retail counters, restaurant stations). The S700 handles both UI display and payment processing on a single device.

**Scope:** Post-MVP, demand-driven. No architectural prep needed — the Capacitor Android build is the same artifact that runs on phones/tablets.

### Stripe Terminal Data Model

Stripe Terminal state is managed server-side. Readers, locations, and connections are registered via the Stripe API and cached locally.

```typescript
// Stored in app_config.stripeTerminal (on apps table)
interface StripeTerminalConfig {
  enabled: boolean;
  locationId: string;
  readerType: 'external' | 'tap_to_pay' | 'both';
  tipConfig?: {
    enabled: boolean;
    presets: number[];
    customAllowed: boolean;
  };
}

// Transaction record (written to target table on completion)
// These are standard EveryStack record fields, not a separate table
// The Manager configures which fields map to which transaction data:
//   - stripe_payment_intent_id → Text field
//   - payment_method_type → Single Select (card / contactless / wallet)
//   - card_brand → Single Select (visa / mastercard / amex / discover)
//   - card_last_four → Text field
//   - receipt_url → URL field
//   - terminal_reader_id → Text field (for multi-terminal environments)
```

### PCI DSS Scope

Stripe Terminal keeps EveryStack **out of PCI scope**. Card data is encrypted at the reader (or in the phone's NFC secure element) and transmitted directly to Stripe's servers. EveryStack never sees, stores, or transmits card numbers, CVVs, or PINs. This applies to all three paths.

The only PCI-relevant concern is the Stripe publishable/secret key management, which is already handled by the existing Stripe integration (Post-MVP — Portals & Apps (Fast-Follow)). Terminal-specific keys (Terminal connection tokens) are short-lived and generated server-side per session.

---

## Kiosk Mode

A fullscreen, locked-down mode where the app takes over the screen. No workspace sidebar, no navigation to other parts of EveryStack. Essential for POS terminals, front-desk iPads, warehouse stations, and any device that stays on one screen.

### Behavior

When `app_config.kioskMode = true`:

- Workspace sidebar collapses completely (not 64px icon mode — gone)
- Browser chrome hidden (PWA standalone mode or Capacitor fullscreen)
- No URL bar, no tab switching, no "back to workspace" affordance
- App navigation limited to pages within the app (no escape to workspace)
- Optional auto-lock after inactivity (configurable timeout)
- Optional PIN unlock (4–6 digit PIN, not full re-auth — fast for shift changes)

### Kiosk Layout

```
┌──────────────────────────────────────────────────────────┐
│  [App Name]              [User Badge]  [Lock 🔒]  [⚙️]  │  ← 48px header
├──────────────────────────────────────────────────────────┤
│                                                          │
│  App page content (App Designer blocks)               │
│  Full viewport height and width                          │
│                                                          │
│  Responsive: same breakpoint system as portals           │
│  (desktop / tablet / mobile layouts all work)            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [Optional bottom nav — if app has multiple pages]       │  ← 56px if multi-page
└──────────────────────────────────────────────────────────┘
```

**User Badge:** Shows the currently authenticated workspace user's avatar and first name. Tapping opens a minimal panel: user name, role, "Switch User" (re-auth), "Lock" (PIN lock without sign-out). In a multi-employee POS scenario, "Switch User" is how shift changes work — the next cashier taps "Switch User," authenticates via Clerk, and the app continues with the new user's `$me` context.

**Settings gear (⚙️):** Manager+ only. Opens app settings overlay: Stripe Terminal reader connection status, printer setup, display preferences. Hidden for Team Members and Viewers.

### Kiosk Auto-Lock

When configured, the app locks after N seconds of inactivity (no taps, no scans, no keyboard input). The lock screen shows:

- App name and logo
- PIN input (numeric keypad, 4–6 digits)
- "Sign In As Different User" link (full Clerk re-auth)

PIN is per-app, not per-user. Set by the Manager in app settings. Stored as bcrypt hash in `app_config.kioskAutoLock.pinHash`. This is a convenience lock to prevent casual use by passers-by, not a security boundary — the workspace session (Clerk) is the real auth layer.

---

## App Creation Flow

Mirrors the portal creation wizard but with permission-based setup instead of identity-based scoping.

### Step 1: Choose a Starting Point

Template cards grid — POS Terminal, Front Desk Kiosk, Warehouse Station, Dispatch Board, Time Clock, Start from Scratch, AI-Generated (Opus, 20 credits).

### Step 2: Connect to Data

1. **Pick a base and table.** Same table picker as portal creation. For multi-table apps (e.g., POS with Products + Orders + Order Items), the wizard suggests related tables via cross-links.
2. **No scoping field.** Apps don't need identity-based scoping. Instead, optional page-level base filters are suggested (e.g., "Show only products where Status = Active").

### Step 3: Access & Mode

1. **Who can access this app?** Role minimum (e.g., Team Member and above) or specific user list.
2. **Kiosk mode?** Toggle. If enabled: inactivity timeout and PIN setup.
3. **In-person payments?** Toggle. If enabled: Stripe Terminal connection setup (location, reader type).

### Step 4: Name and Theme

Same as portal: name, URL slug (auto-generated), theme gallery, logo upload.

Hit Create → land in the App Designer with template pre-built.

---

## App Navigation in Workspace

**Workspace-level Apps page:** Lives alongside the existing Portals page in the top-level sidebar nav. Shows all apps as cards with name, status badge (Draft/Published), thumbnail, primary table, last edited. Filter tabs: All, Published, Drafts. `[+ New App]` button.

**Alternative: Combined Portals & Apps page.** A single "Portals & Apps" sidebar item with sub-tabs: Portals | Apps. This avoids sidebar bloat. The `type` column on the `apps` table naturally segments the two.

**Recommendation:** Combined page with sub-tabs. One sidebar item, clear separation inside. Ships cleaner.

---

## App-Specific Block Enhancements

Beyond the Cart block (detailed above), several existing portal blocks gain app-specific behavior:

### Payment Block — Terminal Mode

The existing Payment block (Post-MVP — Portals & Apps (Fast-Follow), Stripe Elements) gains Terminal support when used in an app context. Content tab shows "Payment Method" selector:

- **Online Card Entry** — existing Stripe Elements behavior
- **In-Person Reader** — Stripe Terminal external reader
- **Tap to Pay** — Stripe Terminal Tap to Pay (requires Capacitor)
- **Auto** — attempts Tap to Pay → falls back to external reader → falls back to online entry

### Quick Entry Block

The Quick Entry mode (designed in `tables-and-views.md`, referenced in `inventory-capabilities.md`) is already compatible with the App Designer. In the app context, Quick Entry becomes a first-class block type in the block library — not just a Table View mode.

Block type identifier: `quick_entry`

Config mirrors the existing Quick Entry configuration:

- `lookup_field_id`: barcode or text field for search/scan
- `target_table_id`: table for new record creation
- `default_values`: pre-filled fields per entry
- `visible_fields[]`: minimal field set displayed
- `quantity_field_id`: optional quantity input
- `session_tracking`: entry count and session totals

**Integration with Cart:** When a Quick Entry block and a Cart block exist on the same page, a scan that matches a product record can auto-add to cart instead of (or in addition to) creating a stock movement record. The Quick Entry block config gains: `cartIntegration: boolean` — when true, matched records route to the Cart block's `addToCart` action.

### Timer Widget Block

The time tracking timer widget (Post-MVP — Agency Features, `agency-features.md`) can be embedded as a block in app pages. Use case: a time clock app where employees clock in/out from a kiosk.

Block type identifier: `timer_widget`

Config: `targetTableId` (time_entries table), `userFieldId` (who is clocking in), `projectFieldId` (optional), `displayMode: 'clock_in_out' | 'running_timer'`.

---

## Audit Trail for App Actions

App actions use the standard workspace `actor_type: 'user'` in the audit system (unlike portals which use `actor_type: 'portal_client'`). The audit log captures additional app context:

```typescript
await writeAuditLog(tx, {
  tenantId,
  actorType: 'user',
  actorId: workspaceUserId,
  action: 'transaction.completed',
  entityType: 'record',
  entityId: orderRecord.id,
  details: {
    appId: app.id,
    appSlug: app.slug,
    transactionTotal: cart.total,
    lineItemCount: cart.items.length,
    paymentMethod: 'stripe_terminal_tap_to_pay',
    stripePaymentIntentId: paymentIntent.id,
  },
  traceId,
});
```

New audit action types for apps: `transaction.completed`, `transaction.voided`, `cart.abandoned` (if tracking is enabled), `kiosk.locked`, `kiosk.unlocked`, `kiosk.user_switched`.

---

## Caching & Performance

Apps reuse the portal three-tier caching infrastructure (`app-designer.md` > Caching Infrastructure) with one modification: app pages are always authenticated (Clerk session), so CDN edge caching is `Cache-Control: private, no-store`. Redis application cache keys include the workspace user ID:

`cache:app:{appId}:{pageId}:{userId}`

TTLs match portal data-bound content: 60s for data blocks, 300s for static blocks. Cart state is never cached (client-side only).

**Performance targets for POS interactions:**

| Interaction                         | Target            | Measurement                                     |
| ----------------------------------- | ----------------- | ----------------------------------------------- |
| Add item to cart (scan/tap)         | < 100ms perceived | Client-side state update, no network            |
| Cart total recalculation            | < 50ms            | Client-side computation                         |
| Product search (type-ahead)         | < 200ms           | Redis-cached product list + client-side filter  |
| Complete transaction (no payment)   | < 500ms           | Server batch: create records + inventory adjust |
| Complete transaction (with payment) | < 3s + tap time   | PaymentIntent creation + reader interaction     |
| Kiosk unlock (PIN)                  | < 200ms           | Client-side bcrypt verify                       |

---

## Redis Key Patterns (New)

| Prefix Pattern                        | Usage                                    | Has TTL?                  | Eviction Behavior |
| ------------------------------------- | ---------------------------------------- | ------------------------- | ----------------- |
| `cache:app:{appId}:{pageId}:{userId}` | App page data cache                      | **Yes** (60s)             | LRU evictable     |
| `app:kiosk:{appId}:lock`              | Kiosk lock state                         | **Yes** (matches timeout) | Self-expiring     |
| `app:terminal:{appId}:connection`     | Stripe Terminal reader connection status | **Yes** (300s)            | Self-expiring     |

---

## Plan Limits

Apps count against the existing app limit on each plan. The `apps` table `type` column distinguishes app types — a workspace with a Starter plan ($79) has 5 total apps (portals + internal apps + websites + forms + widgets).

| Plan         | Max Apps  | Notes         |
| ------------ | --------- | ------------- |
| Freelancer   | 1         | 1 of any type |
| Starter      | 5         | Any mix       |
| Professional | 15        | Any mix       |
| Business     | Unlimited | —             |
| Enterprise   | Unlimited | —             |

Page view tracking applies equally to app page loads. Apps in kiosk mode may generate high page view counts from a single device — plan limits should account for this. Consider: kiosk mode page views count at 10% weight (1 kiosk view = 0.1 page views toward the limit) since they represent a single device, not distribution reach.

---

## MVP Feature Split (All Post-MVP per GLOSSARY.md)

> **⚠️ POST-MVP.** All phases below are post-MVP per GLOSSARY.md. The "MVP" label in Post-MVP — Custom Apps refers to the MVP of custom apps specifically, not the platform MVP.

**Post-MVP — Custom Apps (Custom Apps MVP — post-platform-MVP):**

- `apps.type` column (extends to `'app'`), `apps.app_config` JSONB
- App route group (`/app/{appSlug}/*`) with Clerk middleware
- `PageBuilderRenderer` context branching (portal vs app scoping)
- App creation wizard (templates, permission setup, kiosk toggle)
- Permission-based data scoping (workspace roles + `$me` base filters)
- Cart/Transaction block (client-side state, batch completion, inventory adjustment)
- Kiosk mode (fullscreen, auto-lock, PIN unlock, user switching)
- Payment block Terminal mode (Stripe Terminal JS SDK + external readers)
- App audit logging (new action types)
- Workspace "Portals & Apps" combined nav page
- POS Starter Template (Products table + Orders + Order Items + Cart + Payment + Receipt automation)

**Post-MVP — Native App & Tap to Pay / Post-MVP — Self-Hosted AI (Tap to Pay):**

- Capacitor native shell (if not already triggered by mobile.md decision framework)
- Capacitor plugin: Stripe Terminal native SDK bridge
- Tap to Pay integration (iOS + Android)
- Apple Tap to Pay entitlement process
- App Store submission (iOS + Google Play)
- Kiosk-specific Capacitor features (prevent app switching, guided access mode hints)

**Deferred (demand-driven):**

- Stripe Smart Reader (S700) deployment
- Receipt printer integration (ESC/POS protocol via Capacitor plugin or Web Serial API)
- Cash drawer integration
- Kitchen display system (KDS) — second-screen order display
- Multi-terminal sync (real-time cart sharing for split service)
- Stored-and-forward offline payments
- Tip adjustment post-authorization

---

## Phase Implementation Summary (All Post-MVP)

| Phase                                                  | Custom Apps Work                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Post-MVP (Post-MVP — Portals & Apps (Initial))**     | App Designer ships (post-MVP per GLOSSARY.md). Block model, canvas, themes, container rules — all reusable for apps. No app-specific work yet.                                  |
| **Post-MVP (Post-MVP — Portals & Apps (Fast-Follow))** | Stripe Elements payment block. Stripe Terminal JS SDK support added here as a stretch goal (external reader only).                                                              |
| **Post-MVP (Post-MVP — Inventory Advanced)**           | Quick Entry mode and Inventory Starter Template ship. Barcode scanning compatible with App Designer. Atomic quantity operations proven. These are direct app prerequisites.     |
| **Post-MVP (Post-MVP — Custom Apps)**                  | **Custom Apps MVP.** `apps.type` column for Internal Apps. App routes. Permission-based scoping. Cart/Transaction block. Kiosk mode. External reader POS. POS Starter Template. |
| **Post-MVP (Post-MVP — Native App & Tap to Pay/10)**   | **Tap to Pay.** Capacitor shell. Stripe Terminal native SDK plugin. Apple/Google entitlement. App store submission.                                                             |

---

## Starter Templates

### POS Terminal Template

Pre-built app with two pages:

**Page 1: Register (default)**

```
┌─────────────────────────────────┬──────────────────────┐
│  [🔍 Search / Scan]             │  Cart                │
│  ─────────────────────────────  │  ┌────────────────┐  │
│  Product Grid (Table/List)      │  │ Item 1    $5.00│  │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  │ Item 2    $3.50│  │
│  │ 🍕   │ │ 🥤   │ │ 🍰   │   │  │ Item 3   $12.00│  │
│  │$12.00│ │$3.50 │ │$5.00 │   │  ├────────────────┤  │
│  └──────┘ └──────┘ └──────┘   │  │ Subtotal $20.50│  │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  │ Tax (8%)  $1.64│  │
│  │ 🥗   │ │ ☕   │ │ 🧁   │   │  │ Total    $22.14│  │
│  │$8.50 │ │$4.00 │ │$3.00 │   │  ├────────────────┤  │
│  └──────┘ └──────┘ └──────┘   │  │ [💳 Charge]    │  │
│                                 │  │ [🗑️ Clear]     │  │
│  [Category Tabs: All|Food|Drink]│  └────────────────┘  │
└─────────────────────────────────┴──────────────────────┘
```

Layout: Row block → two Columns (8+4 grid split). Left column: Quick Entry block (barcode scanner) + Table/List block (products, grid display with images). Right column: Cart block + Payment button + Clear button.

**Page 2: Transaction History**

Table/List block showing completed orders. Filters: today's orders by default, `$me` as cashier. Columns: order number, time, item count, total, payment method.

**Template creates:**

- Products table (name, price, category, barcode, image, quantity_on_hand)
- Orders table (order_number auto-number, total, tax, payment_status, payment_method, cashier cross-link to Users, stripe_payment_intent_id, receipt_url, timestamp)
- Order Items table (order cross-link, product cross-link, quantity, unit_price, line_total)
- Automation: On transaction.completed → adjust product quantity_on_hand (atomic decrement)
- Automation: On transaction.completed → generate receipt Smart Doc (if configured)

### Front Desk Kiosk Template

Two pages: Check-In (customer-facing, large touch targets) and Dashboard (staff-facing, appointment list + walk-in queue).

### Warehouse Station Template

Single page: Quick Entry block (full-width scan area) + running log of received items + session totals. Optimized for the receiving workflow from `inventory-capabilities.md`.
