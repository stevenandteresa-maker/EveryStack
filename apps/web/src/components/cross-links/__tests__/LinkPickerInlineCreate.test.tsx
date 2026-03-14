// @vitest-environment jsdom

/**
 * LinkPickerInlineCreate — component tests.
 *
 * Covers: trigger button rendering, form expansion with card_fields,
 * create and link action, form reset on cancel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { LinkPickerInlineCreate } from '../link-picker-inline-create';
import type { CrossLink, Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateRecord = vi.fn();
const mockLinkRecords = vi.fn();

vi.mock('@/actions/record-actions', () => ({
  createRecord: (...args: unknown[]) => mockCreateRecord(...args),
}));

vi.mock('@/actions/cross-link-actions', () => ({
  linkRecords: (...args: unknown[]) => mockLinkRecords(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const messages = {
  link_picker: {
    inline_create_new: '+ New {tableName}',
    inline_create_submit: 'Create & Link',
    inline_create_creating: 'Creating…',
    cancel: 'Cancel',
    new_record: 'record',
  },
};

const mockDefinition: CrossLink = {
  id: 'cl-1',
  tenantId: 'tenant-1',
  name: 'Clients',
  sourceTableId: 'tbl-source',
  sourceFieldId: 'fld-source',
  targetTableId: 'tbl-target',
  targetDisplayFieldId: 'fld-name',
  relationshipType: 'one_to_many',
  reverseFieldId: null,
  linkScopeFilter: null,
  cardFields: ['fld-name', 'fld-email'],
  maxLinksPerRecord: 50,
  maxDepth: 2,
  createdBy: 'user-1',
  createdAt: new Date('2026-03-10'),
  updatedAt: new Date('2026-03-10'),
} as CrossLink;

const mockCardFields: Field[] = [
  {
    id: 'fld-name',
    tenantId: 'tenant-1',
    tableId: 'tbl-target',
    name: 'Name',
    fieldType: 'text',
    config: null,
    sortOrder: 0,
    display: {},
    defaultValue: null,
    environment: 'live',
    isPrimary: false,
    isRequired: false,
    isComputed: false,
    isSystem: false,
    readOnly: false,
    description: null,
    externalFieldId: null,
    createdAt: new Date('2026-03-10'),
    updatedAt: new Date('2026-03-10'),
  } as unknown as Field,
  {
    id: 'fld-email',
    tenantId: 'tenant-1',
    tableId: 'tbl-target',
    name: 'Email',
    fieldType: 'email',
    config: null,
    sortOrder: 1,
    display: {},
    defaultValue: null,
    environment: 'live',
    isPrimary: false,
    isRequired: false,
    isComputed: false,
    isSystem: false,
    readOnly: false,
    description: null,
    externalFieldId: null,
    createdAt: new Date('2026-03-10'),
    updatedAt: new Date('2026-03-10'),
  } as unknown as Field,
];

function renderInlineCreate(
  props: Partial<React.ComponentProps<typeof LinkPickerInlineCreate>> = {},
) {
  const defaultProps = {
    definition: mockDefinition,
    cardFields: mockCardFields,
    sourceRecordId: 'rec-source-1',
    tenantId: 'tenant-1',
    onCreated: vi.fn(),
    ...props,
  };

  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LinkPickerInlineCreate {...defaultProps} />
    </NextIntlClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LinkPickerInlineCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateRecord.mockResolvedValue({ id: 'rec-new-1' });
    mockLinkRecords.mockResolvedValue(undefined);
  });

  it('renders trigger button with target table name', () => {
    renderInlineCreate();
    expect(screen.getByTestId('inline-create-trigger')).toBeInTheDocument();
    expect(screen.getByText('+ New Clients')).toBeInTheDocument();
  });

  it('expands form when trigger clicked', async () => {
    renderInlineCreate();
    await userEvent.click(screen.getByTestId('inline-create-trigger'));

    expect(screen.getByTestId('inline-create-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('submit button is disabled when no fields filled', async () => {
    renderInlineCreate();
    await userEvent.click(screen.getByTestId('inline-create-trigger'));

    const submitBtn = screen.getByTestId('inline-create-submit');
    expect(submitBtn).toBeDisabled();
  });

  it('creates record and links it on submit', async () => {
    const onCreated = vi.fn();
    renderInlineCreate({ onCreated });

    await userEvent.click(screen.getByTestId('inline-create-trigger'));

    const nameInput = screen.getByLabelText('Name');
    await userEvent.type(nameInput, 'New Client');

    const submitBtn = screen.getByTestId('inline-create-submit');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateRecord).toHaveBeenCalledWith({
        tableId: 'tbl-target',
        canonicalData: { 'fld-name': 'New Client' },
      });
    });

    await waitFor(() => {
      expect(mockLinkRecords).toHaveBeenCalledWith({
        crossLinkId: 'cl-1',
        sourceRecordId: 'rec-source-1',
        targetRecordIds: ['rec-new-1'],
      });
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('rec-new-1', 'New Client');
    });
  });

  it('resets form on cancel', async () => {
    renderInlineCreate();
    await userEvent.click(screen.getByTestId('inline-create-trigger'));

    const nameInput = screen.getByLabelText('Name');
    await userEvent.type(nameInput, 'Test');

    await userEvent.click(screen.getByText('Cancel'));

    // Form should be collapsed (trigger visible again)
    expect(screen.getByTestId('inline-create-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('inline-create-form')).not.toBeInTheDocument();
  });
});
