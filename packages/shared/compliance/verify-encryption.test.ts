import { describe, it, expect, vi } from 'vitest';
import { verifyDatabaseTls, verifyRedisTls, verifyEncryptionConfig } from './verify-encryption';

// Mock the logger to prevent actual log output during tests
vi.mock('../logging', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('Encryption Verification', () => {
  // ─── verifyDatabaseTls ─────────────────────────────────────────────────

  describe('verifyDatabaseTls', () => {
    it('returns true for sslmode=require', () => {
      expect(verifyDatabaseTls('postgresql://user:pass@host:5432/db?sslmode=require')).toBe(true);
    });

    it('returns true for sslmode=verify-full', () => {
      expect(verifyDatabaseTls('postgresql://user:pass@host:5432/db?sslmode=verify-full')).toBe(true);
    });

    it('returns true for uppercase sslmode=REQUIRE', () => {
      expect(verifyDatabaseTls('postgresql://user:pass@host:5432/db?sslmode=REQUIRE')).toBe(true);
    });

    it('returns false without sslmode', () => {
      expect(verifyDatabaseTls('postgresql://user:pass@host:5432/db')).toBe(false);
    });

    it('returns false for sslmode=prefer', () => {
      expect(verifyDatabaseTls('postgresql://user:pass@host:5432/db?sslmode=prefer')).toBe(false);
    });

    it('returns false for sslmode=disable', () => {
      expect(verifyDatabaseTls('postgresql://user:pass@host:5432/db?sslmode=disable')).toBe(false);
    });
  });

  // ─── verifyRedisTls ────────────────────────────────────────────────────

  describe('verifyRedisTls', () => {
    it('returns true for rediss:// protocol', () => {
      expect(verifyRedisTls('rediss://localhost:6379')).toBe(true);
    });

    it('returns true for uppercase REDISS://', () => {
      expect(verifyRedisTls('REDISS://localhost:6379')).toBe(true);
    });

    it('returns false for redis:// protocol (no TLS)', () => {
      expect(verifyRedisTls('redis://localhost:6379')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(verifyRedisTls('')).toBe(false);
    });
  });

  // ─── verifyEncryptionConfig ────────────────────────────────────────────

  describe('verifyEncryptionConfig', () => {
    it('returns both true when TLS is configured', () => {
      const result = verifyEncryptionConfig({
        databaseUrl: 'postgresql://user:pass@host:5432/db?sslmode=require',
        redisUrl: 'rediss://host:6379',
        nodeEnv: 'development',
      });
      expect(result).toEqual({ databaseTls: true, redisTls: true });
    });

    it('returns both false for dev URLs without TLS', () => {
      const result = verifyEncryptionConfig({
        databaseUrl: 'postgresql://user:pass@localhost:5432/db',
        redisUrl: 'redis://localhost:6379',
        nodeEnv: 'development',
      });
      expect(result).toEqual({ databaseTls: false, redisTls: false });
    });

    it('throws in production when database TLS is missing', () => {
      expect(() =>
        verifyEncryptionConfig({
          databaseUrl: 'postgresql://user:pass@host:5432/db',
          redisUrl: 'rediss://host:6379',
          nodeEnv: 'production',
        }),
      ).toThrow('Database connection does not use TLS');
    });

    it('throws in production when Redis TLS is missing', () => {
      expect(() =>
        verifyEncryptionConfig({
          databaseUrl: 'postgresql://user:pass@host:5432/db?sslmode=require',
          redisUrl: 'redis://host:6379',
          nodeEnv: 'production',
        }),
      ).toThrow('Redis connection does not use TLS');
    });

    it('does not throw in development when TLS is missing', () => {
      expect(() =>
        verifyEncryptionConfig({
          databaseUrl: 'postgresql://user:pass@localhost:5432/db',
          redisUrl: 'redis://localhost:6379',
          nodeEnv: 'development',
        }),
      ).not.toThrow();
    });

    it('handles missing environment variables gracefully', () => {
      const result = verifyEncryptionConfig({
        nodeEnv: 'development',
      });
      expect(result).toEqual({ databaseTls: false, redisTls: false });
    });
  });
});
