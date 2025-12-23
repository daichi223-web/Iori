/**
 * Iori v3.0 Project Runner
 * 自律型タスク実行エンジン
 * @kernel Core component for autonomous project completion
 */
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

/** タスクの状態 */
type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** AI プロバイダー */
type AIProvider = "claude" | "gemini" | "codex";

/** タスク定義 */
interface Task {
  id: string;
  prompt: string;
  ai: AIProvider;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: string;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

/** タスクキュー */
interface TaskQueue {
  version: string;
  tasks: Task[];
  lastUpdated: string;
}

/** ランナー設定 */
interface RunnerConfig {
  projectRoot: string;
  taskQueuePath: string;
  logPath: string;
  maxConcurrent: number;
  defaultAi: AIProvider;
  timeout: number;
}

/**
 * デフォルト設定を取得
 */
function getDefaultConfig(projectRoot: string): RunnerConfig {
  return {
    projectRoot,
    taskQueuePath: path.join(projectRoot, ".iori", "tasks.json"),
    logPath: path.join(projectRoot, "iori_system.log"),
    maxConcurrent: 1, // 順次実行（安定性重視）
    defaultAi: "claude",
    timeout: 300000 // 5分
  };
}

/**
 * ANSIエスケープコードを除去
 */
function cleanAnsi(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07]*\x07/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    .replace(/\?25h/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}

/**
 * AI CLIコマンドを生成
 */
function getAiCommand(ai: AIProvider, prompt: string): string {
  const escaped = prompt.replace(/'/g, "'\\''");

  switch (ai) {
    case "gemini":
      return `gemini -p '${escaped}'`;
    case "codex":
      return `codex exec '${escaped}'`;
    case "claude":
    default:
      // ツール有効化 + バイパスモード（自律開発用）
      return `claude -p '${escaped}' --model sonnet --tools default --permission-mode bypassPermissions`;
  }
}

/**
 * タスクキューを読み込み
 */
async function loadTaskQueue(config: RunnerConfig): Promise<TaskQueue> {
  try {
    const content = await fs.readFile(config.taskQueuePath, "utf-8");
    return JSON.parse(content) as TaskQueue;
  } catch {
    // ファイルがない場合は空のキューを作成
    const emptyQueue: TaskQueue = {
      version: "1.0.0",
      tasks: [],
      lastUpdated: new Date().toISOString()
    };
    await saveTaskQueue(config, emptyQueue);
    return emptyQueue;
  }
}

/**
 * タスクキューを保存
 */
async function saveTaskQueue(config: RunnerConfig, queue: TaskQueue): Promise<void> {
  queue.lastUpdated = new Date().toISOString();

  // ディレクトリを確保
  await fs.mkdir(path.dirname(config.taskQueuePath), { recursive: true });
  await fs.writeFile(config.taskQueuePath, JSON.stringify(queue, null, 2));
}

/**
 * ログを追記
 */
async function appendLog(config: RunnerConfig, message: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [ProjectRunner] ${message}\n`;

  try {
    await fs.appendFile(config.logPath, logLine);
  } catch {
    // ログファイルが書けなくてもエラーにしない
    console.log(logLine.trim());
  }
}

/**
 * 新しいタスクIDを生成
 */
function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * タスクを追加
 */
export async function addTask(
  projectRoot: string,
  prompt: string,
  ai: AIProvider = "claude"
): Promise<Task> {
  const config = getDefaultConfig(projectRoot);
  const queue = await loadTaskQueue(config);

  const task: Task = {
    id: generateTaskId(),
    prompt,
    ai,
    status: "pending",
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 2
  };

  queue.tasks.push(task);
  await saveTaskQueue(config, queue);
  await appendLog(config, `Task added: ${task.id} - ${prompt.slice(0, 50)}...`);

  return task;
}

/**
 * タスクをキャンセル
 */
export async function cancelTask(projectRoot: string, taskId: string): Promise<boolean> {
  const config = getDefaultConfig(projectRoot);
  const queue = await loadTaskQueue(config);

  const task = queue.tasks.find(t => t.id === taskId);
  if (!task || task.status !== "pending") {
    return false;
  }

  task.status = "cancelled";
  await saveTaskQueue(config, queue);
  await appendLog(config, `Task cancelled: ${taskId}`);

  return true;
}

/**
 * 次の保留中タスクを取得
 */
export async function getNextPendingTask(projectRoot: string): Promise<Task | null> {
  const config = getDefaultConfig(projectRoot);
  const queue = await loadTaskQueue(config);

  return queue.tasks.find(t => t.status === "pending") || null;
}

/**
 * タスクを実行
 */
export async function executeTask(projectRoot: string, task: Task): Promise<Task> {
  const config = getDefaultConfig(projectRoot);
  const queue = await loadTaskQueue(config);

  // キュー内のタスクを更新
  const taskIndex = queue.tasks.findIndex(t => t.id === task.id);
  if (taskIndex === -1) {
    throw new Error(`Task not found: ${task.id}`);
  }

  // 実行開始
  queue.tasks[taskIndex].status = "running";
  queue.tasks[taskIndex].startedAt = new Date().toISOString();
  await saveTaskQueue(config, queue);
  await appendLog(config, `Task started: ${task.id}`);

  try {
    const command = getAiCommand(task.ai, task.prompt);

    const result = await execPromise(command, {
      timeout: config.timeout,
      maxBuffer: 1024 * 1024 * 50,
      cwd: config.projectRoot,
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" }
    });

    const output = cleanAnsi(result.stdout).trim();

    // 成功
    queue.tasks[taskIndex].status = "completed";
    queue.tasks[taskIndex].completedAt = new Date().toISOString();
    queue.tasks[taskIndex].result = output;
    await saveTaskQueue(config, queue);
    await appendLog(config, `Task completed: ${task.id}`);

    return queue.tasks[taskIndex];

  } catch (error) {
    const execError = error as Error & { stdout?: string; stderr?: string };
    const errorMessage = execError.message || "Unknown error";

    // リトライ可能か確認
    if (queue.tasks[taskIndex].retryCount < queue.tasks[taskIndex].maxRetries) {
      queue.tasks[taskIndex].retryCount++;
      queue.tasks[taskIndex].status = "pending"; // リトライのため保留に戻す
      await saveTaskQueue(config, queue);
      await appendLog(config, `Task retry scheduled: ${task.id} (attempt ${queue.tasks[taskIndex].retryCount})`);
    } else {
      // 最大リトライ回数に達した
      queue.tasks[taskIndex].status = "failed";
      queue.tasks[taskIndex].completedAt = new Date().toISOString();
      queue.tasks[taskIndex].error = errorMessage;
      queue.tasks[taskIndex].result = execError.stdout ? cleanAnsi(execError.stdout) : "";
      await saveTaskQueue(config, queue);
      await appendLog(config, `Task failed: ${task.id} - ${errorMessage}`);
    }

    return queue.tasks[taskIndex];
  }
}

/**
 * 全タスクのステータスを取得
 */
export async function getTaskStatus(projectRoot: string): Promise<{
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
  tasks: Task[];
}> {
  const config = getDefaultConfig(projectRoot);
  const queue = await loadTaskQueue(config);

  const stats = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    total: queue.tasks.length,
    tasks: queue.tasks
  };

  for (const task of queue.tasks) {
    stats[task.status]++;
  }

  return stats;
}

/**
 * 完了したタスクをクリア
 */
export async function clearCompletedTasks(projectRoot: string): Promise<number> {
  const config = getDefaultConfig(projectRoot);
  const queue = await loadTaskQueue(config);

  const beforeCount = queue.tasks.length;
  queue.tasks = queue.tasks.filter(t =>
    t.status !== "completed" && t.status !== "cancelled"
  );

  const clearedCount = beforeCount - queue.tasks.length;
  await saveTaskQueue(config, queue);
  await appendLog(config, `Cleared ${clearedCount} completed/cancelled tasks`);

  return clearedCount;
}

/**
 * ランナーを開始（デーモンモード）
 * 保留中のタスクを順次実行
 */
export async function startRunner(projectRoot: string): Promise<void> {
  const config = getDefaultConfig(projectRoot);
  await appendLog(config, "🚀 Project Runner started");

  console.log("🚀 Iori Project Runner started");
  console.log(`   Task queue: ${config.taskQueuePath}`);
  console.log(`   Press Ctrl+C to stop\n`);

  let isRunning = true;

  // 終了ハンドラ
  const cleanup = () => {
    isRunning = false;
    console.log("\n🛑 Project Runner stopping...");
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  while (isRunning) {
    try {
      const task = await getNextPendingTask(projectRoot);

      if (task) {
        console.log(`\n📋 Executing task: ${task.id}`);
        console.log(`   Prompt: ${task.prompt.slice(0, 60)}...`);
        console.log(`   AI: ${task.ai.toUpperCase()}`);

        const result = await executeTask(projectRoot, task);

        if (result.status === "completed") {
          console.log(`   ✅ Completed`);
          if (result.result) {
            console.log(`   Result preview: ${result.result.slice(0, 100)}...`);
          }
        } else if (result.status === "failed") {
          console.log(`   ❌ Failed: ${result.error}`);
        } else if (result.status === "pending") {
          console.log(`   🔄 Scheduled for retry`);
        }
      } else {
        // タスクがない場合は5秒待機
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error("Runner error:", error);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  await appendLog(config, "🛑 Project Runner stopped");
  console.log("🛑 Project Runner stopped");
}

/**
 * TODO.mdからタスクをインポート
 */
export async function importFromTodoMd(projectRoot: string): Promise<Task[]> {
  const config = getDefaultConfig(projectRoot);
  const todoPath = path.join(projectRoot, "TODO.md");

  try {
    const content = await fs.readFile(todoPath, "utf-8");
    const lines = content.split("\n");
    const addedTasks: Task[] = [];

    for (const line of lines) {
      // 未完了のタスク行を検出 (- [ ] で始まる行)
      const match = line.match(/^[-*]\s*\[\s*\]\s*(.+)$/);
      if (match) {
        const prompt = match[1].trim();
        // 実装系のタスクのみ追加（情報収集や確認タスクは除外）
        if (!prompt.toLowerCase().includes("review") &&
            !prompt.toLowerCase().includes("check") &&
            !prompt.toLowerCase().includes("確認") &&
            !prompt.toLowerCase().includes("レビュー")) {
          const task = await addTask(projectRoot, prompt, config.defaultAi);
          addedTasks.push(task);
        }
      }
    }

    await appendLog(config, `Imported ${addedTasks.length} tasks from TODO.md`);
    return addedTasks;

  } catch {
    await appendLog(config, "TODO.md not found or empty");
    return [];
  }
}
