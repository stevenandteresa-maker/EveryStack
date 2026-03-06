// ---------------------------------------------------------------------------
// Conflict resolution UI types — shared across ConflictResolutionModal,
// ConflictFieldRow, and ConflictResolutionActions.
//
// These mirror the DB shape (sync_conflicts) plus field metadata
// needed for display. The resolution callback signature matches what
// the future Server Action (Prompt 10) will implement.
// ---------------------------------------------------------------------------

import type { SyncPlatform } from '@everystack/shared/sync';

/**
 * A single field-level conflict enriched with display metadata.
 * Derived from the `sync_conflicts` row + joined `fields` row.
 */
export interface ConflictItem {
  /** sync_conflicts.id */
  id: string;
  /** The EveryStack field UUID. */
  fieldId: string;
  /** Human-readable field name (from fields.name). */
  fieldName: string;
  /** The field type key (e.g. 'singleLineText', 'singleSelect'). */
  fieldType: string;
  /** Platform-specific field type for FieldTypeRegistry lookup. */
  platformFieldType: string;
  /** Value in canonical_data before the conflict (local edit). */
  localValue: unknown;
  /** Incoming value from the platform. */
  remoteValue: unknown;
  /** Last-synced value (common ancestor). */
  baseValue: unknown;
  /** Source platform. */
  platform: SyncPlatform;
  /** When the conflict was detected. */
  createdAt: string;
  /** Who changed locally (display name), if known. */
  localChangedBy?: string;
  /** When the local change was made, if known. */
  localChangedAt?: string;
}

/** Resolution choice for a single conflict. */
export type ResolutionChoice = 'keep_local' | 'keep_remote' | 'edit';

/** Resolution decision for a single conflict. */
export interface ConflictResolution {
  /** sync_conflicts.id */
  conflictId: string;
  /** Which choice the user made. */
  choice: ResolutionChoice;
  /** If choice === 'edit', the user-provided merged value. */
  editedValue?: unknown;
}

/** State of a single conflict row within the modal. */
export interface ConflictRowState {
  /** The conflict item data. */
  conflict: ConflictItem;
  /** Current resolution, or null if pending. */
  resolution: ConflictResolution | null;
  /** Whether the user is in edit mode for this row. */
  isEditing: boolean;
}

/** Props for the resolution modal. */
export interface ConflictResolutionModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Callback to close the modal. */
  onOpenChange: (open: boolean) => void;
  /** Record name for display in the header. */
  recordName: string;
  /** The conflicts to resolve. */
  conflicts: ConflictItem[];
  /** Called when the user confirms all resolutions. */
  onResolve: (resolutions: ConflictResolution[]) => void;
}
