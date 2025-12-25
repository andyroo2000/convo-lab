import { vi } from 'vitest';

// Type for captured worker processor
export type WorkerProcessor = (job: MockJob) => Promise<unknown>;

// Mock job class for testing
export interface MockJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  updateProgress: ReturnType<typeof vi.fn>;
}

// Store for captured worker processors and event handlers
export const workerProcessors = new Map<string, WorkerProcessor>();
export const workerEventHandlers = new Map<string, Map<string, (...args: unknown[]) => void>>();

// Create a mock job for testing
export const createMockJob = (overrides: Partial<MockJob> = {}): MockJob => ({
  id: 'test-job-123',
  name: 'default',
  data: {},
  updateProgress: vi.fn(),
  ...overrides,
});

// Mock Queue class fns
export const mockQueueAdd = vi.fn();
export const mockQueueGetJob = vi.fn();
export const mockQueueClose = vi.fn();

// Mock Queue class - use actual class for proper constructor behavior
export class MockQueue {
  name: string;

  add = mockQueueAdd;

  getJob = mockQueueGetJob;

  close = mockQueueClose;

  constructor(name: string, _options?: unknown) {
    this.name = name;
  }
}

// Mock Worker class that captures processor and event handlers
export class MockWorker {
  name: string;

  close = vi.fn();

  private eventHandlers = new Map<string, (...args: unknown[]) => void>();

  constructor(name: string, processor: WorkerProcessor, _options?: unknown) {
    this.name = name;
    workerProcessors.set(name, processor);
    workerEventHandlers.set(name, this.eventHandlers);
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    this.eventHandlers.set(event, handler);
    return this;
  }
}

// Helper to get the captured processor for a queue
export const getWorkerProcessor = (queueName: string): WorkerProcessor | undefined => workerProcessors.get(queueName);

// Helper to trigger event handlers
export const triggerWorkerEvent = (queueName: string, event: string, ...args: unknown[]): void => {
  const handlers = workerEventHandlers.get(queueName);
  const handler = handlers?.get(event);
  if (handler) {
    handler(...args);
  }
};

// Helper to simulate job processing
export const processJob = async (queueName: string, job: MockJob): Promise<unknown> => {
  const processor = workerProcessors.get(queueName);
  if (!processor) {
    throw new Error(`No processor found for queue: ${queueName}`);
  }
  return processor(job);
};

// Reset all mock state
export const resetBullMQMocks = (): void => {
  workerProcessors.clear();
  workerEventHandlers.clear();
  mockQueueAdd.mockClear();
  mockQueueGetJob.mockClear();
  mockQueueClose.mockClear();
};

// Mock Redis connection
export const mockRedisConnection = {
  disconnect: vi.fn(),
  quit: vi.fn(),
};

export const mockCreateRedisConnection = vi.fn().mockReturnValue(mockRedisConnection);

export const mockDefaultWorkerSettings = {
  autorun: true,
  concurrency: 1,
  lockDuration: 300000,
  drainDelay: 30000,
};
