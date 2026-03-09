/**
 * Table type system constants.
 *
 * Defines the 5 table types with their metadata: icon name, default tab color,
 * and default view type. All types default to Grid view for MVP.
 *
 * @see docs/reference/tables-and-views.md § Table Type System
 */

// ---------------------------------------------------------------------------
// Table type metadata
// ---------------------------------------------------------------------------

export type TableType = 'table' | 'projects' | 'calendar' | 'documents' | 'wiki';

export interface TableTypeMetadata {
  /** Lucide icon name for this table type. */
  icon: string;
  /** Default tab color hex (light mode). Used when tables.tab_color is null. */
  defaultTabColor: string;
  /** Default view type for this table type. All are 'grid' for MVP. */
  defaultView: 'grid';
  /** i18n key suffix for the table type label. */
  labelKey: string;
}

export const TABLE_TYPES: Record<TableType, TableTypeMetadata> = {
  table: {
    icon: 'Table2',
    defaultTabColor: '#64748B', // textSecondary Gray (light mode)
    defaultView: 'grid',
    labelKey: 'table',
  },
  projects: {
    icon: 'ListChecks',
    defaultTabColor: '#0D9488', // Teal
    defaultView: 'grid',
    labelKey: 'projects',
  },
  calendar: {
    icon: 'Calendar',
    defaultTabColor: '#D97706', // Amber (accent, light mode)
    defaultView: 'grid',
    labelKey: 'calendar',
  },
  documents: {
    icon: 'FolderOpen',
    defaultTabColor: '#7C3AED', // Purple (light mode)
    defaultView: 'grid',
    labelKey: 'documents',
  },
  wiki: {
    icon: 'BookOpen',
    defaultTabColor: '#2563EB', // Blue (light mode)
    defaultView: 'grid',
    labelKey: 'wiki',
  },
} as const;

// ---------------------------------------------------------------------------
// Tab color palette (10 colors)
// ---------------------------------------------------------------------------

export interface TabColor {
  name: string;
  /** Light mode hex. Used in the content area / sidebar. */
  hex: string;
  /** Dark mode hex. Sidebar uses dark background. */
  darkHex: string;
  /** i18n key suffix for the color name. */
  labelKey: string;
}

export const TAB_COLOR_PALETTE: TabColor[] = [
  { name: 'gray', hex: '#64748B', darkHex: '#94A3B8', labelKey: 'gray' },
  { name: 'teal', hex: '#0D9488', darkHex: '#2DD4BF', labelKey: 'teal' },
  { name: 'amber', hex: '#D97706', darkHex: '#FBBF24', labelKey: 'amber' },
  { name: 'purple', hex: '#7C3AED', darkHex: '#A78BFA', labelKey: 'purple' },
  { name: 'blue', hex: '#2563EB', darkHex: '#60A5FA', labelKey: 'blue' },
  { name: 'green', hex: '#059669', darkHex: '#34D399', labelKey: 'green' },
  { name: 'red', hex: '#DC2626', darkHex: '#F87171', labelKey: 'red' },
  { name: 'pink', hex: '#DB2777', darkHex: '#F472B6', labelKey: 'pink' },
  { name: 'orange', hex: '#EA580C', darkHex: '#FB923C', labelKey: 'orange' },
  { name: 'indigo', hex: '#4F46E5', darkHex: '#818CF8', labelKey: 'indigo' },
] as const;

/**
 * Resolve the effective tab color for a table.
 * Returns the custom tab_color if set, otherwise the table type default.
 * Uses dark mode hex for sidebar (dark background).
 */
export function resolveTabColor(
  tableType: string,
  tabColor: string | null | undefined,
  useDarkMode = true,
): string {
  if (tabColor) return tabColor;

  const meta = TABLE_TYPES[tableType as TableType];
  if (!meta) return TABLE_TYPES.table.defaultTabColor;

  if (useDarkMode) {
    const paletteEntry = TAB_COLOR_PALETTE.find(
      (c) => c.hex === meta.defaultTabColor,
    );
    return paletteEntry?.darkHex ?? meta.defaultTabColor;
  }

  return meta.defaultTabColor;
}

/**
 * Check if a string is a valid TableType.
 */
export function isValidTableType(value: string): value is TableType {
  return value in TABLE_TYPES;
}
