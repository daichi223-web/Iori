/**
 * DOD.md Parser
 * Parses Definition of Done markdown file and calculates progress
 */

import fs from 'fs/promises';

export interface DoDSection {
  name: string;
  completed: number;
  total: number;
  percentage: number;
  items: DoDItem[];
}

export interface DoDItem {
  checked: boolean;
  text: string;
}

export interface DoDProgress {
  overall: {
    completed: number;
    total: number;
    percentage: number;
  };
  sections: Record<string, DoDSection>;
  nextActions: string[];
  lastUpdated: string;
}

/**
 * Parse DOD.md file and extract progress information
 */
export async function parseDoDFile(filePath: string): Promise<DoDProgress> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    let currentSection: string | null = null;
    const sections: Record<string, DoDSection> = {};
    let totalCompleted = 0;
    let totalItems = 0;
    let lastUpdated = '';

    // Extract last updated date
    const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*(.+)/);
    if (lastUpdatedMatch) {
      lastUpdated = lastUpdatedMatch[1].trim();
    }

    for (const line of lines) {
      // Section header detection (e.g., "## 1. Spec (3/4 = 75%)")
      const sectionMatch = line.match(/^##\s+\d+\.\s+(.+?)\s*\((\d+)\/(\d+)/);
      if (sectionMatch) {
        const sectionName = sectionMatch[1].trim();
        const completed = parseInt(sectionMatch[2], 10);
        const total = parseInt(sectionMatch[3], 10);
        currentSection = sectionName;
        sections[sectionName] = {
          name: sectionName,
          completed,
          total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          items: []
        };
        continue;
      }

      // Checkbox detection (e.g., "- [x] Item" or "- [ ] Item")
      const checkboxMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/);
      if (checkboxMatch && currentSection && sections[currentSection]) {
        const checked = checkboxMatch[1] === 'x';
        const text = checkboxMatch[2].trim();
        sections[currentSection].items.push({ checked, text });

        totalItems++;
        if (checked) totalCompleted++;
      }
    }

    // Calculate next actions (top 3 uncompleted items)
    const nextActions: string[] = [];
    for (const section of Object.values(sections)) {
      for (const item of section.items) {
        if (!item.checked && nextActions.length < 3) {
          nextActions.push(`[${section.name}] ${item.text}`);
        }
      }
    }

    return {
      overall: {
        completed: totalCompleted,
        total: totalItems,
        percentage: totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0
      },
      sections,
      nextActions,
      lastUpdated
    };
  } catch (error) {
    throw new Error(`Failed to parse DOD.md: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get recommended Work Unit based on current progress
 */
export function getRecommendedWorkUnit(progress: DoDProgress): string {
  // Priority: Functionality > Proof > Safety > Release
  const { sections } = progress;

  if (sections['Functionality'] && sections['Functionality'].percentage < 80) {
    return 'WU-04: Implement remaining core features';
  }

  if (sections['Proof'] && sections['Proof'].percentage < 80) {
    return 'WU-05: Add tests and improve coverage';
  }

  if (sections['Safety'] && sections['Safety'].percentage < 50) {
    return 'WU-06: Implement safety features';
  }

  if (sections['Release'] && sections['Release'].percentage < 50) {
    return 'WU-07: Prepare for release';
  }

  return 'WU-08: Polish and documentation';
}
