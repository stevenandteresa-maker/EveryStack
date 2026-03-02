# EveryStack — Vertical Product Architecture

> **Reference doc (Tier 3).** Architecture guide for building branded vertical products powered by the EveryStack platform engine. Covers the product family model, three-layer architecture, B2B and B2C vertical patterns, separation boundaries, integration points, provisioning, data flow patterns, vertical evaluation criteria, and build sequence. Strategy and architecture — not implementation spec. For Platform API details, see `platform-api.md`.
> Cross-references: `platform-api.md` (API spec — Data, Schema, Provisioning, AI endpoints), `GLOSSARY.md` (source of truth — terminology, MVP scope, naming discipline), `data-model.md` (core schema, canonical JSONB, tenant isolation), `portals.md` (Quick Portals — MVP; App Portals — post-MVP via App Designer), `automations.md` (triggers, actions, inbound/outbound webhook architecture), `ai-architecture.md` (AIService, capability tiers, prompt registry, MCP), `ai-metering.md` (credit system, per-tenant budgets), `cross-linking.md` (cross-platform record relationships), `smart-docs.md` (document generation, merge tags, Gotenberg), `email.md` (transactional email via Resend), `permissions.md` (5-tier role model), `audit-log.md` (6-source attribution), `realtime.md` (Redis pub/sub event bus, room model), `compliance.md` (GDPR, API key security, RLS), `settings.md` (workspace settings), `forms.md` (Quick Forms — MVP), `sync-engine.md` (canonical JSONB, Field Type Registry), `schema-descriptor-service.md` (SDS), `booking-scheduling.md` (post-MVP), `app-designer.md` (post-MVP — App Portals, Apps), `agency-features.md`, `files.md` (upload pipeline, S3/R2 storage)
> Last updated: 2026-02-28 — Initial version.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                          | Lines   | Covers                                                                     |
| -------------------------------- | ------- | -------------------------------------------------------------------------- |
| Strategic Overview               | 29–76   | Product family model, horizontal platform + branded verticals              |
| Three-Layer Architecture         | 77–130  | Vertical Application → Domain Data → EveryStack Engine                     |
| B2B Branded Verticals            | 131–202 | Auth via service API keys, provisioning flow, industry templates           |
| B2C Direct Products              | 203–271 | Single-tenant model, heavy domain services, consumer UX                    |
| Separation Boundaries            | 272–335 | Code, data, integration — 3 separation layers                              |
| Platform Reuse Matrix            | 336–364 | Capability → reference doc mapping with MVP status                         |
| What Verticals Must Build        | 365–388 | Domain logic, custom UI, onboarding — what the platform does not provide   |
| Data Flow Patterns               | 389–472 | 3 patterns: vertical creates record, EveryStack notifies, B2B provisioning |
| Vertical Evaluation Criteria     | 473–517 | Leverage scoring, checklist, ranked candidates by tier                     |
| Build Sequence                   | 518–544 | 4-phase vertical development plan                                          |
| Architectural Decisions — Record | 545–555 | ADR-style decisions with rationale                                         |

---

## Strategic Overview

EveryStack is both a product and a platform engine. As a product, it serves power users who want full control over their data architecture. As an engine, it powers a family of branded vertical products — each with its own UI, brand, and customer base. End customers of vertical products never see EveryStack.

### Product Family

```
┌────────────────────────────────────────────────────────────┐
│                      PRODUCT FAMILY                        │
│                                                            │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────┐  │
│  │  EveryStack  │  │ B2B Branded    │  │ B2C Direct    │  │
│  │              │  │ Verticals      │  │ Products      │  │
│  │  Horizontal  │  │                │  │               │  │
│  │  platform    │  │ Ready-to-use   │  │ Consumer apps │  │
│  │  for power   │  │ industry tools │  │ you operate   │  │
│  │  users       │  │ for businesses │  │ directly      │  │
│  └──────┬───────┘  └───────┬────────┘  └──────┬────────┘  │
│         │                  │                   │           │
│   EveryStack UI      Own branded UI      Own branded UI    │
│   (only product      (Platform API)      (Platform API +   │
│    where users                            domain services) │
│    see EveryStack)                                         │
├─────────┴──────────────────┴───────────────────┴───────────┤
│                                                            │
│                EVERYSTACK PLATFORM ENGINE                   │
│                                                            │
│  Platform API · Canonical JSONB · Multi-tenancy · RLS      │
│  Automations · Doc Gen · AIService · Cross-Links · Portals │
│  Permissions · Audit · Forms · Sync Engine · Files · Comms │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Three Product Tiers

| Tier                                 | Customer                                | Experience                                  | Custom Layer                                        | Examples                                                         |
| ------------------------------------ | --------------------------------------- | ------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| **Horizontal platform** (EveryStack) | Power users, agencies, ops teams        | Flexible, build-your-own                    | None — this is the engine itself                    | EveryStack                                                       |
| **B2B branded vertical**             | Businesses wanting ready-made solutions | Opinionated, zero-setup, industry templates | Thin — branded UI, provisioning, templates          | Trade services management, property management, agency dashboard |
| **B2C direct product**               | End consumers                           | Fully bespoke consumer experience           | Thick — custom frontend + domain services + content | Exam prep platform, tutoring centre                              |

**B2B verticals** are platforms that other businesses subscribe to. You build the platform; businesses pay to run their operations on it. A plumber signs up for a trade services product, gets a dispatch board and customer portal — never sees EveryStack.

**B2C products** are businesses you operate directly. You own the customer relationship, the content, and the brand. Students sign up for your exam prep product — EveryStack is invisible infrastructure.

---

## Three-Layer Architecture

Every vertical product follows a three-layer architecture. The vertical sits _above_ EveryStack, never _inside_ it.

```
┌──────────────────────────────────────────────────────┐
│              VERTICAL APPLICATION LAYER               │
│                                                      │
│  Custom Frontend · Custom Auth · Domain Services     │
│  Provisioning (B2B) · Content (B2C) · Onboarding    │
│                                                      │
│  Communicates via Platform API only — never           │
│  bypasses to write directly to the database.          │
├──────────────────────────────────────────────────────┤
│                DOMAIN DATA LAYER                      │
│                                                      │
│  Standard EveryStack Tables, Fields, and Records     │
│  stored in canonical_data JSONB. Domain-specific     │
│  structure, platform-standard storage.               │
│                                                      │
│  From EveryStack's perspective: a well-structured    │
│  Tenant's data. Nothing special.                     │
├──────────────────────────────────────────────────────┤
│              EVERYSTACK PLATFORM ENGINE               │
│                                                      │
│  Platform API · Canonical JSONB · Cross-Links        │
│  Automations · Doc Gen · AIService · Quick Portals   │
│  Quick Forms · Multi-tenancy · Permissions · Audit   │
│  Sync Engine · Files · Realtime · Record Thread      │
│  Chat / DMs · Email                                  │
└──────────────────────────────────────────────────────┘
```

### Layer 1: Vertical Application

Everything the end customer sees. Entirely custom — EveryStack provides no UI here.

- **Custom frontend** — branded web/mobile application. Consumes the Platform API exclusively.
- **Custom auth** — vertical users authenticate through the vertical's own system, never through Clerk/EveryStack. The vertical backend uses service-level API keys to talk to the Platform API on their behalf.
- **Domain services** — industry-specific logic (dispatching, assessment, matching). Standalone services that read/write EveryStack data via the Platform API.
- **Provisioning** (B2B) — creates and configures Tenants via the Schema/Provisioning API when customers sign up.

### Layer 2: Domain Data

The vertical's data, stored in standard EveryStack Tables using `records.canonical_data` JSONB. No custom database tables, no schema modifications. All domain structure is expressed through EveryStack's primitives: Tables, Fields (typed via Field Type Registry), Cross-Links, and canonical JSONB.

A trade services vertical has Tables for Customers, Jobs, Technicians, Invoices — stored identically to how any EveryStack customer would structure their data. From the platform engine's perspective, this Tenant is indistinguishable from any other.

### Layer 3: EveryStack Platform Engine

Shared infrastructure available to all products through the Platform API. See §Platform Reuse Matrix below for the full mapping.

---

## B2B Branded Verticals

### Architecture

```
┌────────────────────────────────────────────────────────┐
│               BRANDED VERTICAL (e.g. JobStack)          │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Branded Frontend                                │  │
│  │  Dispatch board · Job tracker · Customer list    │  │
│  │  Invoicing · Customer portal (white-labeled)     │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                              │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │  Vertical Backend                                │  │
│  │  Own auth · Provisioning service                 │  │
│  │  Industry templates · Onboarding wizard          │  │
│  │  Domain services (dispatching, scheduling)       │  │
│  └──────────────────────┬───────────────────────────┘  │
│                    Platform API                         │
├─────────────────────────┴──────────────────────────────┤
│                EVERYSTACK ENGINE                        │
└────────────────────────────────────────────────────────┘
```

### Auth (B2B)

```
Vertical customer (plumber@acmeplumbing.com)
    → authenticates via vertical's own auth system
    → vertical backend maps user to EveryStack Tenant
    → vertical backend calls Platform API with service API key
    → Platform API authenticates key, resolves tenant_id, enforces RLS
    → response flows back through vertical backend to customer
```

The vertical backend is a trusted service. It authenticates to the Platform API using service-level API keys — per-Tenant, with scoped permissions. The Platform API never sees or manages the vertical's end users. User-to-Tenant mapping is the vertical backend's responsibility.

**Audit:** API calls record `actor_type: 'api_key'` in the audit log. The vertical backend can pass an `X-Actor-Label` header for human-readable context (e.g., "JobStack: plumber@acmeplumbing.com"), but EveryStack does not validate this — it's metadata for readability. See `audit-log.md`, `platform-api.md`.

### Provisioning (B2B)

When a new customer signs up, the provisioning service creates their EveryStack Tenant and populates it from an industry template:

1. **Create Tenant** → `POST /api/v1/tenants` → returns `tenant_id` + admin API key
2. **Create Workspace(s)** → `POST /api/v1/workspaces` (e.g., "Acme Plumbing Operations")
3. **Create Tables with Fields** → `POST /api/v1/workspaces/{workspaceId}/tables` (inline fields), `POST /api/v1/tables/{tableId}/fields` (individual fields)
4. **Create Cross-Links** → `POST /api/v1/cross-links` (Jobs ↔ Customers, Jobs ↔ Technicians, Invoices ↔ Jobs)
5. **Create Automations** → `POST /api/v1/workspaces/{workspaceId}/automations` (job completed → invoice email, new job → notify technician)
6. **Create Document Templates** → `POST /api/v1/workspaces/{workspaceId}/document-templates` (invoice, quote, job summary)
7. **Create Quick Portal configs** → `POST /api/v1/workspaces/{workspaceId}/portals` (customer-facing job status portal)
8. **Create Quick Form configs** → `POST /api/v1/workspaces/{workspaceId}/forms` (service request form)

The provisioning service is entirely the vertical's code. The Platform API provides endpoints; the vertical decides what structure to create. This is the same API any EveryStack customer or integration could use — nothing vertical-specific about it.

### Industry Templates

B2B verticals offer multiple templates for sub-industries. Templates are configuration stored in the vertical's codebase, applied via the Schema/Provisioning API during onboarding.

**Example: Trade services vertical with per-industry templates**

| Template | Tables                                                               | Key Automations                                       | Quick Portal                         |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| Plumbing | Customers, Jobs, Technicians, Inventory, Invoices                    | Job assignment, parts tracking, invoice on completion | Customer job status + history        |
| HVAC     | Customers, Jobs, Technicians, Equipment, Service Contracts, Invoices | Seasonal maintenance reminders, warranty tracking     | Customer equipment + service history |
| Cleaning | Customers, Properties, Schedules, Cleaners, Invoices                 | Recurring schedule generation, checklist creation     | Customer schedule + reports          |

All templates run on the same vertical frontend and backend — only the EveryStack data structure differs.

---

## B2C Direct Products

### Architecture

```
┌────────────────────────────────────────────────────────┐
│               B2C PRODUCT (e.g. FluentEdge)             │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Consumer Frontend                               │  │
│  │  Practice dashboard · Session player             │  │
│  │  Progress charts · AI feedback display           │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                              │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │  Domain Services (heavy, industry-specific)      │  │
│  │  Voice Engine · Assessment Engine                │  │
│  │  Adaptive Practice · Content Management          │  │
│  └──────────────────────┬───────────────────────────┘  │
│                    Platform API                         │
├─────────────────────────┴──────────────────────────────┤
│                EVERYSTACK ENGINE                        │
└────────────────────────────────────────────────────────┘
```

### How B2C Differs from B2B

| Dimension                    | B2B Vertical                                                   | B2C Product                                                        |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Tenancy model**            | One Tenant per customer business                               | One Tenant for the entire product (or per region/scale unit)       |
| **Custom code volume**       | Thin — provisioning + templates + light domain services        | Thick — consumer frontend + heavy domain services + content        |
| **Platform API usage**       | Schema/Provisioning (onboarding) + Data (operations)           | Primarily Data API (high-volume reads/writes from domain services) |
| **EveryStack features used** | Automations, Doc Gen, Quick Portals, Quick Forms — all heavily | Automations, Doc Gen, AIService — selectively (frontend is custom) |
| **Content**                  | None — the customer brings their own data                      | You create and manage domain content                               |
| **Time to build**            | Weeks to low months                                            | Months (significant custom engineering)                            |

### Auth (B2C)

Same principle as B2B — consumers never authenticate through EveryStack:

```
Consumer (student@example.com)
    → authenticates via product's own auth system
    → product backend uses service API key for the product's Tenant
    → Platform API authenticates key, resolves tenant_id
    → response flows back to consumer
```

**Key difference from B2B:** A B2C product typically has a single EveryStack Tenant (or a small number for scale/regional reasons) rather than one Tenant per customer. All consumers are Records within that Tenant's Tables, not separate Tenants.

### Data Architecture (B2C)

```
Tenant: "FluentEdge" (single Tenant for the entire product)
├── Workspace: "Platform Operations"
│   ├── Table: Students
│   │   └── Fields: name, email, target_exam, current_level, subscription_status, ...
│   ├── Table: Sessions
│   │   └── Fields: student (Cross-Link), date, duration, exam_type, transcript, scores, ...
│   ├── Table: Content Library
│   │   └── Fields: exam_type, part, topic, difficulty, prompt_text, model_answer, ...
│   └── Table: Practice Plans
│       └── Fields: student (Cross-Link), week, focus_areas, recommended_sessions, ...
```

All data in `records.canonical_data` JSONB. Cross-Links connect Students ↔ Sessions ↔ Practice Plans. Automations trigger on record creation to send feedback emails and generate progress reports. Standard EveryStack data model — nothing special.

---

## Separation Boundaries

Three non-negotiable boundaries keep verticals cleanly separated from the EveryStack engine.

### Boundary 1: Code

Vertical code lives in a separate repository. It never modifies EveryStack's core code. It never imports from EveryStack's internal packages. It communicates exclusively through the Platform API and webhook payloads.

```
everystack/                          # Platform engine (monorepo)
├── apps/
│   ├── web/                         # EveryStack web app (includes Platform API Route Handlers)
│   ├── worker/                      # BullMQ job processors
│   └── realtime/                    # Socket.io server
├── packages/
│   └── shared/                      # Shared utilities, types, DB
│
jobstack/                            # B2B vertical (separate repo)
├── apps/
│   ├── web/                         # JobStack branded frontend
│   └── api/                         # JobStack backend (auth, provisioning)
├── templates/                       # Industry templates (config)
│   ├── plumbing/
│   ├── hvac/
│   └── cleaning/
└── services/                        # Domain services
    └── dispatching/

fluentedge/                          # B2C product (separate repo)
├── apps/
│   ├── web/                         # Consumer frontend
│   └── api/                         # Product backend
└── services/                        # Domain services
    ├── voice-engine/
    ├── assessment-engine/
    └── adaptive-practice/
```

**Rule:** If you're tempted to share code between the engine and a vertical via a package import, that's a signal the capability should be exposed through the Platform API instead.

### Boundary 2: Data

Domain data lives in standard EveryStack Tables. No custom database tables, no direct database writes. All domain data uses `records.canonical_data` JSONB.

**Rule:** The vertical never bypasses the Platform API to write directly to PostgreSQL. All data flows through EveryStack's data layer, which enforces Tenant isolation (RLS), Permissions, Audit logging, and Sync. Direct database writes break every guarantee the platform provides.

### Boundary 3: Integration

Verticals use the same integration points available to any EveryStack customer or third-party integration:

| Integration Point               | Usage                                                                           | Reference                                   |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| **Platform API — Data**         | CRUD on Records, query Tables with filters/sorts                                | `platform-api.md`                           |
| **Platform API — Schema**       | Read Table/Field structure, SDS for AI context                                  | `platform-api.md`                           |
| **Platform API — Provisioning** | Create Tenants, Workspaces, Tables, Fields, Automations (B2B onboarding)        | `platform-api.md`                           |
| **Platform API — AI**           | Consume AIService for domain-specific AI tasks, metered per Tenant              | `platform-api.md`, `ai-architecture.md`     |
| **Outbound webhooks**           | EveryStack notifies vertical services of events (Record created, Field changed) | `automations.md` §Webhook Architecture      |
| **Inbound webhooks**            | External services trigger Automations (session completed, score calculated)     | `automations.md` §Inbound Webhook Receiving |
| **Automation recipes**          | Pre-built Automation configs importable into Workspaces                         | `automations.md`                            |
| **Document Templates**          | Pre-built merge-tag templates for industry documents                            | `smart-docs.md`                             |

**Rule:** There are no vertical-specific integration points. The Platform API serves all consumers equally — verticals, third-party integrations, and customer scripts use the same endpoints.

---

## Platform Reuse Matrix

What EveryStack already provides, mapped to common vertical needs. Vertical-agnostic — applies to trade services, property management, agency dashboards, education, and any other domain.

| Vertical Need                                            | EveryStack Capability                                                        | MVP      | Reference                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | -------------------------------------- |
| Customer/client data management                          | Tables + Fields (typed) + canonical JSONB                                    | ✅       | `data-model.md`, `sync-engine.md`      |
| Entity relationships (customer ↔ job ↔ invoice)          | Cross-Links (any Table to any Table, across Workspaces)                      | ✅       | `cross-linking.md`                     |
| Customer-facing status view                              | Quick Portals (Record View + auth wrapper)                                   | ✅       | `portals.md`                           |
| Data collection from customers/public                    | Quick Forms (Record View layout for record creation)                         | ✅       | `forms.md`                             |
| Automated emails, notifications, updates                 | Automations (6 triggers, 7 actions including Send Email, Send Webhook)       | ✅       | `automations.md`                       |
| Document generation (invoices, reports, contracts)       | Document Generation (merge tags + Gotenberg → PDF)                           | ✅       | `smart-docs.md`                        |
| AI-powered features (summarization, drafts, suggestions) | AIService (capability tiers, prompt registry, credit metering)               | ✅       | `ai-architecture.md`, `ai-metering.md` |
| Schema-aware AI context                                  | Schema Descriptor Service (SDS)                                              | ✅       | `schema-descriptor-service.md`         |
| Role-based access control                                | 5-tier Permissions (Owner / Admin / Member → Manager / Team Member / Viewer) | ✅       | `permissions.md`                       |
| Audit trail                                              | Audit Log (6-source: user, automation, sync, system, api_key, portal_client) | ✅       | `audit-log.md`                         |
| Tenant isolation and security                            | Multi-tenancy + RLS + encryption at rest/in transit                          | ✅       | `data-model.md`, `compliance.md`       |
| Event-driven integration                                 | Inbound + outbound webhooks                                                  | ✅       | `automations.md` §Webhook Architecture |
| File storage                                             | Files (S3/R2, presigned URLs, image processing, virus scanning)              | ✅       | `files.md`                             |
| Real-time updates                                        | Socket.io + Redis pub/sub event bus                                          | ✅       | `realtime.md`                          |
| Rich multi-page customer portals                         | App Designer + App Portals                                                   | Post-MVP | `app-designer.md`                      |
| Appointment scheduling                                   | Booking/Scheduling                                                           | Post-MVP | `booking-scheduling.md`                |
| Data visualization / charts                              | Chart Blocks (within App Designer)                                           | Post-MVP | `chart-blocks.md`                      |
| Analytical queries                                       | DuckDB context layer                                                         | Post-MVP | `duckdb-context-layer-ref.md`          |

**Reuse estimate:** A typical B2B vertical leverages 70–90% of its infrastructure from EveryStack. B2C products with heavy domain services leverage 50–70%.

---

## What Verticals Must Build

### Every Vertical

1. **Branded frontend.** EveryStack's UI is not exposed to vertical customers. Every vertical needs its own application with its own design system, navigation, and terminology.

2. **Auth wrapper.** Vertical manages its own user authentication. Backend communicates with Platform API using service-level API keys.

3. **User-to-Tenant mapping.** Vertical backend maps its users to the correct EveryStack Tenant. B2B: one-to-one (one customer = one Tenant). B2C: many-to-one (many users = one Tenant, record-level scoping).

### B2B Verticals Additionally

4. **Provisioning service.** Creates and configures Tenants when customers sign up. Calls Schema/Provisioning API. Stores industry templates as configuration.

5. **Template library.** Table structures, Field types, Automations, Quick Portal layouts, Document Templates — the out-of-box experience per sub-industry.

### B2C Products Additionally

6. **Domain services.** Industry-specific logic that doesn't belong in a general-purpose platform. Voice engines, assessment systems, matching algorithms, financial calculators. Standalone services communicating via Platform API.

7. **Content.** Domain content (exam prompts, course materials, knowledge bases) that lives in EveryStack Tables but is created and curated by the product operator.

---

## Data Flow Patterns

### Pattern 1: Vertical Creates a Record

A domain service completes work and writes results to EveryStack.

```
Domain service finishes processing (e.g., scores an assessment)
    │
    ├─► POST /api/v1/tables/{tableId}/records
    │   Body: { fields: { student: recordId, score: 85, transcript: "..." } }
    │
    ▼
EveryStack creates Record (canonical_data JSONB)
    │
    ├── Audit log: actor_type 'api_key'
    ├── Automation: "Record Created" trigger fires
    │   ├── Action: Send Email (feedback to student)
    │   ├── Action: Update Record (aggregate score on student profile)
    │   └── Action: Send Webhook (notify adaptive practice service)
    └── Real-time event published to Redis room
```

### Pattern 2: EveryStack Notifies a Vertical Service

An event inside EveryStack triggers external processing.

```
Customer submits a Quick Form (service request)
    │
    ▼
Automation: "Form Submitted" trigger fires
    │
    ├── Action: Create Record (new job in Jobs Table)
    ├── Action: Send Email (confirmation to customer)
    └── Action: Send Webhook → vertical dispatching service
        │
        ▼
    Dispatching service receives webhook payload
        │
        ├── Queries available technicians via Platform API
        │   GET /api/v1/tables/{techTableId}/records?filter=available:true
        │
        ├── Runs dispatching algorithm (domain logic)
        │
        └── Assigns technician via Platform API
            PATCH /api/v1/tables/{jobTableId}/records/{jobId}
            Body: { fields: { assigned_technician: techRecordId, status: "assigned" } }
```

### Pattern 3: B2B Provisioning

A new business customer signs up and gets a fully configured Tenant.

```
Customer completes sign-up on vertical's website
    │
    ▼
Vertical provisioning service activates
    │
    ├── Selects industry template (e.g., "plumbing")
    │
    ├── Creates Tenant → Platform API
    ├── Creates Workspace → Platform API
    ├── Creates Tables + Fields (from template) → Platform API
    ├── Creates Cross-Links → Platform API
    ├── Creates Automations (from recipe library) → Platform API
    ├── Creates Document Templates → Platform API
    ├── Creates Quick Portal config → Platform API
    └── Creates Quick Form config → Platform API
    │
    ▼
Customer logs into vertical's branded frontend
    │
    ▼
Vertical frontend displays industry-specific UI
    │ reads/writes data via vertical backend → Platform API
    ▼
Customer sees dispatch board, job tracker, customer list
    (powered by EveryStack, branded as vertical product)
```

---

## Vertical Evaluation Criteria

When assessing a new vertical idea, evaluate these dimensions:

### Platform Leverage Score

How much of the vertical's infrastructure is already provided by EveryStack? Higher is better — it means less custom code, faster time to market, and lower maintenance.

| Score      | Meaning                | Custom Layer                                          | Example                                                          |
| ---------- | ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| **90%+**   | Almost pure EveryStack | Branded frontend + provisioning + templates           | Agency client portal, bookkeeping client dashboard               |
| **70–90%** | Light custom layer     | Above + 1–2 thin domain services                      | Property management, trade services, small law firm              |
| **50–70%** | Medium custom layer    | Above + heavy domain services + content               | Exam prep, tutoring, recruitment, fitness studio                 |
| **< 50%**  | Questionable fit       | EveryStack provides less than half the infrastructure | Don't build — the platform leverage doesn't justify the coupling |

### Evaluation Checklist

| Question                                                     | Why It Matters                                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Can domain data be modeled as Tables + Fields + Cross-Links? | If the data model requires graph structures, time-series, or non-relational patterns, EveryStack's canonical JSONB may not fit                                                       |
| Are the core workflows trigger → action flows?               | EveryStack's Automation system handles sequential workflows. If the domain needs complex DAGs or real-time stream processing, the Automation system won't suffice                    |
| Does the customer need a dashboard, not a canvas?            | Quick Portals (MVP) and App Portals (post-MVP) display structured Record data. If the customer needs freeform spatial layouts beyond what App Designer provides, portals may not fit |
| Is document generation a meaningful part of the value?       | Doc Gen is a strong differentiator. Verticals that generate invoices, reports, contracts, or summaries get high leverage                                                             |
| Is AI a feature, not the product?                            | AIService provides embedded AI (summarization, drafts, classification). If AI IS the product (e.g., AI agent platform), the vertical should probably be standalone                   |
| Is the market willing to pay for SaaS?                       | Platform leverage is irrelevant if the market won't pay subscription fees                                                                                                            |

### Vertical Candidates — Ranked by Platform Leverage

**Tier 1 (90%+ leverage — grab first):**

- Agency / consultant client dashboard
- Bookkeeping / accounting client portal
- Property management (landlords, 2–50 units)

**Tier 2 (70–90% leverage — strong candidates):**

- Trade services management (HVAC, plumbing, electrical, cleaning)
- Tutoring / education centre management (without voice/real-time)
- Small law firm / legal practice management

**Tier 3 (50–70% leverage — larger investment):**

- Fitness / wellness studio management
- Recruitment / staffing agency
- English exam prep with voice (the original B2C concept)

---

## Build Sequence

### Vertical Milestone 1: Platform API (prerequisite for all verticals)

The Platform API must exist before any vertical can be built. This is the single biggest enabler. See `platform-api.md` for the full spec. Key priorities:

1. **Data API** — CRUD on Records, query with filters/sorts. This is the minimum viable integration point.
2. **Auth** — Service-level API keys with per-Tenant scoping and permission controls.
3. **Webhook confirmation** — Verify that inbound webhooks (already specced in `automations.md`) and outbound webhooks (Send Webhook action + workspace event webhooks) are both in MVP scope.
4. **Schema API** — Read Table/Field/Cross-Link structure. Enables vertical frontends to dynamically render UI based on schema.
5. **Provisioning API** — Create Tenants, Workspaces, Tables, Fields, Cross-Links, Automations, Document Templates, Quick Portals, Quick Forms. Enables B2B vertical onboarding.
6. **AI API** — Expose AIService as a consumable endpoint. Enables domain services to use EveryStack's AI infrastructure with tenant-level credit metering.

### Vertical Milestone 2: First B2B Vertical

Start with the highest-leverage vertical — the one with the thinnest custom layer. Build the branded frontend, provisioning service, and template library. Use this to validate the Platform API design: every friction point in building the vertical reveals a gap in the API.

### Vertical Milestone 3: Iterate API, Add Verticals

The first vertical will expose Platform API gaps. Fix them, then build the second vertical faster. Each subsequent vertical should take less time as the API matures and patterns solidify.

### Vertical Milestone 4: B2C Product (When Ready)

B2C products require heavier investment (domain services, content, consumer marketing). Begin when the platform engine and Platform API are mature and the B2B verticals are generating revenue.

---

## Architectural Decisions — Record

Decisions made during the design of this architecture, recorded for future reference.

| Decision                                                               | Choice                                                                                                                                                                                    | Rationale                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verticals are a usage pattern, not a platform concept**              | EveryStack does not know it's powering a vertical. No `vertical` namespace in Tenant settings. No vertical-specific config.                                                               | The Platform API, webhooks, and AIService exposure benefit every customer equally. Verticals are just sophisticated API consumers. If vertical-awareness is needed later, it can be layered on without changing the engine.        |
| **No embed blocks in Quick Portals**                                   | Custom UI embedding is exclusively an App Portal (post-MVP, App Designer) capability. Quick Portals remain exactly what the glossary defines: an externally-shared Record View with auth. | Clean separation per `GLOSSARY.md`. Quick Portals are simple and fast. App Portals are powerful and custom. Blurring the line erodes both.                                                                                         |
| **Service-level API keys, not user-level passthrough**                 | Vertical backends authenticate as trusted services, not as individual users                                                                                                               | Vertical users never exist in EveryStack. The vertical manages its own auth. EveryStack sees API keys, not people. This keeps the Tenant boundary clean and avoids coupling vertical identity systems to Clerk.                    |
| **No shared package imports between engine and verticals**             | All communication through Platform API HTTP endpoints                                                                                                                                     | Shared imports create coupling that's invisible at deployment and impossible to version. HTTP endpoints are explicit contracts that can evolve independently.                                                                      |
| **Templates are vertical-side configuration, not EveryStack entities** | Industry templates live in the vertical's codebase, not in EveryStack                                                                                                                     | EveryStack provides the provisioning API. The vertical decides what to provision. This avoids polluting the engine with domain-specific template concepts. A future marketplace could change this, but that's a separate decision. |
