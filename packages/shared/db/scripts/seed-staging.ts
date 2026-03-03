/**
 * Staging Database Seed Script
 *
 * Generates production-scale synthetic data for staging environments.
 * Used for performance testing, migration validation, and load testing.
 *
 * Volume targets:
 *   - 500 tenants
 *   - ~5M records
 *   - ~10K fields
 *   - ~500K cross-link index rows
 *
 * Run: pnpm turbo db:seed-staging
 */

import { createLogger } from '../../logging';

const logger = createLogger({ service: 'seed-staging' });

// ---------------------------------------------------------------------------
// Tier configuration — 4 tiers matching production distribution
// ---------------------------------------------------------------------------

interface TenantTier {
  label: string;
  count: number;
  recordsPerTenant: number;
  tablesPerWorkspace: number;
  fieldsPerTable: number;
}

const TENANT_TIERS: TenantTier[] = [
  { label: 'small', count: 300, recordsPerTenant: 100, tablesPerWorkspace: 5, fieldsPerTable: 15 },
  { label: 'medium', count: 150, recordsPerTenant: 5_000, tablesPerWorkspace: 5, fieldsPerTable: 15 },
  { label: 'large', count: 40, recordsPerTenant: 50_000, tablesPerWorkspace: 5, fieldsPerTable: 15 },
  { label: 'enterprise', count: 10, recordsPerTenant: 200_000, tablesPerWorkspace: 5, fieldsPerTable: 15 },
];

// ---------------------------------------------------------------------------
// Stub functions — populated incrementally as features are built
// ---------------------------------------------------------------------------

async function createStagingTenant(_tierLabel: string): Promise<{ id: string }> {
  // TODO: Insert into tenants table with realistic name, plan based on tier
  throw new Error('Not implemented — populate when tenant creation is feature-complete');
}

async function createStagingWorkspace(_tenantId: string): Promise<{ id: string }> {
  // TODO: Insert into workspaces table with realistic name, slug
  throw new Error('Not implemented — populate when workspace creation is feature-complete');
}

async function createStagingTables(
  _tenantId: string,
  _workspaceId: string,
  _count: number,
): Promise<Array<{ id: string }>> {
  // TODO: Insert tables with varied table_type values
  throw new Error('Not implemented — populate when table creation is feature-complete');
}

async function createStagingFields(
  _tenantId: string,
  _tableId: string,
  _count: number,
): Promise<Array<{ id: string; fieldType: string }>> {
  // TODO: Insert fields with varied field_type (text, number, select, date, checkbox, etc.)
  // Use FieldTypeRegistry for valid field types
  throw new Error('Not implemented — populate when field creation is feature-complete');
}

async function createStagingRecords(
  _tenantId: string,
  _tableId: string,
  _fields: Array<{ id: string; fieldType: string }>,
  _count: number,
): Promise<void> {
  // TODO: Batch insert records with realistic canonical_data JSONB
  // Use batch sizes of 1000 to avoid memory pressure
  throw new Error('Not implemented — populate when record creation is feature-complete');
}

async function createStagingCrossLinks(
  _tenantId: string,
  _tables: Array<{ id: string }>,
  _linkCount: number,
): Promise<void> {
  // TODO: Create cross_links between tables, then populate cross_link_index
  // Target: 10% of records linked across tables
  throw new Error('Not implemented — populate when cross-link creation is feature-complete');
}

async function rebuildAllSearchVectors(): Promise<void> {
  // TODO: Rebuild tsvector search_vector column for all seeded records
  throw new Error('Not implemented — populate when search indexing is feature-complete');
}

// ---------------------------------------------------------------------------
// Main seed orchestrator
// ---------------------------------------------------------------------------

async function seedStaging(): Promise<void> {
  logger.info('Starting staging seed...');

  const totalStart = Date.now();
  let totalTenants = 0;
  let totalRecords = 0;

  for (const tier of TENANT_TIERS) {
    logger.info({ tier: tier.label, count: tier.count, recordsPerTenant: tier.recordsPerTenant },
      `Seeding ${tier.count} ${tier.label} tenants...`);

    for (let i = 0; i < tier.count; i++) {
      const tenant = await createStagingTenant(tier.label);
      const workspace = await createStagingWorkspace(tenant.id);
      const tables = await createStagingTables(tenant.id, workspace.id, tier.tablesPerWorkspace);

      for (const table of tables) {
        const fields = await createStagingFields(tenant.id, table.id, tier.fieldsPerTable);
        const recordsPerTable = Math.floor(tier.recordsPerTenant / tables.length);
        await createStagingRecords(tenant.id, table.id, fields, recordsPerTable);
      }

      // Cross-links between tables (10% of records linked)
      const linkCount = Math.floor(tier.recordsPerTenant * 0.1);
      await createStagingCrossLinks(tenant.id, tables, linkCount);

      totalTenants++;
      totalRecords += tier.recordsPerTenant;

      if (totalTenants % 50 === 0) {
        logger.info({ totalTenants, totalRecords }, 'Progress checkpoint');
      }
    }
  }

  // Build search vectors
  await rebuildAllSearchVectors();

  const elapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  logger.info({ totalTenants, totalRecords, elapsedSeconds: elapsed },
    'Staging seed complete');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

seedStaging().catch((err: unknown) => {
  logger.error({ err }, 'Staging seed failed');
  process.exitCode = 1;
});
