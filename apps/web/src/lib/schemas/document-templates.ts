import { z } from 'zod';

// ---------------------------------------------------------------------------
// Default TipTap empty document
// ---------------------------------------------------------------------------

const EMPTY_TIPTAP_DOC = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
} as const;

// ---------------------------------------------------------------------------
// Default template settings (A4, portrait, 20mm margins)
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATE_SETTINGS = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
} as const;

// ---------------------------------------------------------------------------
// Template settings schema
// ---------------------------------------------------------------------------

const templateSettingsSchema = z.object({
  pageSize: z.string().default('A4'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  margins: z.object({
    top: z.number().nonnegative().default(20),
    right: z.number().nonnegative().default(20),
    bottom: z.number().nonnegative().default(20),
    left: z.number().nonnegative().default(20),
  }).default({ top: 20, right: 20, bottom: 20, left: 20 }),
}).default(DEFAULT_TEMPLATE_SETTINGS);

// ---------------------------------------------------------------------------
// createDocumentTemplateSchema
// ---------------------------------------------------------------------------

export const createDocumentTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  tableId: z.string().uuid(),
  content: z.record(z.string(), z.unknown()).default(EMPTY_TIPTAP_DOC as unknown as Record<string, unknown>),
  settings: templateSettingsSchema,
});

// ---------------------------------------------------------------------------
// updateDocumentTemplateSchema
// ---------------------------------------------------------------------------

const updateDocumentTemplateBase = z.object({
  templateId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  settings: z.object({
    pageSize: z.string().optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    margins: z.object({
      top: z.number().nonnegative().optional(),
      right: z.number().nonnegative().optional(),
      bottom: z.number().nonnegative().optional(),
      left: z.number().nonnegative().optional(),
    }).optional(),
  }).optional(),
});

export const updateDocumentTemplateSchema = updateDocumentTemplateBase.refine(
  (data) => data.name !== undefined || data.content !== undefined || data.settings !== undefined,
  { message: 'At least one of name, content, or settings must be provided' },
);

// ---------------------------------------------------------------------------
// Shared action schemas
// ---------------------------------------------------------------------------

export const duplicateDocumentTemplateSchema = z.object({
  templateId: z.string().uuid(),
});

export const deleteDocumentTemplateSchema = z.object({
  templateId: z.string().uuid(),
});
