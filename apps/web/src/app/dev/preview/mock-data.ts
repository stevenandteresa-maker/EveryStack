/**
 * Static mock data for the dev preview route.
 *
 * Uses deterministic UUIDs and realistic field types to verify
 * DataGrid, CardView, and RecordView rendering without a database.
 */

import type { GridField, GridRecord, ViewConfig } from '@/lib/types/grid';
import type { RecordViewLayout } from '@/data/record-view-configs';

// ---------------------------------------------------------------------------
// Deterministic IDs
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TABLE_ID = '00000000-0000-0000-0000-000000000010';
const USER_ID = '00000000-0000-0000-0000-000000000099';

// Field IDs
const FLD = {
  name: '00000000-0000-0000-0001-000000000001',
  company: '00000000-0000-0000-0001-000000000002',
  email: '00000000-0000-0000-0001-000000000003',
  amount: '00000000-0000-0000-0001-000000000004',
  status: '00000000-0000-0000-0001-000000000005',
  priority: '00000000-0000-0000-0001-000000000006',
  dueDate: '00000000-0000-0000-0001-000000000007',
  tags: '00000000-0000-0000-0001-000000000008',
  active: '00000000-0000-0000-0001-000000000009',
  phone: '00000000-0000-0000-0001-000000000010',
  notes: '00000000-0000-0000-0001-000000000011',
  rating: '00000000-0000-0000-0001-000000000012',
} as const;

// Record IDs
const REC = {
  r1: '00000000-0000-0000-0002-000000000001',
  r2: '00000000-0000-0000-0002-000000000002',
  r3: '00000000-0000-0000-0002-000000000003',
  r4: '00000000-0000-0000-0002-000000000004',
  r5: '00000000-0000-0000-0002-000000000005',
  r6: '00000000-0000-0000-0002-000000000006',
  r7: '00000000-0000-0000-0002-000000000007',
  r8: '00000000-0000-0000-0002-000000000008',
  r9: '00000000-0000-0000-0002-000000000009',
  r10: '00000000-0000-0000-0002-000000000010',
  r11: '00000000-0000-0000-0002-000000000011',
  r12: '00000000-0000-0000-0002-000000000012',
} as const;

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

const now = new Date('2026-03-10T00:00:00Z');

function makeField(
  overrides: Partial<GridField> & { id: string; name: string; fieldType: string },
): GridField {
  return {
    tenantId: TENANT_ID,
    tableId: TABLE_ID,
    isPrimary: false,
    isSystem: false,
    required: false,
    unique: false,
    readOnly: false,
    config: {},
    display: {},
    permissions: {},
    defaultValue: null,
    description: null,
    sortOrder: 0,
    externalFieldId: null,
    fieldSubType: null,
    environment: 'live',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export const MOCK_FIELDS: GridField[] = [
  makeField({ id: FLD.name, name: 'Name', fieldType: 'text', isPrimary: true, sortOrder: 0 }),
  makeField({ id: FLD.company, name: 'Company', fieldType: 'text', sortOrder: 1 }),
  makeField({ id: FLD.email, name: 'Email', fieldType: 'email', sortOrder: 2 }),
  makeField({ id: FLD.amount, name: 'Deal Value', fieldType: 'currency', sortOrder: 3, config: { currency: 'USD', precision: 0 } }),
  makeField({
    id: FLD.status,
    name: 'Status',
    fieldType: 'single_select',
    sortOrder: 4,
    config: {
      options: [
        { id: 'opt_lead', name: 'Lead', color: 'blue' },
        { id: 'opt_qualified', name: 'Qualified', color: 'amber' },
        { id: 'opt_proposal', name: 'Proposal', color: 'purple' },
        { id: 'opt_closed_won', name: 'Closed Won', color: 'green' },
        { id: 'opt_closed_lost', name: 'Closed Lost', color: 'red' },
      ],
    },
  }),
  makeField({
    id: FLD.priority,
    name: 'Priority',
    fieldType: 'single_select',
    sortOrder: 5,
    config: {
      options: [
        { id: 'opt_high', name: 'High', color: 'red' },
        { id: 'opt_medium', name: 'Medium', color: 'amber' },
        { id: 'opt_low', name: 'Low', color: 'green' },
      ],
    },
  }),
  makeField({ id: FLD.dueDate, name: 'Close Date', fieldType: 'date', sortOrder: 6 }),
  makeField({
    id: FLD.tags,
    name: 'Tags',
    fieldType: 'multi_select',
    sortOrder: 7,
    config: {
      options: [
        { id: 'tag_enterprise', name: 'Enterprise', color: 'indigo' },
        { id: 'tag_smb', name: 'SMB', color: 'teal' },
        { id: 'tag_renewal', name: 'Renewal', color: 'orange' },
        { id: 'tag_upsell', name: 'Upsell', color: 'pink' },
        { id: 'tag_new', name: 'New Business', color: 'cyan' },
      ],
    },
  }),
  makeField({ id: FLD.active, name: 'Active', fieldType: 'checkbox', sortOrder: 8 }),
  makeField({ id: FLD.phone, name: 'Phone', fieldType: 'phone', sortOrder: 9 }),
  makeField({ id: FLD.notes, name: 'Notes', fieldType: 'textarea', sortOrder: 10 }),
  makeField({ id: FLD.rating, name: 'Rating', fieldType: 'rating', sortOrder: 11 }),
];

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

function makeRecord(
  id: string,
  canonicalData: Record<string, unknown>,
): GridRecord {
  return {
    tenantId: TENANT_ID,
    id,
    tableId: TABLE_ID,
    canonicalData,
    syncMetadata: null,
    searchVector: null,
    archivedAt: null,
    createdBy: USER_ID,
    updatedBy: USER_ID,
    createdAt: now,
    updatedAt: now,
  };
}

export const MOCK_RECORDS: GridRecord[] = [
  makeRecord(REC.r1, {
    [FLD.name]: 'Sarah Chen',
    [FLD.company]: 'TechNova Inc.',
    [FLD.email]: 'sarah@technova.io',
    [FLD.amount]: 85000,
    [FLD.status]: 'opt_qualified',
    [FLD.priority]: 'opt_high',
    [FLD.dueDate]: '2026-04-15',
    [FLD.tags]: ['tag_enterprise', 'tag_new'],
    [FLD.active]: true,
    [FLD.phone]: '+1 (415) 555-0101',
    [FLD.notes]: 'Key decision maker. Follow up after Q2 budget review.',
    [FLD.rating]: 5,
  }),
  makeRecord(REC.r2, {
    [FLD.name]: 'Marcus Johnson',
    [FLD.company]: 'GreenLeaf Labs',
    [FLD.email]: 'marcus@greenleaf.co',
    [FLD.amount]: 42000,
    [FLD.status]: 'opt_proposal',
    [FLD.priority]: 'opt_medium',
    [FLD.dueDate]: '2026-03-28',
    [FLD.tags]: ['tag_smb', 'tag_renewal'],
    [FLD.active]: true,
    [FLD.phone]: '+1 (212) 555-0202',
    [FLD.notes]: 'Renewal with potential upsell to Pro tier.',
    [FLD.rating]: 4,
  }),
  makeRecord(REC.r3, {
    [FLD.name]: 'Priya Patel',
    [FLD.company]: 'DataStream Analytics',
    [FLD.email]: 'priya@datastream.com',
    [FLD.amount]: 120000,
    [FLD.status]: 'opt_closed_won',
    [FLD.priority]: 'opt_high',
    [FLD.dueDate]: '2026-02-10',
    [FLD.tags]: ['tag_enterprise'],
    [FLD.active]: false,
    [FLD.phone]: '+1 (650) 555-0303',
    [FLD.notes]: 'Signed 3-year contract. Implementation kickoff scheduled.',
    [FLD.rating]: 5,
  }),
  makeRecord(REC.r4, {
    [FLD.name]: 'James Wright',
    [FLD.company]: 'Apex Consulting',
    [FLD.email]: 'james@apexconsulting.com',
    [FLD.amount]: 18500,
    [FLD.status]: 'opt_lead',
    [FLD.priority]: 'opt_low',
    [FLD.dueDate]: '2026-05-01',
    [FLD.tags]: ['tag_smb', 'tag_new'],
    [FLD.active]: true,
    [FLD.phone]: '+1 (312) 555-0404',
    [FLD.notes]: 'Initial call completed. Needs feature comparison doc.',
    [FLD.rating]: 3,
  }),
  makeRecord(REC.r5, {
    [FLD.name]: 'Yuki Tanaka',
    [FLD.company]: 'NexGen Robotics',
    [FLD.email]: 'yuki@nexgenrobot.jp',
    [FLD.amount]: 250000,
    [FLD.status]: 'opt_qualified',
    [FLD.priority]: 'opt_high',
    [FLD.dueDate]: '2026-06-30',
    [FLD.tags]: ['tag_enterprise', 'tag_new'],
    [FLD.active]: true,
    [FLD.phone]: '+81 3-5555-0505',
    [FLD.notes]: 'Global deployment. Need multi-region support discussion.',
    [FLD.rating]: 4,
  }),
  makeRecord(REC.r6, {
    [FLD.name]: 'Elena Rodriguez',
    [FLD.company]: 'BrightPath Education',
    [FLD.email]: 'elena@brightpath.edu',
    [FLD.amount]: 32000,
    [FLD.status]: 'opt_proposal',
    [FLD.priority]: 'opt_medium',
    [FLD.dueDate]: '2026-04-20',
    [FLD.tags]: ['tag_smb'],
    [FLD.active]: true,
    [FLD.phone]: '+1 (617) 555-0606',
    [FLD.notes]: 'Education discount approved. Awaiting board approval.',
    [FLD.rating]: 4,
  }),
  makeRecord(REC.r7, {
    [FLD.name]: 'David Kim',
    [FLD.company]: 'QuantumByte',
    [FLD.email]: 'david@quantumbyte.io',
    [FLD.amount]: 67000,
    [FLD.status]: 'opt_closed_lost',
    [FLD.priority]: 'opt_medium',
    [FLD.dueDate]: '2026-01-15',
    [FLD.tags]: ['tag_enterprise'],
    [FLD.active]: false,
    [FLD.phone]: '+1 (408) 555-0707',
    [FLD.notes]: 'Lost to competitor. Budget constraints cited.',
    [FLD.rating]: 2,
  }),
  makeRecord(REC.r8, {
    [FLD.name]: 'Aisha Mohammed',
    [FLD.company]: 'CloudFirst Solutions',
    [FLD.email]: 'aisha@cloudfirst.io',
    [FLD.amount]: 95000,
    [FLD.status]: 'opt_qualified',
    [FLD.priority]: 'opt_high',
    [FLD.dueDate]: '2026-05-15',
    [FLD.tags]: ['tag_enterprise', 'tag_upsell'],
    [FLD.active]: true,
    [FLD.phone]: '+44 20 5555 0808',
    [FLD.notes]: 'Expanding from 3 to 12 seats. Security review in progress.',
    [FLD.rating]: 5,
  }),
  makeRecord(REC.r9, {
    [FLD.name]: 'Tom Bradley',
    [FLD.company]: 'Summit Financial',
    [FLD.email]: 'tom@summitfin.com',
    [FLD.amount]: 28000,
    [FLD.status]: 'opt_lead',
    [FLD.priority]: 'opt_low',
    [FLD.dueDate]: '2026-07-01',
    [FLD.tags]: ['tag_smb', 'tag_new'],
    [FLD.active]: true,
    [FLD.phone]: '+1 (305) 555-0909',
    [FLD.notes]: 'Referred by David Kim. Scheduling demo.',
    [FLD.rating]: 3,
  }),
  makeRecord(REC.r10, {
    [FLD.name]: 'Lisa Chang',
    [FLD.company]: 'VeloCity Logistics',
    [FLD.email]: 'lisa@velocity-log.com',
    [FLD.amount]: 156000,
    [FLD.status]: 'opt_proposal',
    [FLD.priority]: 'opt_high',
    [FLD.dueDate]: '2026-04-10',
    [FLD.tags]: ['tag_enterprise', 'tag_renewal'],
    [FLD.active]: true,
    [FLD.phone]: '+1 (213) 555-1010',
    [FLD.notes]: 'Contract renewal + API tier upgrade. Procurement review stage.',
    [FLD.rating]: 4,
  }),
  makeRecord(REC.r11, {
    [FLD.name]: 'Robert Okonkwo',
    [FLD.company]: 'AfriTech Hub',
    [FLD.email]: 'robert@afritech.ng',
    [FLD.amount]: 45000,
    [FLD.status]: 'opt_qualified',
    [FLD.priority]: 'opt_medium',
    [FLD.dueDate]: '2026-05-30',
    [FLD.tags]: ['tag_smb', 'tag_new'],
    [FLD.active]: true,
    [FLD.phone]: '+234 1 555 1111',
    [FLD.notes]: 'Strong fit. Need pricing for emerging market tier.',
    [FLD.rating]: 4,
  }),
  makeRecord(REC.r12, {
    [FLD.name]: 'Anna Kowalski',
    [FLD.company]: 'EuroHealth GmbH',
    [FLD.email]: 'anna@eurohealth.de',
    [FLD.amount]: 73000,
    [FLD.status]: 'opt_lead',
    [FLD.priority]: 'opt_medium',
    [FLD.dueDate]: '2026-06-15',
    [FLD.tags]: ['tag_enterprise', 'tag_new'],
    [FLD.active]: true,
    [FLD.phone]: '+49 30 5555 1212',
    [FLD.notes]: 'GDPR requirements discussion needed. Legal review pending.',
    [FLD.rating]: 3,
  }),
];

// ---------------------------------------------------------------------------
// View config
// ---------------------------------------------------------------------------

export const MOCK_VIEW_CONFIG: ViewConfig = {
  density: 'medium',
  frozenColumns: 1,
  columnOrder: Object.values(FLD),
  hidden_fields: [],
  sorts: [],
  card_layout: 'grid',
  card_columns: 3,
  field_config: [FLD.name, FLD.company, FLD.status, FLD.amount, FLD.priority],
};

// ---------------------------------------------------------------------------
// Record View layout
// ---------------------------------------------------------------------------

export const MOCK_RECORD_VIEW_LAYOUT: RecordViewLayout = {
  columns: 2,
  fields: [
    { fieldId: FLD.name, columnSpan: 2, height: 'auto', tab: null },
    { fieldId: FLD.company, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.email, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.amount, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.status, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.priority, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.dueDate, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.tags, columnSpan: 2, height: 'auto', tab: null },
    { fieldId: FLD.active, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.phone, columnSpan: 1, height: 'auto', tab: null },
    { fieldId: FLD.notes, columnSpan: 2, height: 'expanded', tab: null },
    { fieldId: FLD.rating, columnSpan: 1, height: 'auto', tab: null },
  ],
  tabs: [],
};

export { FLD, REC, TABLE_ID, TENANT_ID };
