# S006 Communication V2 — 実機フィードバック正式LOCK変更 V1

状態: ユーザー承認に基づく実装候補。独立QA再検証待ち。QA-11-02保護検査はHOLD、Productionへmergeしない。

## 作業開始HEADと引き継ぎ

- Production: `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`
- リモートPR #11: `999c514390a8e0faac7ec846d6c27c0008ae4a99`
- 先行QA修正ローカルHEAD: `fbf407499a0b64f9401595b1197cfd935a5c5da7`（ローカルbranchに保持）
- 作業branch: `engine-guard-v1-feedback-lock-20261121`。PR #11の上記HEADを基礎に、先行QA成果を引き継いだ。旧PR #10やProductionのS006データで上書きしていない。

先行QA commitのpushは、新規workflow追加に対するGitHubトークンのworkflow scope不足で拒否された。未承認の信頼基盤を有効化する必要はないため、workflowは `docs/engine-guard/independent-qa-workflow.proposed.yml` に設計提案として保持し、実行可能な `.github/workflows/` は変更しない。以前のcommitは削除せず保存する。この扱いはProduction導入や独立QAの承認を代替しない。

## 承認原本と仕様差分

2026年11月21日のユーザー実装指示を `specs/approved/s006-communication-v2/20261121-feedback-lock.md` に原文のまま保存し、機械検査用の追加仕様JSONに原文SHA-256を記録した。以前の `Final-Review.md` は変更せず、今回の承認が置き換える項目だけを明示的に上書きする。これはS006内容の承認記録であり、独立QA保護基準を承認した意味ではない。

| 問 | Goal | 模範英文 |
| --- | --- | --- |
| Q1 | お手伝いしましょうか？ | Can I help you? |
| Q2 | あなたの箱は何色ですか？ | What color is it? |
| Q3 | ほかの箱はどこにありますか？ | Where are the other boxes? |
| Q4 | その箱を見せてもらえますか？ | Can I see the box? |
| Q5 | その箱を持っていますか？ | Do you have the box? |
| Q6 | このリボンを見てください。 | Look at this ribbon. |
| Q7 | 箱を見ましたか？ | Did you see the box? |
| Q8 | ちょっと待ってください！ | Wait, please! |
| Q9 | その箱を見つけてください。 | Please find the box. |
| Q10 | これがあなたの箱です。 | This is your box. |

- Q1: Let us / Could I / Could we の申し出と疑問符差を許容。Help me / Can you help me は引き続き拒否。
- Q2: What is the color? / What is its color? を追加。サイズ・別対象の質問を正解にしない。
- Q4: Show me/us の冠詞省略・that・pleaseを許容。Openは別行為として拒否。
- Q6: it/this/thatと `Look at the` のASR末尾欠落をQ6だけで許容。否定・別行為・明示的別対象を拒否。第3段階は正しいribbon入りの模範のまま。
- Q7: 日本語Goalのみ指定変更。book拒否期待値の変更は下記の新しい承認による。台車にあるかという別質問は拒否を維持。
- Q8: Wait a minute/moment/second、Hold on a minute等を追加。Go/Don't wait/Hurry upは拒否。
- Q9: 新Goal/模範/3ヒントを指定どおり更新。旧look for模範と既存ACCEPTを維持。
- Q10: 新Goal/模範/3ヒントを指定どおり更新。旧Here is/Here you are等はACCEPTを維持。Storyに手渡す動作を追加しない。

### book/books救済とテスト期待値変更

置換は `data/s006-communication.js` の閉じた正規化関数だけで行い、S006の問題別意図・対象パターンへ渡す。全体SpeechNormalizerやJudge Core、S005/S007を変更しない。文字列にbookがあるだけでは正解にせず、逆意図・別行為・another/other/different対象を引き続き区別する。

`Did you see the book?` / `Did you see the books?` の旧REJECT期待値を、今回の明示承認によりACCEPTへ移した。検査そのものは削除していない。`Did you read the book?`、旧台車質問、否定文、another bookを負例として追加した。Q3のanother bookの場所質問はACCEPT、Q9/Q10のanother bookはREJECT。

`tests/s006-feedback-lock.test.cjs` は追加ACCEPT全文、旧PR #11の全正しいACCEPT例、全10Goal/model、UNKNOWN、逆意図、対象違い、ASR救済の適用境界を実CommunicativeJudgeで検査する。既存18件は `tests/s006-qa11-targets.test.cjs` のまま維持した。

## cache識別と保護

`index.html` / `dev.html` はS006データのqueryだけを `s006-communication-v2-feedback-lock-v1` にした。その他のHTML、path、Engine/CSS/Audio/Speech参照は変更しない。

仕様台帳はS006 cache値と今回の原文・追加仕様のhash記録だけを更新。保護ファイル台帳とallowedChangedFilesは拡張しない。独立QA固定commitが未設定なので、candidate内の仕様更新だけで保護検査はPASSにならずHOLDを維持する。

S006 Story/Graphic全13枚/Ending、S005/S007、共通Judge/Speech/Audio/Save/Monster Battleの変更0件。Q1〜Q10 / rule10 / pool10の単一V2登録と既存Stage/3ボタン経路を維持。

## 検証

現役28検査: 27 PASS / 0 FAIL / 1 HOLD、全体exit 2。HOLDは未設定の独立QA基準による保護検査。

- S006実機フィードバック: 273判定チェック。
- QA-11-01: 144判定チェック、以前の18件を含む。
- 原本＋今回の承認によるFinal Review照合: 236チェック / 不一致0。
- QA-11-02: 14件の合成信頼設定/負例テスト。実QA基準は採用していない。
- 既存の3ボタン検査、サポート①→②→③→③、Retry段階保持、次問Stage 0、旧PR #7上書きとPR #9 UIの負例も実行する。

証跡は `evidence/s006-feedback-lock-results.json`。前の `evidence/qa11-local-results.json` は追加LOCK指示より前の先行QA検証記録であり、今回の新Goal等への期待値ではない。

ブラウザ描画・実機iPhone・実マイク/音声は未検証。今回のユーザー実機フィードバックを根拠に実装したが、実装後の端末動作確認とは区別する。独立QA Labの再検証とユーザーの統合承認を待つ。
