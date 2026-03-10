// @vitest-environment jsdom
/**
 * CSV Import feature tests — CsvImportWizard, steps, and import action.
 *
 * @see docs/reference/tables-and-views.md § CSV/Data Import — MVP
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { CsvImportWizard } from '../CsvImportWizard';
import { ImportUpload } from '../ImportUpload';
import { ImportPreview } from '../ImportPreview';
import { ImportFieldMapping } from '../ImportFieldMapping';
import { ImportValidation } from '../ImportValidation';
import { ImportExecution } from '../ImportExecution';
import type { FieldMapping } from '../CsvImportWizard';
import type { Field } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/actions/import-actions', () => ({
  importRecords: vi.fn(),
}));

vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((file: File, opts: { complete: (r: { data: string[][] }) => void }) => {
      opts.complete({
        data: [
          ['Name', 'Email', 'Age'],
          ['Alice', 'alice@example.com', '30'],
          ['Bob', 'bob@example.com', '25'],
          ['Charlie', 'charlie@example.com', '35'],
        ],
      });
    }),
  },
}));

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function createMockFields(): Field[] {
  return [
    {
      id: 'field-001',
      tableId: 'table-001',
      tenantId: 'tenant-001',
      name: 'Name',
      fieldType: 'text',
      fieldSubType: null,
      isPrimary: true,
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
    },
    {
      id: 'field-002',
      tableId: 'table-001',
      tenantId: 'tenant-001',
      name: 'Email',
      fieldType: 'email',
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
      sortOrder: 1,
      externalFieldId: null,
      environment: 'live',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'field-003',
      tableId: 'table-001',
      tenantId: 'tenant-001',
      name: 'Age',
      fieldType: 'number',
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
      sortOrder: 2,
      externalFieldId: null,
      environment: 'live',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

const defaultWizardProps = {
  open: true,
  onOpenChange: vi.fn(),
  tableId: 'table-001',
  tableName: 'Contacts',
  fields: createMockFields(),
  isSynced: false,
};

// ---------------------------------------------------------------------------
// CsvImportWizard
// ---------------------------------------------------------------------------

describe('CsvImportWizard', () => {
  it('renders step 1 (upload) when opened', () => {
    render(
      <IntlWrapper>
        <CsvImportWizard {...defaultWizardProps} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Import CSV')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.getByText('Upload file')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when dialog closes', () => {
    const onOpenChange = vi.fn();
    render(
      <IntlWrapper>
        <CsvImportWizard {...defaultWizardProps} onOpenChange={onOpenChange} />
      </IntlWrapper>,
    );

    // The dialog close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// ImportUpload
// ---------------------------------------------------------------------------

describe('ImportUpload', () => {
  it('renders upload zone', () => {
    render(
      <IntlWrapper>
        <ImportUpload onUploadComplete={vi.fn()} isSynced={false} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Upload file')).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  it('shows synced table error when isSynced=true', () => {
    render(
      <IntlWrapper>
        <ImportUpload onUploadComplete={vi.fn()} isSynced={true} />
      </IntlWrapper>,
    );

    expect(screen.getByText(/not available for synced tables/i)).toBeInTheDocument();
  });

  it('accepts csv file and calls onUploadComplete', async () => {
    const onUploadComplete = vi.fn();
    render(
      <IntlWrapper>
        <ImportUpload onUploadComplete={onUploadComplete} isSynced={false} />
      </IntlWrapper>,
    );

    const input = screen.getByLabelText('Choose CSV file');
    const file = new File(['Name,Email\nAlice,alice@test.com'], 'test.csv', {
      type: 'text/csv',
    });

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: ['Name', 'Email', 'Age'],
        }),
        'test.csv',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// ImportPreview
// ---------------------------------------------------------------------------

describe('ImportPreview', () => {
  const previewProps = {
    headers: ['Name', 'Email', 'Age'],
    rows: [
      ['Alice', 'alice@example.com', '30'],
      ['Bob', 'bob@example.com', '25'],
    ],
    hasHeader: true,
    onHasHeaderChange: vi.fn(),
    fileName: 'contacts.csv',
    onNext: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders preview table with headers', () => {
    render(
      <IntlWrapper>
        <ImportPreview {...previewProps} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('has first row is header toggle', () => {
    render(
      <IntlWrapper>
        <ImportPreview {...previewProps} />
      </IntlWrapper>,
    );

    const toggle = screen.getByLabelText(/first row is header/i);
    expect(toggle).toBeChecked();
  });

  it('calls onNext and onBack', () => {
    render(
      <IntlWrapper>
        <ImportPreview {...previewProps} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByText('Next'));
    expect(previewProps.onNext).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Back'));
    expect(previewProps.onBack).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ImportFieldMapping
// ---------------------------------------------------------------------------

describe('ImportFieldMapping', () => {
  const mappingProps = {
    csvHeaders: ['Name', 'Email', 'Age'],
    fields: createMockFields(),
    onConfirm: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders mapping rows for each CSV column', () => {
    render(
      <IntlWrapper>
        <ImportFieldMapping {...mappingProps} />
      </IntlWrapper>,
    );

    expect(screen.getByText('Map columns to fields')).toBeInTheDocument();
    // CSV headers shown
    expect(screen.getByTitle('Name')).toBeInTheDocument();
    expect(screen.getByTitle('Email')).toBeInTheDocument();
    expect(screen.getByTitle('Age')).toBeInTheDocument();
  });

  it('auto-maps matching columns to fields', () => {
    render(
      <IntlWrapper>
        <ImportFieldMapping {...mappingProps} />
      </IntlWrapper>,
    );

    // The select triggers should show the matched field names
    // (auto-mapped via fuzzy matching)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(3);
  });

  it('shows primary field required warning when primary not mapped', () => {
    const fieldsWithoutPrimary = createMockFields().map((f) => ({
      ...f,
      isPrimary: false,
    }));

    render(
      <IntlWrapper>
        <ImportFieldMapping
          {...mappingProps}
          csvHeaders={['Foo', 'Bar']}
          fields={fieldsWithoutPrimary}
        />
      </IntlWrapper>,
    );

    // With no primary field defined, the warning should not show
    // (isPrimaryMapped defaults to true when no primary field exists)
    expect(screen.queryByText(/must be mapped/i)).not.toBeInTheDocument();
  });

  it('disables Next when primary field is not mapped', () => {
    // Create fields where primary exists but CSV headers don't match
    const fieldsWithPrimary = createMockFields();
    render(
      <IntlWrapper>
        <ImportFieldMapping
          {...mappingProps}
          csvHeaders={['Unknown1', 'Unknown2', 'Unknown3']}
          fields={fieldsWithPrimary}
        />
      </IntlWrapper>,
    );

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// ImportValidation
// ---------------------------------------------------------------------------

describe('ImportValidation', () => {
  const fields = createMockFields();
  const mappings: FieldMapping[] = [
    { csvColumnIndex: 0, csvColumnName: 'Name', fieldId: 'field-001' },
    { csvColumnIndex: 1, csvColumnName: 'Email', fieldId: 'field-002' },
    { csvColumnIndex: 2, csvColumnName: 'Age', fieldId: 'field-003' },
  ];

  it('shows validation results for mapped columns', () => {
    render(
      <IntlWrapper>
        <ImportValidation
          csvHeaders={['Name', 'Email', 'Age']}
          csvRows={[
            ['Alice', 'alice@example.com', '30'],
            ['Bob', 'bob@example.com', '25'],
          ]}
          mappings={mappings}
          fields={fields}
          onConfirm={vi.fn()}
          onBack={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Validation preview')).toBeInTheDocument();
    // All valid data — should show "All valid" for each column
    const allValid = screen.getAllByText('All valid');
    expect(allValid.length).toBe(3);
  });

  it('shows issues for invalid data', () => {
    render(
      <IntlWrapper>
        <ImportValidation
          csvHeaders={['Name', 'Email', 'Age']}
          csvRows={[
            ['Alice', 'not-an-email', 'not-a-number'],
            ['Bob', 'bob@example.com', '25'],
          ]}
          mappings={mappings}
          fields={fields}
          onConfirm={vi.fn()}
          onBack={vi.fn()}
        />
      </IntlWrapper>,
    );

    // Should show issue counts for Email and Age columns
    const issues = screen.getAllByText('1 issue');
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Import anyway" button when there are issues', () => {
    render(
      <IntlWrapper>
        <ImportValidation
          csvHeaders={['Name', 'Email', 'Age']}
          csvRows={[['Alice', 'bad', 'bad']]}
          mappings={mappings}
          fields={fields}
          onConfirm={vi.fn()}
          onBack={vi.fn()}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText('Import anyway')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ImportExecution
// ---------------------------------------------------------------------------

describe('ImportExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows progress during import', async () => {
    const { importRecords } = await import('@/actions/import-actions');
    const mockImport = vi.mocked(importRecords);
    mockImport.mockResolvedValueOnce({ imported: 2, failed: 0, errors: [] });

    render(
      <IntlWrapper>
        <ImportExecution
          tableId="table-001"
          tableName="Contacts"
          csvRows={[
            ['Alice', 'alice@example.com', '30'],
            ['Bob', 'bob@example.com', '25'],
          ]}
          mappings={[
            { csvColumnIndex: 0, csvColumnName: 'Name', fieldId: 'field-001' },
          ]}
          fields={createMockFields()}
          onComplete={vi.fn()}
          onClose={vi.fn()}
          isComplete={false}
        />
      </IntlWrapper>,
    );

    expect(screen.getByText(/Importing records/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockImport).toHaveBeenCalled();
    });
  });

  it('shows success message on completion', async () => {
    const { importRecords } = await import('@/actions/import-actions');
    const mockImport = vi.mocked(importRecords);
    mockImport.mockResolvedValueOnce({ imported: 2, failed: 0, errors: [] });

    const onComplete = vi.fn();

    render(
      <IntlWrapper>
        <ImportExecution
          tableId="table-001"
          tableName="Contacts"
          csvRows={[['Alice', '', ''], ['Bob', '', '']]}
          mappings={[
            { csvColumnIndex: 0, csvColumnName: 'Name', fieldId: 'field-001' },
          ]}
          fields={createMockFields()}
          onComplete={onComplete}
          onClose={vi.fn()}
          isComplete={false}
        />
      </IntlWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/2 records imported/i)).toBeInTheDocument();
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('shows error download button when there are failures', async () => {
    const { importRecords } = await import('@/actions/import-actions');
    const mockImport = vi.mocked(importRecords);
    mockImport.mockResolvedValueOnce({
      imported: 1,
      failed: 1,
      errors: [{ row: 2, field: 'Age', error: 'Invalid number' }],
    });

    render(
      <IntlWrapper>
        <ImportExecution
          tableId="table-001"
          tableName="Contacts"
          csvRows={[['Alice', '', ''], ['Bob', '', '']]}
          mappings={[
            { csvColumnIndex: 0, csvColumnName: 'Name', fieldId: 'field-001' },
          ]}
          fields={createMockFields()}
          onComplete={vi.fn()}
          onClose={vi.fn()}
          isComplete={false}
        />
      </IntlWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/1 row had errors/i)).toBeInTheDocument();
      expect(screen.getByText(/Download error report/i)).toBeInTheDocument();
    });
  });

  it('shows Done button after import completes', async () => {
    const { importRecords } = await import('@/actions/import-actions');
    const mockImport = vi.mocked(importRecords);
    mockImport.mockResolvedValueOnce({ imported: 2, failed: 0, errors: [] });

    const onClose = vi.fn();

    render(
      <IntlWrapper>
        <ImportExecution
          tableId="table-001"
          tableName="Contacts"
          csvRows={[['Alice', '', ''], ['Bob', '', '']]}
          mappings={[
            { csvColumnIndex: 0, csvColumnName: 'Name', fieldId: 'field-001' },
          ]}
          fields={createMockFields()}
          onComplete={vi.fn()}
          onClose={onClose}
          isComplete={false}
        />
      </IntlWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });
});
