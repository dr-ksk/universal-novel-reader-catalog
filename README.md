# 万能小説 (UniversalNovelReader) サイト定義カタログ＆ビルダー

Android アプリ **「万能小説 (UniversalNovelReader)」** 向けのサイト定義（パーサー）を作成・テスト・共有するための公式＆コミュニティ（野良）カタログリポジトリです。

- **Web サイト（ビルダー＆カタログ）**: https://dr-ksk.github.io/universal-novel-reader-catalog/
- **公式カタログ JSON**: `https://dr-ksk.github.io/universal-novel-reader-catalog/official/index.json`
- **野良カタログ JSON**: `https://dr-ksk.github.io/universal-novel-reader-catalog/community/index.json`

## 構成

- `official/` — 管理者が検証した公式サイト定義（`.unr.json`）と自動生成された `index.json`
- `community/` — GitHub Issues（野良掲示板）から投稿され自動公開されたサイト定義と `index.json`
- `index.html`, `app.js`, `styles.css` — GitHub Pages 上で動くサイト定義ビルダー＆Webカタログ
- `scripts/` — カタログ生成・バリデーションおよび Issue 投稿の自動取り込みスクリプト
- `.github/workflows/` — GitHub Pages 自動デプロイ＆野良投稿の自動公開ワークフロー

## GitHub Pages の初期設定（初回のみ）

1. このリポジトリを GitHub へ Push します。
2. GitHub 上でリポジトリの **Settings → Pages** を開きます。
3. **Build and deployment → Source** を **`GitHub Actions`** に変更します。
4. **Settings → Actions → General → Workflow permissions** で **`Read and write permissions`** を許可します（野良掲示板からの自動公開コミットに必要です）。
5. Actions タブから `Deploy GitHub Pages` が完了すると、サイトが公開されます。

## 野良サイト定義の投稿方法

1. [Web ビルダー](https://dr-ksk.github.io/universal-novel-reader-catalog/) の「定義ビルダー」タブで対象サイトの定義を作成し、HTMLソース貼り付けで抽出テストを行います。
2. 「野良掲示板（GitHub Issue）へ投稿する」ボタンを押すと、定義 JSON が自動入力された Issue 画面が開きます。
3. そのまま Issue を投稿すると、GitHub Actions が自動で構文チェック・安全チェックを行い、`community/` へ公開します（YAML 形式のみ自動公開対象です）。
