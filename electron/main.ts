/**
 * Iori v4.0 - Electron Main Process
 * @module electron/main
 *
 * VSCode-style architecture: Main process handles window management,
 * IPC communication, and CLI worker spawning.
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCLIBridge, AIProvider } from './cli-bridge.js';
import { getStateManager, Task } from './state-manager.js';
import { getLogManager, LogLevel, LogProvider } from './log-manager.js';
import { getDoDManager } from './dod-manager.js';
import { getGitManager } from './git-manager.js';
import { getWorkerPool, AIProvider as WorkerProvider } from './worker-pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** CLI Bridge instance */
const cliBridge = getCLIBridge();

/** State Manager instance */
const stateManager = getStateManager();

/** Log Manager instance */
const logManager = getLogManager();

/** DoD Manager instance */
const dodManager = getDoDManager();

/** Git Manager instance */
const gitManager = getGitManager();

/** Worker Pool instance */
const workerPool = getWorkerPool();

/** Main application window */
let mainWindow: BrowserWindow | null = null;

/** Window configuration */
const WINDOW_CONFIG = {
  width: 1400,
  height: 900,
  minWidth: 800,
  minHeight: 600,
  backgroundColor: '#0a0a0f',
  title: 'Iori v4.0 - Autonomous Development OS',
};

/**
 * Creates the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...WINDOW_CONFIG,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    frame: true,
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Load the frontend
  const frontendPath = path.join(__dirname, '..', 'src', 'frontend', 'public', 'index.html');
  mainWindow.loadFile(frontendPath);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    console.log('[Iori] Main window ready');
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * IPC Handlers for Renderer communication
 */
function setupIpcHandlers(): void {
  // Get app version
  ipcMain.handle('app:version', () => {
    return app.getVersion();
  });

  // Get platform info
  ipcMain.handle('app:platform', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
    };
  });

  // CLI execution via CLI Bridge
  ipcMain.handle('cli:exec', async (_event, provider: AIProvider, prompt: string) => {
    console.log(`[Iori] CLI exec request: ${provider} - ${prompt.slice(0, 50)}...`);
    try {
      const result = await cliBridge.execute(provider, prompt);
      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: null,
        provider,
        duration: 0,
      };
    }
  });

  // Check CLI availability
  ipcMain.handle('cli:check', async (_event, provider: AIProvider) => {
    return cliBridge.checkAvailability(provider);
  });

  // Check all providers
  ipcMain.handle('cli:checkAll', async () => {
    return cliBridge.checkAllProviders();
  });

  // Start streaming session
  ipcMain.handle('cli:stream:start', (_event, provider: AIProvider, prompt: string) => {
    const sessionId = cliBridge.startStream(provider, prompt);
    return sessionId;
  });

  // Kill streaming session
  ipcMain.handle('cli:stream:kill', (_event, sessionId: string) => {
    return cliBridge.killSession(sessionId);
  });

  // Get active sessions
  ipcMain.handle('cli:sessions', () => {
    return cliBridge.getActiveSessions().map(s => ({
      id: s.id,
      provider: s.provider,
      startTime: s.startTime,
    }));
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  // ===== State Management =====

  // Get project state
  ipcMain.handle('state:get', () => {
    return stateManager.getState();
  });

  // Set current prompt
  ipcMain.handle('state:setPrompt', async (_event, prompt: string) => {
    await stateManager.setCurrentPrompt(prompt);
    return stateManager.getState();
  });

  // Set current phase
  ipcMain.handle('state:setPhase', async (_event, phase: string) => {
    await stateManager.setPhase(phase as 'idle' | 'planning' | 'implementing' | 'testing' | 'reviewing');
    return stateManager.getState();
  });

  // Add task
  ipcMain.handle('state:addTask', async (_event, title: string, description?: string, provider?: string) => {
    const task = await stateManager.addTask(title, description, provider as Task['provider']);
    return task;
  });

  // Update task
  ipcMain.handle('state:updateTask', async (_event, taskId: string, updates: Partial<Task>) => {
    return stateManager.updateTask(taskId, updates);
  });

  // Remove task
  ipcMain.handle('state:removeTask', async (_event, taskId: string) => {
    return stateManager.removeTask(taskId);
  });

  // Add DoD item
  ipcMain.handle('state:addDoD', async (_event, description: string) => {
    return stateManager.addDoDItem(description);
  });

  // Update DoD item
  ipcMain.handle('state:updateDoD', async (_event, itemId: string, completed: boolean) => {
    return stateManager.updateDoDItem(itemId, completed);
  });

  // Get progress
  ipcMain.handle('state:progress', () => {
    return stateManager.getProgress();
  });

  // Record Trinity meeting
  ipcMain.handle('state:recordMeeting', async () => {
    await stateManager.recordTrinityMeeting();
    return stateManager.getState();
  });

  // Save state
  ipcMain.handle('state:save', async () => {
    await stateManager.save();
    return true;
  });

  // ===== Log Management =====

  // Write log
  ipcMain.handle('log:write', async (_event, provider: LogProvider, level: LogLevel, message: string, data?: Record<string, unknown>) => {
    return logManager.log(provider, level, message, data);
  });

  // Get recent logs
  ipcMain.handle('log:recent', (_event, limit?: number) => {
    return logManager.getRecentLogs(limit);
  });

  // Get logs by provider
  ipcMain.handle('log:byProvider', (_event, provider: LogProvider, limit?: number) => {
    return logManager.getLogsByProvider(provider, limit);
  });

  // Search logs
  ipcMain.handle('log:search', (_event, query: string, limit?: number) => {
    return logManager.searchLogs(query, limit);
  });

  // List log files
  ipcMain.handle('log:files', async () => {
    return logManager.listLogFiles();
  });

  // Clear memory logs
  ipcMain.handle('log:clear', () => {
    logManager.clearMemoryLogs();
    return true;
  });

  // ===== DoD Management =====

  // Get DoD progress
  ipcMain.handle('dod:progress', async () => {
    return dodManager.getProgress() || await dodManager.reload();
  });

  // Reload DoD
  ipcMain.handle('dod:reload', async () => {
    return dodManager.reload();
  });

  // Toggle item
  ipcMain.handle('dod:toggle', async (_event, itemId: string) => {
    return dodManager.toggleItem(itemId);
  });

  // Add item to section
  ipcMain.handle('dod:addItem', async (_event, sectionName: string, text: string) => {
    return dodManager.addItem(sectionName, text);
  });

  // Check if complete
  ipcMain.handle('dod:isComplete', () => {
    return dodManager.isComplete();
  });

  // Get status message
  ipcMain.handle('dod:status', () => {
    return dodManager.getStatusMessage();
  });

  // Export progress
  ipcMain.handle('dod:export', () => {
    return dodManager.exportProgress();
  });

  // ===== Git Management =====

  // Check if git repo
  ipcMain.handle('git:isRepo', async () => {
    return gitManager.isGitRepo();
  });

  // Check gh CLI
  ipcMain.handle('git:ghStatus', async () => {
    return gitManager.isGhAvailable();
  });

  // Get repo status
  ipcMain.handle('git:status', async () => {
    return gitManager.getStatus();
  });

  // Get commits
  ipcMain.handle('git:commits', async (_event, limit?: number) => {
    return gitManager.getCommits(limit);
  });

  // Get branches
  ipcMain.handle('git:branches', async () => {
    return gitManager.getBranches();
  });

  // Stage files
  ipcMain.handle('git:stage', async (_event, paths?: string[]) => {
    return gitManager.stageFiles(paths);
  });

  // Unstage files
  ipcMain.handle('git:unstage', async (_event, paths: string[]) => {
    return gitManager.unstageFiles(paths);
  });

  // Commit
  ipcMain.handle('git:commit', async (_event, message: string) => {
    return gitManager.commit(message);
  });

  // Push
  ipcMain.handle('git:push', async (_event, remote?: string, branch?: string) => {
    return gitManager.push(remote, branch);
  });

  // Pull
  ipcMain.handle('git:pull', async (_event, remote?: string, branch?: string) => {
    return gitManager.pull(remote, branch);
  });

  // Checkout
  ipcMain.handle('git:checkout', async (_event, branch: string, create?: boolean) => {
    return gitManager.checkout(branch, create);
  });

  // Get diff
  ipcMain.handle('git:diff', async (_event, path?: string, staged?: boolean) => {
    return gitManager.getDiff(path, staged);
  });

  // List PRs
  ipcMain.handle('git:listPRs', async (_event, state?: 'open' | 'closed' | 'all', limit?: number) => {
    return gitManager.listPRs(state, limit);
  });

  // Create PR
  ipcMain.handle('git:createPR', async (_event, title: string, body: string, base?: string) => {
    return gitManager.createPR(title, body, base);
  });

  // Get repo info
  ipcMain.handle('git:repoInfo', async () => {
    return gitManager.getRepoInfo();
  });

  // Sync state
  ipcMain.handle('git:syncState', async (_event, message?: string) => {
    return gitManager.syncState(message);
  });

  // ===== Worker Pool (Parallel Agents) =====

  // Spawn single worker
  ipcMain.handle('worker:spawn', async (_event, provider: WorkerProvider, prompt: string) => {
    return workerPool.spawnWorker(provider, prompt);
  });

  // Run Trinity Meeting
  ipcMain.handle('worker:trinity', async (_event, prompt: string, providers?: WorkerProvider[]) => {
    return workerPool.runTrinityMeeting(prompt, providers);
  });

  // Run parallel tasks
  ipcMain.handle('worker:parallel', async (_event, tasks: Array<{ provider: WorkerProvider; prompt: string }>) => {
    return workerPool.runParallel(tasks);
  });

  // Get worker by ID
  ipcMain.handle('worker:get', (_event, workerId: string) => {
    return workerPool.getWorker(workerId);
  });

  // Get all workers
  ipcMain.handle('worker:all', () => {
    return workerPool.getAllWorkers();
  });

  // Get running workers
  ipcMain.handle('worker:running', () => {
    return workerPool.getRunningWorkers();
  });

  // Get worker stats
  ipcMain.handle('worker:stats', () => {
    return workerPool.getWorkerStats();
  });

  // Kill worker
  ipcMain.handle('worker:kill', (_event, workerId: string) => {
    return workerPool.killWorker(workerId);
  });

  // Kill all workers
  ipcMain.handle('worker:killAll', () => {
    return workerPool.killAll();
  });

  // Clear finished workers
  ipcMain.handle('worker:clear', () => {
    return workerPool.clearFinishedWorkers();
  });

  // Check if any running
  ipcMain.handle('worker:hasRunning', () => {
    return workerPool.hasRunningWorkers();
  });
}

/**
 * Setup Worker Pool event forwarding to renderer
 */
function setupWorkerPoolEvents(): void {
  workerPool.on('workerStarted', (worker) => {
    mainWindow?.webContents.send('worker:started', worker);
  });

  workerPool.on('workerOutput', (workerId: string, data: string) => {
    mainWindow?.webContents.send('worker:output', { workerId, data });
  });

  workerPool.on('workerError', (workerId: string, error: string) => {
    mainWindow?.webContents.send('worker:error', { workerId, error });
  });

  workerPool.on('workerCompleted', (worker) => {
    mainWindow?.webContents.send('worker:completed', worker);
  });

  workerPool.on('workerKilled', (workerId: string) => {
    mainWindow?.webContents.send('worker:killed', workerId);
  });

  workerPool.on('trinityStarted', (data) => {
    mainWindow?.webContents.send('trinity:started', data);
  });

  workerPool.on('trinityCompleted', (result) => {
    mainWindow?.webContents.send('trinity:completed', result);
  });
}

/**
 * Setup CLI Bridge event forwarding to renderer
 */
function setupCLIBridgeEvents(): void {
  cliBridge.on('start', (sessionId: string, provider: AIProvider) => {
    mainWindow?.webContents.send('cli:stream:start', { sessionId, provider });
  });

  cliBridge.on('output', (sessionId: string, data: string) => {
    mainWindow?.webContents.send('cli:stream:output', { sessionId, data });
  });

  cliBridge.on('error', (sessionId: string, error: string) => {
    mainWindow?.webContents.send('cli:stream:error', { sessionId, error });
  });

  cliBridge.on('close', (sessionId: string, code: number | null, duration: number) => {
    mainWindow?.webContents.send('cli:stream:close', { sessionId, code, duration });
  });
}

/**
 * App lifecycle events
 */
app.whenReady().then(async () => {
  console.log('[Iori] Starting Electron app...');

  // Initialize managers
  await stateManager.initialize();
  await logManager.initialize();
  await dodManager.initialize();
  await logManager.info('SYSTEM', 'Iori v4.0 Electron app starting...');

  setupIpcHandlers();
  setupCLIBridgeEvents();
  setupWorkerPoolEvents();
  createWindow();

  await logManager.success('SYSTEM', 'Iori v4.0 ready');

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup before quit
app.on('before-quit', async () => {
  await logManager.info('SYSTEM', 'Iori shutting down...');
  await stateManager.cleanup();
  dodManager.cleanup();
  cliBridge.killAllSessions();
  workerPool.killAll();
});

// Security: Prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, _url) => {
    event.preventDefault();
  });
});

console.log('[Iori] Electron main process loaded');
