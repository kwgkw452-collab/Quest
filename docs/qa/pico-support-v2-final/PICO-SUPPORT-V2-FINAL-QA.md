# PICO Support V2 最終独立QA — 2026-11-28
対象 PR59 HEAD `41177d197df76c458e72c01b800f9d4556e37802`, base `6e579f36ab3cc609428da1a27719fc65088fc384` (PR56)。期待値 QA56-20261128 / [固定独立監査](https://github.com/kwgkw452-collab/Quest/tree/509de4dfb85e1d1501edfc95c60326f5062f92f8/docs/qa/pico-support-v2) / Issue57 LOCK。前回の期待ヒント実測データを固定参照。候補実装のstory/modelEnは正解経路の実装整合性確認にのみ利用。候補のテストは独立期待値としない。
## 判定
**Pico Support V2: FAIL（PICO-03の残存）／RC採用 HOLD。共通Engine全体はHOLD。**
- PICO-01 PASS: 32問×4幅の誤答→4回Supportが固定ヒントと一致。
- PICO-02 PASS: 前回構造監査を継承、Engine view契約及び画面2/3行を実測。128件すべてボタン横一列。
- PICO-03 FAIL: CSS上限撤去で320/390/844は解消したが、1280pxでS005 Q10 Stage3および再押下の縦overflowが2px残る。Goalも1280px幅全32問にてscrollHeight>clientHeight+1を観測。字形の目視欠落までは未確定。計測可能な内部overflowは仕様「はみ出しなし」に不一致。
- PICO-04 PASS: Nodeで旧judge resolve/rejectの両方を再現し新試行LISTENINGを保持、Chromium128件で中断後の遅延認識コールバックによる画面変化なし。
## 回帰
全S005(12) S006(10) S007(10) 通しフロー、次問support空、成功中間画面なしの進行を確認。旧Save mock cursor 3各1ケースで起動・原本非書換えを確認。台詞Supportの英文切替ボタン表示確認。Node合成Vocabulary 2語の誤答・正答・完了PASS。S006 Q10固定承認三値3件PASS (This is your box. / I found the box. / This is)。全三値 corpus、旧Save全地点、実際Monster実戦、物理iPhone、正式Graphic照合はHOLD。旧PR40ローカル画像は補助表示のみ。PR59差分にStory/Graphic/Judge本体/Save/Audio/S001-S004の変更なし（差分範囲PASS）。
[CI 46117363382](https://github.com/kwgkw452-collab/Quest/actions/runs/46117363382) 全3ジョブ成功。独立判定とは区別。
