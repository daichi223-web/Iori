# Iori Frontend Tasks

- [x] `src/frontend/server.ts` を作成する。
    - 機能: Expressサーバーをポート3000で起動する。
    - ルート `/` で `src/frontend/index.html` を配信する。
    - ルート `/api/logs` で `iori_system.log` の中身をJSON形式で返す。
    - ルート `/api/todos` で `TODO.md` の中身を返す。
    - `cors` を有効にすること。

- [x] `src/frontend/index.html` を作成する。
    - デザイン: 黒背景の「ハッカー風」ダッシュボード。
    - 機能:
        1. `/api/logs` からデータを取得し、リアルタイム風にログを表示するエリア。
        2. `/api/todos` からデータを取得し、現在のタスクリストを表示するエリア。
        3. 2秒ごとに自動更新するJavaScriptを含めること。
    - スタイル: CSSはHTML内に埋め込むこと。文字色は緑（#0f0）を基調とする。
