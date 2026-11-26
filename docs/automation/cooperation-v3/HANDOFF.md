# 無料AI協力開発 V3 — 再開記録

2026-11-26 JST。Production `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`。
引継ぎ元 PR41 `1fe7c8d750760673d37dbec38460c49edc6134fb`、PR42 `133d4974fcdccdba1d5a87a438ac1d2f74d976cd`。両方Draft・未mergeを開始時に確認。
専用branch `automation/free-ai-cooperation-v3`。ProductionとPR41/42は更新しない。

## 実装済み（独立QA最終認定ではない）
- 既存Guardとworkflowを継承。新規テストを既存unittest discoverから起動する接続を追加。Workflowファイルは変更していない。
- 架空Story Package限定のcommit読取り検査、外部固定仕様、Node syntax check。候補コード実行なし。
- repository+branchの排他、タスク毎状態、最大3回修正、同一失敗反復HOLD、SHA/branch/path固定、費用モード制限。
- 実際のChatGPT契約ログインCodex CLIを隔離read-onlyで起動し、JS構文修正のJSON提案を取得済み。
- 許可pathの提案だけをGit tree/commitにし、再検査する実行CLI。APIキーを子process環境から除去。
- QA署名・正確なSHA照合の単体テスト。実QA署名鍵未設定、正式QAは未認定。

## 途中で確認した制約
- system Pythonは既存Guardに必要なremoveprefixがない。ローカルはbundled Pythonを使用。GitHub runnerは既存のpython3。
- 制限sandbox内のCodex CLI起動はapp-server/state DB初期化権限で失敗。承認済みの外側processで再試行し、ChatGPTログインのread-only提案に成功。
- `.codex/automations/` はこのMacに存在しない。既存ChatGPTタスクを新規重複作成していない。タスク名やJSON担当表示だけを「自律AI連携完成」とは扱わない。
- 追加購入・有料API・private/larger runner・新規サービス契約・課金設定変更は一切行わない。

## 次に実行すること
1. 実行CLIの隔離Git統合テストと独立コードレビューの指摘を修正。
2. 実際の複数ファイル不具合branchでChatGPT修正提案→限定commit→push→CI再検査を実証。
3. 正確なSHAとCI証拠を既存独立QAへ引き渡す。QA結果は自己認定しない。
4. 最終証拠と残るHOLDを追記し、Draft PRを維持。

## 固定事項
S001〜S004一切変更なし。音響関連は調査も変更もしない。承認済みStory/Graphic/Communicationの再制作なし。全ての架空Packageはtests/cooperation/fictional/だけ。Productionへmergeするコード／権限付与／自動承認なし。Directorだけが最終統合判断を行う。

## 実証到達点

PR43を作成済み。PR44は故障SHA4b8af7628b2ec0d64af9f045e90315929f7b672fから、実ChatGPT提案でadd7279a32aedb18ee4cd5a1e743b0e3a706bc78へ2ファイルだけ修正・push済み。CI45842932315失敗→45843227944成功（99/99）。追加の人による修正操作なし。外部固定Policy SHA256=1799212fa8ebb102de74e3bb9ac101c051369d104e7a7f24e2eafa104399f2fb。実行・再検査JSONをevidence/へ保存。署名用秘密鍵は作成・登録していない（テスト鍵は隔離一時データ）。

独立QAの既存イベント型チャット「Quest 独立PR検証」には、PR44の2ファイル限定実証PASS（対象外23ファイル一致、JS3/3、CI99/99）が記録されていることをread_threadで確認。システム全体の最終QAや正式Story量産PASSとは別。新たなQA依頼の別チャット送信は自動承認レビューで拒否（具体的送信への明示承認不足）されたため、再送・迂回はしていない。

拡張後ローカル132件成功。署名未登録なので機械QAゲートは独立QA待ちを維持。次の実行：max_files_per_attempt=1の別架空branchで実AIの2段階修正を検証し、結果を追記する。state/Policyの再開用コピーはworkspace output/free-ai-cooperation-v3/trusted-state/に保存。ここは候補repo外でありGitHubへ秘密情報をpushしない。

## 2026-11-27 JST 実作業の追加到達点

PR45の実ChatGPT修正は2回で完了。固定1回1ファイル、最大3回のPolicyを守り、347a711e97338960f588291c220a61a32aec28c9 → 88a0969af6228ed7fe3c80d162ebd52b9c0938de → 6516e9af9f4ffe393ede699c14be0e13ea3296b9。判定FAIL→FAIL→PASS、CI45845095767で132/132。独立QA既存チャットも限定実証PASSを記録。最終正式Story量産PASSではない。

追加レビューで、古いローカルmachine+QAの一致、検証途中のHEAD切替、remoteだけの先行更新を検出するHOLDを追加。public SSH署名は現在HEADと公開GitHubbranch先端を照合する。実QA鍵未設定の実呼出しはQA_TRUST_NOT_ESTABLISHEDとしてHOLDした（evidence/qa-trust-hold.json）。署名がないチャット結果を制作側で署名して代用していない。

`--wait-for-ci`は同一process内の最大10回・60秒間隔の継続。追加のスケジュールタスクを作る機能ではなく、今回の実行終了後も無期限に動作すると主張しない。

### 残るHOLDと解消条件
- 実QA署名発行：独立QA管理者が秘密鍵を自分の環境で保管し、承認済み公開鍵とその固定ハッシュを外部配置する。制作側で実QAの鍵／承認を無断設定しない。
- 正式Story量産：Director承認済みの新規Story Packageと独立期待値、実ゲーム検収アダプタが必要。今回は架空Packageだけ。既存Storyの再制作で埋めない。
- 常時無人運転：この環境の既存イベントQAは動作したが、全branch用修正タスクの設定ID・管理口は未取得。Macにlocal automations directoryなし。既存タスクを重複作成せず、1回のCLI起動内の自動修正と限定待機を完成させた。
- サーバ側のProduction強制保護：本CLIはmergeを持たず専用branchだけpushするが、全利用者に対するGitHubルールの有効性を認定していない。課金や権限設定の変更はしていない。
- QA FAILの任意の自然言語指示の自動実行はしない。固定基準で再現できる不具合だけ修正可能。それ以外は仕様・証拠不足HOLD。

### 再開

最新コードは専用PR43、実証専用PR44/45。いずれもDraftを維持する。workspaceのoutput/free-ai-cooperation-v3/には再開用外部Policy/stateのコピー、repo docs/automation/cooperation-v3/evidence/には公開可能な証拠snapshotを保存した。秘密鍵や認証tokenは含まない。SHAと最新CIはPRヘッダおよびevidenceのexact SHAを照合し、古いPASSを新commitへ流用しない。

最終ローカル検査：既存28件を含む144件すべて成功（58.265秒）。Productionとの差分は引継ぎ元の検査workflow・ツール・資料と新しい架空fixtureに限定し、実Story/Graphic/Communication/Engine本体は変更していない。最終commitのGitHub CIはそのSHAで確認すること。
