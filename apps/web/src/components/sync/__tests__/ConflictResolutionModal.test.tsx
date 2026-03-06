// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictResolutionModal } from '../ConflictResolutionModal';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import type { ConflictItem, ConflictResolution } from '../conflict-types';

// Mock server action and undo toast (these are async server calls)
const mockResolveConflict = vi.fn().mockResolvedValue({ success: true, undoToken: 'mock-undo-token' });
const mockBulkResolveConflicts = vi.fn().mockResolvedValue({ success: true, undoToken: 'mock-bulk-undo-token', resolvedCount: 3 });

vi.mock('@/actions/sync-conflict-resolve', () => ({
  resolveConflict: (...args: unknown[]) => mockResolveConflict(...args),
  bulkResolveConflicts: (...args: unknown[]) => mockBulkResolveConflicts(...args),
}));

vi.mock('../UndoResolveToast', () => ({
  showUndoResolveToast: vi.fn(),
}));

vi.mock('@/lib/sync-conflict-store', () => ({
  useSyncConflictStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      removeConflict: vi.fn(),
      addConflict: vi.fn(),
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Polyfill ResizeObserver for ScrollArea (Radix)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() { /* noop */ }
      unobserve() { /* noop */ }
      disconnect() { /* noop */ }
    };
  }
});

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeConflict(overrides?: Partial<ConflictItem>): ConflictItem {
  return {
    id: 'conflict-1',
    fieldId: 'field-1',
    fieldName: 'Status',
    fieldType: 'singleSelect',
    platformFieldType: 'singleSelect',
    localValue: 'Complete',
    remoteValue: 'In Review',
    baseValue: 'In Progress',
    platform: 'airtable',
    createdAt: '2026-03-06T12:00:00Z',
    ...overrides,
  };
}

function makeConflicts(count: number): ConflictItem[] {
  const names = ['Status', 'Priority', 'Due Date', 'Assignee', 'Notes'];
  return Array.from({ length: count }, (_, i) => makeConflict({
    id: `conflict-${i}`,
    fieldId: `field-${i}`,
    fieldName: names[i % names.length],
    localValue: `local-${i}`,
    remoteValue: `remote-${i}`,
    baseValue: `base-${i}`,
  }));
}

function renderModal(overrides?: {
  open?: boolean;
  recordName?: string;
  conflicts?: ConflictItem[];
  onResolve?: (r: ConflictResolution[]) => void;
  onOpenChange?: (open: boolean) => void;
  tableId?: string;
  recordId?: string;
}) {
  const props = {
    open: overrides?.open ?? true,
    onOpenChange: overrides?.onOpenChange ?? vi.fn(),
    recordName: overrides?.recordName ?? 'Acme Project',
    conflicts: overrides?.conflicts ?? [makeConflict()],
    onResolve: overrides?.onResolve ?? vi.fn(),
    tableId: overrides?.tableId ?? 'table-uuid-1',
    recordId: overrides?.recordId ?? 'record-uuid-1',
  };

  return render(
    <IntlWrapper>
      <ConflictResolutionModal {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConflictResolutionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveConflict.mockResolvedValue({ success: true, undoToken: 'mock-undo-token' });
    mockBulkResolveConflicts.mockResolvedValue({ success: true, undoToken: 'mock-bulk-undo-token', resolvedCount: 3 });
  });

  // --- Single-field mode ---

  it('renders in single-field mode with field and record name in title', () => {
    renderModal();

    const modal = screen.getByTestId('conflict-resolution-modal');
    expect(modal).toBeInTheDocument();
    // Title contains both field name and record name via i18n template
    expect(screen.getByTestId('conflict-resolution-modal')).toHaveTextContent('Status');
    expect(screen.getByTestId('conflict-resolution-modal')).toHaveTextContent('Acme Project');
  });

  it('shows local, remote, and base values for single conflict', () => {
    renderModal();

    expect(screen.getByTestId('conflict-local-field-1')).toHaveTextContent('Complete');
    expect(screen.getByTestId('conflict-remote-field-1')).toHaveTextContent('In Review');
    expect(screen.getByTestId('conflict-resolution-modal')).toHaveTextContent('In Progress');
  });

  it('shows action buttons for single conflict', () => {
    renderModal();

    expect(screen.getByTestId('conflict-keep-local-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-keep-remote-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-edit-btn-field-1')).toBeInTheDocument();
  });

  it('does not show bulk actions in single-field mode', () => {
    renderModal();

    expect(screen.queryByTestId('conflict-bulk-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('conflict-scroll-area')).not.toBeInTheDocument();
  });

  it('Apply button is disabled until conflict is resolved', () => {
    renderModal();

    expect(screen.getByTestId('conflict-apply-btn')).toBeDisabled();
  });

  it('enables Apply after resolving the conflict', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('conflict-keep-local-field-1'));

    expect(screen.getByTestId('conflict-apply-btn')).not.toBeDisabled();
  });

  it('calls onResolve with resolution when Apply is clicked', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderModal({ onResolve });

    await user.click(screen.getByTestId('conflict-keep-local-field-1'));
    await user.click(screen.getByTestId('conflict-apply-btn'));

    expect(onResolve).toHaveBeenCalledWith([
      { conflictId: 'conflict-1', choice: 'keep_local' },
    ]);
  });

  // --- Multi-field mode ---

  it('renders in multi-field mode with count in title', () => {
    renderModal({ conflicts: makeConflicts(3) });

    expect(screen.getByTestId('conflict-resolution-modal')).toHaveTextContent('3 Conflicts');
    expect(screen.getByTestId('conflict-resolution-modal')).toHaveTextContent('Acme Project');
  });

  it('renders scrollable area with multiple conflict rows', () => {
    renderModal({ conflicts: makeConflicts(3) });

    expect(screen.getByTestId('conflict-scroll-area')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-row-field-0')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-row-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-row-field-2')).toBeInTheDocument();
  });

  it('renders bulk action bar in multi-field mode', () => {
    renderModal({ conflicts: makeConflicts(3) });

    expect(screen.getByTestId('conflict-bulk-actions')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-keep-all-local')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-keep-all-remote')).toBeInTheDocument();
  });

  it('Keep All EveryStack resolves all pending conflicts', async () => {
    const user = userEvent.setup();
    renderModal({ conflicts: makeConflicts(3) });

    await user.click(screen.getByTestId('conflict-keep-all-local'));

    // All three rows should show resolved badges
    expect(screen.getByTestId('conflict-resolved-badge-field-0')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-resolved-badge-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-resolved-badge-field-2')).toBeInTheDocument();

    // Apply should be enabled
    expect(screen.getByTestId('conflict-apply-btn')).not.toBeDisabled();
  });

  it('Keep All Remote resolves all pending conflicts', async () => {
    const user = userEvent.setup();
    renderModal({ conflicts: makeConflicts(3) });

    await user.click(screen.getByTestId('conflict-keep-all-remote'));

    expect(screen.getByTestId('conflict-resolved-badge-field-0')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-resolved-badge-field-1')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-resolved-badge-field-2')).toBeInTheDocument();
  });

  it('Apply sends all resolutions from multi-field mode', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderModal({ conflicts: makeConflicts(2), onResolve });

    await user.click(screen.getByTestId('conflict-keep-all-local'));
    await user.click(screen.getByTestId('conflict-apply-btn'));

    expect(onResolve).toHaveBeenCalledWith([
      { conflictId: 'conflict-0', choice: 'keep_local' },
      { conflictId: 'conflict-1', choice: 'keep_local' },
    ]);
  });

  it('bulk actions do not override already-resolved rows', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderModal({ conflicts: makeConflicts(2), onResolve });

    // Resolve first conflict individually with keep_remote
    await user.click(screen.getByTestId('conflict-keep-remote-field-0'));

    // Then bulk keep_all_local — should only affect field-1
    await user.click(screen.getByTestId('conflict-keep-all-local'));
    await user.click(screen.getByTestId('conflict-apply-btn'));

    const resolutions = onResolve.mock.calls[0]![0] as ConflictResolution[];
    const field0 = resolutions.find((r) => r.conflictId === 'conflict-0');
    const field1 = resolutions.find((r) => r.conflictId === 'conflict-1');

    expect(field0?.choice).toBe('keep_remote'); // preserved
    expect(field1?.choice).toBe('keep_local'); // bulk applied
  });

  // --- Bulk resolve Server Action wiring ---

  it('calls bulkResolveConflicts when all resolutions are the same direction', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderModal({ conflicts: makeConflicts(3), onResolve });

    await user.click(screen.getByTestId('conflict-keep-all-local'));
    await user.click(screen.getByTestId('conflict-apply-btn'));

    expect(mockBulkResolveConflicts).toHaveBeenCalledWith({
      recordId: 'record-uuid-1',
      tableId: 'table-uuid-1',
      resolution: 'resolved_local',
    });
    // Should NOT call individual resolveConflict
    expect(mockResolveConflict).not.toHaveBeenCalled();
  });

  it('calls individual resolveConflict when resolutions are mixed', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderModal({ conflicts: makeConflicts(2), onResolve });

    // Resolve first with keep_remote, second with keep_local
    await user.click(screen.getByTestId('conflict-keep-remote-field-0'));
    await user.click(screen.getByTestId('conflict-keep-local-field-1'));
    await user.click(screen.getByTestId('conflict-apply-btn'));

    expect(mockBulkResolveConflicts).not.toHaveBeenCalled();
    expect(mockResolveConflict).toHaveBeenCalledTimes(2);
  });

  it('calls individual resolveConflict for single conflict', async () => {
    const onResolve = vi.fn();
    const user = userEvent.setup();
    renderModal({ onResolve });

    await user.click(screen.getByTestId('conflict-keep-local-field-1'));
    await user.click(screen.getByTestId('conflict-apply-btn'));

    // Single conflict should always use individual resolve (not bulk)
    expect(mockResolveConflict).toHaveBeenCalledTimes(1);
    expect(mockBulkResolveConflicts).not.toHaveBeenCalled();
  });

  // --- Modal behavior ---

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderModal({ onOpenChange });

    await user.click(screen.getByTestId('conflict-cancel-btn'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render when open is false', () => {
    renderModal({ open: false });

    expect(screen.queryByTestId('conflict-resolution-modal')).not.toBeInTheDocument();
  });

  it('has touch-safe Apply and Cancel buttons', () => {
    renderModal();

    expect(screen.getByTestId('conflict-apply-btn').className).toContain('min-h-[44px]');
    expect(screen.getByTestId('conflict-cancel-btn').className).toContain('min-h-[44px]');
  });
});
