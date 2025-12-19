# Iori - システムアーキテクチャ

## 概要

Iori は TDD (テスト駆動開発) で構築された TypeScript ベースの REST API プロジェクトです。

### コアプリンシパル

1. **テスト駆動開発 (TDD)**
   - RED → GREEN → REFACTOR サイクル
   - 80% 以上のコードカバレッジ

2. **型安全性**
   - TypeScript strict モード
   - 明示的な型定義

3. **保守性**
   - 1ファイル 500行以内
   - 明確な責任分離

## システム構成

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTP
       │
┌──────▼──────────────────────────┐
│      Express.js Server          │
│  ┌──────────────────────────┐  │
│  │   Middleware Layer       │  │
│  │  - JSON Parser           │  │
│  │  - Error Handler         │  │
│  └───────────┬──────────────┘  │
│              │                  │
│  ┌───────────▼──────────────┐  │
│  │   Route Handlers         │  │
│  │  - /api/hello            │  │
│  └───────────┬──────────────┘  │
│              │                  │
│  ┌───────────▼──────────────┐  │
│  │   Business Logic         │  │
│  │  (Services)              │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

## ディレクトリ構造

```
src/
├── __tests__/          # テストファイル (Jest)
│   └── hello.test.ts   # Hello API のテスト
│
├── api/                # API エンドポイント (将来用)
│   └── (empty)
│
├── services/           # ビジネスロジック (将来用)
│   └── (empty)
│
├── models/             # データモデル (将来用)
│   └── (empty)
│
├── utils/              # ユーティリティ関数 (将来用)
│   └── (empty)
│
└── index.ts            # エントリーポイント
```

## 技術スタック

### ランタイム & 言語
- **Node.js**: JavaScript ランタイム
- **TypeScript 5.3+**: 静的型付け

### フレームワーク
- **Express.js 4.18**: Web フレームワーク
- **Jest 29**: テストフレームワーク

### 開発ツール
- **ts-jest**: TypeScript 対応 Jest プリセット
- **ts-node**: TypeScript 直接実行
- **supertest**: HTTP アサーションライブラリ

## データフロー

### GET /api/hello のリクエストフロー

```
1. Client Request
   │
   ├─> GET /api/hello
   │
2. Express Middleware
   │
   ├─> JSON Parser (express.json())
   │
3. Route Handler
   │
   ├─> src/index.ts:9-14
   │   - 現在時刻取得: new Date().toISOString()
   │   - レスポンス生成
   │
4. Response
   │
   └─> { message: "Hello, World!", timestamp: "..." }
```

## テスト戦略

### テストピラミッド (現状)

```
    E2E: 0%
    ─────────
   Integration: 0%
   ───────────────
  Unit: 100% (4 tests)
  ─────────────────────
```

### テストカバレッジ

| モジュール | Line | Branch | Function | Statement |
|----------|------|--------|----------|-----------|
| index.ts | 100% | 100%   | 100%     | 100%      |

### テストケース

**src/__tests__/hello.test.ts**
1. ステータスコード 200 検証
2. Content-Type JSON 検証
3. レスポンスボディ構造検証
4. ISO 8601 タイムスタンプ形式検証

## セキュリティ考慮事項

### 現在の実装

- ❌ 認証なし (Hello World エンドポイントのため)
- ✅ JSON パースによる入力制限
- ⚠️ CORS 未設定 (開発環境のみを想定)
- ⚠️ レート制限なし

### 将来の実装予定

- [ ] JWT ベース認証
- [ ] CORS ミドルウェア
- [ ] ヘルメット (セキュリティヘッダー)
- [ ] レート制限 (express-rate-limit)

## スケーラビリティ

### 現状
- 単一プロセス
- ステートレス設計

### 将来の拡張ポイント
- **水平スケール**: PM2 クラスタモード
- **キャッシング**: Redis 導入
- **ロードバランサー**: Nginx/ALB
- **データベース**: PostgreSQL/MongoDB

## パフォーマンス

### ベンチマーク目標

| メトリック | 目標値 |
|----------|-------|
| レスポンスタイム (p50) | < 50ms |
| レスポンスタイム (p95) | < 200ms |
| スループット | > 1000 req/s |

### 現在の実測値
- 単一リクエスト: ~5ms (ローカル環境)
- テスト実行時間: 4.8s (4テスト)

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|----------|------|
| PORT | 3000 | サーバーポート番号 |
| NODE_ENV | development | 環境識別子 (test/development/production) |

## デプロイメント

### 推奨環境
- Node.js 20.x LTS
- メモリ: 512MB 以上
- CPU: 1 vCPU 以上

### ビルドコマンド
```bash
npm run build   # TypeScript コンパイル
```

### 起動コマンド
```bash
npm start       # 本番環境
npm run dev     # 開発環境 (ts-node)
```

## 監視・ロギング

### 現状
- ✅ コンソールログ (起動時)
- ❌ 構造化ログなし
- ❌ メトリクス収集なし

### 将来の実装
- [ ] Winston / Pino (構造化ログ)
- [ ] Prometheus メトリクス
- [ ] OpenTelemetry トレーシング

## バージョン情報

- **プロジェクトバージョン**: 1.0.0
- **API バージョン**: v1
- **最終更新**: 2024-01-01
- **ドキュメント同期**: ✅ コードバージョンと一致
