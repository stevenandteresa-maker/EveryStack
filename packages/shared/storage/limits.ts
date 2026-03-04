/**
 * Per-plan file size limits.
 *
 * See files.md § File Size Limits for the canonical table.
 * Plans are matched by the `tenants.plan` column (varchar, default 'freelancer').
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;
const TB = 1024 * GB;

export interface PlanFileLimits {
  /** Maximum single file size in bytes. */
  maxFileBytes: number;
  /** Total storage quota in bytes. */
  totalStorageBytes: number;
  /** Whether multipart upload (>100MB) is enabled. */
  multipartEnabled: boolean;
}

/**
 * File limits indexed by plan slug.
 * Must match the plan values in `tenants.plan`.
 */
export const FILE_LIMITS: Record<string, PlanFileLimits> = {
  freelancer: {
    maxFileBytes: 25 * MB,
    totalStorageBytes: 5 * GB,
    multipartEnabled: false,
  },
  starter: {
    maxFileBytes: 50 * MB,
    totalStorageBytes: 25 * GB,
    multipartEnabled: false,
  },
  professional: {
    maxFileBytes: 100 * MB,
    totalStorageBytes: 100 * GB,
    multipartEnabled: false,
  },
  business: {
    maxFileBytes: 250 * MB,
    totalStorageBytes: 500 * GB,
    multipartEnabled: true,
  },
  enterprise: {
    maxFileBytes: 500 * MB,
    totalStorageBytes: 1 * TB,
    multipartEnabled: true,
  },
};

/**
 * Get file limits for a plan. Falls back to freelancer for unknown plans.
 */
export function getFileLimits(planSlug: string): PlanFileLimits {
  return FILE_LIMITS[planSlug] ?? FILE_LIMITS['freelancer']!;
}
