// @vitest-environment jsdom
/**
 * Tests for ReauthBanner component.
 *
 * Covers:
 * - auth_expired variant: displays re-authenticate button + correct message
 * - permission_denied variant: displays retry now button + correct message
 * - Click handlers fire correctly
 * - Accessibility: role="alert" present
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { ReauthBanner } from '../ReauthBanner';

function renderBanner(props: React.ComponentProps<typeof ReauthBanner>) {
  return render(
    <IntlWrapper>
      <ReauthBanner {...props} />
    </IntlWrapper>,
  );
}

describe('ReauthBanner', () => {
  describe('auth_expired variant', () => {
    it('displays the auth expired message with platform name', () => {
      renderBanner({
        errorType: 'auth_expired',
        platform: 'Airtable',
      });

      expect(
        screen.getByText(/your connection to Airtable has expired/i),
      ).toBeInTheDocument();
    });

    it('displays a Re-authenticate button', () => {
      renderBanner({
        errorType: 'auth_expired',
        platform: 'Notion',
      });

      expect(
        screen.getByTestId('reauth-button'),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('reauth-button'),
      ).toHaveTextContent(/re-authenticate/i);
    });

    it('calls onReauthenticate when Re-authenticate is clicked', async () => {
      const onReauthenticate = vi.fn();
      renderBanner({
        errorType: 'auth_expired',
        platform: 'Airtable',
        onReauthenticate,
      });

      await userEvent.click(screen.getByTestId('reauth-button'));
      expect(onReauthenticate).toHaveBeenCalledTimes(1);
    });

    it('does not show Retry Now button', () => {
      renderBanner({
        errorType: 'auth_expired',
        platform: 'Airtable',
      });

      expect(screen.queryByTestId('retry-now-button')).not.toBeInTheDocument();
    });

    it('has data-testid for auth_expired', () => {
      renderBanner({
        errorType: 'auth_expired',
        platform: 'Airtable',
      });

      expect(screen.getByTestId('reauth-banner-auth_expired')).toBeInTheDocument();
    });
  });

  describe('permission_denied variant', () => {
    it('displays the permission denied message with platform name', () => {
      renderBanner({
        errorType: 'permission_denied',
        platform: 'Notion',
      });

      expect(
        screen.getByText(/no longer has write access/i),
      ).toBeInTheDocument();
    });

    it('displays a Retry Now button', () => {
      renderBanner({
        errorType: 'permission_denied',
        platform: 'Notion',
      });

      expect(screen.getByTestId('retry-now-button')).toBeInTheDocument();
      expect(screen.getByTestId('retry-now-button')).toHaveTextContent(/retry now/i);
    });

    it('calls onRetryNow when Retry Now is clicked', async () => {
      const onRetryNow = vi.fn();
      renderBanner({
        errorType: 'permission_denied',
        platform: 'Notion',
        onRetryNow,
      });

      await userEvent.click(screen.getByTestId('retry-now-button'));
      expect(onRetryNow).toHaveBeenCalledTimes(1);
    });

    it('does not show Re-authenticate button', () => {
      renderBanner({
        errorType: 'permission_denied',
        platform: 'Notion',
      });

      expect(screen.queryByTestId('reauth-button')).not.toBeInTheDocument();
    });

    it('has data-testid for permission_denied', () => {
      renderBanner({
        errorType: 'permission_denied',
        platform: 'Notion',
      });

      expect(screen.getByTestId('reauth-banner-permission_denied')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="alert" for screen reader announcement', () => {
      renderBanner({
        errorType: 'auth_expired',
        platform: 'Airtable',
      });

      const banner = screen.getByRole('alert');
      expect(banner).toBeInTheDocument();
    });

    it('has role="alert" for permission denied variant', () => {
      renderBanner({
        errorType: 'permission_denied',
        platform: 'Notion',
      });

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
