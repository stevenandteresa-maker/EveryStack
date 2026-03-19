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

// ---------------------------------------------------------------------------
// Phase 3C — Thread messages (for chat/thread preview)
// ---------------------------------------------------------------------------

import type { ThreadMessage } from '@/components/chat/MessageItem';
import type { JSONContent } from '@tiptap/core';
import type { MentionSuggestion } from '@/components/chat/types';

function makeTextContent(text: string): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function makeMentionContent(before: string, mentionLabel: string, after: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: before },
          {
            type: 'mention',
            attrs: { id: 'user-2', label: mentionLabel },
          },
          { type: 'text', text: after },
        ],
      },
    ],
  };
}

function makeBoldContent(normal: string, bold: string, after: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: normal },
          { type: 'text', text: bold, marks: [{ type: 'bold' }] },
          { type: 'text', text: after },
        ],
      },
    ],
  };
}

const MSG_IDS = {
  m1: '00000000-0000-0000-0003-000000000001',
  m2: '00000000-0000-0000-0003-000000000002',
  m3: '00000000-0000-0000-0003-000000000003',
  m4: '00000000-0000-0000-0003-000000000004',
  m5: '00000000-0000-0000-0003-000000000005',
  m6: '00000000-0000-0000-0003-000000000006',
  m7: '00000000-0000-0000-0003-000000000007',
  m8: '00000000-0000-0000-0003-000000000008',
} as const;

const THREAD_ID = '00000000-0000-0000-0004-000000000001';

export const MOCK_THREAD_MESSAGES: ThreadMessage[] = [
  {
    id: MSG_IDS.m1,
    thread_id: THREAD_ID,
    author_id: 'user-1',
    author_name: 'Sarah Chen',
    content: makeTextContent('Hey team, I just finished reviewing the TechNova proposal. The pricing looks solid but we need to finalize the implementation timeline.'),
    message_type: 'user',
    reactions: { '👍': ['user-2', 'user-3'], '🎯': ['user-4'] },
    is_edited: false,
    is_deleted: false,
    is_pinned: true,
    created_at: '2026-03-16T09:15:00Z',
    updated_at: '2026-03-16T09:15:00Z',
  },
  {
    id: MSG_IDS.m2,
    thread_id: THREAD_ID,
    author_id: 'user-2',
    author_name: 'Marcus Johnson',
    content: makeMentionContent('', 'Sarah Chen', ' agreed — I can have the timeline ready by EOD tomorrow. Want me to loop in the engineering team?'),
    message_type: 'user',
    reactions: {},
    is_edited: false,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-16T09:18:00Z',
    updated_at: '2026-03-16T09:18:00Z',
  },
  {
    id: MSG_IDS.m3,
    thread_id: THREAD_ID,
    author_id: 'user-3',
    author_name: 'Priya Patel',
    content: makeBoldContent('From an engineering perspective, we can start ', 'Phase 1 integration', ' within 2 weeks of contract signing. The API adapters are already built.'),
    message_type: 'user',
    reactions: { '🚀': ['user-1', 'user-2'] },
    is_edited: true,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-16T09:22:00Z',
    updated_at: '2026-03-16T09:25:00Z',
  },
  {
    id: MSG_IDS.m4,
    thread_id: THREAD_ID,
    author_id: 'user-1',
    author_name: 'Sarah Chen',
    content: makeTextContent('Perfect. Let me update the proposal deck with those timelines. Can someone pull the latest sync metrics from the dashboard?'),
    message_type: 'user',
    reactions: {},
    is_edited: false,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-16T09:30:00Z',
    updated_at: '2026-03-16T09:30:00Z',
  },
  {
    id: MSG_IDS.m5,
    thread_id: THREAD_ID,
    author_id: 'system',
    author_name: 'System',
    content: makeTextContent('Priya Patel pinned a message'),
    message_type: 'system',
    reactions: {},
    is_edited: false,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-16T09:31:00Z',
    updated_at: '2026-03-16T09:31:00Z',
  },
  {
    id: MSG_IDS.m6,
    thread_id: THREAD_ID,
    author_id: 'user-4',
    author_name: 'James Wright',
    content: makeTextContent('Sync metrics attached. 99.7% uptime last 30 days, average latency 140ms. Pretty solid numbers for the pitch.'),
    message_type: 'user',
    reactions: { '💯': ['user-1', 'user-2', 'user-3'] },
    is_edited: false,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-16T09:35:00Z',
    updated_at: '2026-03-16T09:35:00Z',
  },
  {
    id: MSG_IDS.m7,
    thread_id: THREAD_ID,
    author_id: 'user-2',
    author_name: 'Marcus Johnson',
    content: makeTextContent('Nice! I\'ll incorporate those into the executive summary. Meeting with their CTO is Thursday at 2pm ET.'),
    message_type: 'user',
    reactions: { '📅': ['user-1'] },
    is_edited: false,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-16T09:40:00Z',
    updated_at: '2026-03-16T09:40:00Z',
  },
  {
    id: MSG_IDS.m8,
    thread_id: THREAD_ID,
    author_id: 'user-1',
    author_name: 'Sarah Chen',
    content: makeTextContent('Great work everyone. Let\'s regroup tomorrow morning to do a final review before the Thursday call. 🙌'),
    message_type: 'user',
    reactions: { '✅': ['user-2', 'user-3', 'user-4'] },
    is_edited: false,
    is_deleted: false,
    is_pinned: false,
    created_at: '2026-03-16T09:45:00Z',
    updated_at: '2026-03-16T09:45:00Z',
  },
];

// ---------------------------------------------------------------------------
// Phase 3C — Notifications
// ---------------------------------------------------------------------------

export interface MockNotification {
  id: string;
  userId: string;
  tenantId: string;
  type: string;
  title: string;
  body: string | null;
  sourceType: string | null;
  sourceThreadId: string | null;
  sourceMessageId: string | null;
  sourceRecordId: string | null;
  actorId: string | null;
  groupKey: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: '00000000-0000-0000-0005-000000000001',
    userId: USER_ID,
    tenantId: TENANT_ID,
    type: 'mention',
    title: 'Sarah Chen mentioned you in TechNova Deal',
    body: '...can someone pull the latest sync metrics from the dashboard?',
    sourceType: 'thread_message',
    sourceThreadId: THREAD_ID,
    sourceMessageId: MSG_IDS.m4,
    sourceRecordId: REC.r1,
    actorId: 'user-1',
    groupKey: `thread:${THREAD_ID}`,
    read: false,
    readAt: null,
    createdAt: new Date('2026-03-16T09:30:00Z'),
  },
  {
    id: '00000000-0000-0000-0005-000000000002',
    userId: USER_ID,
    tenantId: TENANT_ID,
    type: 'thread_reply',
    title: 'Marcus Johnson replied in TechNova Deal',
    body: 'I\'ll incorporate those into the executive summary...',
    sourceType: 'thread_message',
    sourceThreadId: THREAD_ID,
    sourceMessageId: MSG_IDS.m7,
    sourceRecordId: REC.r1,
    actorId: 'user-2',
    groupKey: `thread:${THREAD_ID}`,
    read: false,
    readAt: null,
    createdAt: new Date('2026-03-16T09:40:00Z'),
  },
  {
    id: '00000000-0000-0000-0005-000000000003',
    userId: USER_ID,
    tenantId: TENANT_ID,
    type: 'dm',
    title: 'Priya Patel sent you a message',
    body: 'Hey, quick question about the API rate limits for the TechNova integration...',
    sourceType: 'thread_message',
    sourceThreadId: '00000000-0000-0000-0004-000000000002',
    sourceMessageId: null,
    sourceRecordId: null,
    actorId: 'user-3',
    groupKey: null,
    read: false,
    readAt: null,
    createdAt: new Date('2026-03-16T10:05:00Z'),
  },
  {
    id: '00000000-0000-0000-0005-000000000004',
    userId: USER_ID,
    tenantId: TENANT_ID,
    type: 'sync_error',
    title: 'Sync failed for GreenLeaf Labs workspace',
    body: 'Airtable API rate limit exceeded. Retry scheduled in 5 minutes.',
    sourceType: 'sync',
    sourceThreadId: null,
    sourceMessageId: null,
    sourceRecordId: null,
    actorId: null,
    groupKey: 'sync:greenleaf',
    read: true,
    readAt: new Date('2026-03-16T08:00:00Z'),
    createdAt: new Date('2026-03-16T07:45:00Z'),
  },
  {
    id: '00000000-0000-0000-0005-000000000005',
    userId: USER_ID,
    tenantId: TENANT_ID,
    type: 'system',
    title: 'Welcome to EveryStack',
    body: 'Your workspace is ready. Start by connecting your first platform.',
    sourceType: 'system',
    sourceThreadId: null,
    sourceMessageId: null,
    sourceRecordId: null,
    actorId: null,
    groupKey: null,
    read: true,
    readAt: new Date('2026-03-15T12:00:00Z'),
    createdAt: new Date('2026-03-15T10:00:00Z'),
  },
];

// ---------------------------------------------------------------------------
// Phase 3C — Mention suggestions (for ChatEditor)
// ---------------------------------------------------------------------------

export const MOCK_MENTION_SUGGESTIONS: MentionSuggestion[] = [
  { id: 'user-1', label: 'Sarah Chen', role: 'Owner' },
  { id: 'user-2', label: 'Marcus Johnson', role: 'Admin' },
  { id: 'user-3', label: 'Priya Patel', role: 'Manager' },
  { id: 'user-4', label: 'James Wright', role: 'Member' },
  { id: 'user-5', label: 'Yuki Tanaka', role: 'Member' },
];

export const CURRENT_USER_ID = 'user-4';

export { FLD, REC, TABLE_ID, TENANT_ID };
