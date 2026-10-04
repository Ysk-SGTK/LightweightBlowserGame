# 神経衰弱 — 紋章あわせ

サイトの `/memory/` で遊べる4×4・16枚・8ペアの神経衰弱。起動・公開・共通匿名ログはルートの [README](../README.md) を参照してください。

## テーマと報酬

`config.js` の `CARD_THEME` を `'gem'`（初期）または `'botanical'` に変更し、`npm run build` とブラウザreload。

- gem: 太陽・月・星・雫・炎・葉・六角結晶・螺旋。
- botanical: バラ・チューリップ・ユリ・ヒマワリ・クローバー・ラベンダー・桜・小さな葉。

全種類は `cards.js` のオリジナルSVG。共通枠・背景・中央構図で統一。報酬は `assets/reward.svg` を同名SVGに置き換えれば差し替え可能。PNG / WebP等の場合は `config.js` の `REWARD_IMAGE` を変更し、必要ならHTMLのaltも合わせます。画像失敗でも再プレイできます。

## 操作・演出

開く／閉じるとも160msでscaleXを1→0.05、最細部で表裏切替、160msで0.05→1。2枚目が開き終わってから一致／不一致を表示。不一致は550ms見せて320msで閉じる。成立は200msの1.05倍＋小さい明度アップ。最後は成立→盤面ハイライト320ms→CLEAR。reduced motionでは動きを無効にし、絵柄を見る550msは維持。

同カード連打・判定中の3枚目・成立済みカードをガード。1枚目の反転中に2枚目を選べます。成立演出中は次入力可能。再スタートで進行中の表示処理を中断し、新盤面への干渉を防ぎます。

## ログ

`game_id='memory'`、page_view / game_start / game_clear / retryを共通 `/api/events` に送信。startは最初の有効なめくりで1回。clearにelapsed_seconds / flip_count / mismatch_count / pairs_matched、共通項目にcard_themeも付与。sessionはページ滞在のみ、playは盤面ごと、retryでprevious_play_idに直前の盤面IDを引き継ぎます。Cookieや永続ユーザーIDなし。通信失敗でもゲームは止まりません。

実機iPhone / Android、Safari / Firefox、人間の操作感は未確認です。PC・スマホ相当のChromeと自動テストによる確認結果はルートREADMEに記載します。
