// ---------------------------------------------------------------------------
// Notion API Types — TypeScript definitions for Notion API responses
//
// These types model the Notion API's page/property structure for use
// in the NotionAdapter. Only page-level properties are synced — blocks
// (rich text content within pages) are not individually synced.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Notion property types — the `type` discriminant on each page property
// ---------------------------------------------------------------------------

export type NotionPropertyType =
  | 'title'
  | 'rich_text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'people'
  | 'files'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone_number'
  | 'formula'
  | 'relation'
  | 'rollup'
  | 'created_time'
  | 'created_by'
  | 'last_edited_time'
  | 'last_edited_by'
  | 'status'
  | 'unique_id';

// ---------------------------------------------------------------------------
// Rich text — Notion's rich text object model
// ---------------------------------------------------------------------------

export interface NotionRichTextAnnotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  color: string;
}

export interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  text?: {
    content: string;
    link?: { url: string } | null;
  };
  mention?: {
    type: string;
    [key: string]: unknown;
  };
  equation?: {
    expression: string;
  };
  annotations: NotionRichTextAnnotations;
  plain_text: string;
  href: string | null;
}

// ---------------------------------------------------------------------------
// Notion user object
// ---------------------------------------------------------------------------

export interface NotionUser {
  object: 'user';
  id: string;
  type?: 'person' | 'bot';
  name?: string | null;
  avatar_url?: string | null;
  person?: {
    email?: string;
  };
}

// ---------------------------------------------------------------------------
// Notion select/status option
// ---------------------------------------------------------------------------

export interface NotionSelectOption {
  id: string;
  name: string;
  color?: string;
}

export interface NotionStatusGroup {
  id: string;
  name: string;
  color: string;
  option_ids: string[];
}

// ---------------------------------------------------------------------------
// Notion date object
// ---------------------------------------------------------------------------

export interface NotionDate {
  start: string;
  end: string | null;
  time_zone: string | null;
}

// ---------------------------------------------------------------------------
// Notion file objects
// ---------------------------------------------------------------------------

export interface NotionFileExternal {
  type: 'external';
  external: { url: string };
  name: string;
}

export interface NotionFileInternal {
  type: 'file';
  file: { url: string; expiry_time: string };
  name: string;
}

export type NotionFile = NotionFileExternal | NotionFileInternal;

// ---------------------------------------------------------------------------
// Notion formula result
// ---------------------------------------------------------------------------

export interface NotionFormulaResult {
  type: 'string' | 'number' | 'boolean' | 'date';
  string?: string | null;
  number?: number | null;
  boolean?: boolean | null;
  date?: NotionDate | null;
}

// ---------------------------------------------------------------------------
// Notion rollup result
// ---------------------------------------------------------------------------

export interface NotionRollupResult {
  type: 'number' | 'date' | 'array' | 'unsupported' | 'incomplete';
  number?: number | null;
  date?: NotionDate | null;
  array?: Array<{ type: string; [key: string]: unknown }>;
  function?: string;
}

// ---------------------------------------------------------------------------
// Notion unique ID
// ---------------------------------------------------------------------------

export interface NotionUniqueId {
  prefix: string | null;
  number: number;
}

// ---------------------------------------------------------------------------
// Notion property value — discriminated by `type`
// ---------------------------------------------------------------------------

export interface NotionPropertyBase {
  id: string;
  type: NotionPropertyType;
}

export interface NotionTitleProperty extends NotionPropertyBase {
  type: 'title';
  title: NotionRichText[];
}

export interface NotionRichTextProperty extends NotionPropertyBase {
  type: 'rich_text';
  rich_text: NotionRichText[];
}

export interface NotionNumberProperty extends NotionPropertyBase {
  type: 'number';
  number: number | null;
}

export interface NotionSelectProperty extends NotionPropertyBase {
  type: 'select';
  select: NotionSelectOption | null;
}

export interface NotionMultiSelectProperty extends NotionPropertyBase {
  type: 'multi_select';
  multi_select: NotionSelectOption[];
}

export interface NotionDateProperty extends NotionPropertyBase {
  type: 'date';
  date: NotionDate | null;
}

export interface NotionPeopleProperty extends NotionPropertyBase {
  type: 'people';
  people: NotionUser[];
}

export interface NotionFilesProperty extends NotionPropertyBase {
  type: 'files';
  files: NotionFile[];
}

export interface NotionCheckboxProperty extends NotionPropertyBase {
  type: 'checkbox';
  checkbox: boolean;
}

export interface NotionUrlProperty extends NotionPropertyBase {
  type: 'url';
  url: string | null;
}

export interface NotionEmailProperty extends NotionPropertyBase {
  type: 'email';
  email: string | null;
}

export interface NotionPhoneNumberProperty extends NotionPropertyBase {
  type: 'phone_number';
  phone_number: string | null;
}

export interface NotionFormulaProperty extends NotionPropertyBase {
  type: 'formula';
  formula: NotionFormulaResult;
}

export interface NotionRelationProperty extends NotionPropertyBase {
  type: 'relation';
  relation: Array<{ id: string }>;
}

export interface NotionRollupProperty extends NotionPropertyBase {
  type: 'rollup';
  rollup: NotionRollupResult;
}

export interface NotionCreatedTimeProperty extends NotionPropertyBase {
  type: 'created_time';
  created_time: string;
}

export interface NotionCreatedByProperty extends NotionPropertyBase {
  type: 'created_by';
  created_by: NotionUser;
}

export interface NotionLastEditedTimeProperty extends NotionPropertyBase {
  type: 'last_edited_time';
  last_edited_time: string;
}

export interface NotionLastEditedByProperty extends NotionPropertyBase {
  type: 'last_edited_by';
  last_edited_by: NotionUser;
}

export interface NotionStatusProperty extends NotionPropertyBase {
  type: 'status';
  status: NotionSelectOption | null;
}

export interface NotionUniqueIdProperty extends NotionPropertyBase {
  type: 'unique_id';
  unique_id: NotionUniqueId;
}

// ---------------------------------------------------------------------------
// Union of all Notion property types
// ---------------------------------------------------------------------------

export type NotionProperty =
  | NotionTitleProperty
  | NotionRichTextProperty
  | NotionNumberProperty
  | NotionSelectProperty
  | NotionMultiSelectProperty
  | NotionDateProperty
  | NotionPeopleProperty
  | NotionFilesProperty
  | NotionCheckboxProperty
  | NotionUrlProperty
  | NotionEmailProperty
  | NotionPhoneNumberProperty
  | NotionFormulaProperty
  | NotionRelationProperty
  | NotionRollupProperty
  | NotionCreatedTimeProperty
  | NotionCreatedByProperty
  | NotionLastEditedTimeProperty
  | NotionLastEditedByProperty
  | NotionStatusProperty
  | NotionUniqueIdProperty;

// ---------------------------------------------------------------------------
// Notion page object
// ---------------------------------------------------------------------------

export interface NotionPage {
  object: 'page';
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: NotionUser;
  last_edited_by: NotionUser;
  archived: boolean;
  properties: Record<string, NotionProperty>;
  url: string;
}
