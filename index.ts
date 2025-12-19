// index.ts (Iori Kernel v2.0)
import { think } from "./src/core/brain.js";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

const TODO_FILE = "TODO.md";
const LOG_FILE = "iori_system.log";

// --- Helper: ログ記録 ---
async function logSystem(message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  await fs.appendFile(LOG_FILE, logLine);
  // コンソールにも出すが、色は呼び出し元で制御
}

// --- Helper: AIの出力からファイルパスとコードを抽出 ---
function parseCodeBlock(text: string): { path: string | null, content: string } {
  // 1. "FILE: path/to/file" のような指定を探す
  const pathMatch = text.match(/(?:FILE|PATH):\s*([^\s\n]+)/i);
  const filePath = pathMatch ? pathMatch[1].trim() : null;

  // 2. コードブロック ```...``` の中身を探す
  const codeMatch = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  const content = codeMatch ? codeMatch[1] : text; // ブロックがなければ全体

  return { path: filePath, content: content.trim() };
}

async function main() {
  console.log(chalk.green("🌌 Iori OS v2.0: Autonomous Kernel Started."));
  await logSystem("Kernel started.");

  while (true) {
    // 1. TODO読み込み
    let todoContent = "";
    try {
      todoContent = await fs.readFile(TODO_FILE, "utf-8");
    } catch {
      console.log(chalk.red("❌ TODO.md not found. Creating one..."));
      await fs.writeFile(TODO_FILE, "- [ ] Sample Task: Create a hello world file.\n");
      continue;
    }

    const lines = todoContent.split("\n");
    const taskIndex = lines.findIndex(line => line.trim().startsWith("- [ ]"));

    if (taskIndex === -1) {
      console.log(chalk.green("💤 No tasks left. Iori is standing by."));
      break;
    }

    const taskLine = lines[taskIndex];
    const taskDescription = taskLine.replace("- [ ]", "").trim();

    console.log(chalk.yellow(`\n🎯 Processing: "${taskDescription}"`));
    await logSystem(`Start Task: ${taskDescription}`);

    try {
      // --- Phase 1: Gemini (Analysis) ---
      console.log(chalk.cyan("  🧠 Gemini is analyzing..."));
      const plan = await think(
        "このタスクの実装方針を簡潔にまとめて。",
        taskDescription,
        "GEMINI"
      );

      // --- Phase 2: Claude (Architecture & Coding) ---
      console.log(chalk.magenta("  🧠 Claude is designing & coding..."));
      const codingResult = await think(
        `
        以下のタスクと方針に基づき、実装コードを作成して。

        【重要】出力フォーマット:
        1行目に "FILE: src/utils/example.ts" のようにファイルパスを書くこと。
        その後にコードブロックでコードを書くこと。
        解説は不要。
        `,
        `TASK: ${taskDescription}\nPLAN: ${plan}`,
        "CLAUDE"
      );

      // --- Phase 3: Iori Kernel (Execution) ---
      // Codexを使うまでもなく、正規表現でパースして書き込む (コスト削減 & 高速化)
      console.log(chalk.blue("  ⚙️ Iori Kernel is applying changes..."));

      const { path: filePath, content } = parseCodeBlock(codingResult);

      if (filePath && content) {
        // ディレクトリ作成
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        // ファイル書き込み
        await fs.writeFile(filePath, content);
        console.log(chalk.green(`  ✅ Saved to: ${filePath}`));
        await logSystem(`Success: Written to ${filePath}`);
      } else {
        throw new Error("Could not parse file path from Claude's output.");
      }

      // タスク完了処理
      lines[taskIndex] = taskLine.replace("- [ ]", "- [x]");
      await fs.writeFile(TODO_FILE, lines.join("\n"));

    } catch (error: any) {
      console.error(chalk.red(`  💥 Task Failed: ${error.message}`));
      await logSystem(`Error: ${error.message}`);

      // リトライ戦略: タスクを少し書き換えて「失敗回数」を記録する等の処理が可能
      // 今回は無限ループ防止のため、スキップせずにログだけ残して停止
      break;
    }

    // APIレート制限回避のための休憩
    await new Promise(r => setTimeout(r, 2000));
  }
}

main();
