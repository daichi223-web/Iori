# Iori v3.0 Specification

**Version:** 3.0.0
**Status:** In Development
**Last Updated:** 2025-12-21

---

## 1. Overview

**Iori** は Node.js/TypeScript で構築された**並列自律開発OS**です。

**Core Concept:**
- C3L言語（カスタムコマンド言語）を解釈し、仮想シェル経由でローカルプロセスを制御
- TODO.mdベースの自律タスク実行
- マルチAI制御エンジン（Gemini/Claude/Codex）による適材適所の開発
- Definition of Done（DoD）による完成保証

---

## 2. Goals（達成すべきこと）

### Primary Goals
1. **完全自律開発**: TODO.mdからタスクを読み取り、完成まで自動実行
2. **完成保証**: DoD（Definition of Done）により、すべてのプロジェクトが必ず完成する
3. **品質保証**: TDD（Test-Driven Development）による高品質なコード生成
4. **進捗可視化**: リアルタイムダッシュボードで開発状況を把握

### Secondary Goals
- エラー自己修復機能
- システムログ記録（iori_system.log）
- Apple風モダンUI（グラスモーフィズム、ダークモード対応）

---

## 3. Non-Goals（やらないこと）

- ❌ クラウドベースのAI実行（すべてローカル）
- ❌ GUIベースの設定（設定ファイル/コマンドラインのみ）
- ❌ マルチユーザー対応（単一ユーザー専用）
- ❌ リモート実行（ローカルマシンのみ）

---

## 4. Core Components

### 4.1 Iori Kernel
- **Location:** `src/core/kernel.ts`
- **Responsibility:** TODO.md解析、タスクスケジューリング、実行制御
- **Key Feature:** 完全自律実行モード

### 4.2 Brain System
- **Location:** `src/core/brain.ts`
- **Responsibility:** マルチAI制御（Gemini/Claude/Codex）
- **Key Feature:** タスクに応じた最適なAI選択

### 4.3 Dashboard Server
- **Location:** `src/frontend/server.ts`
- **Responsibility:** Web UI、API提供
- **Port:** 3000
- **Key APIs:**
  - `/api/status` - システムステータス
  - `/api/logs` - システムログ
  - `/api/progress` - DoD進捗率
  - `/api/snapshot/*` - Mock Snapshot管理

### 4.4 Cloud Actions
- **Location:** `iori-generated/code/core/cloudActions.ts`
- **Responsibility:** 安全なcloud操作（Git, Vercel, Firebase, GitHub）
- **Key Feature:** Allowlistベースのセキュリティ

---

## 5. Primary Use Cases

### UC-01: 自律タスク実行
```bash
npx tsx index.ts
```
- TODO.mdからタスクを読み取る
- C3Lコマンドに変換
- 適切なAIで実行
- 完了後にDoD更新

### UC-02: リアルタイムダッシュボード
```bash
npm run dashboard
# → http://localhost:3000
```
- システムステータス表示
- ログのリアルタイム更新
- DoD進捗率表示
- Mock Snapshot管理

### UC-03: Mock Snapshot保存
- WU完了時に自動保存
- commit + preview + meta.json
- ロールバック可能

---

## 6. Technical Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js v18+ |
| Language | TypeScript (Strict Mode) |
| Module System | ES Modules |
| Testing | Vitest |
| Server | Express |
| Package Manager | npm |

---

## 7. Data Flow

```
User Intent
    ↓
TODO.md (明示的タスク定義)
    ↓
Iori Kernel (解析・スケジューリング)
    ↓
Brain System (AI選択)
    ↓
Execution (実装)
    ↓
Mock Snapshot (節目保存)
    ↓
DoD Update (進捗反映)
    ↓
Done (完成)
```

---

## 8. Error Handling

### 原則
- すべてのエラーは `iori_system.log` に記録
- 自己修復可能なエラーは自動リトライ
- 致命的エラーは人間に通知して停止

### エラー分類
1. **Minor**: 自動リトライ（最大3回）
2. **Major**: ログ記録して次のタスクへ
3. **Critical**: 実行停止、人間の介入が必要

---

## 9. Security

### 原則
- **ローカル限定**: リモート実行なし
- **Allowlist**: cloudActionsは許可リストベース
- **Safe Mode**: 破壊的操作には確認プロンプト
- **main保護**: mainブランチへの直接pushは禁止

### 具体的制約
- ✅ Can: evolve/*ブランチ作成、commit、push
- ❌ Cannot: git push --force, git reset --hard, mainへの直接push

---

## 10. Completion Criteria（DoD統合）

Ioriは以下がすべて満たされるまで「Done」を宣言できない：

1. ✅ SPEC.md が最新で実装と一致
2. ✅ 主要ユースケースが動作
3. ✅ テストが通る
4. ✅ README に起動方法がある
5. ✅ ロールバック手段がある

詳細は `DOD.md` を参照。

---

## 11. Future Considerations

- Mock Snapshot preview自動生成（スクリーンショット）
- Work Unit自動分解の精度向上
- 複数プロジェクト同時管理
- リモートMCP連携

---

**End of Specification**
