'use client';

/**
 * TableTypeIcon — renders the correct lucide-react icon for a table type.
 *
 * @see docs/reference/tables-and-views.md § Table Type System
 */

import {
  Table2,
  ListChecks,
  Calendar,
  FolderOpen,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TableType } from '@/lib/constants/table-types';

export interface TableTypeIconProps {
  tableType: TableType | string;
  size?: number;
  className?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  table: Table2,
  projects: ListChecks,
  calendar: Calendar,
  documents: FolderOpen,
  wiki: BookOpen,
};

export function TableTypeIcon({ tableType, size = 16, className }: TableTypeIconProps) {
  const Icon = ICON_MAP[tableType] ?? Table2;
  return <Icon size={size} className={cn('shrink-0', className)} />;
}
