/**
 * AI Credit Ledger — budget checking and credit deduction.
 *
 * Provides the database write paths for AI credit budget management:
 * - checkBudget(): query current period remaining credits
 * - deductCredits(): atomic credit deduction
 * - checkAlertThresholds(): detect 80%, 95%, 100% budget thresholds
 *
 * The ledger row itself is created by the billing system (not by this module).
 * If no ledger row exists for the current period, the tenant is treated as exhausted.
 */

import { eq, and, lte, gt, sql } from 'drizzle-orm';
import { getDbForTenant } from '../../db/client';
import { aiCreditLedger } from '../../db/schema/ai-credit-ledger';
import { createLogger } from '../../logging/logger';
import { getTraceId } from '../../logging/trace-context';

const logger = createLogger({ service: 'ai-metering' });

/** Current budget status for a tenant */
export interface BudgetStatus {
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  usagePct: number;
  exhausted: boolean;
}

/** Alert action returned when a budget threshold is crossed */
export interface AlertAction {
  type: 'budget_80pct' | 'budget_95pct' | 'budget_exhausted';
  tenantId: string;
}

/**
 * Query the current billing period budget status for a tenant.
 *
 * Finds the ledger row where period_start <= now < period_end.
 * If no row exists, returns exhausted status (billing system hasn't provisioned).
 */
export async function checkBudget(tenantId: string): Promise<BudgetStatus> {
  const db = getDbForTenant(tenantId, 'read');
  const now = new Date().toISOString().split('T')[0]!;

  const rows = await db
    .select()
    .from(aiCreditLedger)
    .where(
      and(
        eq(aiCreditLedger.tenantId, tenantId),
        lte(aiCreditLedger.periodStart, now),
        gt(aiCreditLedger.periodEnd, now),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    logger.info(
      { traceId: getTraceId(), tenantId },
      'No credit ledger row for current period — treating as exhausted',
    );
    return {
      creditsTotal: 0,
      creditsUsed: 0,
      creditsRemaining: 0,
      usagePct: 100,
      exhausted: true,
    };
  }

  const row = rows[0]!;
  const creditsTotal = row.creditsTotal;
  const creditsUsed = Number(row.creditsUsed);
  const creditsRemaining = creditsTotal - creditsUsed;
  const usagePct = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 1000) / 10 : 100;

  return {
    creditsTotal,
    creditsUsed,
    creditsRemaining,
    usagePct,
    exhausted: creditsRemaining < 1,
  };
}

/**
 * Atomically deduct credits from the tenant's current period ledger.
 *
 * Uses SQL `credits_used = credits_used + credits` for atomic increment.
 * Returns the updated BudgetStatus after deduction.
 * If no ledger row exists, returns exhausted status.
 */
export async function deductCredits(
  tenantId: string,
  credits: number,
): Promise<BudgetStatus> {
  const db = getDbForTenant(tenantId, 'write');
  const now = new Date().toISOString().split('T')[0]!;

  const updated = await db
    .update(aiCreditLedger)
    .set({
      creditsUsed: sql`${aiCreditLedger.creditsUsed} + ${credits}`,
    })
    .where(
      and(
        eq(aiCreditLedger.tenantId, tenantId),
        lte(aiCreditLedger.periodStart, now),
        gt(aiCreditLedger.periodEnd, now),
      ),
    )
    .returning();

  if (updated.length === 0) {
    logger.info(
      { traceId: getTraceId(), tenantId, credits },
      'No credit ledger row for deduction — treating as exhausted',
    );
    return {
      creditsTotal: 0,
      creditsUsed: 0,
      creditsRemaining: 0,
      usagePct: 100,
      exhausted: true,
    };
  }

  const row = updated[0]!;
  const creditsTotal = row.creditsTotal;
  const creditsUsed = Number(row.creditsUsed);
  const creditsRemaining = creditsTotal - creditsUsed;
  const usagePct = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 1000) / 10 : 100;

  logger.info(
    {
      traceId: getTraceId(),
      tenantId,
      credits,
      creditsUsed,
      creditsRemaining,
      usagePct,
    },
    'Credits deducted',
  );

  return {
    creditsTotal,
    creditsUsed,
    creditsRemaining,
    usagePct,
    exhausted: creditsRemaining < 1,
  };
}

/**
 * Check if a budget status crosses alert thresholds.
 *
 * Returns alert actions (not dispatched — the caller is responsible for dispatching):
 * - 80% → budget_80pct
 * - 95% → budget_95pct
 * - 100% → budget_exhausted
 * - Below all thresholds → empty array
 */
export function checkAlertThresholds(
  tenantId: string,
  budgetStatus: BudgetStatus,
): AlertAction[] {
  const alerts: AlertAction[] = [];

  if (budgetStatus.usagePct >= 100 || budgetStatus.exhausted) {
    alerts.push({ type: 'budget_exhausted', tenantId });
  } else if (budgetStatus.usagePct >= 95) {
    alerts.push({ type: 'budget_95pct', tenantId });
  } else if (budgetStatus.usagePct >= 80) {
    alerts.push({ type: 'budget_80pct', tenantId });
  }

  return alerts;
}
