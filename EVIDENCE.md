# Evidence（証拠・再現手順）

**Project:** Iori v3.0
**Last Updated:** 2025-12-21

---

## 1. 環境情報

### System
- **OS:** Windows 11
- **Node.js:** v24.11.1
- **npm:** v10.9.2
- **Git:** Installed

### Project Setup
```bash
cd C:\Users\a713678\Documents\ai-agent\Iori
npm install
```

---

## 2. 主要ユースケースの再現手順

### UC-01: 自律タスク実行

**手順:**
```bash
# 1. TODO.mdにタスクを追加
echo "- [ ] Test task" >> TODO.md

# 2. Iori Kernelを実行
npx tsx index.ts
```

**期待結果:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌌 Iori Kernel v3.0
  Unified AI Development System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Iori Kernel v3.0 initialized
🤖 Starting autonomous mode (TODO.md based execution)...
...
✅ Iori Kernel v3.0: Execution completed successfully
```

**証拠:**
- ログファイル: `iori_system.log`
- タスク完了マーク: TODO.mdの `[x]`

---

### UC-02: リアルタイムダッシュボード

**手順:**
```bash
# 1. ダッシュボードサーバーを起動
npm run dashboard

# 2. ブラウザで開く
# URL: http://localhost:3000
```

**期待結果:**
- サーバー起動メッセージ:
  ```
  🌐 Iori Dashboard Server
     Running on: http://localhost:3000
     Status: Online
  ```

- ダッシュボード表示:
  - CPU/メモリ使用率
  - システムログ（リアルタイム更新）
  - Neural Console（コマンド入力）

**証拠:**
- スクリーンショット: `iori-generated/reports/dashboard_screenshot.png` (TBD)
- サーバーログ: コンソール出力

---

### UC-03: Iori生成ファイルの整理

**手順:**
```bash
# Iori生成ファイルはすべて iori-generated/ に格納
ls iori-generated/
```

**期待結果:**
```
iori-generated/
├── web/
│   └── games/
│       └── game.html
├── code/
│   ├── utils/
│   └── core/
└── reports/
```

**証拠:**
- ディレクトリ構造: 上記の通り
- ゲームアクセス: http://localhost:3000/iori/games/game.html

---

## 3. API動作確認

### 3.1 `/api/status`

**リクエスト:**
```bash
curl http://localhost:3000/api/status
```

**期待レスポンス:**
```json
{
  "version": "3.0.0",
  "status": "online",
  "uptime": 1234.56,
  "timestamp": "2025-12-21T00:00:00.000Z",
  "cpu": { "load": 15, "cores": 8 },
  "memory": { "total": 16777216, "active": 8388608, ... }
}
```

**ステータス:** ⚠️ **ISSUE** - タイムアウト発生（systeminformation問題）

---

### 3.2 `/api/logs`

**リクエスト:**
```bash
curl http://localhost:3000/api/logs
```

**期待レスポンス:**
```json
{
  "file": "iori_system.log",
  "lines": ["...", "..."],
  "total": 123
}
```

**ステータス:** ✅ **PASS**

---

### 3.3 `/api/cloud/action`

**リクエスト:**
```bash
curl -X POST http://localhost:3000/api/cloud/action \
  -H "Content-Type: application/json" \
  -d '{"service":"git","action":"status"}'
```

**期待レスポンス:**
```json
{
  "service": "git",
  "action": "status",
  "stdout": "M src/frontend/server.ts\n...",
  "success": true
}
```

**ステータス:** ⚠️ **ISSUE** - タイムアウト発生（原因調査中）

---

## 4. テスト結果

### 4.1 ユニットテスト

**実行:**
```bash
npm test
```

**結果:**
```
✓ src/utils/weather.test.ts (2 tests)
✓ src/tools/sysinfo.test.ts (1 test)
✓ src/core/brain.test.ts (1 test)
✓ src/core/kernel.test.ts (1 test)

Test Files  4 passed (4)
     Tests  5 passed (5)
```

**ステータス:** ✅ **PASS**

---

### 4.2 型チェック

**実行:**
```bash
npm run typecheck
```

**結果:**
```
No errors found.
```

**ステータス:** ✅ **PASS**

---

## 5. 既知の問題

### Issue #1: `/api/status` タイムアウト
- **症状:** systeminformation ライブラリの呼び出しでハング
- **影響:** ダッシュボードのステータス表示が動作しない
- **対策案:** タイムアウト追加、または軽量な代替手段

### Issue #2: `/api/cloud/action` タイムアウト
- **症状:** git statusコマンドの実行でハング
- **影響:** Neural Consoleからのgit操作が動作しない
- **対策案:** execPromise のタイムアウト設定を調整

### Issue #3: Mock Snapshot 未実装
- **症状:** `/api/snapshot/*` エンドポイントが存在しない
- **影響:** DoD進捗管理とロールバック機能が使えない
- **対策案:** WU-04で実装予定

---

## 6. パフォーマンス

### ダッシュボード起動時間
- **計測方法:** サーバー起動からHTTPレスポンスまで
- **結果:** 約3秒
- **評価:** ✅ 許容範囲内

### 自律タスク実行時間
- **計測方法:** npx tsx index.ts の実行時間
- **結果:** タスク数に依存（1タスク約5-30秒）
- **評価:** ✅ 許容範囲内

---

## 7. ログファイル

### 場所
- **システムログ:** `iori_system.log`
- **サーバーログ:** コンソール出力（永続化未実装）

### サンプル
```
[2025-12-21T00:00:00.000Z] INFO: Iori Kernel v3.0 initialized
[2025-12-21T00:00:01.000Z] INFO: Processing Task: "game.html の品質改善"
[2025-12-21T00:00:10.000Z] INFO: Task completed successfully
```

---

## 8. スクリーンショット（TBD）

以下のスクリーンショットを `iori-generated/reports/` に保存予定：

- [ ] `dashboard_main.png` - ダッシュボードメイン画面
- [ ] `game_gameplay.png` - ゲームプレイ画面
- [ ] `neural_console.png` - Neural Console使用例
- [ ] `completion_panel.png` - DoD進捗パネル（実装後）

---

## 9. ロールバック手順（TBD）

Mock Snapshot機能実装後に記載予定。

### 予定手順
```bash
# 1. Mock Snapshot一覧を確認
curl http://localhost:3000/api/snapshot/list

# 2. 特定のSnapshotに戻る
git reset --hard <commit-hash>

# 3. 依存関係を再インストール
npm install
```

---

**End of Evidence**
