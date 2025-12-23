/**
 * Iori v4.0 - CLI Bridge
 * @module electron/cli-bridge
 *
 * Manages communication with AI CLI tools (Claude, Gemini, Codex)
 * using child_process for cross-platform compatibility.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

/** Supported AI providers */
export type AIProvider = 'claude' | 'gemini' | 'codex';

/** CLI execution result */
export interface CLIResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number | null;
  provider: AIProvider;
  duration: number;
}

/** CLI session for streaming */
export interface CLISession {
  id: string;
  provider: AIProvider;
  process: ChildProcess;
  startTime: number;
}

/** CLI Bridge configuration */
interface CLIBridgeConfig {
  timeout: number;
  maxBuffer: number;
  tempDir: string;
}

const DEFAULT_CONFIG: CLIBridgeConfig = {
  timeout: 120000,      // 2 minutes
  maxBuffer: 1024 * 1024 * 10, // 10MB
  tempDir: '.iori_temp',
};

/**
 * CLI Bridge - Manages AI CLI communication
 */
export class CLIBridge extends EventEmitter {
  private config: CLIBridgeConfig;
  private activeSessions: Map<string, CLISession> = new Map();
  private sessionCounter = 0;

  constructor(config: Partial<CLIBridgeConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get CLI command for provider
   */
  private getCommand(provider: AIProvider): { cmd: string; args: string[] } {
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
   * Check if CLI tool is available
   */
  async checkAvailability(provider: AIProvider): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const cmd = provider === 'codex' ? 'codex' : provider;
      const proc = spawn(cmd, ['--version'], {
        shell: true,
        timeout: 5000,
      });

      let output = '';
      let error = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            available: true,
            version: output.trim().split('\n')[0],
          });
        } else {
          resolve({
            available: false,
            error: error || `Exit code: ${code}`,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          available: false,
          error: err.message,
        });
      });
    });
  }

  /**
   * Execute prompt via CLI (non-streaming)
   */
  async execute(
    provider: AIProvider,
    prompt: string
  ): Promise<CLIResult> {
    const startTime = Date.now();
    const { cmd, args } = this.getCommand(provider);

    // Create temp file for prompt
    const tempDir = path.join(process.cwd(), this.config.tempDir);
    await fs.mkdir(tempDir, { recursive: true });
    const tempFile = path.join(tempDir, `prompt_${Date.now()}.txt`);
    await fs.writeFile(tempFile, prompt, 'utf-8');

    return new Promise((resolve) => {
      // Build command with pipe
      const shellCmd = process.platform === 'win32'
        ? `type "${tempFile}" | ${cmd} ${args.join(' ')}`
        : `cat "${tempFile}" | ${cmd} ${args.join(' ')}`;

      const proc = spawn(shellCmd, [], {
        shell: true,
        timeout: this.config.timeout,
      });

      let output = '';
      let error = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', async (code) => {
        // Cleanup temp file
        await fs.unlink(tempFile).catch(() => {});

        resolve({
          success: code === 0 || output.length > 0,
          output: output.trim(),
          error: error || undefined,
          exitCode: code,
          provider,
          duration: Date.now() - startTime,
        });
      });

      proc.on('error', async (err) => {
        await fs.unlink(tempFile).catch(() => {});

        resolve({
          success: false,
          output: '',
          error: err.message,
          exitCode: null,
          provider,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Start streaming session
   */
  startStream(
    provider: AIProvider,
    prompt: string
  ): string {
    const sessionId = `session_${++this.sessionCounter}_${Date.now()}`;
    const { cmd, args } = this.getCommand(provider);

    // Create temp file synchronously for streaming
    const tempDir = path.join(process.cwd(), this.config.tempDir);
    const tempFile = path.join(tempDir, `stream_${sessionId}.txt`);

    // Write prompt to file
    fs.mkdir(tempDir, { recursive: true })
      .then(() => fs.writeFile(tempFile, prompt, 'utf-8'))
      .then(() => {
        // Start process after file is written
        const shellCmd = process.platform === 'win32'
          ? `type "${tempFile}" | ${cmd} ${args.join(' ')}`
          : `cat "${tempFile}" | ${cmd} ${args.join(' ')}`;

        const proc = spawn(shellCmd, [], {
          shell: true,
          timeout: this.config.timeout,
        });

        const session: CLISession = {
          id: sessionId,
          provider,
          process: proc,
          startTime: Date.now(),
        };

        this.activeSessions.set(sessionId, session);

        proc.stdout?.on('data', (data) => {
          this.emit('output', sessionId, data.toString());
        });

        proc.stderr?.on('data', (data) => {
          this.emit('error', sessionId, data.toString());
        });

        proc.on('close', (code) => {
          const duration = Date.now() - session.startTime;
          this.emit('close', sessionId, code, duration);
          this.activeSessions.delete(sessionId);

          // Cleanup
          fs.unlink(tempFile).catch(() => {});
        });

        proc.on('error', (err) => {
          this.emit('error', sessionId, err.message);
          this.activeSessions.delete(sessionId);

          // Cleanup
          fs.unlink(tempFile).catch(() => {});
        });

        this.emit('start', sessionId, provider);
      })
      .catch((err) => {
        this.emit('error', sessionId, `Failed to create temp file: ${err.message}`);
      });

    return sessionId;
  }

  /**
   * Write to active session stdin
   */
  writeToSession(sessionId: string, data: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.process.stdin) {
      return false;
    }

    session.process.stdin.write(data);
    return true;
  }

  /**
   * Kill active session
   */
  killSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.process.kill('SIGTERM');
    this.activeSessions.delete(sessionId);
    return true;
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): CLISession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Kill all active sessions
   */
  killAllSessions(): void {
    for (const session of this.activeSessions.values()) {
      session.process.kill('SIGTERM');
    }
    this.activeSessions.clear();
  }

  /**
   * Check all providers availability
   */
  async checkAllProviders(): Promise<Record<AIProvider, { available: boolean; version?: string; error?: string }>> {
    const providers: AIProvider[] = ['claude', 'gemini', 'codex'];
    const results: Record<string, { available: boolean; version?: string; error?: string }> = {};

    await Promise.all(
      providers.map(async (provider) => {
        results[provider] = await this.checkAvailability(provider);
      })
    );

    return results as Record<AIProvider, { available: boolean; version?: string; error?: string }>;
  }
}

// Singleton instance
let bridgeInstance: CLIBridge | null = null;

/**
 * Get CLI Bridge singleton
 */
export function getCLIBridge(): CLIBridge {
  if (!bridgeInstance) {
    bridgeInstance = new CLIBridge();
  }
  return bridgeInstance;
}
