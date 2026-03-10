// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { ViewSwitcher } from '../ViewSwitcher';
import { ViewCreateDialog } from '../ViewCreateDialog';
import type { View } from '@everystack/shared/db';

// Polyfill ResizeObserver for Radix Dialog/ScrollArea in jsdom
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
// Helpers
// ---------------------------------------------------------------------------

function createMockView(overrides: Partial<View> = {}): View {
  return {
    id: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    tableId: crypto.randomUUID(),
    name: 'Test View',
    viewType: 'grid',
    config: {},
    permissions: {},
    isShared: true,
    publishState: 'live',
    environment: 'live',
    position: 0,
    createdBy: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const defaultSwitcherProps = {
  onSwitchView: vi.fn(),
  onCreateView: vi.fn(),
  onRenameView: vi.fn(),
  onDuplicateView: vi.fn(),
  onDeleteView: vi.fn(),
  onPromoteView: vi.fn(),
  onLockView: vi.fn(),
};

// ---------------------------------------------------------------------------
// ViewSwitcher
// ---------------------------------------------------------------------------

describe('ViewSwitcher', () => {
  it('renders current view name and type icon', () => {
    const currentView = createMockView({ name: 'Active Grid' });

    render(
      <IntlWrapper>
        <ViewSwitcher
          currentView={currentView}
          sharedViews={[currentView]}
          myViews={[]}
          userRole="manager"
          userId="user-1"
          {...defaultSwitcherProps}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Active Grid')).toBeInTheDocument();
  });

  it('shows shared views and my views sections in dropdown', async () => {
    const user = userEvent.setup();
    const sharedView = createMockView({ name: 'Shared Grid', isShared: true });
    const myView = createMockView({ name: 'My Grid', isShared: false });

    render(
      <IntlWrapper>
        <ViewSwitcher
          currentView={sharedView}
          sharedViews={[sharedView]}
          myViews={[myView]}
          userRole="manager"
          userId="user-1"
          {...defaultSwitcherProps}
        />
      </IntlWrapper>,
    );

    // Open dropdown
    await user.click(screen.getByText('Shared Grid'));

    expect(screen.getByText('Shared Views')).toBeInTheDocument();
    expect(screen.getByText('My Views')).toBeInTheDocument();
    expect(screen.getByText('My Grid')).toBeInTheDocument();
  });

  it('calls onSwitchView when clicking a view', async () => {
    const user = userEvent.setup();
    const view1 = createMockView({ name: 'View 1' });
    const view2 = createMockView({ name: 'View 2' });
    const onSwitchView = vi.fn();

    render(
      <IntlWrapper>
        <ViewSwitcher
          currentView={view1}
          sharedViews={[view1, view2]}
          myViews={[]}
          userRole="manager"
          userId="user-1"
          {...defaultSwitcherProps}
          onSwitchView={onSwitchView}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByText('View 1'));
    await user.click(screen.getByText('View 2'));

    expect(onSwitchView).toHaveBeenCalledWith(view2.id);
  });

  it('shows create view button in dropdown', async () => {
    const user = userEvent.setup();
    const onCreateView = vi.fn();
    const currentView = createMockView({ name: 'Default' });

    render(
      <IntlWrapper>
        <ViewSwitcher
          currentView={currentView}
          sharedViews={[currentView]}
          myViews={[]}
          userRole="viewer"
          userId="user-1"
          {...defaultSwitcherProps}
          onCreateView={onCreateView}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByText('Default'));
    await user.click(screen.getByText('Create view'));

    expect(onCreateView).toHaveBeenCalled();
  });

  it('shows empty state when no views exist', async () => {
    const user = userEvent.setup();

    render(
      <IntlWrapper>
        <ViewSwitcher
          currentView={null}
          sharedViews={[]}
          myViews={[]}
          userRole="viewer"
          userId="user-1"
          {...defaultSwitcherProps}
        />
      </IntlWrapper>,
    );

    // The trigger shows "All Records" as fallback
    await user.click(screen.getByText('All Records'));

    expect(screen.getByText('No views yet.')).toBeInTheDocument();
  });

  it('highlights the active view in the dropdown', async () => {
    const user = userEvent.setup();
    const view = createMockView({ name: 'Active View' });

    render(
      <IntlWrapper>
        <ViewSwitcher
          currentView={view}
          sharedViews={[view]}
          myViews={[]}
          userRole="manager"
          userId="user-1"
          {...defaultSwitcherProps}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByText('Active View'));

    // The menu item should have data-active attribute
    const menuItems = screen.getAllByRole('menuitem');
    const activeItem = menuItems.find((el) => el.getAttribute('data-active') === 'true');
    expect(activeItem).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ViewCreateDialog
// ---------------------------------------------------------------------------

describe('ViewCreateDialog', () => {
  it('renders dialog with form elements when open', () => {
    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="manager"
          currentViewConfig={null}
          onSubmit={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Create view')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByText('Grid')).toBeInTheDocument();
    expect(screen.getByText('Card')).toBeInTheDocument();
  });

  it('shows make shared option for Manager+', () => {
    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="manager"
          currentViewConfig={null}
          onSubmit={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Make shared (visible to all members)')).toBeInTheDocument();
  });

  it('hides make shared option for non-Manager roles', () => {
    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="team_member"
          currentViewConfig={null}
          onSubmit={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.queryByText('Make shared (visible to all members)')).not.toBeInTheDocument();
  });

  it('shows copy config toggle when current config exists', () => {
    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="manager"
          currentViewConfig={{ sorts: [{ fieldId: 'abc', direction: 'asc' }] }}
          onSubmit={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Copy current view config')).toBeInTheDocument();
  });

  it('hides copy config toggle when no current config', () => {
    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="manager"
          currentViewConfig={null}
          onSubmit={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.queryByText('Copy current view config')).not.toBeInTheDocument();
  });

  it('submits with correct data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="team_member"
          currentViewConfig={null}
          onSubmit={onSubmit}
        />
      </IntlWrapper>,
    );

    await user.type(screen.getByLabelText('Name'), 'My Custom View');

    // Find the submit button (type="submit")
    const dialog = screen.getByRole('dialog');
    const submitBtn = within(dialog).getByRole('button', { name: 'Create' });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'My Custom View',
      viewType: 'grid',
      isShared: false,
      config: {},
    });
  });

  it('disables create button when name is empty', () => {
    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="manager"
          currentViewConfig={null}
          onSubmit={vi.fn()}
        />
      </IntlWrapper>,
    );

    const dialog = screen.getByRole('dialog');
    const submitBtn = within(dialog).getByRole('button', { name: 'Create' });
    expect(submitBtn).toBeDisabled();
  });

  it('allows selecting card view type', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <IntlWrapper>
        <ViewCreateDialog
          open={true}
          onOpenChange={vi.fn()}
          userRole="team_member"
          currentViewConfig={null}
          onSubmit={onSubmit}
        />
      </IntlWrapper>,
    );

    await user.type(screen.getByLabelText('Name'), 'Card View');
    await user.click(screen.getByText('Card'));

    const dialog = screen.getByRole('dialog');
    const submitBtn = within(dialog).getByRole('button', { name: 'Create' });
    await user.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ viewType: 'card' }),
    );
  });
});

// ---------------------------------------------------------------------------
// extractViewConfig
// ---------------------------------------------------------------------------

describe('extractViewConfig', () => {
  it('extracts config from view', async () => {
    const { extractViewConfig } = await import('@/lib/hooks/use-current-view');

    const view = createMockView({
      config: {
        sorts: [{ fieldId: 'f1', direction: 'asc' }],
        groups: [{ fieldId: 'f2', direction: 'desc' }],
        frozenColumns: 2,
        density: 'compact',
        locked: true,
      },
    });

    const result = extractViewConfig(view);

    expect(result.sorts).toEqual([{ fieldId: 'f1', direction: 'asc' }]);
    expect(result.groups).toEqual([{ fieldId: 'f2', direction: 'desc' }]);
    expect(result.frozenColumns).toBe(2);
    expect(result.density).toBe('compact');
    expect(result.locked).toBe(true);
  });

  it('merges user overrides on top of view config', async () => {
    const { extractViewConfig } = await import('@/lib/hooks/use-current-view');

    const view = createMockView({
      config: {
        sorts: [{ fieldId: 'f1', direction: 'asc' }],
        density: 'medium',
      },
    });

    const overrides = {
      sorts: [{ fieldId: 'f1', direction: 'desc' }],
    };

    const result = extractViewConfig(view, overrides);

    expect(result.sorts).toEqual([{ fieldId: 'f1', direction: 'desc' }]);
    expect(result.density).toBe('medium');
  });

  it('returns defaults for empty config', async () => {
    const { extractViewConfig } = await import('@/lib/hooks/use-current-view');

    const view = createMockView({ config: {} });
    const result = extractViewConfig(view);

    expect(result.sorts).toEqual([]);
    expect(result.filters).toBeNull();
    expect(result.groups).toEqual([]);
    expect(result.locked).toBe(false);
  });
});
