// src/core/shell.ts
import { spawn, ChildProcess } from "child_process";
import chalk from "chalk";

/**
 * Iori Shell Controller
 * OSのプロセスを直接制御し、AIエージェントの「手足」となるクラス
 */
export class ShellController {
  private process: ChildProcess | null = null;
  private isWindows: boolean = process.platform === "win32";

  /**
   * コマンドを実行し、出力をリアルタイムで監視する
   * @param command 実行するコマンド (例: "npm install")
   * @param cwd 実行ディレクトリ (省略時はカレント)
   */
  async exec(command: string, cwd: string = process.cwd()): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(chalk.blue(`\n🤖 [SHELL] Executing: ${command}`));

      // WindowsとLinux/Macでシェルの呼び出し方を変える
      const shell = this.isWindows ? "powershell.exe" : "/bin/sh";
      const args = this.isWindows ? ["-c", command] : ["-c", command];

      // プロセス起動
      this.process = spawn(shell, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"], // stdinは無視, stdout/errはパイプ
        env: process.env, // 環境変数を継承
      });

      let outputBuffer = "";

      // 標準出力 (stdout) の監視
      this.process.stdout?.on("data", (data) => {
        const line = data.toString();
        process.stdout.write(chalk.dim(line)); // 画面にも薄く表示
        outputBuffer += line;
      });

      // 標準エラー (stderr) の監視
      this.process.stderr?.on("data", (data) => {
        const line = data.toString();
        process.stderr.write(chalk.red(line)); // エラーは赤く表示
        outputBuffer += line;
      });

      // プロセス終了時の処理
      this.process.on("close", (code) => {
        this.process = null;
        if (code === 0) {
          console.log(chalk.green(`✅ [SHELL] Command finished successfully.`));
          resolve(outputBuffer);
        } else {
          console.log(chalk.red(`❌ [SHELL] Command failed with code ${code}.`));
          reject(new Error(`Command failed: ${command}\nOutput: ${outputBuffer}`));
        }
      });

      this.process.on("error", (err) => {
        this.process = null;
        reject(err);
      });
    });
  }

  /**
   * 実行中のプロセスを強制終了する
   */
  kill() {
    if (this.process) {
      console.log(chalk.yellow("\n⚠️ [SHELL] Killing process..."));
      this.process.kill();
      this.process = null;
    }
  }
}
