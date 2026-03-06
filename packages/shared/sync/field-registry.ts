// ---------------------------------------------------------------------------
// FieldTypeRegistry — per-platform, per-field-type transform registry.
//
// All field type transforms are registered here. Feature code and sync
// adapters use the registry to look up transforms — never switch statements.
//
// See: sync-engine.md § Field Type Registry, CLAUDE.md § Field Type Registry
// ---------------------------------------------------------------------------

import type { FieldTransform } from './types';

/**
 * Registry for platform-specific field type transforms.
 *
 * Stores transforms keyed by `{platform}:{fieldType}` and provides
 * lookup, enumeration, and validation methods.
 *
 * Use the exported `fieldTypeRegistry` singleton — do not instantiate directly.
 */
export class FieldTypeRegistry {
  private readonly transforms = new Map<string, FieldTransform>();

  private static makeKey(platform: string, fieldType: string): string {
    return `${platform}:${fieldType}`;
  }

  /**
   * Register a transform for a platform + field type combination.
   * Overwrites any previously registered transform for the same key.
   */
  register(platform: string, fieldType: string, transform: FieldTransform): void {
    const key = FieldTypeRegistry.makeKey(platform, fieldType);
    this.transforms.set(key, transform);
  }

  /**
   * Retrieve a transform for a platform + field type.
   * Throws a descriptive error if no transform is registered.
   */
  get(platform: string, fieldType: string): FieldTransform {
    const key = FieldTypeRegistry.makeKey(platform, fieldType);
    const transform = this.transforms.get(key);
    if (!transform) {
      throw new Error(
        `No transform registered for platform "${platform}", field type "${fieldType}". ` +
          `Register a FieldTransform via fieldTypeRegistry.register("${platform}", "${fieldType}", transform) before use.`,
      );
    }
    return transform;
  }

  /**
   * Check whether a transform exists for a platform + field type.
   */
  has(platform: string, fieldType: string): boolean {
    return this.transforms.has(FieldTypeRegistry.makeKey(platform, fieldType));
  }

  /**
   * Get all registered transforms for a given platform.
   * Returns a Map of fieldType → FieldTransform.
   */
  getAllForPlatform(platform: string): Map<string, FieldTransform> {
    const prefix = `${platform}:`;
    const result = new Map<string, FieldTransform>();
    for (const [key, transform] of this.transforms) {
      if (key.startsWith(prefix)) {
        const fieldType = key.slice(prefix.length);
        result.set(fieldType, transform);
      }
    }
    return result;
  }

  /**
   * Get a list of all registered field type keys for a given platform.
   */
  getSupportedFieldTypes(platform: string): string[] {
    const prefix = `${platform}:`;
    const types: string[] = [];
    for (const key of this.transforms.keys()) {
      if (key.startsWith(prefix)) {
        types.push(key.slice(prefix.length));
      }
    }
    return types;
  }

  /**
   * Total number of registered transforms (across all platforms).
   * Useful for testing and diagnostics.
   */
  get size(): number {
    return this.transforms.size;
  }

  /**
   * Remove all registered transforms. Primarily for test isolation.
   */
  clear(): void {
    this.transforms.clear();
  }
}

/** Singleton registry instance. All sync code should use this export. */
export const fieldTypeRegistry = new FieldTypeRegistry();
