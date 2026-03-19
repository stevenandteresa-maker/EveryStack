/**
 * New Document Template Wizard — Route Page
 *
 * Server Component that loads workspace tables and renders the
 * NewDocumentTemplateWizard (Wizard Create: name → select table → create).
 *
 * Route: /[workspaceId]/documents/new
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth-context';
import { getTablesByWorkspace } from '@/data/tables';
import { NewDocumentTemplateWizard } from '@/components/documents/NewDocumentTemplateWizard';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewDocumentTemplatePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function NewDocumentTemplatePage({
  params,
}: NewDocumentTemplatePageProps) {
  const { workspaceId } = await params;

  return (
    <div className="mx-auto max-w-lg p-6 pt-16">
      <Suspense fallback={<WizardSkeleton />}>
        <WizardLoader workspaceId={workspaceId} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data loader (Server Component)
// ---------------------------------------------------------------------------

async function WizardLoader({ workspaceId }: { workspaceId: string }) {
  const { tenantId } = await getAuthContext();
  const tables = await getTablesByWorkspace(tenantId, workspaceId);

  return (
    <NewDocumentTemplateWizard
      tables={tables}
      workspaceId={workspaceId}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function WizardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
