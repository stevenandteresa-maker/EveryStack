# AI Data Contract — Canonical JSONB Translation for AI

> **Reconciliation note (2026-02-27, pass 2):** Re-verified against `GLOSSARY.md` (source of truth).
> **Changes (pass 2):**
>
> - Tagged `barcode` field type (Category 9: Identification) as **Post-MVP** — not in glossary's Key MVP field categories; associated with `inventory-capabilities.md` which is implicitly post-MVP
> - Tagged `inventory-capabilities.md` cross-reference as **(post-MVP)**
>
> **Changes (pass 1, 2026-02-27):**
>
> - Tagged `smart_doc` field type rows as **Post-MVP** (Wiki / Knowledge Base is post-MVP per glossary)
> - Tagged "AI Agents (goal-directed)" row in integration matrix as **Post-MVP** (AI Agents are post-MVP per glossary)
> - Tagged "Smart Docs AI content blocks" row in integration matrix as **Post-MVP**
> - Tagged "Document Intelligence" row in integration matrix as **Post-MVP** (vision/OCR AI features not in MVP AI scope)
> - Tagged `dependency` and `sub_items` field types as **Post-MVP** (project management extensions)
> - Tagged "Post-MVP — AI Agents" in phase implementation as **Post-MVP**
> - Tagged DuckDB Context Layer exemption section references as **Post-MVP** (DuckDB analytical layer is post-MVP per glossary)
> - Updated cross-references to mark post-MVP referenced docs
> - Renamed "cross-base" references to "Cross-Link" where referring to the concept (per glossary naming)

> **Reference doc (Tier 3).** AI is a formal data source, like sync adapters. AI output passes through `aiToCanonical()` before storage. AI input is prepared via `canonicalToAIContext()` before prompt assembly. Both methods live in the FieldTypeRegistry.
> Cross-references: `ai-architecture.md` (provider abstraction, structured output), `data-model.md` (field system, FieldTypeRegistry), `sync-engine.md` (toCanonical/fromCanonical pattern), `ai-field-agents-ref.md` **(post-MVP)** (Output Validator delegates to aiToCanonical/validate pipeline; Prompt Assembler uses canonicalToAIContext for read path), `duckdb-context-layer-ref.md` **(post-MVP)** (DuckDB type coercion exemption — read-side presentation, not canonical translation), `inventory-capabilities.md` **(post-MVP)** (Barcode field type AI translation), `document-intelligence.md` **(post-MVP)** (document-to-record extraction pipeline — uses canonicalToAIContext for table schema in prompt assembly, aiToCanonical for extracted values before storage; extraction writes to OTHER fields on the record, not the file field itself)
> Implements: `packages/shared/sync/CLAUDE.md` (FieldTypeRegistry rules), `packages/shared/ai/CLAUDE.md` (structured output pipeline)
> Last updated: 2026-02-27 — Glossary reconciliation pass 2 (barcode/inventory post-MVP tagging). Prior: 2026-02-27 pass 1 — Initial glossary reconciliation. Prior: 2026-02-21 — Added `document-intelligence.md` cross-reference.

---

## Core Principle

**Inside the platform, everything — including AI — speaks canonical JSONB.** When AI reads data, it receives values prepared from canonical form. When AI writes data, its output is coerced into canonical form before storage. This is the same discipline applied to sync adapters, user input, API writes, and imports.

AI is not special. It is a boundary-crosser that requires translation, just like Airtable or Notion.

```
External sync platform ──→ toCanonical() ──→ canonical JSONB ←── aiToCanonical() ←── LLM output
                                                    │
                                                    ├──→ fromCanonical() ──→ External sync platform
                                                    ├──→ canonicalToAIContext() ──→ LLM prompt
                                                    ├──→ UI renderers
                                                    └──→ DuckDB hydration (read-only, ephemeral — post-MVP)
```

---

## Two Translation Functions

Both functions are registered per field type in the FieldTypeRegistry, alongside existing `validate()`, `cell_renderer`, `toTemplateValue()`, and `toExportValue()`.

### `canonicalToAIContext(value, fieldConfig): string`

Converts a canonical JSONB value into a string representation suitable for inclusion in an LLM prompt. This is the **read path** — data flowing from the platform to AI.

**Design intent:** Produce the most useful, unambiguous text representation for an LLM to reason about. This is NOT the same as `toExportValue()` (which targets CSV/Excel) or `toTemplateValue()` (which targets document merge fields). AI context strings should be information-dense and parseable.

### `aiToCanonical(rawLLMOutput, fieldConfig): { value: any; warnings: string[] } | { error: string }`

Converts raw LLM text output into a canonical JSONB value. This is the **write path** — data flowing from AI into the platform. Returns either a successfully coerced value (possibly with warnings about lossy conversion) or an error if coercion is impossible.

**Design intent:** Be tolerant on input, strict on output. LLMs produce messy text — currency symbols, explanatory preambles, inconsistent date formats, option labels instead of IDs. This function absorbs that mess and produces a clean canonical value, or fails clearly.

---

## Per-Field-Type Mapping

### Category 1: Text

| Field Type                   | `canonicalToAIContext()`                             | `aiToCanonical()`                                                 |
| ---------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| **text**                     | Return string as-is.                                 | Return string as-is. Apply `max_length` truncation if configured. |
| **text_area**                | Return string as-is.                                 | Return string as-is. Apply `max_length` truncation if configured. |
| **smart_doc** **(Post-MVP)** | Render TipTap JSON to plain text (strip formatting). | Parse as Markdown, convert to TipTap JSON.                        |

### Category 2: Number

| Field Type      | `canonicalToAIContext()`                                                           | `aiToCanonical()`                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **number**      | Format with configured `thousands_separator` and `precision`. E.g., `"15,000.50"`. | Extract first numeric value. Strip `$`, `€`, `,`, `%`, whitespace, unit suffixes. Parse as float. Apply `precision` rounding. Reject if no number found. |
| **currency**    | Format as `"$15,000.50 USD"` using `currency_code` and `symbol_position`.          | Same numeric extraction as number. Ignore any currency symbol in LLM output — the field's configured `currency_code` governs.                            |
| **percent**     | Format as `"75%"` (multiply stored decimal by 100).                                | Extract number. If >1 and config stores as decimal, divide by 100. E.g., LLM says "75" → store `0.75`.                                                   |
| **rating**      | Format as `"4 out of 5"` using configured `max`.                                   | Extract integer. Clamp to `1..max`.                                                                                                                      |
| **duration**    | Format as human-readable using `display_format`. E.g., `"2h 30m"`.                 | Parse duration strings: "2h 30m", "2.5 hours", "150 minutes", "2:30". Convert to minutes (canonical storage unit).                                       |
| **progress**    | Format as `"75%"`.                                                                 | Extract number. Clamp to `0..100`. Only for manual-source progress fields. Reject if source is computed.                                                 |
| **auto_number** | Format as string with prefix. E.g., `"INV-0042"`.                                  | Reject — auto_number is read-only.                                                                                                                       |

### Category 3: Selection

| Field Type          | `canonicalToAIContext()`                                                   | `aiToCanonical()`                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **single_select**   | Return the option **label** (not the option ID). LLMs reason about labels. | Match against option labels: exact → case-insensitive → trimmed → extracted from explanatory text. Return the matching **option ID**. Reject if no match.                                  |
| **multiple_select** | Return comma-separated option labels.                                      | Split on commas/newlines. Match each against option labels (same cascade as single_select). Return array of matching option IDs. Filter unrecognized values. Reject if zero valid matches. |
| **status**          | Return the option label.                                                   | Same as single_select matching. Return option ID.                                                                                                                                          |
| **tag**             | Return comma-separated tag values.                                         | Split on commas/newlines. Trim each. Return as string array. If `allow_new: false`, filter to existing suggestions only.                                                                   |

### Category 4: Date & Time

| Field Type     | `canonicalToAIContext()`                                                               | `aiToCanonical()`                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **date**       | Format as `"January 15, 2026"` (human-readable). Include time if `include_time: true`. | Parse with cascade: ISO 8601 → `YYYY-MM-DD` → `MM/DD/YYYY` → `DD/MM/YYYY` → natural language ("January 15, 2026", "next Tuesday"). Store as ISO 8601. Reject if unparseable. |
| **date_range** | Format as `"January 15, 2026 – February 28, 2026"`.                                    | Parse as two dates (split on "–", "to", "through"). Return `{start, end}` in ISO 8601. Reject if either date unparseable or start > end.                                     |
| **due_date**   | Same as date. Include overdue context: `"January 15, 2026 (overdue by 3 days)"`.       | Same as date.                                                                                                                                                                |
| **time**       | Format as `"2:30 PM"` or `"14:30"` per `format` config.                                | Parse time strings. Normalize to HH:MM.                                                                                                                                      |
| **created_at** | Format as human-readable datetime.                                                     | Reject — system field, read-only.                                                                                                                                            |
| **updated_at** | Format as human-readable datetime.                                                     | Reject — system field, read-only.                                                                                                                                            |

### Category 5: People & Contact

| Field Type     | `canonicalToAIContext()`                                            | `aiToCanonical()`                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **people**     | Resolve user IDs to display names. Format as comma-separated names. | Match against workspace member names: exact → case-insensitive → fuzzy. Return matched user IDs. Reject if no matches. **Never guess — unresolvable names are errors, not silent drops.** |
| **created_by** | Resolve user ID to display name.                                    | Reject — system field, read-only.                                                                                                                                                         |
| **updated_by** | Resolve user ID to display name.                                    | Reject — system field, read-only.                                                                                                                                                         |
| **email**      | Return string as-is.                                                | Validate email format. Return as-is if valid. Reject if invalid.                                                                                                                          |
| **phone**      | Format as readable string: `"+1 (555) 123-4567"`.                   | Normalize: strip formatting, apply `default_country_code` if no country code present. Return canonical phone object.                                                                      |
| **url**        | Return string as-is.                                                | Validate URL format (must include scheme). Return as-is.                                                                                                                                  |
| **address**    | Format as single-line: `"123 Main St, Springfield, IL 62704, US"`.  | Parse into canonical shape `{street, street2, city, state, postal_code, country}`. Best-effort parsing of free-form address strings. Reject if completely unparseable.                    |
| **full_name**  | Format per `display_format`: `"Jane A. Smith"`.                     | Parse into canonical shape `{prefix, first, middle, last, suffix}`. Best-effort.                                                                                                          |
| **social**     | Format as `"LinkedIn: https://linkedin.com/in/jsmith"`.             | Parse platform + URL pairs. Match platform names to configured `platforms[]`.                                                                                                             |

### Category 6: Boolean & Interactive

| Field Type    | `canonicalToAIContext()`                                                | `aiToCanonical()`                                                                                                 |
| ------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **checkbox**  | Return `"Yes"` or `"No"`.                                               | Accept: true/false, yes/no, 1/0, checked/unchecked (case-insensitive). Map to boolean. Reject if unrecognized.    |
| **button**    | Return `"[Button: {label}]"`.                                           | Reject — buttons have no stored value.                                                                            |
| **checklist** | Format each item: `"☑ Item 1\n☐ Item 2 (assigned: Jane, due: Jan 15)"`. | Parse checklist items from text. Match assignee names to user IDs. Parse due dates. Return canonical JSONB array. |
| **signature** | Return `"Signed by {signer_name} on {signed_at}"`.                      | Reject — signatures are captured via UI, not AI.                                                                  |

### Category 7: Relational & Computed

| Field Type                     | `canonicalToAIContext()`                                                           | `aiToCanonical()`                                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **linked_record** (Cross-Link) | Resolve record IDs to primary field display values. Format as comma-separated.     | For `link_suggestion` output type: validate record IDs exist in target table. Return array of valid IDs. For text matching: search target table's primary field, return matched record IDs. |
| **lookup** **(Post-MVP)**      | Format the looked-up value using the target field type's `canonicalToAIContext()`. | Reject — lookup is computed/read-only.                                                                                                                                                      |
| **rollup** **(Post-MVP)**      | Format the aggregated value using the result type's `canonicalToAIContext()`.      | Reject — rollup is computed/read-only.                                                                                                                                                      |
| **count**                      | Format as number string.                                                           | Reject — count is computed/read-only.                                                                                                                                                       |
| **formula** **(Post-MVP)**     | Format the cached result using the output type's `canonicalToAIContext()`.         | Reject — formula is computed/read-only.                                                                                                                                                     |
| **dependency** **(Post-MVP)**  | Format as `"FS: Task A (lag: 2d), SS: Task B"`.                                    | Parse dependency descriptions. Match record references. Return canonical JSONB.                                                                                                             |
| **sub_items** **(Post-MVP)**   | Format child record summaries.                                                     | Reject — sub_items are managed via record creation, not direct field writes.                                                                                                                |

### Category 8: Files

| Field Type | `canonicalToAIContext()`                                          | `aiToCanonical()`                                                          |
| ---------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **files**  | Format as file list: `"report.pdf (2.1 MB), photo.jpg (450 KB)"`. | Reject — file uploads require the file upload pipeline, not text coercion. |

### Category 9: Identification (Post-MVP)

| Field Type                 | `canonicalToAIContext()`                                                                                 | `aiToCanonical()`                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **barcode** **(Post-MVP)** | Return string value as-is: `"012345678901"`. Include format in context if known: `"012345678901 (UPC)"`. | Accept string. Validate format against `config.format` if not `auto`. Strip whitespace. Store as string. |

---

## Where Each AI Feature Hits This Contract

| AI Feature                                      | Read Path (`canonicalToAIContext`)                                                                                                                                                     | Write Path (`aiToCanonical`)                                                                                                                                                                                                      | MVP Status                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Command Bar AI**                              | Context Builder prepares record data for prompts                                                                                                                                       | Tool handlers (`update_record`, `create_record`) call `aiToCanonical()` on each field value in the tool call payload                                                                                                              | **MVP**                      |
| **Smart Fill**                                  | Context Builder prepares record context via `canonicalToAIContext()`                                                                                                                   | AI-generated field value goes through `aiToCanonical()` before storage                                                                                                                                                            | **MVP**                      |
| **Record Summarization**                        | Record data prepared via `canonicalToAIContext()`                                                                                                                                      | N/A — summarization produces text output, not field values                                                                                                                                                                        | **MVP**                      |
| **Document AI Draft**                           | Record data injected into draft prompts via `canonicalToAIContext()`                                                                                                                   | AI-generated prose stored via Document Template merge-tag output — no canonical field write                                                                                                                                       | **MVP**                      |
| **Field & Link Suggestions**                    | Field names and sample values shown via `canonicalToAIContext()`                                                                                                                       | Suggestion output is schema metadata (field types, link targets), not canonical field values                                                                                                                                      | **MVP**                      |
| **Automation AI actions**                       | Trigger record data prepared via `canonicalToAIContext()`                                                                                                                              | Action outputs (e.g., "set field to AI-generated value") go through `aiToCanonical()`                                                                                                                                             | **MVP** (linear automations) |
| **AI Field Agents** **(Post-MVP)**              | Prompt Assembler resolves field refs → calls `canonicalToAIContext()` per field                                                                                                        | Output Validator calls `aiToCanonical()` per output type before storing in `canonical_data`                                                                                                                                       | **Post-MVP**                 |
| **AI Agents (goal-directed)** **(Post-MVP)**    | Same as Command Bar — Context Builder uses `canonicalToAIContext()`                                                                                                                    | Same as Command Bar — tool handlers use `aiToCanonical()`. Agent mutations go through the same write path.                                                                                                                        | **Post-MVP**                 |
| **Smart Docs AI content blocks** **(Post-MVP)** | Record data injected into AI content blocks via `canonicalToAIContext()`                                                                                                               | AI-generated content stored as TipTap JSON — goes through smart_doc's `aiToCanonical()`                                                                                                                                           | **Post-MVP**                 |
| **Document Intelligence** **(Post-MVP)**        | Table schema prepared via Schema Descriptor Service + `canonicalToAIContext()` for prompt assembly. File content (extracted text) and vision model output feed into extraction prompt. | Extracted field values pass through `aiToCanonical()` per target field type before record creation/update. Cross-Link fuzzy resolution uses `aiToCanonical()` for the `linked_record` field type. See `document-intelligence.md`. | **Post-MVP**                 |
| **Formula AI assistance** **(Post-MVP)**        | Field names and sample values shown via `canonicalToAIContext()`                                                                                                                       | N/A — formula AI generates expression strings, not field values                                                                                                                                                                   | **Post-MVP**                 |

---

## DuckDB Context Layer — The Exemption (Post-MVP)

> **Post-MVP per glossary:** The DuckDB analytical layer is explicitly excluded from MVP scope.

DuckDB does **not** go through `aiToCanonical()`. Its results are ephemeral analytical outputs that feed directly into LLM prompts as formatted text. The data flow is:

```
canonical JSONB → DuckDB type coercion (JSONB → DuckDB native types) → SQL computation → formatted result → LLM prompt
```

DuckDB's type coercion (defined in `duckdb-context-layer-ref.md` > "JSONB to DuckDB Type Coercion") is a **read-side presentation concern**, not a translation concern. DuckDB results never write back to `canonical_data`. If a future "write-through for AI Field Agents" extension is built (noted in DuckDB doc appendix), _that_ write path would use `aiToCanonical()`.

---

## Integration with Existing Validation

`aiToCanonical()` does **not** replace the FieldTypeRegistry's `validate()` function. The pipeline is:

```
Raw LLM output
  → aiToCanonical(rawOutput, fieldConfig)     // Coerce LLM text to canonical shape
  → validate(canonicalValue, fieldConfig)      // Enforce constraints: required, unique, max_length, etc.
  → store in canonical_data JSONB                // Same write path as user input
```

This means an AI-generated value that coerces successfully but violates a constraint (e.g., a unique field where the AI-generated value already exists) is caught at the validation step, not silently stored.

---

## Implementation Notes

1. **Register in FieldTypeRegistry.** Both functions become properties on each field type's registry entry, alongside `cell_renderer`, `validate`, `toTemplateValue`, etc.

2. **Shared across all AI features.** The Prompt Assembler, Output Validator, tool handlers, and automation AI actions all call these functions. No feature reimplements coercion logic.

3. **Tested per field type.** Unit tests cover every field type's round-trip: `canonical → canonicalToAIContext() → LLM simulation → aiToCanonical() → validate()`. Edge cases: empty values, malformed LLM output, boundary values, type-mismatch recovery.

4. **Graceful degradation.** `aiToCanonical()` returns warnings for lossy conversions (e.g., truncation, precision loss) and errors for impossible conversions. Callers decide how to handle — AI Field Agents **(post-MVP)** store null on error; Command Bar AI surfaces the error to the user.

5. **Single_select option ID vs label resolution.** This is the most common source of bugs. The LLM always sees and produces **labels** (human-readable). The canonical store uses **option IDs** (stable, rename-safe). `canonicalToAIContext()` resolves ID → label. `aiToCanonical()` resolves label → ID. If options are renamed between AI read and write, the label match fails gracefully.

---

## Phase Implementation

| Phase                               | AI Data Contract Work                                                                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Foundation**                | Define `canonicalToAIContext` and `aiToCanonical` function signatures on FieldTypeRegistry interface. Implement for text, number, single_select, checkbox (most common AI field types).                                                  |
| **MVP — Core UX**                   | Implement for all MVP field types. Prompt Assembler and Context Builder consume `canonicalToAIContext()`. **(Post-MVP field types — smart_doc, formula, dependency, sub_items, lookup, rollup — implemented when those features ship.)** |
| **Post-MVP — Automations**          | Automation AI actions consume `aiToCanonical()` for "set field" actions.                                                                                                                                                                 |
| **Post-MVP (Post-MVP — AI Agents)** | Tool handlers for `update_record` and `create_record` consume `aiToCanonical()` in agent context. AI Field Agent pipeline (Output Validator → `aiToCanonical()` → `validate()` → store).                                                 |
