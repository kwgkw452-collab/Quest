# Pico Support V2 独立監査（2026-11-28）
対象 [PR #56](https://github.com/kwgkw452-collab/Quest/pull/56) HEAD `6e579f36ab3cc609428da1a27719fc65088fc384`、base `b1429931385b74f5eac7e15ba94cfee3b67c6bbc`。仕様は [Issue #57](https://github.com/kwgkw452-collab/Quest/issues/57) のDirector LOCKおよび今回の明示指示。[PR7](https://github.com/kwgkw452-collab/Quest/pull/7) HEAD bfdb08666f3a9b12b4d9ff13483ab14d13c7638f の data/{s005,s006,s007}-communication.js とPR56 baseの同ファイルを取得し照合。S006 Q10は後続例外。[PR40](https://github.com/kwgkw452-collab/Quest/pull/40) の承認範囲も確認。Production・候補ブランチは変更しない。
## 結論
**構造的整理が必要。限定リファクタ開始 GO、最終QA・Production統合 HOLD。** 全面書換え不要。
## 独立再現
固定SHAから取得したソースとStory JSONをNode及びChromium headlessで検証（制作テストとは別のcheck.cjs/check.py）。取得テキストの末尾に改行が追加されたローカルコピーを使用。背景画像は過去ローカルPR40のものを補助使用したためGraphic同一性はHOLD。正解入力は候補のmodelEnによる実装整合性チェックで、独立Judge全期待値ではない。32問×4幅=128ブラウザケース、各4回のSupport=512観測。全128で正解イベント、Supportの3種表示と3段目維持。各問は新規Save cursorから起動。S005 Q4→Q5連続遷移で次問ヒント消失も確認。その他全連続遷移・旧SaveはCI参考のみ。
[CI 46111486772](https://github.com/kwgkw452-collab/Quest/actions/runs/46111486772) 対象SHA 3/3 success（browser-smoke,node-tests,staging-https-preview）。最終PASSの代替ではない。
## FAIL
### PICO-01 誤答後のSupportが見えない（高）
unified.js L28–40, communication.cjs L18,38。S005 Q1で話す→認識結果 xyzzy→ピコサポート。320/390/844/1280すべて、黄色行に「xyzzy と聞こえたよ。もう一度話してみよう。」が残り、新ヒントが表示されない。内部stageは1へ進む。期待：押下でSupport1が見える、次回2→3→3。原因：feedback残存かつpaintQuestionのheard優先。修正：Supportイベントでfeedbackを解消し一つの表示状態に遷移。全32問で誤答直後から再検査。
### PICO-02 表示状態の二重判断（高）
communication.cjs L14–15 はsupportTextのみでlayoutModeを決め、LISTENING actions=[]。unified.js L29–40 は独自にfeedback文字列とlisteningを解釈し、3ボタンを生成。Nodeで全32問のSupport未使用誤答時にengine twoRow / UI threeRow（期待140）。UIの見た目は偶然正しいが契約の不一致。単一状態定義と宣言的ボタンへ統合。timeout/unsupportedも表示状態を明文化。
### PICO-03 長文ヒントの縦スクロール（中）
unified.css L37–45。S005 Q10 Support3/3再押下は320/390/844の各2観測でsupport.scrollHeight>clientHeight+1。期待：黄色行に全文が無理なく表示される。実際：内部縦スクロールを要する。ヒント本文を改変せず、文字行高・余白・長文の扱いを整理。1280では全32件のGoal scrollHeight>clientHeight+1（例 targeted Q1 24/22px）を観測したがフォントメトリクス由来の可能性があり、実際の字形切断はHOLD。幅320のヒント文字4.12px、390で5.06px（画面可読性はHOLD、Directorの1560基準縮小契約との整合要確認）。
### PICO-04 遅延Judge例外が新試行を上書き（中、非同期Judge時）
communication.cjs L34–35。独立Nodeで1回目judgeを保留→stopListening→2回目judge保留→旧judgeをreject。期待：2回目LISTENING継続。実際：READYへ上書きされた。現在の同期localJudgeでは未再現。catchでもtoken確認をstate更新より前に行う。新試行が完了するまで操作契約を維持。
## 構造監査
- unified.js L4,101–125,126–165：UI sessionEpoch/speechRequest/speechBusy、runner serial、communication attempt/active、recognizer seq/live は別責務。一律削除は危険。speechBusy/listeningの二重管理のみ単一契約に寄せる。
- unified.js L4,131,152 dialogueVoiceはnull代入のみで読まれない。L141 stop? はspeech-browser.cjs L21に存在しない（cancelのみ）。L43/48 twoRow重複。L97 stale描画は正常画面を破壊し得るため無描画方針を検討。L97到達性はHOLD。L80–98のイベント分岐を状態契約で整理。
- unified.css L22–23,38,43：旧横並び配置が残存。ただしdocument/returnのsecondary、listening表示で使用中。全削除は不可。質問以外の表示契約を分離し横並びを使う箇所だけ残す。
- runner.cjs L23,31–39：新問インスタンス、受理時進行、battle別分岐、Save cursorは維持。speech-browser.cjs L5–18：cancel/timeout/finish/handler解除は維持。quest-v2.browser.jsは生成物なので手修正せず再生成。
## HOLD
物理iPhone、全Judge三値の正式コーパス、Graphic完全比較、旧Saveの独立全ケース、Monster実戦（この3packにはbattle定義なし）、実機可読性。CI成功と独立PASSを区別。
