/**
 * Iori v4.0 - Worker Pool
 * @module electron/worker-pool
 *
 * Manages parallel AI agent execution (Trinity Meeting support)
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/** AI Provider */
export type AIProvider = 'claude' | 'gemini' | 'codex';

/** Worker status */
export type WorkerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'killed';

/** Worker info */
export interface Worker {
  id: string;
  provider: AIProvider;
  status: WorkerStatus;
  prompt: string;
  output: string;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  exitCode?: number | null;
}

/** Trinity Meeting result */
export interface TrinityResult {
  id: string;
  prompt: string;
  startTime: number;
  endTime: number;
  duration: number;
  workers: {
    claude?: Worker;
    gemini?: Worker;
    codex?: Worker;
  };
  consensus?: string;
  success: boolean;
}

/** Worker Pool configuration */
interface WorkerPoolConfig {
  maxConcurrent: number;
  timeout: number;
  tempDir: string;
}

const DEFAULT_CONFIG: WorkerPoolConfig = {
  maxConcurrent: 3,
  timeout: 120000, // 2 minutes
  tempDir: '.iori_temp',
};

/**
 * Get CLI command for provider
 */
function getProviderCommand(provider: AIProvider): { cmd: string; args: string[] } {
  switch (provider) {
    case 'claude':
      return { cmd: 'claude', args: ['--print'] };
    case 'gemini':
      return { cmd: 'gemini', args: [] };
    case 'codex':
      return { cmd: 'codex', args: ['exec', '--skip-git-repo-check', '-'] };
  }
}

/**
 * Worker Pool - Manages parallel AI agent execution
 */
export class WorkerPool extends EventEmitter {
  private config: WorkerPoolConfig;
  private workers: Map<string, Worker> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private workerCounter = 0;
  private trinityCounter = 0;

  constructor(config: Partial<WorkerPoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker_${++this.workerCounter}_${Date.now()}`;
  }

  /**
   * Generate unique trinity ID
   */
  private generateTrinityId(): string {
    return `trinity_${++this.trinityCounter}_${Date.now()}`;
  }

  /**
   * Spawn a single worker
   */
  async spawnWorker(provider: AIProvider, prompt: string): Promise<Worker> {
    const id = this.generateWorkerId();
    const { cmd, args } = getProviderCommand(provider);

    const worker: Worker = {
      id,
      provider,
      status: 'running',
      prompt,
      output: '',
      startTime: Date.now(),
    };

    this.workers.set(id, worker);
    this.emit('workerStarted', worker);

    // Create temp file for prompt
    const tempDir = path.join(process.cwd(), this.config.tempDir);
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `prompt_${id}.txt`);
    await fs.writeFile(tempFile, prompt, 'utf-8');

    return new Promise((resolve) => {
      const shellCmd = process.platform === 'win32'
        ? `type "${tempFile}" | ${cmd} ${args.join(' ')}`
        : `cat "${tempFile}" | ${cmd} ${args.join(' ')}`;

      const proc = spawn(shellCmd, [], {
        shell: true,
        timeout: this.config.timeout,
      });

      this.processes.set(id, proc);

      proc.stdout?.on('data', (data) => {
        worker.output += data.toString();
        this.emit('workerOutput', id, data.toString());
      });

      proc.stderr?.on('data', (data) => {
        worker.error = (worker.error || '') + data.toString();
        this.emit('workerError', id, data.toString());
      });

      proc.on('close', async (code) => {
        worker.endTime = Date.now();
        worker.duration = worker.endTime - worker.startTime;
        worker.exitCode = code;
        worker.status = code === 0 || worker.output.length > 0 ? 'completed' : 'failed';

        this.processes.delete(id);
        await fs.unlink(tempFile).catch(() => {});

        this.emit('workerCompleted', worker);
        resolve(worker);
      });

      proc.on('error', async (err) => {
        worker.endTime = Date.now();
        worker.duration = worker.endTime - worker.startTime;
        worker.error = err.message;
        worker.status = 'failed';

        this.processes.delete(id);
        await fs.unlink(tempFile).catch(() => {});

        this.emit('workerCompleted', worker);
        resolve(worker);
      });
    });
  }

  /**
   * Run Trinity Meeting - Execute prompt on all 3 AI providers in parallel
   */
  async runTrinityMeeting(prompt: string, providers: AIProvider[] = ['claude', 'gemini', 'codex']): Promise<TrinityResult> {
    const trinityId = this.generateTrinityId();
    const startTime = Date.now();

    this.emit('trinityStarted', { id: trinityId, prompt, providers });

    // Spawn workers in parallel
    const workerPromises = providers.map(provider =>
      this.spawnWorker(provider, prompt).catch(err => ({
        id: `failed_${provider}`,
        provider,
        status: 'failed' as WorkerStatus,
        prompt,
        output: '',
        error: err.message,
        startTime,
        endTime: Date.now(),
        duration: 0,
      }))
    );

    const workers = await Promise.all(workerPromises);
    const endTime = Date.now();

    // Build result
    const result: TrinityResult = {
      id: trinityId,
      prompt,
      startTime,
      endTime,
      duration: endTime - startTime,
      workers: {},
      success: workers.some(w => w.status === 'completed'),
    };

    // Map workers by provider
    for (const worker of workers) {
      result.workers[worker.provider] = worker;
    }

    // Generate consensus (simple: use first successful output)
    const successfulWorkers = workers.filter(w => w.status === 'completed' && w.output);
    if (successfulWorkers.length > 0) {
      result.consensus = successfulWorkers[0].output;
    }

    this.emit('trinityCompleted', result);
    return result;
  }

  /**
   * Run multiple prompts in parallel
   */
  async runParallel(tasks: Array<{ provider: AIProvider; prompt: string }>): Promise<Worker[]> {
    const promises = tasks.map(task =>
      this.spawnWorker(task.provider, task.prompt)
    );
    return Promise.all(promises);
  }

  /**
   * Kill a specific worker
   */
  killWorker(workerId: string): boolean {
    const proc = this.processes.get(workerId);
    const worker = this.workers.get(workerId);

    if (!proc || !worker) return false;

    proc.kill('SIGTERM');
    worker.status = 'killed';
    worker.endTime = Date.now();
    worker.duration = worker.endTime - worker.startTime;

    this.processes.delete(workerId);
    this.emit('workerKilled', workerId);

    return true;
  }

  /**
   * Kill all running workers
   */
  killAll(): number {
    let killed = 0;

    for (const [id, proc] of this.processes) {
      proc.kill('SIGTERM');
      const worker = this.workers.get(id);
      if (worker) {
        worker.status = 'killed';
        worker.endTime = Date.now();
        worker.duration = worker.endTime - worker.startTime;
      }
      killed++;
    }

    this.processes.clear();
    this.emit('allKilled', killed);

    return killed;
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): Worker | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get running workers
   */
  getRunningWorkers(): Worker[] {
    return Array.from(this.workers.values()).filter(w => w.status === 'running');
  }

  /**
   * Get worker count by status
   */
  getWorkerStats(): Record<WorkerStatus, number> {
    const stats: Record<WorkerStatus, number> = {
      idle: 0,
      running: 0,
      completed: 0,
      failed: 0,
      killed: 0,
    };

    for (const worker of this.workers.values()) {
      stats[worker.status]++;
    }

    return stats;
  }

  /**
   * Clear completed/failed workers from memory
   */
  clearFinishedWorkers(): number {
    let cleared = 0;

    for (const [id, worker] of this.workers) {
      if (worker.status !== 'running') {
        this.workers.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Check if any workers are running
   */
  hasRunningWorkers(): boolean {
    return this.getRunningWorkers().length > 0;
  }

  /**
   * Wait for all workers to complete
   */
  async waitForAll(): Promise<Worker[]> {
    while (this.hasRunningWorkers()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.getAllWorkers();
  }
}

// Singleton instance
let workerPoolInstance: WorkerPool | null = null;

/**
 * Get Worker Pool singleton
 */
export function getWorkerPool(): WorkerPool {
  if (!workerPoolInstance) {
    workerPoolInstance = new WorkerPool();
  }
  return workerPoolInstance;
}
