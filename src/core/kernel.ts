// src/core/kernel.ts
// Iori Kernel v3.0 - Unified AI Development System
import { C3LEngine, C3LContext } from "./c3l.js";
import { think, BrainProvider, BrainConfig } from "./brain.js";
export { thinkParallel, thinkRace, clearBrainCache } from "./brain.js";
import { ShellController } from "./shell.js";
import { MemoryStore } from "./memory.js";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

export interface KernelConfig {
  todoFile?: string;
  logFile?: string;
  defaultBrain?: BrainProvider;
  autoExecute?: boolean;
  memoryEnabled?: boolean;
  brainConfig?: BrainConfig;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  error?: string;
  filePath?: string;
  memoryId?: string;
}

/**
 * Iori Kernel v3.0
 * C3L Kernel + Brain + Shell Controller + Long-Term Memory の統合システム
 */
export class IoriKernel {
  private c3l: C3LEngine;
  private shell: ShellController;
  private memory: MemoryStore;
  private config: Required<KernelConfig>;

  constructor(config: KernelConfig = {}) {
    this.c3l = new C3LEngine();
    this.shell = new ShellController();
    this.memory = new MemoryStore();
    this.config = {
      todoFile: config.todoFile || "TODO.md",
      logFile: config.logFile || "iori_system.log",
      defaultBrain: config.defaultBrain || "CLAUDE",
      autoExecute: config.autoExecute !== undefined ? config.autoExecute : false,
      memoryEnabled: config.memoryEnabled !== undefined ? config.memoryEnabled : true,
      brainConfig: config.brainConfig || { timeout: 120000, maxRetries: 2, cacheEnabled: true }
    };
  }

  /**
   * システムログを記録
   */
  private async log(message: string, level: "INFO" | "ERROR" | "SUCCESS" = "INFO") {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    await fs.appendFile(this.config.logFile, logLine);
  }

  /**
   * 過去の類似経験を検索してプロンプトに追加するコンテキストを生成
   */
  private async buildMemoryContext(taskDescription: string): Promise<string> {
    if (!this.config.memoryEnabled) {
      return "";
    }

    try {
      const relevantMemories = await this.memory.recall(taskDescription, {
        limit: 3,
        types: ['success', 'solution', 'learning']
      });

      const recentErrors = await this.memory.getRecentErrors({ limit: 2, daysBack: 7 });

      if (relevantMemories.length === 0 && recentErrors.length === 0) {
        return "";
      }

      const lines: string[] = ["\n\n# Past Experiences (Memory Context)"];

      if (relevantMemories.length > 0) {
        lines.push("\n## Relevant Past Successes:");
        for (const result of relevantMemories) {
          const entry = result.entry;
          lines.push(`- [${entry.type}] ${entry.content.substring(0, 200)}...`);
        }
      }

      if (recentErrors.length > 0) {
        lines.push("\n## Recent Errors to Avoid:");
        for (const entry of recentErrors) {
          lines.push(`- ${entry.content.substring(0, 150)}...`);
        }
      }

      return lines.join("\n");
    } catch {
      return "";
    }
  }

  /**
   * タスク実行結果をメモリに保存
   */
  private async saveTaskMemory(
    taskDescription: string,
    result: TaskResult,
    directive: string,
    layer: string
  ): Promise<string | undefined> {
    if (!this.config.memoryEnabled) {
      return undefined;
    }

    try {
      const memoryEntry = await this.memory.save({
        type: result.success ? 'success' : 'error',
        content: result.success
          ? `Task: ${taskDescription}\nDirective: ${directive} ${layer}\nOutput: ${result.output?.substring(0, 500) || ''}`
          : `Task: ${taskDescription}\nDirective: ${directive} ${layer}\nError: ${result.error || 'Unknown error'}`,
        tags: [directive, layer, result.success ? 'completed' : 'failed'],
        metadata: {
          source: 'kernel',
          context: { filePath: result.filePath, directive, layer }
        }
      });

      console.log(chalk.gray(`  📝 Memory saved: ${memoryEntry.id}`));
      return memoryEntry.id;
    } catch {
      return undefined;
    }
  }

  /**
   * C3Lコマンドを実行する
   * @param directive C3Lディレクティブ (design, implement, verify など)
   * @param layer レイヤー (feature, code, test など)
   * @param context コンテキスト変数
   * @param brain 使用するAI（省略時はdefaultBrain）
   */
  async executeC3L(
    directive: string,
    layer: string,
    context: C3LContext,
    brain?: BrainProvider
  ): Promise<TaskResult> {
    const useBrain = brain || this.config.defaultBrain;
    const taskDescription = context.input_content || `${directive} ${layer}`;

    try {
      console.log(chalk.cyan(`\n🎯 Executing C3L: ${directive} ${layer}`));
      await this.log(`Executing C3L: ${directive} ${layer}`);

      // Phase 0: 過去の経験をリコール
      const memoryContext = await this.buildMemoryContext(taskDescription);
      if (memoryContext) {
        console.log(chalk.gray(`  🧠 Memory context loaded`));
      }

      // Phase 1: C3L Kernelでプロンプト生成（メモリコンテキスト付き）
      const basePrompt = await this.c3l.transpile(directive, layer, context);
      const prompt = basePrompt + memoryContext;
      console.log(chalk.gray(`  📝 Prompt generated (${prompt.length} chars)`));

      // Phase 2: Brainで思考・生成（設定付き）
      console.log(chalk.magenta(`  🧠 ${useBrain} is processing...`));
      const aiOutput = await think(prompt, "", useBrain, this.config.brainConfig);

      // Phase 3: コード抽出
      let { filePath, content } = this.parseCodeBlock(aiOutput);

      // ファイルパスが指定されていない場合、デフォルトパスを生成
      if (!filePath) {
        filePath = this.generateDefaultPath(directive, layer, context);
        console.log(chalk.yellow(`  ⚠️ No file path specified. Using default: ${filePath}`));
      }

      if (content) {
        // ファイル保存
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf-8");
        console.log(chalk.green(`  ✅ Saved to: ${filePath}`));
        await this.log(`File saved: ${filePath}`, "SUCCESS");

        // 自動実行が有効な場合、テストやビルドを実行
        if (this.config.autoExecute && (layer === "test" || layer === "code")) {
          await this.autoExecuteTask(filePath, layer);
        }

        const result: TaskResult = {
          success: true,
          output: aiOutput,
          filePath
        };

        // Phase 4: 成功をメモリに保存
        result.memoryId = await this.saveTaskMemory(taskDescription, result, directive, layer);

        return result;
      } else {
        throw new Error("Could not extract content from AI output");
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`  ❌ C3L Execution Failed: ${errorMessage}`));
      await this.log(`C3L Execution Failed: ${errorMessage}`, "ERROR");

      const result: TaskResult = {
        success: false,
        error: errorMessage
      };

      // 失敗もメモリに保存
      result.memoryId = await this.saveTaskMemory(taskDescription, result, directive, layer);

      return result;
    }
  }

  /**
   * AIの出力からファイルパスとコードを抽出
   */
  private parseCodeBlock(text: string): { filePath: string | null, content: string } {
    // 1. "FILE: path/to/file" のような指定を探す
    const pathMatch = text.match(/(?:FILE|PATH):\s*([^\s\n]+)/i);
    const filePath = pathMatch ? pathMatch[1].trim() : null;

    // 2. コードブロック ```...``` の中身を探す
    const codeMatch = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
    const content = codeMatch ? codeMatch[1] : text;

    return { filePath, content: content.trim() };
  }

  /**
   * デフォルトのファイルパスを生成
   */
  private generateDefaultPath(_directive: string, layer: string, context: C3LContext): string {
    const timestamp = Date.now();

    // コンテキストから関数名やファイル名のヒントを抽出
    const inputContent = context.input_content || "";
    const nameMatch = inputContent.match(/(?:Name|Function):\s*(\w+)/i) ||
                      inputContent.match(/(\w+)\s+function/i);
    const functionName = nameMatch ? nameMatch[1].toLowerCase() : `output_${timestamp}`;

    // layerに応じてディレクトリを決定
    let dir = ".iori_temp";
    let ext = ".ts";

    if (layer === "code") {
      dir = "src/utils";
      ext = ".ts";
    } else if (layer === "test") {
      dir = "src/__tests__";
      ext = ".test.ts";
    } else if (layer === "feature") {
      dir = "docs/design";
      ext = ".md";
    }

    return path.join(dir, `${functionName}${ext}`);
  }

  /**
   * ファイル保存後の自動実行タスク
   */
  private async autoExecuteTask(filePath: string, layer: string) {
    try {
      if (layer === "test" && filePath.includes(".test.")) {
        console.log(chalk.blue(`  🧪 Running test: ${filePath}`));
        await this.shell.exec(`npx vitest run ${filePath}`);
        console.log(chalk.green(`  ✅ Test completed`));
      } else if (layer === "code" && filePath.endsWith(".ts")) {
        console.log(chalk.blue(`  🔍 Type checking: ${filePath}`));
        await this.shell.exec(`npx tsc --noEmit ${filePath}`);
        console.log(chalk.green(`  ✅ Type check passed`));
      }
    } catch (error: any) {
      console.warn(chalk.yellow(`  ⚠️ Auto-execute warning: ${error.message}`));
    }
  }

  /**
   * Markdown ASTから次の未完了タスクと文脈を抽出
   */
  private extractContextAwareTask(todoContent: string): {
    title: string;
    description: string;
    line: number | null;
  } | null {
    const tree: any = unified().use(remarkParse).use(remarkGfm).parse(todoContent);
    const headings: string[] = [];

    const textFromNode = (node: any): string => {
      if (!node) return "";
      if (node.type === "text") return node.value || "";
      if (node.type === "inlineCode") return node.value || "";
      if (node.children && Array.isArray(node.children)) {
        return node.children.map(textFromNode).join("");
      }
      return "";
    };

    const listItemRawText = (listItem: any): string => {
      const paragraph = listItem.children?.find((child: any) => child.type === "paragraph");
      return textFromNode(paragraph).trim();
    };

    const normalizeTaskTitle = (rawText: string): string =>
      rawText.replace(/^\[(?: |x|X)\]\s*/, "").trim();

    const isUncheckedTask = (listItem: any, rawText: string): boolean =>
      listItem.checked === false || /^\[ \]\s*/.test(rawText);

    const collectDetailLines = (node: any): string[] => {
      const details: string[] = [];
      if (!node?.children) return details;
      for (const child of node.children) {
        if (child.type === "list") {
          for (const item of child.children || []) {
            if (item.type === "listItem" && item.checked !== true) {
              const detail = normalizeTaskTitle(listItemRawText(item));
              if (detail) details.push(detail);
            }
            details.push(...collectDetailLines(item));
          }
        }
      }
      return details;
    };

    const buildDescription = (title: string, contextLines: string[]): string => {
      const contextBlock = contextLines.length
        ? `\n\n# Context / Constraints\n- ${contextLines.join("\n- ")}`
        : "";
      return `# Task\n${title}${contextBlock}`;
    };

    const findInList = (listNode: any, parentItems: string[]): {
      title: string;
      description: string;
      line: number | null;
    } | null => {
      for (const item of listNode.children || []) {
        if (item.type !== "listItem") continue;
        const rawText = listItemRawText(item);
        const itemTitle = normalizeTaskTitle(rawText);
        const isTask = isUncheckedTask(item, rawText);

        if (isTask && itemTitle) {
          const contextLines: string[] = [];
          if (headings.length) {
            contextLines.push(`Section: ${headings.join(" / ")}`);
          }
          contextLines.push(...parentItems.filter(Boolean));
          contextLines.push(...collectDetailLines(item));
          const description = buildDescription(itemTitle, contextLines);
          const line = item.position?.start?.line ?? null;
          return { title: itemTitle, description, line };
        }

        const nextParents = itemTitle ? [...parentItems, itemTitle] : [...parentItems];
        for (const child of item.children || []) {
          if (child.type === "list") {
            const nested = findInList(child, nextParents);
            if (nested) return nested;
          }
        }
      }
      return null;
    };

    const traverse = (nodes: any[], parentItems: string[]): {
      title: string;
      description: string;
      line: number | null;
    } | null => {
      for (const node of nodes) {
        if (node.type === "heading") {
          const depth = node.depth || 1;
          headings.length = depth - 1;
          const title = textFromNode(node).trim();
          headings[depth - 1] = title;
          continue;
        }
        if (node.type === "list") {
          const found = findInList(node, parentItems);
          if (found) return found;
        }
        if (node.children && Array.isArray(node.children)) {
          const found = traverse(node.children, parentItems);
          if (found) return found;
        }
      }
      return null;
    };

    return traverse(tree.children || [], []);
  }

  /**
   * TODO.mdベースの自律実行モード
   */
  async runAutonomous(): Promise<void> {
    console.log(chalk.bold.green("\n🌌 Iori Kernel v3.0: Autonomous Mode Started"));
    await this.log("Autonomous mode started", "INFO");

    while (true) {
      // TODO.md読み込み
      let todoContent = "";
      try {
        todoContent = await fs.readFile(this.config.todoFile, "utf-8");
      } catch {
        console.log(chalk.red(`❌ ${this.config.todoFile} not found. Creating template...`));
        await fs.writeFile(
          this.config.todoFile,
          "- [ ] Sample Task: Create a hello world utility function\n"
        );
        continue;
      }

      const lines = todoContent.split("\n");
      const taskInfo = this.extractContextAwareTask(todoContent);

      if (!taskInfo) {
        console.log(chalk.green("\n💤 No tasks left. Iori is standing by."));
        await this.log("No pending tasks. Standing by.", "INFO");
        break;
      }

      const taskTitle = taskInfo.title;
      const taskDescription = taskInfo.description;

      console.log(chalk.yellow(`\n📋 Processing Task: "${taskTitle}"`));
      console.log(chalk.gray(`   Full description: ${taskDescription.length} chars`));

      // タスクをC3Lコマンドとして実行
      // 簡易的にタスク内容を "implement code" として実行
      const result = await this.executeC3L("implement", "code", {
        input_content: taskDescription
      });

      if (result.success) {
        // タスク完了マーク
        let marked = false;
        if (taskInfo.line) {
          const lineIndex = taskInfo.line - 1;
          if (lineIndex >= 0 && lineIndex < lines.length) {
            lines[lineIndex] = lines[lineIndex].replace("- [ ]", "- [x]");
            marked = true;
          }
        }
        if (!marked) {
          const fallbackIndex = lines.findIndex(line => line.trim().startsWith("- [ ]"));
          if (fallbackIndex !== -1) {
            lines[fallbackIndex] = lines[fallbackIndex].replace("- [ ]", "- [x]");
          }
        }
        await fs.writeFile(this.config.todoFile, lines.join("\n"));
        console.log(chalk.green(`✅ Task completed: ${taskDescription}`));
      } else {
        console.error(chalk.red(`❌ Task failed: ${taskDescription}`));
        // 失敗したタスクはスキップせずに停止
        break;
      }

      // レート制限回避
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  /**
   * Shellコマンドを直接実行
   */
  async executeShell(command: string, cwd?: string): Promise<string> {
    console.log(chalk.blue(`\n💻 Executing Shell Command: ${command}`));
    await this.log(`Shell command: ${command}`);
    try {
      const output = await this.shell.exec(command, cwd);
      await this.log(`Shell command succeeded: ${command}`, "SUCCESS");
      return output;
    } catch (error: any) {
      await this.log(`Shell command failed: ${error.message}`, "ERROR");
      throw error;
    }
  }

  /**
   * C3L利用可能コマンド一覧を表示
   */
  async listC3LCommands(): Promise<string[]> {
    return await this.c3l.listCommands();
  }

  /**
   * カーネルの初期化
   */
  async init(): Promise<void> {
    await this.c3l.init();
    console.log(chalk.green("✅ Iori Kernel v3.0 initialized"));
  }
}
