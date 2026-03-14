/**
 * SchemaDescriptorService — facade for workspace schema descriptor operations.
 *
 * Provides three read-only methods that compose the lower-level SDS building
 * blocks (cache, builders, permission filter) into a clean API surface:
 *
 * - describeWorkspace() — full workspace schema, permission-filtered per user
 * - describeTable() — single table descriptor, null if inaccessible
 * - describeLinks() — link graph only (lightweight)
 *
 * @see docs/reference/schema-descriptor-service.md § API Surface
 */

import type { DrizzleClient } from '../../db/client';
import type { WorkspaceDescriptor, TableDescriptor, LinkEdge } from './types';
import type { SchemaDescriptorCache } from './cache';
import { buildTableDescriptor } from './table-builder';
import { filterDescriptorByPermissions } from './permission-filter';

/**
 * Read-only facade for the Schema Descriptor Service.
 *
 * Consumed as a library within the app — no HTTP endpoints needed.
 * All methods are permission-filtered: the AI never discovers data the user
 * cannot access.
 */
export class SchemaDescriptorService {
  private readonly cache: SchemaDescriptorCache;
  private readonly db: DrizzleClient;

  constructor(cache: SchemaDescriptorCache, db: DrizzleClient) {
    this.cache = cache;
    this.db = db;
  }

  /**
   * Returns the full permission-filtered workspace schema descriptor.
   *
   * Leverages the 2-tier cache: Tier 2 (per-user) → Tier 1 (unfiltered) →
   * build from DB. Cache misses are transparently handled by SchemaDescriptorCache.
   */
  async describeWorkspace(
    workspaceId: string,
    userId: string,
    tenantId: string,
  ): Promise<WorkspaceDescriptor> {
    const descriptor = await this.cache.getWorkspaceDescriptor(
      workspaceId,
      userId,
      tenantId,
      this.db,
    );

    // Cache returns null only on catastrophic failure; return empty descriptor
    return descriptor ?? { workspace_id: workspaceId, bases: [], link_graph: [] };
  }

  /**
   * Returns a permission-filtered descriptor for a single table, or null
   * if the user has no access to the table.
   *
   * Builds the table descriptor directly, then filters using the workspace-level
   * permission resolution to determine table/field visibility.
   */
  async describeTable(
    tableId: string,
    userId: string,
    tenantId: string,
  ): Promise<TableDescriptor | null> {
    // Build the raw table descriptor
    let rawTable: TableDescriptor;
    try {
      rawTable = await buildTableDescriptor(tableId, tenantId, this.db);
    } catch {
      // Table not found for tenant → null
      return null;
    }

    // Wrap in a minimal WorkspaceDescriptor for permission filtering
    const syntheticDescriptor: WorkspaceDescriptor = {
      workspace_id: '', // Will be resolved by filterDescriptorByPermissions via the table's workspace
      bases: [
        {
          base_id: 'single-table-lookup',
          name: '',
          platform: '',
          tables: [rawTable],
        },
      ],
      link_graph: [],
    };

    // We need to resolve the workspace ID for this table to filter permissions
    const filtered = await filterDescriptorByPermissions(
      syntheticDescriptor,
      userId,
      tenantId,
      this.db,
    );

    // If the table survived filtering, return it
    for (const base of filtered.bases) {
      for (const table of base.tables) {
        if (table.table_id === tableId) {
          return table;
        }
      }
    }

    // Table was filtered out — user has no access
    return null;
  }

  /**
   * Returns only the permission-filtered cross-link graph for a workspace.
   *
   * Leverages the workspace descriptor cache — the link_graph is extracted
   * from the cached (or freshly built) workspace descriptor.
   */
  async describeLinks(
    workspaceId: string,
    userId: string,
    tenantId: string,
  ): Promise<LinkEdge[]> {
    const descriptor = await this.describeWorkspace(workspaceId, userId, tenantId);
    return descriptor.link_graph;
  }
}
