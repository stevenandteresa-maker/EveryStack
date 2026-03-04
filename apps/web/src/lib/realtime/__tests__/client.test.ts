import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock socket.io-client ──────────────────────────────────────────────────

const mockSocketInstance = {
  connected: false,
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocketInstance),
}));

import { io } from 'socket.io-client';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('realtime client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketInstance.connected = false;
    mockSocketInstance.disconnect.mockClear();

    // Reset module state between tests so the singleton is cleared
    vi.resetModules();
  });

  it('creates a socket with correct reconnection parameters', async () => {
    const { getRealtimeClient } = await import('../client');

    getRealtimeClient('test-token');

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: { token: 'test-token' },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 30_000,
        randomizationFactor: 0.2,
        autoConnect: true,
      }),
    );
  });

  it('returns the same singleton on repeated calls', async () => {
    const { getRealtimeClient } = await import('../client');

    const first = getRealtimeClient('token-a');
    const second = getRealtimeClient('token-b');

    expect(first).toBe(second);
    // io() should only be called once (singleton)
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('disconnectRealtimeClient nulls the reference', async () => {
    const { getRealtimeClient, disconnectRealtimeClient } = await import(
      '../client'
    );

    getRealtimeClient('test-token');
    disconnectRealtimeClient();

    expect(mockSocketInstance.disconnect).toHaveBeenCalled();

    // After disconnect, a new call should create a fresh socket
    getRealtimeClient('new-token');
    expect(io).toHaveBeenCalledTimes(2);
  });

  it('disconnectRealtimeClient is safe to call without a socket', async () => {
    const { disconnectRealtimeClient } = await import('../client');

    // Should not throw
    expect(() => disconnectRealtimeClient()).not.toThrow();
  });
});
