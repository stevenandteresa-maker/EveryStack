// ---------------------------------------------------------------------------
// PlatformAdapter — base interface for all platform sync adapters
//
// Each platform (Airtable, Notion, SmartSuite) implements this interface
// to transform records between platform-native and canonical JSONB form.
// ---------------------------------------------------------------------------

import type { CanonicalValue, SyncPlatform } from '../types';

// ---------------------------------------------------------------------------
// Rate Limit Configuration — per-platform API rate limit declarations
//
// Each platform adapter declares its rate limits as structured configuration.
// The sync scheduler uses these to proactively gate API calls.
// @see docs/reference/sync-engine.md § External API Rate Limit Management
// ---------------------------------------------------------------------------

/**
 * A single rate limit constraint (e.g., 5 req/s per base).
 */
export interface RateLimit {
  /** Scope identifier, e.g. 'per_base', 'per_api_key'. */
  scope: string;
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Window duration in seconds. */
  windowSeconds: number;
}

/**
 * Retry behaviour when a rate limit is hit or a transient error occurs.
 */
export interface RetryStrategy {
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Initial delay in milliseconds before the first retry. */
  baseDelayMs: number;
  /** Upper bound on delay in milliseconds. */
  maxDelayMs: number;
  /** Multiplier applied to the delay after each successive retry. */
  backoffMultiplier: number;
}

/**
 * Declares all rate limits and retry behaviour for a platform.
 * Registered with the RateLimiter at startup — these are configuration,
 * not hardcoded, so they can be updated when platforms change limits.
 */
export interface PlatformRateLimits {
  platform: SyncPlatform;
  limits: RateLimit[];
  retryStrategy: RetryStrategy;
}

/**
 * Maps an EveryStack field to its external platform counterpart.
 * Used by adapters to know which platform field corresponds to which
 * canonical field, and what types are involved on each side.
 */
export interface FieldMapping {
  /** EveryStack field UUID (the key in canonical_data). */
  fieldId: string;
  /** The field's ID on the source platform (e.g. Airtable's fldXxx). */
  externalFieldId: string;
  /** EveryStack canonical field type (e.g. 'text', 'number', 'currency'). */
  fieldType: string;
  /** Platform-native field type string (e.g. 'singleLineText', 'number'). */
  externalFieldType: string;
  /** Platform-specific options (select choices, currency codes, etc.). */
  config: Record<string, unknown>;
}

/**
 * Base interface for platform sync adapters.
 *
 * Adapters transform entire records between a platform's native shape
 * and EveryStack's canonical JSONB representation. They delegate
 * per-field transforms to the FieldTypeRegistry.
 */
export interface PlatformAdapter {
  /** Which platform this adapter handles. */
  platform: SyncPlatform;

  /**
   * Transform a platform-native record into canonical JSONB form.
   *
   * @param record - The raw record from the platform API
   * @param fieldMappings - Maps between ES fields and platform fields
   * @returns Canonical data keyed by ES field UUID
   */
  toCanonical(
    record: unknown,
    fieldMappings: FieldMapping[],
  ): Record<string, CanonicalValue>;

  /**
   * Transform canonical JSONB data back into the platform-native shape.
   *
   * @param canonicalData - Canonical values keyed by ES field UUID
   * @param fieldMappings - Maps between ES fields and platform fields
   * @returns Platform-native record fields
   */
  fromCanonical(
    canonicalData: Record<string, CanonicalValue>,
    fieldMappings: FieldMapping[],
  ): unknown;
}
