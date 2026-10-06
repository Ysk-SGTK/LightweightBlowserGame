# 共通記録カード — 実装と実測結果

2026-10-06。対象: minesweeper / memory / one-stroke / color-blocks / number-tap / drum-smash / small-konbini。追加のランキング・アカウント・AI・自動SNS投稿はなし。

## 構成

`src/card-data.js` が結果から共通CardDataへ変換する。`gameId, gameName, title, titleKey, subtitle, primaryScoreLabel, primaryScoreValue, stats[{label,value}], comment, gameUrl, hashtag`。コンビニのみ `management_style, product_style, operation_style, final_profit` を追加。

`src/result-cards.js` が全ゲーム共通の1200×630 Canvas描画・結果導線・dialog・操作を担当する。`src/result-cards.css` がスマホ幅・ボタン・読みやすい全文転記を担当。Noto Sans CJK JPとOFLライセンスを `assets/fonts/` に同梱し、FontFaceのロード完了後に描画。OSフォントや画像生成AIに依存しない。文字幅に応じたサイズ調整とコメント改行を行う。

HTMLゲームは既存 `sendEvent` の終了イベントを使う。UI生成に失敗しても既存ログ送信とゲームは継続。retry / next_level / game_startで旧カードを閉じ、導線を隠す。既存プレイのsession_id / play_idを引き継ぐ。

Unityは既存 `window.drumSmash.latest` と `window.shopSnapshot` を読み取り、観測されたCLEAR / GAME OVERまたは7日分のhistoryを持つFinalで導線を表示。generation変更・Finalからの再開で旧カードを破棄。ページ閲覧とカードは同じsession_id、カード用play_idは1周ごとに発行する。Unityには従来ゲーム開始・終了ログがないため、存在しないplay_idへの紐付けを推測しない。ソースProject・配信用WebGLバイナリは変更しない。

## 称号とコメント

称号は小さなprefix / coreの組み合わせ。完全ランダムや全組み合わせ文章列挙は使わない。

| ゲーム | 主な判定軸 |
| --- | --- |
| minesweeper | 旗が地雷数の半分以上 / 40秒未満 / 慎重派 + clear / 非clear |
| memory | mismatch 0 / 1〜4 / 5以上 + 40秒未満 / 以上 |
| one-stroke | undoとresetが0 / resetあり / undoあり + Hard・Expert・Challenge / その他 |
| color-blocks | 最大グループ15以上 / 残り10以下 / その他 + clear / game over |
| number-tap | MISS 0 / あり + 1数字あたり1秒未満 / 以上 |
| drum-smash | 1球 / コンボ3以上 / その他 + 全15本 / その他 |
| small-konbini | 下記の3軸 |

コンビニ: 7日間の販売数で加重したprice tier平均（販売なし時は設定tier平均）が0.75未満なら薄利多売、2以上なら高単価、それ以外はバランス経営。最多販売商品の比率が35%以上ならその商品主力、それ以外は万遍型。2人体制4日以上なら人員投資型、0日ならワンオペ派、その他は廃棄率5%以下なら廃棄削減型、それ以外は売上優先型。カードには利益・売上・主力商品・廃棄・機会損失・2人体制・販売数を表示する。

一言コメントは結果条件の分岐と固定テンプレート。実際にclearした場合と失敗した場合を区別し、コンビニでは3軸の文言を文章へ組み込む。

## 保存・共有・ログ

Canvas.toBlobでPNG化。保存はBlob URLとdownload属性（`<gameId>-result.png`）。コピーはsecure contextのClipboardItem + navigator.clipboard.write。非対応はdisabled、失敗はdialog内に表示。Web ShareはFile(image/png)と称号・主結果のテキストとURLを渡し、canShareで対応判定。キャンセルは別表示。Xはintent/tweetへテキスト・URL・`#LightweightBrowserGames`を渡す。画像自動添付はせず、保存・コピー後の手動添付を案内する。

共有URLとカード表示URLは現在のorigin / pathnameを使い、queryとfragmentを除去する。test=1は共有URLへ入らない。ログでは既存sendEventのis_test判定を維持する。

既存POST /api/eventsで `result_card_open, result_card_download, result_card_copy, result_card_share, result_card_x_share` を受信する。厳格allowlistで `game_id, title_key, primary_result` と既存匿名ID・時刻・sequence・is_testを保存。コンビニには3軸とfinal_profitも保存。文章全文・個人情報は保存しない。追加migration `0008_result_cards.sql` は `result_card_events` と索引のみ作成し、既存game_eventsを変更しない。カードのsequenceは結果イベント番号以降のカード操作順。既存ゲームイベントのsequenceとは別テーブルで扱う。

## 実測

環境: Windows / PowerShell 7.6.5 / Node 24.14.1 / installed Chrome + bundled Playwright。Browser plugin not available。ローカルURL `http://127.0.0.1:4173/<game>/?test=1`、PC 1280×900、スマホ相当390×844。物理スマホは未確認。

| 検証 | 結果 |
| --- | --- |
| npm test | PASS 46/46。既存44件 + 新規2件 |
| npm run check | PASS。新規JSもチェック対象 |
| npm run build / npm run deploy:check | PASS。静的production assets / Pages Functionsコンパイル |
| npm run db:local | PASS。0008適用 |
| 5 HTMLゲームの実プレイ→終了→カード→PNG保存→X URL→retry、one-stroke next level | PASS |
| number-tap / memory実クリップボードPNG書込とreadによる読み戻し | PASS |
| Web Share成功・キャンセルのAPI契約テスト | PASS。PNG File・text・清潔なURLを確認 |
| 実Web Share呼出し | canShare=trueのChromeで実クリック。ページ例外なし。OS側の選択・送信完了は未確認 |
| Unity drum-smash | PASS。実マウス操作で12本・2球・1,200点CLEAR→カードPNG→retry |
| Unity全画面 | PASS。実プレイ→fullscreen内の導線→dialog→PNG保存 |
| Unity small-konbini | PASS。実マウス操作で7日間→Final→3軸カードPNG→retry |
| コンビニ実結果 | 利益22,035円、売上70,700円、飲料主力、廃棄19、機会損失185、2人体制4日、販売278個 |
| 全7ゲームのPCと390px viewport | PASS。カード全体表示・dialog内横スクロールなし・操作ボタン |
| 日本語PNG目視 | 全7枚PASS。文字化け・文字切れ・はみ出しなし |
| ページ例外 / ローカルカードAPI | HTML・Unityとも0例外。全カード操作HTTP 204、is_test=true |
| 称号境界 | 全7ゲーム各3入力で3つの異なるtitleKey。コンビニの価格・商品・人員各軸の変化も確認 |
| DB保存契約 | 全7ゲーム×5操作=35件、重複送信後も35件、is_test=1、余分な項目拒否、負の利益保存PASS |
| git diff --check | PASS |
| 最終UIの障害復帰 | PASS。フォント読込失敗時も閉じられ、再試行で生成成功。コピー拒否後もPNG保存・retry成功。スマホ用全文に全stats表示 |

証跡はGit対象外の `.wrangler/card-evidence/`（html-results.json / unity-results.json / native-share.json / local-card-events.json / 全ゲームPNG・PC/スマホ画像）。検証用スクリプト・旧失敗証跡・Unity Library/Tempをcommitしない。

初回Pagesコンパイルはサンドボックス外ディレクトリ読取/log出力制限で失敗し、権限付き実行とWRANGLER_LOG_PATHのローカル化でPASS。検証スクリプトのWindows絶対パスimport、memoryのretry ID、minesweeperの開いたdialog内locatorを修正してPASS。ゲーム本体の実測失敗ではない。本番D1初回読取は7403、その後ID指定と設定指定双方で成功し、既存137件と0008のみ未適用を確認。

## 公開・Git状態

本番D1 `lightweightblowsergame`（既存GAME_LOG_DB / ID `9d4b7505-3f13-45db-96f8-82a46b752a5d`）へ0008のみ適用済み。依頼文の本番ログ保存・push・公開指示に基づく。バックアップ `.wrangler/before-result-cards.sql` 取得済み。適用前のgame_eventsは137件（rowid上限137）、events / memory_eventsは0件。適用後も旧rowid範囲137件を保持、result_card_events作成、0001〜0008適用履歴を確認。

GitHub origin/mainへcommit・pushし、自動Cloudflare Pages deploy完了と本番QAを続ける。本番サイト: https://lightweight-browser-games.pages.dev/ 。検証時は必ずtest=1を付ける。公開検証結果は以下へ追記する。

未確認: 実スマホSafari / Android、OS共有先での画像送信完了、全ブラウザのClipboard permission挙動。これらは人間側で確認が必要。既存Unityソース・バイナリ変更なしのためUnity production再buildは不要。
