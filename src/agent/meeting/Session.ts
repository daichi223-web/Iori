/**
 * Trinity Protocol - Session
 * 会議の進行管理（司会進行）
 */
import { exec } from "child_process";
import { promisify } from "util";
import {
  PERSONAS,
  MEETING_ORDER,
  buildPrompt,
  AIProvider,
  Persona
} from "./Personas.js";
import { MinutesManager, TaskItem } from "./Minutes.js";

const execPromise = promisify(exec);

/** 会議設定 */
export interface MeetingConfig {
  maxRounds: number;
  timeout: number; // ms
  projectRoot: string;
}

/** 会議結果 */
export interface MeetingResult {
  success: boolean;
  meetingId: string;
  topic: string;
  rounds: number;
  decisions: string[];
  tasks: TaskItem[];
  finalSpec?: string;
  formattedMinutes: string;
  error?: string;
}

/** 進捗コールバック */
export type ProgressCallback = (event: MeetingEvent) => void;

/** 会議イベント */
export interface MeetingEvent {
  type: "start" | "round_start" | "statement" | "round_end" | "finalizing" | "complete" | "error";
  round?: number;
  speaker?: string;
  emoji?: string;
  content?: string;
  error?: string;
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
    .replace(/\r/g, "")
    .trim();
}

/**
 * AI CLIコマンドを生成
 */
function getAiCommand(provider: AIProvider, prompt: string): string {
  const escaped = prompt.replace(/'/g, "'\\''");

  switch (provider) {
    case "gemini":
      return `gemini -p '${escaped}'`;
    case "codex":
      return `codex exec '${escaped}'`;
    case "claude":
    default:
      return `claude -p '${escaped}' --model sonnet`;
  }
}

/**
 * AIに発言を求める
 */
async function askAgent(
  persona: Persona,
  prompt: string,
  config: MeetingConfig
): Promise<string> {
  const command = getAiCommand(persona.provider, prompt);

  try {
    const result = await execPromise(command, {
      timeout: config.timeout,
      maxBuffer: 1024 * 1024 * 10,
      cwd: config.projectRoot,
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" }
    });

    return cleanAnsi(result.stdout);
  } catch (error) {
    const execError = error as Error & { stdout?: string };
    if (execError.stdout) {
      return cleanAnsi(execError.stdout);
    }
    throw new Error(`${persona.name} failed: ${execError.message}`);
  }
}

/**
 * 最終仕様書を生成
 */
async function generateFinalSpec(
  topic: string,
  context: string[],
  config: MeetingConfig
): Promise<string> {
  const prompt = `あなたはIoriシステムの仕様書作成担当です。

以下の会議議論を踏まえ、実装可能な仕様書を作成してください。

【議題】
${topic}

【会議の議論】
${context.join("\n")}

【出力フォーマット】
## 概要
（1-2文で説明）

## 機能要件
- （箇条書きで列挙）

## UI/UX仕様
- （デザイン要件）

## 技術仕様
- （実装方針）

## タスクリスト
1. （優先度順にタスクを列挙）

## 注意事項
- （懸念点や制約）`;

  const command = getAiCommand("claude", prompt);

  const result = await execPromise(command, {
    timeout: config.timeout,
    maxBuffer: 1024 * 1024 * 10,
    cwd: config.projectRoot,
    env: { ...process.env, TERM: "dumb", NO_COLOR: "1" }
  });

  return cleanAnsi(result.stdout);
}

/**
 * 仕様書からタスクを抽出
 */
function extractTasks(finalSpec: string): Omit<TaskItem, "id" | "status">[] {
  const tasks: Omit<TaskItem, "id" | "status">[] = [];
  const lines = finalSpec.split("\n");

  let inTaskSection = false;
  let taskIndex = 0;

  for (const line of lines) {
    if (line.includes("タスクリスト") || line.includes("## タスク")) {
      inTaskSection = true;
      continue;
    }

    if (inTaskSection) {
      // 次のセクションに移ったら終了
      if (line.startsWith("## ") || line.startsWith("# ")) {
        inTaskSection = false;
        continue;
      }

      // 番号付きリストまたは箇条書きを検出
      const match = line.match(/^(?:\d+\.|[-*])\s*(.+)$/);
      if (match) {
        taskIndex++;
        const priority = taskIndex <= 2 ? "high" : taskIndex <= 5 ? "medium" : "low";
        tasks.push({
          title: match[1].trim(),
          description: `会議で決定されたタスク #${taskIndex}`,
          priority
        });
      }
    }
  }

  return tasks;
}

/**
 * Trinity Protocol 会議セッション
 */
export class MeetingSession {
  private config: MeetingConfig;
  private context: string[] = [];
  private minutesManager: MinutesManager;
  private onProgress?: ProgressCallback;

  constructor(
    topic: string,
    config: Partial<MeetingConfig> & { projectRoot: string },
    onProgress?: ProgressCallback
  ) {
    this.config = {
      maxRounds: config.maxRounds ?? 3,
      timeout: config.timeout ?? 120000, // 2分
      projectRoot: config.projectRoot
    };
    this.minutesManager = new MinutesManager(topic, config.projectRoot);
    this.onProgress = onProgress;
  }

  /**
   * 進捗イベントを発火
   */
  private emit(event: MeetingEvent): void {
    if (this.onProgress) {
      this.onProgress(event);
    }
  }

  /**
   * 会議を開始
   */
  async start(topic: string): Promise<MeetingResult> {
    console.log(`🔨 Starting Trinity Protocol for: ${topic}`);
    this.emit({ type: "start" });

    try {
      // 各ラウンドを実行
      for (let round = 1; round <= this.config.maxRounds; round++) {
        await this.runRound(topic, round);
      }

      // 最終仕様書を生成
      this.emit({ type: "finalizing" });
      console.log("📝 Generating final specification...");

      const finalSpec = await generateFinalSpec(topic, this.context, this.config);
      this.minutesManager.setFinalSpec(finalSpec);

      // タスクを抽出
      const taskItems = extractTasks(finalSpec);
      for (const task of taskItems) {
        this.minutesManager.addTask(task);
      }

      // 決定事項を追加
      this.minutesManager.addDecision(`${topic} の実装計画が策定されました`);

      // 会議を完了
      this.minutesManager.complete();
      await this.minutesManager.save();

      const minutes = this.minutesManager.getMinutes();

      this.emit({ type: "complete" });

      return {
        success: true,
        meetingId: minutes.id,
        topic,
        rounds: this.config.maxRounds,
        decisions: minutes.decisions,
        tasks: minutes.tasks,
        finalSpec,
        formattedMinutes: this.minutesManager.formatMinutes()
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("❌ Meeting failed:", errorMessage);

      this.minutesManager.fail();
      await this.minutesManager.save();

      this.emit({ type: "error", error: errorMessage });

      return {
        success: false,
        meetingId: this.minutesManager.getMinutes().id,
        topic,
        rounds: 0,
        decisions: [],
        tasks: [],
        formattedMinutes: this.minutesManager.formatMinutes(),
        error: errorMessage
      };
    }
  }

  /**
   * 1ラウンドを実行
   */
  private async runRound(topic: string, round: number): Promise<void> {
    console.log(`\n📍 Round ${round}/${this.config.maxRounds}`);
    this.emit({ type: "round_start", round });

    for (const role of MEETING_ORDER) {
      const persona = PERSONAS[role];
      console.log(`  ${persona.emoji} ${persona.name} is thinking...`);

      const prompt = buildPrompt(
        persona,
        topic,
        this.context,
        round,
        this.config.maxRounds
      );

      const response = await askAgent(persona, prompt, this.config);

      // コンテキストに追加
      this.context.push(`[${persona.name}]: ${response}`);

      // 議事録に記録
      this.minutesManager.addStatement({
        round,
        role,
        speaker: persona.name,
        emoji: persona.emoji,
        content: response
      });

      // 進捗イベント
      this.emit({
        type: "statement",
        round,
        speaker: persona.name,
        emoji: persona.emoji,
        content: response
      });

      console.log(`  ${persona.emoji} ${persona.name}: ${response.slice(0, 100)}...`);
    }

    this.emit({ type: "round_end", round });
  }
}

/**
 * 会議を開始するヘルパー関数
 */
export async function startMeeting(
  topic: string,
  projectRoot: string,
  options?: {
    maxRounds?: number;
    timeout?: number;
    onProgress?: ProgressCallback;
  }
): Promise<MeetingResult> {
  const session = new MeetingSession(
    topic,
    {
      projectRoot,
      maxRounds: options?.maxRounds,
      timeout: options?.timeout
    },
    options?.onProgress
  );

  return session.start(topic);
}
