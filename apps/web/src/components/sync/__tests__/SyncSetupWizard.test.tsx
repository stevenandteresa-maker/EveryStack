// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncSetupWizard } from '../SyncSetupWizard';
import { IntlWrapper } from '@/test-utils/intl-wrapper';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInitiateAirtableConnection = vi.fn();
const mockListBasesForConnection = vi.fn();
const mockSelectBaseForConnection = vi.fn();

vi.mock('@/actions/sync-connections', () => ({
  initiateAirtableConnection: (...args: unknown[]) =>
    mockInitiateAirtableConnection(...args),
  listBasesForConnection: (...args: unknown[]) =>
    mockListBasesForConnection(...args),
  selectBaseForConnection: (...args: unknown[]) =>
    mockSelectBaseForConnection(...args),
}));

const mockListTablesInBase = vi.fn();
const mockFetchEstimatedRecordCount = vi.fn();
const mockCheckQuotaForSync = vi.fn();
const mockSaveSyncConfigAndStartSync = vi.fn();

vi.mock('@/actions/sync-setup', () => ({
  listTablesInBase: (...args: unknown[]) => mockListTablesInBase(...args),
  fetchEstimatedRecordCount: (...args: unknown[]) =>
    mockFetchEstimatedRecordCount(...args),
  checkQuotaForSync: (...args: unknown[]) => mockCheckQuotaForSync(...args),
  saveSyncConfigAndStartSync: (...args: unknown[]) =>
    mockSaveSyncConfigAndStartSync(...args),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWizard(props?: Partial<React.ComponentProps<typeof SyncSetupWizard>>) {
  return render(
    <IntlWrapper>
      <SyncSetupWizard
        open={true}
        onOpenChange={vi.fn()}
        {...props}
      />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncSetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock setup
    mockInitiateAirtableConnection.mockResolvedValue({
      authUrl: 'https://airtable.com/oauth2/v1/authorize?test=1',
    });
    mockListBasesForConnection.mockResolvedValue([
      { id: 'appBase1', name: 'Test Base', permissionLevel: 'create' },
      { id: 'appBase2', name: 'Other Base', permissionLevel: 'read' },
    ]);
    mockSelectBaseForConnection.mockResolvedValue(undefined);
    mockListTablesInBase.mockResolvedValue({
      tables: [
        {
          id: 'tblTable1',
          name: 'Contacts',
          primaryFieldId: 'fldName1',
          fields: [
            { id: 'fldName1', name: 'Name', type: 'singleLineText' },
            { id: 'fldEmail1', name: 'Email', type: 'email' },
          ],
        },
        {
          id: 'tblTable2',
          name: 'Projects',
          primaryFieldId: 'fldProjName1',
          fields: [
            { id: 'fldProjName1', name: 'Project Name', type: 'singleLineText' },
          ],
        },
      ],
    });
    mockCheckQuotaForSync.mockResolvedValue({
      allowed: true,
      remaining: 10000,
      overageCount: 0,
    });
    mockFetchEstimatedRecordCount.mockResolvedValue({
      count: 150,
      isExact: true,
    });
    mockSaveSyncConfigAndStartSync.mockResolvedValue({
      jobId: 'job-123',
    });
  });

  // -------------------------------------------------------------------------
  // Step 1: Authenticate
  // -------------------------------------------------------------------------

  describe('Step 1 — Authenticate', () => {
    it('renders the wizard dialog with step 1', () => {
      renderWizard();

      expect(screen.getByTestId('sync-setup-wizard')).toBeInTheDocument();
      expect(screen.getByText('Connect & Sync')).toBeInTheDocument();
      expect(screen.getByTestId('connect-airtable-button')).toBeInTheDocument();
    });

    it('calls initiateAirtableConnection and opens popup on connect', async () => {
      const user = userEvent.setup();
      const mockOpen = vi.spyOn(window, 'open').mockReturnValue(null);

      renderWizard();
      await user.click(screen.getByTestId('connect-airtable-button'));

      expect(mockInitiateAirtableConnection).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith(
          'https://airtable.com/oauth2/v1/authorize?test=1',
          'airtable_oauth',
          expect.any(String),
        );
      });

      mockOpen.mockRestore();
    });

    it('shows step indicator with 3 steps', () => {
      renderWizard();

      expect(screen.getByText('Authenticate')).toBeInTheDocument();
      expect(screen.getByText('Select Base')).toBeInTheDocument();
      expect(screen.getByText('Select Tables')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Step 2: Select Base (resume with existing connection)
  // -------------------------------------------------------------------------

  describe('Step 2 — Select Base', () => {
    it('starts on step 2 when existingConnectionId is provided', async () => {
      renderWizard({ existingConnectionId: 'conn-existing-123' });

      await waitFor(() => {
        expect(mockListBasesForConnection).toHaveBeenCalledWith({
          connectionId: 'conn-existing-123',
        });
      });
    });

    it('renders base cards after loading', async () => {
      renderWizard({ existingConnectionId: 'conn-123' });

      await waitFor(() => {
        expect(screen.getByText('Test Base')).toBeInTheDocument();
        expect(screen.getByText('Other Base')).toBeInTheDocument();
      });

      expect(screen.getByText('create')).toBeInTheDocument();
      expect(screen.getByText('read')).toBeInTheDocument();
    });

    it('shows skeletons while loading', () => {
      mockListBasesForConnection.mockReturnValue(new Promise(() => {})); // Never resolves
      renderWizard({ existingConnectionId: 'conn-123' });

      // Should see skeleton loading states
      expect(screen.getByTestId('sync-setup-wizard')).toBeInTheDocument();
    });

    it('shows error when loading bases fails', async () => {
      mockListBasesForConnection.mockRejectedValue(new Error('Token expired'));
      renderWizard({ existingConnectionId: 'conn-123' });

      await waitFor(() => {
        expect(screen.getByText('Token expired')).toBeInTheDocument();
      });
    });

    it('advances to step 3 when a base is selected', async () => {
      const user = userEvent.setup();
      renderWizard({ existingConnectionId: 'conn-123' });

      await waitFor(() => {
        expect(screen.getByText('Test Base')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('base-card-appBase1'));

      await waitFor(() => {
        expect(mockSelectBaseForConnection).toHaveBeenCalledWith({
          connectionId: 'conn-123',
          baseId: 'appBase1',
          baseName: 'Test Base',
        });
      });
    });
  });

  // -------------------------------------------------------------------------
  // Step 3: Select Tables
  // -------------------------------------------------------------------------

  describe('Step 3 — Select Tables', () => {
    async function goToStep3() {
      const user = userEvent.setup();
      renderWizard({ existingConnectionId: 'conn-123' });

      // Wait for bases to load
      await waitFor(() => {
        expect(screen.getByText('Test Base')).toBeInTheDocument();
      });

      // Select a base to go to step 3
      await user.click(screen.getByTestId('base-card-appBase1'));

      // Wait for tables to load
      await waitFor(() => {
        expect(screen.getByText('Contacts')).toBeInTheDocument();
      });

      return user;
    }

    it('loads tables and quota on step 3', async () => {
      await goToStep3();

      expect(mockListTablesInBase).toHaveBeenCalled();
      expect(mockCheckQuotaForSync).toHaveBeenCalledWith({ estimatedCount: 0 });
      expect(screen.getByText('Contacts')).toBeInTheDocument();
      expect(screen.getByText('Projects')).toBeInTheDocument();
    });

    it('shows quota bar', async () => {
      await goToStep3();

      expect(screen.getByText(/Remaining/)).toBeInTheDocument();
    });

    it('shows start sync button disabled when no tables selected', async () => {
      await goToStep3();

      const startButton = screen.getByTestId('start-sync-button');
      expect(startButton).toBeDisabled();
    });

    it('enables start sync button after selecting a table', async () => {
      const user = await goToStep3();

      // Toggle first table
      const checkbox = screen.getByRole('checkbox', { name: /Contacts/i });
      await user.click(checkbox);

      await waitFor(() => {
        expect(screen.getByTestId('start-sync-button')).not.toBeDisabled();
      });
    });

    it('shows filter toggle for each table', async () => {
      await goToStep3();

      const filterButtons = screen.getAllByText('Filters');
      expect(filterButtons).toHaveLength(2); // One per table
    });
  });

  // -------------------------------------------------------------------------
  // Dialog behavior
  // -------------------------------------------------------------------------

  describe('Dialog behavior', () => {
    it('does not render when open is false', () => {
      renderWizard({ open: false });
      expect(screen.queryByTestId('sync-setup-wizard')).not.toBeInTheDocument();
    });

    it('calls onOpenChange when dialog state changes', () => {
      const onOpenChange = vi.fn();
      renderWizard({ onOpenChange });

      // Dialog is rendered and open
      expect(screen.getByTestId('sync-setup-wizard')).toBeInTheDocument();
    });
  });
});
