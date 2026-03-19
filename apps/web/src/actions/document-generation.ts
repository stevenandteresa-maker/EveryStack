'use server';

/**
 * Server Actions — Document generation (resolve, render, enqueue PDF jobs).
 *
 * - generateDocument: Validates input, verifies template, resolves merge tags,
 *   renders to HTML with print CSS, enqueues a BullMQ job, returns job ID.
 * - getDocumentGenerationStatus: Returns the status of a generation job.
 *
 * Resolution and rendering happen here (server action) because they depend
 * on web-app data access functions. The worker processor receives the
 * pre-rendered HTML and handles Gotenberg conversion + R2 upload.
 *
 * @see docs/reference/smart-docs.md § Generation Flow
 */

import { z } from 'zod';
import type { JSONContent } from '@tiptap/core';
import { getAuthContext } from '@/lib/auth-context';
import { getQueue } from '@/lib/queue';
import { getDocumentTemplate } from '@/data/document-templates';
import { resolveMergeTags } from '@/lib/editor/merge-resolver';
import { renderToHTML } from '@/lib/editor/pdf-renderer';
import type { DocumentTemplateSettings } from '@/lib/editor/pdf-renderer';
import { getTraceId, generateTraceId } from '@everystack/shared/logging';
import { NotFoundError, wrapUnknownError } from '@/lib/errors';
import type { Job } from 'bullmq';
import type { DocumentGenJobData } from '@everystack/shared/queue';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const generateDocumentSchema = z.object({
  templateId: z.string().uuid(),
  recordId: z.string().uuid(),
});

const getDocumentGenerationStatusSchema = z.object({
  jobId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// enqueueDocumentGeneration
// ---------------------------------------------------------------------------

export interface EnqueueDocumentGenerationInput {
  tenantId: string;
  templateId: string;
  recordId: string;
  triggeredBy: string;
  html: string;
  landscape: boolean;
}

export interface GenerateDocumentResult {
  jobId: string;
}

/**
 * Enqueue a document generation BullMQ job.
 *
 * Standalone helper — used by the `generateDocument` server action and
 * callable from automations or other server-side code that has already
 * resolved merge tags and rendered HTML.
 */
export async function enqueueDocumentGeneration(
  input: EnqueueDocumentGenerationInput,
): Promise<GenerateDocumentResult> {
  const queue = getQueue('document-gen');
  const traceId = getTraceId() ?? generateTraceId();

  const job = await queue.add(
    'document.generate',
    {
      tenantId: input.tenantId,
      templateId: input.templateId,
      recordId: input.recordId,
      traceId,
      triggeredBy: input.triggeredBy,
      html: input.html,
      landscape: input.landscape,
    } satisfies DocumentGenJobData,
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
      removeOnComplete: { age: 24 * 60 * 60 }, // Keep completed jobs for 24h
      removeOnFail: { age: 7 * 24 * 60 * 60 }, // Keep failed jobs for 7d
    },
  );

  return { jobId: job.id! };
}

// ---------------------------------------------------------------------------
// generateDocument
// ---------------------------------------------------------------------------

/**
 * Server action: validate, verify template, resolve, render, enqueue.
 *
 * 1. Validates that the template exists and belongs to the tenant
 * 2. Resolves merge tags against the source record
 * 3. Renders the resolved TipTap content to a full HTML document
 * 4. Enqueues a BullMQ job with the HTML for Gotenberg conversion
 */
export async function generateDocument(
  input: z.input<typeof generateDocumentSchema>,
): Promise<GenerateDocumentResult> {
  const { userId, tenantId } = await getAuthContext();
  const validated = generateDocumentSchema.parse(input);

  try {
    // Verify template exists and belongs to this tenant
    const template = await getDocumentTemplate(tenantId, validated.templateId);
    if (!template) {
      throw new NotFoundError('Document template not found');
    }

    const content = template.content as unknown as JSONContent;
    const settings = template.settings as unknown as DocumentTemplateSettings;

    // Resolve merge tags → field values from source record + cross-links
    const resolvedContent = await resolveMergeTags(
      content,
      validated.recordId,
      tenantId,
    );

    // Render to full HTML with print CSS
    const html = renderToHTML(resolvedContent, settings);

    return enqueueDocumentGeneration({
      tenantId,
      templateId: validated.templateId,
      recordId: validated.recordId,
      triggeredBy: userId,
      html,
      landscape: settings.orientation === 'landscape',
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// getDocumentGenerationStatus
// ---------------------------------------------------------------------------

export interface DocumentGenerationStatus {
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
  result?: { docId?: string };
  error?: string;
}

/**
 * Check the status of a document generation job.
 */
export async function getDocumentGenerationStatus(
  input: z.input<typeof getDocumentGenerationStatusSchema>,
): Promise<DocumentGenerationStatus> {
  const { tenantId } = await getAuthContext();
  const validated = getDocumentGenerationStatusSchema.parse(input);

  try {
    const queue = getQueue('document-gen');
    const job = await queue.getJob(validated.jobId) as Job<DocumentGenJobData> | undefined;

    if (!job) {
      return { status: 'unknown' };
    }

    // Verify tenant ownership — don't leak job status across tenants
    if (job.data.tenantId !== tenantId) {
      return { status: 'unknown' };
    }

    const state = await job.getState();

    switch (state) {
      case 'completed':
        return {
          status: 'completed',
          result: job.returnvalue as { docId?: string } | undefined,
        };
      case 'failed': {
        const reason = job.failedReason ?? 'Unknown error';
        return { status: 'failed', error: reason };
      }
      case 'active':
        return { status: 'active' };
      case 'waiting':
      case 'delayed':
      case 'prioritized':
      case 'waiting-children':
        return { status: 'waiting' };
      default:
        return { status: 'unknown' };
    }
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
