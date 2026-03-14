/**
 * Command Bar types — shared across search, navigation, commands, and recent items.
 *
 * @see docs/reference/command-bar.md
 */

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  record_id: string;
  table_id: string;
  table_name: string;
  primary_field_value: string;
  rank: number;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export interface NavigationResult {
  entity_type: 'table' | 'view';
  entity_id: string;
  name: string;
  parent_name?: string;
  icon?: string;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export interface CommandEntry {
  id: string;
  command_key: string;
  label: string;
  description: string;
  category: string;
  source: string; // 'system' | 'automation' | 'custom'
  context_scopes: string[]; // 'global' | 'table_view' | 'record_detail' | 'chat'
  permission_required: string;
  sort_order: number;
}

// ---------------------------------------------------------------------------
// Recent Items
// ---------------------------------------------------------------------------

export interface RecentItem {
  item_type: string;
  item_id: string;
  display_name: string;
  entity_context?: string;
  accessed_at: string; // ISO 8601
}

export interface RecentItemInput {
  item_type: string;
  item_id: string;
  display_name: string;
  entity_context?: string;
}

// ---------------------------------------------------------------------------
// AI Search
// ---------------------------------------------------------------------------

export type AISearchResultType = 'read' | 'action';

export interface AISearchResult {
  success: boolean;
  type: AISearchResultType;
  content: string;
  intent?: string;
  actionSuggestion?: {
    label: string;
    description: string;
    commandKey?: string;
    params?: Record<string, unknown>;
  };
  creditsCharged: number;
  creditsRemaining: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Command Execution
// ---------------------------------------------------------------------------

export interface CommandResult {
  success: boolean;
  message?: string;
  navigationTarget?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Search Params
// ---------------------------------------------------------------------------

export interface CommandBarSearchParams {
  query: string;
  workspace_id: string;
  scope?: 'global' | 'table'; // 'table' = scoped to current table
  current_table_id?: string; // when scope = 'table'
  limit?: number; // default 20
}
