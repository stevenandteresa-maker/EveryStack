/**
 * Client-side notification grouping logic.
 *
 * Groups notifications by `group_key` within a 5-minute proximity window.
 *
 * @see docs/reference/communications.md § Smart Grouping
 */

import type { Notification } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationGroupItem {
  kind: 'single';
  notification: Notification;
}

export interface NotificationGroupCluster {
  kind: 'group';
  groupKey: string;
  notifications: Notification[];
}

export type NotificationEntry = NotificationGroupItem | NotificationGroupCluster;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Notifications within this window (ms) sharing a group_key are collapsed. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Groups a sorted (newest-first) notification list by `group_key` + 5-minute proximity.
 *
 * Notifications without a `group_key` are always rendered individually.
 * Within a group_key, consecutive notifications within 5 minutes of each other
 * are clustered together.
 */
export function groupNotifications(
  notifications: Notification[],
): NotificationEntry[] {
  if (notifications.length === 0) return [];

  const result: NotificationEntry[] = [];
  // Track groups by key → active cluster (most recent timestamp)
  const activeGroups = new Map<
    string,
    { cluster: Notification[]; latestTime: number }
  >();

  for (const notif of notifications) {
    const key = notif.groupKey;

    if (!key) {
      // No group_key → render individually
      result.push({ kind: 'single', notification: notif });
      continue;
    }

    const time = new Date(notif.createdAt).getTime();
    const existing = activeGroups.get(key);

    if (existing && existing.latestTime - time <= GROUP_WINDOW_MS) {
      // Within 5-minute window of the group's most recent — add to cluster
      existing.cluster.push(notif);
    } else {
      // Flush any existing group for this key
      if (existing) {
        flushGroup(existing.cluster, key, result);
      }
      // Start new cluster
      activeGroups.set(key, { cluster: [notif], latestTime: time });
    }
  }

  // Flush remaining groups
  for (const [key, group] of activeGroups) {
    flushGroup(group.cluster, key, result);
  }

  // Sort result by the first notification's createdAt (newest first)
  result.sort((a, b) => {
    const aTime = getEntryTime(a);
    const bTime = getEntryTime(b);
    return bTime - aTime;
  });

  return result;
}

function flushGroup(
  cluster: Notification[],
  key: string,
  result: NotificationEntry[],
): void {
  if (cluster.length === 1) {
    result.push({ kind: 'single', notification: cluster[0]! });
  } else {
    result.push({ kind: 'group', groupKey: key, notifications: cluster });
  }
}

function getEntryTime(entry: NotificationEntry): number {
  if (entry.kind === 'single') {
    return new Date(entry.notification.createdAt).getTime();
  }
  return new Date(entry.notifications[0]!.createdAt).getTime();
}
