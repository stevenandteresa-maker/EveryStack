/**
 * Cross-link display value cascade — stub module.
 *
 * When a target record's display field changes, all source records
 * referencing it need their denormalized display_value updated.
 * This module will enqueue BullMQ jobs to process those cascades.
 *
 * @see docs/reference/cross-linking.md § Display Value Cascade
 */

export async function enqueueCascadeJob(
  _tenantId: string,
  _targetRecordId: string,
  _priority: 'high' | 'low',
): Promise<void> {
  // TODO: Unit 4 — implement BullMQ cascade processor
}
