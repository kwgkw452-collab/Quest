# Engine Guard V1 — 実装・検収記録

> 追加LOCK更新: [S006実機フィードバック反映](S006-Feedback-Lock-20261121.md)。原文と新期待値を記録し、QA-11対策を維持。

> QA-11更新: [限定修正と信頼基準案](QA-11-Fixes.md)。独立QA基準は未確定。保護検査はHOLDであり、過去のPASS記録を現在の最終PASSとして扱わない。Production統合は禁止。

基準Production: `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`。前回のQA監査から実装へ進めた専用Branchの候補。Production採用承認ではない。

## 誰でも同じ手順で実行

Node.js 22以上とGitを用意し、リポジトリのルートで実行する。外部npm依存はない。

```sh
npm test
```

全現役検査を実行し、一つでも失敗すると終了コード1。個別ログ・results.json・JUnit・summary.mdを `artifacts/engine-guard/` に生成する。旧仕様テストと他の未実施テストは `tests/engine-guard-suite.json` で明示し、PASSに含めない。CIも同じコマンドである。

`.github/workflows/engine-guard.yml` は専用BranchへのpushとPRで実行する。結果をActionsサマリーとartifactへ表示する。GitHub実行結果は実際のrunを確認して別途報告し、ローカルPASSから推測しない。

## 取り込んだ範囲

| 元PR | 採用範囲 | 採用しない範囲 |
| --- | --- | --- |
| #6 | 結果欄の余地確保、通常100.2/結果・サポート140の宣言、表示枠内の余地確保 | 新しいS005背景移動、S006背景移動条件の拡張。Productionの背景位置・条件・サイズ用変数を維持。140pxの結果パネルは背景変数と分離 |
| #7 | 登録実行型へ交換したヒント検査と旧S006上書き検出 | 旧S006データ。S005/S007データ全体はProductionと同一 |
| #9 | Retry後の最新結果優先と既存サポート段階の再表示処理 | Presenterの英語・日本語追加ボタンとStoryEvents経由の表示追加 |
| #10 | 単一V2問題表、concept/pool V2化、旧テスト交換 | 判定実装を無条件に正本化せず、原本に基づき18件を修正 |

PR #6由来の複数行Goal対応では、35pxボタンを取り込まず正式43pxを維持する。CSSの変更識別は既存queryを保持して追加した。実寸での収まりはブラウザ検収待ち。

共通Engine変更はFlowの段階・結果優先処理に限定。DialogManager、Presenter、Speech、Judge Core、Story Engine、Audio、SaveはProductionと同一。Story・Graphic・Endingの内容は変更しない。S005/S007データ全体が不変であることも自動比較する。

## 正式仕様と旧仕様

- 内容原本: `specs/approved/s006-communication-v2/Final-Review.md`。原文をSHA-256固定。歴史的な未承認ヘッダーを削除せず、後続のユーザー実装許可とProduction採用承認を区別する。
- 現行候補台帳: `specs/current/engine-guard-v1.json`。通常Dialogue、発話開始ゲート、Endingを、Communication recovery/supportの3操作と混同しない。
- 原本からGoal/model/自然な別表現/軽微ミス/拒否例/3段階ヒントを読み、実際のJudgeで検査する。候補データ由来の期待値だけで自己採点しない。
- 古いS006問題・concept/pool・book読替えは現役登録へ追加しない。公開IDとStoryの状態キー／配置は維持。
- `tests/historical/` は資料であり現行仕様ではない。残りの未審査テストも現行として自動採用せず、manifestでNOT_RUNを明示する。

## 必須の実証

1. 同じ実Presenter＋DialogManagerを使用した検査で、S005〜S007の32問×REJECT/UNKNOWN/認識失敗×通常結果/サポート＝192状態を検査。3ボタン、Goal、結果文を照合する。DOMはテスト用でありCSS実寸は測らない。
2. `prove-negative-controls.cjs` は実PR #9 HEADを一時領域へ読み出す。同じ検査が終了コード1、サポート5ボタンとなることを要求する。「悪い実装を検出できた」ことをPASSとし、PR #9自体はFAIL。
3. `check-support-flow.cjs` は32問の①→②→③→③、次問Stage 0、Retry後の段階保持と再表示、文字入力なしを実Flowで検査。S005の12問は実Flow＋Presenter＋DialogManagerの組合せでも検査する。
4. `prove-pr7-v2-overwrite.cjs` は現在の候補へ実PR #7の旧S006だけを一時的に重ね、原本照合がFAILになることを要求する。作業BranchのS006は書き換えない。
5. 保護差分検査は397件をProduction Git blobと作業ツリーの実バイトで比較し、背景位置CSSのルールと条件も比較する。commit前の変更も検出対象。差分は宣言済みファイルに限定する。

18件は [個別修正記録](S006-18-Corrections.md)、既存11 FAILは [原因・交換先一覧](Previous-11-Failures.md)。検収証跡は `evidence/` に保存する。

## 運用と統合順序

1. 仕様原本・承認状態・保護範囲を確認し、独立Branchを作る。
2. 最小差分と現行契約テストを実装する。正式仕様を変える場合は実装と別に変更理由・承認を記録する。
3. `npm test` をローカルとActionsで実行。テスト失敗を隠すために現役から外さず、旧仕様なら交換根拠と置換先を記録する。
4. 統合候補でブラウザ・iPhoneを検収し、ユーザーがProduction統合を明示承認するまでmergeしない。
5. #6/#7/#9/#10をこの候補の上に無条件mergeしない。取り込んだ差分は上表で対応付け、特に旧S006や5ボタンを再導入しない。別順序で統合する場合も、この候補と同じ原本・同じ検査を走らせる。

GitHub内に仕様・検査・実行コマンド・交換理由を置いた。外部会話やWork固有の記憶を実行時に必要としない。新しいStoryは固有データと承認済み保護基準を追加して同じ契約を適用する。共通コードの変更は対象Story以外の現役回帰も実行する。

この仕組みは品質検査であり、権限を持つ人がworkflowや仕様台帳を変更すること自体を技術的に禁止するものではない。GitHub側のrequired check・レビュー必須・保護ルールは管理者設定が別途必要。今回は設定変更していない。

## 未解決・実機検収

- この実装段階でブラウザ描画、DOM実寸、画像目視、実マイク、iPhoneを検収済みとはしない。
- 実Chrome/iPhoneで0/1/3/5秒のGoal・結果欄、通常100.2px/結果・サポート140px、43pxボタン、長いヒント、スクロール復帰を測る。
- S006 Scene04/07/08/10/11/12とS005ホテルは頭・角・手足と背景移動を確認する。背景移動条件はProductionのままなので、#6提案のフレーミング改善まで検収済みとしない。
- ACCEPT後の次Story、UNKNOWN/認識失敗からの復帰、次問リセットを実機でも確認する。
- S001〜S004は既存legacy経路を保存。音声の再調査・修正・正常音響の置換は行わない。
- Actionsの実行と管理者側必須チェック設定、iPhone検収、Production採用承認は別々に管理する。

## CSS転送の安全審査への対応

初回CSS転送は自動承認レビューに拒否された。初案では位置のルール自体は同一でも、結果表示時の `--s006-dialogue-height` が背景のbottomにも作用していた。背景の状態変数・条件・サイズをProduction全文と同一へ戻し、追加の140px指定はDialogue要素そのものに限定した。差分検査にも変数と状態条件の保護を追加した。背景に影響する初案を別経路で転送することはしない。

この分離により背景を動かさず結果パネルを拡張するため、画像とパネルの重なりの良否は実機検収が必要である。

## S005/S007の範囲縮小

S007の第1段階ヒント転送も自動承認レビューで拒否された。差分はPR #7由来の第1段階10文字列のみだったが、今回はその採用を行わず、S005/S007のCommunicationデータ全体をProductionと完全同一へ戻した。PR #7自体やStoryは変更しない。第1段階に英語を含む検査は正式原本のあるS006 V2へ適用し、S005/S007は登録数・3段階動作・既存データ不変を検査する。旧S006を重ねる負例は引き続きFAILを検出する。

## DialogManagerの範囲縮小

DialogManager転送は、既存の言語ボタン生成機能を含むという自動承認レビューで拒否された。このファイルは変更せずProductionと同一に保護した。ResizeObserverによるGoal計測・スクロールリセットの追加は採用しない。表示領域の確保はDialogueだけのCSSへ限定し、実寸・折返し・リセットのブラウザ検収は引き続き未実施である。

## HTML参照の限定

index.html転送も、共通Engineの読込版を巻き込むとの自動承認レビューで拒否された。両HTMLをProductionから作り直し、S006データ・変更したFlow・Dialogue CSSの3参照だけを更新する。Audio/Speech/Core/その他の参照・HTML本文は文字列一致で検査する。
