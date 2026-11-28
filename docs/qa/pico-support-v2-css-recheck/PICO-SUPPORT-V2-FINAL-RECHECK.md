# Pico Support V2 — 最終限定再検証 2026-11-28
対象PR #59 HEAD `a870dd1ddf49c4513cf5b438f73b879befa67a0f` / base `6e579f36ab3cc609428da1a27719fc65088fc384`。前回独立QA `39d6b2666158848bb42ec16485c1624e2de3b357`、固定期待値 QA56-20261128 `509de4dfb85e1d1501edfc95c60326f5062f92f8`、Issue57 LOCK。前回の独立再現コード recheck.py / independent.cjs / flow.py / overflow.py を同じ固定コミットから取得し再実行、期待値変更なし。固定SHAの候補ソースを取得（ローカル写し末尾改行追加）、Chromium headless、mock speech。背景は旧PR40ローカル画像を補助使用し、正式Graphic完全照合は対象外。
## 判定
**PICO-03 PASS。Pico Support V2（今回限定独立検収範囲）最終PASS。PR #59のV2 Release Candidate採用 GO。共通エンジンV2全体の最終PASS・Production統合はHOLD。**
## PICO-03 実測
S005 scene05 index20 Q10、1280x720、Support3: Goal client/scroll 29/29px、Support 51/51px、actions 26/26px。前回37/39から解消。文字rectが各領域内に収まり、Support下端692.921875 < actions上端694.96875。スクリーンショット目視でヒント2行とも表示。再押下も固定ヒント一致、overflowなし（128ケースの4段観測）。期待値を変えずに合格。
|幅|ケース|初期 ref px|3行 ref px|固定ヒント一致|正解イベント|遅延無変化|overflow(Goal/Support/actions)|
|---:|---:|---:|---:|---:|---:|---:|---|
|320|32|107.935|139.957|32/32|32/32|32/32|0/0/0|
|390|32|107.937|139.962|32/32|32/32|32/32|0/0/0|
|844|32|107.989|139.992|32/32|32/32|32/32|0/0/0|
|1280|32|107.996|139.991|32/32|32/32|32/32|0/0/0|
overflowは前回と同じ scroll>client+1px判定、重点ケースは厳密差0。通常・feedback・全Support段階で検査。全128件ボタン横一列。全512ヒント一致。PICO-01 PASS、PICO-02 構造監査維持、PICO-04 遅延Judge resolve/reject両PASS。
## 回帰
全3Story通し32問、次問リセット、台詞Supportボタン、旧Save代表3地点（原本不変）PASS。合成Vocabulary 2語の誤答→正答→完了PASS。S006 Q10固定三値3ケースPASS。前回候補41177d...→今回差分は実装CSSのみ3追加2削除、他は制作証拠。Story/Graphic/Judge/Save/Audio/Voice変更なし。CI [46132061417](https://github.com/kwgkw452-collab/Quest/actions/runs/46132061417) 3/3成功。
## 残存HOLD（共通エンジン全体）
物理iPhone/Safari/mic/Safe Area、全旧Save地点・切戻し、正式Graphic完全比較、全Judge期待値corpus、実Monster Battle（合成ではない）、統合Audio/Voice（凍結中）。今回の限定PASSとは別。Production変更/mergeなし。Director承認まで統合不可。
