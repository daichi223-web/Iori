// src/core/agent-pool.ts
import { TmuxDriver, TmuxPane } from "./tmux-driver.js";
import { C3LEngine } from "./c3l.js";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

export type AgentRole = "ARCHITECT" | "DEVELOPER" | "TESTER";

export interface Agent {
  id: string;
  role: AgentRole;
  pane: TmuxPane;
  status: "IDLE" | "WORKING" | "ERROR";
  currentTask?: string;
}

export class AgentPool {
  private tmux: TmuxDriver;
  private c3l: C3LEngine;
  private agents: Agent[] = [];
  private agentCounter = 0;

  constructor(sessionName: string = "iori-agents") {
    this.tmux = new TmuxDriver(sessionName);
    this.c3l = new C3LEngine();
  }

  // プールを初期化
  async init() {
    await this.c3l.init();
    await this.tmux.createSession();
    console.log(chalk.green("🌌 Agent Pool initialized."));
  }

  // 新しいエージェントを生成
  async spawnAgent(role: AgentRole): Promise<Agent> {
    const pane = await this.tmux.createPane();
    const agentId = `${role.toLowerCase()}-${String(this.agentCounter++).padStart(2, '0')}`;

    const agent: Agent = {
      id: agentId,
      role: role,
      pane: pane,
      status: "IDLE"
    };

    this.agents.push(agent);

    // エージェント状態ファイルを作成
    const agentDir = path.join(".iori", "agents", agentId);
    await fs.mkdir(agentDir, { recursive: true });
    await fs.writeFile(
      path.join(agentDir, "status.json"),
      JSON.stringify({ ...agent, pane: agent.pane.id }, null, 2)
    );

    console.log(chalk.cyan(`  🤖 Spawned ${role} agent: ${agentId}`));
    return agent;
  }

  // エージェントにタスクを割り当て
  async assignTask(
    agent: Agent,
    directive: string,
    layer: string,
    context: any
  ): Promise<void> {
    agent.status = "WORKING";
    agent.currentTask = `${directive} ${layer}`;

    // C3Lエンジンでプロンプトを生成
    const prompt = await this.c3l.transpile(directive, layer, context);

    // 一時ファイルにプロンプトを保存
    const tempDir = path.join(".iori", "agents", agent.id);
    const promptFile = path.join(tempDir, `prompt_${Date.now()}.md`);
    await fs.writeFile(promptFile, prompt);

    // Claude Codeにプロンプトを送信
    const command = `cat "${promptFile}" | claude --print > output_${Date.now()}.md`;
    await this.tmux.sendCommand(agent.pane, command);

    console.log(chalk.yellow(`  📋 Assigned to ${agent.id}: ${directive} ${layer}`));

    // 状態更新
    await this.updateAgentStatus(agent);
  }

  // エージェントの状態を更新
  private async updateAgentStatus(agent: Agent): Promise<void> {
    const statusFile = path.join(".iori", "agents", agent.id, "status.json");
    await fs.writeFile(
      statusFile,
      JSON.stringify({
        id: agent.id,
        role: agent.role,
        pane: agent.pane.id,
        status: agent.status,
        currentTask: agent.currentTask,
        lastUpdate: new Date().toISOString()
      }, null, 2)
    );
  }

  // 全エージェントの状態をチェック
  async checkAgents(): Promise<void> {
    for (const agent of this.agents) {
      const isIdle = await this.tmux.isIdle(agent.pane);
      if (isIdle && agent.status === "WORKING") {
        agent.status = "IDLE";
        agent.currentTask = undefined;
        console.log(chalk.green(`  ✅ ${agent.id} completed task.`));
        await this.updateAgentStatus(agent);
      }
    }
  }

  // IDLEなエージェントを取得
  getIdleAgents(role?: AgentRole): Agent[] {
    return this.agents.filter(a =>
      a.status === "IDLE" && (!role || a.role === role)
    );
  }

  // 全エージェントの状態を表示
  async displayStatus(): Promise<void> {
    console.log(chalk.magenta("\n📊 Agent Status:"));
    for (const agent of this.agents) {
      const statusIcon = agent.status === "IDLE" ? "💤" :
                        agent.status === "WORKING" ? "⚙️" : "❌";
      console.log(`  ${statusIcon} ${agent.id.padEnd(15)} | ${agent.status.padEnd(8)} | ${agent.currentTask || "-"}`);
    }
  }

  // セッションをクリーンアップ
  async cleanup(): Promise<void> {
    await this.tmux.killSession();
    console.log(chalk.red("🧹 Agent pool cleaned up."));
  }

  // セッションにアタッチするためのヒントを表示
  showAttachHint(): void {
    this.tmux.attachSession();
  }
}
