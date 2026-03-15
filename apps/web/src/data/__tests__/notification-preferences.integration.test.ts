/**
 * Integration tests for notification preferences data functions.
 *
 * Covers tenant isolation, default preferences, upsert merge behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  testTenantIsolation,
} from '@everystack/shared/testing';

import {
  getNotificationPreferences,
  updateNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../notification-preferences';

// ---------------------------------------------------------------------------
// Tenant Isolation Tests
// ---------------------------------------------------------------------------

describe('Notification Preferences Data Functions', () => {
  describe('getNotificationPreferences — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let prefUserId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          prefUserId = user.id;
          await updateNotificationPreferences(tenantId, user.id, {
            mentions: { inApp: false, email: 'off' },
          });
        },
        query: async (tenantId) => {
          const prefs = await getNotificationPreferences(tenantId, prefUserId);
          // If isolation works, prefs for wrong tenant should be defaults
          return prefs.mentions.inApp === false ? [prefs] : [];
        },
      });
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // Default Preferences
  // ---------------------------------------------------------------------------

  describe('getNotificationPreferences — defaults', () => {
    it('returns defaults when no row exists', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const prefs = await getNotificationPreferences(tenant.id, user.id);

      expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    }, 30_000);

    it('defaults mentions to inApp: true, email: instant', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const prefs = await getNotificationPreferences(tenant.id, user.id);

      expect(prefs.mentions).toEqual({ inApp: true, email: 'instant' });
    }, 30_000);

    it('defaults dms to inApp: true, email: instant', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const prefs = await getNotificationPreferences(tenant.id, user.id);

      expect(prefs.dms).toEqual({ inApp: true, email: 'instant' });
    }, 30_000);

    it('defaults threadReplies to inApp: true, email: digest', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const prefs = await getNotificationPreferences(tenant.id, user.id);

      expect(prefs.threadReplies).toEqual({ inApp: true, email: 'digest' });
    }, 30_000);

    it('defaults digestFrequency to daily', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const prefs = await getNotificationPreferences(tenant.id, user.id);

      expect(prefs.digestFrequency).toBe('daily');
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // Update / Merge
  // ---------------------------------------------------------------------------

  describe('updateNotificationPreferences — merge behavior', () => {
    it('creates preferences row on first update', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await updateNotificationPreferences(tenant.id, user.id, {
        mentions: { inApp: false, email: 'off' },
      });

      const prefs = await getNotificationPreferences(tenant.id, user.id);
      expect(prefs.mentions).toEqual({ inApp: false, email: 'off' });
      // Other fields should retain defaults
      expect(prefs.dms).toEqual({ inApp: true, email: 'instant' });
    }, 30_000);

    it('merges partial update with existing preferences', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      // First update
      await updateNotificationPreferences(tenant.id, user.id, {
        mentions: { inApp: false, email: 'off' },
      });

      // Second partial update
      await updateNotificationPreferences(tenant.id, user.id, {
        digestFrequency: 'hourly',
      });

      const prefs = await getNotificationPreferences(tenant.id, user.id);
      expect(prefs.mentions).toEqual({ inApp: false, email: 'off' });
      expect(prefs.digestFrequency).toBe('hourly');
      expect(prefs.dms).toEqual({ inApp: true, email: 'instant' });
    }, 30_000);

    it('updates mute schedule', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await updateNotificationPreferences(tenant.id, user.id, {
        muteSchedule: {
          enabled: true,
          start: '23:00',
          end: '07:00',
          timezone: 'America/New_York',
        },
      });

      const prefs = await getNotificationPreferences(tenant.id, user.id);
      expect(prefs.muteSchedule).toEqual({
        enabled: true,
        start: '23:00',
        end: '07:00',
        timezone: 'America/New_York',
      });
    }, 30_000);
  });
});
