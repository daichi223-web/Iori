/**
 * DoD Manager Tests
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

const { DoDManager } = await import('../../../electron/dod-manager.js');

const SAMPLE_DOD = `# Definition of Done - Test

**Last Updated:** 2025-01-15

## 1. Spec (2/4 = 50%)
- [x] Requirements documented
- [x] Architecture designed
- [ ] API defined
- [ ] User stories created

## 2. Functionality (1/3 = 33%)
- [x] Core features implemented
- [ ] CLI integration working
- [ ] State management functional

## 3. Proof (0/2 = 0%)
- [ ] Unit tests passing
- [ ] Integration tests passing
`;

describe('DoDManager', () => {
  let manager: InstanceType<typeof DoDManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new DoDManager({ autoReload: false });
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('initialize', () => {
    it('should create default DOD.md if not exists', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));
      // After creating, it will try to read the default template
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_DOD);

      await manager.initialize();

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should load existing DOD.md', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_DOD);

      await manager.initialize();
      const progress = manager.getProgress();

      expect(progress).toBeDefined();
      expect(progress?.sections).toHaveLength(3);
    });
  });

  describe('parsing', () => {
    beforeEach(async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_DOD);
      await manager.initialize();
    });

    it('should parse sections correctly', () => {
      const progress = manager.getProgress();

      expect(progress?.sections[0].name).toBe('Spec');
      expect(progress?.sections[1].name).toBe('Functionality');
      expect(progress?.sections[2].name).toBe('Proof');
    });

    it('should calculate section progress', () => {
      const progress = manager.getProgress();

      expect(progress?.sections[0].completed).toBe(2);
      expect(progress?.sections[0].total).toBe(4);
      expect(progress?.sections[0].percentage).toBe(50);
    });

    it('should calculate overall progress', () => {
      const progress = manager.getProgress();

      // 3 completed out of 9 total
      expect(progress?.overall.completed).toBe(3);
      expect(progress?.overall.total).toBe(9);
      expect(progress?.overall.percentage).toBe(33);
    });

    it('should extract last updated date', () => {
      const progress = manager.getProgress();

      expect(progress?.lastUpdated).toBe('2025-01-15');
    });

    it('should identify next actions', () => {
      const progress = manager.getProgress();

      expect(progress?.nextActions.length).toBeLessThanOrEqual(3);
      expect(progress?.nextActions[0]).toContain('Spec');
    });

    it('should provide recommended work unit', () => {
      const progress = manager.getProgress();

      expect(progress?.recommendedWU).toBeDefined();
      expect(progress?.recommendedWU).toMatch(/^WU-/);
    });
  });

  describe('isComplete', () => {
    it('should return false when not complete', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_DOD);
      await manager.initialize();

      expect(manager.isComplete()).toBe(false);
    });

    it('should return true when 100% complete', async () => {
      const completeDod = `# DoD
**Last Updated:** 2025-01-15

## 1. Test (2/2 = 100%)
- [x] Item 1
- [x] Item 2
`;
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(completeDod);
      await manager.initialize();

      expect(manager.isComplete()).toBe(true);
    });
  });

  describe('getStatusMessage', () => {
    it('should return status message', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_DOD);
      await manager.initialize();

      const message = manager.getStatusMessage();

      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });
  });

  describe('toggleItem', () => {
    it('should toggle item and update file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_DOD);
      await manager.initialize();

      const progress = manager.getProgress();
      const itemId = progress?.sections[0].items[2].id; // "API defined" (unchecked)

      if (itemId) {
        await manager.toggleItem(itemId);
        expect(fs.writeFile).toHaveBeenCalled();
      }
    });
  });

  describe('exportProgress', () => {
    it('should export progress as JSON', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(SAMPLE_DOD);
      await manager.initialize();

      const exported = manager.exportProgress();
      const parsed = JSON.parse(exported);

      expect(parsed.overall).toBeDefined();
      expect(parsed.sections).toBeDefined();
    });
  });
});
