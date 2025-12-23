#!/usr/bin/env node
/**
 * Iori v3.0 CLI Runner
 * スタンドアロンのタスク実行ツール
 *
 * Usage:
 *   npx tsx src/cli/runner.ts start      # ランナーを開始（デーモンモード）
 *   npx tsx src/cli/runner.ts add "..."  # タスクを追加
 *   npx tsx src/cli/runner.ts status     # タスク状況を表示
 *   npx tsx src/cli/runner.ts import     # TODO.mdからインポート
 *   npx tsx src/cli/runner.ts clear      # 完了タスクをクリア
 */
import path from "path";
import { fileURLToPath } from "url";
import {
  startRunner,
  addTask,
  getTaskStatus,
  clearCompletedTasks,
  importFromTodoMd
} from "../core/projectRunner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

type AIProvider = "claude" | "gemini" | "codex";

/**
 * ヘルプを表示
 */
function showHelp(): void {
  console.log(`
🌌 Iori Project Runner v3.0

Usage:
  npx tsx src/cli/runner.ts <command> [options]

Commands:
  start                     Start the runner daemon (processes tasks continuously)
  add "<prompt>" [--ai=X]   Add a new task to the queue (default: claude)
  status                    Show task queue status
  import                    Import tasks from TODO.md
  clear                     Clear completed/cancelled tasks
  help                      Show this help message

Options:
  --ai=claude|gemini|codex  Specify AI provider (default: claude)

Examples:
  # Start the runner daemon
  npx tsx src/cli/runner.ts start

  # Add a task using Claude
  npx tsx src/cli/runner.ts add "Create a utility function to format dates"

  # Add a task using Gemini
  npx tsx src/cli/runner.ts add "Analyze the codebase structure" --ai=gemini

  # Import tasks from TODO.md
  npx tsx src/cli/runner.ts import

  # Check task status
  npx tsx src/cli/runner.ts status
`);
}

/**
 * タスクステータスを表示
 */
async function showStatus(): Promise<void> {
  const status = await getTaskStatus(projectRoot);

  console.log("\n📊 Task Queue Status\n");
  console.log(`   Pending:   ${status.pending}`);
  console.log(`   Running:   ${status.running}`);
  console.log(`   Completed: ${status.completed}`);
  console.log(`   Failed:    ${status.failed}`);
  console.log(`   Cancelled: ${status.cancelled}`);
  console.log(`   ─────────────────`);
  console.log(`   Total:     ${status.total}\n`);

  if (status.tasks.length > 0) {
    console.log("📋 Recent Tasks:\n");
    // 最新10件を表示
    const recentTasks = status.tasks.slice(-10);
    for (const task of recentTasks) {
      const statusIcon = {
        pending: "⏳",
        running: "🔄",
        completed: "✅",
        failed: "❌",
        cancelled: "⛔"
      }[task.status];

      console.log(`   ${statusIcon} [${task.status.toUpperCase().padEnd(9)}] ${task.id}`);
      console.log(`      ${task.prompt.slice(0, 60)}...`);
      console.log(`      AI: ${task.ai.toUpperCase()}, Created: ${task.createdAt}`);
      if (task.error) {
        console.log(`      Error: ${task.error}`);
      }
      console.log();
    }
  }
}

/**
 * タスクを追加
 */
async function handleAdd(prompt: string, ai: AIProvider): Promise<void> {
  const task = await addTask(projectRoot, prompt, ai);
  console.log(`\n✅ Task added successfully\n`);
  console.log(`   ID:     ${task.id}`);
  console.log(`   AI:     ${task.ai.toUpperCase()}`);
  console.log(`   Prompt: ${task.prompt.slice(0, 60)}...`);
  console.log(`\n   Run 'npx tsx src/cli/runner.ts start' to execute tasks.\n`);
}

/**
 * TODO.mdからインポート
 */
async function handleImport(): Promise<void> {
  console.log("\n📥 Importing tasks from TODO.md...\n");
  const tasks = await importFromTodoMd(projectRoot);

  if (tasks.length === 0) {
    console.log("   No pending tasks found in TODO.md\n");
    return;
  }

  console.log(`   Imported ${tasks.length} task(s):\n`);
  for (const task of tasks) {
    console.log(`   ✅ ${task.id}: ${task.prompt.slice(0, 50)}...`);
  }
  console.log(`\n   Run 'npx tsx src/cli/runner.ts start' to execute tasks.\n`);
}

/**
 * 完了タスクをクリア
 */
async function handleClear(): Promise<void> {
  const count = await clearCompletedTasks(projectRoot);
  console.log(`\n🧹 Cleared ${count} completed/cancelled task(s)\n`);
}

/**
 * メイン
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  // AIプロバイダーを抽出
  let ai: AIProvider = "claude";
  const aiArg = args.find(a => a.startsWith("--ai="));
  if (aiArg) {
    const aiValue = aiArg.split("=")[1]?.toLowerCase();
    if (aiValue === "gemini" || aiValue === "codex" || aiValue === "claude") {
      ai = aiValue;
    }
  }

  switch (command) {
    case "start":
      await startRunner(projectRoot);
      break;

    case "add": {
      const prompt = args.slice(1).filter(a => !a.startsWith("--")).join(" ");
      if (!prompt) {
        console.error("Error: Prompt is required");
        console.log('Usage: npx tsx src/cli/runner.ts add "Your task prompt"');
        process.exit(1);
      }
      await handleAdd(prompt, ai);
      break;
    }

    case "status":
      await showStatus();
      break;

    case "import":
      await handleImport();
      break;

    case "clear":
      await handleClear();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
