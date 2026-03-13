// ---------------------------------------------------------------------------
// Cross-Link Zod Schemas — validation for cross-link CRUD and linking ops.
//
// These schemas validate inputs for creating/updating cross-link definitions,
// linking/unlinking records, and scope filter configuration.
//
// @see docs/reference/cross-linking.md § Data Model
// @see packages/shared/sync/cross-link-types.ts for type definitions
// ---------------------------------------------------------------------------

import { z } from 'zod';

import { CROSS_LINK_LIMITS } from './cross-link-types';

// ---------------------------------------------------------------------------
// Link Scope Filter Schemas
// ---------------------------------------------------------------------------

/** Validates a single scope filter condition. */
export const linkScopeConditionSchema = z.object({
  field_id: z.string().uuid(),
  operator: z.enum([
    'eq',
    'neq',
    'in',
    'not_in',
    'contains',
    'is_empty',
    'is_not_empty',
  ]),
  value: z.unknown().optional(),
});

/** Validates the full scope filter (conditions + logic). */
export const linkScopeFilterSchema = z.object({
  conditions: z.array(linkScopeConditionSchema),
  logic: z.enum(['and', 'or']),
});

// ---------------------------------------------------------------------------
// Cross-Link Definition CRUD Schemas
// ---------------------------------------------------------------------------

/** Validates input for creating a new cross-link definition. */
export const createCrossLinkSchema = z.object({
  name: z.string().min(1).max(255),
  sourceTableId: z.string().uuid(),
  sourceFieldId: z.string().uuid(),
  targetTableId: z.string().uuid(),
  targetDisplayFieldId: z.string().uuid(),
  relationshipType: z.enum(['many_to_one', 'one_to_many']),
  reverseFieldId: z.string().uuid().optional(),
  linkScopeFilter: linkScopeFilterSchema.optional(),
  cardFields: z.array(z.string().uuid()).default([]),
  maxLinksPerRecord: z
    .number()
    .int()
    .min(1)
    .max(CROSS_LINK_LIMITS.MAX_LINKS_PER_RECORD)
    .default(CROSS_LINK_LIMITS.DEFAULT_LINKS_PER_RECORD),
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(CROSS_LINK_LIMITS.MAX_DEPTH)
    .default(CROSS_LINK_LIMITS.DEFAULT_DEPTH),
});

/** Inferred type for create input. */
export type CreateCrossLinkInput = z.infer<typeof createCrossLinkSchema>;

/**
 * Validates input for updating a cross-link definition.
 * All fields optional, but at least one must be provided.
 */
export const updateCrossLinkSchema = z
  .object({
    name: z.string().min(1).max(255),
    targetDisplayFieldId: z.string().uuid(),
    relationshipType: z.enum(['many_to_one', 'one_to_many']),
    reverseFieldId: z.string().uuid().nullable(),
    linkScopeFilter: linkScopeFilterSchema.nullable(),
    cardFields: z.array(z.string().uuid()),
    maxLinksPerRecord: z
      .number()
      .int()
      .min(1)
      .max(CROSS_LINK_LIMITS.MAX_LINKS_PER_RECORD),
    maxDepth: z
      .number()
      .int()
      .min(1)
      .max(CROSS_LINK_LIMITS.MAX_DEPTH),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

/** Inferred type for update input. */
export type UpdateCrossLinkInput = z.infer<typeof updateCrossLinkSchema>;

// ---------------------------------------------------------------------------
// Link / Unlink Record Schemas
// ---------------------------------------------------------------------------

/** Validates input for linking records to a cross-link. */
export const linkRecordsSchema = z.object({
  crossLinkId: z.string().uuid(),
  sourceRecordId: z.string().uuid(),
  targetRecordIds: z.array(z.string().uuid()).min(1).max(500),
});

/** Inferred type for link records input. */
export type LinkRecordsInput = z.infer<typeof linkRecordsSchema>;

/** Validates input for unlinking records from a cross-link. */
export const unlinkRecordsSchema = z.object({
  crossLinkId: z.string().uuid(),
  sourceRecordId: z.string().uuid(),
  targetRecordIds: z.array(z.string().uuid()).min(1).max(500),
});

/** Inferred type for unlink records input. */
export type UnlinkRecordsInput = z.infer<typeof unlinkRecordsSchema>;
