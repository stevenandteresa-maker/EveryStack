import { describe, it, expect } from 'vitest';
import { TYPOGRAPHY_SCALE } from './typography';

const CSS_SIZE_PATTERN = /^\d+px$/;

describe('TYPOGRAPHY_SCALE', () => {
  it('has exactly 9 entries', () => {
    expect(Object.keys(TYPOGRAPHY_SCALE)).toHaveLength(9);
  });

  it('contains the expected step names', () => {
    const names = Object.keys(TYPOGRAPHY_SCALE);
    expect(names).toEqual([
      'page-title',
      'h1',
      'h2',
      'h3',
      'body-lg',
      'body',
      'body-sm',
      'caption',
      'timestamp',
    ]);
  });

  it('all font sizes are valid CSS px values', () => {
    for (const [, step] of Object.entries(TYPOGRAPHY_SCALE)) {
      expect(step.fontSize).toMatch(CSS_SIZE_PATTERN);
    }
  });

  it('all line heights are valid CSS px values', () => {
    for (const [, step] of Object.entries(TYPOGRAPHY_SCALE)) {
      expect(step.lineHeight).toMatch(CSS_SIZE_PATTERN);
    }
  });

  it('all font weights are valid numbers', () => {
    for (const [, step] of Object.entries(TYPOGRAPHY_SCALE)) {
      expect([400, 600, 700]).toContain(step.fontWeight);
    }
  });

  it('line height is always greater than font size', () => {
    for (const [, step] of Object.entries(TYPOGRAPHY_SCALE)) {
      const fontSize = parseInt(step.fontSize, 10);
      const lineHeight = parseInt(step.lineHeight, 10);
      expect(lineHeight).toBeGreaterThan(fontSize);
    }
  });

  it('font sizes descend from page-title (28px) to timestamp (11px)', () => {
    const sizes = Object.values(TYPOGRAPHY_SCALE).map((s) =>
      parseInt(s.fontSize, 10),
    );
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]!);
    }
  });

  it('page-title is 28px/700/36px', () => {
    expect(TYPOGRAPHY_SCALE['page-title']).toEqual({
      fontSize: '28px',
      fontWeight: 700,
      lineHeight: '36px',
    });
  });

  it('body default is 14px/400/20px', () => {
    expect(TYPOGRAPHY_SCALE.body).toEqual({
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: '20px',
    });
  });

  it('timestamp is 11px/400/14px', () => {
    expect(TYPOGRAPHY_SCALE.timestamp).toEqual({
      fontSize: '11px',
      fontWeight: 400,
      lineHeight: '14px',
    });
  });
});
