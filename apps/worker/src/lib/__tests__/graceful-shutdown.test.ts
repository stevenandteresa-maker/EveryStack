import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerShutdownHandler,
  setupGracefulShutdown,
  _resetShutdownState,
  _isShuttingDown,
} from '../graceful-shutdown';

// Mock process.exit to prevent tests from actually exiting
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

// Mock process signal listeners
const originalOn = process.on.bind(process);
let signalHandlers: Record<string, (() => void)[]> = {};

vi.spyOn(process, 'on').mockImplementation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((event: string, handler: (...args: any[]) => void) => {
    if (event === 'SIGTERM' || event === 'SIGINT') {
      signalHandlers[event] = signalHandlers[event] ?? [];
      signalHandlers[event].push(handler as () => void);
      return process;
    }
    return originalOn(event, handler);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
);

// Create a mock logger
function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: 'info',
    silent: vi.fn(),
  };
}

describe('graceful-shutdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    _resetShutdownState();
    signalHandlers = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls registered handlers on SIGTERM', async () => {
    const handler1 = vi.fn().mockResolvedValue(undefined);
    const handler2 = vi.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();

    registerShutdownHandler(handler1);
    registerShutdownHandler(handler2);
    setupGracefulShutdown(logger as never);

    // Trigger SIGTERM
    const sigterm = signalHandlers['SIGTERM']?.[0];
    expect(sigterm).toBeDefined();
    sigterm!();

    // Allow async handlers to run
    await vi.advanceTimersByTimeAsync(0);

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      { signal: 'SIGTERM' },
      'Graceful shutdown initiated',
    );
  });

  it('calls registered handlers on SIGINT', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();

    registerShutdownHandler(handler);
    setupGracefulShutdown(logger as never);

    const sigint = signalHandlers['SIGINT']?.[0];
    expect(sigint).toBeDefined();
    sigint!();

    await vi.advanceTimersByTimeAsync(0);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('ignores duplicate signals (isShuttingDown guard)', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();

    registerShutdownHandler(handler);
    setupGracefulShutdown(logger as never);

    const sigterm = signalHandlers['SIGTERM']?.[0];

    // First signal
    sigterm!();
    await vi.advanceTimersByTimeAsync(0);

    expect(_isShuttingDown()).toBe(true);

    // Second signal — should be ignored
    handler.mockClear();
    sigterm!();
    await vi.advanceTimersByTimeAsync(0);

    expect(handler).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { signal: 'SIGTERM' },
      'Shutdown already in progress, ignoring signal',
    );
  });

  it('force exits after 30 seconds if handlers stall', async () => {
    const stalledHandler = vi.fn().mockReturnValue(new Promise(() => {
      // Never resolves — simulates a stuck handler
    }));
    const logger = createMockLogger();

    registerShutdownHandler(stalledHandler);
    setupGracefulShutdown(logger as never);

    const sigterm = signalHandlers['SIGTERM']?.[0];
    sigterm!();

    // Advance to just before timeout — should not have force-exited
    await vi.advanceTimersByTimeAsync(29_999);
    expect(mockExit).not.toHaveBeenCalledWith(1);

    // Advance past the 30s timeout
    await vi.advanceTimersByTimeAsync(2);
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Forced exit — shutdown handlers did not complete in time',
    );
  });

  it('calls process.exit(0) after all handlers complete', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();

    registerShutdownHandler(handler);
    setupGracefulShutdown(logger as never);

    const sigterm = signalHandlers['SIGTERM']?.[0];
    sigterm!();

    await vi.advanceTimersByTimeAsync(0);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith('Graceful shutdown complete');
  });

  it('continues with remaining handlers if one throws', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('handler error'));
    const okHandler = vi.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();

    registerShutdownHandler(failingHandler);
    registerShutdownHandler(okHandler);
    setupGracefulShutdown(logger as never);

    const sigterm = signalHandlers['SIGTERM']?.[0];
    sigterm!();

    await vi.advanceTimersByTimeAsync(0);

    expect(failingHandler).toHaveBeenCalledOnce();
    expect(okHandler).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      { err: 'handler error' },
      'Shutdown handler failed',
    );
  });

  it('calls handlers in registration order', async () => {
    const order: number[] = [];
    const logger = createMockLogger();

    registerShutdownHandler(async () => { order.push(1); });
    registerShutdownHandler(async () => { order.push(2); });
    registerShutdownHandler(async () => { order.push(3); });
    setupGracefulShutdown(logger as never);

    const sigterm = signalHandlers['SIGTERM']?.[0];
    sigterm!();

    await vi.advanceTimersByTimeAsync(0);

    expect(order).toEqual([1, 2, 3]);
  });
});
