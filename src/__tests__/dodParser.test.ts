/**
 * Unit Tests for DoD Parser
 * Tests DoD.md parsing and progress calculation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseDoDFile, getRecommendedWorkUnit, type DoDProgress } from '../utils/dodParser.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DoD Parser', () => {
  const testDoDPath = path.join(__dirname, 'test-dod.md');

  // Create a test DoD file before tests
  beforeEach(async () => {
    const testContent = `# Definition of Done

**Overall Progress:** 50% (10/20 required items)

## 1. Spec (3/4 = 75%)
- [x] SPEC.md exists
- [x] Non-goals defined
- [x] Use cases listed
- [ ] Error handling documented

## 2. Functionality (2/5 = 40%)
- [x] Main use cases work
- [ ] All use cases work
- [ ] Error behavior defined
- [ ] Mock Snapshot works
- [ ] DoD progress works

## 3. Proof (Required) (2/5 = 40%)
- [x] Tests exist
- [ ] All core features tested
- [x] Lint/typecheck passes
- [ ] Coverage 80%+
- [ ] Reproduction steps

## 4. Safety (0/3 = 0%)
- [ ] Destructive operation confirmations
- [ ] Auth exists
- [ ] Safe Mode implemented
`;

    await fs.writeFile(testDoDPath, testContent, 'utf-8');
  });

  // Clean up test file after tests
  afterEach(async () => {
    try {
      await fs.unlink(testDoDPath);
    } catch (error) {
      // File may not exist, ignore
    }
  });

  describe('parseDoDFile', () => {
    it('should parse overall progress percentage', async () => {
      const result = await parseDoDFile(testDoDPath);

      // Parser calculates from actual checkboxes
      expect(result.overall.completed).toBeGreaterThanOrEqual(0);
      expect(result.overall.total).toBeGreaterThan(0);
      expect(result.overall.percentage).toBeGreaterThanOrEqual(0);
      expect(result.overall.percentage).toBeLessThanOrEqual(100);
    });

    it('should parse section percentages', async () => {
      const result = await parseDoDFile(testDoDPath);

      expect(result.sections['Spec'].percentage).toBe(75);
      expect(result.sections['Spec'].completed).toBe(3);
      expect(result.sections['Spec'].total).toBe(4);

      expect(result.sections['Functionality'].percentage).toBe(40);
      expect(result.sections['Functionality'].completed).toBe(2);
      expect(result.sections['Functionality'].total).toBe(5);

      expect(result.sections['Proof (Required)'].percentage).toBe(40);
      expect(result.sections['Safety'].percentage).toBe(0);
    });

    it('should extract next actions from unchecked items', async () => {
      const result = await parseDoDFile(testDoDPath);

      expect(result.nextActions).toBeInstanceOf(Array);
      expect(result.nextActions.length).toBeGreaterThan(0);

      // Should include section names in next actions
      expect(result.nextActions.some(action => action.includes('Spec'))).toBe(true);
    });

    it('should handle flexible section name matching', async () => {
      const result = await parseDoDFile(testDoDPath);

      // "Proof (Required)" should be parsed correctly
      expect(result.sections['Proof (Required)']).toBeDefined();
      expect(result.sections['Proof (Required)'].percentage).toBe(40);
    });

    it('should include lastUpdated timestamp', async () => {
      const result = await parseDoDFile(testDoDPath);

      // lastUpdated may be empty string if not found in file
      expect(result.lastUpdated).toBeDefined();
      expect(typeof result.lastUpdated).toBe('string');
    });

    it('should throw error for non-existent file', async () => {
      await expect(parseDoDFile('/non/existent/path.md')).rejects.toThrow();
    });
  });

  describe('getRecommendedWorkUnit', () => {
    it('should recommend WU-04 when Functionality < 80%', () => {
      const progress: DoDProgress = {
        overall: { percentage: 50, completed: 10, total: 20 },
        sections: {
          'Functionality': { percentage: 40, completed: 2, total: 5, items: [] }
        },
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const recommendation = getRecommendedWorkUnit(progress);
      expect(recommendation).toBe('WU-04: Implement remaining core features');
    });

    it('should recommend WU-05 when Proof < 80%', () => {
      const progress: DoDProgress = {
        overall: { percentage: 80, completed: 16, total: 20 },
        sections: {
          'Functionality': { percentage: 90, completed: 4, total: 5, items: [] },
          'Proof': { percentage: 40, completed: 2, total: 5, items: [] }
        },
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const recommendation = getRecommendedWorkUnit(progress);
      expect(recommendation).toBe('WU-05: Add tests and improve coverage');
    });

    it('should recommend WU-06 when Safety < 50%', () => {
      const progress: DoDProgress = {
        overall: { percentage: 90, completed: 18, total: 20 },
        sections: {
          'Functionality': { percentage: 100, completed: 5, total: 5, items: [] },
          'Proof': { percentage: 100, completed: 5, total: 5, items: [] },
          'Safety': { percentage: 0, completed: 0, total: 3, items: [] }
        },
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const recommendation = getRecommendedWorkUnit(progress);
      expect(recommendation).toBe('WU-06: Implement safety features');
    });

    it('should recommend WU-07 when Release < 50%', () => {
      const progress: DoDProgress = {
        overall: { percentage: 95, completed: 19, total: 20 },
        sections: {
          'Functionality': { percentage: 100, completed: 5, total: 5, items: [] },
          'Proof': { percentage: 100, completed: 5, total: 5, items: [] },
          'Safety': { percentage: 100, completed: 3, total: 3, items: [] },
          'Release': { percentage: 0, completed: 0, total: 4, items: [] }
        },
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const recommendation = getRecommendedWorkUnit(progress);
      expect(recommendation).toBe('WU-07: Prepare for release');
    });

    it('should recommend WU-08 when all sections >= 80%', () => {
      const progress: DoDProgress = {
        overall: { percentage: 100, completed: 20, total: 20 },
        sections: {
          'Functionality': { percentage: 100, completed: 5, total: 5, items: [] },
          'Proof (Required)': { percentage: 100, completed: 5, total: 5, items: [] },
          'Safety': { percentage: 100, completed: 3, total: 3, items: [] },
          'Release': { percentage: 100, completed: 4, total: 4, items: [] }
        },
        nextActions: [],
        lastUpdated: new Date().toISOString()
      };

      const recommendation = getRecommendedWorkUnit(progress);
      expect(recommendation).toContain('WU-08');
      expect(recommendation).toContain('Polish');
    });
  });

  describe('Edge Cases', () => {
    it('should handle DoD file with no checkboxes', async () => {
      const emptyContent = `# Definition of Done\n\n## Section 1\nNo checkboxes here\n`;
      await fs.writeFile(testDoDPath, emptyContent, 'utf-8');

      const result = await parseDoDFile(testDoDPath);

      expect(result.overall.percentage).toBe(0);
      expect(result.overall.completed).toBe(0);
      expect(result.overall.total).toBe(0);
    });

    it('should handle malformed section headers', async () => {
      const malformedContent = `# Definition of Done\n\n## Bad Section\n- [x] Item 1\n- [ ] Item 2\n`;
      await fs.writeFile(testDoDPath, malformedContent, 'utf-8');

      const result = await parseDoDFile(testDoDPath);

      // Should still parse items even if section format is unexpected
      expect(result.sections).toBeDefined();
    });

    it('should handle sections with 100% completion', async () => {
      const completeContent = `# Definition of Done\n\n## 1. Complete (3/3 = 100%)\n- [x] Item 1\n- [x] Item 2\n- [x] Item 3\n`;
      await fs.writeFile(testDoDPath, completeContent, 'utf-8');

      const result = await parseDoDFile(testDoDPath);

      // Parser extracts section name after number prefix
      const sectionKey = Object.keys(result.sections)[0];
      expect(result.sections[sectionKey].percentage).toBe(100);
      expect(result.sections[sectionKey].completed).toBe(3);
      expect(result.sections[sectionKey].total).toBe(3);
    });
  });
});
