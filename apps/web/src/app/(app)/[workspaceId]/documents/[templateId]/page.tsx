/**
 * Document Template Editor — Route Page
 *
 * Server Component that loads a template and renders the
 * DocumentTemplateEditor with editable name, table badge, back button.
 *
 * Route: /[workspaceId]/documents/[templateId]
 *
 * @see docs/reference/smart-docs.md § Template Authoring Mode
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/auth-context';
import { getDocumentTemplate } from '@/data/document-templates';
import { getTableById } from '@/data/tables';
import { DocumentTemplateEditorPage } from '@/components/documents/DocumentTemplateEditorPage';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateEditorPageProps {
  params: Promise<{
    workspaceId: string;
    templateId: string;
  }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TemplateEditorPage({
  params,
}: TemplateEditorPageProps) {
  const { workspaceId, templateId } = await params;

  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<EditorSkeleton />}>
        <TemplateEditorLoader
          workspaceId={workspaceId}
          templateId={templateId}
        />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data loader (Server Component)
// ---------------------------------------------------------------------------

async function TemplateEditorLoader({
  workspaceId,
  templateId,
}: {
  workspaceId: string;
  templateId: string;
}) {
  const { tenantId, userId } = await getAuthContext();

  const template = await getDocumentTemplate(tenantId, templateId);
  if (!template) {
    notFound();
  }

  const table = await getTableById(tenantId, template.tableId);

  return (
    <DocumentTemplateEditorPage
      template={template}
      tableName={table.name}
      tenantId={tenantId}
      userId={userId}
      workspaceId={workspaceId}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="ml-auto h-6 w-20" />
      </div>
      {/* Editor area */}
      <div className="flex flex-1">
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
        <div className="w-[280px] border-l border-border p-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-3 h-8 w-full" />
          <Skeleton className="mt-2 h-6 w-full" />
          <Skeleton className="mt-1 h-6 w-full" />
          <Skeleton className="mt-1 h-6 w-full" />
        </div>
      </div>
    </div>
  );
}
