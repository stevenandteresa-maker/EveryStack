/**
 * Merge-tag resolution service — resolves mergeTag nodes in TipTap JSONB
 * content to actual field values from canonical_data and cross-links.
 *
 * Used at render time for PDF generation, portal read-only view, and
 * preview mode in the Smart Doc editor.
 *
 * @see docs/reference/smart-docs.md § Rendering Pipelines
 * @see docs/reference/smart-docs.md § Generation Flow
 */

import { generateHTML } from '@tiptap/html';
import type { JSONContent } from '@tiptap/core';
import { getRecordById } from '@/data/records';
import { getFieldsByTable } from '@/data/fields';
import { listCrossLinkDefinitions } from '@/data/cross-links';
import { resolveLinkedRecordsL1 } from '@/data/cross-link-resolution';
import { createSmartDocExtensions } from '@/components/editor/extensions';
import type { Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Display formatting — converts canonical values to human-readable strings
// ---------------------------------------------------------------------------

/**
 * Format a canonical field value for display in a resolved merge tag.
 *
 * Reads the `value` property from the canonical JSONB entry and converts
 * it to a display string based on field type.
 */
export function formatCanonicalValue(
  canonicalEntry: unknown,
  fieldType: string,
): string | null {
  if (canonicalEntry == null) return null;

  const entry = canonicalEntry as Record<string, unknown>;
  const value = entry.value;
  if (value == null) return null;

  switch (fieldType) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'url':
    case 'phone':
      return String(value);

    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);

    case 'currency': {
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(num)) return String(value);
      const currency = (entry.currency as string) ?? 'USD';
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
      } catch {
        return `${currency} ${num.toLocaleString()}`;
      }
    }

    case 'percent': {
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(num)) return String(value);
      return `${num}%`;
    }

    case 'rating':
      return String(value);

    case 'date':
    case 'datetime':
      return typeof value === 'string' ? new Date(value).toLocaleDateString() : String(value);

    case 'checkbox':
      return value ? 'Yes' : 'No';

    case 'single_select':
    case 'status': {
      if (typeof value === 'object' && value !== null) {
        return (value as Record<string, unknown>).label as string ?? String(value);
      }
      return String(value);
    }

    case 'multiple_select':
    case 'tag': {
      if (Array.isArray(value)) {
        return value
          .map((v) =>
            typeof v === 'object' && v !== null
              ? ((v as Record<string, unknown>).label as string) ?? String(v)
              : String(v),
          )
          .join(', ');
      }
      return String(value);
    }

    case 'people': {
      if (Array.isArray(value)) {
        return value
          .map((v) =>
            typeof v === 'object' && v !== null
              ? ((v as Record<string, unknown>).name as string) ?? String(v)
              : String(v),
          )
          .join(', ');
      }
      return String(value);
    }

    default:
      // Fallback: stringify non-null values
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}

// ---------------------------------------------------------------------------
// TipTap JSONB node walker
// ---------------------------------------------------------------------------

interface MergeTagAttrs {
  tableId: string;
  fieldId: string;
  fallback: string;
}

function isMergeTagNode(node: JSONContent): node is JSONContent & { attrs: MergeTagAttrs } {
  return node.type === 'mergeTag' && node.attrs != null;
}

/**
 * Deep-clone a TipTap JSONContent tree.
 */
function deepCloneContent(content: JSONContent): JSONContent {
  return JSON.parse(JSON.stringify(content)) as JSONContent;
}

/**
 * Walk all nodes in a TipTap JSONB tree, calling `visitor` on each.
 * Mutates in place — caller should deep-clone first.
 */
function walkNodes(node: JSONContent, visitor: (n: JSONContent) => void): void {
  visitor(node);
  if (node.content) {
    for (const child of node.content) {
      walkNodes(child, visitor);
    }
  }
}

// ---------------------------------------------------------------------------
// Core resolution
// ---------------------------------------------------------------------------

/**
 * Resolve all mergeTag nodes in a TipTap JSONB document to their actual
 * field values.
 *
 * 1. Deep-clones the content tree (never mutates the original).
 * 2. Walks all nodes, finds `mergeTag` nodes.
 * 3. For simple fields (tableId === record's table): reads canonical_data.
 * 4. For linked fields (different tableId): follows cross-link L0/L1.
 * 5. Formats values via field type and replaces the mergeTag node with
 *    a text node containing the resolved value (or the fallback).
 */
export async function resolveMergeTags(
  content: JSONContent,
  recordId: string,
  tenantId: string,
): Promise<JSONContent> {
  const resolved = deepCloneContent(content);

  // Collect all merge tag nodes to determine what data we need
  const mergeTags: Array<{ node: JSONContent; attrs: MergeTagAttrs }> = [];
  walkNodes(resolved, (node) => {
    if (isMergeTagNode(node)) {
      mergeTags.push({ node, attrs: node.attrs });
    }
  });

  if (mergeTags.length === 0) return resolved;

  // Load the source record
  const record = await getRecordById(tenantId, recordId);
  const canonicalData = record.canonicalData as Record<string, unknown>;
  const sourceTableId = record.tableId;

  // Build field type lookup for the source table
  const sourceFields = await getFieldsByTable(tenantId, sourceTableId);
  const sourceFieldMap = new Map<string, Field>(sourceFields.map((f) => [f.id, f]));

  // Identify linked table IDs that need resolution
  const linkedTableIds = new Set<string>();
  for (const { attrs } of mergeTags) {
    if (attrs.tableId !== sourceTableId) {
      linkedTableIds.add(attrs.tableId);
    }
  }

  // Pre-fetch cross-link definitions and linked record data
  const linkedRecordData = new Map<string, Record<string, unknown>>();
  const linkedFieldMaps = new Map<string, Map<string, Field>>();

  if (linkedTableIds.size > 0) {
    const crossLinks = await listCrossLinkDefinitions(tenantId, sourceTableId);

    for (const targetTableId of linkedTableIds) {
      // Find the cross-link that points to this target table
      const crossLink = crossLinks.find(
        (cl) => cl.targetTableId === targetTableId,
      );
      if (!crossLink) continue;

      // Resolve the first linked record via L1
      const linkedResult = await resolveLinkedRecordsL1(
        tenantId,
        recordId,
        crossLink.id,
        { limit: 1 },
      );

      if (linkedResult.records.length > 0) {
        const linkedRecord = linkedResult.records[0]!.record;
        linkedRecordData.set(
          targetTableId,
          linkedRecord.canonicalData as Record<string, unknown>,
        );
      }

      // Load fields for the linked table
      if (!linkedFieldMaps.has(targetTableId)) {
        const linkedFields = await getFieldsByTable(tenantId, targetTableId);
        linkedFieldMaps.set(
          targetTableId,
          new Map(linkedFields.map((f) => [f.id, f])),
        );
      }
    }
  }

  // Resolve each merge tag
  for (const { node, attrs } of mergeTags) {
    let displayValue: string | null = null;

    if (attrs.tableId === sourceTableId) {
      // Simple field — read from source record's canonical_data
      const field = sourceFieldMap.get(attrs.fieldId);
      const canonicalEntry = canonicalData[attrs.fieldId];
      displayValue = formatCanonicalValue(
        canonicalEntry,
        field?.fieldType ?? 'text',
      );
    } else {
      // Linked field — read from the linked record's canonical_data
      const linkedCanonical = linkedRecordData.get(attrs.tableId);
      if (linkedCanonical) {
        const fieldMap = linkedFieldMaps.get(attrs.tableId);
        const field = fieldMap?.get(attrs.fieldId);
        const canonicalEntry = linkedCanonical[attrs.fieldId];
        displayValue = formatCanonicalValue(
          canonicalEntry,
          field?.fieldType ?? 'text',
        );
      }
    }

    // Replace the mergeTag node with a text node
    const text = displayValue ?? attrs.fallback ?? '';
    node.type = 'text';
    node.text = text;
    delete node.attrs;
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

/**
 * Resolve merge tags and render the document to HTML.
 *
 * Two-step pipeline: resolve → generateHTML.
 * Used for PDF generation (Gotenberg) and portal read-only views.
 *
 * @see docs/reference/smart-docs.md § Rendering Pipelines
 */
export async function resolveAndRenderHTML(
  content: JSONContent,
  recordId: string,
  tenantId: string,
): Promise<string> {
  const resolvedContent = await resolveMergeTags(content, recordId, tenantId);
  const extensions = createSmartDocExtensions();
  return generateHTML(resolvedContent, extensions);
}
