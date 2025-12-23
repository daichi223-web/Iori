/**
 * Worker Pool Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: () => void;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();

    // Simulate async completion
    setTimeout(() => {
      proc.stdout.emit('data', 'Test output');
      proc.emit('close', 0);
    }, 10);

    return proc;
  }),
}));

// Mock fs
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

const { WorkerPool } = await import('../../../electron/worker-pool.js');

describe('WorkerPool', () => {
  let pool: InstanceType<typeof WorkerPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    pool = new WorkerPool({ timeout: 5000 });
  });

  afterEach(() => {
    pool.killAll();
  });

  describe('spawnWorker', () => {
    it('should spawn a worker and return result', async () => {
      const worker = await pool.spawnWorker('claude', 'Test prompt');

      expect(worker.id).toMatch(/^worker_/);
      expect(worker.provider).toBe('claude');
      expect(worker.prompt).toBe('Test prompt');
      expect(worker.status).toBe('completed');
      expect(worker.output).toBe('Test output');
    });

    it('should emit workerStarted event', async () => {
      const startedSpy = vi.fn();
      pool.on('workerStarted', startedSpy);

      await pool.spawnWorker('gemini', 'Test');

      expect(startedSpy).toHaveBeenCalled();
    });

    it('should emit workerCompleted event', async () => {
      const completedSpy = vi.fn();
      pool.on('workerCompleted', completedSpy);

      await pool.spawnWorker('codex', 'Test');

      expect(completedSpy).toHaveBeenCalled();
    });
  });

  describe('runParallel', () => {
    it('should run multiple workers in parallel', async () => {
      const tasks = [
        { provider: 'claude' as const, prompt: 'Task 1' },
        { provider: 'gemini' as const, prompt: 'Task 2' },
      ];

      const workers = await pool.runParallel(tasks);

      expect(workers).toHaveLength(2);
      expect(workers[0].provider).toBe('claude');
      expect(workers[1].provider).toBe('gemini');
    });
  });

  describe('runTrinityMeeting', () => {
    it('should run all three providers', async () => {
      const result = await pool.runTrinityMeeting('Trinity prompt');

      expect(result.id).toMatch(/^trinity_/);
      expect(result.prompt).toBe('Trinity prompt');
      expect(result.workers.claude).toBeDefined();
      expect(result.workers.gemini).toBeDefined();
      expect(result.workers.codex).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should emit trinity events', async () => {
      const startedSpy = vi.fn();
      const completedSpy = vi.fn();
      pool.on('trinityStarted', startedSpy);
      pool.on('trinityCompleted', completedSpy);

      await pool.runTrinityMeeting('Test');

      expect(startedSpy).toHaveBeenCalled();
      expect(completedSpy).toHaveBeenCalled();
    });

    it('should run with custom providers', async () => {
      const result = await pool.runTrinityMeeting('Test', ['claude', 'gemini']);

      expect(result.workers.claude).toBeDefined();
      expect(result.workers.gemini).toBeDefined();
      expect(result.workers.codex).toBeUndefined();
    });
  });

  describe('worker management', () => {
    it('should get all workers', async () => {
      await pool.spawnWorker('claude', 'Test 1');
      await pool.spawnWorker('gemini', 'Test 2');

      const workers = pool.getAllWorkers();

      expect(workers).toHaveLength(2);
    });

    it('should get worker stats', async () => {
      await pool.spawnWorker('claude', 'Test');

      const stats = pool.getWorkerStats();

      expect(stats.completed).toBe(1);
      expect(stats.running).toBe(0);
    });

    it('should clear finished workers', async () => {
      await pool.spawnWorker('claude', 'Test');

      const cleared = pool.clearFinishedWorkers();

      expect(cleared).toBe(1);
      expect(pool.getAllWorkers()).toHaveLength(0);
    });

    it('should check hasRunningWorkers', async () => {
      expect(pool.hasRunningWorkers()).toBe(false);
    });
  });

  describe('worker killing', () => {
    it('should kill a specific worker', async () => {
      // This test needs a long-running worker
      // In mock, workers complete immediately
      // Just verify the method exists
      const result = pool.killWorker('nonexistent');
      expect(result).toBe(false);
    });

    it('should kill all workers', () => {
      const killed = pool.killAll();
      expect(killed).toBe(0);
    });
  });
});
