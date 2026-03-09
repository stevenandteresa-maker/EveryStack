// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncFilterEditor } from '../SyncFilterEditor';
import type { SyncFilterEditorProps } from '../SyncFilterEditor';
import type { FilterField } from '../SyncFilterBuilder';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateSyncFilter = vi.fn().mockResolvedValue({ jobId: 'job-1' });
const mockEstimateFilteredRecordCount = vi.fn().mockResolvedValue({
  count: 100,
  isExact: false,
  quotaRemaining: 5000,
  quotaAllowed: true,
});

vi.mock('@/actions/sync-filters', () => ({
  updateSyncFilter: (...args: unknown[]) => mockUpdateSyncFilter(...args),
  estimateFilteredRecordCount: (...args: unknown[]) =>
    mockEstimateFilteredRecordCount(...args),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testFields: FilterField[] = [
  { id: 'field-1', name: 'Name', type: 'text' },
  { id: 'field-2', name: 'Status', type: 'single_select' },
  { id: 'field-3', name: 'Amount', type: 'number' },
];

const defaultProps: SyncFilterEditorProps = {
  connectionId: 'conn-123',
  tableId: 'ext-table-001',
  tableName: 'Contacts',
  currentFilter: null,
  syncedRecordCount: 150,
  estimatedTotalCount: 200,
  fields: testFields,
  baseId: 'appXYZ',
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

function renderEditor(overrides?: Partial<SyncFilterEditorProps>) {
  const props = { ...defaultProps, ...overrides };
  return render(
    <IntlWrapper>
      <SyncFilterEditor {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncFilterEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set defaults after clearAllMocks resets implementations
    mockUpdateSyncFilter.mockResolvedValue({ jobId: 'job-1' });
    mockEstimateFilteredRecordCount.mockResolvedValue({
      count: 100,
      isExact: false,
      quotaRemaining: 5000,
      quotaAllowed: true,
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders current sync status counts', () => {
    renderEditor();

    expect(screen.getByTestId('current-sync-status')).toHaveTextContent(
      'Currently syncing: 150 of 200 records',
    );
  });

  it('renders SyncFilterBuilder in ES mode', () => {
    renderEditor();

    expect(screen.getByTestId('sync-filter-builder')).toBeInTheDocument();
  });

  it('shows "no filter" message when no filters are set', () => {
    renderEditor();

    expect(
      screen.getByText('No filter applied — syncing all records.'),
    ).toBeInTheDocument();
  });

  it('shows Save & Re-sync and Cancel buttons', () => {
    renderEditor();

    expect(screen.getByTestId('save-button')).toHaveTextContent(
      'Save & Re-sync',
    );
    expect(screen.getByTestId('cancel-button')).toHaveTextContent('Cancel');
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderEditor({ onCancel });

    await user.click(screen.getByTestId('cancel-button'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls updateSyncFilter on save click', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderEditor({ onSave });

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(mockUpdateSyncFilter).toHaveBeenCalledWith({
        connectionId: 'conn-123',
        tableId: 'ext-table-001',
        newFilter: [],
      });
    });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  it('debounces estimate fetch on filter change', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderEditor();

    // Click "Add filter" to trigger filter change
    await user.click(screen.getByText('Add filter'));

    // Estimate not called yet (debounce)
    expect(mockEstimateFilteredRecordCount).not.toHaveBeenCalled();

    // Advance past debounce interval
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(mockEstimateFilteredRecordCount).toHaveBeenCalledTimes(1);
    });
  });

  it('disables save when quota exceeded', async () => {
    mockEstimateFilteredRecordCount.mockResolvedValue({
      count: 6000,
      isExact: false,
      quotaRemaining: 100,
      quotaAllowed: false,
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderEditor({
      currentFilter: [
        { fieldId: 'field-1', operator: 'equals', value: 'test', conjunction: 'and' },
      ],
    });

    // Click "Add filter" to add another filter and trigger estimate
    await user.click(screen.getByText('Add filter'));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(screen.getByTestId('save-button')).toBeDisabled();
    });

    expect(screen.getByTestId('quota-exceeded')).toBeInTheDocument();
  });

  it('shows quota remaining when available', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();

    renderEditor({
      currentFilter: [
        { fieldId: 'field-1', operator: 'equals', value: 'test', conjunction: 'and' as const },
      ],
    });

    // Trigger filter change to fetch estimate
    await user.click(screen.getByText('Add filter'));

    // Wait for debounce (500ms) + async estimate resolution
    await waitFor(
      () => {
        expect(screen.getByTestId('quota-remaining')).toHaveTextContent(
          'Record quota: 5000 remaining',
        );
      },
      { timeout: 2000 },
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('shows loading state during save', async () => {
    // Make the save hang
    mockUpdateSyncFilter.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderEditor();

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(screen.getByTestId('save-button')).toBeDisabled();
    });
  });

  it('shows save error on failure', async () => {
    mockUpdateSyncFilter.mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderEditor();

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(screen.getByTestId('save-error')).toHaveTextContent(
        'Failed to save filter. Please try again.',
      );
    });
  });
});
