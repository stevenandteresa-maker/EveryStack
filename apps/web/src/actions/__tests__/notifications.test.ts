// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockMarkNotificationRead,
  mockMarkAllNotificationsRead,
  mockUpdateNotificationPreferences,
} = vi.hoisted(() => ({
  mockMarkNotificationRead: vi.fn().mockResolvedValue(undefined),
  mockMarkAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  mockUpdateNotificationPreferences: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: vi.fn().mockResolvedValue({
    userId: 'user-aaa',
    tenantId: 'tenant-aaa',
    clerkUserId: 'clerk_user_aaa',
    agencyTenantId: null,
  }),
}));

vi.mock('@/data/notifications', () => ({
  markNotificationRead: mockMarkNotificationRead,
  markAllNotificationsRead: mockMarkAllNotificationsRead,
}));

vi.mock('@/data/notification-preferences', () => ({
  updateNotificationPreferences: mockUpdateNotificationPreferences,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import actions after mocking
// ---------------------------------------------------------------------------

import {
  markNotificationReadAction,
  markAllReadAction,
  updateNotificationPreferencesAction,
} from '../notifications';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notification Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // markNotificationReadAction
  // -------------------------------------------------------------------------

  describe('markNotificationReadAction', () => {
    it('calls markNotificationRead with auth context', async () => {
      await markNotificationReadAction('01912345-6789-7abc-8def-0123456789ab');

      expect(mockMarkNotificationRead).toHaveBeenCalledWith(
        'tenant-aaa',
        'user-aaa',
        '01912345-6789-7abc-8def-0123456789ab',
      );
    });

    it('rejects invalid notification ID', async () => {
      await expect(
        markNotificationReadAction('not-a-uuid'),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // markAllReadAction
  // -------------------------------------------------------------------------

  describe('markAllReadAction', () => {
    it('calls markAllNotificationsRead with auth context', async () => {
      await markAllReadAction();

      expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith(
        'tenant-aaa',
        'user-aaa',
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateNotificationPreferencesAction
  // -------------------------------------------------------------------------

  describe('updateNotificationPreferencesAction', () => {
    it('validates and passes preferences to data layer', async () => {
      const prefs = {
        mentions: { inApp: false, email: 'off' },
        digestFrequency: 'hourly',
      };

      await updateNotificationPreferencesAction(prefs);

      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith(
        'tenant-aaa',
        'user-aaa',
        {
          mentions: { inApp: false, email: 'off' },
          digestFrequency: 'hourly',
        },
      );
    });

    it('rejects invalid email preference value', async () => {
      await expect(
        updateNotificationPreferencesAction({
          mentions: { inApp: true, email: 'invalid_value' },
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid digestFrequency', async () => {
      await expect(
        updateNotificationPreferencesAction({
          digestFrequency: 'weekly',
        }),
      ).rejects.toThrow();
    });

    it('accepts partial preferences', async () => {
      await updateNotificationPreferencesAction({
        dms: { inApp: true, email: 'digest' },
      });

      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith(
        'tenant-aaa',
        'user-aaa',
        { dms: { inApp: true, email: 'digest' } },
      );
    });

    it('accepts empty preferences object', async () => {
      await updateNotificationPreferencesAction({});

      expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith(
        'tenant-aaa',
        'user-aaa',
        {},
      );
    });
  });
});
