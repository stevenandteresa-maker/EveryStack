// ---------------------------------------------------------------------------
// Notion adapter barrel — re-exports adapter, transforms, types, filter,
// OAuth, and API client
// ---------------------------------------------------------------------------

export { NotionAdapter, registerNotionTransforms } from './notion-adapter';
export { NOTION_TRANSFORMS } from './notion-field-transforms';
export { translateToNotionFilter } from './notion-filter';
export type { NotionFilter, NotionPropertyFilter, NotionCompoundFilter } from './notion-filter';
export type {
  NotionPage,
  NotionProperty,
  NotionPropertyType,
  NotionRichText,
  NotionUser,
  NotionSelectOption,
  NotionDate,
  NotionFile,
} from './notion-types';

// OAuth
export {
  getNotionAuthUrl,
  exchangeNotionCodeForTokens,
  listNotionDatabases,
  getNotionDatabaseSchema,
  estimateNotionRecordCount,
} from './oauth';
export type {
  NotionTokens,
  NotionDatabase,
  NotionPropertyMeta,
  NotionDatabaseMeta,
} from './oauth';

// API client
export { NotionApiClient, NOTION_API_URL } from './api-client';
export type {
  NotionQueryResponse,
  NotionPageResult,
  NotionQueryOptions,
} from './api-client';
