import { promises as fs } from 'fs';
import path from 'path';

/**
 * Memory entry types representing different kinds of memories
 */
export type MemoryType = 'error' | 'success' | 'learning' | 'pattern' | 'solution';

/**
 * Metadata for memory entries
 */
export interface MemoryMetadata {
  source?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  relatedIds?: string[];
  context?: Record<string, unknown>;
}

/**
 * A single memory entry in the long-term memory system
 */
export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: MemoryType;
  content: string;
  tags: string[];
  metadata: MemoryMetadata;
}

/**
 * Search options for querying memories
 */
export interface SearchOptions {
  types?: MemoryType[];
  tags?: string[];
  startTime?: number;
  endTime?: number;
  limit?: number;
  minScore?: number;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  entry: MemoryEntry;
  score: number;
}

/**
 * Generate a unique ID for memory entries
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `mem_${timestamp}_${random}`;
}

/**
 * Calculate similarity score between two strings using word overlap
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }
  
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }
  
  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate tag overlap score
 */
function calculateTagScore(tags1: string[], tags2: string[]): number {
  if (tags1.length === 0 || tags2.length === 0) {
    return 0;
  }
  
  const set1 = new Set(tags1.map(t => t.toLowerCase()));
  const set2 = new Set(tags2.map(t => t.toLowerCase()));
  
  let intersection = 0;
  for (const tag of set1) {
    if (set2.has(tag)) {
      intersection++;
    }
  }
  
  return intersection / Math.max(set1.size, set2.size);
}

/**
 * Long-term memory manager for Iori
 * Persists memories to .iori/memories/ directory
 */
export class MemoryStore {
  private readonly memoriesDir: string;
  private cache: Map<string, MemoryEntry> = new Map();
  private initialized = false;

  constructor(baseDir: string = process.cwd()) {
    this.memoriesDir = path.join(baseDir, '.iori', 'memories');
  }

  /**
   * Initialize the memory store directory
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await fs.mkdir(this.memoriesDir, { recursive: true });
      await this.loadAllMemories();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize memory store: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load all memories from disk into cache
   */
  private async loadAllMemories(): Promise<void> {
    try {
      const files = await fs.readdir(this.memoriesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.memoriesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entry = JSON.parse(content) as MemoryEntry;
          this.cache.set(entry.id, entry);
        } catch {
          // Skip corrupted files
          console.warn(`Skipping corrupted memory file: ${file}`);
        }
      }
    } catch {
      // Directory might be empty, that's fine
    }
  }

  /**
   * Get the file path for a memory entry
   */
  private getFilePath(id: string): string {
    return path.join(this.memoriesDir, `${id}.json`);
  }

  /**
   * Save a memory entry to persistent storage
   */
  async save(entry: Omit<MemoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): Promise<MemoryEntry> {
    await this.ensureInitialized();

    const fullEntry: MemoryEntry = {
      id: entry.id ?? generateId(),
      timestamp: entry.timestamp ?? Date.now(),
      type: entry.type,
      content: entry.content,
      tags: entry.tags,
      metadata: entry.metadata,
    };

    try {
      const filePath = this.getFilePath(fullEntry.id);
      await fs.writeFile(filePath, JSON.stringify(fullEntry, null, 2), 'utf-8');
      this.cache.set(fullEntry.id, fullEntry);
      return fullEntry;
    } catch (error) {
      throw new Error(`Failed to save memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search memories by keywords, tags, or time range
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    await this.ensureInitialized();

    const {
      types,
      tags,
      startTime,
      endTime,
      limit = 10,
      minScore = 0.1,
    } = options;

    const results: SearchResult[] = [];
    const queryTags = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    for (const entry of this.cache.values()) {
      // Filter by type
      if (types && types.length > 0 && !types.includes(entry.type)) {
        continue;
      }

      // Filter by time range
      if (startTime && entry.timestamp < startTime) {
        continue;
      }
      if (endTime && entry.timestamp > endTime) {
        continue;
      }

      // Filter by tags
      if (tags && tags.length > 0) {
        const entryTagsLower = entry.tags.map(t => t.toLowerCase());
        const hasMatchingTag = tags.some(t => entryTagsLower.includes(t.toLowerCase()));
        if (!hasMatchingTag) {
          continue;
        }
      }

      // Calculate similarity score
      const contentScore = calculateSimilarity(query, entry.content);
      const tagScore = calculateTagScore(queryTags, entry.tags);
      const combinedScore = contentScore * 0.7 + tagScore * 0.3;

      if (combinedScore >= minScore) {
        results.push({ entry, score: combinedScore });
      }
    }

    // Sort by score descending and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Find relevant past experiences for current task context
   */
  async recall(context: string, options: { limit?: number; types?: MemoryType[] } = {}): Promise<SearchResult[]> {
    const { limit = 5, types } = options;

    // Search with lower threshold for broader recall
    const searchResults = await this.search(context, {
      types,
      limit: limit * 2,
      minScore: 0.05,
    });

    // Boost recent memories
    const now = Date.now();
    const boostedResults = searchResults.map(result => {
      const ageInDays = (now - result.entry.timestamp) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0, 1 - ageInDays / 30); // Decay over 30 days
      return {
        ...result,
        score: result.score * (1 + recencyBoost * 0.3),
      };
    });

    return boostedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get recent error patterns to avoid
   */
  async getRecentErrors(options: { limit?: number; daysBack?: number } = {}): Promise<MemoryEntry[]> {
    await this.ensureInitialized();

    const { limit = 10, daysBack = 7 } = options;
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    const errors: MemoryEntry[] = [];

    for (const entry of this.cache.values()) {
      if (entry.type === 'error' && entry.timestamp >= cutoffTime) {
        errors.push(entry);
      }
    }

    // Sort by timestamp descending (most recent first)
    return errors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get a memory by ID
   */
  async get(id: string): Promise<MemoryEntry | null> {
    await this.ensureInitialized();
    return this.cache.get(id) ?? null;
  }

  /**
   * Delete a memory by ID
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.cache.has(id)) {
      return false;
    }

    try {
      const filePath = this.getFilePath(id);
      await fs.unlink(filePath);
      this.cache.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all memories of a specific type
   */
  async getByType(type: MemoryType, options: { limit?: number } = {}): Promise<MemoryEntry[]> {
    await this.ensureInitialized();

    const { limit = 100 } = options;
    const entries: MemoryEntry[] = [];

    for (const entry of this.cache.values()) {
      if (entry.type === type) {
        entries.push(entry);
      }
    }

    return entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{ total: number; byType: Record<MemoryType, number> }> {
    await this.ensureInitialized();

    const byType: Record<MemoryType, number> = {
      error: 0,
      success: 0,
      learning: 0,
      pattern: 0,
      solution: 0,
    };

    for (const entry of this.cache.values()) {
      byType[entry.type]++;
    }

    return {
      total: this.cache.size,
      byType,
    };
  }

  /**
   * Clear all memories (use with caution)
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    try {
      const files = await fs.readdir(this.memoriesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.memoriesDir, file));
        }
      }
      this.cache.clear();
    } catch (error) {
      throw new Error(`Failed to clear memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Default singleton instance
export const memoryStore = new MemoryStore();