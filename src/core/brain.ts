// src/core/brain.ts
import { exec } from "child_process";
import util from "util";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const execPromise = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 3つの脳（すべてCLIツール経由）
export type BrainProvider = 'CLAUDE' | 'CODEX' | 'GEMINI';

export async function think(
  instruction: string,
  context: string = "",
  provider: BrainProvider = 'CLAUDE'
): Promise<string> {

  console.log(chalk.cyan(`🤖 Iori System: Invoking [${provider}] CLI...`));

  // 一時ファイルを使ってエスケープ問題を完全回避
  const safeContext = context.slice(0, 50000);
  const fullPrompt = `${instruction}\n\n[CONTEXT]\n${safeContext}\n\nOutput raw code only.`;

  // 一時ファイルパス（.iori_temp/ ディレクトリに保存）
  const tempDir = path.join(process.cwd(), '.iori_temp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, `prompt_${Date.now()}_${provider}.txt`);

  // 一時ファイルにプロンプトを書き込み
  await fs.writeFile(tempFile, fullPrompt, 'utf-8');

  let command = "";

  switch (provider) {
    case 'CLAUDE':
      // Claude Code: 一時ファイルから読み込んで渡す
      command = `cat "${tempFile}" | claude --print`;
      break;

    case 'GEMINI':
      // Gemini CLI: 一時ファイルから読み込んで渡す
      command = `cat "${tempFile}" | gemini`;
      break;

    case 'CODEX':
      // Codex CLI: 一時ファイルから読み込んで渡す
      command = `cat "${tempFile}" | codex exec --skip-git-repo-check -`;
      break;
  }

  try {
    // コマンド実行 (タイムアウト5分)
    // maxBufferを増やして大きな出力に対応
    const { stdout, stderr } = await execPromise(command, {
      timeout: 300000,
      maxBuffer: 1024 * 1024 * 20, // 20MB
      shell: '/bin/bash'
    });

    if (stderr) {
      // エラーではないログ出力の場合もあるのでwarnで表示
      // console.warn(chalk.gray(`(${provider} stderr): ${stderr}`));
    }

    return stdout.trim();

  } catch (error: any) {
    console.error(chalk.red(`💥 ${provider} CLI Failed:`), error.message);

    // エラー時の自動フェイルオーバー
    // Geminiがコケたら、最強のClaudeに任せる
    if (provider === 'GEMINI') {
      console.log(chalk.yellow("⚠️ Gemini failed. Escalating to Claude..."));
      // フェイルオーバー前に一時ファイルを削除
      await fs.unlink(tempFile).catch(() => {});
      return think(instruction, context, 'CLAUDE');
    }

    return `// Error: ${provider} could not generate response.`;
  } finally {
    // 一時ファイルのクリーンアップ（エラーでも必ず実行）
    await fs.unlink(tempFile).catch(() => {});
  }
}
