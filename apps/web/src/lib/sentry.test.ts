import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetTag = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  getCurrentScope: () => ({
    setTag: mockSetTag,
  }),
}));

import { setSentryFeatureTag } from './sentry';

describe('setSentryFeatureTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets feature tag on current Sentry scope', () => {
    setSentryFeatureTag('sync-engine');

    expect(mockSetTag).toHaveBeenCalledWith('feature', 'sync-engine');
  });

  it('sets different feature tags for different features', () => {
    setSentryFeatureTag('ai-smart-fill');

    expect(mockSetTag).toHaveBeenCalledWith('feature', 'ai-smart-fill');
  });

  it('overwrites previous tag when called again', () => {
    setSentryFeatureTag('portals');
    setSentryFeatureTag('automations');

    expect(mockSetTag).toHaveBeenCalledTimes(2);
    expect(mockSetTag).toHaveBeenLastCalledWith('feature', 'automations');
  });
});
