// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { BulkActionsToolbar } from '../BulkActionsToolbar';
import type { GridField } from '@/lib/types/grid';

const mockFields: GridField[] = [
  {
    id: 'f1',
    name: 'Name',
    fieldType: 'text',
    isPrimary: true,
    isSystem: false,
    readOnly: false,
    sortOrder: 0,
  },
  {
    id: 'f2',
    name: 'Status',
    fieldType: 'single_select',
    isPrimary: false,
    isSystem: false,
    readOnly: false,
    sortOrder: 1,
  },
] as GridField[];

function renderToolbar(overrides: Partial<React.ComponentProps<typeof BulkActionsToolbar>> = {}) {
  const defaultProps = {
    selectedCount: 3,
    fields: mockFields,
    onDelete: vi.fn(),
    onBulkUpdateField: vi.fn(),
    onDuplicate: vi.fn(),
    onCopy: vi.fn(),
    onClearSelection: vi.fn(),
    ...overrides,
  };
  return { ...render(
    <IntlWrapper>
      <BulkActionsToolbar {...defaultProps} />
    </IntlWrapper>,
  ), props: defaultProps };
}

describe('BulkActionsToolbar', () => {
  it('returns null when selectedCount < 2', () => {
    const { container } = renderToolbar({ selectedCount: 1 });
    expect(container.innerHTML).toBe('');
  });

  it('renders standard toolbar with labels by default', () => {
    renderToolbar();
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  describe('compact mode', () => {
    it('renders count as badge', () => {
      renderToolbar({ compact: true });
      const badge = screen.getByText('3');
      expect(badge.className).toContain('rounded-full');
    });

    it('renders icon-only buttons without text labels', () => {
      renderToolbar({ compact: true });
      // No text labels visible
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
      expect(screen.queryByText('Duplicate')).not.toBeInTheDocument();
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('has aria-labels on compact buttons', () => {
      renderToolbar({ compact: true });
      expect(screen.getByLabelText('Delete')).toBeInTheDocument();
      expect(screen.getByLabelText('Duplicate')).toBeInTheDocument();
      expect(screen.getByLabelText('Copy')).toBeInTheDocument();
    });

    it('shows delete confirmation dialog on click', () => {
      renderToolbar({ compact: true });
      fireEvent.click(screen.getByLabelText('Delete'));
      expect(screen.getByText('Delete records')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete 3 records/)).toBeInTheDocument();
    });

    it('calls onDelete after confirmation', () => {
      const { props } = renderToolbar({ compact: true });
      fireEvent.click(screen.getByLabelText('Delete'));
      // Click confirm in dialog
      const confirmButtons = screen.getAllByText('Delete');
      const dialogConfirm = confirmButtons[confirmButtons.length - 1];
      if (dialogConfirm) fireEvent.click(dialogConfirm);
      expect(props.onDelete).toHaveBeenCalledTimes(1);
    });

    it('does not show edit field popover', () => {
      renderToolbar({ compact: true });
      expect(screen.queryByText('Edit field')).not.toBeInTheDocument();
    });
  });

  describe('standard mode', () => {
    it('shows bulk delete confirmation dialog', () => {
      renderToolbar();
      fireEvent.click(screen.getByText('Delete'));
      expect(screen.getByText('Delete records')).toBeInTheDocument();
    });

    it('calls onClearSelection when X clicked', () => {
      const { props } = renderToolbar();
      fireEvent.click(screen.getByLabelText('Clear selection'));
      expect(props.onClearSelection).toHaveBeenCalledTimes(1);
    });
  });
});
