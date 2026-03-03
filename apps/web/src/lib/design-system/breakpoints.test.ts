import { describe, it, expect } from 'vitest';
import { BREAKPOINTS } from './breakpoints';

describe('BREAKPOINTS', () => {
  it('has exactly 3 breakpoints', () => {
    expect(Object.keys(BREAKPOINTS)).toHaveLength(3);
  });

  it('contains phone, tablet, and desktop', () => {
    expect(Object.keys(BREAKPOINTS)).toEqual(['phone', 'tablet', 'desktop']);
  });

  it('phone has max 767', () => {
    expect(BREAKPOINTS.phone).toEqual({ max: 767 });
  });

  it('tablet has min 768', () => {
    expect(BREAKPOINTS.tablet).toEqual({ min: 768 });
  });

  it('desktop has min 1440', () => {
    expect(BREAKPOINTS.desktop).toEqual({ min: 1440 });
  });

  it('phone max and tablet min have no overlap or gap', () => {
    expect(BREAKPOINTS.tablet.min).toBe(BREAKPOINTS.phone.max + 1);
  });

  it('tablet range does not overlap with desktop', () => {
    expect(BREAKPOINTS.desktop.min).toBeGreaterThan(BREAKPOINTS.tablet.min);
  });
});
