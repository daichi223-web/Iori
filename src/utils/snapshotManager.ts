/**
 * Mock Snapshot Manager
 * Handles creation and management of mock snapshots for review
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { parseDoDFile, type DoDProgress } from './dodParser.js';

const execPromise = promisify(exec);

// Re-export DoDProgress for tests
export type { DoDProgress };

export interface SnapshotMeta {
  id: string;
  label: string;
  commit: string;
  dod: {
    overall: string;
    spec: string;
    functionality: string;
    proof: string;
    safety: string;
    release: string;
  };
  newFeatures: string[];
  knownIssues: string[];
  createdAt: string;
}

export interface CreateSnapshotOptions {
  label: string;
  newFeatures?: string[];
  knownIssues?: string[];
  dodProgress?: DoDProgress;
}

/**
 * Helper function to get section percentage by partial name match
 */
function getSectionPercentage(sections: Record<string, DoDProgress['sections'][string]>, partialName: string): number {
  // Try exact match first
  if (sections[partialName]) {
    return sections[partialName].percentage;
  }
  // Try partial match (e.g., "Proof" matches "Proof (Required)")
  const matchingKey = Object.keys(sections).find(key =>
    key.toLowerCase().startsWith(partialName.toLowerCase())
  );
  return matchingKey ? sections[matchingKey].percentage : 0;
}

/**
 * Create a new mock snapshot
 */
export async function createSnapshot(
  projectRoot: string,
  options: CreateSnapshotOptions
): Promise<SnapshotMeta> {
  try {
    // Get current git commit
    const { stdout: commitHash } = await execPromise('git rev-parse HEAD', { cwd: projectRoot });
    const commit = commitHash.trim().substring(0, 7);

    // Get DoD progress
    let dodProgress: DoDProgress;
    if (options.dodProgress) {
      dodProgress = options.dodProgress;
    } else {
      const dodPath = path.join(projectRoot, 'DOD.md');
      dodProgress = await parseDoDFile(dodPath);
    }

    // Generate snapshot ID
    const mockDir = path.join(projectRoot, 'mock');
    await fs.mkdir(mockDir, { recursive: true });

    const existingSnapshots = await listSnapshots(projectRoot);
    const nextNumber = existingSnapshots.length + 1;
    const snapshotId = `mock-${String(nextNumber).padStart(3, '0')}`;

    // Sanitize label for folder name
    const sanitizedLabel = options.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .substring(0, 30);
    const snapshotFolder = `${String(nextNumber).padStart(3, '0')}_${sanitizedLabel}`;
    const snapshotPath = path.join(mockDir, snapshotFolder);

    // Create snapshot directory
    await fs.mkdir(snapshotPath, { recursive: true });

    // Create meta.json with flexible section name matching
    const meta: SnapshotMeta = {
      id: snapshotId,
      label: options.label,
      commit,
      dod: {
        overall: `${dodProgress.overall.percentage}%`,
        spec: `${getSectionPercentage(dodProgress.sections, 'Spec')}%`,
        functionality: `${getSectionPercentage(dodProgress.sections, 'Functionality')}%`,
        proof: `${getSectionPercentage(dodProgress.sections, 'Proof')}%`,
        safety: `${getSectionPercentage(dodProgress.sections, 'Safety')}%`,
        release: `${getSectionPercentage(dodProgress.sections, 'Release')}%`
      },
      newFeatures: options.newFeatures || [],
      knownIssues: options.knownIssues || [],
      createdAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(snapshotPath, 'meta.json'),
      JSON.stringify(meta, null, 2),
      'utf-8'
    );

    // Create README.md
    const readme = `# ${meta.label}

**Snapshot ID:** ${meta.id}
**Commit:** ${meta.commit}
**Created:** ${meta.createdAt}

## DoD Progress

- Overall: ${meta.dod.overall}
- Spec: ${meta.dod.spec}
- Functionality: ${meta.dod.functionality}
- Proof: ${meta.dod.proof}
- Safety: ${meta.dod.safety}
- Release: ${meta.dod.release}

## New Features

${meta.newFeatures.length > 0 ? meta.newFeatures.map(f => `- ${f}`).join('\n') : '- None'}

## Known Issues

${meta.knownIssues.length > 0 ? meta.knownIssues.map(i => `- ${i}`).join('\n') : '- None'}

## Rollback Command

\`\`\`bash
git reset --hard ${meta.commit}
npm install
\`\`\`
`;

    await fs.writeFile(
      path.join(snapshotPath, 'README.md'),
      readme,
      'utf-8'
    );

    return meta;
  } catch (error) {
    throw new Error(`Failed to create snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * List all mock snapshots
 */
export async function listSnapshots(projectRoot: string): Promise<SnapshotMeta[]> {
  try {
    const mockDir = path.join(projectRoot, 'mock');

    try {
      await fs.access(mockDir);
    } catch {
      // Mock directory doesn't exist yet
      return [];
    }

    const entries = await fs.readdir(mockDir, { withFileTypes: true });
    const snapshots: SnapshotMeta[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = path.join(mockDir, entry.name, 'meta.json');
        try {
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const meta: SnapshotMeta = JSON.parse(metaContent);
          snapshots.push(meta);
        } catch {
          // Skip folders without valid meta.json
        }
      }
    }

    // Sort by creation date (newest first)
    snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return snapshots;
  } catch (error) {
    throw new Error(`Failed to list snapshots: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a specific snapshot by ID
 */
export async function getSnapshot(projectRoot: string, snapshotId: string): Promise<SnapshotMeta | null> {
  const snapshots = await listSnapshots(projectRoot);
  return snapshots.find(s => s.id === snapshotId) || null;
}

/**
 * Check if snapshot should be auto-created based on DoD progress
 */
export function shouldAutoCreateSnapshot(
  currentProgress: DoDProgress,
  lastSnapshotProgress?: DoDProgress
): boolean {
  if (!lastSnapshotProgress) {
    // First snapshot (MVP completed)
    return currentProgress.overall.percentage >= 40;
  }

  // Auto-create if DoD progress increased by 20% or more
  const progressIncrease = currentProgress.overall.percentage - lastSnapshotProgress.overall.percentage;
  return progressIncrease >= 20;
}
