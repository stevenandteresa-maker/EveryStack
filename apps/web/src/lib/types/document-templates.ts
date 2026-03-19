/**
 * Document template types for merge-tag resolution and rendering.
 *
 * @see docs/reference/smart-docs.md § Custom EveryStack Node Definitions
 */

/**
 * Describes a field available for merge-tag insertion in the template editor.
 *
 * Simple fields reference the source record's table directly.
 * Linked fields reference a cross-linked table — resolution follows
 * the cross-link to extract the target record's field value.
 */
export interface MergeTagField {
  /** UUID of the field. */
  fieldId: string;
  /** UUID of the table the field belongs to. */
  tableId: string;
  /** Human-readable field name (for editor pill display). */
  fieldName: string;
  /** Canonical field type (text, number, date, etc.). */
  fieldType: string;
  /** Whether this field is on a cross-linked table (not the source table). */
  isLinked: boolean;
  /**
   * UUID of the cross-link definition that connects source → target table.
   * Present only when `isLinked` is true.
   */
  crossLinkId?: string;
}
