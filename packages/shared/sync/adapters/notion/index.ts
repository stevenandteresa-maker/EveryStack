// ---------------------------------------------------------------------------
// Notion adapter barrel — re-exports adapter, transforms, and types
// ---------------------------------------------------------------------------

export { NotionAdapter, registerNotionTransforms } from './notion-adapter';
export { NOTION_TRANSFORMS } from './notion-field-transforms';
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
