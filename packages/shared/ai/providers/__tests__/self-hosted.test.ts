import { describe, it, expect } from 'vitest';

import { SelfHostedAdapter } from '../self-hosted';
import type { CompiledAIRequest } from '../../types';

const NOT_IMPLEMENTED = 'Self-hosted adapter not implemented — post-MVP';

function makeRequest(): CompiledAIRequest {
  return {
    systemInstruction: 'Test',
    messages: [{ role: 'user', content: 'Hello' }],
    modelConfig: { modelId: 'test-model', providerId: 'self-hosted' },
    maxTokens: 1024,
    temperature: 0.7,
  };
}

describe('SelfHostedAdapter', () => {
  it('has providerId set to self-hosted', () => {
    const adapter = new SelfHostedAdapter();
    expect(adapter.providerId).toBe('self-hosted');
  });

  it('complete() throws not implemented', async () => {
    const adapter = new SelfHostedAdapter();
    await expect(adapter.complete(makeRequest())).rejects.toThrow(
      NOT_IMPLEMENTED,
    );
  });

  it('streamComplete() throws not implemented', async () => {
    const adapter = new SelfHostedAdapter();
    const iterable = adapter.streamComplete(makeRequest());
    const iterator = iterable[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toThrow(NOT_IMPLEMENTED);
  });

  it('completeWithTools() throws not implemented', async () => {
    const adapter = new SelfHostedAdapter();
    await expect(adapter.completeWithTools(makeRequest(), [])).rejects.toThrow(
      NOT_IMPLEMENTED,
    );
  });

  it('supportedCapabilities() throws not implemented', () => {
    const adapter = new SelfHostedAdapter();
    expect(() => adapter.supportedCapabilities()).toThrow(NOT_IMPLEMENTED);
  });

  it('calculateCost() throws not implemented', () => {
    const adapter = new SelfHostedAdapter();
    expect(() =>
      adapter.calculateCost({
        input_tokens: 100,
        output_tokens: 50,
        cached_input_tokens: 0,
      }),
    ).toThrow(NOT_IMPLEMENTED);
  });
});
