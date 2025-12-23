/**
 * Iori v4.0 - DoD (Definition of Done) Manager
 * @module electron/dod-manager
 *
 * Manages DOD.md file parsing, progress tracking, and updates
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

/** DoD item */
export interface DoDItem {
  id: string;
  text: string;
  checked: boolean;
  section: string;
}

/** DoD section */
export interface DoDSection {
  name: string;
  items: DoDItem[];
  completed: number;
  total: number;
  percentage: number;
}

/** Overall DoD progress */
export interface DoDProgress {
  overall: {
    completed: number;
    total: number;
    percentage: number;
  };
  sections: DoDSection[];
  nextActions: string[];
  recommendedWU: string;
  lastUpdated: string;
  filePath: string;
}

/** DoD Manager configuration */
interface DoDManagerConfig {
  dodFilePath: string;
  autoReload: boolean;
  reloadInterval: number;
}

const DEFAULT_CONFIG: DoDManagerConfig = {
  dodFilePath: 'DOD.md',
  autoReload: true,
  reloadInterval: 5000, // 5 seconds
};

/**
 * Default DOD.md template
 */
const DEFAULT_DOD_TEMPLATE = `# Definition of Done - Iori v4.0

**Last Updated:** ${new Date().toISOString().split('T')[0]}

## 1. Spec (0/4 = 0%)
- [ ] Requirements documented
- [ ] Architecture designed
- [ ] API defined
- [ ] User stories created

## 2. Functionality (0/5 = 0%)
- [ ] Core features implemented
- [ ] CLI integration working
- [ ] State management functional
- [ ] Logging system active
- [ ] DoD tracking enabled

## 3. Proof (0/4 = 0%)
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Coverage > 80%
- [ ] Manual testing done

## 4. Safety (0/3 = 0%)
- [ ] Input validation
- [ ] Error handling
- [ ] Security review

## 5. Release (0/3 = 0%)
- [ ] Documentation complete
- [ ] Changelog updated
- [ ] Build verified
`;

/**
 * DoD Manager - Manages Definition of Done
 */
export class DoDManager extends EventEmitter {
  private config: DoDManagerConfig;
  private progress: DoDProgress | null = null;
  private reloadTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<DoDManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize DoD Manager
   */
  async initialize(): Promise<void> {
    const dodPath = path.join(process.cwd(), this.config.dodFilePath);

    // Create DOD.md if it doesn't exist
    try {
      await fs.access(dodPath);
    } catch {
      await fs.writeFile(dodPath, DEFAULT_DOD_TEMPLATE, 'utf-8');
      this.emit('created', dodPath);
    }

    // Initial load
    await this.reload();

    // Start auto-reload if enabled
    if (this.config.autoReload) {
      this.startAutoReload();
    }
  }

  /**
   * Start auto-reload timer
   */
  private startAutoReload(): void {
    this.reloadTimer = setInterval(async () => {
      await this.reload();
    }, this.config.reloadInterval);
  }

  /**
   * Stop auto-reload
   */
  stopAutoReload(): void {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  /**
   * Reload and parse DOD.md
   */
  async reload(): Promise<DoDProgress> {
    const dodPath = path.join(process.cwd(), this.config.dodFilePath);

    try {
      const content = await fs.readFile(dodPath, 'utf-8');
      this.progress = this.parseDoD(content, dodPath);
      this.emit('reloaded', this.progress);
      return this.progress;
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', err);
      throw new Error(`Failed to load DOD.md: ${err}`);
    }
  }

  /**
   * Parse DOD.md content
   */
  private parseDoD(content: string, filePath: string): DoDProgress {
    const lines = content.split('\n');
    const sections: DoDSection[] = [];
    let currentSection: DoDSection | null = null;
    let itemCounter = 0;
    let lastUpdated = '';

    // Extract last updated date
    const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*(.+)/);
    if (lastUpdatedMatch) {
      lastUpdated = lastUpdatedMatch[1].trim();
    }

    for (const line of lines) {
      // Section header detection (e.g., "## 1. Spec (0/4 = 0%)")
      const sectionMatch = line.match(/^##\s+\d+\.\s+(.+?)\s*\(/);
      if (sectionMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          name: sectionMatch[1].trim(),
          items: [],
          completed: 0,
          total: 0,
          percentage: 0,
        };
        continue;
      }

      // Checkbox detection
      const checkboxMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)/);
      if (checkboxMatch && currentSection) {
        const checked = checkboxMatch[1].toLowerCase() === 'x';
        const text = checkboxMatch[2].trim();

        currentSection.items.push({
          id: `dod_${++itemCounter}`,
          text,
          checked,
          section: currentSection.name,
        });

        currentSection.total++;
        if (checked) currentSection.completed++;
      }
    }

    // Push last section
    if (currentSection) {
      sections.push(currentSection);
    }

    // Calculate percentages
    let totalCompleted = 0;
    let totalItems = 0;

    for (const section of sections) {
      section.percentage = section.total > 0
        ? Math.round((section.completed / section.total) * 100)
        : 0;
      totalCompleted += section.completed;
      totalItems += section.total;
    }

    // Get next actions (top 3 uncompleted items)
    const nextActions: string[] = [];
    for (const section of sections) {
      for (const item of section.items) {
        if (!item.checked && nextActions.length < 3) {
          nextActions.push(`[${section.name}] ${item.text}`);
        }
      }
    }

    // Get recommended work unit
    const recommendedWU = this.getRecommendedWU(sections);

    return {
      overall: {
        completed: totalCompleted,
        total: totalItems,
        percentage: totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0,
      },
      sections,
      nextActions,
      recommendedWU,
      lastUpdated,
      filePath,
    };
  }

  /**
   * Get recommended work unit based on progress
   */
  private getRecommendedWU(sections: DoDSection[]): string {
    const findSection = (name: string) =>
      sections.find(s => s.name.toLowerCase().includes(name.toLowerCase()));

    const spec = findSection('Spec');
    const func = findSection('Functionality');
    const proof = findSection('Proof');
    const safety = findSection('Safety');
    const release = findSection('Release');

    if (spec && spec.percentage < 80) {
      return 'WU-01: Complete specifications and design';
    }
    if (func && func.percentage < 80) {
      return 'WU-02: Implement core functionality';
    }
    if (proof && proof.percentage < 80) {
      return 'WU-03: Add tests and improve coverage';
    }
    if (safety && safety.percentage < 80) {
      return 'WU-04: Implement safety features';
    }
    if (release && release.percentage < 80) {
      return 'WU-05: Prepare for release';
    }

    return 'WU-06: Polish and documentation';
  }

  /**
   * Get current progress (cached)
   */
  getProgress(): DoDProgress | null {
    return this.progress;
  }

  /**
   * Toggle item checked state
   */
  async toggleItem(itemId: string): Promise<DoDProgress | null> {
    if (!this.progress) return null;

    // Find item
    let targetItem: DoDItem | null = null;
    for (const section of this.progress.sections) {
      const item = section.items.find(i => i.id === itemId);
      if (item) {
        targetItem = item;
        break;
      }
    }

    if (!targetItem) return null;

    // Update file
    const dodPath = path.join(process.cwd(), this.config.dodFilePath);
    const content = await fs.readFile(dodPath, 'utf-8');

    // Find and replace the checkbox
    const escapedText = targetItem.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oldPattern = new RegExp(
      `- \\[${targetItem.checked ? 'x' : ' '}\\] ${escapedText}`,
      'i'
    );
    const newCheckbox = `- [${targetItem.checked ? ' ' : 'x'}] ${targetItem.text}`;

    const newContent = content.replace(oldPattern, newCheckbox);

    // Update last updated date
    const today = new Date().toISOString().split('T')[0];
    const updatedContent = newContent.replace(
      /\*\*Last Updated:\*\*\s*.+/,
      `**Last Updated:** ${today}`
    );

    await fs.writeFile(dodPath, updatedContent, 'utf-8');

    // Reload and return
    return this.reload();
  }

  /**
   * Add new item to a section
   */
  async addItem(sectionName: string, text: string): Promise<DoDProgress | null> {
    const dodPath = path.join(process.cwd(), this.config.dodFilePath);
    const content = await fs.readFile(dodPath, 'utf-8');

    // Find section and add item
    const sectionPattern = new RegExp(
      `(##\\s+\\d+\\.\\s+${sectionName}[^#]+)`,
      'i'
    );

    const match = content.match(sectionPattern);
    if (!match) return null;

    const sectionContent = match[1];
    const newItem = `- [ ] ${text}\n`;

    // Add before next section or end
    const newSectionContent = sectionContent.trimEnd() + '\n' + newItem + '\n';
    const newContent = content.replace(sectionContent, newSectionContent);

    // Update counts in section header
    // This is complex, so we'll just update and let reload recalculate

    await fs.writeFile(dodPath, newContent, 'utf-8');
    return this.reload();
  }

  /**
   * Check if DoD is complete (100%)
   */
  isComplete(): boolean {
    return this.progress?.overall.percentage === 100;
  }

  /**
   * Get completion status message
   */
  getStatusMessage(): string {
    if (!this.progress) return 'DoD not loaded';

    const { overall } = this.progress;

    if (overall.percentage === 100) {
      return 'All DoD items completed! Ready for release.';
    }

    if (overall.percentage >= 80) {
      return `Almost there! ${overall.completed}/${overall.total} items complete.`;
    }

    if (overall.percentage >= 50) {
      return `Good progress: ${overall.percentage}% complete.`;
    }

    return `${overall.percentage}% complete. Focus on: ${this.progress.recommendedWU}`;
  }

  /**
   * Export progress as JSON
   */
  exportProgress(): string {
    return JSON.stringify(this.progress, null, 2);
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopAutoReload();
  }
}

// Singleton instance
let dodManagerInstance: DoDManager | null = null;

/**
 * Get DoD Manager singleton
 */
export function getDoDManager(): DoDManager {
  if (!dodManagerInstance) {
    dodManagerInstance = new DoDManager();
  }
  return dodManagerInstance;
}
