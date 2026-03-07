// ---------------------------------------------------------------------------
// Notion adapter barrel — re-exports adapter, transforms, types, and filter
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
