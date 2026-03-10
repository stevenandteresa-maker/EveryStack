// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { SectionHeader } from '../SectionHeader';
import { SectionList } from '../SectionList';
import type { Section } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSection(overrides?: Partial<Section>): Section {
  return {
    id: 'section-1',
    tenantId: 'tenant-1',
    userId: null,
    context: 'view_switcher',
    contextParentId: null,
    name: 'Test Section',
    sortOrder: 0,
    collapsed: false,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface MockItem {
  id: string;
  name: string;
  sectionId?: string | null;
}

function renderWithIntl(ui: React.ReactElement) {
  return render(<IntlWrapper>{ui}</IntlWrapper>);
}

// ---------------------------------------------------------------------------
// SectionHeader Tests
// ---------------------------------------------------------------------------

describe('SectionHeader', () => {
  const defaultProps = {
    id: 'section-1',
    name: 'Reports',
    itemCount: 3,
    isCollapsed: false,
    isPersonal: false,
    onToggleCollapse: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section name', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    expect(screen.getByText('Reports')).toBeDefined();
  });

  it('shows item count when collapsed', () => {
    renderWithIntl(<SectionHeader {...defaultProps} isCollapsed={true} />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('does not show item count when expanded', () => {
    renderWithIntl(<SectionHeader {...defaultProps} isCollapsed={false} />);
    expect(screen.queryByText('3')).toBeNull();
  });

  it('calls onToggleCollapse when clicking header', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Reports'));
    expect(defaultProps.onToggleCollapse).toHaveBeenCalledOnce();
  });

  it('calls onToggleCollapse when clicking chevron', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    const expandBtn = screen.getByLabelText('Collapse section');
    fireEvent.click(expandBtn);
    expect(defaultProps.onToggleCollapse).toHaveBeenCalledOnce();
  });

  it('shows expand label when collapsed', () => {
    renderWithIntl(<SectionHeader {...defaultProps} isCollapsed={true} />);
    expect(screen.getByLabelText('Expand section')).toBeDefined();
  });

  it('enters rename mode on double-click', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    fireEvent.doubleClick(screen.getByText('Reports'));
    const input = screen.getByDisplayValue('Reports');
    expect(input).toBeDefined();
  });

  it('calls onRename when confirming rename with Enter', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    fireEvent.doubleClick(screen.getByText('Reports'));
    const input = screen.getByDisplayValue('Reports');
    fireEvent.change(input, { target: { value: 'Updated' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onRename).toHaveBeenCalledWith('Updated');
  });

  it('exits rename mode on Escape without saving', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    fireEvent.doubleClick(screen.getByText('Reports'));
    const input = screen.getByDisplayValue('Reports');
    fireEvent.change(input, { target: { value: 'Updated' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onRename).not.toHaveBeenCalled();
    // Should return to text display
    expect(screen.getByText('Reports')).toBeDefined();
  });

  it('confirms rename on blur', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    fireEvent.doubleClick(screen.getByText('Reports'));
    const input = screen.getByDisplayValue('Reports');
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.blur(input);
    expect(defaultProps.onRename).toHaveBeenCalledWith('Blurred');
  });

  it('does not call onRename when name is unchanged', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    fireEvent.doubleClick(screen.getByText('Reports'));
    const input = screen.getByDisplayValue('Reports');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it('shows context menu on right-click', () => {
    renderWithIntl(<SectionHeader {...defaultProps} />);
    const header = screen.getByText('Reports').closest('[data-section-id]')!;
    fireEvent.contextMenu(header);
    expect(screen.getByText('Rename')).toBeDefined();
    expect(screen.getByText('Delete section')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SectionList Tests
// ---------------------------------------------------------------------------

describe('SectionList', () => {
  const mockItems: MockItem[] = [
    { id: 'item-1', name: 'Unsectioned Item', sectionId: null },
    { id: 'item-2', name: 'Section A Item', sectionId: 'section-a' },
    { id: 'item-3', name: 'Section B Item', sectionId: 'section-b' },
  ];

  const mockSections: Section[] = [
    createMockSection({ id: 'section-a', name: 'Section A', sortOrder: 0 }),
    createMockSection({ id: 'section-b', name: 'Section B', sortOrder: 1 }),
  ];

  const renderItem = (item: MockItem) => (
    <div data-testid={`item-${item.id}`}>{item.name}</div>
  );

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
  });

  it('renders unsectioned items at the top', () => {
    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    expect(screen.getByText('Unsectioned Item')).toBeDefined();
  });

  it('renders items within their sections', () => {
    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    expect(screen.getByText('Section A Item')).toBeDefined();
    expect(screen.getByText('Section B Item')).toBeDefined();
  });

  it('renders section headers', () => {
    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    expect(screen.getByText('Section A')).toBeDefined();
    expect(screen.getByText('Section B')).toBeDefined();
  });

  it('renders empty section placeholder when no items', () => {
    const emptyItems: MockItem[] = [
      { id: 'item-1', name: 'Item A', sectionId: 'section-a' },
    ];

    renderWithIntl(
      <SectionList
        items={emptyItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    // Section B has no items, should show placeholder
    expect(screen.getByText('No items')).toBeDefined();
  });

  it('renders custom empty state when no items and no sections', () => {
    renderWithIntl(
      <SectionList
        items={[]}
        sections={[]}
        renderItem={renderItem}
        storageKey="test"
        emptyState={<div>Nothing here</div>}
      />,
    );

    expect(screen.getByText('Nothing here')).toBeDefined();
  });

  it('hides section items when collapsed', () => {
    // Pre-set collapse state in localStorage
    localStorage.setItem(
      'es_section_collapse_test',
      JSON.stringify({ 'section-a': true }),
    );

    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    // Section A is collapsed — item should be hidden
    expect(screen.queryByText('Section A Item')).toBeNull();
    // Section B is expanded — item should be visible
    expect(screen.getByText('Section B Item')).toBeDefined();
  });

  it('shows item count on collapsed section header', () => {
    localStorage.setItem(
      'es_section_collapse_test',
      JSON.stringify({ 'section-a': true }),
    );

    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    // Section A is collapsed and has 1 item
    expect(screen.getByText('1')).toBeDefined();
  });

  it('toggles section collapse when clicking header', () => {
    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    // Initially expanded — item visible
    expect(screen.getByText('Section A Item')).toBeDefined();

    // Click to collapse
    fireEvent.click(screen.getByText('Section A'));

    // Item should now be hidden
    expect(screen.queryByText('Section A Item')).toBeNull();
  });

  it('calls onRenameSection callback', () => {
    const onRename = vi.fn();

    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
        onRenameSection={onRename}
      />,
    );

    // Double-click to start rename
    fireEvent.doubleClick(screen.getByText('Section A'));
    const input = screen.getByDisplayValue('Section A');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('section-a', 'New Name');
  });

  it('calls onDeleteSection callback via context menu', () => {
    const onDelete = vi.fn();

    renderWithIntl(
      <SectionList
        items={mockItems}
        sections={mockSections}
        renderItem={renderItem}
        storageKey="test"
        onDeleteSection={onDelete}
      />,
    );

    // Right-click on section A header
    const sectionHeader = screen.getByText('Section A').closest('[data-section-id]')!;
    fireEvent.contextMenu(sectionHeader);

    // Click delete
    fireEvent.click(screen.getByText('Delete section'));

    expect(onDelete).toHaveBeenCalledWith('section-a');
  });

  it('renders sections in sort order', () => {
    const reorderedSections: Section[] = [
      createMockSection({ id: 'section-b', name: 'Zebra Section', sortOrder: 0 }),
      createMockSection({ id: 'section-a', name: 'Alpha Section', sortOrder: 1 }),
    ];

    renderWithIntl(
      <SectionList
        items={[]}
        sections={reorderedSections}
        renderItem={renderItem}
        storageKey="test"
      />,
    );

    const sectionNames = screen.getAllByRole('group')
      .map((el) => el.getAttribute('aria-label'))
      .filter(Boolean);

    expect(sectionNames).toEqual(['Zebra Section', 'Alpha Section']);
  });
});
