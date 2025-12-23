/**
 * Trinity Protocol - Minutes
 * 議事録・決定事項の保存
 */
import fs from "fs/promises";
import path from "path";
import { AgentRole } from "./Personas.js";

/** 発言記録 */
export interface Statement {
  round: number;
  role: AgentRole;
  speaker: string;
  emoji: string;
  content: string;
  timestamp: string;
}

/** タスクアイテム */
export interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  assignee?: AgentRole;
  status: "pending" | "in_progress" | "completed";
}

/** 会議議事録 */
export interface MeetingMinutes {
  id: string;
  topic: string;
  startedAt: string;
  endedAt?: string;
  rounds: number;
  statements: Statement[];
  decisions: string[];
  tasks: TaskItem[];
  finalSpec?: string;
  status: "in_progress" | "completed" | "failed";
}

/**
 * 議事録マネージャー
 */
export class MinutesManager {
  private minutes: MeetingMinutes;
  private savePath: string;

  constructor(topic: string, projectRoot: string) {
    const id = `meeting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    this.minutes = {
      id,
      topic,
      startedAt: new Date().toISOString(),
      rounds: 0,
      statements: [],
      decisions: [],
      tasks: [],
      status: "in_progress"
    };

    this.savePath = path.join(projectRoot, ".iori", "meetings", `${id}.json`);
  }

  /**
   * 発言を記録
   */
  addStatement(statement: Omit<Statement, "timestamp">): void {
    this.minutes.statements.push({
      ...statement,
      timestamp: new Date().toISOString()
    });
    this.minutes.rounds = Math.max(this.minutes.rounds, statement.round);
  }

  /**
   * 決定事項を追加
   */
  addDecision(decision: string): void {
    this.minutes.decisions.push(decision);
  }

  /**
   * タスクを追加
   */
  addTask(task: Omit<TaskItem, "id" | "status">): TaskItem {
    const newTask: TaskItem = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: "pending"
    };
    this.minutes.tasks.push(newTask);
    return newTask;
  }

  /**
   * 最終仕様書をセット
   */
  setFinalSpec(spec: string): void {
    this.minutes.finalSpec = spec;
  }

  /**
   * 会議を完了
   */
  complete(): void {
    this.minutes.status = "completed";
    this.minutes.endedAt = new Date().toISOString();
  }

  /**
   * 会議を失敗としてマーク
   */
  fail(): void {
    this.minutes.status = "failed";
    this.minutes.endedAt = new Date().toISOString();
  }

  /**
   * 議事録を取得
   */
  getMinutes(): MeetingMinutes {
    return { ...this.minutes };
  }

  /**
   * 議事録をファイルに保存
   */
  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.savePath), { recursive: true });
    await fs.writeFile(this.savePath, JSON.stringify(this.minutes, null, 2));
  }

  /**
   * フォーマットされた議事録を生成
   */
  formatMinutes(): string {
    const lines: string[] = [
      "================================================================================",
      `                    TRINITY PROTOCOL - 議事録`,
      "================================================================================",
      "",
      `議題: ${this.minutes.topic}`,
      `開始: ${this.minutes.startedAt}`,
      `終了: ${this.minutes.endedAt || "進行中"}`,
      `ラウンド数: ${this.minutes.rounds}`,
      `ステータス: ${this.minutes.status}`,
      "",
      "--------------------------------------------------------------------------------",
      "                              発言記録",
      "--------------------------------------------------------------------------------",
      ""
    ];

    // グループ by round
    const roundGroups = new Map<number, Statement[]>();
    for (const stmt of this.minutes.statements) {
      const existing = roundGroups.get(stmt.round) || [];
      existing.push(stmt);
      roundGroups.set(stmt.round, existing);
    }

    for (const [round, statements] of roundGroups) {
      lines.push(`【ラウンド ${round}】`);
      lines.push("");
      for (const stmt of statements) {
        lines.push(`${stmt.emoji} [${stmt.speaker}]`);
        lines.push(stmt.content);
        lines.push("");
      }
      lines.push("");
    }

    if (this.minutes.decisions.length > 0) {
      lines.push("--------------------------------------------------------------------------------");
      lines.push("                              決定事項");
      lines.push("--------------------------------------------------------------------------------");
      lines.push("");
      for (const decision of this.minutes.decisions) {
        lines.push(`  - ${decision}`);
      }
      lines.push("");
    }

    if (this.minutes.tasks.length > 0) {
      lines.push("--------------------------------------------------------------------------------");
      lines.push("                              タスクリスト");
      lines.push("--------------------------------------------------------------------------------");
      lines.push("");
      for (const task of this.minutes.tasks) {
        const priorityIcon = { high: "🔴", medium: "🟡", low: "🟢" }[task.priority];
        lines.push(`  ${priorityIcon} [${task.priority.toUpperCase()}] ${task.title}`);
        lines.push(`     ${task.description}`);
        lines.push("");
      }
    }

    if (this.minutes.finalSpec) {
      lines.push("--------------------------------------------------------------------------------");
      lines.push("                              最終仕様書");
      lines.push("--------------------------------------------------------------------------------");
      lines.push("");
      lines.push(this.minutes.finalSpec);
    }

    lines.push("");
    lines.push("================================================================================");
    lines.push("                           END OF MINUTES");
    lines.push("================================================================================");

    return lines.join("\n");
  }
}

/**
 * 保存された議事録を読み込む
 */
export async function loadMinutes(
  projectRoot: string,
  meetingId: string
): Promise<MeetingMinutes | null> {
  try {
    const filePath = path.join(projectRoot, ".iori", "meetings", `${meetingId}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as MeetingMinutes;
  } catch {
    return null;
  }
}

/**
 * 全ての議事録を一覧取得
 */
export async function listMeetings(projectRoot: string): Promise<MeetingMinutes[]> {
  try {
    const dirPath = path.join(projectRoot, ".iori", "meetings");
    const files = await fs.readdir(dirPath);
    const meetings: MeetingMinutes[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await fs.readFile(path.join(dirPath, file), "utf-8");
        meetings.push(JSON.parse(content) as MeetingMinutes);
      }
    }

    return meetings.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  } catch {
    return [];
  }
}
