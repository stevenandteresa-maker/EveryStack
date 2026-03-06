// ---------------------------------------------------------------------------
// Airtable Selection Category Transforms (Category 3)
//
// Transforms for: single_select, multiple_select, status, tag
// Airtable types: singleSelect, multipleSelects, (status via singleSelect), multipleSelects
//
// Selection types use source_refs for lossless round-tripping:
// Airtable identifies select options by label string, while EveryStack
// uses internal option IDs. source_refs.airtable preserves the original label.
// ---------------------------------------------------------------------------

import type {
  FieldTransform,
  PlatformFieldConfig,
  CanonicalValue,
  SelectOption,
  StatusCategory,
} from '../../types';

/**
 * Generate a deterministic placeholder option ID for unrecognized Airtable values.
 * Uses a simple hash of the label to produce a repeatable ID.
 */
function generatePlaceholderOptionId(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    const char = label.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `es_opt_unsynced_${hex}`;
}

/**
 * Look up an ES option by Airtable label from the field config options array.
 * Returns the matching option, or creates a placeholder if not found.
 */
function resolveOptionByLabel(
  label: string,
  config: PlatformFieldConfig,
): SelectOption {
  const options = (config.options?.options ?? config.fieldConfig?.options) as
    | SelectOption[]
    | undefined;

  if (options) {
    const match = options.find(
      (opt) => opt.label === label || opt.source_refs?.airtable === label,
    );
    if (match) {
      return match;
    }
  }

  // Unrecognized value — create placeholder with generated ID, flagged for schema sync review
  return {
    id: generatePlaceholderOptionId(label),
    label,
    source_refs: { airtable: label },
  };
}

// ---------------------------------------------------------------------------
// Transform definitions
// ---------------------------------------------------------------------------

/** singleSelect → single_select (lossless with source_refs) */
export const airtableSingleSelectTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'single_select', value: null };

    const label = String(value);
    const option = resolveOptionByLabel(label, config);

    return {
      type: 'single_select',
      value: {
        id: option.id,
        label: option.label,
        source_refs: { airtable: label },
      },
    };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'single_select') return null;
    if (canonical.value == null) return null;

    // Recover the original Airtable label from source_refs
    return canonical.value.source_refs?.airtable ?? canonical.value.label;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** multipleSelects → multiple_select (lossless with source_refs) */
export const airtableMultipleSelectTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    if (value == null || !Array.isArray(value)) {
      return { type: 'multiple_select', value: [] };
    }

    const items = value.map((label: unknown) => {
      const labelStr = String(label);
      const option = resolveOptionByLabel(labelStr, config);
      return {
        id: option.id,
        label: option.label,
        source_refs: { airtable: labelStr },
      };
    });

    return { type: 'multiple_select', value: items };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'multiple_select') return null;
    if (!canonical.value || canonical.value.length === 0) return [];

    // Recover original Airtable labels from source_refs
    return canonical.value.map(
      (item) => item.source_refs?.airtable ?? item.label,
    );
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * singleSelect (status) → status (lossless with source_refs)
 * Same as single_select but maps to status category if config provides categories.
 */
export const airtableStatusTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'status', value: null };

    const label = String(value);
    const option = resolveOptionByLabel(label, config);

    // Resolve status category from field config
    const categories = (config.options?.categories ?? config.fieldConfig?.categories) as
      | Record<string, StatusCategory>
      | undefined;
    const doneValues = (config.options?.done_values ?? config.fieldConfig?.done_values) as
      | string[]
      | undefined;

    let category: StatusCategory = 'not_started';
    const mappedCategory = categories?.[option.id];
    if (mappedCategory) {
      category = mappedCategory;
    } else if (doneValues?.includes(option.id)) {
      category = 'done';
    }

    return {
      type: 'status',
      value: {
        id: option.id,
        label: option.label,
        category,
        source_refs: { airtable: label },
      },
    };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'status') return null;
    if (canonical.value == null) return null;

    // Recover the original Airtable label from source_refs
    return canonical.value.source_refs?.airtable ?? canonical.value.label;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** multipleSelects (tags) → tag (lossless passthrough as string array) */
export const airtableTagTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null || !Array.isArray(value)) {
      return { type: 'tag', value: [] };
    }
    return { type: 'tag', value: value.map(String) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'tag') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_SELECTION_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'singleSelect', transform: airtableSingleSelectTransform },
  { airtableType: 'multipleSelects', transform: airtableMultipleSelectTransform },
  { airtableType: 'status', transform: airtableStatusTransform },
  { airtableType: 'tag', transform: airtableTagTransform },
];
