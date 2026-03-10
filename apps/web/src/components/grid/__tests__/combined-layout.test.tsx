// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { GridRecordViewLayout } from '../GridRecordViewLayout';
import type { RecordViewProps } from '@/components/record-view/RecordView';

// Mock RecordView to avoid rendering full component tree
vi.mock('@/components/record-view/RecordView', () => ({
  RecordView: ({ isOpen, onClose, inline }: RecordViewProps) =>
    isOpen ? (
      <div data-testid="record-view" data-inline={inline}>
        <button data-testid="rv-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

// Mock useMediaQuery
const mockUseMediaQuery = vi.fn(() => false);
vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: () => mockUseMediaQuery(),
}));

const mockRecord = {
  id: 'rec-1',
  tableId: 'tbl-1',
  tenantId: 'tenant-1',
  createdBy: 'user-1',
  updatedBy: null,
  canonicalData: {},
  syncMetadata: null,
  searchVector: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseRecordViewProps: Omit<RecordViewProps, 'isOpen' | 'onClose'> = {
  record: mockRecord,
  fields: [],
  layout: { columns: 2, fields: [], tabs: [] },
  tableName: 'Tasks',
  viewName: 'Grid',
  tableId: 'tbl-1',
  viewId: 'vw-1',
  recordIds: ['rec-1', 'rec-2'],
  currentRecordId: 'rec-1',
  onNavigate: vi.fn(),
};

function renderLayout(overrides: Partial<React.ComponentProps<typeof GridRecordViewLayout>> = {}) {
  const defaultProps = {
    isRecordViewOpen: false,
    recordViewProps: baseRecordViewProps,
    onCloseRecordView: vi.fn(),
    children: <div data-testid="grid-content">Grid</div>,
    ...overrides,
  };
  return render(
    <IntlWrapper>
      <GridRecordViewLayout {...defaultProps} />
    </IntlWrapper>,
  );
}

describe('GridRecordViewLayout', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(false); // Desktop
  });

  it('renders only grid when Record View is closed', () => {
    renderLayout();
    expect(screen.getByTestId('grid-content')).toBeInTheDocument();
    expect(screen.queryByTestId('record-view')).not.toBeInTheDocument();
  });

  it('renders grid and Record View side by side when open (desktop)', () => {
    renderLayout({ isRecordViewOpen: true });
    expect(screen.getByTestId('grid-content')).toBeInTheDocument();
    expect(screen.getByTestId('record-view')).toBeInTheDocument();
  });

  it('renders Record View in inline mode on desktop', () => {
    renderLayout({ isRecordViewOpen: true });
    const rv = screen.getByTestId('record-view');
    expect(rv.dataset.inline).toBe('true');
  });

  it('dims the grid when Record View is open', () => {
    renderLayout({ isRecordViewOpen: true });
    const gridArea = screen.getByTestId('grid-content').parentElement;
    expect(gridArea?.style.opacity).toBe('0.6');
  });

  it('grid stays interactive (no pointer-events-none on grid container)', () => {
    renderLayout({ isRecordViewOpen: true });
    const gridArea = screen.getByTestId('grid-content').parentElement;
    expect(gridArea?.className).not.toContain('pointer-events-none');
  });

  it('calls onCloseRecordView when Record View close is clicked', () => {
    const onClose = vi.fn();
    renderLayout({ isRecordViewOpen: true, onCloseRecordView: onClose });
    fireEvent.click(screen.getByTestId('rv-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders Record Thread placeholder panel when showThreadPanel is true', () => {
    renderLayout({ isRecordViewOpen: true, showThreadPanel: true });
    expect(screen.getByText(/record thread will be available soon/i)).toBeInTheDocument();
  });

  it('calls onToggleThreadPanel when thread close is clicked', () => {
    const onToggle = vi.fn();
    renderLayout({
      isRecordViewOpen: true,
      showThreadPanel: true,
      onToggleThreadPanel: onToggle,
    });
    fireEvent.click(screen.getByLabelText(/close thread/i));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not show thread panel when showThreadPanel is false', () => {
    renderLayout({ isRecordViewOpen: true, showThreadPanel: false });
    expect(screen.queryByText(/record thread will be available soon/i)).not.toBeInTheDocument();
  });

  describe('mobile behavior', () => {
    beforeEach(() => {
      mockUseMediaQuery.mockReturnValue(true); // Mobile
    });

    it('renders grid and RecordView stacked on mobile', () => {
      renderLayout({ isRecordViewOpen: true });
      expect(screen.getByTestId('grid-content')).toBeInTheDocument();
      expect(screen.getByTestId('record-view')).toBeInTheDocument();
    });

    it('does not render inline on mobile (RecordView handles its own full-screen sheet)', () => {
      renderLayout({ isRecordViewOpen: true });
      const rv = screen.getByTestId('record-view');
      // On mobile, inline is not passed (RecordView shows full-screen)
      expect(rv.dataset.inline).not.toBe('true');
    });
  });
});
