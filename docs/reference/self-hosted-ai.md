# Self-Hosted AI & Enterprise Air-Gapped Deployment

> **⚠️ POST-MVP — This document describes post-MVP functionality.** Per GLOSSARY.md, "Self-hosted AI, data residency" is explicitly excluded from MVP scope. MVP — Foundation actions (adapter skeleton, type union) build extension points only — no runtime self-hosted code ships in MVP.

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Changes: (1) Added post-MVP scope banner — glossary lists self-hosted AI and data residency as post-MVP. (2) Replaced "doc drafting" → "Document AI Draft" per glossary AI layer definitions. (3) Verified all cross-references and naming; no other naming drift found — doc already uses glossary-correct terms (AIService, capability tiers, Command Bar, Workspace).

> **Reference doc (Tier 3).** Open-weight model strategy, hybrid routing, enterprise self-hosted deployment modes, security model for open-weight LLMs, cost breakeven analysis, and implementation roadmap.
> Cross-references: `ai-architecture.md` (AIProviderAdapter, capability tiers, prompt compiler, evaluation framework), `ai-metering.md` (credit calculation, cost normalization), `compliance.md` (data residency, GDPR, multi-region), `agent-architecture.md` (agents on self-hosted inference)
> Implements: `packages/shared/ai/CLAUDE.md` (provider adapter rules, self-hosted.ts adapter)
> Last updated: 2026-02-27 — Reconciled with GLOSSARY.md.

---

## Core Principle

**The `AIProviderAdapter` interface enables self-hosted LLM deployment with zero feature code changes.** The same capability tier routing, prompt registry, tool definitions, metering flow, and evaluation framework work identically whether the inference backend is Anthropic's API, OpenAI, or an open-weight model running on customer hardware. Self-hosted AI is architecturally supported from MVP — Foundation — it becomes a feature and a competitive differentiator, not just a cost optimization.

---

## The Enterprise Problem

Airtable offers data residency (US/EU/Australia) for Enterprise Scale, but AI still sends data to third-party providers (OpenAI, etc.). CISOs face a binary choice: use AI (data leaves control) or disable AI (lose value). Neither Airtable nor SmartSuite offers self-hosted AI.

**EveryStack's architecture enables a third option:** full AI capability with zero data leaving the customer's trust boundary.

---

## Open-Weight Model Landscape

### Recommended: Qwen3 Family (Apache 2.0)

| Model | Architecture | Active Params | Total Params | Context | Strengths |
|-------|-------------|---------------|--------------|---------|-----------|
| Qwen3-8B | Dense | 8B | 8B | 128K | Fast inference, good for `fast` tier |
| Qwen3-30B-A3B | MoE | 3B/token | 30B | 128K | Excellent speed/quality, `fast` tier candidate |
| Qwen3-32B | Dense | 32B | 32B | 128K | Strong quality, `standard` tier candidate |
| Qwen3-235B-A22B | MoE | 22B/token | 235B | 128K | Frontier-competitive, `standard`/`advanced` candidate |
| Qwen3-Coder-Next | MoE (80B, 3B active) | 3B/token | 80B | 128K | Purpose-built for agentic tool use |

**Why Qwen3:** Apache 2.0 license (fully commercial, no restrictions). Native tool calling and structured output. Thinking/non-thinking modes. 128K context window. Strongest open-weight option as of early 2026.

**Alternatives:** Llama 4 (Meta, community license — check commercial terms), Mistral (French, Apache 2.0 for some models), DeepSeek V3/R1 (strong but more restrictive licensing). The `AIProviderAdapter` interface supports any model behind an OpenAI-compatible API.

### Inference Stack

**vLLM** or **SGLang** serve models behind an OpenAI-compatible HTTP API. The `self-hosted.ts` adapter targets this endpoint. Architecture:

```
AIService → CAPABILITY_ROUTING[tier] → self-hosted adapter
  → HTTP POST to vLLM/SGLang endpoint (OpenAI-compatible)
  → Model inference on GPU
  → Response normalized to AIResponse
```

---

## Hybrid Routing Strategy

The smart play at scale: route different capability tiers to different backends.

| Tier | Estimated Traffic Share | Self-Hosted Option | Cloud API Option |
|------|----------------------|-------------------|-----------------|
| `fast` (60% of calls) | Intent classification, autocomplete, summarization | Qwen3-8B or Qwen3-30B-A3B | Claude Haiku |
| `standard` (35%) | Conversational AI, drafting, automation building | Qwen3-32B or Qwen3-235B-A22B | Claude Sonnet |
| `advanced` (5%) | Complex reasoning, full generation, cross-base analysis | Cloud API only (no open model matches yet) | Claude Opus |

**Implementation:** Update `CAPABILITY_ROUTING` in `packages/shared/ai/config/routing.ts`:

```typescript
// Hybrid routing example
const CAPABILITY_ROUTING: Record<CapabilityTier, ProviderModelConfig> = {
  fast:     { providerId: 'self-hosted', modelId: 'qwen3-30b-a3b' },
  standard: { providerId: 'anthropic',   modelId: 'claude-sonnet-4-5-20250929' },
  advanced: { providerId: 'anthropic',   modelId: 'claude-opus-4-6' },
};
```

**Potential cost reduction:** 50–60% of API costs at scale by self-hosting the `fast` tier.

### Quality Gap Assessment

| Capability | Open Models (Qwen3 family) | Cloud API (Claude) |
|-----------|---------------------------|-------------------|
| Tool calling / structured JSON | Competitive | Excellent |
| Code generation | Competitive | Excellent |
| Classification / summarization | Competitive | Excellent |
| Nuanced multi-step reasoning | Acceptable gap | Best-in-class |
| Complex business context judgment | Notable gap | Best-in-class |
| Graceful error recovery | Notable gap | Best-in-class |

**The gap is narrowing fast.** What was a chasm 12 months ago is now a manageable difference for most tasks. Run the evaluation suite (`ai-architecture.md` > Provider Evaluation Framework) against each model to quantify the quality delta for EveryStack's specific prompt templates.

---

## Cost Breakeven Analysis

### Cloud GPU Economics

| Resource | Cost | Notes |
|----------|------|-------|
| H100 (cloud) | $1.49–$3.50/hour | Varies by provider |
| Monthly always-on | $1,100–$2,500/month | Single GPU |
| Breakeven point | ~$1,500/month Anthropic spend | ~75 Enterprise workspaces at full AI budget |

### Consumer GPU (Development Only)

RTX 5090 ($2,000 one-time) can run Qwen3-32B quantized for development and testing. Not suitable for production multi-tenant workloads.

### Recommendation

| Stage | Strategy |
|-------|----------|
| Pre-launch → early growth | Stay on Anthropic API exclusively. Best quality, credit model caps cost exposure. |
| At scale (hundreds of workspaces) | Implement hybrid routing. Self-host `fast` tier, API for `standard`/`advanced`. |
| Enterprise customers | Self-hosted becomes a *feature*, not just cost optimization. See Enterprise Deployment below. |

---

## Enterprise Air-Gapped Deployment

### Architecture

All components run inside the customer's infrastructure. No API calls to external providers.

```
Customer's VPC / Private Cloud / On-Prem
├─ EveryStack App (Next.js) + Worker (BullMQ)
├─ EveryStack Real-Time (Socket.io)
├─ PostgreSQL 16 + pgvector + PgBouncer
├─ Redis
└─ vLLM / SGLang serving Qwen3
   *** Nothing leaves this boundary ***
```

The `self-hosted.ts` adapter hits the internal inference endpoint. `CAPABILITY_ROUTING` points all tiers at the self-hosted provider. Full AI feature set (Command Bar, agents, automation building, Document AI Draft) works entirely within the trust boundary.

### Three Deployment Modes

**Mode 1 — EveryStack-Managed Self-Hosted (80%+ of demand)**

- EveryStack provides a validated model bundle (Qwen3, Apache 2.0)
- Customer deploys on their GPU infrastructure via Helm chart / Docker Compose
- EveryStack handles: model updates, prompt compatibility testing, evaluation validation
- Customer IT manages: infrastructure, networking, GPU provisioning
- Simplest offering, covers most enterprise demand

**Mode 2 — Customer-Provided Model (BYOM)**

- Customer has an existing approved inference endpoint (internal ML team, Azure OpenAI, etc.)
- EveryStack configures the adapter, runs the evaluation suite, provides a compatibility report
- Professional services engagement (higher touch, higher margin)
- For large enterprises with dedicated AI/ML teams

**Mode 3 — Hybrid (Sophisticated)**

- Some tiers use customer infrastructure (self-hosted)
- Other tiers use cloud API for quality-critical tasks
- Granular control via capability routing: schema analysis can use Claude (only sees definitions), email drafting stays on-prem (processes client data)
- Requires the permission-scoped Context Builder to enforce data classification boundaries

### Target Customers

| Segment | Driver | Examples |
|---------|--------|---------|
| **Regulated industries** | Data restrictions, compliance mandates | Financial services, healthcare (HIPAA), defense/government (ITAR, FedRAMP) |
| **Internal security policies** | Client contracts prohibiting third-party data sharing | Consulting firms (McKinsey, Bain), law firms |
| **Sovereign AI requirements** | EU AI Act + GDPR preference for in-region processing | European enterprises, government agencies |

### Why Competitors Can't Match

Airtable and SmartSuite are pure cloud SaaS with AI tightly coupled to third-party providers. No self-hosted deployment option. Re-architecting their AI layer for pluggable inference would be a multi-year effort conflicting with their core business model. EveryStack's `AIProviderAdapter` interface was designed for this from the beginning.

---

## Security Model for Open-Weight LLMs

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Malicious code in model file format** | HIGH (but mitigable) | **Mandate SafeTensors format only.** SafeTensors is a pure data format — cannot contain executable code. Never use pickle-format models. All major models publish SafeTensors versions. vLLM/SGLang support it natively. |
| **Behavioral backdoors in model weights** | MEDIUM (hard to fully eliminate) | Run Microsoft's backdoor scanner (open-weights scanner, Feb 2026). Run EveryStack's evaluation suite against adversarial test cases. The tool registry with permission gating means even a compromised model can only take actions the tools allow. |
| **Supply chain compromise** | MEDIUM (mitigable) | Verify SHA-256 checksums against official repository. Download only from official Qwen organization on Hugging Face. Pin specific model revisions by commit hash. Include checksum verification in deployment tooling. |
| **Training data bias** | LOW-MEDIUM | Run evaluation suite with adversarial test cases for systematic bias. Standard practice regardless of model provider. |
| **Inference runtime vulnerabilities** | LOW (standard ops) | Run inference endpoint in a container with no outbound network access. Standard server hardening. Monitor CVEs in vLLM/SGLang. |

### Enterprise Security Documentation

For each enterprise deployment, provide:

1. **Model provenance:** official source, commit hash, SHA-256 checksum
2. **File format:** SafeTensors only (no pickle, no arbitrary code execution)
3. **Backdoor scan results:** Microsoft scanner or equivalent
4. **Network isolation:** inference container has no outbound network access
5. **Evaluation results:** adversarial test suite showing no anomalous behavior patterns
6. **Runtime hardening:** container security profile, no filesystem access beyond model weights
7. **Comparison matrix:** risk profile of self-hosted vs. cloud API for their specific threat model
8. **Model alternatives:** Qwen3 (Apache 2.0, Alibaba), Llama 4 (Meta), Mistral (French)

### Key Insight: Self-Hosted Is More Auditable

Open-weight models are *more* auditable and *more* controllable than closed API models. You can inspect, scan, and evaluate the weights. With a closed API, you trust the provider's claims. With self-hosted, you verify.

---

## Licensing & Branding

**Qwen3 (Apache 2.0):** Package and distribute as part of the product without royalties. No attribution requirements in product UI.

**Product branding:** Don't call it "Qwen" in the product surface. Brand as "EveryStack AI" or "EveryStack Intelligence." The model is an infrastructure component you manage — like PostgreSQL. Disclose the model identity in technical documentation and compliance materials, but the product surface presents it as your capability.

**Model alternatives for geopolitical comfort:** Some enterprise customers may prefer a non-Chinese-origin model despite identical technical security posture. Offer Llama 4 (Meta, American) or Mistral (French, EU jurisdiction) as alternatives. The `AIProviderAdapter` interface doesn't care which model is behind the endpoint. Document quality differences in evaluation suite results and let the customer make an informed tradeoff.

---

## Prompt Template Compilation

The existing prompt compiler (`packages/shared/ai/prompts/compiler.ts`) adapts generic templates to provider-specific formats. For self-hosted models:

- **Qwen3:** Supports ChatML format. Tool calling via native function calling. Thinking mode via `/think` and `/no_think` tags.
- **Llama 4:** Custom chat template. Tool use via prompt-based instruction.
- **Mistral:** Supports function calling natively.

The compiler layer handles these differences. Prompt templates remain provider-agnostic. When validating a new self-hosted model, run the full evaluation suite (`npx eval --provider=self-hosted --all-templates`) and document quality deltas honestly.

---

## Enterprise Pricing

Self-hosted AI deployment adds a premium to Enterprise tier pricing:

| Component | Cost | Margin Impact |
|-----------|------|---------------|
| Deployment tooling (Helm chart, Docker Compose, health checks) | Included in Enterprise | Development investment |
| Model validation & compatibility testing | $2K–5K/month premium | Pure margin — customer runs GPU, EveryStack AI costs = zero |
| BYOM professional services | Per-engagement pricing | High-touch, high-margin |

**Strategic moat:** Once deployed with self-hosted AI, switching cost is enormous (GPU infrastructure, inference pipeline, compliance narrative, possible fine-tuned models). Genuine lock-in that benefits the customer.

---

## Implementation Roadmap

### MVP — Foundation Actions (Do Now)

1. Ensure `self-hosted.ts` adapter skeleton exists and targets an OpenAI-compatible endpoint
2. Verify the adapter interface supports `supportedRegions()` for EU routing
3. Preserve all architecture decisions that enable self-hosted: provider adapter interface, capability routing config, region-aware AI, prompt compiler abstraction
4. Include `self-hosted` in the `providerId` type union from day one

### Post-MVP — Self-Hosted AI Actions (Post-MVP, Sales-Driven)

1. Test prompt templates against Qwen3-32B and Qwen3-235B-A22B. Document quality deltas honestly in evaluation reports.
2. Build prompt compilation layer for Qwen3's instruction format in `prompts/compiler.ts`
3. Implement `calculateCost()` for self-hosted (GPU-seconds or fixed per-token rate)
4. Create Helm chart / Docker Compose for model deployment
5. Build health check endpoint for inference service monitoring
6. Create enterprise security documentation package (see Security Model above)
7. Develop model fine-tuning pipeline (future: fine-tune on workspace-specific patterns)

### Sales-Driven (Build When First Enterprise Customer Asks)

- Deployment guide with GPU sizing recommendations
- BYOM adapter configuration tool
- Enterprise tier in billing with self-hosted AI add-on
- SLA framework for self-hosted deployments

---

## Phase Implementation Summary

| Phase | Self-Hosted AI Work |
|-------|-------------------|
| **MVP — Foundation (Foundation)** | `self-hosted.ts` adapter skeleton. `providerId: 'self-hosted'` in type union. `supportedRegions()` on adapter interface. Zero runtime code. |
| **Post-MVP — Automations (Automations)** | Validate that automation building AI prompts work with the prompt compiler abstraction (they should — this is the architecture's purpose). |
| **Post-MVP — Self-Hosted AI (Post-MVP)** | Model evaluation against Qwen3. Prompt compiler for Qwen3 instruction format. Helm chart. Health checks. Enterprise security documentation. Hybrid routing activation. |
| **Enterprise Demand-Driven** | BYOM professional services. Fine-tuning pipeline. Deployment guides. GPU sizing. |
