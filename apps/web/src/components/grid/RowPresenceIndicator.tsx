'use client';

/**
 * RowPresenceIndicator — 3px colored left border on a row when another user
 * is editing any field in that record.
 *
 * @see docs/reference/tables-and-views.md § Row-level presence
 */

import { memo } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RowPresenceIndicatorProps {
  /** The presence color for this row's left border. */
  color: string;
  /** Row height in pixels. */
  height: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RowPresenceIndicator = memo(function RowPresenceIndicator({
  color,
  height,
}: RowPresenceIndicatorProps) {
  return (
    <div
      className="absolute left-0 top-0 z-10"
      style={{
        width: 3,
        height,
        backgroundColor: color,
      }}
      aria-hidden="true"
    />
  );
});
