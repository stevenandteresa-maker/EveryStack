// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConflictResolutionActions } from '../ConflictResolutionActions';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { ConflictItem, ConflictResolution } from '../conflict-types';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeConflicts(count: number): ConflictItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `conflict-${i}`,
    fieldId: `field-${i}`,
    fieldName: `Field ${i}`,
    fieldType: 'singleLineText',
    platformFieldType: 'singleLineText',
    localValue: `local-${i}`,
    remoteValue: `remote-${i}`,
    baseValue: `base-${i}`,
    platform: 'airtable' as const,
    createdAt: '2026-03-06T12:00:00Z',
  }));
}

function renderActions(overrides?: {
  conflicts?: ConflictItem[];
  resolutions?: Map<string, ConflictResolution>;
  onKeepAllLocal?: () => void;
  onKeepAllRemote?: () => void;
  platform?: string;
}) {
  const props = {
    conflicts: overrides?.conflicts ?? makeConflicts(3),
    resolutions: overrides?.resolutions ?? new Map(),
    onKeepAllLocal: overrides?.onKeepAllLocal ?? vi.fn(),
    onKeepAllRemote: overrides?.onKeepAllRemote ?? vi.fn(),
    platform: overrides?.platform ?? 'airtable',
  };

  return render(
    <IntlWrapper>
      <ConflictResolutionActions {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConflictResolutionActions', () => {
  it('renders Keep All EveryStack and Keep All Remote buttons', () => {
    renderActions();

    expect(screen.getByTestId('conflict-keep-all-local')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-keep-all-remote')).toBeInTheDocument();
  });

  it('displays pending count when conflicts are unresolved', () => {
    renderActions();

    expect(screen.getByText(/3 conflicts pending/)).toBeInTheDocument();
  });

  it('calls onKeepAllLocal when Keep All EveryStack is clicked', async () => {
    const onKeepAllLocal = vi.fn();
    const user = userEvent.setup();
    renderActions({ onKeepAllLocal });

    await user.click(screen.getByTestId('conflict-keep-all-local'));

    expect(onKeepAllLocal).toHaveBeenCalledTimes(1);
  });

  it('calls onKeepAllRemote when Keep All Remote is clicked', async () => {
    const onKeepAllRemote = vi.fn();
    const user = userEvent.setup();
    renderActions({ onKeepAllRemote });

    await user.click(screen.getByTestId('conflict-keep-all-remote'));

    expect(onKeepAllRemote).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when all conflicts are resolved', () => {
    const conflicts = makeConflicts(2);
    const resolutions = new Map<string, ConflictResolution>([
      ['conflict-0', { conflictId: 'conflict-0', choice: 'keep_local' }],
      ['conflict-1', { conflictId: 'conflict-1', choice: 'keep_remote' }],
    ]);

    renderActions({ conflicts, resolutions });

    expect(screen.getByTestId('conflict-keep-all-local')).toBeDisabled();
    expect(screen.getByTestId('conflict-keep-all-remote')).toBeDisabled();
  });

  it('shows correct pending count when some conflicts are resolved', () => {
    const conflicts = makeConflicts(3);
    const resolutions = new Map<string, ConflictResolution>([
      ['conflict-0', { conflictId: 'conflict-0', choice: 'keep_local' }],
    ]);

    renderActions({ conflicts, resolutions });

    expect(screen.getByText(/2 conflicts pending/)).toBeInTheDocument();
  });

  it('capitalizes platform name', () => {
    renderActions({ platform: 'notion' });

    expect(screen.getByTestId('conflict-keep-all-remote')).toHaveTextContent(/Notion/);
  });

  it('has touch-safe button sizes', () => {
    renderActions();

    const btn = screen.getByTestId('conflict-keep-all-local');
    expect(btn.className).toContain('min-h-[44px]');
  });
});
