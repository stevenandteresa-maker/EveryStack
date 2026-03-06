// ---------------------------------------------------------------------------
// Sync package — canonical transform layer, field registry, platform adapters
// ---------------------------------------------------------------------------

// Types
export type {
  // Supporting types
  SourceRefs,
  SyncPlatform,
  // Category 1: Text
  TextValue,
  TextAreaValue,
  SmartDocValue,
  // Category 2: Number
  NumberValue,
  CurrencyValue,
  PercentValue,
  RatingValue,
  DurationValue,
  ProgressValue,
  AutoNumberValue,
  // Category 3: Selection
  SelectOption,
  SingleSelectValue,
  MultipleSelectValue,
  StatusCategory,
  StatusValue,
  TagValue,
  // Category 4: Date & Time
  DateValue,
  DateRangeValue,
  DueDateValue,
  TimeValue,
  CreatedAtValue,
  UpdatedAtValue,
  // Category 5: People & Contact
  PeopleValue,
  CreatedByValue,
  UpdatedByValue,
  EmailValue,
  PhoneEntry,
  PhoneValue,
  UrlValue,
  AddressData,
  AddressValue,
  FullNameData,
  FullNameValue,
  SocialValue,
  // Category 6: Boolean & Interactive
  CheckboxValue,
  ButtonValue,
  ChecklistItem,
  ChecklistValue,
  SignatureData,
  SignatureValue,
  // Category 7: Relational
  LinkedRecordValue,
  // Category 8: Files
  FileObject,
  FilesValue,
  // Category 9: Identification
  BarcodeValue,
  // Union and utility types
  CanonicalValue,
  CanonicalFieldType,
  CanonicalData,
  // Sync metadata
  RecordSyncMetadata,
  // Transform types
  PlatformFieldConfig,
  FieldTransform,
} from './types';

// Registry
export { FieldTypeRegistry, fieldTypeRegistry } from './field-registry';
