// @vitest-environment jsdom
/**
 * Tests for QuotaExceededPanel.tsx
 *
 * Covers:
 * - Renders current quota usage and plan limit
 * - Shows unsynced record count with table name
 * - 4 resolution option buttons render and fire callbacks
 * - Resume Sync button appears when canResume is true
 * - Resume Sync button is disabled when isResuming is true
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuotaExceededPanel } from '../QuotaExceededPanel';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  currentCount: 250_000,
  planQuota: 250_000,
  planName: 'Professional',
  unsyncedCount: 1200,
  tableName: 'Tasks',
  canResume: false,
  onAddFilter: vi.fn(),
  onUpgradePlan: vi.fn(),
  onDeleteRecords: vi.fn(),
  onDisableTables: vi.fn(),
  onResumeSync: vi.fn(),
};

function renderPanel(overrides = {}) {
  return render(
    <IntlWrapper>
      <QuotaExceededPanel {...defaultProps} {...overrides} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuotaExceededPanel', () => {
  it('renders with data-testid', () => {
    renderPanel();
    expect(screen.getByTestId('quota-exceeded-panel')).toBeTruthy();
  });

  it('renders 4 resolution options', () => {
    renderPanel();

    expect(screen.getByTestId('quota-add-filter')).toBeTruthy();
    expect(screen.getByTestId('quota-upgrade-plan')).toBeTruthy();
    expect(screen.getByTestId('quota-delete-records')).toBeTruthy();
    expect(screen.getByTestId('quota-disable-tables')).toBeTruthy();
  });

  it('calls onAddFilter when Add Sync Filter is clicked', () => {
    const onAddFilter = vi.fn();
    renderPanel({ onAddFilter });

    fireEvent.click(screen.getByTestId('quota-add-filter'));
    expect(onAddFilter).toHaveBeenCalledOnce();
  });

  it('calls onUpgradePlan when Upgrade Plan is clicked', () => {
    const onUpgradePlan = vi.fn();
    renderPanel({ onUpgradePlan });

    fireEvent.click(screen.getByTestId('quota-upgrade-plan'));
    expect(onUpgradePlan).toHaveBeenCalledOnce();
  });

  it('calls onDeleteRecords when Delete Records is clicked', () => {
    const onDeleteRecords = vi.fn();
    renderPanel({ onDeleteRecords });

    fireEvent.click(screen.getByTestId('quota-delete-records'));
    expect(onDeleteRecords).toHaveBeenCalledOnce();
  });

  it('calls onDisableTables when Disable Tables is clicked', () => {
    const onDisableTables = vi.fn();
    renderPanel({ onDisableTables });

    fireEvent.click(screen.getByTestId('quota-disable-tables'));
    expect(onDisableTables).toHaveBeenCalledOnce();
  });

  it('does not show Resume Sync when canResume is false', () => {
    renderPanel({ canResume: false });
    expect(screen.queryByTestId('quota-resume-sync')).toBeNull();
  });

  it('shows Resume Sync when canResume is true', () => {
    renderPanel({ canResume: true });
    expect(screen.getByTestId('quota-resume-sync')).toBeTruthy();
  });

  it('calls onResumeSync when Resume Sync is clicked', () => {
    const onResumeSync = vi.fn();
    renderPanel({ canResume: true, onResumeSync });

    fireEvent.click(screen.getByTestId('quota-resume-sync'));
    expect(onResumeSync).toHaveBeenCalledOnce();
  });

  it('disables Resume Sync when isResuming is true', () => {
    renderPanel({ canResume: true, isResuming: true });

    const button = screen.getByTestId('quota-resume-sync');
    expect(button).toHaveProperty('disabled', true);
  });
});
