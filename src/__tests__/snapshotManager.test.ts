/**
 * Unit Tests for Snapshot Manager
 * Tests snapshot creation, listing, and retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSnapshot, listSnapshots, getSnapshot, shouldAutoCreateSnapshot, type DoDProgress } from '../utils/snapshotManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Snapshot Manager', () => {
  const testProjectRoot = path.join(__dirname, 'test-project');
  const mockDir = path.join(testProjectRoot, 'mock');

  beforeEach(async () => {
    // Create test project directory
    await fs.mkdir(testProjectRoot, { recursive: true });
    await fs.mkdir(path.join(testProjectRoot, '.git'), { recursive: true });

    // Create a fake git commit
    const gitHeadPath = path.join(testProjectRoot, '.git', 'HEAD');
    await fs.writeFile(gitHeadPath, 'ref: refs/heads/main', 'utf-8');

    const gitRefsPath = path.join(testProjectRoot, '.git', 'refs', 'heads');
    await fs.mkdir(gitRefsPath, { recursive: true });
    await fs.writeFile(path.join(gitRefsPath, 'main'), 'abcdef1234567890abcdef1234567890abcdef12', 'utf-8');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testProjectRoot, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createSnapshot', () => {
    it('should create snapshot with valid metadata', async () => {
      const dodProgress: DoDProgress = {
        overall: { percentage: 50, completed: 10, total: 20 },
        sections: {
          'Spec': { name: 'Spec', percentage: 75, completed: 3, total: 4, items: [] },
          'Functionality': { name: 'Functionality', percentage: 40, completed: 2, total: 5, items: [] }
        },
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const snapshot = await createSnapshot(testProjectRoot, {
        label: 'Test Snapshot',
        newFeatures: ['Feature A', 'Feature B'],
        knownIssues: ['Bug 1'],
        dodProgress
      });

      expect(snapshot.id).toMatch(/^mock-\d{3}$/);
      expect(snapshot.label).toBe('Test Snapshot');
      expect(snapshot.commit).toHaveLength(7);
      expect(snapshot.dod.overall).toBe('50%');
      expect(snapshot.dod.spec).toBe('75%');
      expect(snapshot.dod.functionality).toBe('40%');
      expect(snapshot.newFeatures).toHaveLength(2);
      expect(snapshot.knownIssues).toHaveLength(1);
    });

    it('should create snapshot directory with correct structure', async () => {
      await createSnapshot(testProjectRoot, {
        label: 'Directory Test',
        dodProgress: {
          overall: { percentage: 30, completed: 6, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      const snapshotDir = await fs.readdir(mockDir);
      expect(snapshotDir.length).toBeGreaterThan(0);

      const firstSnapshot = snapshotDir[0];
      const metaPath = path.join(mockDir, firstSnapshot, 'meta.json');
      const readmePath = path.join(mockDir, firstSnapshot, 'README.md');

      const metaExists = await fs.access(metaPath).then(() => true).catch(() => false);
      const readmeExists = await fs.access(readmePath).then(() => true).catch(() => false);

      expect(metaExists).toBe(true);
      expect(readmeExists).toBe(true);
    });

    it('should sanitize label for folder name', async () => {
      await createSnapshot(testProjectRoot, {
        label: 'Test: Snapshot With Special/Characters!',
        dodProgress: {
          overall: { percentage: 0, completed: 0, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      const snapshotDirs = await fs.readdir(mockDir);
      const dirName = snapshotDirs[0];

      // Should not contain special characters
      expect(dirName).toMatch(/^\d{3}_test_snapshot_with_special_cha/);
    });

    it('should increment snapshot ID correctly', async () => {
      // Create first snapshot
      const snapshot1 = await createSnapshot(testProjectRoot, {
        label: 'First',
        dodProgress: {
          overall: { percentage: 0, completed: 0, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      // Create second snapshot
      const snapshot2 = await createSnapshot(testProjectRoot, {
        label: 'Second',
        dodProgress: {
          overall: { percentage: 0, completed: 0, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      expect(snapshot1.id).toBe('mock-001');
      expect(snapshot2.id).toBe('mock-002');
    });
  });

  describe('listSnapshots', () => {
    it('should return empty array when no snapshots exist', async () => {
      const snapshots = await listSnapshots(testProjectRoot);
      expect(snapshots).toEqual([]);
    });

    it('should list all snapshots sorted by creation date', async () => {
      // Create multiple snapshots with delays to ensure different timestamps
      await createSnapshot(testProjectRoot, {
        label: 'First',
        dodProgress: {
          overall: { percentage: 0, completed: 0, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await createSnapshot(testProjectRoot, {
        label: 'Second',
        dodProgress: {
          overall: { percentage: 0, completed: 0, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      const snapshots = await listSnapshots(testProjectRoot);

      expect(snapshots).toHaveLength(2);
      // Should be sorted newest first
      expect(snapshots[0].label).toBe('Second');
      expect(snapshots[1].label).toBe('First');
    });

    it('should skip folders without valid meta.json', async () => {
      // Create valid snapshot
      await createSnapshot(testProjectRoot, {
        label: 'Valid',
        dodProgress: {
          overall: { percentage: 0, completed: 0, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      // Create invalid folder
      await fs.mkdir(path.join(mockDir, 'invalid-folder'), { recursive: true });

      const snapshots = await listSnapshots(testProjectRoot);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].label).toBe('Valid');
    });
  });

  describe('getSnapshot', () => {
    it('should retrieve specific snapshot by ID', async () => {
      const created = await createSnapshot(testProjectRoot, {
        label: 'Test Retrieval',
        dodProgress: {
          overall: { percentage: 0, completed: 0, total: 20 },
          sections: {},
          nextActions: [],
          lastUpdated: new Date().toISOString()
        }
      });

      const retrieved = await getSnapshot(testProjectRoot, created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.label).toBe('Test Retrieval');
    });

    it('should return null for non-existent snapshot', async () => {
      const snapshot = await getSnapshot(testProjectRoot, 'mock-999');
      expect(snapshot).toBeNull();
    });
  });

  describe('shouldAutoCreateSnapshot', () => {
    it('should trigger on first snapshot at 40%+ progress', () => {
      const current: DoDProgress = {
        overall: { percentage: 45, completed: 9, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const should = shouldAutoCreateSnapshot(current);
      expect(should).toBe(true);
    });

    it('should not trigger on first snapshot below 40%', () => {
      const current: DoDProgress = {
        overall: { percentage: 35, completed: 7, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const should = shouldAutoCreateSnapshot(current);
      expect(should).toBe(false);
    });

    it('should trigger when progress increases by 20%+', () => {
      const current: DoDProgress = {
        overall: { percentage: 60, completed: 12, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const last: DoDProgress = {
        overall: { percentage: 40, completed: 8, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const should = shouldAutoCreateSnapshot(current, last);
      expect(should).toBe(true);
    });

    it('should not trigger when progress increases by <20%', () => {
      const current: DoDProgress = {
        overall: { percentage: 50, completed: 10, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const last: DoDProgress = {
        overall: { percentage: 40, completed: 8, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const should = shouldAutoCreateSnapshot(current, last);
      expect(should).toBe(false);
    });

    it('should trigger exactly at 20% increase threshold', () => {
      const current: DoDProgress = {
        overall: { percentage: 60, completed: 12, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const last: DoDProgress = {
        overall: { percentage: 40, completed: 8, total: 20 },
        sections: {},
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const should = shouldAutoCreateSnapshot(current, last);
      expect(should).toBe(true);
    });
  });
});
