/**
 * Schema Descriptor Service — barrel export.
 *
 * Re-exports all SDS types for consumption via @everystack/shared/ai/schema-descriptor.
 */
export type {
  FieldDescriptor,
  TableDescriptor,
  BaseDescriptor,
  LinkEdge,
  WorkspaceDescriptor,
} from './types';

export { mapFieldToDescriptor } from './field-mapper';
export { buildTableDescriptor } from './table-builder';
export { buildWorkspaceDescriptor } from './workspace-builder';
export { filterDescriptorByPermissions } from './permission-filter';
export { computeSchemaVersionHash } from './schema-hash';
export {
  SchemaDescriptorCache,
  SDS_CACHE_TTL,
  SCHEMA_MUTATION_EVENTS,
  PERMISSION_EVENTS,
  buildTier1Key,
  buildTier2Key,
} from './cache';
export { estimateTokens, condenseDescriptor } from './token-estimator';
export { SchemaDescriptorService } from './service';
