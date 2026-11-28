# 実装側検証結果（独立QA最終PASSではない）

開始時のProduction：70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f、PR56：6e579f36ab3cc609428da1a27719fc65088fc384。専用branch：refactor/pico-support-v2-20261128。2026-11-28 JST。

| 検査 | 結果 |
| --- | --- |
| Node既存＋新規回帰（Judge/Save/移行/隔離/Battleを含む10ファイル） | 166/166 PASS |
| 既存bridge契約（コード変更なし） | 8/8 PASS |
| 既存隔離契約スクリプト（コード変更なし） | Phase1 43/43、Phase2 181/181 PASS |
| 独立QA原本check.cjs（固定PR7・後続承認版のデータ） | 32問PASS、S006 Q10後続例外を維持 |
| 新規Chromium matrix | S00512＋S00610＋S00710＝32問×320/390/844/1280＝128ケースPASS |
| matrix内Support | 各問1→2→3→3の512観測、白Goal／黄色Support、横一列、108/140、全文・非重複・非overflow |
| matrix内操作 | 認識誤り→Support、停止・再試行、ハング中Support、古い認識、正解後自動進行、連続質問でreset |
| 既存共通UI画面検査 | 3Story×4viewport＝12ケースPASS |
| 既存Chromiumスクリプト | 8本すべて最終PASS（raw logs添付） |
| 新共通UIのS005/S006全進行 | S005141台詞12問、S00659台詞10問・文書16行、Save/reload、切替・二重操作回帰PASS |
| 新共通UIのS007全進行 | 既存unified-s007-browser-smoke.py PASS、10問・加入・Save |
| 新共通UIで合成Battle | 二重認識防止、誤単語、2単語順次受理、文書、Save、Story進行PASS |
| 旧HEADで故意FAIL確認 | 新Node回帰40件中38件FAIL（旧view契約と古いJudge rejectを検出）、修正後40/40PASS |
| 独立QA targeted.py再実行 | 旧HEAD4幅でfeedback残存、修正後4幅すべて承認Support1表示 |
| 旧CSS配信の負例 | QA指摘3幅で長文overflowを再現、当ローカル環境では1280もoverflow。修正後4幅すべてなし |
| 保護契約hash | Story3pack／Stage1 LOCK／Judge／Save／Battle／recognizer／runnerの10ファイルbyte不変 |

旧プレイヤーの既存Chromiumテストで、誤答feedbackを108pxとした矛盾する期待値が検出された。Issue57/PICO02の正式140pxへ、その1箇所だけ修正し、Graphic配置・表示文・正誤等の期待値は維持して再実行PASSした。旧失敗ログもexisting-browserディレクトリに残り、repo添付の同名ログは最終成功版。

最初の新規matrixでは、テストのcallback保存式がPlaywrightにfunctionとして評価され、意図せずonendを呼んだ。期待値ではなく保存を無戻り値のarrow blockへ修正して再実行した。アプリをテスト都合で変えていない。

本MacのChrome158とPlaywright1.56の組合せはTargetClosedになったため、同じ無料Playwrightの対応Chromium141を導入して検証した。CIは従来通り既存workflow・公開standard runnerを使用。新しい有料サービス・API・音響仕様変更なし。

## コード量・条件分岐

対象は手書きのcommunication.cjs / unified.js / unified.cssの3ファイル（新規runtimeファイル0）。物理LOC299→298、UTF-8 bytes17499→17061、条件分岐キーワード（if/case/catch）68→64、短絡条件50→44。Engineに必要な表示契約とstale catchを追加し、UIの二重状態と不要コードを削除したため、単純LOCの減少は1行。条件数はcomments/stringsを除いた静的近似で、ASTの循環的複雑度とは称さない。measure.pyで再計測でき、generated bundle・変更なしrunner/recognizerもmetrics.jsonへ分離記録。

## 再実行

既存GitHub ActionsのNodeコマンドをそのまま利用。runtime.test.cjsが新Node回帰を読み込み、unified-browser-smoke.pyが128ケースと合成Battleを起動する。新規workflowや別検証器は作っていない。

```bash
node --test prototype/common-engine-v2-audiofree/runtime.test.cjs prototype/common-engine-v2-audiofree/approved-pico-parity.test.cjs
node prototype/common-engine-v2-audiofree/build-browser.cjs
python prototype/common-engine-v2-audiofree/unified-browser-smoke.py
```

Playwright1.56.0と対応Chromium、Node22以上が必要。PICO_EVIDENCEでmatrix/screenshot/trace出力先を指定可能。ScreenshotsはS005Q10 Support3の4幅、traceは390pxの代表1ケース（sources/snapshots付き）。matrix-128.jsonに全ケース測定。新規補助負例はlong-hint-negative-control.json、旧／修正後の独立再現はqa-pico01-*.log。

## 独立QAへの引継ぎ（依頼文・未送信）

PICO01〜04、同一viewからの行数／表示文／操作一覧、誤答・UNKNOWN・timeoutからSupport、遅延Judge resolve/reject、32問4幅、変更なしの承認文言、台詞Supportの独立、Battle/Save/Graphicを再検証してください。出典はIssue57と固定監査SHA509de4d。制作側PASSを独立QA認定の代わりにしないでください。Production統合はDirector承認まで禁止です。

物理iPhoneのSafari・実マイク・可読性／Safe Area、独立QAの最終認定はHOLD。正式Graphicの美術的再認定や全旧Saveデータ／Monster独立実戦の完全検収はこの限定改修から自動認定しません。
