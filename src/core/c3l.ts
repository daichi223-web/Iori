// src/core/c3l.ts
import fs from "fs/promises";
import path from "path";

// 定義ファイルのパス
const C3L_BASE = ".iori/c3l";
const DEF_FILE = path.join(C3L_BASE, "definitions.json");

export interface C3LContext {
  [key: string]: string; // 変数 (input_content, timestamp, etc.)
}

export class C3LEngine {
  private definitions: any = null;

  // 初期化：辞書を読み込む
  async init() {
    try {
      const data = await fs.readFile(DEF_FILE, "utf-8");
      this.definitions = JSON.parse(data);
    } catch (e) {
      throw new Error(`C3L Definitions not found at ${DEF_FILE}. Run install_v3.ts first.`);
    }
  }

  // C3Lコマンドを解析し、プロンプトを生成する (Climpt相当機能)
  async transpile(directive: string, layer: string, context: C3LContext): Promise<string> {
    if (!this.definitions) await this.init();

    // 1. コマンドの検索
    const cmd = this.definitions.commands.find(
      (c: any) => c.directive === directive && c.layer === layer
    );

    if (!cmd) {
      throw new Error(`🚫 C3L Command Not Found: ${directive} ${layer}`);
    }

    // 2. テンプレートの読み込み
    const templatePath = path.join(C3L_BASE, "prompts", cmd.template);
    let content = "";
    try {
      content = await fs.readFile(templatePath, "utf-8");
    } catch (e) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    // 3. 変数置換 (Mustache風: {{variable}})
    // 標準変数とユーザー変数をマージ
    const vars: C3LContext = {
      timestamp: new Date().toISOString(),
      ...context
    };

    const compiled = content.replace(/\{\{([\w_]+)\}\}/g, (_, key: string) => {
      return vars[key] || `(MISSING_VAR: ${key})`;
    });

    return compiled;
  }

  // 利用可能なコマンド一覧を取得
  async listCommands() {
    if (!this.definitions) await this.init();
    return this.definitions.commands.map((c: any) =>
      `${c.role.padEnd(10)} | ${c.directive} ${c.layer}`
    );
  }
}
