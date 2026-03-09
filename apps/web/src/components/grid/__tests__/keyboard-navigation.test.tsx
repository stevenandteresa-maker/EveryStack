// @vitest-environment jsdom
/**
 * Keyboard navigation and cell error overlay tests.
 *
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 7
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import { useKeyboardNavigation } from '../use-keyboard-navigation';
import { CellErrorOverlay } from '../CellErrorOverlay';
import { KeyboardShortcutsDialog } from '../KeyboardShortcutsDialog';
import type { KeyboardNavigationOptions } from '../use-keyboard-navigation';
import type { CellErrorInfo } from '../CellErrorOverlay';
import type { GridField, GridRecord } from '../../../lib/types/grid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<GridField> & { id: string; name: string }): GridField {
  return {
    tableId: 't1',
    tenantId: 'ten1',
    fieldType: 'text',
    fieldSubType: null,
    isPrimary: false,
    isSystem: false,
    required: false,
    unique: false,
    readOnly: false,
    config: {},
    display: {},
    permissions: {},
    defaultValue: null,
    description: null,
    sortOrder: 0,
    externalFieldId: null,
    environment: 'live' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GridField;
}

function makeRecord(id: string, data: Record<string, unknown> = {}): GridRecord {
  return {
    id,
    tableId: 't1',
    tenantId: 'ten1',
    canonicalData: data,
    syncMetadata: {},
    searchVector: null,
    archivedAt: null,
    createdBy: 'u1',
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as GridRecord;
}

const fields: GridField[] = [
  makeField({ id: 'f1', name: 'Name', isPrimary: true }),
  makeField({ id: 'f2', name: 'Email' }),
  makeField({ id: 'f3', name: 'Status', fieldType: 'checkbox' }),
  makeField({ id: 'f4', name: 'Notes', readOnly: true }),
];

const records: GridRecord[] = [
  makeRecord('r1', { f1: 'Alice', f2: 'a@b.com', f3: true }),
  makeRecord('r2', { f1: 'Bob', f2: 'b@c.com', f3: false }),
  makeRecord('r3', { f1: 'Carol', f2: 'c@d.com', f3: true }),
];

function createOptions(overrides?: Partial<KeyboardNavigationOptions>): KeyboardNavigationOptions {
  return {
    fields,
    records,
    activeCell: null,
    editingCell: null,
    visibleRowCount: 10,
    setActiveCell: vi.fn(),
    startEditing: vi.fn(),
    stopEditing: vi.fn(),
    onCellSave: vi.fn(),
    selectedRows: new Set<string>(),
    setSelectedRows: vi.fn(),
    selectionAnchor: null,
    setSelectionAnchor: vi.fn(),
    selectionRange: null,
    setSelectionRange: vi.fn(),
    onAddRecord: vi.fn(),
    onOpenShortcutsHelp: vi.fn(),
    scrollToCell: vi.fn(),
    ...overrides,
  };
}

/**
 * Simulate a keyboard event by rendering a div with the hook's handler
 * and dispatching a keydown event.
 */
function TestHarness({ options }: { options: KeyboardNavigationOptions }) {
  const { handleKeyDown } = useKeyboardNavigation(options);
  return (
    <div data-testid="grid" tabIndex={0} onKeyDown={handleKeyDown}>
      grid
    </div>
  );
}

function renderHarness(options: KeyboardNavigationOptions) {
  return render(
    <IntlWrapper>
      <TestHarness options={options} />
    </IntlWrapper>,
  );
}

function pressKey(
  el: HTMLElement,
  key: string,
  modifiers: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {},
) {
  fireEvent.keyDown(el, { key, ...modifiers });
}

// ---------------------------------------------------------------------------
// Keyboard Navigation Tests
// ---------------------------------------------------------------------------

describe('useKeyboardNavigation', () => {
  describe('Arrow key navigation', () => {
    it('moves active cell down on ArrowDown', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowDown');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r2', fieldId: 'f1' });
    });

    it('moves active cell up on ArrowUp', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r2', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowUp');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
    });

    it('moves active cell right on ArrowRight', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowRight');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f2' });
    });

    it('moves active cell left on ArrowLeft', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f2' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowLeft');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
    });

    it('clamps at grid boundaries', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowUp');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
    });

    it('scrolls to cell on arrow navigation', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowDown');
      expect(opts.scrollToCell).toHaveBeenCalledWith(1, 0);
    });
  });

  describe('Tab navigation', () => {
    it('moves to next cell on Tab', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Tab');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f2' });
    });

    it('wraps to next row on Tab at last column', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f4' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Tab');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r2', fieldId: 'f1' });
    });

    it('moves to previous cell on Shift+Tab', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f2' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Tab', { shiftKey: true });
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
    });

    it('wraps to previous row on Shift+Tab at first column', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r2', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Tab', { shiftKey: true });
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f4' });
    });
  });

  describe('Enter / Escape', () => {
    it('Enter starts editing active cell', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Enter');
      expect(opts.startEditing).toHaveBeenCalledWith(
        { rowId: 'r1', fieldId: 'f1' },
        'edit',
      );
    });

    it('Enter while editing stops editing and moves down', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
        editingCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Enter');
      expect(opts.stopEditing).toHaveBeenCalled();
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r2', fieldId: 'f1' });
    });

    it('Escape cancels editing', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
        editingCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Escape');
      expect(opts.stopEditing).toHaveBeenCalled();
    });

    it('Escape deselects active cell when not editing', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Escape');
      expect(opts.setActiveCell).toHaveBeenCalledWith(null);
    });
  });

  describe('Home / End', () => {
    it('Home moves to first column', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f3' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Home');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
    });

    it('End moves to last column', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'End');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f4' });
    });

    it('Cmd+Home moves to first row, first column', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r3', fieldId: 'f3' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Home', { metaKey: true });
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
    });

    it('Cmd+End moves to last row, last column', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'End', { metaKey: true });
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r3', fieldId: 'f4' });
    });
  });

  describe('Page Up / Page Down', () => {
    it('PageDown moves down by visibleRowCount', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
        visibleRowCount: 2,
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'PageDown');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r3', fieldId: 'f1' });
    });

    it('PageUp moves up by visibleRowCount', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r3', fieldId: 'f1' },
        visibleRowCount: 2,
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'PageUp');
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
    });
  });

  describe('Selection', () => {
    it('Shift+Arrow extends selection range', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowDown', { shiftKey: true });
      expect(opts.setSelectionAnchor).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f1' });
      expect(opts.setSelectionRange).toHaveBeenCalledWith({ rowId: 'r2', fieldId: 'f1' });
    });

    it('Cmd+A selects all rows', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'a', { metaKey: true });
      expect(opts.setSelectedRows).toHaveBeenCalledWith(
        new Set(['r1', 'r2', 'r3']),
      );
    });
  });

  describe('Editing shortcuts', () => {
    it('F2 starts edit mode', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'F2');
      expect(opts.startEditing).toHaveBeenCalledWith(
        { rowId: 'r1', fieldId: 'f1' },
        'edit',
      );
    });

    it('Delete clears cell contents', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Delete');
      expect(opts.onCellSave).toHaveBeenCalledWith('r1', 'f1', null);
    });

    it('Backspace clears cell contents', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f2' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Backspace');
      expect(opts.onCellSave).toHaveBeenCalledWith('r1', 'f2', null);
    });

    it('Delete does not clear read-only cell', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f4' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Delete');
      expect(opts.onCellSave).not.toHaveBeenCalled();
    });

    it('Space toggles checkbox cell', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f3' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, ' ');
      expect(opts.onCellSave).toHaveBeenCalledWith('r1', 'f3', false);
    });

    it('Space does not toggle non-checkbox cell', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, ' ');
      expect(opts.onCellSave).not.toHaveBeenCalled();
    });

    it('printable character starts replace-mode editing', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'a');
      expect(opts.startEditing).toHaveBeenCalledWith(
        { rowId: 'r1', fieldId: 'f1' },
        'replace',
      );
    });

    it('printable character does not start editing on read-only field', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f4' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'a');
      expect(opts.startEditing).not.toHaveBeenCalled();
    });
  });

  describe('Grid actions', () => {
    it('Cmd+Shift+N triggers onAddRecord', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'N', { metaKey: true, shiftKey: true });
      expect(opts.onAddRecord).toHaveBeenCalled();
    });

    it('Cmd+/ triggers onOpenShortcutsHelp', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, '/', { metaKey: true });
      expect(opts.onOpenShortcutsHelp).toHaveBeenCalled();
    });
  });

  describe('Editing mode key suppression', () => {
    it('arrows are ignored while editing', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
        editingCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowDown');
      expect(opts.setActiveCell).not.toHaveBeenCalled();
    });

    it('Tab while editing confirms and moves to next cell', () => {
      const opts = createOptions({
        activeCell: { rowId: 'r1', fieldId: 'f1' },
        editingCell: { rowId: 'r1', fieldId: 'f1' },
      });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'Tab');
      expect(opts.stopEditing).toHaveBeenCalled();
      expect(opts.setActiveCell).toHaveBeenCalledWith({ rowId: 'r1', fieldId: 'f2' });
    });
  });

  describe('No active cell', () => {
    it('does not navigate when no active cell', () => {
      const opts = createOptions({ activeCell: null });
      renderHarness(opts);
      const grid = screen.getByTestId('grid');
      pressKey(grid, 'ArrowDown');
      expect(opts.setActiveCell).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// CellErrorOverlay Tests
// ---------------------------------------------------------------------------

describe('CellErrorOverlay', () => {
  it('renders children without error', () => {
    render(
      <IntlWrapper>
        <CellErrorOverlay error={null}>
          <span>cell content</span>
        </CellErrorOverlay>
      </IntlWrapper>,
    );
    expect(screen.getByText('cell content')).toBeInTheDocument();
  });

  it('renders broken reference with strikethrough and deleted badge', () => {
    const error: CellErrorInfo = { state: 'broken_reference', sourceName: 'Airtable' };
    render(
      <IntlWrapper>
        <CellErrorOverlay error={error}>
          <span>old value</span>
        </CellErrorOverlay>
      </IntlWrapper>,
    );
    expect(screen.getByText('(deleted)')).toBeInTheDocument();
  });

  it('renders sync conflict indicator', () => {
    const error: CellErrorInfo = { state: 'sync_conflict' };
    render(
      <IntlWrapper>
        <CellErrorOverlay error={error}>
          <span>value</span>
        </CellErrorOverlay>
      </IntlWrapper>,
    );
    // Sync icon rendered
    expect(screen.getByText('⟳')).toBeInTheDocument();
  });

  it('renders processing shimmer', () => {
    const error: CellErrorInfo = { state: 'processing' };
    const { container } = render(
      <IntlWrapper>
        <CellErrorOverlay error={error}>
          <span>value</span>
        </CellErrorOverlay>
      </IntlWrapper>,
    );
    // Amber shimmer overlay
    const shimmer = container.querySelector('.animate-pulse');
    expect(shimmer).toBeInTheDocument();
  });

  it('renders type coercion with warning icon', () => {
    const error: CellErrorInfo = { state: 'type_coercion' };
    render(
      <IntlWrapper>
        <CellErrorOverlay error={error}>
          <span>value</span>
        </CellErrorOverlay>
      </IntlWrapper>,
    );
    expect(screen.getByText('⚠')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders succeeded with green flash overlay', () => {
    const error: CellErrorInfo = { state: 'succeeded' };
    const { container } = render(
      <IntlWrapper>
        <CellErrorOverlay error={error}>
          <span>value</span>
        </CellErrorOverlay>
      </IntlWrapper>,
    );
    // Green flash overlay with transition
    const flash = container.querySelector('.transition-opacity');
    expect(flash).toBeInTheDocument();
    expect(flash).toHaveStyle({ opacity: '1' });
  });
});

// ---------------------------------------------------------------------------
// KeyboardShortcutsDialog Tests
// ---------------------------------------------------------------------------

describe('KeyboardShortcutsDialog', () => {
  it('renders when open', () => {
    render(
      <IntlWrapper>
        <KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />
      </IntlWrapper>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Keyboard Shortcuts').length).toBeGreaterThanOrEqual(1);
  });

  it('renders shortcut categories', () => {
    render(
      <IntlWrapper>
        <KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />
      </IntlWrapper>,
    );
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Selection')).toBeInTheDocument();
    expect(screen.getByText('Editing')).toBeInTheDocument();
    expect(screen.getByText('Grid Actions')).toBeInTheDocument();
  });

  it('displays shortcut descriptions', () => {
    render(
      <IntlWrapper>
        <KeyboardShortcutsDialog open={true} onOpenChange={vi.fn()} />
      </IntlWrapper>,
    );
    expect(screen.getByText('Move between cells')).toBeInTheDocument();
    expect(screen.getByText('New record')).toBeInTheDocument();
    expect(screen.getByText('Clear cell contents')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <IntlWrapper>
        <KeyboardShortcutsDialog open={false} onOpenChange={vi.fn()} />
      </IntlWrapper>,
    );
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });
});
