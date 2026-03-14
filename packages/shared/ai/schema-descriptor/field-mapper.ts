/**
 * SDS Field-to-Descriptor Mapper — maps a Drizzle Field row to a FieldDescriptor.
 *
 * Uses Record<string, ...> maps for searchable/aggregatable flags instead of
 * switch statements, per EveryStack conventions (FieldTypeRegistry pattern).
 *
 * @see docs/reference/schema-descriptor-service.md § Output Schema
 */

import type { Field } from '../../db/schema/fields';
import type { CrossLink } from '../../db/schema/cross-links';
import type { FieldDescriptor } from './types';

/**
 * Field types suitable for WHERE clause filtering or full-text search.
 * Guides the LLM toward efficient query plans.
 */
const SEARCHABLE_TYPES: Record<string, true> = {
  text: true,
  email: true,
  url: true,
  phone: true,
  rich_text: true,
};

/**
 * Field types where SUM/AVG/MIN/MAX operations are meaningful.
 * Prevents the LLM from attempting aggregations on non-numeric fields.
 */
const AGGREGATABLE_TYPES: Record<string, true> = {
  number: true,
  currency: true,
  percent: true,
  duration: true,
  rating: true,
};

/**
 * Select field types that carry an options array in field.config.
 */
const SELECT_TYPES: Record<string, true> = {
  single_select: true,
  multiple_select: true,
};

/**
 * Maps a Drizzle Field row to an LLM-optimized FieldDescriptor.
 *
 * @param field - Drizzle select type for the `fields` table
 * @param crossLinkDef - Optional Drizzle select type for the `cross_links` table,
 *   required to populate linked_record metadata (linked_table, cardinality, symmetric_field)
 * @returns FieldDescriptor ready for SDS output
 */
export function mapFieldToDescriptor(
  field: Field,
  crossLinkDef?: CrossLink,
): FieldDescriptor {
  const fieldType = field.fieldType;

  const descriptor: FieldDescriptor = {
    field_id: field.id,
    name: field.name,
    type: fieldType,
    searchable: fieldType in SEARCHABLE_TYPES,
    aggregatable: fieldType in AGGREGATABLE_TYPES,
  };

  // Select fields: extract options labels from field.config JSONB
  if (fieldType in SELECT_TYPES) {
    const config = field.config as Record<string, unknown> | null;
    if (config && Array.isArray(config.options)) {
      descriptor.options = (config.options as Array<{ label?: string }>).map(
        (opt) => (typeof opt === 'string' ? opt : opt.label ?? ''),
      );
    }
  }

  // Currency fields: extract currency_code from field.config JSONB
  if (fieldType === 'currency') {
    const config = field.config as Record<string, unknown> | null;
    if (config && typeof config.currency_code === 'string') {
      descriptor.currency_code = config.currency_code;
    }
  }

  // Linked record fields: populate cross-link metadata when available
  if (fieldType === 'linked_record' && crossLinkDef) {
    descriptor.linked_table = crossLinkDef.targetTableId;
    descriptor.cardinality = crossLinkDef.relationshipType as
      | 'many_to_one'
      | 'one_to_many';
    if (crossLinkDef.reverseFieldId) {
      descriptor.symmetric_field = crossLinkDef.reverseFieldId;
    }
  }

  return descriptor;
}
