/**
 * Iori v4.0 - Log Manager
 * @module electron/log-manager
 *
 * Manages application logs in .iori/logs/
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

/** Log level */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

/** Log provider/source */
export type LogProvider = 'SYSTEM' | 'CLAUDE' | 'GEMINI' | 'CODEX' | 'KERNEL' | 'UI';

/** Log entry */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  provider: LogProvider;
  message: string;
  data?: Record<string, unknown>;
}

/** Log Manager configuration */
interface LogManagerConfig {
  baseDir: string;
  maxFileSize: number;      // Max size per log file (bytes)
  maxFiles: number;         // Max number of log files to keep
  consoleOutput: boolean;   // Also output to console
  memoryLimit: number;      // Max entries to keep in memory
}

const DEFAULT_CONFIG: LogManagerConfig = {
  baseDir: '.iori/logs',
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxFiles: 10,
  consoleOutput: true,
  memoryLimit: 500,
};

/**
 * Log Manager - Manages application logs
 */
export class LogManager extends EventEmitter {
  private config: LogManagerConfig;
  private logs: LogEntry[] = [];
  private currentLogFile: string = '';
  private logCounter = 0;

  constructor(config: Partial<LogManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize log manager
   */
  async initialize(): Promise<void> {
    const logsDir = path.join(process.cwd(), this.config.baseDir);
    await fs.mkdir(logsDir, { recursive: true });

    // Create new log file for this session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(logsDir, `iori_${timestamp}.log`);

    // Write session start marker
    await this.log('SYSTEM', 'INFO', '=== Iori Session Started ===');
    await this.log('SYSTEM', 'INFO', `Log file: ${this.currentLogFile}`);

    // Cleanup old log files
    await this.cleanupOldLogs();
  }

  /**
   * Log a message
   */
  async log(
    provider: LogProvider,
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): Promise<LogEntry> {
    const entry: LogEntry = {
      id: `log_${++this.logCounter}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      level,
      provider,
      message,
      data,
    };

    // Add to memory buffer
    this.logs.push(entry);
    if (this.logs.length > this.config.memoryLimit) {
      this.logs.shift();
    }

    // Console output
    if (this.config.consoleOutput) {
      const prefix = `[${entry.timestamp.slice(11, 19)}] [${provider}] [${level}]`;
      const fullMessage = `${prefix} ${message}`;

      switch (level) {
        case 'ERROR':
          console.error(fullMessage);
          break;
        case 'WARN':
          console.warn(fullMessage);
          break;
        case 'DEBUG':
          console.debug(fullMessage);
          break;
        default:
          console.log(fullMessage);
      }
    }

    // Write to file
    await this.writeToFile(entry);

    // Emit event
    this.emit('log', entry);

    return entry;
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(entry: LogEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';

    try {
      await fs.appendFile(this.currentLogFile, line, 'utf-8');

      // Check file size and rotate if needed
      const stats = await fs.stat(this.currentLogFile);
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLog();
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Rotate log file
   */
  private async rotateLog(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logsDir = path.join(process.cwd(), this.config.baseDir);
    this.currentLogFile = path.join(logsDir, `iori_${timestamp}.log`);

    await this.log('SYSTEM', 'INFO', '=== Log rotated ===');
  }

  /**
   * Cleanup old log files (keep only maxFiles)
   */
  private async cleanupOldLogs(): Promise<void> {
    const logsDir = path.join(process.cwd(), this.config.baseDir);

    try {
      const files = await fs.readdir(logsDir);
      const logFiles = files
        .filter(f => f.startsWith('iori_') && f.endsWith('.log'))
        .sort()
        .reverse();

      // Remove excess files
      if (logFiles.length > this.config.maxFiles) {
        const toRemove = logFiles.slice(this.config.maxFiles);
        for (const file of toRemove) {
          await fs.unlink(path.join(logsDir, file)).catch(() => {});
        }
      }
    } catch {
      // Directory doesn't exist yet, that's ok
    }
  }

  /**
   * Get recent logs from memory
   */
  getRecentLogs(limit = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get logs by provider
   */
  getLogsByProvider(provider: LogProvider, limit = 100): LogEntry[] {
    return this.logs
      .filter(l => l.provider === provider)
      .slice(-limit);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, limit = 100): LogEntry[] {
    return this.logs
      .filter(l => l.level === level)
      .slice(-limit);
  }

  /**
   * Search logs by message content
   */
  searchLogs(query: string, limit = 100): LogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs
      .filter(l => l.message.toLowerCase().includes(lowerQuery))
      .slice(-limit);
  }

  /**
   * Clear in-memory logs (file logs remain)
   */
  clearMemoryLogs(): void {
    this.logs = [];
    this.emit('cleared');
  }

  /**
   * Read logs from file
   */
  async readLogFile(filename?: string): Promise<LogEntry[]> {
    const filePath = filename
      ? path.join(process.cwd(), this.config.baseDir, filename)
      : this.currentLogFile;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as LogEntry);
    } catch {
      return [];
    }
  }

  /**
   * List available log files
   */
  async listLogFiles(): Promise<string[]> {
    const logsDir = path.join(process.cwd(), this.config.baseDir);

    try {
      const files = await fs.readdir(logsDir);
      return files
        .filter(f => f.startsWith('iori_') && f.endsWith('.log'))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  /**
   * Export all logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Convenience methods for different log levels
  debug(provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> {
    return this.log(provider, 'DEBUG', message, data);
  }

  info(provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> {
    return this.log(provider, 'INFO', message, data);
  }

  warn(provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> {
    return this.log(provider, 'WARN', message, data);
  }

  error(provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> {
    return this.log(provider, 'ERROR', message, data);
  }

  success(provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> {
    return this.log(provider, 'SUCCESS', message, data);
  }
}

// Singleton instance
let logManagerInstance: LogManager | null = null;

/**
 * Get Log Manager singleton
 */
export function getLogManager(): LogManager {
  if (!logManagerInstance) {
    logManagerInstance = new LogManager();
  }
  return logManagerInstance;
}
