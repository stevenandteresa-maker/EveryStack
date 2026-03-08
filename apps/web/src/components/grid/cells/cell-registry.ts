/**
 * Cell registry — maps field_type → { DisplayComponent, EditComponent, defaultWidth }.
 *
 * Uses the FieldTypeRegistry pattern (no switch statements on field types).
 * GridCell from Prompt 2 calls getCellComponents() to resolve which renderer to use.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { registerCellRenderer } from '../GridCell';
import { DEFAULT_COLUMN_WIDTHS } from '../grid-types';

import { TextCellDisplay, TextCellEdit } from './TextCell';
import { NumberCellDisplay, NumberCellEdit } from './NumberCell';
import { DateCellDisplay, DateCellEdit } from './DateCell';
import { CheckboxCellDisplay } from './CheckboxCell';
import { RatingCellDisplay } from './RatingCell';
import { CurrencyCellDisplay, CurrencyCellEdit } from './CurrencyCell';
import { PercentCellDisplay, PercentCellEdit } from './PercentCell';
import { SingleSelectCellDisplay, SingleSelectCellEdit } from './SingleSelectCell';
import { MultiSelectCellDisplay, MultiSelectCellEdit } from './MultiSelectCell';
import { PeopleCellDisplay, PeopleCellEdit } from './PeopleCell';
import { LinkedRecordCellDisplay, LinkedRecordCellEdit } from './LinkedRecordCell';
import { AttachmentCellDisplay, AttachmentCellEdit } from './AttachmentCell';
import { UrlCellDisplay, UrlCellEdit } from './UrlCell';
import { EmailCellDisplay, EmailCellEdit } from './EmailCell';
import { PhoneCellDisplay, PhoneCellEdit } from './PhoneCell';
import { SmartDocCellDisplay, SmartDocCellEdit } from './SmartDocCell';
import { BarcodeCellDisplay, BarcodeCellEdit } from './BarcodeCell';
import { ChecklistCellDisplay, ChecklistCellEdit } from './ChecklistCell';

/**
 * Register all Prompt 3 cell renderers.
 * Call this once at app initialization to populate the registry.
 */
export function registerPrompt3Cells(): void {
  registerCellRenderer('text', {
    DisplayComponent: TextCellDisplay,
    EditComponent: TextCellEdit,
  });

  registerCellRenderer('textarea', {
    DisplayComponent: TextCellDisplay,
    EditComponent: TextCellEdit,
  });

  registerCellRenderer('number', {
    DisplayComponent: NumberCellDisplay,
    EditComponent: NumberCellEdit,
  });

  registerCellRenderer('date', {
    DisplayComponent: DateCellDisplay,
    EditComponent: DateCellEdit,
  });

  registerCellRenderer('datetime', {
    DisplayComponent: DateCellDisplay,
    EditComponent: DateCellEdit,
  });

  registerCellRenderer('checkbox', {
    DisplayComponent: CheckboxCellDisplay,
  });

  registerCellRenderer('rating', {
    DisplayComponent: RatingCellDisplay,
  });

  registerCellRenderer('currency', {
    DisplayComponent: CurrencyCellDisplay,
    EditComponent: CurrencyCellEdit,
  });

  registerCellRenderer('percent', {
    DisplayComponent: PercentCellDisplay,
    EditComponent: PercentCellEdit,
  });
}

/**
 * Register all Prompt 4 cell renderers.
 * Call this once at app initialization to populate the registry.
 */
export function registerPrompt4Cells(): void {
  registerCellRenderer('single_select', {
    DisplayComponent: SingleSelectCellDisplay,
    EditComponent: SingleSelectCellEdit,
  });

  registerCellRenderer('multi_select', {
    DisplayComponent: MultiSelectCellDisplay,
    EditComponent: MultiSelectCellEdit,
  });

  registerCellRenderer('people', {
    DisplayComponent: PeopleCellDisplay,
    EditComponent: PeopleCellEdit,
  });

  registerCellRenderer('linked_record', {
    DisplayComponent: LinkedRecordCellDisplay,
    EditComponent: LinkedRecordCellEdit,
  });

  registerCellRenderer('attachment', {
    DisplayComponent: AttachmentCellDisplay,
    EditComponent: AttachmentCellEdit,
  });
}

/**
 * Register all Prompt 5 cell renderers.
 * Call this once at app initialization to populate the registry.
 */
export function registerPrompt5Cells(): void {
  registerCellRenderer('url', {
    DisplayComponent: UrlCellDisplay,
    EditComponent: UrlCellEdit,
  });

  registerCellRenderer('email', {
    DisplayComponent: EmailCellDisplay,
    EditComponent: EmailCellEdit,
  });

  registerCellRenderer('phone', {
    DisplayComponent: PhoneCellDisplay,
    EditComponent: PhoneCellEdit,
  });

  registerCellRenderer('smart_doc', {
    DisplayComponent: SmartDocCellDisplay,
    EditComponent: SmartDocCellEdit,
  });

  registerCellRenderer('barcode', {
    DisplayComponent: BarcodeCellDisplay,
    EditComponent: BarcodeCellEdit,
  });

  registerCellRenderer('checklist', {
    DisplayComponent: ChecklistCellDisplay,
    EditComponent: ChecklistCellEdit,
  });
}

export { DEFAULT_COLUMN_WIDTHS };
