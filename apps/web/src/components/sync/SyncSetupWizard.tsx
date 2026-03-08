'use client';

/**
 * SyncSetupWizard — 3-step wizard for connecting Airtable, selecting a base
 * and tables, configuring per-table filters, and starting the initial sync.
 *
 * Step 1: Authenticate (OAuth popup)
 * Step 2: Select Base
 * Step 3: Select Tables + Filters + Quota + Start Sync
 *
 * Uses Dialog (shadcn) as the container — "Wizard Create" pattern.
 * State managed via useReducer with discriminated actions.
 */

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { SyncFilterBuilder } from './SyncFilterBuilder';
import type { FilterField } from './SyncFilterBuilder';
import {
  initiateAirtableConnection,
  initiateNotionConnection,
  listBasesForConnection,
  listDatabasesForConnection,
  selectBaseForConnection,
} from '@/actions/sync-connections';
import {
  listTablesInBase,
  fetchEstimatedRecordCount,
  fetchNotionEstimatedRecordCount,
  getNotionDatabaseProperties,
  checkQuotaForSync,
  saveSyncConfigAndStartSync,
} from '@/actions/sync-setup';
import type { AirtableBase, AirtableTableMeta, NotionDatabase, FilterRule, SyncConfig } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type SyncPlatformChoice = 'airtable' | 'notion';

export interface SyncSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConnectionId?: string;
  onSyncStarted?: (connectionId: string) => void;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface TableSelection {
  enabled: boolean;
  filters: FilterRule[];
  estimatedCount: number;
  isExact: boolean;
  showFilters: boolean;
}

/** Unified base/database item for Step 2 display. */
interface BaseItem {
  id: string;
  name: string;
  detail: string;
}

interface WizardState {
  step: 1 | 2 | 3;
  platform: SyncPlatformChoice | null;
  connectionId: string | null;
  bases: BaseItem[];
  selectedBase: BaseItem | null;
  tables: AirtableTableMeta[];
  tableSelections: Record<string, TableSelection>;
  quotaRemaining: number;
  quotaAllowed: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: WizardState = {
  step: 1,
  platform: null,
  connectionId: null,
  bases: [],
  selectedBase: null,
  tables: [],
  tableSelections: {},
  quotaRemaining: 0,
  quotaAllowed: true,
  loading: false,
  saving: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Reducer actions
// ---------------------------------------------------------------------------

type WizardAction =
  | { type: 'SET_PLATFORM'; platform: SyncPlatformChoice }
  | { type: 'SET_CONNECTION'; connectionId: string }
  | { type: 'SET_BASES'; bases: BaseItem[] }
  | { type: 'SELECT_BASE'; base: BaseItem }
  | { type: 'SET_TABLES'; tables: AirtableTableMeta[] }
  | { type: 'TOGGLE_TABLE'; tableId: string }
  | { type: 'SET_TABLE_FILTERS'; tableId: string; filters: FilterRule[] }
  | { type: 'SET_TABLE_COUNT'; tableId: string; count: number; isExact: boolean }
  | { type: 'TOGGLE_TABLE_FILTERS'; tableId: string }
  | { type: 'SET_QUOTA'; remaining: number; allowed: boolean }
  | { type: 'GO_TO_STEP'; step: 1 | 2 | 3 }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_PLATFORM':
      return { ...state, platform: action.platform };
    case 'SET_CONNECTION':
      return { ...state, connectionId: action.connectionId, error: null };
    case 'SET_BASES':
      return { ...state, bases: action.bases, loading: false };
    case 'SELECT_BASE':
      return { ...state, selectedBase: action.base };
    case 'SET_TABLES': {
      const selections: Record<string, TableSelection> = {};
      for (const table of action.tables) {
        selections[table.id] = {
          enabled: false,
          filters: [],
          estimatedCount: 0,
          isExact: true,
          showFilters: false,
        };
      }
      return { ...state, tables: action.tables, tableSelections: selections, loading: false };
    }
    case 'TOGGLE_TABLE':
      return {
        ...state,
        tableSelections: {
          ...state.tableSelections,
          [action.tableId]: {
            ...state.tableSelections[action.tableId]!,
            enabled: !state.tableSelections[action.tableId]!.enabled,
          },
        },
      };
    case 'SET_TABLE_FILTERS':
      return {
        ...state,
        tableSelections: {
          ...state.tableSelections,
          [action.tableId]: {
            ...state.tableSelections[action.tableId]!,
            filters: action.filters,
          },
        },
      };
    case 'SET_TABLE_COUNT':
      return {
        ...state,
        tableSelections: {
          ...state.tableSelections,
          [action.tableId]: {
            ...state.tableSelections[action.tableId]!,
            estimatedCount: action.count,
            isExact: action.isExact,
          },
        },
      };
    case 'TOGGLE_TABLE_FILTERS':
      return {
        ...state,
        tableSelections: {
          ...state.tableSelections,
          [action.tableId]: {
            ...state.tableSelections[action.tableId]!,
            showFilters: !state.tableSelections[action.tableId]!.showFilters,
          },
        },
      };
    case 'SET_QUOTA':
      return { ...state, quotaRemaining: action.remaining, quotaAllowed: action.allowed };
    case 'GO_TO_STEP':
      return { ...state, step: action.step, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_SAVING':
      return { ...state, saving: action.saving };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false, saving: false };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LARGE_TABLE_THRESHOLD = 10_000;

function getSelectedCount(state: WizardState): {
  tableCount: number;
  recordCount: number;
  hasInexact: boolean;
} {
  let tableCount = 0;
  let recordCount = 0;
  let hasInexact = false;

  for (const sel of Object.values(state.tableSelections)) {
    if (sel.enabled) {
      tableCount++;
      recordCount += sel.estimatedCount;
      if (!sel.isExact) hasInexact = true;
    }
  }

  return { tableCount, recordCount, hasInexact };
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const t = useTranslations('sync_wizard');
  const steps = [
    { num: 1, label: t('step_authenticate') },
    { num: 2, label: t('step_select_base') },
    { num: 3, label: t('step_select_tables') },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium
              ${step.num < currentStep
                ? 'bg-primary text-primary-foreground'
                : step.num === currentStep
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-muted text-muted-foreground'
              }`}
          >
            {step.num < currentStep ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              step.num
            )}
          </div>
          <span className={`text-xs hidden sm:inline ${step.num === currentStep ? 'font-medium' : 'text-muted-foreground'}`}>
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px ${step.num < currentStep ? 'bg-primary' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SyncSetupWizard({
  open,
  onOpenChange,
  existingConnectionId,
  onSyncStarted,
}: SyncSetupWizardProps) {
  const t = useTranslations('sync_wizard');
  const [state, dispatch] = useReducer(wizardReducer, {
    ...initialState,
    connectionId: existingConnectionId ?? null,
    step: existingConnectionId ? 2 : 1,
  });

  const popupRef = useRef<Window | null>(null);

  // -------------------------------------------------------------------------
  // Reset on close
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open) {
      dispatch({ type: 'RESET' });
    }
  }, [open]);

  // -------------------------------------------------------------------------
  // Listen for OAuth postMessage
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? window.location.origin;
      if (event.origin !== new URL(appUrl).origin) return;

      // Airtable OAuth complete
      if (event.data?.type === 'airtable_oauth_complete' && event.data.connectionId) {
        dispatch({ type: 'SET_CONNECTION', connectionId: event.data.connectionId });
        dispatch({ type: 'GO_TO_STEP', step: 2 });
        popupRef.current = null;
      }

      // Notion OAuth complete
      if (event.data?.type === 'notion_oauth_complete' && event.data.connectionId) {
        dispatch({ type: 'SET_CONNECTION', connectionId: event.data.connectionId });
        dispatch({ type: 'GO_TO_STEP', step: 2 });
        popupRef.current = null;
      }

      // OAuth errors
      if (event.data?.type === 'airtable_oauth_error' || event.data?.type === 'notion_oauth_error') {
        dispatch({ type: 'SET_ERROR', error: event.data.error ?? t('error_oauth') });
        popupRef.current = null;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [t]);

  // -------------------------------------------------------------------------
  // Load bases when entering step 2
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (state.step !== 2 || !state.connectionId) return;
    if (state.bases.length > 0) return;

    let cancelled = false;
    dispatch({ type: 'SET_LOADING', loading: true });

    const loadBases = state.platform === 'notion'
      ? listDatabasesForConnection({ connectionId: state.connectionId })
          .then((databases: NotionDatabase[]) =>
            databases.map((db) => ({ id: db.id, name: db.title, detail: db.icon ?? '' })),
          )
      : listBasesForConnection({ connectionId: state.connectionId })
          .then((bases: AirtableBase[]) =>
            bases.map((b) => ({ id: b.id, name: b.name, detail: b.permissionLevel })),
          );

    loadBases
      .then((bases) => {
        if (!cancelled) dispatch({ type: 'SET_BASES', bases });
      })
      .catch((err: Error) => {
        if (!cancelled) dispatch({ type: 'SET_ERROR', error: err.message });
      });

    return () => { cancelled = true; };
  }, [state.step, state.connectionId, state.bases.length, state.platform]);

  // -------------------------------------------------------------------------
  // Load tables when entering step 3
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (state.step !== 3 || !state.connectionId || !state.selectedBase) return;
    if (state.tables.length > 0) return;

    let cancelled = false;
    dispatch({ type: 'SET_LOADING', loading: true });

    const loadTables = state.platform === 'notion'
      ? getNotionDatabaseProperties({
          connectionId: state.connectionId,
          databaseId: state.selectedBase.id,
        }).then((result) => ({
          // Notion: a single database is a single "table" with properties as fields
          tables: [{
            id: result.database.id,
            name: result.database.title,
            primaryFieldId: result.database.properties.find((p) => p.type === 'title')?.id ?? '',
            fields: result.database.properties.map((p) => ({
              id: p.id,
              name: p.name,
              type: p.type,
            })),
          }] satisfies AirtableTableMeta[],
        }))
      : listTablesInBase({
          connectionId: state.connectionId,
          baseId: state.selectedBase.id,
        });

    Promise.all([
      loadTables,
      checkQuotaForSync({ estimatedCount: 0 }),
    ])
      .then(([tablesResult, quotaResult]) => {
        if (cancelled) return;
        dispatch({ type: 'SET_TABLES', tables: tablesResult.tables });
        dispatch({
          type: 'SET_QUOTA',
          remaining: quotaResult.remaining,
          allowed: quotaResult.allowed,
        });
      })
      .catch((err: Error) => {
        if (!cancelled) dispatch({ type: 'SET_ERROR', error: err.message });
      });

    return () => { cancelled = true; };
  }, [state.step, state.connectionId, state.selectedBase, state.tables.length, state.platform]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleConnect = useCallback(async (platform: SyncPlatformChoice) => {
    dispatch({ type: 'SET_PLATFORM', platform });
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const { authUrl } = platform === 'notion'
        ? await initiateNotionConnection()
        : await initiateAirtableConnection();
      const popup = window.open(
        authUrl,
        `${platform}_oauth`,
        'width=600,height=700,scrollbars=yes',
      );
      popupRef.current = popup;
      dispatch({ type: 'SET_LOADING', loading: false });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message });
    }
  }, []);

  const handleSelectBase = useCallback(
    async (base: BaseItem) => {
      if (!state.connectionId) return;
      dispatch({ type: 'SELECT_BASE', base });
      dispatch({ type: 'SET_LOADING', loading: true });

      try {
        await selectBaseForConnection({
          connectionId: state.connectionId,
          baseId: base.id,
          baseName: base.name,
        });
        dispatch({ type: 'GO_TO_STEP', step: 3 });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: (err as Error).message });
      }
    },
    [state.connectionId],
  );

  const handleToggleTable = useCallback(
    async (tableId: string) => {
      dispatch({ type: 'TOGGLE_TABLE', tableId });

      const sel = state.tableSelections[tableId];
      if (!sel || !state.connectionId || !state.selectedBase) return;

      // If toggling ON and no count yet, fetch estimate
      if (!sel.enabled && sel.estimatedCount === 0) {
        try {
          const result = state.platform === 'notion'
            ? await fetchNotionEstimatedRecordCount({
                connectionId: state.connectionId,
                databaseId: tableId,
              })
            : await fetchEstimatedRecordCount({
                connectionId: state.connectionId,
                baseId: state.selectedBase.id,
                tableId,
              });
          dispatch({
            type: 'SET_TABLE_COUNT',
            tableId,
            count: result.count,
            isExact: result.isExact,
          });
        } catch {
          // Non-blocking — count remains 0
        }
      }
    },
    [state.tableSelections, state.connectionId, state.selectedBase, state.platform],
  );

  const handleFilterChange = useCallback(
    (tableId: string, filters: FilterRule[]) => {
      dispatch({ type: 'SET_TABLE_FILTERS', tableId, filters });
    },
    [],
  );

  const handleStartSync = useCallback(async () => {
    if (!state.connectionId || !state.selectedBase) return;

    dispatch({ type: 'SET_SAVING', saving: true });

    const syncConfig: SyncConfig = {
      polling_interval_seconds: 300,
      tables: state.tables.map((table) => {
        const sel = state.tableSelections[table.id]!;
        return {
          external_table_id: table.id,
          external_table_name: table.name,
          enabled: sel.enabled,
          sync_filter: sel.filters.length > 0 ? sel.filters : null,
          estimated_record_count: sel.estimatedCount,
          synced_record_count: 0,
        };
      }),
    };

    try {
      await saveSyncConfigAndStartSync({
        connectionId: state.connectionId,
        syncConfig,
      });
      const successMessage = t('sync_started');
      toast.success(successMessage);
      onSyncStarted?.(state.connectionId);
      onOpenChange(false);
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: (err as Error).message });
    }
  }, [state, t, onSyncStarted, onOpenChange]);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const { tableCount, recordCount, hasInexact } = getSelectedCount(state);
  const quotaExceeded = recordCount > state.quotaRemaining;
  const canStartSync = tableCount > 0 && !quotaExceeded && !state.saving;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="sync-setup-wizard">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={state.step} />

        {state.error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}

        {/* Step 1: Authenticate — Platform Selection */}
        {state.step === 1 && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">{t('step1_description')}</p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => handleConnect('airtable')}
                disabled={state.loading}
                data-testid="connect-airtable-button"
              >
                {state.loading && state.platform === 'airtable' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('connect_airtable')}
              </Button>
              <Button
                variant="default"
                onClick={() => handleConnect('notion')}
                disabled={state.loading}
                data-testid="connect-notion-button"
              >
                {state.loading && state.platform === 'notion' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('connect_notion')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Base */}
        {state.step === 2 && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">{t('step2_description')}</p>

            {state.loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            )}

            {!state.loading && state.bases.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t('no_bases')}
              </p>
            )}

            {!state.loading && state.bases.map((base) => (
              <Card
                key={base.id}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleSelectBase(base)}
                data-testid={`base-card-${base.id}`}
              >
                <div>
                  <div className="font-medium text-sm">{base.name}</div>
                  <div className="text-xs text-muted-foreground">{base.id}</div>
                </div>
                {base.detail && (
                  <Badge variant="default" className="text-xs">
                    {base.detail}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Step 3: Select Tables */}
        {state.step === 3 && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">{t('step3_description')}</p>

            {/* Quota bar */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted text-sm">
              <span>
                {t('quota_selected', { tables: tableCount, records: recordCount })}
                {hasInexact && '+'}
              </span>
              <span className={quotaExceeded ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                {t('quota_remaining', { remaining: state.quotaRemaining })}
              </span>
            </div>

            {quotaExceeded && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t('quota_exceeded')}
              </div>
            )}

            {state.loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            )}

            {!state.loading && state.tables.map((table) => {
              const sel = state.tableSelections[table.id]!;
              const isLargeTable = sel.enabled && sel.estimatedCount > LARGE_TABLE_THRESHOLD && sel.filters.length === 0;

              const filterFields: FilterField[] = table.fields.map((f) => ({
                id: f.id,
                name: f.name,
                type: f.type,
              }));

              return (
                <div
                  key={table.id}
                  className="border rounded-lg p-3 space-y-2"
                  data-testid={`table-row-${table.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`table-${table.id}`}
                      checked={sel.enabled}
                      onCheckedChange={() => handleToggleTable(table.id)}
                    />
                    <label
                      htmlFor={`table-${table.id}`}
                      className="flex-1 text-sm font-medium cursor-pointer"
                    >
                      {table.name}
                    </label>
                    {sel.enabled && (
                      <span className="text-xs text-muted-foreground">
                        {sel.isExact ? '' : '~'}
                        {sel.estimatedCount} {t('records')}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => dispatch({ type: 'TOGGLE_TABLE_FILTERS', tableId: table.id })}
                    >
                      {t('filters')} {sel.filters.length > 0 && `(${sel.filters.length})`}
                    </Button>
                  </div>

                  {isLargeTable && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 pl-7">
                      <AlertTriangle className="h-3 w-3" />
                      {t('large_table_warning')}
                    </div>
                  )}

                  {sel.showFilters && (
                    <>
                      <Separator className="my-2" />
                      <div className="pl-7">
                        <SyncFilterBuilder
                          fields={filterFields}
                          filters={sel.filters}
                          onChange={(filters) => handleFilterChange(table.id, filters)}
                          mode="platform"
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {state.step > 1 && state.step < 3 && (
            <Button
              variant="default"
              onClick={() => dispatch({ type: 'GO_TO_STEP', step: (state.step - 1) as 1 | 2 })}
            >
              {t('back')}
            </Button>
          )}
          {state.step === 3 && (
            <Button
              onClick={handleStartSync}
              disabled={!canStartSync}
              data-testid="start-sync-button"
            >
              {state.saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('start_sync')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
