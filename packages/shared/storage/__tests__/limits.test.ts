import { describe, it, expect } from 'vitest';
import { FILE_LIMITS, getFileLimits } from '../limits';
import type { PlanFileLimits } from '../limits';

const MB = 1024 * 1024;
const GB = 1024 * MB;
const TB = 1024 * GB;

describe('FILE_LIMITS', () => {
  it('defines limits for all 5 plans', () => {
    expect(Object.keys(FILE_LIMITS)).toHaveLength(5);
    expect(FILE_LIMITS).toHaveProperty('freelancer');
    expect(FILE_LIMITS).toHaveProperty('starter');
    expect(FILE_LIMITS).toHaveProperty('professional');
    expect(FILE_LIMITS).toHaveProperty('business');
    expect(FILE_LIMITS).toHaveProperty('enterprise');
  });

  it('freelancer: 25MB / 5GB / no multipart', () => {
    const limits = FILE_LIMITS['freelancer'] as PlanFileLimits;
    expect(limits.maxFileBytes).toBe(25 * MB);
    expect(limits.totalStorageBytes).toBe(5 * GB);
    expect(limits.multipartEnabled).toBe(false);
  });

  it('starter: 50MB / 25GB / no multipart', () => {
    const limits = FILE_LIMITS['starter'] as PlanFileLimits;
    expect(limits.maxFileBytes).toBe(50 * MB);
    expect(limits.totalStorageBytes).toBe(25 * GB);
    expect(limits.multipartEnabled).toBe(false);
  });

  it('professional: 100MB / 100GB / no multipart', () => {
    const limits = FILE_LIMITS['professional'] as PlanFileLimits;
    expect(limits.maxFileBytes).toBe(100 * MB);
    expect(limits.totalStorageBytes).toBe(100 * GB);
    expect(limits.multipartEnabled).toBe(false);
  });

  it('business: 250MB / 500GB / multipart enabled', () => {
    const limits = FILE_LIMITS['business'] as PlanFileLimits;
    expect(limits.maxFileBytes).toBe(250 * MB);
    expect(limits.totalStorageBytes).toBe(500 * GB);
    expect(limits.multipartEnabled).toBe(true);
  });

  it('enterprise: 500MB / 1TB / multipart enabled', () => {
    const limits = FILE_LIMITS['enterprise'] as PlanFileLimits;
    expect(limits.maxFileBytes).toBe(500 * MB);
    expect(limits.totalStorageBytes).toBe(1 * TB);
    expect(limits.multipartEnabled).toBe(true);
  });
});

describe('getFileLimits', () => {
  it('returns correct limits for each plan', () => {
    expect(getFileLimits('freelancer').maxFileBytes).toBe(25 * MB);
    expect(getFileLimits('starter').maxFileBytes).toBe(50 * MB);
    expect(getFileLimits('professional').maxFileBytes).toBe(100 * MB);
    expect(getFileLimits('business').maxFileBytes).toBe(250 * MB);
    expect(getFileLimits('enterprise').maxFileBytes).toBe(500 * MB);
  });

  it('falls back to freelancer for unknown plans', () => {
    const limits = getFileLimits('nonexistent');
    expect(limits.maxFileBytes).toBe(25 * MB);
    expect(limits.totalStorageBytes).toBe(5 * GB);
    expect(limits.multipartEnabled).toBe(false);
  });

  it('falls back to freelancer for empty string', () => {
    const limits = getFileLimits('');
    expect(limits.maxFileBytes).toBe(25 * MB);
  });
});
