// index.ts (Iori Kernel v3.0 Entry Point)
import { IoriKernel } from "./src/core/kernel.js";
import chalk from "chalk";

/**
 * Iori Kernel v3.0 Main Entry Point
 * C3L + Brain + Shell Controller の統合システム
 */
async function main() {
  console.log(chalk.bold.magenta("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.bold.magenta("  🌌 Iori Kernel v3.0"));
  console.log(chalk.bold.magenta("  Unified AI Development System"));
  console.log(chalk.bold.magenta("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"));

  // カーネル初期化
  const kernel = new IoriKernel({
    todoFile: "TODO.md",
    logFile: "iori_system.log",
    defaultBrain: (() => {
      const envBrain = process.env.IORI_BRAIN?.toUpperCase();
      if (envBrain === "CLAUDE" || envBrain === "GEMINI" || envBrain === "CODEX") {
        return envBrain;
      }
      return "CLAUDE";
    })(),
    autoExecute: false // テスト自動実行を無効化（手動制御）
  });

  try {
    await kernel.init();

    // コマンドライン引数をチェック
    const args = process.argv.slice(2);

    if (args.length === 0) {
      // 引数なし: 自律実行モード
      console.log(chalk.cyan("🤖 Starting autonomous mode (TODO.md based execution)...\n"));
      await kernel.runAutonomous();
    } else if (args[0] === "c3l") {
      // C3Lコマンド実行モード
      // 使用例: node index.ts c3l implement code "Create multiply function"
      if (args.length < 3) {
        console.log(chalk.red("Usage: node index.ts c3l <directive> <layer> [description]"));
        console.log(chalk.gray("Example: node index.ts c3l implement code \"Create add function\""));
        process.exit(1);
      }

      const directive = args[1];
      const layer = args[2];
      const description = args.slice(3).join(" ") || "No description provided";

      const result = await kernel.executeC3L(directive, layer, {
        input_content: description
      });

      if (!result.success) {
        process.exit(1);
      }

    } else if (args[0] === "shell") {
      // シェルコマンド実行モード
      // 使用例: node index.ts shell "npm test"
      const command = args.slice(1).join(" ");
      await kernel.executeShell(command);

    } else if (args[0] === "list") {
      // C3Lコマンド一覧表示
      console.log(chalk.cyan("📋 Available C3L Commands:\n"));
      const commands = await kernel.listC3LCommands();
      commands.forEach(cmd => console.log(chalk.white("  " + cmd)));

    } else {
      console.log(chalk.red("Unknown command. Available commands:"));
      console.log(chalk.gray("  node index.ts              - Autonomous mode (TODO.md)"));
      console.log(chalk.gray("  node index.ts c3l <directive> <layer> <desc> - Execute C3L command"));
      console.log(chalk.gray("  node index.ts shell <command> - Execute shell command"));
      console.log(chalk.gray("  node index.ts list         - List C3L commands"));
      process.exit(1);
    }

    console.log(chalk.bold.green("\n✅ Iori Kernel v3.0: Execution completed successfully\n"));

  } catch (error: any) {
    console.error(chalk.bold.red("\n❌ Kernel Error:"), error.message);
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

main();
