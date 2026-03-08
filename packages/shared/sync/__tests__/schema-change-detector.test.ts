import { describe, it, expect } from 'vitest';
import {
  detectSchemaChanges,
} from '../schema-change-detector';
import type {
  LocalFieldMapping,
  PlatformFieldDefinition,
} from '../schema-change-detector';

describe('detectSchemaChanges', () => {
  const makeLocalMapping = (overrides?: Partial<LocalFieldMapping>): LocalFieldMapping => ({
    fieldId: 'field-001',
    externalFieldId: 'fld001',
    externalFieldType: 'singleLineText',
    fieldName: 'Name',
    ...overrides,
  });

  const makePlatformField = (overrides?: Partial<PlatformFieldDefinition>): PlatformFieldDefinition => ({
    id: 'fld001',
    name: 'Name',
    type: 'singleLineText',
    ...overrides,
  });

  it('returns empty array when no changes detected', () => {
    const local = [makeLocalMapping()];
    const platform = [makePlatformField()];

    const changes = detectSchemaChanges(local, platform);

    expect(changes).toEqual([]);
  });

  it('detects field_type_changed', () => {
    const local = [makeLocalMapping({ externalFieldType: 'singleSelect' })];
    const platform = [makePlatformField({ type: 'number' })];

    const changes = detectSchemaChanges(local, platform);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      changeType: 'field_type_changed',
      fieldId: 'field-001',
      platformFieldId: 'fld001',
      oldSchema: { name: 'Name', type: 'singleSelect' },
      newSchema: { name: 'Name', type: 'number', options: {} },
    });
  });

  it('detects field_deleted', () => {
    const local = [makeLocalMapping()];
    const platform: PlatformFieldDefinition[] = [];

    const changes = detectSchemaChanges(local, platform);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      changeType: 'field_deleted',
      fieldId: 'field-001',
      platformFieldId: 'fld001',
      oldSchema: { name: 'Name', type: 'singleLineText' },
      newSchema: null,
    });
  });

  it('detects field_added', () => {
    const local: LocalFieldMapping[] = [];
    const platform = [makePlatformField({ id: 'fld002', name: 'Status', type: 'singleSelect' })];

    const changes = detectSchemaChanges(local, platform);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      changeType: 'field_added',
      fieldId: null,
      platformFieldId: 'fld002',
      oldSchema: null,
      newSchema: { name: 'Status', type: 'singleSelect', options: {} },
    });
  });

  it('detects field_renamed', () => {
    const local = [makeLocalMapping({ fieldName: 'Old Name' })];
    const platform = [makePlatformField({ name: 'New Name' })];

    const changes = detectSchemaChanges(local, platform);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      changeType: 'field_renamed',
      fieldId: 'field-001',
      platformFieldId: 'fld001',
      oldSchema: { name: 'Old Name', type: 'singleLineText' },
      newSchema: { name: 'New Name', type: 'singleLineText', options: {} },
    });
  });

  it('detects both type change and rename on the same field', () => {
    const local = [makeLocalMapping({ fieldName: 'Priority', externalFieldType: 'singleSelect' })];
    const platform = [makePlatformField({ name: 'Priority Level', type: 'number' })];

    const changes = detectSchemaChanges(local, platform);

    expect(changes).toHaveLength(2);
    const types = changes.map((c) => c.changeType);
    expect(types).toContain('field_type_changed');
    expect(types).toContain('field_renamed');
  });

  it('detects multiple changes across different fields', () => {
    const local = [
      makeLocalMapping({ fieldId: 'f1', externalFieldId: 'fld1', fieldName: 'Name', externalFieldType: 'singleLineText' }),
      makeLocalMapping({ fieldId: 'f2', externalFieldId: 'fld2', fieldName: 'Status', externalFieldType: 'singleSelect' }),
      makeLocalMapping({ fieldId: 'f3', externalFieldId: 'fld3', fieldName: 'Notes', externalFieldType: 'multilineText' }),
    ];
    const platform = [
      // fld1: unchanged
      makePlatformField({ id: 'fld1', name: 'Name', type: 'singleLineText' }),
      // fld2: deleted (not in platform)
      // fld3: type changed
      makePlatformField({ id: 'fld3', name: 'Notes', type: 'richText' }),
      // fld4: new field
      makePlatformField({ id: 'fld4', name: 'Deadline', type: 'date' }),
    ];

    const changes = detectSchemaChanges(local, platform);

    expect(changes).toHaveLength(3);
    const types = changes.map((c) => c.changeType);
    expect(types).toContain('field_deleted');
    expect(types).toContain('field_type_changed');
    expect(types).toContain('field_added');
  });

  it('preserves platform options in newSchema', () => {
    const local: LocalFieldMapping[] = [];
    const platform = [
      makePlatformField({
        id: 'fld002',
        name: 'Rating',
        type: 'rating',
        options: { max: 5, color: 'yellow' },
      }),
    ];

    const changes = detectSchemaChanges(local, platform);

    expect(changes[0]?.newSchema?.options).toEqual({ max: 5, color: 'yellow' });
  });

  it('handles empty inputs without errors', () => {
    expect(detectSchemaChanges([], [])).toEqual([]);
  });
});
