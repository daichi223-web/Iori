/**
 * State Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn(),
  },
}));

// Import after mocking
const { StateManager } = await import('../../../electron/state-manager.js');

describe('StateManager', () => {
  let stateManager: InstanceType<typeof StateManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateManager = new StateManager({ autoSave: false });
  });

  afterEach(() => {
    stateManager.stopAutoSave();
  });

  describe('initialize', () => {
    it('should create default state when file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await stateManager.initialize();

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should load existing state from file', async () => {
      const existingState = {
        version: '4.0.0',
        projectName: 'Test Project',
        currentPhase: 'implementing',
        tasks: [],
        dod: [],
        progress: { total: 0, completed: 0, percentage: 0 },
        lastActivity: '2025-01-01',
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        metadata: { trinityMeetings: 5, totalTasks: 10, completedTasks: 5 },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingState));

      await stateManager.initialize();
      const state = stateManager.getState();

      expect(state.projectName).toBe('Test Project');
      expect(state.metadata.trinityMeetings).toBe(5);
    });
  });

  describe('task management', () => {
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await stateManager.initialize();
    });

    it('should add a new task', async () => {
      const task = await stateManager.addTask('Test Task', 'Description', 'claude');

      expect(task.id).toMatch(/^task_/);
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('Description');
      expect(task.provider).toBe('claude');
      expect(task.status).toBe('pending');
    });

    it('should update task status', async () => {
      const task = await stateManager.addTask('Test Task');
      const updated = await stateManager.updateTask(task.id, { status: 'completed' });

      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeDefined();
    });

    it('should remove task', async () => {
      const task = await stateManager.addTask('Test Task');
      const removed = await stateManager.removeTask(task.id);

      expect(removed).toBe(true);
      expect(stateManager.getState().tasks).toHaveLength(0);
    });

    it('should track completed tasks in metadata', async () => {
      const task = await stateManager.addTask('Test Task');
      await stateManager.updateTask(task.id, { status: 'completed' });

      const state = stateManager.getState();
      expect(state.metadata.completedTasks).toBe(1);
    });
  });

  describe('DoD management', () => {
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await stateManager.initialize();
    });

    it('should add DoD item', async () => {
      const item = await stateManager.addDoDItem('Test requirement');

      expect(item.id).toMatch(/^dod_/);
      expect(item.description).toBe('Test requirement');
      expect(item.completed).toBe(false);
    });

    it('should update DoD item', async () => {
      const item = await stateManager.addDoDItem('Test requirement');
      const updated = await stateManager.updateDoDItem(item.id, true);

      expect(updated?.completed).toBe(true);
      expect(updated?.completedAt).toBeDefined();
    });
  });

  describe('progress calculation', () => {
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await stateManager.initialize();
    });

    it('should calculate progress correctly', async () => {
      await stateManager.addTask('Task 1');
      const task2 = await stateManager.addTask('Task 2');
      await stateManager.updateTask(task2.id, { status: 'completed' });

      await stateManager.addDoDItem('DoD 1');
      const dod2 = await stateManager.addDoDItem('DoD 2');
      await stateManager.updateDoDItem(dod2.id, true);

      const progress = stateManager.getProgress();

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(2);
      expect(progress.percentage).toBe(50);
    });
  });

  describe('phase management', () => {
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
      await stateManager.initialize();
    });

    it('should set current phase', async () => {
      await stateManager.setPhase('implementing');
      expect(stateManager.getState().currentPhase).toBe('implementing');
    });

    it('should set current prompt', async () => {
      await stateManager.setCurrentPrompt('Build a feature');
      expect(stateManager.getState().currentPrompt).toBe('Build a feature');
    });
  });
});
