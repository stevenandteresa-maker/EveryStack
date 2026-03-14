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
