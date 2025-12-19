# API リファレンス

## ベース URL

| 環境 | URL |
|------|-----|
| 開発 | `http://localhost:3000` |
| 本番 | `https://api.example.com` |

## 認証

現在のバージョンでは認証は不要です。

将来のバージョンでは JWT ベアラートークンによる認証を実装予定：

```http
Authorization: Bearer <token>
```

## エンドポイント一覧

### Health Check

#### GET /api/hello

Hello World メッセージとタイムスタンプを返します。

**リクエスト**

```http
GET /api/hello HTTP/1.1
Host: localhost:3000
Accept: application/json
```

**パラメータ**

なし

**レスポンス**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "message": "Hello, World!",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**レスポンスフィールド**

| フィールド | 型 | 必須 | 説明 |
|----------|-----|------|------|
| message | string | Yes | Hello World メッセージ |
| timestamp | string | Yes | ISO 8601 形式のタイムスタンプ |

**ステータスコード**

| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 500 | サーバー内部エラー |

**curl 例**

```bash
curl http://localhost:3000/api/hello
```

**JavaScript 例**

```javascript
// Fetch API
const response = await fetch('http://localhost:3000/api/hello');
const data = await response.json();
console.log(data.message); // "Hello, World!"
```

```javascript
// Axios
import axios from 'axios';

const { data } = await axios.get('http://localhost:3000/api/hello');
console.log(data.timestamp); // "2024-01-01T12:00:00.000Z"
```

**TypeScript 例**

```typescript
interface HelloResponse {
  message: string;
  timestamp: string;
}

async function getHello(): Promise<HelloResponse> {
  const response = await fetch('http://localhost:3000/api/hello');

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// 使用例
try {
  const data = await getHello();
  console.log(`Message: ${data.message}`);
  console.log(`Time: ${new Date(data.timestamp).toLocaleString()}`);
} catch (error) {
  console.error('Failed to fetch hello:', error);
}
```

**テストケース**

このエンドポイントは以下のテストでカバーされています：

1. ✅ ステータスコード 200 を返す
2. ✅ Content-Type が application/json である
3. ✅ message フィールドに "Hello, World!" が含まれる
4. ✅ timestamp フィールドが有効な ISO 8601 形式である

テストファイル: `src/__tests__/hello.test.ts:4-29`

**パフォーマンス特性**

- 平均レスポンスタイム: < 5ms (ローカル環境)
- DB クエリ: なし
- キャッシュ可能: No (タイムスタンプが動的)

---

## エラーレスポンス

すべてのエラーは以下の形式で返されます：

```json
{
  "error": "ERROR_CODE",
  "message": "人間が読めるエラーメッセージ",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 共通エラーコード

| コード | 説明 |
|--------|------|
| 400 | Bad Request - 不正なリクエスト |
| 401 | Unauthorized - 認証が必要 |
| 403 | Forbidden - アクセス権限なし |
| 404 | Not Found - リソースが見つからない |
| 500 | Internal Server Error - サーバーエラー |

---

## レート制限

現在のバージョンではレート制限は実装されていません。

将来のバージョンでは以下の制限を予定：

- **認証済みユーザー**: 100 req/min
- **未認証ユーザー**: 20 req/min

レート制限に達した場合：

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later."
}
```

---

## CORS

現在のバージョンでは CORS ヘッダーは設定されていません。

開発環境ではすべてのオリジンからのアクセスを許可する設定を追加予定。

---

## バージョニング

API バージョンは URL パスに含まれます：

- 現在: `/api/hello` (暗黙的に v1)
- 将来: `/api/v2/hello`

メジャーバージョンアップ時は既存エンドポイントを最低 6ヶ月間維持します。

---

## Webhook

現在のバージョンでは Webhook は実装されていません。

---

## SDK

### TypeScript/JavaScript

公式 SDK はまだありません。標準の `fetch` API または Axios の使用を推奨します。

型定義例：

```typescript
// types/api.ts
export interface HelloResponse {
  message: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp?: string;
}
```

---

## 変更履歴

### v1.0.0 (2024-01-01)

- ✨ 初回リリース
- ✨ GET /api/hello エンドポイント追加
- ✅ Jest テスト実装
- 📝 OpenAPI 仕様書作成

---

## サポート

### 問題報告

GitHub Issues を使用してください：
- バグ報告
- 機能リクエスト
- ドキュメント改善提案

### コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. TDD でコードを実装
4. テストを実行 (`npm test`)
5. コミット (`git commit -m 'Add amazing feature'`)
6. プッシュ (`git push origin feature/amazing-feature`)
7. Pull Request を作成

**コントリビューションルール:**
- テストカバレッジ 80% 以上維持
- TypeScript strict モード準拠
- 1ファイル 500行以内
- CLAUDE.md のルールに従う

---

## ライセンス

MIT License
