# 万能小説 (UniversalNovelReader) サイト定義カタログ＆ビルダー

Android アプリ **「万能小説 (UniversalNovelReader)」** 向けのサイト定義（パーサー）を作成・テスト・匿名共有するための **Cloudflare Pages + Functions + D1** 完結型カタログリポジトリです。

## 構成

- `index.html`, `app.js`, `styles.css` — Web カタログ＆ブラウザ内テスト付きビルダー
- `official/` — 管理者が検証した公式サイト定義（`.unr.json`）と `index.json`
- `functions/` — Cloudflare Pages Functions（API サーバー）
  - `GET /official/index.json` — 公式カタログ配信（アクセス元ドメインで `download_url` を自動解決）
  - `GET /community/index.json` — D1 から野良カタログ一覧を配信
  - `GET /community/:id.unr.json` — D1 から野良定義パッケージ本体を配信
  - `POST /api/community/submit` — アカウント不要・匿名での野良定義投稿（YAML / JavaScript 両対応）
  - `POST /api/community/vote` — アカウント不要の「👍 いいね」投票
  - `GET /api/config` — Turnstile 設定状態の公開API
- `lib/catalog-utils.js` — バリデーション・正規化・ハッシュ・Turnstile 検証の共通ロジック
- `schema.sql` — Cloudflare D1 テーブル初期化用 SQL
- `scripts/build_catalog.mjs` — `official/*.unr.json` から `official/index.json` を再生成するスクリプト

## Cloudflare Pages デプロイ手順（GitHub 連携・無料枠）

1. **Cloudflare 無料アカウント作成**（クレジットカード不要）
2. **D1 データベースを作成**
   - 左メニュー `ストレージとデータベース` → `D1 SQL データベース` → `作成`（名前例：`unr-catalog-db`）。
   - 作成した DB の `コンソール` タブを開き、[`schema.sql`](./schema.sql) の中身をそのまま貼り付けて「実行」する。
3. **Cloudflare Pages を GitHub と接続**
   - 左メニュー `コンピューティング（Workers）` → `Workers & Pages` → `作成` → `Pages` タブ → **「Git に接続」**。
   - このリポジトリ（Public / Private どちらでも可）を選択。
   - ビルド設定は **フレームワークプリセット：なし**、**ビルドコマンド：空欄**、**ビルド出力ディレクトリ：`/`（または空欄）** のまま「保存してデプロイ」。
4. **D1 データベースを Pages にバインド**
   - 作成した Pages プロジェクトの `設定` → `バインディング` → `追加` → `D1 データベース`。
   - **変数名**: `DB`（大文字）、**D1 データベース**: 手順2で作った DB を選択して保存。
   - `デプロイ` タブから最新デプロイを「デプロイを再試行」（または GitHub Desktop から Push）して反映。
5. **（任意）Turnstile（Bot対策）を有効化する場合**
   - 左メニュー `Turnstile` でウィジェットを作成（ドメインに `<プロジェクト名>.pages.dev` を登録）。
   - Pages の `設定` → `変数とシークレット` に以下を登録して再デプロイすると、投稿画面に自動でチェックが表示されます：
     - `TURNSTILE_SITE_KEY`（テキスト）
     - `TURNSTILE_SECRET_KEY`（シークレット／暗号化）

## 不適切な野良投稿を削除したいとき

Cloudflare 管理画面の `D1 SQL データベース` → 対象 DB → `テーブル` → `community_adapters` から、ブラウザ上で該当行を選んで削除するだけで即座に非公開になります。
