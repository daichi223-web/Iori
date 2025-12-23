# Iori v4.0 要件定義書: VSCode型 Electron移行

## 1. 概要

### 1.1 目的
IoriをElectron上で動作させ、VSCodeに近い統合型開発環境（ローカルIDE）として機能させる。
Claude CLIなどの強力なAI CLIツールを統合し、UI・入出力・プロジェクト管理・自己更新を一貫したUXで提供する。

### 1.2 アーキテクチャ概念図

```
┌─────────────────────────────────────────────────────────────────┐
│                    Iori v4.0 (Electron)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Renderer Process                        │   │
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  │   │
│  │  │ Cockpit UI    │ │ Neural Console│ │ DoD Progress  │  │   │
│  │  │ (Dashboard)   │ │ (Terminal)    │ │ (Checklist)   │  │   │
│  │  └───────────────┘ └───────────────┘ └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │ IPC                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Main Process                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ CLI Bridge  │  │ State Mgr   │  │ Git Manager │      │   │
│  │  │ (node-pty)  │  │ (.iori/)    │  │ (gh CLI)    │      │   │
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘      │   │
│  └─────────┼───────────────────────────────────────────────┘   │
└────────────┼───────────────────────────────────────────────────┘
             │ stdin/stdout (node-pty)
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AI CLI Workers                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Claude CLI  │  │ Codex CLI   │  │ Gemini CLI  │             │
│  │ (claude)    │  │ (codex)     │  │ (gemini)    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 VSCodeとの比較

| 項目 | VSCode | Iori v4.0 |
|------|--------|-----------|
| ベース | Electron | Electron |
| 拡張機能 | Extension Host | CLI Workers (node-pty) |
| 通信方式 | JSON-RPC over IPC | IPC + stdin/stdout |
| 言語サポート | LSP | AI CLI (Claude/Codex/Gemini) |
| プロジェクト管理 | .vscode/ | .iori/ |

---

## 2. 機能要件 (Functional Requirements)

### 2.1 アーキテクチャ統合 (VSCode型)

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-2.1.1 | Electronベースのデスクトップアプリとして起動 | P0 |
| FR-2.1.2 | Node.js + node-pty でAI CLIとの双方向非同期通信 | P0 |
| FR-2.1.3 | Frontend は既存 Cockpit UI（HTML/TS）を活用 | P0 |
| FR-2.1.4 | Main Process と Renderer Process の分離 | P0 |
| FR-2.1.5 | contextBridge による安全なIPC通信 | P1 |

### 2.2 入出力と表示レイヤー

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-2.2.1 | Neural Console で指示送信 | P0 |
| FR-2.2.2 | CLI出力をリアルタイム表示 (ストリーミング) | P0 |
| FR-2.2.3 | system.log への自動保存 | P1 |
| FR-2.2.4 | command history の保持と検索 | P1 |
| FR-2.2.5 | mock snapshots への自動保存 | P2 |
| FR-2.2.6 | Markdownベースの入力/プレビューエリア | P2 |

### 2.3 プロジェクト状態管理

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-2.3.1 | `.iori/project.json` で現在のプロンプト・進捗・DoD状態を保存 | P0 |
| FR-2.3.2 | `.iori/logs/` で時系列ログを保存 | P1 |
| FR-2.3.3 | `.iori/mocks/` でスナップショット・UIプレビューを保存 | P2 |
| FR-2.3.4 | `.iori/config.json` でユーザー設定を保存 | P1 |

#### ディレクトリ構造

```
.iori/
├── project.json      # プロジェクト状態
├── config.json       # ユーザー設定
├── logs/
│   ├── system.log    # システムログ
│   ├── claude.log    # Claude CLI ログ
│   ├── codex.log     # Codex CLI ログ
│   └── gemini.log    # Gemini CLI ログ
├── mocks/
│   └── snapshot_*.json
└── history/
    └── commands.json # コマンド履歴
```

### 2.4 完成度可視化とDoD強制

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-2.4.1 | DOD.md に基づいたチェックリスト進捗パネル | P0 |
| FR-2.4.2 | `/api/progress` で完成率・未完項目・次WUを返す | P0 |
| FR-2.4.3 | DoD未達時は "done" 表示禁止 | P1 |
| FR-2.4.4 | 進捗バーのリアルタイム更新 | P1 |

### 2.5 Git/GitHub連携

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-2.5.1 | `gh` CLIを経由したプロジェクト push/pull | P1 |
| FR-2.5.2 | 自己更新（Iori構成やログのGit同期） | P2 |
| FR-2.5.3 | コミットメッセージの自動生成 | P2 |
| FR-2.5.4 | ブランチ管理UI | P3 |

### 2.6 拡張性とプラグイン

| ID | 要件 | 優先度 |
|----|------|--------|
| FR-2.6.1 | Claude / Codex / Gemini CLI を Worker として扱える | P0 |
| FR-2.6.2 | 新規エージェントプロセスを spawn（並列処理） | P1 |
| FR-2.6.3 | 複数エージェントの可視化と並列実行 | P1 |
| FR-2.6.4 | トレース機能（実行履歴の可視化） | P2 |
| FR-2.6.5 | カスタムCLIツールの追加サポート | P3 |

---

## 3. 非機能要件 (Non-Functional Requirements)

| ID | 要件 | 詳細 | 優先度 |
|----|------|------|--------|
| NFR-3.1 | ローカル完結 | 外部APIキー不要、CLIのみで動作 | P0 |
| NFR-3.2 | 軽量動作 | メモリ使用量 500MB 以下 | P1 |
| NFR-3.3 | データ永続化 | ファイルベースで保存（SQLite不要） | P0 |
| NFR-3.4 | クロスプラットフォーム | Windows (WSL), macOS, Linux | P1 |
| NFR-3.5 | 起動時間 | 3秒以内に使用可能状態 | P2 |
| NFR-3.6 | セキュリティ | nodeIntegration: false, contextIsolation: true | P0 |

---

## 4. 技術スタック

| レイヤー | 技術 |
|---------|------|
| デスクトップフレームワーク | Electron 28+ |
| ランタイム | Node.js 18+ |
| 言語 | TypeScript (Strict Mode) |
| CLI通信 | node-pty |
| Frontend | HTML5 + CSS3 + Vanilla TS |
| ビルド | electron-builder |
| テスト | Vitest + Playwright |
| パッケージマネージャー | npm |

---

## 5. ロードマップ

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 6 ──→ Phase 7 ──→ Final
Electron化   CLI Bridge   状態管理    DoD導入    Git連携    並列Agent   安定化     v4.0
```

### Phase 1: Electron化（既存UI移植）
**目的**: ローカルアプリ化

| タスク | 完了条件 |
|--------|----------|
| Electron プロジェクト構成 | `electron/` ディレクトリ作成 |
| main.ts 作成 | BrowserWindow で index.html 表示 |
| preload.ts 作成 | contextBridge 設定 |
| 既存 Cockpit UI 統合 | ダッシュボードが表示される |
| npm scripts 追加 | `npm run electron` で起動 |

**成果物**: `electron/main.ts`, `electron/preload.ts`

---

### Phase 2: CLIブリッジ実装（node-pty）
**目的**: Claude CLI 呼び出し

| タスク | 完了条件 |
|--------|----------|
| node-pty インストール | `npm install node-pty` 成功 |
| CLIBridge クラス作成 | spawn/write/onData 実装 |
| IPC ハンドラー追加 | `ipcMain.handle('cli:exec')` |
| Renderer からの呼び出し | `/api/exec` 経由でCLI実行成功 |

**成果物**: `electron/cli-bridge.ts`

---

### Phase 3: ログ/プロジェクト状態管理
**目的**: 履歴・進捗保存

| タスク | 完了条件 |
|--------|----------|
| StateManager クラス作成 | project.json 読み書き |
| LogManager クラス作成 | logs/ への自動保存 |
| 起動時の状態復元 | 前回の状態を復元 |

**成果物**: `electron/state-manager.ts`, `electron/log-manager.ts`

---

### Phase 4: DoDシステム導入
**目的**: 完成を定義・強制

| タスク | 完了条件 |
|--------|----------|
| DOD.md パーサー作成 | チェックリスト抽出 |
| /api/progress 実装 | 進捗率を返す |
| UI 進捗パネル追加 | チェックリスト表示 |

**成果物**: `src/utils/dod-parser.ts`, 進捗パネルUI

---

### Phase 5: Git連携（gh push/pull）
**目的**: 自己保存と共有

| タスク | 完了条件 |
|--------|----------|
| GitManager クラス作成 | gh CLI ラッパー |
| Push/Pull UI追加 | ボタンから操作可能 |
| project.json をGitHubに保存 | 同期成功 |

**成果物**: `electron/git-manager.ts`

---

### Phase 6: 並列エージェント管理
**目的**: マルチプロセス制御

| タスク | 完了条件 |
|--------|----------|
| WorkerPool クラス作成 | 複数CLI同時実行 |
| Agent 可視化UI | 実行状態をリアルタイム表示 |
| Trinity Meeting 統合 | Claude/Codex/Gemini 同時実行 |

**成果物**: `electron/worker-pool.ts`

---

### Phase 7: テスト/バグ修正
**目的**: 安定化

| タスク | 完了条件 |
|--------|----------|
| Vitest 単体テスト | カバレッジ 80% 以上 |
| Playwright E2Eテスト | 主要フロー通過 |
| lint/型チェック | エラー 0 |
| パフォーマンス最適化 | 起動3秒以内 |

---

### Final: v4.0 Release
**目的**: 完成宣言

| タスク | 完了条件 |
|--------|----------|
| DOD.md 全項目 ✅ | 100% 達成 |
| README.md 更新 | インストール手順記載 |
| リリースビルド作成 | Windows/Mac/Linux バイナリ |
| CHANGELOG.md 更新 | v4.0 変更履歴 |

---

## 6. ディレクトリ構造（v4.0 完成形）

```
Iori/
├── electron/                    # Electron メインプロセス
│   ├── main.ts                  # エントリーポイント
│   ├── preload.ts               # contextBridge
│   ├── cli-bridge.ts            # node-pty ラッパー
│   ├── state-manager.ts         # 状態管理
│   ├── log-manager.ts           # ログ管理
│   ├── git-manager.ts           # Git 連携
│   └── worker-pool.ts           # 並列エージェント
├── src/
│   ├── core/                    # Kernel, Brain, Shell
│   ├── frontend/                # Cockpit UI
│   │   ├── public/
│   │   │   └── index.html       # メインUI
│   │   └── server.ts            # 開発用Express
│   ├── tools/                   # スタンドアロンツール
│   └── utils/                   # ユーティリティ
├── .iori/                       # プロジェクト状態（gitignore推奨）
├── CLAUDE.md                    # 開発ガイドライン
├── REQUIREMENTS_ELECTRON.md     # この文書
├── DOD.md                       # 完成定義
└── package.json
```

---

## 7. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| node-pty がプラットフォームで動作しない | P0 機能停止 | xterm.js + WebSocket fallback |
| Claude CLI がブロックされる | Trinity Meeting 不可 | Codex/Gemini fallback |
| Electron セキュリティ脆弱性 | データ漏洩 | CSP設定、contextIsolation |
| ビルドサイズ肥大化 | 配布困難 | asar圧縮、不要依存削除 |

---

## 8. 成功基準

| 基準 | 測定方法 |
|------|----------|
| CLI通信成功率 99% 以上 | ログ分析 |
| 起動時間 3秒以内 | パフォーマンステスト |
| メモリ使用量 500MB 以下 | プロセスモニタ |
| DOD.md 全項目達成 | 自動チェック |
| Vitest カバレッジ 80% 以上 | CI |

---

## 9. 補足メモ

### VSCodeとの違い
- Electron内にVSCode Extension Hostは存在しないが、同様の効果をCLI・IPC経由で再現可能

### Claude CLI がspawnで止まる場合
- stdinをpipe処理、または expect 的処理でバッファ制御
- node-pty の疑似ターミナルで解決

### UIデザイン方針
- Apple Human Interface Guidelines 準拠
- クリーン、ミニマル、柔らかい影と余白
- "Matrix/ハッカー風" は禁止

---

**Document Version**: 1.0.0
**Created**: 2025-12-23
**Author**: @scribe (Iori Development Squad)
