/**
 * Document Templates List — Route Page
 *
 * Server Component that loads all document templates for the tenant
 * and renders a grid of TemplateCards with a "New Template" button.
 *
 * Route: /[workspaceId]/documents
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth-context';
import { listAllDocumentTemplates } from '@/data/document-templates';
import { DocumentTemplateListPage } from '@/components/documents/DocumentTemplateListPage';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DocumentsPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Suspense fallback={<DocumentTemplateListSkeleton />}>
        <DocumentTemplateListLoader workspaceId={workspaceId} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data loader (Server Component)
// ---------------------------------------------------------------------------

async function DocumentTemplateListLoader({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { tenantId } = await getAuthContext();
  const templates = await listAllDocumentTemplates(tenantId);

  return (
    <DocumentTemplateListPage
      templates={templates}
      workspaceId={workspaceId}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DocumentTemplateListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
