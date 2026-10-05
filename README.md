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
| Repository | `Ysk-SGTK/LightweightBlowserGame`（Public） |
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

**所有者から提供されたD1 IDを設定済みです。対象DB・アカウントの確認とremote migrationは未実施です。** 初回Git連携からbuild/deployが走るため、先にmigrationを適用してください。

1. Cloudflare Dashboard → Storage & databases → D1 → Create database。名前を `browser-game-lab-events` としてDBを作成し、Database IDをコピーします。CLIなら `npx wrangler d1 create browser-game-lab-events` でも作成できます。
2. `wrangler.jsonc` の `d1_databases[0].database_id` は所有者指定の `9d4b7505-3f13-45db-96f8-82a46b752a5d` を設定済みです。DashboardのDB IDとの一致を確認し、DB名が異なる場合は `database_name` を実際の名前へ合わせます。IDは認証Tokenではありません。binding名は `GAME_LOG_DB` のままにします。
3. 対象アカウントの認証が必要なら `npx wrangler login`。migrationを本番へ適用します（本番への書き込み）。
   ```powershell
   npx wrangler d1 migrations apply GAME_LOG_DB --remote
   ```
   0001→0002→0003が順に適用されます。0003が共通 `game_events` を作成し、旧匿名テーブルがあればデータを投影します。旧表は削除しません。
4. IDを設定した差分をcommitして `main` へpushします。
5. Workers & Pages → Create application → Pages → Connect to Git。GitHubに接続し、対象の `Ysk-SGTK/LightweightBlowserGame` リポジトリを選択。新しいWorkers作成画面ではなくPagesのGit連携を選びます。
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

## GitHub

公開先: [Ysk-SGTK/LightweightBlowserGame](https://github.com/Ysk-SGTK/LightweightBlowserGame)。既存リポジトリが空であることを確認し、所有者指定のpush先として使用します。

機密ファイル・DB・build成果物・依存・検証録画はcommit対象外。CloudflareのTokenをGitへ記載しないでください。

```powershell
git push -u origin main
```

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

ローカルD1の数字はテストデータで、実利用者の反応ではありません。スマホ実機、Cloudflare本番build・binding・本番D1保存・公開URLは未確認です。本番公開には、指定D1の確認、remote migration、Pages Git連携と再deployが必要です。D1 IDは所有者提供値を設定済みで、DBの存在・アクセス権は未確認です。

### 本番D1 migration実測（2026-10-05）

所有者の明示承認後、Wrangler認証を使って指定Database IDの実名が `lightweightblowsergame` であることを確認しました。

- `npx wrangler d1 migrations apply GAME_LOG_DB --remote`: PASS。0001 / 0002 / 0003の3件すべて適用成功。
- `sqlite_master` と `d1_migrations` を本番から読み取り確認: `game_events`、関連5インデックス、3件のmigration履歴が存在。
- 適用後の `game_events` は0件。本番Pagesからのイベント送信・保存はこの作業では未確認。
- 既存テーブルを削除する操作、Pages再デプロイ、検証イベントの投入は実施していません。

### 本番Pages・D1連携実測（2026-10-05）

公開URL: https://lightweight-browser-games.pages.dev/

- 実Chrome / Playwrightで17項目PASS。トップから両ゲームへの遷移、マインスイーパー開始・再プレイ、神経衰弱8ペア成立・報酬表示・再プレイを確認。
- マインスイーパーPC幅1280px、神経衰弱スマホ幅390pxで横はみ出しなし。console error / warningなし。Browser pluginがないため既存のPlaywright / Chromeを使用。
- 確認用の匿名イベント9件すべてHTTP 204。本番D1からIDで対象9件を読み取り、送信された全項目との一致を確認。game_id / game_start / game_clear / retry / previous_play_idの連鎖も一致。
- 神経衰弱のclear値はflip_count=16 / mismatch_count=0 / pairs_matched=8。確認用イベント9件は実利用者の反応として扱わない。
- この本番確認ではマインスイーパーの終了・タイムアウト、スマホ実機、全ブラウザは未検証。Pages再デプロイ・設定変更は実施していない。

## 一筆の旅追加・実測結果（2026-10-05）

3本目のゲームは `/one-stroke/`。公開URL想定は https://lightweight-browser-games.pages.dev/one-stroke/ （既存READMEの公開先に追加する想定、今回の公開・remote migrationは未実施）。ローカル検証URLは http://127.0.0.1:4174/one-stroke/ 。トップ一覧から遷移できます。

### 仕様・固定問題

STARTから上下左右の隣接マスへ進み、全使用可能マスを一度ずつ通って最後にGOALへ到達。早いGOAL進入は無視します。過去の任意マスへの再進入は禁止、直前マスへの移動だけ1手Undo。別途Undo、リセット、難易度・問題選択、次の問題、時間・踏破数、CLEARダイアログを用意。クリック／タップで1手ずつ、またはPointer Eventsで連続ドラッグできます。高速入力の離れたマスは無視し、推測した中間経路で補完しません。

盤面だけtouch-action:none。拡大表示では32px以上のマスを確保し、移動モードに切り替えると盤面を上下左右にスワイプできます。移動モードでは経路を変更しません。ページ全体のスクロールは維持します。自動ゲームオーバー・リアルタイムソルバー・ヒント・永続進行保存はありません。

| 難易度 | 問題数 | サイズ | 使用可能マス数 |
| --- | ---: | --- | --- |
| Easy | 5 | 8×8 | 60 |
| Normal | 5 | 9×9 | 46 / 66 |
| Hard | 5 | 11×11 | 89 / 101 |
| Expert | 4 | 13×13 | 103 / 117 |
| Challenge | 1 | 18×18 | 290 |

計20問。欠損・内部穴・非対称形状・コの字・櫛形・広い領域を1マス幅で接続する形を含みます。角以外・中央付近のSTART/GOALもあります。18×18が公開用最大サイズ。15×15 / 20×20の確認は後述のUI専用fixtureであり、公開問題には含みません。

生成: seed=20261005の決定的なbackbite（経路の部分反転）＋端部の切り取りと、形状テンプレート。候補を独立ソルバーで探索し、解けたものだけ採用。保存する解の曲がり数が使用可能マス数の28%未満の候補を除外。単純な横往復だけの長方形への偏りを防ぐ簡易条件で、人間の難易度評価ではありません。

ソルバー: 保存済みsolutionを参照しないHamilton経路DFS。残り次数の小さい候補順、早期GOAL除外、残り領域の連結性と次数による枝刈り。探索上限到達は解なしと区別し、採用しません。nodes / branches / backtracks / forcedを保存。difficulty_scoreはbranches+backtracksの機械的指標で、難易度ラベルは形状・サイズを含む初版の仮設定です。人間が遊んだ体感難易度・段階間の難しさの順序は未検証。

`npm run puzzles:generate` で固定JSONとAPIメタデータを再生成し、`npm run puzzles:verify` で全問題を再探索・検証します。問題を編集した場合はcatalog.jsとの整合も維持してください。報酬画像は `one-stroke/config.js` のREWARD_IMAGEで差し替え（現在は既存の仮SVGを再利用）。

### 変更ファイル

- 新規: one-stroke/index.html, styles.css, app.js, game.js, analytics.js, config.js, events.js, catalog.js, puzzles.json。
- 新規: scripts/generate-one-stroke.mjs, one-stroke-solver.mjs, verify-one-stroke.mjs。
- 新規: migrations/0004_one_stroke.sql, tests/one-stroke.test.mjs。
- 更新: index.html（一覧リンク）、scripts/build.mjs（配信対象）、package.json（構文チェック・生成・検証コマンド）、worker/index.js（共通API許可項目・保存列）。
- 更新: tests/analytics.test.mjs, memory.test.mjs, pages.test.mjs（共通migration fixtureを0004まで適用）、README.md（この節）。作業開始時のREADME未コミット変更は保持。

### 匿名ログとmigration

既存sendEventを再利用し、同一オリジンPOST /api/events → Pages Function → GAME_LOG_DB.game_events。game_id=one-stroke。page_view / game_start / game_clear / retry / next_levelを取得。startは最初の有効なSTART入力で1回、clearは1プレイ1回。session_idはページメモリのみ、play_idは実開始時に発行、previous_play_idは直前に実際に開始したプレイ。未開始リセットでは架空の祖先を作りません。retryは対象問題、next_levelは遷移先問題のメタデータを持ち、両者のplay_idは遷移元の実プレイを指します。

共通IDにpuzzle_id / difficulty / width / height / playable_cellsを追加。clearでelapsed_seconds / move_count / undo_count / reset_count。move_countは進んだ有効な手の累計、undo_countは戻り操作数、reset_countは同じ問題をリセットした回数（問題変更時0）。clearではmove_count=playable_cells-1+undo_countを検証。ゲーム独自の個人情報、IP、UA全文、Cookie、LocalStorage、sessionStorage、永続IDを追加しません。ログ失敗時もゲームは継続。

0004はnext_levelのCHECK制約と必要列を追加するためgame_eventsを作り直し、既存行を全列コピーして一意インデックスを復元します。旧events / memory_eventsは変更しません。旧履歴・重複排除の保持は自動テストPASS。ローカルD1で0001〜0004適用PASS。本番0004適用は別途所有者の明示承認が必要です。現行APIの新規列と旧本番スキーマは非互換なので、公開前に0004を適用してください。テーブル作り直しを伴うため、対象DBとバックアップ／復元手段を確認してから実行してください。

### 実測・検証

環境: Windows / PowerShell 7.6.5 / Node 24.14.1 / Wrangler 4.146.0 / Chrome 154.0.8037.92。Browser plugin not availableのため既存バンドルPlaywrightとChromeを使用。実スマートフォンではなくhasTouch/isMobileとCDPの実タッチストリームによる検証です。

| コマンド・確認 | 結果 |
| --- | --- |
| npm test | PASS: 30 tests。既存2ゲームと追加ゲーム、API、migration、送信失敗 |
| npm run check | PASS |
| npm run puzzles:verify | PASS: 20/20独立探索。START/GOAL、使用可能数、隣接、重複なし、全マス、終端GOAL |
| npm run build | PASS: production静的成果物をdistへ生成 |
| npm run deploy:check | PASS: Pages Functionのローカルコンパイル成功。Cloudflare上のbuildではない |
| npm run db:local | PASS: ローカル0001〜0004適用 |
| Playwright固定問題フロー | PASS: 43確認。トップ→ゲーム→PCドラッグ／タッチ→Undo→reset→clear→報酬→次問題 |
| 幅・大盤面 | PASS: PC1280×1000、スマホ320/360/390/430×844でページ横はみ出しなし。18×18拡大・タッチで290マスクリア |
| 15×15 / 20×20 UI fixture | PASS: 320/390pxで拡大マス32px以上、タップ移動、Undo、移動モードで実タッチpan。経路は不変 |
| 実ローカルログAPI・D1 | PASS: 固定問題QAの21ユニークイベントをHTTP204で受信、21/21行を全送信項目と照合。重複送信で追加行なし |
| エラー耐性・privacy | PASS: 余分なemail項目400。ログAPI503でも全マスクリア・retry動作。Cookie／ブラウザ保存なし |
| 画面・console | PASS: タイトル、実画面、クリア・報酬・スマホ画像を目視確認。正常操作のerror/warningなし。意図的400リクエストのnetwork診断のみ |

初回テストは既存3テストのfixtureが0003まででAPIが503になったため、0004まで適用して修正（30/30再実行PASS）。初回deploy:checkはWindowsサンドボックスのesbuild親ディレクトリ読取制限でFAIL。WRANGLER_LOG_PATHをローカル.wrangler/logsへ移し、承認済みローカル実行でPASS。画像ロード・タッチ反映を待たなかったQAスクリプトのassertionは、画像完了／animation frameを待つ手順に修正しました。画像レビューで盤面の不均等な行高さを発見し、明示grid行で修正後に同じQAを再実行。拡大盤面のタッチpanは移動モードで実測しました。

証拠はCodexの今回のvisualizations出力先にone-stroke-qa.json / one-stroke-large-qa.jsonと画面PNGを保存（配信・Git対象外）。ローカルDBの数字は検証データで、利用者反応ではありません。

公開前の人間確認: 実スマホで指の操作性と移動モード、20問の体感難易度、報酬画像・匿名ログ説明と保管期間、対象本番DB／0004適用、公開後のroute・D1保存。Safari/Firefox、実機、Cloudflare上での本番build・今回追加分の公開URLと本番ログは未確認。commit / push / deploy / remote DB書込は今回実施していません。公開準備の範囲で終了し、追加機能は加えません。

### 通常盤面の縮小（2026-10-05）

盤面幅をコンテナ幅と画面高さ70svhから求めた上限の小さい方にし、通常表示で盤面内部にスクロールが出ないよう縮小・中央配置。拡大モードは維持。npm run build PASS。Playwrightで1280×720 / 1280×600 / 390×844 / 390×600 / 320×568の全5難易度（25組合せ）でscrollWidth≤clientWidth、scrollHeight≤clientHeightを実測PASS。縮小後のマウスドラッグクリア・拡大表示・console確認を含む28項目PASS。証拠: one-stroke-fit-qa.jsonとone-stroke-fit-desktop.png / one-stroke-fit-mobile.png（今回のvisualizations出力先）。

## 問題セット・難易度再設計（2026-10-05）

今回の正本はone-stroke/puzzles.json。以下は前節の初版問題構成を更新する結果です。盤面19問を差し替え、easy-1の形状・START/GOAL・正解経路は維持しました。問題IDと5難易度・20問を維持。UI・配色・タイトル・操作・ルール・ログ項目/ID発行・報酬・URL・Cloudflare設定は変更していません。主要12ファイルを作業開始時とSHA-256比較し一致。catalog.jsは新しい問題のサイズ・マス数を反映する生成データとして更新し、APIの仕様・実装は維持しました。

変更はpuzzles.json / catalog.js、scripts/generate-one-stroke.mjs / one-stroke-solver.mjs / verify-one-stroke.mjs / one-stroke-quality.mjs / one-stroke-easy-baseline.jsonと、このREADMEの結果追記のみ。baseline JSONは保持する既存Easyの生成入力です。既存の未コミット変更は保持、commit/push/deploy/remote DB書込なし。

### 構成・形状

| 難易度 | 問題数 | サイズ | 使用可能マス | 内部穴の箇所数 |
| --- | ---: | --- | --- | --- |
| Easy | 5 | 8×8 | 60〜62 | 0 |
| Normal | 5 | 8×8 / 9×9 / 10×10 | 62〜96 | 1〜3 |
| Hard | 5 | 10×10 / 11×11 / 12×12 | 78〜100 | 2〜4 |
| Expert | 4 | 10×10 / 11×11 / 12×12 | 86〜109 | 3〜4 |
| Challenge | 1 | 16×16 | 157 | 5 |

- 中央穴型9問。中央1マスのみのA型2問（normal-1/2）、中央2〜3セルの小欠損B型2問（normal-3 / hard-5）、中央の穴を回り込むC型2問（hard-5 / expert-2）。分類は重複します。他に複数穴の中央配置を含みます。
- 細道型10問、明確な複数領域型6問。後者はnormal-5 / hard-2 / hard-3 / expert-1 / expert-3 / challenge-1。
- コの字2問、櫛形1問、左右／上下の二領域、三領域連鎖、中央3×3穴の環状型、中央L字穴、外周の非対称切り込みを混在。
- Normal以上で中央付近STARTが9問。隣接START/GOALがhard-4 / expert-2 / expert-4の3問。Expertでは中央STARTが3/4問。
- Expertを13×13から10〜12に縮小。Challengeも18×18/290セルから16×16/157セルへ縮小し、内部穴・三領域・水平/垂直の2本の1マス幅接続部で順序を作りました。

穴数は外周に接しないblocked_cellsの上下左右連結成分数で、セル数とは別。中央穴は盤面中央の半分の領域（中心から幅/高さの1/4以内）に重なる内部穴。A/Bの小中央欠損はより狭い中心領域（中心からfloor(幅/高さ÷5)以内）で数えます。細道は使用可能な隣接が対向2セルだけのマスを持つ盤面。複数領域は、その細道マスの除去で8セル以上の領域が二つ以上できる盤面。自動分類の定義を固定し、雰囲気で数えません。

### 選定・難易度確認

生成はランダム全体形状から、明示した穴・切り込み・U字・櫛・領域テンプレートと端点の探索へ変更しました。seed=20261005で再現。対角の色数と端点の必要条件を先に検査し、保存済み解を参照しない既存DFSで実際に探索して採用します。公開データは生成を全問成功させてからまとめて保存し、失敗した候補を混ぜません。探索上限到達は解なしと区別し、どちらも不採用。

開発ソルバーは橋（1度しか渡れないグラフ辺）で分かれた領域の入口・出口を固定してDFSを分解します。残り領域の連結性は、既に通過した現在位置を再接続に使わず、未踏セルだけで検査するよう強化。ノード数・分岐・バックトラック・強制手割合は機械的な参考値として保存し、ラベルは穴・接続部・端点・形状を含めて選定しました。数値順に難易度を並べたものではありません。

Normal以上は完全矩形・外周欠損だけの盤面を採用せず、全15問に内部穴を配置。横/縦、走査方向の反転、STARTへ回転した標準蛇行列と、STARTから直進優先で行/列を変えて折り返す単純操作を検査し、15/15問がクリア不可でした。これは少数の回り道を加えた全ての人間攻略を網羅して排除する判定ではありません。旧セットもこの厳密な蛇行判定は0件だったため、今回の改善根拠を蛇行件数の減少とは扱いません。旧Normal以上15問の内部穴盤面は3問、新セットは15問で、形状と端点の条件を強化しています。

Hard以上10問すべてについて、正解経路の途中で別の合法な隣接未踏セルに進むと、そのセルを再利用しない限り残り領域を連結できなくなる具体例を8〜21件保存しました。特にhard-2 / expert-3はSTARTからすぐ接続部の入口へ進むと左右の未踏領域が分断されます。ブラウザでhard-2の誤進路が合法入力として受理され、Undoで回復することを確認。これにより、長さ以外に『領域を埋めてから渡る』『後半の接続を残す』という順序制約があることを実測/構造で確認しました。

全20盤面の実ブラウザ画像とASCII配置をレビュー。Normalの中央単穴は回り込みを増やす一方で大部分が素直。Hardは複数穴・縦横の接続部・U字を混在。Expertの櫛形は各歯の出入りを支える帯、中央環状型と中央4穴型は近接GOALを最後まで残すことが主な判断点です。これはモデルによる形状・経路分析で、人間の初見プレイの評価や体感の単調な難易度上昇を確認したものではありません。

| 問題 | サイズ | セル数 | 穴箇所 | 中央穴 | 細道 | 複数領域 | 誤進路例 | 設計意図 |
| --- | --- | ---: | ---: | --- | --- | --- | ---: | --- |
| easy-1 | 8×8 | 60 | 0 | — | — | — | 9 | 外周だけの小さな欠損を持つ既存Easyを維持。 |
| easy-2 | 8×8 | 62 | 0 | — | — | — | 14 | 外周の小さな欠け。穴を回り込む判断は不要。 |
| easy-3 | 8×8 | 62 | 0 | — | — | — | 20 | 右上だけを削った素直な盤面。 |
| easy-4 | 8×8 | 60 | 0 | — | — | — | 15 | 対角の小さな外周欠損。 |
| easy-5 | 8×8 | 61 | 0 | — | — | — | 4 | 角を小さく丸めた盤面。 |
| normal-1 | 9×9 | 80 | 1 | あり | — | — | 8 | 中央1マスの穴。中央行を直進できず、左右の回り込みを選ぶ。 |
| normal-2 | 8×8 | 63 | 1 | あり | — | — | 6 | 中央付近の1マス穴。穴の上下の帯をつなぐ場所を残す。 |
| normal-3 | 10×10 | 96 | 3 | あり | あり | — | 30 | 中央付近の離れた3穴と非対称の外周欠損。穴の間の順序を考える。 |
| normal-4 | 9×9 | 62 | 1 | — | あり | — | 4 | 幅3のコの字と小穴。片側の腕から底を回って反対側へ。 |
| normal-5 | 9×9 | 64 | 1 | — | あり | あり | 6 | 二領域の接続部。左側を埋める前に渡ると戻れない。 |
| hard-1 | 10×10 | 93 | 4 | あり | — | — | 11 | 4つの内部穴と非対称外周。中央の十字と外周をつなぐ出口を使い切らない。 |
| hard-2 | 11×11 | 98 | 3 | — | あり | あり | 13 | 3穴と二領域。細道の入口に進む前に左領域を完了する。 |
| hard-3 | 10×10 | 78 | 2 | あり | あり | あり | 20 | 上下二領域と縦の1マス幅通路。先に上側の穴を囲む帯を埋める。 |
| hard-4 | 12×12 | 100 | 3 | — | あり | — | 15 | 幅広のコの字と3つの穴。両腕と底の回り込みを設計する。 |
| hard-5 | 10×10 | 90 | 2 | あり | — | — | 15 | 中央L字穴と右下の小穴、左からの切り込み。中央を回る経路を残す。 |
| expert-1 | 12×12 | 109 | 3 | あり | あり | あり | 8 | 幅3の櫛形と3穴。歯ごとの出入りに必要な底の帯を温存する。 |
| expert-2 | 11×11 | 108 | 3 | あり | あり | — | 8 | 中央の大きな穴と小穴。STARTとGOALは近いが、中央環状領域を一周して最後に戻る。 |
| expert-3 | 11×11 | 95 | 4 | — | あり | あり | 14 | 4穴・非対称二領域。中央付近のSTARTから左領域を先に回収し、細道を最後に渡る。 |
| expert-4 | 10×10 | 86 | 4 | あり | — | — | 17 | 中央隣接START/GOALと4穴。目の前のGOALを最後に残し、上下左右の領域をつなぐ。 |
| challenge-1 | 16×16 | 157 | 5 | — | あり | あり | 21 | 非対称の三領域と二つの1マス幅接続部。穴を回って各領域を完了する順序を組み立てる。 |

### コマンド・ブラウザ実測

- npm run puzzles:generate: PASS、20問の再現生成。旧形状19問を差し替え、1問を保持。
- npm run puzzles:verify: PASS、20/20独立探索。START/GOAL、使用可能数、非使用マス回避、全セル1回、隣接、終端GOAL、catalog一致、全問の既存匿名API許可項目への適合、品質メタデータ一致を検証。
- 新しい枝刈り/領域分解は3×3全欠損形状と全端点の9216ケースを、枝刈りのない素朴DFSと照合してPASS。
- npm test: 30/30 PASS。ゲームルール・全問題・既存2ゲーム・匿名ログ・API・migrationの既存テストを維持。
- npm run checkと追加開発スクリプトのnode --check: PASS。
- npm run build: PASS、production静的成果物を生成。npm run deploy:check: PASS、Pages Functionのローカルコンパイル。Cloudflare上の本番build/公開は今回未実施。
- Chrome 154 / Playwright、PC1280×900で全20問の開始→ドラッグ→直前Undo→リセット→正解経路ドラッグ→CLEAR→踏破数確認を実施、全てPASS。各難易度最低1問の要求を満たし、保持問題・差替問題とも確認。
- 全20問を390×844スマホ幅でも表示し、ページ横はみ出し・盤面内部スクロールなし。console error/warningなし。今回のUI検証では匿名ログAPIを204のモックにしており、本番送信やD1への検証イベント投入はしていません。
- UI/ルール/操作/ログ/報酬/設定の主要12ファイルのSHA-256は作業開始時と一致。

候補選定中のnode scripts/generate-one-stroke.mjsは、normal-5の色数33/31やhard-4/expert-3のNo acceptable candidateで一度FAIL。色数・端点と内部穴の連結/入口出口条件を修正し、候補を棄却・変更した後に最終全生成/検証PASS。証拠はvisualizationsのpuzzle-redesign-generation.txt / puzzle-redesign-verification.txt / puzzle-redesign-summary.json / puzzle-redesign-browser-qa.json / redesign-board-atlas.png等。9216ケース照合と最終20問検証で開発ソルバーの変更を確認済み、未通過の候補は公開JSONに含みません。

未確認: 人間の初見での難易度順・解答時間、実スマホ/他ブラウザ、今回の更新データの公開後配信・本番ログ。今回はUIや操作を変更しておらず、スマホ幅確認はdesktop Chromeのviewport変更です。前回のタッチ検証とは区別します。公開前に20問の体感難易度を確認してください。必要条件を満たした範囲で終了し、追加機能は加えていません。

## 一筆の旅の公開反映（2026-10-05）

- ユーザーの明示指示により、トップページの `/one-stroke/` リンクを含むゲーム追加・問題更新を `main` へpushして既存Git連携Pagesに公開する。
- Wranglerで実在するPages projectは `lightweight-browser-games`、production branchは `main` と確認。公開先は https://lightweight-browser-games.pages.dev/one-stroke/ 。従来のREADMEのURL記載を実際の公開先に修正。
- 本番D1は指定IDと一致、実名 `lightweightblowsergame`。remote SQL exportをGit対象外の `.wrangler/` に取得後、`0004_one_stroke.sql` を適用: PASS。適用後、既存9行と0001〜0004のmigration履歴を確認。
- 公開後の実ブラウザ・匿名ログ保存の確認結果は後記する。