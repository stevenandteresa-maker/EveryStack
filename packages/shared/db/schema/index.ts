// Schema barrel file — all Drizzle table definitions are re-exported from here.
// Usage: import { users, tenants, workspaces } from '@everystack/shared/db';

export { users } from './users';
export type { User, NewUser } from './users';

export { tenants } from './tenants';
export type { Tenant, NewTenant } from './tenants';

export { tenantMemberships, tenantMembershipsRelations } from './tenant-memberships';
export type { TenantMembership, NewTenantMembership } from './tenant-memberships';

export { boards, boardsRelations } from './boards';
export type { Board, NewBoard } from './boards';

export { boardMemberships, boardMembershipsRelations } from './board-memberships';
export type { BoardMembership, NewBoardMembership } from './board-memberships';

export { workspaces, workspacesRelations } from './workspaces';
export type { Workspace, NewWorkspace } from './workspaces';

export { workspaceMemberships, workspaceMembershipsRelations } from './workspace-memberships';
export type { WorkspaceMembership, NewWorkspaceMembership } from './workspace-memberships';

export { baseConnections, baseConnectionsRelations } from './base-connections';
export type { BaseConnection, NewBaseConnection } from './base-connections';

export { tables, tablesRelations } from './tables';
export type { Table, NewTable } from './tables';

export { fields, fieldsRelations } from './fields';
export type { Field, NewField } from './fields';

export { records, recordsRelations } from './records';
export type { DbRecord, NewDbRecord } from './records';

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

export { syncedFieldMappings, syncedFieldMappingsRelations } from './synced-field-mappings';
export type { SyncedFieldMapping, NewSyncedFieldMapping } from './synced-field-mappings';

export { syncConflicts, syncConflictsRelations } from './sync-conflicts';
export type { SyncConflict, NewSyncConflict } from './sync-conflicts';

export { syncFailures, syncFailuresRelations } from './sync-failures';
export type { SyncFailure, NewSyncFailure } from './sync-failures';

export { syncSchemaChanges, syncSchemaChangesRelations } from './sync-schema-changes';
export type { SyncSchemaChange, NewSyncSchemaChange } from './sync-schema-changes';

export { threads, threadsRelations } from './threads';
export type { Thread, NewThread } from './threads';

export { threadParticipants, threadParticipantsRelations } from './thread-participants';
export type { ThreadParticipant, NewThreadParticipant } from './thread-participants';

export { threadMessages, threadMessagesRelations } from './thread-messages';
export type { ThreadMessage, NewThreadMessage } from './thread-messages';

export { userSavedMessages, userSavedMessagesRelations } from './user-saved-messages';
export type { UserSavedMessage, NewUserSavedMessage } from './user-saved-messages';

export { userTasks, userTasksRelations } from './user-tasks';
export type { UserTask, NewUserTask } from './user-tasks';

export { userEvents, userEventsRelations } from './user-events';
export type { UserEvent, NewUserEvent } from './user-events';

export { notifications, notificationsRelations } from './notifications';
export type { Notification, NewNotification } from './notifications';

export { userNotificationPreferences, userNotificationPreferencesRelations } from './user-notification-preferences';
export type { UserNotificationPreference, NewUserNotificationPreference } from './user-notification-preferences';

export { documentTemplates, documentTemplatesRelations } from './document-templates';
export type { DocumentTemplate, NewDocumentTemplate } from './document-templates';

export { generatedDocuments, generatedDocumentsRelations } from './generated-documents';
export type { GeneratedDocument, NewGeneratedDocument } from './generated-documents';

export { automations, automationsRelations } from './automations';
export type { Automation, NewAutomation } from './automations';

export { automationRuns, automationRunsRelations } from './automation-runs';
export type { AutomationRun, NewAutomationRun } from './automation-runs';

export { webhookEndpoints, webhookEndpointsRelations } from './webhook-endpoints';
export type { WebhookEndpoint, NewWebhookEndpoint } from './webhook-endpoints';

export { webhookDeliveryLog, webhookDeliveryLogRelations } from './webhook-delivery-log';
export type { WebhookDeliveryLog, NewWebhookDeliveryLog } from './webhook-delivery-log';

export { aiUsageLog, aiUsageLogRelations } from './ai-usage-log';
export type { AiUsageLog, NewAiUsageLog } from './ai-usage-log';

export { aiCreditLedger, aiCreditLedgerRelations } from './ai-credit-ledger';
export type { AiCreditLedger, NewAiCreditLedger } from './ai-credit-ledger';

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

export { featureSuggestions, featureSuggestionsRelations } from './feature-suggestions';
export type { FeatureSuggestion, NewFeatureSuggestion } from './feature-suggestions';

export { featureVotes, featureVotesRelations } from './feature-votes';
export type { FeatureVote, NewFeatureVote } from './feature-votes';
