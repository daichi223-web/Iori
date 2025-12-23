/**
 * @file trinityLogger.ts
 * @description Trinity AI System Logger - Unified logging for CLAUDE/GEMINI/CODEX
 * @design Provides structured, color-coded logs for multi-AI orchestration visibility
 */
import chalk from 'chalk';

/** AI Provider types including SYSTEM for test results */
export type AIProvider = 'CLAUDE' | 'GEMINI' | 'CODEX' | 'SYSTEM';

/** Log levels for different activities */
export type LogLevel = 'INFO' | 'PLAN' | 'CODE' | 'TEST' | 'SUCCESS' | 'ERROR' | 'WARN';

/** Structured log entry */
export interface LogEntry {
  id: string;
  timestamp: string;
  provider: AIProvider;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Color mapping for providers */
const PROVIDER_COLORS: Record<AIProvider, (text: string) => string> = {
  CLAUDE: chalk.magenta,
  GEMINI: chalk.blue,
  CODEX: chalk.green,
  SYSTEM: chalk.yellow
};

/** Color mapping for levels */
const LEVEL_COLORS: Record<LogLevel, (text: string) => string> = {
  INFO: chalk.white,
  PLAN: chalk.cyan,
  CODE: chalk.green,
  TEST: chalk.yellow,
  SUCCESS: chalk.greenBright,
  ERROR: chalk.red,
  WARN: chalk.yellow
};

/** Emoji mapping for levels */
const LEVEL_EMOJI: Record<LogLevel, string> = {
  INFO: 'i',
  PLAN: '📋',
  CODE: '💻',
  TEST: '🧪',
  SUCCESS: '✅',
  ERROR: '❌',
  WARN: '⚠️'
};

type LogCallback = (entry: LogEntry) => void;

/**
 * TrinityLogger - Centralized logging for multi-AI system
 * Provides visibility into which AI is working and what phase (TDD) is active
 */
export class TrinityLogger {
  private history: LogEntry[] = [];
  private readonly maxHistorySize = 1000;
  private listeners: LogCallback[] = [];

  /**
   * Generate unique ID for log entry
   */
  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Create and store a log entry
   */
  log(provider: AIProvider, level: LogLevel, message: string, metadata?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      provider,
      level,
      message,
      metadata
    };

    this.history.push(entry);

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    // Notify listeners
    this.listeners.forEach(cb => cb(entry));

    return entry;
  }

  /**
   * Get full log history
   */
  getHistory(): LogEntry[] {
    return [...this.history];
  }

  /**
   * Filter logs by provider
   */
  filterByProvider(provider: AIProvider): LogEntry[] {
    return this.history.filter(entry => entry.provider === provider);
  }

  /**
   * Filter logs by level
   */
  filterByLevel(level: LogLevel): LogEntry[] {
    return this.history.filter(entry => entry.level === level);
  }

  // === TDD Workflow Helpers ===

  /**
   * Log test failure (RED phase)
   */
  testFailed(error: string, file?: string): LogEntry {
    return this.log('SYSTEM', 'ERROR', `[TEST] Failed: ${error}`, { file });
  }

  /**
   * Log test success (GREEN phase)
   */
  testPassed(summary: string): LogEntry {
    return this.log('SYSTEM', 'SUCCESS', `[TEST] ${summary}`);
  }

  /**
   * Log fix attempt
   */
  fixAttempt(provider: AIProvider, action: string): LogEntry {
    return this.log(provider, 'CODE', `🔄 ${action}`);
  }

  // === Provider-specific Helpers ===

  /**
   * Log GEMINI analysis phase
   */
  geminiAnalyze(task: string): LogEntry {
    return this.log('GEMINI', 'PLAN', `📊 ${task}`);
  }

  /**
   * Log CODEX implementation phase
   */
  codexImplement(action: string): LogEntry {
    return this.log('CODEX', 'CODE', `⚙️ ${action}`);
  }

  /**
   * Log CLAUDE orchestration
   */
  claudeOrchestrate(action: string): LogEntry {
    return this.log('CLAUDE', 'INFO', `🎯 ${action}`);
  }

  // === Serialization ===

  /**
   * Serialize log entry to plain object
   */
  serialize(entry: LogEntry): Record<string, unknown> {
    return { ...entry };
  }

  /**
   * Format log for console output with colors
   */
  formatForConsole(entry: LogEntry): string {
    const providerColor = PROVIDER_COLORS[entry.provider];
    const levelColor = LEVEL_COLORS[entry.level];
    const emoji = LEVEL_EMOJI[entry.level];

    const timestamp = chalk.gray(entry.timestamp.slice(11, 19));
    const provider = providerColor(`[${entry.provider}]`);
    const level = levelColor(`[${entry.level}]`);

    return `${timestamp} ${provider} ${level} ${emoji} ${entry.message}`;
  }

  // === Event System ===

  /**
   * Register callback for new log entries
   */
  onLog(callback: LogCallback): void {
    this.listeners.push(callback);
  }

  /**
   * Remove callback
   */
  offLog(callback: LogCallback): void {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
  }
}

// Singleton instance for global access
export const trinityLogger = new TrinityLogger();
