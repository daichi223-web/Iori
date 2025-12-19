# Iori ドキュメント

このディレクトリには Iori プロジェクトの包括的なドキュメントが含まれています。

## ドキュメント一覧

### 📘 API ドキュメント

| ドキュメント | 説明 | 対象読者 |
|------------|------|----------|
| [OpenAPI 仕様書](./api/openapi.yaml) | 機械可読な API 定義 | 開発者、API クライアント |
| [API リファレンス](./api/reference.md) | 詳細な API 使用ガイド | 開発者 |

### 🏗️ アーキテクチャドキュメント

| ドキュメント | 説明 | 対象読者 |
|------------|------|----------|
| [システム設計](./architecture/system-design.md) | 全体アーキテクチャ、技術スタック | アーキテクト、開発者 |

### 📋 プロジェクト管理

| ドキュメント | 説明 | 対象読者 |
|------------|------|----------|
| [開発ガイドライン](../CLAUDE.md) | TDD ルール、コーディング規約 | 開発者、Claude Code |
| [README](../README.md) | プロジェクト概要、クイックスタート | すべてのユーザー |

## ドキュメント利用ガイド

### 🚀 初めて使う場合

1. **プロジェクト理解**: [README](../README.md) を読む
2. **開発環境構築**: README のセットアップ手順に従う
3. **API 使用方法**: [API リファレンス](./api/reference.md) を参照
4. **開発ルール**: [CLAUDE.md](../CLAUDE.md) で TDD フローを確認

### 🔧 開発者向け

#### API クライアント実装
1. [OpenAPI 仕様書](./api/openapi.yaml) をダウンロード
2. コード生成ツールで型定義を生成:
   ```bash
   # TypeScript
   npx @openapitools/openapi-generator-cli generate \
     -i docs/api/openapi.yaml \
     -g typescript-axios \
     -o ./generated
   ```

#### 新機能追加
1. [CLAUDE.md](../CLAUDE.md) で TDD フローを確認
2. テスト作成 → 実装 → リファクタ の順で進める
3. [システム設計](./architecture/system-design.md) でディレクトリ構造を確認

### 🏛️ アーキテクト向け

- [システム設計](./architecture/system-design.md): 技術スタック、データフロー、スケーラビリティ
- [OpenAPI 仕様書](./api/openapi.yaml): API エンドポイント設計

## ドキュメント更新ポリシー

### 🔄 LiveSpec - コードと同期した生きた仕様書

このプロジェクトのドキュメントは **LiveSpec** 方式で管理されています：

1. **コード変更時にドキュメントを更新**
   - 新しいエンドポイント追加 → OpenAPI を更新
   - アーキテクチャ変更 → システム設計を更新

2. **自動検証**
   ```bash
   # OpenAPI 仕様書の妥当性チェック
   npx @redocly/cli lint docs/api/openapi.yaml
   ```

3. **バージョン同期**
   - コードバージョン: `package.json` の `version`
   - ドキュメントバージョン: 各ドキュメントのヘッダー
   - **必ず一致させる**

### ✅ ドキュメント品質チェックリスト

- [ ] すべての public API が OpenAPI に記載されている
- [ ] コード例がすべて実行可能（テストでカバー）
- [ ] バージョン情報が最新
- [ ] リンク切れがない
- [ ] 図表が適切に表示される

## ドキュメント生成ツール

### OpenAPI からドキュメント生成

```bash
# Redoc による静的 HTML 生成
npx @redocly/cli build-docs docs/api/openapi.yaml \
  -o docs/api/index.html

# Swagger UI でインタラクティブに確認
npx swagger-ui-watcher docs/api/openapi.yaml
```

### Mermaid 図の表示

このドキュメントでは Mermaid 記法を使用しています。
GitHub や以下のツールで自動レンダリングされます：

- VS Code: Markdown Preview Mermaid Support 拡張機能
- [Mermaid Live Editor](https://mermaid.live/)

## ドキュメント構成の変更履歴

### v1.0.0 (2024-01-01)

- ✨ 初回ドキュメント作成
- 📝 OpenAPI 仕様書
- 🏗️ システム設計書
- 📘 API リファレンス

## フィードバック

ドキュメントの改善提案は GitHub Issues で受け付けています：

- 🐛 誤字・脱字
- 📝 説明不足の箇所
- 💡 追加してほしい内容
- 🔗 リンク切れ

## ライセンス

すべてのドキュメントは MIT ライセンスの下で公開されています。
