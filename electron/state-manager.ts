/**
 * Iori v4.0 - State Manager
 * @module electron/state-manager
 *
 * Manages project state persistence in .iori/project.json
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

/** Task status */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** Task definition */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  provider?: 'claude' | 'gemini' | 'codex';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/** DoD (Definition of Done) item */
export interface DoDItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: string;
}

/** Project state schema */
export interface ProjectState {
  version: string;
  projectName: string;
  currentPrompt?: string;
  currentPhase: 'idle' | 'planning' | 'implementing' | 'testing' | 'reviewing';
  tasks: Task[];
  dod: DoDItem[];
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    trinityMeetings: number;
    totalTasks: number;
    completedTasks: number;
  };
}

/** State Manager configuration */
interface StateManagerConfig {
  baseDir: string;
  autoSave: boolean;
  autoSaveInterval: number;
}

const DEFAULT_CONFIG: StateManagerConfig = {
  baseDir: '.iori',
  autoSave: true,
  autoSaveInterval: 30000, // 30 seconds
};

/**
 * Creates default project state
 */
function createDefaultState(): ProjectState {
  const now = new Date().toISOString();
  return {
    version: '4.0.0',
    projectName: 'Iori Project',
    currentPhase: 'idle',
    tasks: [],
    dod: [],
    progress: {
      total: 0,
      completed: 0,
      percentage: 0,
    },
    lastActivity: now,
    createdAt: now,
    updatedAt: now,
    metadata: {
      trinityMeetings: 0,
      totalTasks: 0,
      completedTasks: 0,
    },
  };
}

/**
 * State Manager - Manages project state persistence
 */
export class StateManager extends EventEmitter {
  private config: StateManagerConfig;
  private state: ProjectState;
  private statePath: string;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private isDirty = false;

  constructor(config: Partial<StateManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = createDefaultState();
    this.statePath = path.join(process.cwd(), this.config.baseDir, 'project.json');
  }

  /**
   * Initialize state manager - load existing state or create new
   */
  async initialize(): Promise<void> {
    const baseDir = path.join(process.cwd(), this.config.baseDir);

    // Ensure directory exists
    await fs.mkdir(baseDir, { recursive: true });

    // Load existing state or create new
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      this.state = { ...createDefaultState(), ...JSON.parse(data) };
      this.emit('loaded', this.state);
    } catch {
      // File doesn't exist, use default state
      await this.save();
      this.emit('created', this.state);
    }

    // Start auto-save if enabled
    if (this.config.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      if (this.isDirty) {
        await this.save();
        this.isDirty = false;
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Save state to file
   */
  async save(): Promise<void> {
    this.state.updatedAt = new Date().toISOString();
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    this.emit('saved', this.state);
  }

  /**
   * Get current state (read-only copy)
   */
  getState(): Readonly<ProjectState> {
    return { ...this.state };
  }

  /**
   * Update state partially
   */
  async updateState(updates: Partial<ProjectState>): Promise<void> {
    this.state = {
      ...this.state,
      ...updates,
      lastActivity: new Date().toISOString(),
    };
    this.isDirty = true;
    this.emit('updated', this.state);
  }

  /**
   * Set current prompt
   */
  async setCurrentPrompt(prompt: string): Promise<void> {
    await this.updateState({ currentPrompt: prompt });
  }

  /**
   * Set current phase
   */
  async setPhase(phase: ProjectState['currentPhase']): Promise<void> {
    await this.updateState({ currentPhase: phase });
  }

  /**
   * Add a new task
   */
  async addTask(title: string, description?: string, provider?: Task['provider']): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      status: 'pending',
      provider,
      createdAt: now,
      updatedAt: now,
    };

    this.state.tasks.push(task);
    this.state.metadata.totalTasks++;
    this.updateProgress();
    this.isDirty = true;
    this.emit('taskAdded', task);

    return task;
  }

  /**
   * Update task status
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (!task) return null;

    const wasCompleted = task.status === 'completed';
    Object.assign(task, updates, { updatedAt: new Date().toISOString() });

    // Track completion
    if (!wasCompleted && task.status === 'completed') {
      task.completedAt = new Date().toISOString();
      this.state.metadata.completedTasks++;
    } else if (wasCompleted && task.status !== 'completed') {
      this.state.metadata.completedTasks--;
      task.completedAt = undefined;
    }

    this.updateProgress();
    this.isDirty = true;
    this.emit('taskUpdated', task);

    return task;
  }

  /**
   * Remove task
   */
  async removeTask(taskId: string): Promise<boolean> {
    const index = this.state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;

    const [task] = this.state.tasks.splice(index, 1);
    if (task.status === 'completed') {
      this.state.metadata.completedTasks--;
    }

    this.updateProgress();
    this.isDirty = true;
    this.emit('taskRemoved', taskId);

    return true;
  }

  /**
   * Add DoD item
   */
  async addDoDItem(description: string): Promise<DoDItem> {
    const item: DoDItem = {
      id: `dod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description,
      completed: false,
    };

    this.state.dod.push(item);
    this.updateProgress();
    this.isDirty = true;
    this.emit('dodAdded', item);

    return item;
  }

  /**
   * Update DoD item
   */
  async updateDoDItem(itemId: string, completed: boolean): Promise<DoDItem | null> {
    const item = this.state.dod.find(d => d.id === itemId);
    if (!item) return null;

    item.completed = completed;
    if (completed) {
      item.completedAt = new Date().toISOString();
    } else {
      item.completedAt = undefined;
    }

    this.updateProgress();
    this.isDirty = true;
    this.emit('dodUpdated', item);

    return item;
  }

  /**
   * Update progress calculation
   */
  private updateProgress(): void {
    const taskTotal = this.state.tasks.length;
    const taskCompleted = this.state.tasks.filter(t => t.status === 'completed').length;
    const dodTotal = this.state.dod.length;
    const dodCompleted = this.state.dod.filter(d => d.completed).length;

    const total = taskTotal + dodTotal;
    const completed = taskCompleted + dodCompleted;

    this.state.progress = {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Increment Trinity meeting count
   */
  async recordTrinityMeeting(): Promise<void> {
    this.state.metadata.trinityMeetings++;
    this.isDirty = true;
    await this.save();
  }

  /**
   * Get progress summary
   */
  getProgress(): ProjectState['progress'] {
    return { ...this.state.progress };
  }

  /**
   * Clear all tasks (reset)
   */
  async clearTasks(): Promise<void> {
    this.state.tasks = [];
    this.state.metadata.totalTasks = 0;
    this.state.metadata.completedTasks = 0;
    this.updateProgress();
    this.isDirty = true;
    this.emit('tasksCleared');
  }

  /**
   * Export state as JSON string
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Cleanup - stop timers and save final state
   */
  async cleanup(): Promise<void> {
    this.stopAutoSave();
    if (this.isDirty) {
      await this.save();
    }
  }
}

// Singleton instance
let stateManagerInstance: StateManager | null = null;

/**
 * Get State Manager singleton
 */
export function getStateManager(): StateManager {
  if (!stateManagerInstance) {
    stateManagerInstance = new StateManager();
  }
  return stateManagerInstance;
}
