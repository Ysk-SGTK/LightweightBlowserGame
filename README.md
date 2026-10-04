# Browser Game Lab

スマホ・PCで数分だけ遊べる小さなブラウザゲームを公開し、匿名の利用反応を見る実験用MVP。HTML / CSS / ES Modules、Cloudflare Pages Functions＋D1。追加のフロントエンドフレームワーク、共通ゲームエンジン、管理画面はありません。

## ローカル起動・build

Node.js 24（検証: 24.14.1）、npmを使用します。

```powershell
npm ci
npm start
```

`npm start` はproduction build→ローカルD1 migration→Pages devを順に実行します。http://127.0.0.1:4173/ を開いてください。本番D1を使わず、`.wrangler/state/` にローカルDBを保存します。設定に `remote: true` はありません。

```powershell
npm run build
npm test
npm run check
npm run deploy:check
npm run analyze:local
```

`deploy:check` はPages Functionsのローカルコンパイルで、デプロイを行いません。ビルドのみの静的プレビューは `node server.mjs`（ログAPIなし・405で安全に失敗）でも可能です。通常は `npm start` を使います。

## URL・構成

| URL | 内容 |
| --- | --- |
| `/` | 簡単なゲーム一覧 |
| `/minesweeper/` | 10×10・地雷12個・制限2分のマインスイーパー |
| `/memory/` | 4×4・8ペアの神経衰弱 |
| `POST /api/events` | 共通匿名イベント受信API |

```text
index.html                 # ゲーム一覧
minesweeper/index.html      # マインスイーパー画面
src/                       # 既存マインスイーパーのJS・共通送信
styles.css                 # マインスイーパーCSS
assets/rewards/            # マインスイーパーの報酬とmanifest
memory/                    # 神経衰弱のHTML / JS / CSS / SVG
functions/api/events.js    # Pages Function
worker/index.js            # API validation / prepared statement保存
migrations/                # D1 migration（0001〜0003を順に適用）
analysis/summary.sql        # game別集計とID連鎖
public/                    # _routes.json / 404.html
scripts/build.mjs           # 静的成果物をdistへ生成
wrangler.jsonc             # Pages / D1設定
```

`dist/` は `/index.html`、`/minesweeper/index.html`、`/memory/index.html`、JS / CSS / 画像などを含みます。Functionはリポジトリ直下の `functions/` からPagesが別途コンパイルします。DB・README・テスト・依存・機密ファイルは配信しません。`_routes.json` はFunctionsを `/api/*` に限定し、ゲームの静的配信をFunctionsから分離。404.htmlにより、存在しないパスがトップページに化けるSPA fallbackを避けます。

## Cloudflare Pages設定値

| 項目 | 値 |
| --- | --- |
| Repository | `browser-game-lab`（Public） |
| Production branch | `main` |
| Framework preset | None |
| Root directory | 空欄（リポジトリルート） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Build environment | `NODE_VERSION=24.14.1` |
| 推奨Pages project名 | `browser-game-lab` |
| 推奨D1 database名 | `browser-game-lab-events` |
| D1 binding名 | `GAME_LOG_DB` |

Cloudflare Freeプランの範囲で始める構成です。無料枠は無制限ではなく、Functionsリクエスト・D1読込／書込／容量などの制限があります。公開後は利用量を確認してください。

参考: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)、[Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)、[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)。

## Cloudflare Dashboardでの公開手順

**Git連携より先に本番D1 IDを設定してください。現在のIDはローカル専用の仮IDです。** 初回連携からbuild/deployが走るため、この順序を守ります。

1. Cloudflare Dashboard → Storage & databases → D1 → Create database。名前を `browser-game-lab-events` としてDBを作成し、Database IDをコピーします。CLIなら `npx wrangler d1 create browser-game-lab-events` でも作成できます。
2. `wrangler.jsonc` の `d1_databases[0].database_id` を本番IDへ置換します。IDは認証Tokenではありません。binding名は `GAME_LOG_DB` のままにします。
3. 対象アカウントの認証が必要なら `npx wrangler login`。migrationを本番へ適用します（本番への書き込み）。
   ```powershell
   npx wrangler d1 migrations apply GAME_LOG_DB --remote
   ```
   0001→0002→0003が順に適用されます。0003が共通 `game_events` を作成し、旧匿名テーブルがあればデータを投影します。旧表は削除しません。
4. IDを設定した差分をcommitして `main` へpushします。
5. Workers & Pages → Create application → Pages → Connect to Git。GitHubに接続し、対象の `browser-game-lab` リポジトリを選択。新しいWorkers作成画面ではなくPagesのGit連携を選びます。
6. 前表のRoot directory / Build command / Build output / main / NODE_VERSIONを設定してSave and Deploy。
7. Pages projectのSettings → Bindings（画面によってFunctions内）でD1の `GAME_LOG_DB` が `browser-game-lab-events` を指すことを確認します。**この構成ではwrangler.jsoncがbindingの正本**です。設定ファイルを使うとDashboardで同じ項目を編集できない場合があります。その場合はwranglerのID修正→pushで更新し、Dashboardで一致を確認してください。
8. migration / bindingの修正後は最新deploymentをRetry deployment / Redeploy。公開URLでトップ→両ゲーム→reload、開始・結果・retryが本番D1へ保存されることを確認します。

想定URL: `https://browser-game-lab.pages.dev/`、`https://browser-game-lab.pages.dev/minesweeper/`、`https://browser-game-lab.pages.dev/memory/`。実際のPages project名・URLは作成結果で確認してください。

以後 `main` へのpushが自動deployの入口です。migrationはbuildに含めず、人間が必要時に明示的に適用します。本番DBをローカル起動やbuildから書き換えません。

**Preview**: `env.preview.d1_databases` は空にしてあり、本番DBへ接続しません。previewでのログは503で安全に失敗しますがゲームは動きます。previewログが必要なら別のpreview専用D1を作り、`env.preview` にbindingを追加してmigrationを適用してください。本番IDをコピーしないでください。

参考: [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)、[D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)、[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)。

## 共通匿名ログ

両ゲームとも同一オリジンの `POST /api/events` へJSON送信し、`GAME_LOG_DB.game_events` へprepared statementで保存します。ゲームは送信完了を待たず、4秒timeout・1イベント1試行・再送なし。APIはbodyを2048 bytes以内に制限し、許可したgame / event / 項目・UUID・数値・同一オリジンを検証。余分な個人情報項目は400、異なるOriginは403、不正methodは405、Content-Type不正は415、DB失敗は503。クエリ値はSQLへ連結しません。

共通: `game_id`, `event_name`, `timestamp`, `session_id`, `play_id`, `previous_play_id`。配送重複排除用に `event_id`（DBでは `id`）、ページ内順序用に `event_seq`。game_idは `minesweeper` / `memory`。同じplayのstart / resultは一意インデックスでも重複排除します。

| イベント | 条件 |
| --- | --- |
| page_view | ゲームページの初期化で1回（トップには送信なし） |
| game_start | 最初の有効な開封で1プレイ1回 |
| game_clear | 両ゲームのクリアで1プレイ1回（旧マインスイーパーのgame_winを統一） |
| game_over | マインスイーパーで地雷を踏んだ場合 |
| game_timeout | マインスイーパーで2分経過 |
| retry | 再プレイボタン操作 |

ゲーム固有列: マインスイーパーはboard_width / board_height / mine_count、終了時elapsed_seconds / opened_cells / flags_used。神経衰弱はcard_theme、クリア時elapsed_seconds / flip_count / mismatch_count / pairs_matched。

既存のIDライフサイクルは維持。sessionはゲームページロードごと、リロードで新規、ページメモリのみ。マインスイーパーplayは最初の開封時、memory playは盤面生成時に発行。マインスイーパーretryは元playを指し、memory retryは新playを指します。再プレイ集計はretry操作数だけで判定せず、実際のgame_startとprevious_play_idで確認してください。未開始盤面を挟むmemory連鎖は、開始イベントだけでは祖先が欠ける場合があるため勝手に補完しません。

Cookie / LocalStorage / sessionStorage / 永続ユーザーID / fingerprintなし。IP・User-Agent・氏名・メール・位置情報をゲーム独自DBに保存しません。ゲーム内の匿名利用説明は維持。Cloudflare自体の標準インフラ情報は別管理です。ログはbest effortで欠落・偽装・ボットの影響を受け得ます。保管期間と実験終了日を公開前に決めてください。

## SQLで確認

```powershell
npm run analyze:local
# 公開後に本番を読む場合:
npx wrangler d1 execute GAME_LOG_DB --remote --file analysis/summary.sql
```

簡単な集計:

```sql
SELECT game_id,
 SUM(event_name='page_view') AS page_views,
 SUM(event_name='game_start') AS starts,
 SUM(event_name='game_clear') AS clears,
 SUM(event_name='game_over') AS game_overs,
 SUM(event_name='retry') AS retry_operations,
 AVG(CASE WHEN event_name IN ('game_clear','game_over','game_timeout') THEN elapsed_seconds END) AS avg_completed_seconds
FROM game_events GROUP BY game_id;

SELECT game_id,session_id,COUNT(*) AS plays
FROM game_events WHERE event_name='game_start'
GROUP BY game_id,session_id;
```

`analysis/summary.sql` はゲーム別集計、完了プレイの時間、実開始の連鎖、未開始を含むsessionあたりプレイ回数を確認します。終了ログがない途中放棄は平均完了時間に含めません。旧表は新ログの保存先ではありません。

## 新しいゲームを追加

1. `game-003/` 等にHTML / CSS / JS / assetsを置きます。リンク・画像はそのパスから解決するようにします。
2. `scripts/build.mjs` の静的コピー対象へディレクトリを1つ追加し、配信してはいけないREADMEなどを除外します。
3. トップ `index.html` にゲームへのリンクを追加し、build→ローカルroute / reload / mobileを確認します。
4. ログが必要なら `game_id` を付け、`worker/index.js` にそのゲームの許可event / 数値項目のvalidationを追加します。必要な追加列だけmigrationで用意。既存ゲームのルールは共通化しません。

## 報酬・カード差し替え

マインスイーパー: `assets/rewards/manifest.json` のid / name / src / altを編集。同フォルダの画像を差し替えます。神経衰弱: [memory/README.md](memory/README.md) を参照。変更後はbuild・reload。

## GitHub準備

機密ファイル・DB・build成果物・依存・検証録画はcommit対象外。秘密情報を見つけた場合はpushしないでください。リポジトリを作成できなかった場合の手順:

```powershell
gh auth login --hostname github.com
# mainの初回commitがある状態で:
gh repo create browser-game-lab --public --source . --remote origin --push
```

今回の実行ではGitHub CLIの認証は確認できましたが、createRepositoryが `Resource not accessible by personal access token` で拒否されました。ローカルmainの初回commitまで完了し、リポジトリ作成・pushは未実施です。認証の環境変数がある場合はCLI loginより優先されるため、人間が適切なアカウント・権限を確認してください。手動ならGitHubのNew repositoryで `browser-game-lab` / Publicを選び、README・LICENSE・gitignoreを追加せず空のリポジトリを作成します。その後、GitHubに表示されたHTTPS URLを使います:

```powershell
git remote add origin https://github.com/Ysk-SGTK/browser-game-lab.git
git push -u origin main
```

同名の既存リポジトリがある場合は上書きせず、対象を確認してください。公開URL・アカウント認証は人間が確認し、CloudflareのTokenをファイル・GitHubへ記載しないでください。

## 公開準備の実測結果（2026-10-05）

- `npm ci --no-audit --no-fund`: 37 packages導入成功。追加のゲーム用ライブラリなし。
- `npm test`: 23 tests PASS（ゲーム、匿名ログ、API、共通migration、旧表の移行、SQL集計）。
- `npm run check` / `npm run build` / `npm run deploy:check`: PASS。静的成果物22ファイル、Pages Functionコンパイル成功。
- `npm run db:local`: 0003適用成功。`npm run analyze:local`: SQL 3 statements成功（ローカル）。
- 実ブラウザChromeで58項目PASS。PC 1280×900とスマホ390×844のタップ操作、320 / 360 / 390 / 430pxで横はみ出しなし。トップから両ゲームへの移動、直接route / reload、開始・失敗・クリア・再プレイ、報酬表示を確認。
- 実Pages dev APIで正常イベント26件が204。ローカルD1でminesweeper 14件、memory 12件の保存を照合。重複送信で行は増えない。
- 不正payload 400、異なるOrigin 403、GET 405、Content-Type不正415、サイズ超過400。非配信ファイル・不存在routeは404。
- ログAPIを503にした両ゲームで開始・再プレイが動作。Cookie / LocalStorage / SessionStorageへの保存なし、正常操作時のconsole error / warningなし。
- 公開対象とbuild成果物を確認し、機密情報・不要な個人情報・ローカル絶対パスの検出なし。新規Gitのため既存履歴なし。

ローカルD1の数字はテストデータで、実利用者の反応ではありません。スマホ実機、Cloudflare本番build・binding・本番D1保存・公開URLは未確認です。本番公開には、上記手順でD1作成、仮ID置換、remote migration、Pages Git連携と再deployが必要です。
