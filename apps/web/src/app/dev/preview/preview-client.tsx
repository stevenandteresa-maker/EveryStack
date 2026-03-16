'use client';

/**
 * DevPreviewClient — interactive preview of all major UI components.
 *
 * Tabs: Grid View, Card View, Record View, Chat & Threads, Notifications, Presence.
 * All callbacks are no-ops or local state. No database, no API calls.
 */

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { JSONContent } from '@tiptap/core';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/lib/query-provider';

// Dynamic imports to avoid @everystack/shared/db barrel pulling in server-only
// modules (@sentry/node → async_hooks) into the client bundle.
const DataGrid = dynamic(() => import('@/components/grid/DataGrid').then((m) => m.DataGrid), { ssr: false });
const CardView = dynamic(() => import('@/components/card-view/CardView').then((m) => m.CardView), { ssr: false });
const RecordView = dynamic(() => import('@/components/record-view/RecordView').then((m) => m.RecordView), { ssr: false });
const MessageItem = dynamic(() => import('@/components/chat/MessageItem').then((m) => m.MessageItem), { ssr: false });
const ChatEditor = dynamic(() => import('@/components/chat/ChatEditor').then((m) => m.ChatEditor), { ssr: false });
const NotificationTray = dynamic(() => import('@/components/notifications/NotificationTray').then((m) => m.NotificationTray), { ssr: false });
const PresenceIndicator = dynamic(() => import('@/components/presence/PresenceIndicator').then((m) => m.PresenceIndicator), { ssr: false });
const CustomStatusDisplay = dynamic(() => import('@/components/presence/CustomStatusDisplay').then((m) => m.CustomStatusDisplay), { ssr: false });
const CustomStatusEditor = dynamic(() => import('@/components/presence/CustomStatusEditor').then((m) => m.CustomStatusEditor), { ssr: false });

import { cn } from '@/lib/utils';
import type { CellPosition } from '@/components/grid/grid-types';
import type { RowDensity, CardLayout, ViewConfig } from '@/lib/types/grid';
import type { GridToolbarProps } from '@/components/grid/GridToolbar';
import type { PresenceState } from '@/components/presence/use-presence';
import {
  MOCK_FIELDS,
  MOCK_RECORDS,
  MOCK_VIEW_CONFIG,
  MOCK_RECORD_VIEW_LAYOUT,
  MOCK_THREAD_MESSAGES,
  MOCK_NOTIFICATIONS,
  MOCK_MENTION_SUGGESTIONS,
  CURRENT_USER_ID,
} from './mock-data';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type PreviewTab = 'grid' | 'card' | 'record' | 'chat' | 'notifications' | 'presence';

// ---------------------------------------------------------------------------
// No-op helpers
// ---------------------------------------------------------------------------

const noop = () => {};
const noopStr = (_s: string) => {};
const noopStrStr = (_a: string, _b: string) => {};
const noopStrStrNull = (_a: string, _b: string | null) => {};
const noopStrStrAny = (_a: string, _b: string, _c: unknown) => {};
const noopAsync = async (_s: string) => {};
const noopAsyncVoid = async () => {};

// ---------------------------------------------------------------------------
// Shared toolbar props (all no-op for preview)
// ---------------------------------------------------------------------------

function makeToolbarProps(
  fields: typeof MOCK_FIELDS,
  viewConfig: ViewConfig,
): Omit<GridToolbarProps, 'density' | 'onSetDensity'> {
  return {
    viewName: 'All Deals',
    viewType: 'grid',
    filterOpen: false,
    onFilterOpenChange: noop,
    sortOpen: false,
    onSortOpenChange: noop,
    groupOpen: false,
    onGroupOpenChange: noop,
    colorOpen: false,
    onColorOpenChange: noop,
    hideFieldsOpen: false,
    onHideFieldsOpenChange: noop,
    activeFilterCount: 0,
    activeSortCount: viewConfig.sorts?.length ?? 0,
    activeGroupCount: 0,
    hasColorRules: false,
    hiddenFieldCount: 0,
    sortPanelProps: {
      sorts: viewConfig.sorts ?? [],
      fields,
      onAddSort: noop,
      onRemoveSort: noop,
      onUpdateDirection: noop,
      onUpdateField: noop,
      onReorderSorts: noop,
      onClearSorts: noop,
      isAtLimit: false,
    },
    filterBuilderProps: {
      filters: { logic: 'and' as const, conditions: [], groups: [] },
      fields,
      activeFilterCount: 0,
      onAddCondition: noop,
      onRemoveCondition: noop,
      onUpdateCondition: noop,
      onAddGroup: noop,
      onAddConditionToGroup: noop,
      onRemoveGroup: noop,
      onSetLogic: noop,
      onSetGroupLogic: noop,
      onClearFilters: noop,
    },
    colorRuleBuilderProps: {
      colorRules: { row_rules: [], cell_rules: [] },
      fields,
      onAddRowRule: noop,
      onAddCellRule: noop,
      onUpdateRule: noop,
      onRemoveRule: noop,
      onClearRules: noop,
    },
    hideFieldsPanelProps: {
      fields,
      hiddenFieldIds: new Set<string>(),
      fieldOrder: fields.map((f) => f.id),
      onToggleField: noop,
      onShowAll: noop,
      onHideAll: noop,
      onReorderFields: noop,
    },
    groupPanelProps: {
      groups: [],
      fields,
      onAddGroup: noop,
      onRemoveGroup: noop,
      onUpdateDirection: noop,
      onReorderGroups: noop,
      onClearGroups: noop,
      isAtLimit: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Presence mock data
// ---------------------------------------------------------------------------

const PRESENCE_USERS: Array<{
  name: string;
  status: PresenceState;
  customEmoji?: string;
  customText?: string;
}> = [
  { name: 'Sarah Chen', status: 'online', customEmoji: '🎯', customText: 'Closing deals' },
  { name: 'Marcus Johnson', status: 'away', customEmoji: '☕', customText: 'Coffee break' },
  { name: 'Priya Patel', status: 'dnd', customEmoji: '🔇', customText: 'Deep work until 3pm' },
  { name: 'James Wright', status: 'online' },
  { name: 'Yuki Tanaka', status: 'offline' },
  { name: 'Elena Rodriguez', status: 'online', customEmoji: '📝', customText: 'Reviewing proposals' },
];

const PRESENCE_MAP: Record<string, PresenceState> = {
  'user-1': 'online',
  'user-2': 'away',
  'user-3': 'dnd',
  'user-4': 'online',
  'user-5': 'offline',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DevPreviewClient() {
  const t = useTranslations('dev_preview');
  const [tab, setTab] = useState<PreviewTab>('grid');
  const [density, setDensity] = useState<RowDensity>('medium');
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [cardLayout, setCardLayout] = useState<CardLayout>('grid');
  const [cardColumns, setCardColumns] = useState<2 | 3>(3);
  const [recordViewOpen, setRecordViewOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState(MOCK_THREAD_MESSAGES);

  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    MOCK_FIELDS.forEach((f) => {
      if (f.isPrimary) widths[f.id] = 280;
      else if (f.fieldType === 'currency') widths[f.id] = 140;
      else if (f.fieldType === 'checkbox') widths[f.id] = 80;
      else if (f.fieldType === 'rating') widths[f.id] = 120;
      else if (f.fieldType === 'date') widths[f.id] = 140;
      else if (f.fieldType === 'email') widths[f.id] = 200;
      else if (f.fieldType === 'phone') widths[f.id] = 180;
      else if (f.fieldType === 'textarea') widths[f.id] = 240;
      else widths[f.id] = 180;
    });
    return widths;
  }, []);

  const columnOrder = useMemo(
    () => MOCK_FIELDS.map((f) => f.id),
    [],
  );

  const visibleFields = useMemo(
    () => MOCK_FIELDS.filter((f) =>
      (MOCK_VIEW_CONFIG.field_config ?? []).includes(f.id),
    ),
    [],
  );

  const recordIds = useMemo(() => MOCK_RECORDS.map((r) => r.id), []);

  const selectedRecord = useMemo(
    () => MOCK_RECORDS.find((r) => r.id === selectedRecordId) ?? null,
    [selectedRecordId],
  );

  const handleExpandRecord = useCallback((recordId: string) => {
    setSelectedRecordId(recordId);
    setRecordViewOpen(true);
  }, []);

  const handleCloseRecordView = useCallback(() => {
    setRecordViewOpen(false);
    setSelectedRecordId(null);
  }, []);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!selectedRecordId) return;
      const idx = recordIds.indexOf(selectedRecordId);
      const nextIdx = direction === 'next'
        ? Math.min(idx + 1, recordIds.length - 1)
        : Math.max(idx - 1, 0);
      setSelectedRecordId(recordIds[nextIdx] ?? null);
    },
    [selectedRecordId, recordIds],
  );

  const handleChatSend = useCallback((content: unknown) => {
    const newMsg = {
      id: `msg-new-${Date.now()}`,
      thread_id: '00000000-0000-0000-0004-000000000001',
      author_id: CURRENT_USER_ID,
      author_name: 'James Wright',
      content: content as JSONContent,
      message_type: 'user',
      reactions: {},
      is_edited: false,
      is_deleted: false,
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, newMsg]);
  }, []);

  const toolbarProps = useMemo(
    () => makeToolbarProps(MOCK_FIELDS, MOCK_VIEW_CONFIG),
    [],
  );

  const tabs: { key: PreviewTab; label: string }[] = [
    { key: 'grid', label: 'Grid View' },
    { key: 'card', label: 'Card View' },
    { key: 'record', label: 'Record View' },
    { key: 'chat', label: 'Chat & Threads' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'presence', label: 'Presence' },
  ];

  return (
    <QueryProvider>
    <TooltipProvider>
      <div className="min-h-screen bg-[var(--content-bg)] flex flex-col">
        {/* Header */}
        <header className="border-b border-[var(--border-default)] bg-[var(--panel-bg)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-h2 text-[var(--text-primary)]">
                {t('title')}
              </h1>
              <p className="text-body-sm text-[var(--text-secondary)] mt-1">
                {t('subtitle', { recordCount: MOCK_RECORDS.length, fieldCount: MOCK_FIELDS.length })}
              </p>
            </div>
            <div className="flex gap-1 rounded-lg bg-[var(--surface-secondary)] p-1">
              {tabs.map((tabItem) => (
                <button
                  key={tabItem.key}
                  onClick={() => setTab(tabItem.key)}
                  className={cn(
                    'px-4 py-1.5 rounded-md text-body-sm font-medium transition-colors',
                    tab === tabItem.key
                      ? 'bg-white text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {tabItem.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 relative">
          {tab === 'grid' && (
            <div className="h-[calc(100vh-81px)]">
              <DataGrid
                records={MOCK_RECORDS}
                fields={MOCK_FIELDS}
                viewConfig={MOCK_VIEW_CONFIG}
                totalCount={MOCK_RECORDS.length}
                isLoading={false}
                error={null}
                userRole="manager"
                activeCell={activeCell}
                editingCell={editingCell}
                density={density}
                frozenColumnCount={MOCK_VIEW_CONFIG.frozenColumns ?? 1}
                columnWidths={columnWidths}
                columnOrder={columnOrder}
                columnColors={{}}
                hiddenFieldIds={new Set()}
                isSortActive={false}
                sorts={[]}
                filteredFieldIds={new Set()}
                onToggleSort={noopStr}
                onSortAscending={noopStr}
                onSortDescending={noopStr}
                onApplyQuickFilter={noopStrStrAny}
                onClearQuickFilter={noopStr}
                onCellClick={(rowId, fieldId) =>
                  setActiveCell({ rowId, fieldId })
                }
                onCellDoubleClick={(rowId, fieldId) =>
                  setEditingCell({ rowId, fieldId })
                }
                onCellStartReplace={(rowId, fieldId) =>
                  setEditingCell({ rowId, fieldId })
                }
                onCellSave={() => setEditingCell(null)}
                onCellCancel={() => setEditingCell(null)}
                onSelectColumn={noopStr}
                editMode="edit"
                selectedRows={selectedRows}
                selectionAnchor={null}
                selectionRange={null}
                setActiveCell={setActiveCell}
                startEditing={(cell, _mode) => setEditingCell(cell)}
                stopEditing={() => setEditingCell(null)}
                setSelectedRows={setSelectedRows}
                setSelectionAnchor={noop}
                setSelectionRange={noop}
                onColumnResize={noop}
                onColumnResizeEnd={noop}
                onColumnReorder={noop}
                onFreezeUpTo={noopStr}
                onUnfreeze={noop}
                onHideField={noopStr}
                onSetColumnColor={noopStrStrNull}
                onRenameField={noopStrStr}
                onExpandRecord={handleExpandRecord}
                isRecordViewOpen={recordViewOpen}
                viewName="All Deals"
                viewType="grid"
                sortPanelProps={toolbarProps.sortPanelProps}
                filterBuilderProps={toolbarProps.filterBuilderProps}
                colorRuleBuilderProps={toolbarProps.colorRuleBuilderProps}
                hideFieldsPanelProps={toolbarProps.hideFieldsPanelProps}
                groupPanelProps={toolbarProps.groupPanelProps}
                onSetDensity={setDensity}
                colorRules={{ row_rules: [], cell_rules: [] }}
                summaryFooterConfig={{ enabled: false, columns: {} }}
              />
            </div>
          )}

          {tab === 'card' && (
            <div className="p-6">
              <CardView
                records={MOCK_RECORDS}
                fields={MOCK_FIELDS}
                viewConfig={MOCK_VIEW_CONFIG}
                totalCount={MOCK_RECORDS.length}
                isLoading={false}
                error={null}
                layout={cardLayout}
                cardColumns={cardColumns}
                visibleFields={visibleFields}
                onSetLayout={setCardLayout}
                onSetCardColumns={setCardColumns}
                onExpandRecord={handleExpandRecord}
                onSaveField={noopStrStrAny}
                groups={[]}
                sorts={[]}
                collapsedGroups={new Set()}
                onToggleGroupCollapsed={noopStr}
                toolbarProps={toolbarProps}
              />
            </div>
          )}

          {tab === 'record' && (
            <div className="p-6">
              <p className="text-body text-[var(--text-secondary)] mb-4">
                {t('recordViewHint')}
              </p>
              <button
                onClick={() => handleExpandRecord(MOCK_RECORDS[0]!.id)}
                className="px-4 py-2 rounded-md bg-[var(--accent-primary)] text-white text-body-sm font-medium hover:opacity-90 transition-opacity"
              >
                {t('openRecordViewFirstRecord')}
              </button>
            </div>
          )}

          {/* ── Chat & Threads (Phase 3C) ── */}
          {tab === 'chat' && (
            <div className="p-6 max-w-3xl mx-auto">
              <h2 className="text-h2 text-[var(--text-primary)] mb-2">Record Thread</h2>
              <p className="text-body-sm text-[var(--text-secondary)] mb-6">
                Thread on the TechNova Deal record — showing messages, reactions, mentions, and the chat editor.
              </p>

              {/* Thread message list */}
              <div className="border border-[var(--border-default)] rounded-lg bg-white overflow-hidden">
                {/* Thread header */}
                <div className="px-4 py-3 border-b border-[var(--border-default)] bg-[var(--panel-bg)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-body font-semibold text-[var(--text-primary)]">TechNova Deal</h3>
                      <p className="text-caption text-[var(--text-tertiary)]">
                        {chatMessages.length} messages &middot; 4 participants
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-caption text-[var(--text-tertiary)] bg-[var(--surface-secondary)] px-2 py-0.5 rounded">Internal</span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="divide-y divide-[var(--border-subtle)] max-h-[500px] overflow-y-auto">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="px-2">
                      <MessageItem
                        message={msg}
                        currentUserId={CURRENT_USER_ID}
                        onReactionToggle={noop}
                        presenceMap={PRESENCE_MAP}
                      />
                    </div>
                  ))}
                </div>

                {/* Chat editor */}
                <div className="border-t border-[var(--border-default)] p-3">
                  <ChatEditor
                    onSend={handleChatSend}
                    mentionSuggestions={MOCK_MENTION_SUGGESTIONS}
                    placeholder="Type a message... (try @mention or formatting)"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications (Phase 3C) ── */}
          {tab === 'notifications' && (
            <div className="p-6 max-w-lg mx-auto">
              <h2 className="text-h2 text-[var(--text-primary)] mb-2">Notification Tray</h2>
              <p className="text-body-sm text-[var(--text-secondary)] mb-6">
                Grouped notifications with read/unread states, type icons, and relative timestamps.
              </p>

              <div className="border border-[var(--border-default)] rounded-lg overflow-hidden shadow-lg">
                <NotificationTray
                  notifications={MOCK_NOTIFICATIONS as never[]}
                  isLoading={false}
                  hasMore={false}
                  onMarkRead={noopAsync}
                  onMarkAllRead={noopAsyncVoid}
                  onLoadMore={noop}
                />
              </div>
            </div>
          )}

          {/* ── Presence (Phase 3C) ── */}
          {tab === 'presence' && (
            <div className="p-6 max-w-2xl mx-auto">
              <h2 className="text-h2 text-[var(--text-primary)] mb-2">Presence & Custom Status</h2>
              <p className="text-body-sm text-[var(--text-secondary)] mb-6">
                Presence indicators (4 states, 3 sizes), custom status display, and custom status editor.
              </p>

              {/* Presence indicators — all states & sizes */}
              <section className="mb-8">
                <h3 className="text-h3 text-[var(--text-primary)] mb-4">Presence States</h3>
                <div className="grid grid-cols-4 gap-6">
                  {(['online', 'away', 'dnd', 'offline'] as PresenceState[]).map((status) => (
                    <div key={status} className="flex flex-col items-center gap-3 p-4 bg-white border border-[var(--border-default)] rounded-lg">
                      <div className="flex items-center gap-3">
                        <PresenceIndicator status={status} size="small" />
                        <PresenceIndicator status={status} size="medium" />
                        <PresenceIndicator status={status} size="large" />
                      </div>
                      <span className="text-caption text-[var(--text-secondary)] capitalize">{status}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* User list with presence + custom status */}
              <section className="mb-8">
                <h3 className="text-h3 text-[var(--text-primary)] mb-4">Team Members</h3>
                <div className="bg-white border border-[var(--border-default)] rounded-lg divide-y divide-[var(--border-subtle)]">
                  {PRESENCE_USERS.map((user) => (
                    <div key={user.name} className="flex items-center gap-3 px-4 py-3">
                      {/* Avatar placeholder with presence dot */}
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-body-sm font-semibold text-[var(--text-secondary)]">
                          {user.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white rounded-full">
                          <PresenceIndicator status={user.status} size="small" />
                        </span>
                      </div>

                      {/* Name + custom status */}
                      <div className="flex-1 min-w-0">
                        <p className="text-body font-medium text-[var(--text-primary)]">{user.name}</p>
                        {user.customEmoji && (
                          <CustomStatusDisplay
                            emoji={user.customEmoji}
                            text={user.customText ?? ''}
                          />
                        )}
                      </div>

                      {/* Status label */}
                      <span className={cn(
                        'text-caption capitalize',
                        user.status === 'online' && 'text-emerald-600',
                        user.status === 'away' && 'text-yellow-600',
                        user.status === 'dnd' && 'text-red-600',
                        user.status === 'offline' && 'text-[var(--text-tertiary)]',
                      )}>
                        {user.status === 'dnd' ? 'Do not disturb' : user.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Custom status editor */}
              <section>
                <h3 className="text-h3 text-[var(--text-primary)] mb-4">Set Custom Status</h3>
                <div className="bg-white border border-[var(--border-default)] rounded-lg p-4 max-w-sm">
                  <CustomStatusEditor
                    initialEmoji="🎯"
                    initialText="Closing deals"
                    onSave={noop}
                    onClear={noop}
                  />
                </div>
              </section>
            </div>
          )}

          {/* Record View overlay — always mounted, visibility controlled by isOpen */}
          <RecordView
            isOpen={recordViewOpen}
            record={selectedRecord}
            fields={MOCK_FIELDS}
            layout={MOCK_RECORD_VIEW_LAYOUT}
            tableName="Deals"
            viewName="All Deals"
            tableId="00000000-0000-0000-0000-000000000010"
            viewId={null}
            recordIds={recordIds}
            currentRecordId={selectedRecordId}
            onNavigate={handleNavigate}
            onClose={handleCloseRecordView}
            onLayoutChange={noop}
          />
        </main>
      </div>
    </TooltipProvider>
    </QueryProvider>
  );
}
