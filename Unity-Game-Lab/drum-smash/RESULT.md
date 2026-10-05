# ドラム缶スマッシュ MVP 実施結果

対象: 1ステージ・3球・15本の3D物理ゲーム。12本以上でCLEAR、3球終了後に未達ならGAME OVER。追加機能・外部Asset・公開・オンライン機能は対象外。実施日: 2026-10-05（JST）。

## 環境と起動

- Unity: **6000.6.4f1 (12bfff696524)**。Windows 11 / PowerShellで確認。
- Project: `C:\Users\Yusuke\Documents\ChatGPT\CheapGame\Unity-Game-Lab\drum-smash`
- Scene: `Assets/Scenes/DrumSmash.unity`
- Web: `Build/Web/index.html`（HTTP必須）。ローカルURL: http://127.0.0.1:4181/
- Editor: `run-unity.ps1 -Action Open` で開き、上記Sceneを開いてPlay。
- Web配信: このフォルダで `node serve-web.mjs`。
- 検証再現: `run-unity.ps1 -Action Play` / `run-unity.ps1 -Action Build` / `node verify-browser.cjs`。Unityは既存ライセンスにアクセスできる通常のホスト環境で実行する。

操作: 画面中央付近でクリックし、下へ引いて離す。引く距離で強さ、左右の引きで方向を決定。狙いの線を表示。結果画面のRETRYまたは右下RETRYで即リセット。

## 作成ファイル・Scene構成

既存の疎通確認プロジェクトと既存ブラウザゲームは変更していない。新規ファイルはこのProject配下のみ。

|ファイル|用途|
|---|---|
|`Assets/Scripts/DrumGame.cs`|ドラッグ操作、3球制限、進行、スコア、COMBO、UI、RETRY、音、演出、状態計測|
|`Assets/Scripts/DrumBarrel.cs`|姿勢と場外による一度限りの倒壊判定|
|`Assets/Scripts/DrumBall.cs`|ボールと缶の実衝突から演出を発火|
|`Assets/Editor/DrumAutomation.cs`|Scene・自作Material・Prefab生成、実Play検証、Web Build|
|`Assets/Plugins/WebGL/DrumTelemetry.jslib`|localhost検証用の読み取り専用状態計測。外部送信なし|
|`Assets/Scenes/DrumSmash.unity`|1ステージの保存Scene|
|`Assets/Prefabs/Drum.prefab`, `WeightBall.prefab`|金属缶、重量球|
|`Assets/Materials/*`|自作色・金属Material、トーラス型リングMesh、Physics Material|
|`Packages/manifest.json`, `packages-lock.json`|Unity標準モジュールのみ|
|`ProjectSettings/*`|Unityが生成した設定|
|`run-unity.ps1`, `serve-web.mjs`, `verify-browser.cjs`|実行・配信・ブラウザ操作検証|
|`evidence/*`|実測JSON、ログ、Editor描画・ブラウザスクリーンショット|

上記に加えてUnity標準の `.meta` ファイルが生成される。Library / Temp / Logs / Buildは生成物としてProject内 `.gitignore` で除外。

Scene: Main Camera（固定透視）、Directional Key Light（影）、暖色Point Fill Light、床、背景の壁と柱、安全ライン、発射位置マーカー、重量球、5/4/3/2/1段の15本の缶、UI Canvas。UI Canvasにゲーム制御を置き、画面表示はUnity標準IMGUIを使用。実行時にLineRendererと短いParticleSystem、AudioSourceを生成する。Prefabは重量球と缶の2種類。

缶はCylinder本体・上蓋・栓・上下と胴の4本の自作リング。基本色は青緑1色でリング・蓋は金属色。床影と金属反射で立体感を付けた。Colliderは安定した平面接触を優先したBox（見た目との差は片側約1.5cm）。

## 最終設定とルール

|項目|Ball|Barrel|Floor|
|---|---|---|---|
|Mass|14kg|4kg|固定|
|Collider|Sphere、半径0.75m|Box、0.92 × 1.12 × 0.92m|Box、18 × 0.5 × 20m|
|Linear damping|0.07|0.12|—|
|Angular damping|0.14|0.22|—|
|Dynamic / Static friction|0.45 / 0.60|0.55 / 0.65|0.55 / 0.65|
|Bounciness|0.03|0.04|0.04|
|Collision detection|Continuous Dynamic|Continuous Dynamic|固定|
|Solver position / velocity iterations|12 / 6|12 / 6|—|

Rigidbody interpolationを使用。重力は標準の `(0,-9.81,0)`、fixed timestepは0.02秒。缶間隔は横1.02m・上下1.12m。発射位置 `(0,0.85,-7)`、缶列の奥行きz=5。

- 発射はRigidbodyの初速指定。ドラッグ距離による速度9〜23m/s。上方向比率0.22、左右比率±1.3まで。最大引き量の基準は画面高さの38%。有効ドラッグは12px超。
- 次球は発射2秒後以降の静止0.8秒、または7秒経過で使用可能。最後の球は時間だけでGAME OVERにせず、缶と場内の球が落ち着くまで待つ。場外に落ちた球は無効化する。
- 倒壊: 上方向の傾き48度超、y < -0.5、xの絶対値 > 9、z > 10またはz < -11。一度countedを立てた缶は再加点しない。
- 1本100点、12本になった瞬間CLEAR。倒壊が続けば15本でPERFECTへ表示が変わる。
- COMBO: 前回倒壊から0.85秒以内だけ継続、表示は最後の倒壊後1.5秒。スコア倍率なし。
- Shake: 衝突速度3m/s以上のBall–Barrel衝突、最大振幅0.035m、0.14秒。通常は固定位置へ復帰。
- Particle: 同衝突で16個、寿命0.15〜0.38秒、最大64個。発火は0.09秒以上の間隔。
- 音あり: Unity内で波形を生成した短い金属音とCLEAR音。外部音源なし。ブラウザの音声開始は初回クリック後。
- RETRY: 旧ラウンドを即無効化し、新規15本・球を生成。スコア、球数、COMBO、演出カウンタ、粒子、揺れ、ゲーム状態をリセット。

## 検証結果

Editor Play検証: **PASS**。`evidence/editor-tests.json`。実際にUnity Play Modeへ移行し、通常Rigidbodyを動かした。独自物理モデルでの代替ではない。

|確認|実測|
|---|---|
|開始時の安定|8秒間、倒壊0本。最大缶速度0.025632m/s|
|発射・衝突・連鎖|3球、12本倒壊、1200点、CLEAR|
|投球テストの初速|`(0,4.4,20)`, `(-1.4,4.4,20)`, `(1.4,4.4,20)`m/s|
|自然衝突の最大缶速度|9.724415m/s|
|缶中心の最高位置|6.448194m（開始時最上段5.04m）|
|演出|有効衝突6回、火花6回、Shake6回、COMBOあり|
|同時発射制限|発射直後の追加Launchを拒否|
|方向|左右のドラッグが反対側への初速xへ反映|
|重複加点|既に倒れた缶を立て直し・再回転後も追加加点なし|
|GAME OVER|場外へ3球、倒壊0本、ゲーム終了|
|RETRY|15本、0点、0球使用、COMBO・衝突カウンタ0に復帰|
|Console|最終Play監視のError / Exception / Assertが0件|

Editor描画を `editor-start.png` / `editor-impact-result.png` / `editor-misses.png` に保存して確認。EditorのキャプチャはCameraによる描画で、UIは含まれない。GUIのGame Viewを人間がマウスで操作した結果と区別する。

物理値は上記Playで実際に動かし、初期崩壊0、複数缶の連鎖、飛び上がり量、残存缶を確認して採用した。「重量感・気持ちよさ」の最終的な好みは人間の試遊評価待ち。測定値を人間の評価と同一視しない。

Web Build: **PASS**。`evidence/web-build.json` / `web-build.log`。Succeeded、エラー0・警告0、22,445,166 bytes、235.345秒。標準Webテンプレート、圧縮なし、初期メモリ128MB。配信するwasmのContent-Typeは `application/wasm`。

ブラウザ: **PASS**。Chrome **154.0.8037.93**、実際の可視ブラウザでマウス押下・ドラッグ・リリースを操作。`evidence/browser-tests.json` に全状態系列とチェック結果を保存。発射や倒壊をJSから直接注入していない。観測用bridgeは状態の読み取りだけ。

|ブラウザ確認|実測|
|---|---|
|起動・UI・狙い線|描画成功。8秒経過時も倒壊0本、速度最大0.025632m/s|
|連鎖崩壊・スコア|1球目9本、2球目11本、3球目13本、1300点、CLEAR|
|COMBO|最大×9|
|物理|最大缶速度9.402595m/s、缶中心最高位置5.664555m|
|衝突演出|有効衝突・火花・Shakeの発火が各6回|
|操作方向|右への引きで初速x負、左への引きで初速x正|
|発射制限|発射中のドラッグで2球目を発射しない。3球終了後の操作も球数3のまま|
|未達終了|3球を左右へ外し、倒壊0、GAME OVER|
|RETRY|CLEAR / GAME OVERそれぞれから0点・球数・缶列を初期化し再プレイ可能|
|エラー|pageerrorとconsole errorが0件|

画面は `browser-start.png` / `browser-aim.png` / `browser-clear.png` / `browser-game-over.png` / `browser-retry.png` に保存。CLEARとGAME OVERのUIを含むスクリーンショットを目視確認した。火花の描画はEditorの衝突後画像にも確認できる。Shakeの実測は発火回数の確認で、揺れの知覚強度は人間の評価待ち。

EditorとWebで安定性・連鎖・12本以上のCLEAR・3球未達のGAME OVER・RETRYが同じく成立。最終倒壊本数はEditor12本 / Web13本。投球入力・実行環境が異なるため数値の完全一致は判定条件にしていない。致命的な差は今回の試行では観測しなかった。

自動操作では1回の成功プレイが初投球から約18秒で完了（素早い操作）。人間の狙う時間を含む30秒〜2分の所要時間は未確認。強制的な待ち時間・追加ステージは設けず、人間の短い試遊に渡す。

## 実行上の障害と対応

1. 制限付き環境でEditor起動が終了コード198。`com.unity.editor.headless` の有効ライセンスが見つからなかった。既存ライセンスへアクセス可能なホスト実行で解決。認証・ライセンス設定変更なし。
2. 初回の即時Play開始でUnityの `SearchDatabase` 起動処理が例外。ゲームのチェックは通ったがConsole 1件で全体FAIL。起動後5秒かつimport / compile終了を待ってPlayへ進む修正後、再実行で全体PASS。例外の抑制・除外はしていない。初回結果 `editor-tests-attempt1.json` と各ログを保存。

Codexで実施: ソース作成、Prefab / 自作Material / Scene生成、コンパイル、Editor Play実測、物理・進行の検証、Web Build、HTTP配信、実ブラウザ操作と画面確認。独自制作基盤や外部Asset探索は行っていない。

人間操作: 制作・今回の実行検証のための操作は不要だった。試遊による重量感・操作性の評価を依頼する。認証変更やインストールは実施していない。

未確認: 人間によるEditor GUI操作の感触、音の聴感、Chrome以外・モバイル・公開環境、全15本のPERFECT到達（12本以上のCLEARは実測済み）、長時間の反復プレイ。Editor GUI Consoleの目視は未実施であり、ログ・監視による0件確認と区別する。

次に改善すると効果が高そうな候補（今回は実施しない）: ①試遊評価に基づくドラッグの強さ調整、②Colliderの円形近似、③金属音の聴感調整。完了後は追加改善へ進まず停止。

## トップページ・Git組み込み（追加依頼）

ユーザーの追加依頼により、トップページに `/drum-smash/` リンクを追加。検証済みWeb Buildをリポジトリ直下 `drum-smash/` に配置し、`scripts/build.mjs` の明示コピー対象に追加した。`server.mjs` はwasm / data / icoのMIME配信に対応。ゲーム本体・物理設定は変更していない。

- `npm run build`: PASS。
- `npm run check` と `node --check server.mjs`: PASS。
- 実Chromeで `http://127.0.0.1:4182/` の新規リンクをクリック→ `/drum-smash/` 起動→実ドラッグ投球: PASS。1球使用、7本倒壊・700点、エラー0を確認。証跡はローカル `output/playwright/drum-integration.json` / `drum-home.png` / `drum-integrated.png`。
- 配信用Web Buildは再コンパイルせず、前節で検証済みの成果物をコピー。Unity不要で既存サイトのビルドに同梱される。
- Push対象は今回のゲームのソース・配信用Build・リンク・ビルド設定・報告。既存の疎通確認用Project、Library、ローカルログ・証跡は除外。
- `origin/main` へのPushはユーザーが明示承認。READMEに記載されたGit連携ではmain Pushが自動deployの入口になる。公開環境の反映はこのローカル統合検証とは別であり、本節では未確認。
