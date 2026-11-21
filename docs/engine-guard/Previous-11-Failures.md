# 既存11 FAILの整理と対応

前回43実行における11 FAIL。5Branchでの同じテスト失敗を含むため、11種類の新規不具合ではない。旧テストをPASSへ書き換えたとは報告しない。旧版はhistoricalに保存し、正式な現行契約へ交換した。

| No. | 対象 | 旧FAIL | 原因 | 対応 |
| --- | --- | --- | --- | --- |
| 1 | production | formal-communicative-isolation-v1.test.js | 過去HEADのdev.htmlと共通ファイル全体ハッシュを固定。以後の正式変更を誤検出 | 旧版を保管。394件のProduction保護基準と読込順・実行契約へ交換 |
| 2 | production | s005-clean-rebuild-v1.test.js | cb391376の旧CSS/共通Engineハッシュと単一wrapperを要求 | S005 StoryのProduction全文一致、登録順、3ボタン、共通保護へ交換 |
| 3 | production | s006-communication-final-v1.test.js | 旧Q7台車質問を正解に要求 | 旧テストをhistoricalへ移動し、V2原本・判定テストへ交換 |
| 4 | production | s006-q7-final-correction-v1.test.js | 旧Q7の日本語Goalを要求 | 旧テストをhistoricalへ移動し、Did you see the box?と旧台車非ACCEPTへ交換 |
| 5 | production | s007-delta.test.js | setFlag未モック、11Scene/旧発話/外部asset-manifest前提 | setFlagモック、13Scene、現行modelの非矛盾、保護基準へ交換。旧代替文は未承認として現役へ再追加しない |
| 6 | pr6 | formal-communicative-isolation-v1.test.js | 過去HEADのdev.htmlと共通ファイル全体ハッシュを固定。以後の正式変更を誤検出 | 旧版を保管。394件のProduction保護基準と読込順・実行契約へ交換 |
| 7 | pr6 | s005-support-controller-production.test.js | Retry直後に旧ヒントを要求し、新しい認識結果優先と矛盾 | 最新結果→保持段階の再表示→次段階を実Controller/Presenterで検査 |
| 8 | pr7 | formal-communicative-isolation-v1.test.js | 過去HEADのdev.htmlと共通ファイル全体ハッシュを固定。以後の正式変更を誤検出 | 旧版を保管。394件のProduction保護基準と読込順・実行契約へ交換 |
| 9 | pr9 | formal-communicative-isolation-v1.test.js | 過去HEADのdev.htmlと共通ファイル全体ハッシュを固定。以後の正式変更を誤検出 | 旧版を保管。394件のProduction保護基準と読込順・実行契約へ交換 |
| 10 | pr9 | s005-support-controller-production.test.js | Retry直後に旧ヒントを要求し、新しい認識結果優先と矛盾 | 最新結果→保持段階の再表示→次段階を実Controller/Presenterで検査 |
| 11 | pr10 | formal-communicative-isolation-v1.test.js | 過去HEADのdev.htmlと共通ファイル全体ハッシュを固定。以後の正式変更を誤検出 | 旧版を保管。394件のProduction保護基準と読込順・実行契約へ交換 |

S007は元の11Sceneテストを修正しただけでは、古いQ2発話も現行モデルと不一致になる。S007のStory・判定を旧テストへ戻さず、現行モデルと13Sceneの登録検査に交換した。S007の自然な別表現・逆意図全件の正式仕様整理は今回の範囲外で、検証済みとはしない。

PR #7のソース正規表現依存テストは、V2生成形式を扱えないため実行時のQuestion登録を読む方式に交換。S005/S007の英語第1段階ヒント採用は範囲外とし、S006 V2だけを検証する。S005の第3段階とmodelが同一でない既存項目は、この作業で意味変更しない。第3段階=modelの厳密照合は正式V2原本があるS006へ適用する。
