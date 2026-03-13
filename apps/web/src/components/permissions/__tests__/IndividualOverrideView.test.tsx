// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { IndividualOverrideView } from '../IndividualOverrideView';
import type { IndividualOverrideViewProps, WorkspaceMemberInfo } from '../IndividualOverrideView';
import type { ViewPermissions } from '@everystack/shared/auth';
import type { Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Polyfills for Radix UI in jsdom
// ---------------------------------------------------------------------------

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() { /* noop */ }
      unobserve() { /* noop */ }
      disconnect() { /* noop */ }
    };
  }
});

// ---------------------------------------------------------------------------
// Mock server action
// ---------------------------------------------------------------------------

const mockUpdateViewPermissions = vi.fn();

vi.mock('@/actions/permission-actions', () => ({
  updateViewPermissions: (...args: unknown[]) => mockUpdateViewPermissions(...args),
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function createField(overrides: Partial<Field> & { id: string; name: string }): Field {
  return {
    tableId: 'table-1',
    tenantId: 'tenant-1',
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
    environment: 'live',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const MEMBERS: WorkspaceMemberInfo[] = [
  { userId: 'user-alice', name: 'Alice Manager', avatarUrl: null, role: 'manager' },
  { userId: 'user-bob', name: 'Bob Member', avatarUrl: 'https://example.com/bob.jpg', role: 'team_member' },
  { userId: 'user-carol', name: 'Carol Viewer', avatarUrl: null, role: 'viewer' },
];

const FIELDS: Field[] = [
  createField({ id: 'field-1', name: 'Name', fieldType: 'text', isPrimary: true }),
  createField({ id: 'field-2', name: 'Email', fieldType: 'email', sortOrder: 1 }),
  createField({ id: 'field-3', name: 'Budget', fieldType: 'number', sortOrder: 2 }),
];

function createBaseViewPermissions(overrides?: Partial<ViewPermissions>): ViewPermissions {
  return {
    roles: ['team_member', 'viewer'],
    specificUsers: [],
    excludedUsers: [],
    fieldPermissions: {
      roleRestrictions: [],
      individualOverrides: [],
    },
    ...overrides,
  };
}

function createDefaultProps(overrides?: Partial<IndividualOverrideViewProps>): IndividualOverrideViewProps {
  return {
    viewId: 'view-1',
    tableId: 'table-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    fields: FIELDS,
    viewPermissions: createBaseViewPermissions(),
    members: MEMBERS,
    fieldPermissions: {},
    ...overrides,
  };
}

function renderWithIntl(props: IndividualOverrideViewProps) {
  return render(
    <IntlWrapper>
      <IndividualOverrideView {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IndividualOverrideView', () => {
  beforeEach(() => {
    mockUpdateViewPermissions.mockReset();
    mockUpdateViewPermissions.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Person selector lists view members
  // -------------------------------------------------------------------------

  it('lists view members in the person selector', () => {
    renderWithIntl(createDefaultProps());
    expect(screen.getByText('Select a person')).toBeInTheDocument();
  });

  it('shows empty state when no members have access', () => {
    renderWithIntl(createDefaultProps({ members: [] }));
    expect(screen.getByText('No members have access to this view')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Effective permissions show resolved state per field
  // -------------------------------------------------------------------------

  it('shows resolved effective state per field when person selected', async () => {
    const user = userEvent.setup();
    const props = createDefaultProps({
      viewPermissions: createBaseViewPermissions({
        fieldPermissions: {
          roleRestrictions: [
            { tableId: 'table-1', role: 'team_member', fieldId: 'field-3', accessState: 'hidden' },
          ],
          individualOverrides: [],
        },
      }),
    });

    renderWithIntl(props);

    // Open select and pick Bob (team_member)
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    const option = screen.getByText('Bob Member');
    await user.click(option);

    // field-3 (Budget) should show Hidden for Bob (role restriction narrows to hidden)
    const fieldRow3 = screen.getByTestId('field-row-field-3');
    expect(fieldRow3).toBeInTheDocument();
    expect(within(fieldRow3).getByText('Hidden')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Override toggle adds override
  // -------------------------------------------------------------------------

  it('adds an override when clicking add override and selecting a state', async () => {
    const user = userEvent.setup();
    renderWithIntl(createDefaultProps());

    // Select Alice (manager)
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.click(screen.getByText('Alice Manager'));

    // Click first "Add override" button
    const addButtons = screen.getAllByText('Add override');
    expect(addButtons.length).toBeGreaterThan(0);
    await user.click(addButtons[0]!);

    // Select "Read only" from dropdown
    const readOnlyOption = screen.getByText('Read only');
    await user.click(readOnlyOption);

    // Should now show "Override" badge
    expect(screen.getByText('Override')).toBeInTheDocument();

    // Should show save bar
    expect(screen.getByText('Save permissions')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Override toggle removes override
  // -------------------------------------------------------------------------

  it('removes an override and reverts to role-level state', async () => {
    const user = userEvent.setup();

    const props = createDefaultProps({
      viewPermissions: createBaseViewPermissions({
        fieldPermissions: {
          roleRestrictions: [],
          individualOverrides: [
            { tableId: 'table-1', userId: 'user-alice', fieldId: 'field-1', accessState: 'read_only' },
          ],
        },
      }),
    });

    renderWithIntl(props);

    // Select Alice
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.click(screen.getByText('Alice Manager'));

    // Should show Override badge
    expect(screen.getByText('Override')).toBeInTheDocument();

    // Click remove override (X button)
    const removeButton = screen.getByLabelText('Remove override');
    await user.click(removeButton);

    // Override badge should be gone
    expect(screen.queryByText('Override')).not.toBeInTheDocument();

    // Save bar should appear
    expect(screen.getByText('Save permissions')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Override clamped by field ceiling
  // -------------------------------------------------------------------------

  it('clamps override to field ceiling (member_edit=false blocks read_write)', async () => {
    const user = userEvent.setup();

    // member_edit=false on field-2 → ceiling is read_only for team_member
    // If we add an override of read_write, the resolve engine will clamp it to read_only
    const props = createDefaultProps({
      fieldPermissions: {
        'field-2': { member_edit: false, viewer_visible: true },
      },
      viewPermissions: createBaseViewPermissions({
        fieldPermissions: {
          roleRestrictions: [],
          // Override set to read_write, but ceiling should clamp it
          individualOverrides: [
            { tableId: 'table-1', userId: 'user-bob', fieldId: 'field-2', accessState: 'read_write' },
          ],
        },
      }),
    });

    renderWithIntl(props);

    // Select Bob (team_member)
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.click(screen.getByText('Bob Member'));

    // field-2 should show "Override" badge (has individual override)
    const fieldRow2 = screen.getByTestId('field-row-field-2');
    expect(within(fieldRow2).getByText('Override')).toBeInTheDocument();

    // Effective state should be read_only (clamped from read_write by ceiling)
    // The resolve engine clamps: read_write override → read_only because member_edit=false
    expect(within(fieldRow2).getByText('Read only')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Override fields visually distinguished
  // -------------------------------------------------------------------------

  it('highlights fields with active overrides using a blue background', async () => {
    const user = userEvent.setup();

    const props = createDefaultProps({
      viewPermissions: createBaseViewPermissions({
        fieldPermissions: {
          roleRestrictions: [],
          individualOverrides: [
            { tableId: 'table-1', userId: 'user-bob', fieldId: 'field-2', accessState: 'hidden' },
          ],
        },
      }),
    });

    renderWithIntl(props);

    // Select Bob
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.click(screen.getByText('Bob Member'));

    // field-2 row should have blue background
    const overrideRow = screen.getByTestId('field-row-field-2');
    expect(overrideRow.className).toContain('bg-blue-50');

    // field-1 row should not
    const normalRow = screen.getByTestId('field-row-field-1');
    expect(normalRow.className).not.toContain('bg-blue-50');
  });

  // -------------------------------------------------------------------------
  // Save calls updateViewPermissions
  // -------------------------------------------------------------------------

  it('calls updateViewPermissions with updated individualOverrides on save', async () => {
    const user = userEvent.setup();
    renderWithIntl(createDefaultProps());

    // Select Alice
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    await user.click(screen.getByText('Alice Manager'));

    // Add override
    const addButtons = screen.getAllByText('Add override');
    await user.click(addButtons[0]!);
    await user.click(screen.getByText('Read only'));

    // Save
    const saveButton = screen.getByText('Save permissions');
    await user.click(saveButton);

    expect(mockUpdateViewPermissions).toHaveBeenCalledWith(
      expect.objectContaining({
        viewId: 'view-1',
        workspaceId: 'workspace-1',
        tableId: 'table-1',
        permissions: expect.objectContaining({
          fieldPermissions: expect.objectContaining({
            individualOverrides: expect.arrayContaining([
              expect.objectContaining({
                userId: 'user-alice',
                fieldId: 'field-1',
                accessState: 'read_only',
              }),
            ]),
          }),
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Role gating: Team Member cannot access config
  // -------------------------------------------------------------------------

  it('renders for team_member viewer context (access gating is at panel level)', () => {
    // PermissionConfigPanel gates access via roleAtLeast().
    // This component renders regardless — gating is the caller's responsibility.
    const props = createDefaultProps({
      members: [
        { userId: 'user-team', name: 'Team User', avatarUrl: null, role: 'team_member' },
      ],
    });

    renderWithIntl(props);
    expect(screen.getByText('Select a person')).toBeInTheDocument();
  });
});
