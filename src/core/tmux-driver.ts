// src/core/tmux-driver.ts
import { exec } from "child_process";
import util from "util";
import chalk from "chalk";

const execPromise = util.promisify(exec);

export interface TmuxPane {
  session: string;
  window: number;
  pane: number;
  id: string; // tmux pane ID (e.g., "%1")
}

export class TmuxDriver {
  private sessionName: string;

  constructor(sessionName: string = "iori-agents") {
    this.sessionName = sessionName;
  }

  // セッションが存在するか確認
  async sessionExists(): Promise<boolean> {
    try {
      await execPromise(`tmux has-session -t ${this.sessionName} 2>&1`);
      return true;
    } catch {
      return false;
    }
  }

  // 新しいセッションを作成（detached mode）
  async createSession(): Promise<void> {
    const exists = await this.sessionExists();
    if (exists) {
      console.log(chalk.yellow(`  ⚠️  Session '${this.sessionName}' already exists. Reusing.`));
      return;
    }

    await execPromise(`tmux new-session -d -s ${this.sessionName}`);
    console.log(chalk.green(`  ✅ Created tmux session: ${this.sessionName}`));
  }

  // 新しいpaneを作成（水平分割）
  async createPane(): Promise<TmuxPane> {
    // 最初のpaneは既に存在するので、2つ目以降はsplit-window
    const { stdout } = await execPromise(
      `tmux split-window -h -t ${this.sessionName} -P -F "#{pane_id}"`
    );
    const paneId = stdout.trim();

    console.log(chalk.cyan(`  🔲 Created pane: ${paneId}`));

    return {
      session: this.sessionName,
      window: 0,
      pane: 0,
      id: paneId
    };
  }

  // 指定したpaneにコマンドを送信
  async sendCommand(pane: TmuxPane, command: string): Promise<void> {
    // tmux send-keys -t <pane_id> "command" Enter
    const escapedCommand = command.replace(/"/g, '\\"');
    await execPromise(`tmux send-keys -t ${pane.id} "${escapedCommand}" Enter`);
    console.log(chalk.blue(`  📤 Sent to ${pane.id}: ${command.substring(0, 50)}...`));
  }

  // paneの内容をキャプチャ（最後のN行を取得）
  async capturePane(pane: TmuxPane, lines: number = 20): Promise<string> {
    const { stdout } = await execPromise(
      `tmux capture-pane -t ${pane.id} -p -S -${lines}`
    );
    return stdout;
  }

  // paneがIDLE状態かどうかを判定（最終行がプロンプト記号で終わっているか）
  async isIdle(pane: TmuxPane): Promise<boolean> {
    const content = await this.capturePane(pane, 5);
    const lines = content.trim().split("\n");
    const lastLine = lines[lines.length - 1] || "";

    // シェルプロンプト記号を検出（$, >, #など）
    // ※ より厳密には、プロセス状態をチェックする必要がある
    return /[$>#]\s*$/.test(lastLine);
  }

  // セッションを終了
  async killSession(): Promise<void> {
    try {
      await execPromise(`tmux kill-session -t ${this.sessionName}`);
      console.log(chalk.red(`  🗑️  Killed session: ${this.sessionName}`));
    } catch (e) {
      // セッションが存在しない場合は無視
    }
  }

  // 全paneをリスト
  async listPanes(): Promise<TmuxPane[]> {
    try {
      const { stdout } = await execPromise(
        `tmux list-panes -t ${this.sessionName} -F "#{pane_id}"`
      );
      const paneIds = stdout.trim().split("\n");

      return paneIds.map(id => ({
        session: this.sessionName,
        window: 0,
        pane: 0,
        id: id
      }));
    } catch {
      return [];
    }
  }

  // セッションにアタッチ（開発中の確認用）
  attachSession() {
    console.log(chalk.magenta(`\n💡 To attach to session, run:\n   tmux attach -t ${this.sessionName}\n`));
  }
}
