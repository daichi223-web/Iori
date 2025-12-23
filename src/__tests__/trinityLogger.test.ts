/**
 * @file trinityLogger.test.ts
 * @description Trinity AI System Logger Tests (TDD: RED phase)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TrinityLogger,
  LogLevel,
  AIProvider
} from '../core/trinityLogger.js';

describe('TrinityLogger', () => {
  let logger: TrinityLogger;

  beforeEach(() => {
    logger = new TrinityLogger();
  });

  describe('Basic Logging', () => {
    it('should create log entries with correct structure', () => {
      const entry = logger.log('CLAUDE', 'INFO', 'Processing task...');

      expect(entry).toMatchObject({
        provider: 'CLAUDE',
        level: 'INFO',
        message: 'Processing task...'
      });
      expect(entry.timestamp).toBeDefined();
      expect(entry.id).toBeDefined();
    });

    it('should support all three AI providers', () => {
      const providers: AIProvider[] = ['CLAUDE', 'GEMINI', 'CODEX'];

      providers.forEach(provider => {
        const entry = logger.log(provider, 'INFO', 'Test message');
        expect(entry.provider).toBe(provider);
      });
    });

    it('should support SYSTEM as a provider for test results', () => {
      const entry = logger.log('SYSTEM', 'TEST', 'Running npm test...');
      expect(entry.provider).toBe('SYSTEM');
      expect(entry.level).toBe('TEST');
    });
  });

  describe('Log Levels', () => {
    it('should support all required log levels', () => {
      const levels: LogLevel[] = ['INFO', 'PLAN', 'CODE', 'TEST', 'SUCCESS', 'ERROR', 'WARN'];

      levels.forEach(level => {
        const entry = logger.log('CLAUDE', level, 'Test');
        expect(entry.level).toBe(level);
      });
    });
  });

  describe('Log History', () => {
    it('should store logs in history', () => {
      logger.log('CLAUDE', 'INFO', 'First');
      logger.log('GEMINI', 'PLAN', 'Second');
      logger.log('CODEX', 'CODE', 'Third');

      const history = logger.getHistory();
      expect(history).toHaveLength(3);
    });

    it('should return logs in chronological order', () => {
      logger.log('CLAUDE', 'INFO', 'First');
      logger.log('GEMINI', 'PLAN', 'Second');

      const history = logger.getHistory();
      expect(history[0].message).toBe('First');
      expect(history[1].message).toBe('Second');
    });

    it('should limit history size to prevent memory issues', () => {
      const maxSize = 1000;
      for (let i = 0; i < maxSize + 100; i++) {
        logger.log('CLAUDE', 'INFO', `Message ${i}`);
      }

      const history = logger.getHistory();
      expect(history.length).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      logger.log('CLAUDE', 'INFO', 'Claude info');
      logger.log('GEMINI', 'PLAN', 'Gemini plan');
      logger.log('CODEX', 'CODE', 'Codex code');
      logger.log('SYSTEM', 'TEST', 'Test passed');
      logger.log('CLAUDE', 'ERROR', 'Claude error');
    });

    it('should filter by provider', () => {
      const claudeLogs = logger.filterByProvider('CLAUDE');
      expect(claudeLogs).toHaveLength(2);
      claudeLogs.forEach(log => expect(log.provider).toBe('CLAUDE'));
    });

    it('should filter by level', () => {
      const errorLogs = logger.filterByLevel('ERROR');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Claude error');
    });
  });

  describe('TDD Workflow Logging', () => {
    it('should log test failure (RED phase)', () => {
      const entry = logger.testFailed('implementation error', 'src/utils/math.ts');

      expect(entry.provider).toBe('SYSTEM');
      expect(entry.level).toBe('ERROR');
      expect(entry.message).toContain('implementation error');
      expect(entry.metadata?.file).toBe('src/utils/math.ts');
    });

    it('should log test success (GREEN phase)', () => {
      const entry = logger.testPassed('All 5 tests passed');

      expect(entry.provider).toBe('SYSTEM');
      expect(entry.level).toBe('SUCCESS');
      expect(entry.message).toContain('5 tests passed');
    });

    it('should log fix attempt', () => {
      const entry = logger.fixAttempt('CLAUDE', 'Fixing type error...');

      expect(entry.provider).toBe('CLAUDE');
      expect(entry.level).toBe('CODE');
      expect(entry.message).toContain('Fixing');
    });
  });

  describe('Provider Activity Logging', () => {
    it('should log GEMINI analysis phase', () => {
      const entry = logger.geminiAnalyze('Parsing task requirements...');

      expect(entry.provider).toBe('GEMINI');
      expect(entry.level).toBe('PLAN');
    });

    it('should log CODEX implementation phase', () => {
      const entry = logger.codexImplement('Writing function body...');

      expect(entry.provider).toBe('CODEX');
      expect(entry.level).toBe('CODE');
    });

    it('should log CLAUDE orchestration', () => {
      const entry = logger.claudeOrchestrate('Delegating to Gemini...');

      expect(entry.provider).toBe('CLAUDE');
      expect(entry.level).toBe('INFO');
    });
  });

  describe('Serialization', () => {
    it('should serialize log entry to JSON-friendly format', () => {
      const entry = logger.log('CLAUDE', 'INFO', 'Test message');
      const serialized = logger.serialize(entry);

      expect(typeof serialized).toBe('object');
      expect(serialized.timestamp).toBeDefined();
      expect(serialized.provider).toBe('CLAUDE');
    });

    it('should format log for console output with colors', () => {
      const entry = logger.log('GEMINI', 'PLAN', 'Analyzing...');
      const formatted = logger.formatForConsole(entry);

      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('GEMINI');
      expect(formatted).toContain('PLAN');
    });
  });

  describe('Event Emission', () => {
    it('should emit events when logs are added', () => {
      const callback = vi.fn();
      logger.onLog(callback);

      logger.log('CLAUDE', 'INFO', 'Test');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'CLAUDE',
        message: 'Test'
      }));
    });

    it('should allow multiple listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      logger.onLog(callback1);
      logger.onLog(callback2);

      logger.log('GEMINI', 'PLAN', 'Test');

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});
