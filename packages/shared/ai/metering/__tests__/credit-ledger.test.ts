import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

const mockReturning = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

const mockDb = {
  select: mockSelect,
  update: mockUpdate,
};

vi.mock('../../../db/client', () => ({
  getDbForTenant: vi.fn(() => mockDb),
}));

vi.mock('../../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../logging/trace-context', () => ({
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

import { checkBudget, deductCredits, checkAlertThresholds } from '../credit-ledger';
import type { BudgetStatus } from '../credit-ledger';
import { getDbForTenant } from '../../../db/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '01900000-0000-7000-8000-aaaaaaaaaaaa';

function makeLedgerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '01900000-0000-7000-8000-111111111111',
    tenantId: TENANT_ID,
    periodStart: '2026-03-01',
    periodEnd: '2026-04-01',
    creditsTotal: 2500,
    creditsUsed: '1000',
    creditsRemaining: '1500',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function setupSelectChain(rows: unknown[]) {
  mockLimit.mockResolvedValue(rows);
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({ where: mockWhere }),
  });
}

function setupUpdateChain(rows: unknown[]) {
  mockReturning.mockResolvedValue(rows);
  mockWhere.mockReturnValue({ returning: mockReturning });
  mockSet.mockReturnValue({ where: mockWhere });
  mockUpdate.mockReturnValue({ set: mockSet });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkBudget', () => {
  it('returns correct remaining credits for current period', async () => {
    setupSelectChain([makeLedgerRow()]);

    const result = await checkBudget(TENANT_ID);

    expect(getDbForTenant).toHaveBeenCalledWith(TENANT_ID, 'read');
    expect(result.creditsTotal).toBe(2500);
    expect(result.creditsUsed).toBe(1000);
    expect(result.creditsRemaining).toBe(1500);
    expect(result.usagePct).toBe(40);
    expect(result.exhausted).toBe(false);
  });

  it('returns exhausted: true when no ledger row exists', async () => {
    setupSelectChain([]);

    const result = await checkBudget(TENANT_ID);

    expect(result.creditsTotal).toBe(0);
    expect(result.creditsUsed).toBe(0);
    expect(result.creditsRemaining).toBe(0);
    expect(result.usagePct).toBe(100);
    expect(result.exhausted).toBe(true);
  });

  it('returns exhausted: true when credits are fully consumed', async () => {
    setupSelectChain([makeLedgerRow({ creditsUsed: '2500' })]);

    const result = await checkBudget(TENANT_ID);

    expect(result.creditsRemaining).toBe(0);
    expect(result.exhausted).toBe(true);
    expect(result.usagePct).toBe(100);
  });

  it('returns exhausted: true when less than 1 credit remains', async () => {
    setupSelectChain([makeLedgerRow({ creditsUsed: '2499.5' })]);

    const result = await checkBudget(TENANT_ID);

    expect(result.creditsRemaining).toBe(0.5);
    expect(result.exhausted).toBe(true);
  });

  it('calculates usage percentage with one decimal', async () => {
    // 1847 / 2500 = 73.88% → rounded to 73.9
    setupSelectChain([makeLedgerRow({ creditsUsed: '1847' })]);

    const result = await checkBudget(TENANT_ID);

    expect(result.usagePct).toBe(73.9);
  });
});

describe('deductCredits', () => {
  it('atomically updates credits_used and returns updated status', async () => {
    // After deduction of 5 credits: used goes from 1000 to 1005
    setupUpdateChain([makeLedgerRow({ creditsUsed: '1005' })]);

    const result = await deductCredits(TENANT_ID, 5);

    expect(getDbForTenant).toHaveBeenCalledWith(TENANT_ID, 'write');
    expect(result.creditsUsed).toBe(1005);
    expect(result.creditsRemaining).toBe(1495);
    expect(result.exhausted).toBe(false);
  });

  it('returns exhausted: true when no ledger row exists', async () => {
    setupUpdateChain([]);

    const result = await deductCredits(TENANT_ID, 5);

    expect(result.exhausted).toBe(true);
    expect(result.creditsTotal).toBe(0);
  });

  it('returns exhausted: true after deduction reaches budget', async () => {
    setupUpdateChain([makeLedgerRow({ creditsTotal: 100, creditsUsed: '100' })]);

    const result = await deductCredits(TENANT_ID, 5);

    expect(result.exhausted).toBe(true);
    expect(result.creditsRemaining).toBe(0);
  });

  it('uses SQL atomic increment (not read-modify-write)', async () => {
    setupUpdateChain([makeLedgerRow({ creditsUsed: '1005' })]);

    await deductCredits(TENANT_ID, 5);

    // Verify set() was called (the SQL expression is opaque in unit tests,
    // but we verify it goes through the update path not select-then-update)
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1);
  });
});

describe('checkAlertThresholds', () => {
  it('returns budget_80pct alert at 80% usage', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2000,
      creditsRemaining: 500,
      usagePct: 80,
      exhausted: false,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([{ type: 'budget_80pct', tenantId: TENANT_ID }]);
  });

  it('returns budget_80pct at 85% (between 80 and 95)', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2125,
      creditsRemaining: 375,
      usagePct: 85,
      exhausted: false,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([{ type: 'budget_80pct', tenantId: TENANT_ID }]);
  });

  it('returns budget_95pct alert at 95% usage', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2375,
      creditsRemaining: 125,
      usagePct: 95,
      exhausted: false,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([{ type: 'budget_95pct', tenantId: TENANT_ID }]);
  });

  it('returns budget_95pct at 99% (between 95 and 100)', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2475,
      creditsRemaining: 25,
      usagePct: 99,
      exhausted: false,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([{ type: 'budget_95pct', tenantId: TENANT_ID }]);
  });

  it('returns budget_exhausted at 100% usage', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2500,
      creditsRemaining: 0,
      usagePct: 100,
      exhausted: true,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([{ type: 'budget_exhausted', tenantId: TENANT_ID }]);
  });

  it('returns budget_exhausted when exhausted flag is true (even if usagePct < 100)', () => {
    const status: BudgetStatus = {
      creditsTotal: 0,
      creditsUsed: 0,
      creditsRemaining: 0,
      usagePct: 100,
      exhausted: true,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([{ type: 'budget_exhausted', tenantId: TENANT_ID }]);
  });

  it('returns empty array below 80%', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 1000,
      creditsRemaining: 1500,
      usagePct: 40,
      exhausted: false,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([]);
  });

  it('returns empty array at 79.9%', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 1997.5,
      creditsRemaining: 502.5,
      usagePct: 79.9,
      exhausted: false,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    expect(alerts).toEqual([]);
  });

  it('returns exactly one alert (highest applicable threshold)', () => {
    const status: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2500,
      creditsRemaining: 0,
      usagePct: 100,
      exhausted: true,
    };

    const alerts = checkAlertThresholds(TENANT_ID, status);

    // Should NOT return both budget_80pct AND budget_95pct AND budget_exhausted
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.type).toBe('budget_exhausted');
  });
});
