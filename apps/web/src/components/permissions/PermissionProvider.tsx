'use client';

/**
 * React context provider for field-level permissions.
 *
 * Wraps view-level components to provide permission state. Internally:
 * 1. Calls useFieldPermissions(viewId) for data loading via TanStack Query.
 * 2. Subscribes to permission.updated Socket.io events for real-time
 *    invalidation via handlePermissionUpdated().
 *
 * @see docs/reference/permissions.md § Field-Level Permissions
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import type { FieldPermissionMap, FieldPermissionState } from '@everystack/shared/auth';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { PermissionUpdatedPayload } from '@everystack/shared/realtime';
import { handlePermissionUpdated } from '@/lib/realtime/permission-handlers';
import { useFieldPermissions } from '@/lib/hooks/use-field-permissions';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface PermissionContextValue {
  permissionMap: FieldPermissionMap;
  isLoading: boolean;
  getPermission: (fieldId: string) => FieldPermissionState;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface PermissionProviderProps {
  viewId: string;
  userId: string;
  socket: Socket | null;
  children?: ReactNode;
}

export function PermissionProvider({
  viewId,
  userId,
  socket,
  children,
}: PermissionProviderProps) {
  const { permissionMap, isLoading } = useFieldPermissions(viewId);
  const queryClient = useQueryClient();

  // Subscribe to real-time permission events
  useEffect(() => {
    if (!socket) return;

    function onPermissionUpdated(payload: PermissionUpdatedPayload) {
      handlePermissionUpdated(payload, userId, queryClient);
    }

    socket.on(REALTIME_EVENTS.PERMISSION_UPDATED, onPermissionUpdated);

    return () => {
      socket.off(REALTIME_EVENTS.PERMISSION_UPDATED, onPermissionUpdated);
    };
  }, [socket, userId, queryClient]);

  const getPermission = useCallback(
    (fieldId: string): FieldPermissionState => {
      if (isLoading) return 'hidden';
      return permissionMap.get(fieldId) ?? 'hidden';
    },
    [permissionMap, isLoading],
  );

  return (
    <PermissionContext.Provider value={{ permissionMap, isLoading, getPermission }}>
      {children}
    </PermissionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Read the full permission context. Throws if used outside PermissionProvider.
 */
export function usePermissionContext(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionContext must be used within a PermissionProvider');
  }
  return context;
}

/**
 * Convenience hook: returns the FieldPermissionState for a single field.
 * Returns 'hidden' while loading (safe default — never leaks data).
 */
export function usePermission(fieldId: string): FieldPermissionState {
  const { getPermission } = usePermissionContext();
  return getPermission(fieldId);
}
