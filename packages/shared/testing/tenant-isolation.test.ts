import { describe, it, expect, vi } from 'vitest';
import { testTenantIsolation } from './tenant-isolation';

// Mock the factory to avoid needing a real database
vi.mock('./factories', () => {
  let callCount = 0;
  return {
    createTestTenant: vi.fn(() => {
      callCount++;
      return Promise.resolve({
        id: `tenant-${callCount}`,
        name: `Test Tenant ${callCount}`,
        plan: 'professional',
      });
    }),
  };
});

describe('testTenantIsolation', { timeout: 10_000 }, () => {
  it('passes when query properly isolates by tenant', async () => {
    const dataStore = new Map<string, string[]>();

    await testTenantIsolation({
      setup: async (tenantId) => {
        dataStore.set(tenantId, ['record-1', 'record-2']);
      },
      query: async (tenantId) => {
        return dataStore.get(tenantId) ?? [];
      },
    });
  });

  it('fails when query leaks data across tenants', async () => {
    const leakyStore: string[] = [];

    await expect(
      testTenantIsolation({
        setup: async () => {
          leakyStore.push('leaked-record');
        },
        query: async () => {
          // Always returns all data regardless of tenantId — isolation failure
          return leakyStore;
        },
      }),
    ).rejects.toThrow();
  });

  it('fails when own tenant query returns empty', async () => {
    await expect(
      testTenantIsolation({
        setup: async () => {
          // Data is set up but query never finds it
        },
        query: async () => {
          return [];
        },
      }),
    ).rejects.toThrow();
  });

  it('calls setup and query with different tenant IDs', async () => {
    const setupCalls: string[] = [];
    const queryCalls: string[] = [];

    const dataStore = new Map<string, string[]>();

    await testTenantIsolation({
      setup: async (tenantId) => {
        setupCalls.push(tenantId);
        dataStore.set(tenantId, ['data']);
      },
      query: async (tenantId) => {
        queryCalls.push(tenantId);
        return dataStore.get(tenantId) ?? [];
      },
    });

    // Setup called once (for tenant A)
    expect(setupCalls).toHaveLength(1);

    // Query called twice (tenant B first, then tenant A)
    expect(queryCalls).toHaveLength(2);

    // The two query calls should be for different tenants
    expect(queryCalls[0]).not.toBe(queryCalls[1]);

    // Setup tenant should match the second query call (tenant A)
    expect(setupCalls[0]).toBe(queryCalls[1]);
  });
});
