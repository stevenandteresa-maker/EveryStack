// ---------------------------------------------------------------------------
// Schema barrel file — all 59 Drizzle table definitions (50 MVP + 2 feature management + 7 platform admin)
// Usage: import { users, tenants, workspaces } from '@everystack/shared/db/schema';
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tier 1 — Foundation (no tenant_id — no RLS)
// ---------------------------------------------------------------------------

export { users } from './users';
export type { User, NewUser } from './users';

export { tenants } from './tenants';
export type { Tenant, NewTenant } from './tenants';

// ---------------------------------------------------------------------------
// Tier 2 — Tenant Memberships & Boards
// ---------------------------------------------------------------------------

export { tenantMemberships, tenantMembershipsRelations } from './tenant-memberships';
export type { TenantMembership, NewTenantMembership } from './tenant-memberships';

export { boards, boardsRelations } from './boards';
export type { Board, NewBoard } from './boards';

export { boardMemberships, boardMembershipsRelations } from './board-memberships';
export type { BoardMembership, NewBoardMembership } from './board-memberships';

// ---------------------------------------------------------------------------
// Tier 3 — Workspaces & Platform Connections
// ---------------------------------------------------------------------------

export { workspaces, workspacesRelations } from './workspaces';
export type { Workspace, NewWorkspace } from './workspaces';

export { workspaceMemberships, workspaceMembershipsRelations } from './workspace-memberships';
export type { WorkspaceMembership, NewWorkspaceMembership } from './workspace-memberships';

export { baseConnections, baseConnectionsRelations } from './base-connections';
export type { BaseConnection, NewBaseConnection } from './base-connections';

// ---------------------------------------------------------------------------
// Tier 4 — Tables, Fields, Records
// ---------------------------------------------------------------------------

export { tables, tablesRelations } from './tables';
export type { Table, NewTable } from './tables';

export { fields, fieldsRelations } from './fields';
export type { Field, NewField } from './fields';

export { records, recordsRelations } from './records';
export type { DbRecord, NewDbRecord } from './records';

// ---------------------------------------------------------------------------
// Tier 5 — Views, Sections, Cross-Links
// ---------------------------------------------------------------------------

export { crossLinks, crossLinksRelations } from './cross-links';
export type { CrossLink, NewCrossLink } from './cross-links';

export { crossLinkIndex, crossLinkIndexRelations } from './cross-link-index';
export type { CrossLinkIndex, NewCrossLinkIndex } from './cross-link-index';

export { sections, sectionsRelations } from './sections';
export type { Section, NewSection } from './sections';

export { views, viewsRelations } from './views';
export type { View, NewView } from './views';

export { userViewPreferences, userViewPreferencesRelations } from './user-view-preferences';
export type { UserViewPreference, NewUserViewPreference } from './user-view-preferences';

export { recordViewConfigs, recordViewConfigsRelations } from './record-view-configs';
export type { RecordViewConfig, NewRecordViewConfig } from './record-view-configs';

export { recordTemplates, recordTemplatesRelations } from './record-templates';
export type { RecordTemplate, NewRecordTemplate } from './record-templates';

// ---------------------------------------------------------------------------
// Tier 6A — Portals & Forms
// ---------------------------------------------------------------------------

export { portals, portalsRelations } from './portals';
export type { Portal, NewPortal } from './portals';

export { portalAccess, portalAccessRelations } from './portal-access';
export type { PortalAccess, NewPortalAccess } from './portal-access';

export { portalSessions, portalSessionsRelations } from './portal-sessions';
export type { PortalSession, NewPortalSession } from './portal-sessions';

export { forms, formsRelations } from './forms';
export type { Form, NewForm } from './forms';

export { formSubmissions, formSubmissionsRelations } from './form-submissions';
export type { FormSubmission, NewFormSubmission } from './form-submissions';

// ---------------------------------------------------------------------------
// Tier 6B — Sync Infrastructure
// ---------------------------------------------------------------------------

export { syncedFieldMappings, syncedFieldMappingsRelations } from './synced-field-mappings';
export type { SyncedFieldMapping, NewSyncedFieldMapping } from './synced-field-mappings';

export { syncConflicts, syncConflictsRelations } from './sync-conflicts';
export type { SyncConflict, NewSyncConflict } from './sync-conflicts';

export { syncFailures, syncFailuresRelations } from './sync-failures';
export type { SyncFailure, NewSyncFailure } from './sync-failures';

export { syncSchemaChanges, syncSchemaChangesRelations } from './sync-schema-changes';
export type { SyncSchemaChange, NewSyncSchemaChange } from './sync-schema-changes';

// ---------------------------------------------------------------------------
// Tier 7 — Communications
// ---------------------------------------------------------------------------

export { threads, threadsRelations } from './threads';
export type { Thread, NewThread } from './threads';

export { threadParticipants, threadParticipantsRelations } from './thread-participants';
export type { ThreadParticipant, NewThreadParticipant } from './thread-participants';

export { threadMessages, threadMessagesRelations } from './thread-messages';
export type { ThreadMessage, NewThreadMessage } from './thread-messages';

export { userSavedMessages, userSavedMessagesRelations } from './user-saved-messages';
export type { UserSavedMessage, NewUserSavedMessage } from './user-saved-messages';

// ---------------------------------------------------------------------------
// Tier 8 — Notifications & Personal
// ---------------------------------------------------------------------------

export { userTasks, userTasksRelations } from './user-tasks';
export type { UserTask, NewUserTask } from './user-tasks';

export { userEvents, userEventsRelations } from './user-events';
export type { UserEvent, NewUserEvent } from './user-events';

export { notifications, notificationsRelations } from './notifications';
export type { Notification, NewNotification } from './notifications';

export { userNotificationPreferences, userNotificationPreferencesRelations } from './user-notification-preferences';
export type { UserNotificationPreference, NewUserNotificationPreference } from './user-notification-preferences';

// ---------------------------------------------------------------------------
// Tier 9 — Documents & Automations
// ---------------------------------------------------------------------------

export { documentTemplates, documentTemplatesRelations } from './document-templates';
export type { DocumentTemplate, NewDocumentTemplate } from './document-templates';

export { generatedDocuments, generatedDocumentsRelations } from './generated-documents';
export type { GeneratedDocument, NewGeneratedDocument } from './generated-documents';

export { automations, automationsRelations } from './automations';
export type { Automation, NewAutomation } from './automations';

export { automationRuns, automationRunsRelations } from './automation-runs';
export type { AutomationRun, NewAutomationRun } from './automation-runs';

// ---------------------------------------------------------------------------
// Tier 10 — Webhooks
// ---------------------------------------------------------------------------

export { webhookEndpoints, webhookEndpointsRelations } from './webhook-endpoints';
export type { WebhookEndpoint, NewWebhookEndpoint } from './webhook-endpoints';

export { webhookDeliveryLog, webhookDeliveryLogRelations } from './webhook-delivery-log';
export type { WebhookDeliveryLog, NewWebhookDeliveryLog } from './webhook-delivery-log';

// ---------------------------------------------------------------------------
// Tier 11 — AI & Metering
// ---------------------------------------------------------------------------

export { aiUsageLog, aiUsageLogRelations } from './ai-usage-log';
export type { AiUsageLog, NewAiUsageLog } from './ai-usage-log';

export { aiCreditLedger, aiCreditLedgerRelations } from './ai-credit-ledger';
export type { AiCreditLedger, NewAiCreditLedger } from './ai-credit-ledger';

// ---------------------------------------------------------------------------
// Tier 12 — Audit, API, Platform Utilities
// ---------------------------------------------------------------------------

export { auditLog, auditLogRelations } from './audit-log';
export type { AuditLog, NewAuditLog } from './audit-log';

export { apiKeys, apiKeysRelations } from './api-keys';
export type { ApiKey, NewApiKey } from './api-keys';

export { apiRequestLog, apiRequestLogRelations } from './api-request-log';
export type { ApiRequestLog, NewApiRequestLog } from './api-request-log';

export { userRecentItems, userRecentItemsRelations } from './user-recent-items';
export type { UserRecentItem, NewUserRecentItem } from './user-recent-items';

export { commandBarSessions, commandBarSessionsRelations } from './command-bar-sessions';
export type { CommandBarSession, NewCommandBarSession } from './command-bar-sessions';

// ---------------------------------------------------------------------------
// Tier 13 — Feature Management
// ---------------------------------------------------------------------------

export { featureSuggestions, featureSuggestionsRelations } from './feature-suggestions';
export type { FeatureSuggestion, NewFeatureSuggestion } from './feature-suggestions';

export { featureVotes, featureVotesRelations } from './feature-votes';
export type { FeatureVote, NewFeatureVote } from './feature-votes';

// ---------------------------------------------------------------------------
// Tier 14 — Platform Owner Console
// ---------------------------------------------------------------------------

export { supportRequests, supportRequestsRelations } from './support-requests';
export type { SupportRequest, NewSupportRequest } from './support-requests';

export { supportRequestMessages, supportRequestMessagesRelations } from './support-request-messages';
export type { SupportRequestMessage, NewSupportRequestMessage } from './support-request-messages';

export { adminImpersonationSessions, adminImpersonationSessionsRelations } from './admin-impersonation-sessions';
export type { AdminImpersonationSession, NewAdminImpersonationSession } from './admin-impersonation-sessions';

export { tenantFeatureFlags, tenantFeatureFlagsRelations } from './tenant-feature-flags';
export type { TenantFeatureFlag, NewTenantFeatureFlag } from './tenant-feature-flags';

export { platformNotices, platformNoticesRelations } from './platform-notices';
export type { PlatformNotice, NewPlatformNotice } from './platform-notices';

export { userDismissedNotices, userDismissedNoticesRelations } from './user-dismissed-notices';
export type { UserDismissedNotice, NewUserDismissedNotice } from './user-dismissed-notices';

// ---------------------------------------------------------------------------
// Tier 15 — Support System
// ---------------------------------------------------------------------------

export { aiSupportSessions, aiSupportSessionsRelations } from './ai-support-sessions';
export type { AiSupportSession, NewAiSupportSession } from './ai-support-sessions';

export { featureRequests, featureRequestsRelations } from './feature-requests';
export type { FeatureRequest, NewFeatureRequest } from './feature-requests';

export { tenantEnterpriseConfig, tenantEnterpriseConfigRelations } from './tenant-enterprise-config';
export type { TenantEnterpriseConfig, NewTenantEnterpriseConfig } from './tenant-enterprise-config';
