/**
 * Iori v4.0 - Electron Preload Script
 * @module electron/preload
 *
 * Exposes secure IPC bridge to renderer process via contextBridge.
 * Following Electron security best practices.
 */

import { contextBridge, ipcRenderer } from 'electron';

/** AI Provider types */
type AIProvider = 'claude' | 'gemini' | 'codex';

/**
 * Platform information returned by the main process
 */
interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
}

/**
 * CLI execution result
 */
interface CLIResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number | null;
  provider: AIProvider;
  duration: number;
}

/**
 * CLI availability check result
 */
interface CLIAvailability {
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * Stream event data
 */
interface StreamStartEvent {
  sessionId: string;
  provider: AIProvider;
}

interface StreamOutputEvent {
  sessionId: string;
  data: string;
}

interface StreamErrorEvent {
  sessionId: string;
  error: string;
}

interface StreamCloseEvent {
  sessionId: string;
  code: number | null;
  duration: number;
}

/**
 * Active session info
 */
interface SessionInfo {
  id: string;
  provider: AIProvider;
  startTime: number;
}

/** Task status */
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/** Task definition */
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  provider?: AIProvider;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/** DoD item */
interface DoDItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: string;
}

/** Project state */
interface ProjectState {
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

/** Log level */
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

/** Log provider */
type LogProvider = 'SYSTEM' | 'CLAUDE' | 'GEMINI' | 'CODEX' | 'KERNEL' | 'UI';

/** Log entry */
interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  provider: LogProvider;
  message: string;
  data?: Record<string, unknown>;
}

/** DoD item */
interface DoDItemInfo {
  id: string;
  text: string;
  checked: boolean;
  section: string;
}

/** DoD section */
interface DoDSectionInfo {
  name: string;
  items: DoDItemInfo[];
  completed: number;
  total: number;
  percentage: number;
}

/** DoD progress */
interface DoDProgressInfo {
  overall: {
    completed: number;
    total: number;
    percentage: number;
  };
  sections: DoDSectionInfo[];
  nextActions: string[];
  recommendedWU: string;
  lastUpdated: string;
  filePath: string;
}

/** Git file status */
interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
  staged: boolean;
}

/** Git commit */
interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

/** Git branch */
interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

/** Git repo status */
interface GitRepoStatus {
  isRepo: boolean;
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  hasChanges: boolean;
  hasUntracked: boolean;
}

/** GitHub PR */
interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
  author: string;
  createdAt: string;
}

/** gh CLI status */
interface GhStatus {
  available: boolean;
  authenticated: boolean;
  user?: string;
}

/** Git repo info */
interface GitRepoInfo {
  name: string;
  owner: string;
  url: string;
  isPrivate: boolean;
}

/** Worker status */
type WorkerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'killed';

/** Worker info */
interface WorkerInfo {
  id: string;
  provider: AIProvider;
  status: WorkerStatus;
  prompt: string;
  output: string;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  exitCode?: number | null;
}

/** Trinity result */
interface TrinityResultInfo {
  id: string;
  prompt: string;
  startTime: number;
  endTime: number;
  duration: number;
  workers: {
    claude?: WorkerInfo;
    gemini?: WorkerInfo;
    codex?: WorkerInfo;
  };
  consensus?: string;
  success: boolean;
}

/** Worker stats */
interface WorkerStats {
  idle: number;
  running: number;
  completed: number;
  failed: number;
  killed: number;
}

/**
 * Iori API exposed to the renderer process
 */
const ioriApi = {
  /**
   * Get application version
   */
  getVersion: (): Promise<string> => {
    return ipcRenderer.invoke('app:version');
  },

  /**
   * Get platform information
   */
  getPlatform: (): Promise<PlatformInfo> => {
    return ipcRenderer.invoke('app:platform');
  },

  /**
   * Window controls
   */
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  },

  /**
   * CLI operations
   */
  cli: {
    /**
     * Execute prompt via AI CLI (non-streaming)
     */
    exec: (provider: AIProvider, prompt: string): Promise<CLIResult> => {
      return ipcRenderer.invoke('cli:exec', provider, prompt);
    },

    /**
     * Check if CLI tool is available
     */
    check: (provider: AIProvider): Promise<CLIAvailability> => {
      return ipcRenderer.invoke('cli:check', provider);
    },

    /**
     * Check all providers availability
     */
    checkAll: (): Promise<Record<AIProvider, CLIAvailability>> => {
      return ipcRenderer.invoke('cli:checkAll');
    },

    /**
     * Start streaming session
     */
    startStream: (provider: AIProvider, prompt: string): Promise<string> => {
      return ipcRenderer.invoke('cli:stream:start', provider, prompt);
    },

    /**
     * Kill streaming session
     */
    killStream: (sessionId: string): Promise<boolean> => {
      return ipcRenderer.invoke('cli:stream:kill', sessionId);
    },

    /**
     * Get active sessions
     */
    getSessions: (): Promise<SessionInfo[]> => {
      return ipcRenderer.invoke('cli:sessions');
    },
  },

  /**
   * Stream event subscriptions
   */
  stream: {
    onStart: (callback: (event: StreamStartEvent) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: StreamStartEvent) => {
        callback(data);
      };
      ipcRenderer.on('cli:stream:start', handler);
      return () => ipcRenderer.removeListener('cli:stream:start', handler);
    },

    onOutput: (callback: (event: StreamOutputEvent) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: StreamOutputEvent) => {
        callback(data);
      };
      ipcRenderer.on('cli:stream:output', handler);
      return () => ipcRenderer.removeListener('cli:stream:output', handler);
    },

    onError: (callback: (event: StreamErrorEvent) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: StreamErrorEvent) => {
        callback(data);
      };
      ipcRenderer.on('cli:stream:error', handler);
      return () => ipcRenderer.removeListener('cli:stream:error', handler);
    },

    onClose: (callback: (event: StreamCloseEvent) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: StreamCloseEvent) => {
        callback(data);
      };
      ipcRenderer.on('cli:stream:close', handler);
      return () => ipcRenderer.removeListener('cli:stream:close', handler);
    },
  },

  /**
   * State management
   */
  state: {
    /** Get current project state */
    get: (): Promise<ProjectState> => ipcRenderer.invoke('state:get'),

    /** Set current prompt */
    setPrompt: (prompt: string): Promise<ProjectState> =>
      ipcRenderer.invoke('state:setPrompt', prompt),

    /** Set current phase */
    setPhase: (phase: ProjectState['currentPhase']): Promise<ProjectState> =>
      ipcRenderer.invoke('state:setPhase', phase),

    /** Add a task */
    addTask: (title: string, description?: string, provider?: AIProvider): Promise<Task> =>
      ipcRenderer.invoke('state:addTask', title, description, provider),

    /** Update a task */
    updateTask: (taskId: string, updates: Partial<Task>): Promise<Task | null> =>
      ipcRenderer.invoke('state:updateTask', taskId, updates),

    /** Remove a task */
    removeTask: (taskId: string): Promise<boolean> =>
      ipcRenderer.invoke('state:removeTask', taskId),

    /** Add DoD item */
    addDoD: (description: string): Promise<DoDItem> =>
      ipcRenderer.invoke('state:addDoD', description),

    /** Update DoD item */
    updateDoD: (itemId: string, completed: boolean): Promise<DoDItem | null> =>
      ipcRenderer.invoke('state:updateDoD', itemId, completed),

    /** Get progress */
    getProgress: (): Promise<ProjectState['progress']> =>
      ipcRenderer.invoke('state:progress'),

    /** Record Trinity meeting */
    recordMeeting: (): Promise<ProjectState> =>
      ipcRenderer.invoke('state:recordMeeting'),

    /** Save state */
    save: (): Promise<boolean> => ipcRenderer.invoke('state:save'),
  },

  /**
   * Log management
   */
  log: {
    /** Write log entry */
    write: (provider: LogProvider, level: LogLevel, message: string, data?: Record<string, unknown>): Promise<LogEntry> =>
      ipcRenderer.invoke('log:write', provider, level, message, data),

    /** Get recent logs */
    recent: (limit?: number): Promise<LogEntry[]> =>
      ipcRenderer.invoke('log:recent', limit),

    /** Get logs by provider */
    byProvider: (provider: LogProvider, limit?: number): Promise<LogEntry[]> =>
      ipcRenderer.invoke('log:byProvider', provider, limit),

    /** Search logs */
    search: (query: string, limit?: number): Promise<LogEntry[]> =>
      ipcRenderer.invoke('log:search', query, limit),

    /** List log files */
    files: (): Promise<string[]> => ipcRenderer.invoke('log:files'),

    /** Clear memory logs */
    clear: (): Promise<boolean> => ipcRenderer.invoke('log:clear'),

    // Convenience methods
    debug: (provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> =>
      ipcRenderer.invoke('log:write', provider, 'DEBUG', message, data),

    info: (provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> =>
      ipcRenderer.invoke('log:write', provider, 'INFO', message, data),

    warn: (provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> =>
      ipcRenderer.invoke('log:write', provider, 'WARN', message, data),

    error: (provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> =>
      ipcRenderer.invoke('log:write', provider, 'ERROR', message, data),

    success: (provider: LogProvider, message: string, data?: Record<string, unknown>): Promise<LogEntry> =>
      ipcRenderer.invoke('log:write', provider, 'SUCCESS', message, data),
  },

  /**
   * DoD (Definition of Done) management
   */
  dod: {
    /** Get current progress */
    getProgress: (): Promise<DoDProgressInfo> =>
      ipcRenderer.invoke('dod:progress'),

    /** Reload from file */
    reload: (): Promise<DoDProgressInfo> =>
      ipcRenderer.invoke('dod:reload'),

    /** Toggle item checked state */
    toggleItem: (itemId: string): Promise<DoDProgressInfo | null> =>
      ipcRenderer.invoke('dod:toggle', itemId),

    /** Add new item to section */
    addItem: (sectionName: string, text: string): Promise<DoDProgressInfo | null> =>
      ipcRenderer.invoke('dod:addItem', sectionName, text),

    /** Check if all items are complete */
    isComplete: (): Promise<boolean> =>
      ipcRenderer.invoke('dod:isComplete'),

    /** Get human-readable status message */
    getStatus: (): Promise<string> =>
      ipcRenderer.invoke('dod:status'),

    /** Export progress as JSON */
    export: (): Promise<string> =>
      ipcRenderer.invoke('dod:export'),
  },

  /**
   * Git/GitHub management
   */
  git: {
    /** Check if current directory is a git repo */
    isRepo: (): Promise<boolean> =>
      ipcRenderer.invoke('git:isRepo'),

    /** Check gh CLI availability */
    ghStatus: (): Promise<GhStatus> =>
      ipcRenderer.invoke('git:ghStatus'),

    /** Get repository status */
    getStatus: (): Promise<GitRepoStatus> =>
      ipcRenderer.invoke('git:status'),

    /** Get recent commits */
    getCommits: (limit?: number): Promise<GitCommit[]> =>
      ipcRenderer.invoke('git:commits', limit),

    /** Get branches */
    getBranches: (): Promise<GitBranch[]> =>
      ipcRenderer.invoke('git:branches'),

    /** Stage files */
    stage: (paths?: string[]): Promise<boolean> =>
      ipcRenderer.invoke('git:stage', paths),

    /** Unstage files */
    unstage: (paths: string[]): Promise<boolean> =>
      ipcRenderer.invoke('git:unstage', paths),

    /** Create commit */
    commit: (message: string): Promise<{ success: boolean; hash?: string; error?: string }> =>
      ipcRenderer.invoke('git:commit', message),

    /** Push to remote */
    push: (remote?: string, branch?: string): Promise<boolean> =>
      ipcRenderer.invoke('git:push', remote, branch),

    /** Pull from remote */
    pull: (remote?: string, branch?: string): Promise<boolean> =>
      ipcRenderer.invoke('git:pull', remote, branch),

    /** Checkout branch */
    checkout: (branch: string, create?: boolean): Promise<boolean> =>
      ipcRenderer.invoke('git:checkout', branch, create),

    /** Get diff */
    getDiff: (path?: string, staged?: boolean): Promise<string> =>
      ipcRenderer.invoke('git:diff', path, staged),

    /** List GitHub PRs */
    listPRs: (state?: 'open' | 'closed' | 'all', limit?: number): Promise<GitHubPR[]> =>
      ipcRenderer.invoke('git:listPRs', state, limit),

    /** Create GitHub PR */
    createPR: (title: string, body: string, base?: string): Promise<{ success: boolean; url?: string; error?: string }> =>
      ipcRenderer.invoke('git:createPR', title, body, base),

    /** Get repo info */
    getRepoInfo: (): Promise<GitRepoInfo | null> =>
      ipcRenderer.invoke('git:repoInfo'),

    /** Sync .iori/ state to GitHub */
    syncState: (message?: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:syncState', message),
  },

  /**
   * Worker Pool (Parallel Agent Management)
   */
  worker: {
    /** Spawn single worker */
    spawn: (provider: AIProvider, prompt: string): Promise<WorkerInfo> =>
      ipcRenderer.invoke('worker:spawn', provider, prompt),

    /** Run Trinity Meeting (all 3 AI providers) */
    trinity: (prompt: string, providers?: AIProvider[]): Promise<TrinityResultInfo> =>
      ipcRenderer.invoke('worker:trinity', prompt, providers),

    /** Run parallel tasks */
    parallel: (tasks: Array<{ provider: AIProvider; prompt: string }>): Promise<WorkerInfo[]> =>
      ipcRenderer.invoke('worker:parallel', tasks),

    /** Get worker by ID */
    get: (workerId: string): Promise<WorkerInfo | undefined> =>
      ipcRenderer.invoke('worker:get', workerId),

    /** Get all workers */
    getAll: (): Promise<WorkerInfo[]> =>
      ipcRenderer.invoke('worker:all'),

    /** Get running workers */
    getRunning: (): Promise<WorkerInfo[]> =>
      ipcRenderer.invoke('worker:running'),

    /** Get worker stats */
    getStats: (): Promise<WorkerStats> =>
      ipcRenderer.invoke('worker:stats'),

    /** Kill specific worker */
    kill: (workerId: string): Promise<boolean> =>
      ipcRenderer.invoke('worker:kill', workerId),

    /** Kill all workers */
    killAll: (): Promise<number> =>
      ipcRenderer.invoke('worker:killAll'),

    /** Clear finished workers */
    clear: (): Promise<number> =>
      ipcRenderer.invoke('worker:clear'),

    /** Check if any workers running */
    hasRunning: (): Promise<boolean> =>
      ipcRenderer.invoke('worker:hasRunning'),

    // Event subscriptions
    onStarted: (callback: (worker: WorkerInfo) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: WorkerInfo) => callback(data);
      ipcRenderer.on('worker:started', handler);
      return () => ipcRenderer.removeListener('worker:started', handler);
    },

    onOutput: (callback: (event: { workerId: string; data: string }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { workerId: string; data: string }) => callback(data);
      ipcRenderer.on('worker:output', handler);
      return () => ipcRenderer.removeListener('worker:output', handler);
    },

    onError: (callback: (event: { workerId: string; error: string }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { workerId: string; error: string }) => callback(data);
      ipcRenderer.on('worker:error', handler);
      return () => ipcRenderer.removeListener('worker:error', handler);
    },

    onCompleted: (callback: (worker: WorkerInfo) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: WorkerInfo) => callback(data);
      ipcRenderer.on('worker:completed', handler);
      return () => ipcRenderer.removeListener('worker:completed', handler);
    },

    onKilled: (callback: (workerId: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: string) => callback(data);
      ipcRenderer.on('worker:killed', handler);
      return () => ipcRenderer.removeListener('worker:killed', handler);
    },

    onTrinityStarted: (callback: (data: { id: string; prompt: string; providers: AIProvider[] }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { id: string; prompt: string; providers: AIProvider[] }) => callback(data);
      ipcRenderer.on('trinity:started', handler);
      return () => ipcRenderer.removeListener('trinity:started', handler);
    },

    onTrinityCompleted: (callback: (result: TrinityResultInfo) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: TrinityResultInfo) => callback(data);
      ipcRenderer.on('trinity:completed', handler);
      return () => ipcRenderer.removeListener('trinity:completed', handler);
    },
  },
};

// Expose API to renderer
contextBridge.exposeInMainWorld('iori', ioriApi);

// Type declaration for renderer process
declare global {
  interface Window {
    iori: typeof ioriApi;
  }
}

console.log('[Iori] Preload script loaded');
