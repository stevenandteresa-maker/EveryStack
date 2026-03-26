# EveryStack — Data Residency, Privacy, Security & Compliance

> **Reference doc.** GDPR rights, CCPA/CPRA, PII handling, anonymization cascade, data residency, encryption, security headers, WAF, vulnerability management, breach response, subprocessor management, session management, API security, RLS policies, AI compliance, self-hosted AI data sovereignty, SOC 2 roadmap.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (tenant schema, audit_log), `operations.md` (monitoring, logging), `files.md` (file security, virus scanning), `ai-architecture.md` (AIProviderAdapter, self-hosted adapter)
> Last updated: 2026-02-27 — Aligned with GLOSSARY.md. Cleaned cross-refs to post-MVP docs. Preserved full security architecture and compliance roadmap.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                     | Lines   | Covers                                                                                                              |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Core Principle                              | 32–36   | Design for compliance now, enforce progressively                                                                    |
| GDPR & CCPA/CPRA                            | 38–62   | Data subject rights table, right to delete, portability, CCPA categories                                            |
| PII Handling                                | 64–103  | PII registry (table/column map), anonymization cascade, logging redaction                                           |
| Encryption                                  | 105–128 | At rest (AES-256 per data store), in transit (TLS 1.3, mTLS)                                                        |
| Security Headers                            | 130–184 | Platform CSP (/w/_, /api/_), portal CSP (custom domains), portal cookie security                                    |
| Row-Level Security                          | 201–220 | RLS policy specs, tenant isolation defense-in-depth                                                                 |
| Webhook Signatures & Gotenberg              | 219–243 | Inbound webhook HMAC verification, Gotenberg sandbox config (network disabled, resource limits)                     |
| WAF & Session Management                    | 248–257 | WAF rules per environment, session controls, enterprise idle timeout, device management                             |
| SSO, API Security & Vulnerability Mgmt      | 282–295 | SAML SSO, SCIM provisioning, API key model (prefix, scopes, rotation), CVE response SLAs                            |
| Subprocessor Registry & Breach Notification | 311–325 | Subprocessor table with DPA status, 72-hour breach notification procedure                                           |
| AI Compliance & Self-Hosted AI              | 339–355 | EU AI Act classification, data processing guarantees, air-gapped AI, 3 deployment modes, open-weight model security |
| Data Residency Strategy                     | 409–427 | MVP foundation, built-from-day-one patterns, multi-region post-MVP                                                  |
| SOC 2 & Certification Roadmap               | 429–438 | Type I timeline (Post-MVP — Comms & Polish), certification path                                                     |

---

## Core Principle

**Design for compliance now, enforce progressively.** Schema, data access patterns, PII handling, and security controls designed from MVP — Foundation so that regional deployment, data export, deletion, certifications, and regulatory compliance are additive — not a retrofit.

---

## GDPR Rights Implementation

| Right                                | Implementation                                                                          | Phase                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Right to Access (Art. 15)**        | Data export endpoint: JSON/ZIP archive of all user data across workspaces.              | MVP — Foundation (schema), Post-MVP — Portals & Apps (endpoint) |
| **Right to Erasure (Art. 17)**       | User deletion cascade: anonymize user records. Clerk webhook triggers.                  | MVP — Foundation (schema), Post-MVP — Portals & Apps (endpoint) |
| **Right to Portability (Art. 20)**   | Workspace data export: tables, records, fields, cross-links, automations in JSON + CSV. | Post-MVP — Portals & Apps                                       |
| **Right to Rectification (Art. 16)** | Users update profile via Settings. Records editable by authorized users.                | MVP — Foundation                                                |
| **Consent Management**               | Cookie consent (portal visitors). AI processing consent (admin opt-in).                 | Post-MVP — Portals & Apps                                       |

---

## CCPA/CPRA Compliance

| Right                           | Implementation                                                                                | Notes                         |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| **Right to Know**               | Same as GDPR Access — data export endpoint.                                                   | Categories in privacy policy. |
| **Right to Delete**             | Same as GDPR Erasure — anonymization cascade.                                                 |                               |
| **Right to Opt-Out**            | EveryStack does not sell PI. "Do Not Sell" in portal footer. `tenants.settings.ccpa_opt_out`. | Anthropic DPA: no training.   |
| **Right to Correct**            | Same as GDPR Rectification.                                                                   |                               |
| **Right to Limit Sensitive PI** | Flagged in PII registry. `pii-registry.ts` sensitivity classification.                        |                               |

**Other jurisdictions:** LGPD (Brazil), PIPEDA (Canada), UK GDPR addressed by same architecture. PIPL (China) requires data localization (post-MVP multi-region).

---

## PII Handling

Covers PII Registry, Anonymization Cascade, Logging PII Redaction.
Touches `workspace_memberships`, `thread_messages`, `ai_usage_log`, `command_bar_sessions`, `audit_log` tables.

### PII Registry

| Table                   | PII Columns                          | On User Deletion                                                           |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `users`                 | email, name, avatar_url, preferences | Anonymize: `deleted_user_<hash>`, null, null, `{}`                         |
| `workspace_memberships` | user_id (FK)                         | Retain with anonymized user                                                |
| `records`               | canonical_data (may contain PII)     | Tenant-owned — not deleted on user deletion                                |
| `thread_messages`       | sender_id, content                   | Anonymize sender. Content retained.                                        |
| `ai_usage_log`          | user_id, prompt content              | Delete rows. Aggregates retained anonymized.                               |
| `command_bar_sessions`  | user_id, history                     | Delete entirely.                                                           |
| `audit_log`             | actor_id, action details             | Anonymize actor. Retain action.                                            |
| `portal_access`         | email, auth_hash, token              | Quick Portal auth (MVP). Per-record access credentials. Manager deletes.   |
| `portal_clients`        | email, display_name, avatar_url      | App Portal auth (post-MVP). Identity-based client record. Manager deletes. |
| `portal_sessions`       | auth_id (FK — polymorphic)           | Cascade on portal_access or portal_clients deletion.                       |
| `portal_magic_links`    | portal_client_id, token              | App Portal only. Cascade on client deletion.                               |

### Anonymization Cascade

On user deletion (Clerk webhook):

1. `users`: email → `deleted_user_<sha256[0:8]>`, name/avatar → null, preferences → `{}`
2. `workspace_memberships`: retain, FK points to anonymized user
3. `thread_messages`: sender references anonymized user. Messages preserved.
4. `ai_usage_log`: delete all rows for user
5. `command_bar_sessions`: delete all rows for user
6. `audit_log`: actor references anonymized user. Actions preserved.
7. `files`: personal uploads deleted, shared retained

**Integration test:** Verify zero queries return PII for deleted user.

### Logging PII Redaction

Pino paths: `password`, `token`, `authorization`, `cookie`, `email`, `name`. **Log retention:** 90 days, then purged.

---

## Encryption

### At Rest

| Data Store       | Method                                         | Phase            |
| ---------------- | ---------------------------------------------- | ---------------- |
| **PostgreSQL**   | Cloud disk encryption (RDS: AES-256/KMS)       | MVP — Foundation |
| **Redis**        | Cloud disk encryption (ElastiCache)            | MVP — Foundation |
| **R2/S3**        | Server-side encryption on bucket               | MVP — Foundation |
| **Backups**      | Encrypted at rest. Snapshots inherit.          | MVP — Foundation |
| **OAuth tokens** | App-level AES-256-GCM. Key in secrets manager. | MVP — Sync       |

### In Transit

| Connection                     | TLS                                    | Phase                  |
| ------------------------------ | -------------------------------------- | ---------------------- |
| **Client → Web**               | HTTPS via HSTS. HTTP → HTTPS redirect. | MVP — Foundation       |
| **Web → PgBouncer → Postgres** | `sslmode=require`                      | MVP — Foundation       |
| **App → Redis**                | `rediss://` in production              | MVP — Foundation       |
| **Inter-service**              | Redis pub/sub (TLS)                    | MVP — Foundation       |
| **External APIs**              | All SDKs use HTTPS                     | MVP — Foundation       |
| **Outbound webhooks**          | HTTPS required in production           | Post-MVP — Automations |

---

## Security Headers

Two profiles in Next.js middleware:

### Platform Headers (/w/_, /api/_)

```typescript
const PLATFORM_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.clerk.dev https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://files.everystack.com",
    "connect-src 'self' https://api.clerk.dev https://api.stripe.com wss://*.everystack.com",
    'frame-src https://js.stripe.com',
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};
```

### Portal Headers (portal.everystack.com/\*, custom domains)

```typescript
const PORTAL_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://files.everystack.com",
    "connect-src 'self' wss://*.everystack.com",
    'frame-src https://js.stripe.com',
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '),
};
```

**MVP — Foundation.** CI tests assert header presence.

---

## Portal Cookie Security

| Attribute  | Value                | Rationale                                              |
| ---------- | -------------------- | ------------------------------------------------------ |
| `Secure`   | `true` (prod)        | No HTTP                                                |
| `HttpOnly` | `true`               | No JS access                                           |
| `SameSite` | `Lax`                | CSRF protection                                        |
| `Path`     | `/`                  | Portal root                                            |
| `Domain`   | Portal's domain only | Custom domain cookies never leak to `*.everystack.com` |
| `Max-Age`  | 7 days               | Auto-expiry                                            |

**Post-MVP — Portals & Apps.**

---

## Row-Level Security Policies

RLS is defense-in-depth. Application layer is primary; RLS blocks cross-tenant access if app code has a bug.

```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {table_name}
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Tenant context:** `SET LOCAL app.current_tenant_id = '{tenantId}'` at transaction start in `getDbForTenant()`.

**Tables with RLS (MVP — Foundation):** All tenant-scoped — `workspace_memberships`, `boards`, `bases`, `tables`, `fields`, `records` (partitions), `audit_log` (partitions), `files`, `cross_links`, `cross_link_index`, `sections`, `views`, `ai_usage_log` (partitions), `ai_credit_ledger`, `agent_sessions`.

**Tables WITHOUT RLS:** `users` (no tenant_id), `tenants` (accessed by ID).

**Migration rule:** Every new tenant-scoped table MUST include RLS policy. Checked in CI.

---

## Inbound Webhook Signature Verification

| Provider   | Method                             | Header                                        |
| ---------- | ---------------------------------- | --------------------------------------------- |
| **Clerk**  | SVIX signature                     | `svix-signature`, `svix-id`, `svix-timestamp` |
| **Stripe** | `stripe.webhooks.constructEvent()` | `stripe-signature`                            |
| **Resend** | SVIX signature                     | `svix-signature`, `svix-id`, `svix-timestamp` |

Failed → 401 + Sentry warning. **MVP — Foundation** (Clerk), **Post-MVP — Documents** (Resend), **Post-MVP — Comms & Polish** (Stripe).

---

## Gotenberg Sandboxing

Gotenberg renders user content to PDF. Potential SSRF/execution vector.

1. **Network isolation:** Isolated Docker network. Only worker reaches it.
2. **No outbound internet.**
3. **Resource limits:** CPU/memory caps.
4. **Input validation:** Strip `<script>`, `<iframe>`, event handlers. Reject DOCX with VBA macros.
5. **Timeout:** 30s render limit.

**Post-MVP — Documents.**

---

## WAF

| Environment | Provider           | Config                                                                                               |
| ----------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| Dev         | None               | —                                                                                                    |
| Production  | **Cloudflare WAF** | OWASP Core + Managed rulesets. 100 req/min per IP on `/api/*`. Bot management. DDoS auto-mitigation. |

**Post-MVP — Portals & Apps.** Basic Cloudflare proxy in MVP — Foundation.

---

## Session Management & Enterprise Controls

| Control             | Default                      | Plan          |
| ------------------- | ---------------------------- | ------------- |
| Session timeout     | 7d (workspace), 24h (portal) | Professional+ |
| Idle timeout        | None                         | Business+     |
| Force logout all    | N/A                          | All           |
| Concurrent sessions | Unlimited                    | Business+     |
| IP allowlist        | Disabled                     | Enterprise    |

Stored in `tenants.settings.security` JSONB. Clerk APIs enforce.

---

## SSO & Identity Provisioning

| Feature               | Plan          | Implementation                               |
| --------------------- | ------------- | -------------------------------------------- |
| **SAML SSO**          | Professional+ | Clerk Enterprise Organizations               |
| **SCIM provisioning** | Enterprise    | Clerk SCIM. Auto-create/deactivate from IdP. |

---

## API Security

### API Key Model

- Keys shown once at creation. Only prefix visible.
- Scoped to workspace (tenant).
- Granular permissions: `records:read`, `records:write`, `schema:read`, `schema:write`, `automations:trigger`, `webhooks:manage`.
- Rate limiting per key (Redis token bucket, 60/min default).
- Audit: `actor_type: 'api_key'`.
- Instant revocation. Expiry recommended.

**Post-MVP — Automations.**

---

## Vulnerability Management

| Tool                       | Purpose                       | Phase                      |
| -------------------------- | ----------------------------- | -------------------------- |
| **Dependabot**             | npm + Docker scanning         | MVP — Foundation           |
| **npm audit**              | CI gate (high/critical block) | MVP — Foundation           |
| **eslint-plugin-security** | SAST basics                   | MVP — Foundation           |
| **Trivy**                  | Container scanning            | Post-MVP — Portals & Apps  |
| **Semgrep**                | OWASP SAST                    | Post-MVP — Comms & Polish  |
| **Pentest**                | Annual external               | Post-MVP — Comms & Polish+ |
| **security.txt**           | Responsible disclosure        | MVP — Foundation           |

---

## Subprocessor Registry

| Subprocessor                 | Purpose                        | DPA |
| ---------------------------- | ------------------------------ | --- |
| Clerk                        | Auth, user management          | ✅  |
| Anthropic                    | AI processing (zero-retention) | ✅  |
| Cloudflare                   | CDN, R2, WAF, email workers    | ✅  |
| Resend                       | Outbound email                 | ✅  |
| Stripe                       | Payments (PCI DSS)             | ✅  |
| Sentry                       | Error tracking (PII-redacted)  | ✅  |
| Hosting (Railway/Render/AWS) | Infrastructure                 | ✅  |

Enterprise: 30 days notice before changes. Public page: `everystack.com/legal/subprocessors`. **Post-MVP — Portals & Apps.**

---

## Data Breach Notification

**Identification (0–4h):** Confirm scope, escalate.
**Containment (4–24h):** Isolate, preserve evidence.
**Assessment (24–48h):** Affected data, tenants, risk level.
**Notification (48–72h):** GDPR authority (72h). Users if high risk. Admins. US state timelines.
**Remediation (72h–2w):** Fix, post-incident review, update controls.

**Breach register:** Separate from app DB. GDPR Art. 33(5). **Post-MVP — Comms & Polish.**

---

## AI Compliance

### EU AI Act

| Requirement           | Implementation                                           | Phase            |
| --------------------- | -------------------------------------------------------- | ---------------- |
| Transparency labeling | AI content labeled. User review before applying.         | MVP — Foundation |
| Human oversight       | AI never acts without approval. Agent approval model.    | Architecture     |
| Record keeping        | `ai_usage_log` + `agent_sessions` track all invocations. | MVP — Foundation |

### Data Processing Guarantees

- **No training on tenant data:** Anthropic zero-retention API. Documented in DPA.
- **Regional AI routing:** EU tenants → EU endpoints when available.
- **AI consent:** Workspace admin opt-in.

---

## Self-Hosted AI & Data Sovereignty

Covers The Problem, Solution: Air-Gapped AI, Three Deployment Modes, Security for Open-Weight Models, Compliance Implications.
See `self-hosted.ts`.

### The Problem

Cloud AI processes data outside customer's trust boundary. Regulated industries face binary: use AI (data leaves) or disable (lose value).

### Solution: Air-Gapped AI

All inference inside customer infrastructure using open-weight models (Qwen3, Apache 2.0):

```
Customer's VPC / Private Cloud / On-Prem
├─ EveryStack App + Worker + Real-Time
├─ PostgreSQL + pgvector + Redis
└─ vLLM/SGLang serving open-weight model
   *** Nothing leaves this boundary ***
```

`AIProviderAdapter` interface makes this zero-feature-code-change. `self-hosted.ts` adapter targets internal endpoint.

### Three Deployment Modes

| Mode                   | Description                                       | Target                          |
| ---------------------- | ------------------------------------------------- | ------------------------------- |
| **EveryStack-Managed** | Validated model bundle, customer deploys via Helm | Most enterprise (80%+)          |
| **BYOM**               | Customer's existing inference endpoint            | Large enterprises with ML teams |
| **Hybrid**             | Some tiers self-hosted, others cloud              | Sophisticated compliance        |

### Security for Open-Weight Models

- **SafeTensors only** — no executable code (no pickle)
- **Backdoor scanning** — Microsoft's scanner
- **SHA-256 verification** — model provenance
- **Network isolation** — inference container has no outbound
- **Evaluation suite** — adversarial test cases
- **Model alternatives** — Qwen3, Llama 4, Mistral

### Compliance Implications

| Requirement  | How Self-Hosted Addresses                       |
| ------------ | ----------------------------------------------- |
| GDPR Art. 22 | Full audit trail, human-in-the-loop             |
| EU AI Act    | Model identity disclosed, evaluations available |
| HIPAA        | Zero data leaves HIPAA infrastructure           |
| ITAR/FedRAMP | Air-gapped, no external calls                   |
| SOC 2        | Customer controls entire pipeline               |

---

## Data Residency Strategy

### MVP — Foundation

Single-region. All data in one PostgreSQL instance.

### Built from Day One

1. `data_region` column on tenants. Informational now, routing later.
2. No cross-tenant dependencies. Moving tenant = data migration.
3. `getDbForTenant()` abstraction. Regional routing via env var.
4. PII-aware logging. Same region or PII-free.
5. AI regional routing via `AIProviderAdapter.supportedRegions()`.

### Multi-Region (Post-MVP)

Per-region PostgreSQL + Redis + app instances behind global edge. `getDbForTenant()` routes by `data_region`.

---

## SOC 2 & Certification Roadmap

| Phase                         | Work                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Foundation**          | Encryption documented. Security headers. RLS. Dependency scanning. ESLint security. PII registry. Clerk webhook verification. `security.txt`. AI transparency. `self-hosted.ts` skeleton. |
| **Post-MVP — Portals & Apps** | GDPR export/deletion. Cookie consent. Privacy policy + DPA. Subprocessor page. Portal cookies. WAF. SOC 2 readiness (Vanta/Drata). CCPA.                                                  |
| **Post-MVP — Documents**      | Gotenberg sandboxing. Template validation. Resend webhooks.                                                                                                                               |
| **Post-MVP — Automations**    | API key security. Webhook SSRF protection.                                                                                                                                                |
| **Post-MVP — Comms & Polish** | SOC 2 Type I. First pentest. Vulnerability disclosure. Breach procedure. Session controls. Container scanning. SAST. SSO. Type II observation begins.                                     |
| **Post-MVP — Self-Hosted AI** | Multi-region enforcement. EU AI routing. SOC 2 Type II. SCIM. HIPAA eval. ISO 27001 eval. Self-hosted AI eval. Enterprise air-gapped certification.                                       |
