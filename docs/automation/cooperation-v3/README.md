# 無料AI協力開発 V3

実行するシステムです。既存PR41/42の成果を継承し、制作候補→公開CI→契約内修正AI→限定commit/push→新SHAのCI→独立QA待ちまで動作します。Production mergeは実装していません。**正式Story量産の完成認定ではありません。**

## 実証

- 実装PR43、架空検証PR44。どちらもDraft。
- PR44故障SHA `4b8af7628b2ec0d64af9f045e90315929f7b672f`。[CI失敗](https://github.com/kwgkw452-collab/Quest/actions/runs/45842932315)：99件中1件FAIL。
- JavaScript構文、Scene番号、存在しない参照、Communication欠落、Graphic参照を同時に検出。
- 外部固定Policyの2pathだけをChatGPT契約Codexが修正提案し、監督CLIがcommit/push。修正SHA `add7279a32aedb18ee4cd5a1e743b0e3a706bc78`。[新SHAのCI成功](https://github.com/kwgkw452-collab/Quest/actions/runs/45843227944)：99/99。
- JSONの期待値や検証テストの変更なし。修正diffはfictional/package.jsonとscene1.jsの2件のみ。モデルの「ハッシュ未確認」という自己申告とは別に、信頼側の検証器で期待SHA-256も照合してPASSした。
- evidence/live-cycle.json、live-retest.jsonにCI ID、各SHA、違反、修正試行、提案ハッシュ、再検査を保存。

## 実行環境

Python3.9以上、Git、Node、既存ChatGPT契約でログイン済みのCodex CLI。追加pip/npm、AI API、有料サービス不要。Macの古いsystem Pythonではなく、利用可能な新しいPythonを使う。GitHubでは既存workflowのstandard Ubuntu public runnerを継承。Workflowと権限は変更していない。

Codex CLIは`login status`でChatGPT認証を確認し、API認証ならHOLD。子processからAPIキー／API接続先を除外し、個人設定を読み込まず、隔離されたread-only taskのみでJSON提案を得る。候補repoのAGENTS/hooksを渡さず、候補コードも実行しない。追加クレジット購入、課金設定変更、無料枠超過時の有料APIへの切替は行わない。契約内上限／ログイン／ネットワーク問題はHOLD。

## 起動

専用のclean worktreeを用意する。既存ゲームを含む作業中checkoutには適用しない。
Policyと状態は候補repo外で管理する。Policyを候補自身が変更しても、そのSHA-256が固定起動値と違えば停止する。例のPolicyは証拠用架空snapshotであり、正式承認済み仕様ではない。新しい候補には、Directorが承認した範囲と独立管理の固定基準が必要。

```bash
python3 /trusted-tools/scripts/cooperation/run_from_ci.py \
  --repo /dedicated/Quest-fixture-worktree \
  --policy /trusted-state/policy.json \
  --policy-sha256 PINNED_POLICY_SHA256 \
  --state-dir /trusted-state/attempts \
  --node /path/to/node --publish --out /trusted-state/execution.json
```

`run_from_ci.py` は公開RESTで対象branch・SHA・workflow・pull_request eventの最新試行を1回だけ照合する。CI失敗なら範囲内で再現できる不具合を修正し、push後はCI_RETEST_PENDING。既存の許可済みタスクが次に同じコマンドを起動すると、新SHAのCI成功確認後にINDEPENDENT_QA_PENDINGになる。CIが古い／欠落／実行中／不明ならHOLD。公開RESTの制限・接続障害でもHOLD。勝手な高頻度poll／新規タスク／daemonは作らない。

`run_cycle.py` はローカル検査から始める版。`--publish`なしならpushしない。`repair_worker.py` は提案のみで、Git変更しない。出力先は候補repo外。状態を消して修正上限をリセットしない。

## 暴走防止

- repository+branchの排他lock、タスクごと外部状態。別タスクのHOLDで無関係なタスクを止めない。
- 修正は最大3回。同一失敗集合の再修正はHOLD。途中停止の未完了試行も勝手に再開しない。
- branch・headを前後照合、Git ref更新は旧SHA一致を要求。非forceの専用branch pushのみ。
- 候補コードや候補のシェル命令を実行せず、Nodeはsyntax check stdinのみ。
- 修正先は外部allowlistに存在する100644 regular blobのみ。symlink・submodule・path脱出・テスト期待値・基準・自己コード・凍結pathは拒否。
- `max_files_per_attempt: 1`を固定Policyに設定すれば、1回1ファイルの段階修正を強制可能。最大3回と同一失敗防止は維持。
- 専用clean worktreeと協調lockを必須とする。lockを無視する外部Git操作との完全排他は保証しない。rootの自由な手動Git操作にも対抗できるOSサンドボックスではない。

## 独立QAへの接続

既存の「Quest 独立PR検証」チャットでPR44の限定実証PASSが記録されたことをプラットフォームの読取りで確認済み。制作側が最終QAを代行したものではない。別チャットへの追加送信は自動承認レビューで拒否されたため再送していない。既存イベント型QAが結果を記録しており、重複タスクは作っていない。

機械による自動Director待ち遷移には、実QA発行者の署名を検証する`qa_gate.py`を追加した。SSH公開鍵を候補repo外のallowed_signersに固定SHA-256で配置する。**修正AIには秘密鍵を渡さない**。署名本文はschema/base_sha/head_sha/reviewer/verdict。namespaceは`quest-independent-qa-v1`。QA側がcanonical JSONへ署名し、署名とpayloadだけを渡す。公開鍵固定・実QA発行者の設定は未完了のため、現在は署名連携HOLD。

```bash
python3 /trusted-tools/scripts/cooperation/qa_gate.py \
  --machine /trusted-state/machine.json --qa /qa-inbox/verdict.json \
  --signers /qa-managed/allowed_signers --signers-sha256 PINNED_PUBLIC_KEY_FILE_SHA256 \
  --repo /dedicated/Quest-fixture-worktree --producer PRODUCER_ID --repair-actor REPAIR_ID \
  --out /trusted-state/qa-gate.json
```

`run_from_ci.py`にも`--qa`/`--qa-signers`/`--qa-signers-sha256`/`--producer`/`--repair-actor`を渡して接続できる。偽造／自己承認／古いSHAはHOLD。正しい署名のQA FAILはQA_REPAIR_REQUIRED、QA PASSはDIRECTOR_REVIEW_PENDING、merge_authorizedは常にfalse。署名は発行者を証明するだけで、検収内容の十分さを保証しない。テスト用の架空鍵を実QA鍵として採用してはいけない。controller.pyのHMAC APIは隔離された互換テスト用であり、本運用のQA署名にはSSH公開鍵版を使う。

QA FAILが固定基準の検査で再現できる場合は、同じ修正CLIが実装を修正する。再現できず新仕様や未知の実行が必要ならHOLDし、基準を勝手に変えない。署名受付から任意の自然言語指示を自動実行する機能はない。

## Story Package接続の範囲

現在の実行器はtests/cooperation/fictional/限定。JSON、Scene順、Communicationの固定goal/accept、JS構文、ファイル／Graphic参照・形式・任意の固定ハッシュを検査し、限定修正できる。Graphicの美術的品質や実ゲーム進行、ブラウザや実機での見た目は保証しない。正式Story用の仕様承認と実行アダプタがないため、S001〜S007等を修正対象へ広げない。音響関連は調査も実装変更も行っていない。

## 費用根拠

QuestはGitHub metadataでpublic確認。standard public runnerの無料条件は[GitHub公式](https://docs.github.com/en/actions/concepts/billing-and-usage)。契約内認証は[OpenAI公式認証案内](https://learn.chatgpt.com/docs/auth?surface=cli)。新規API課金、契約購入、larger/private runner、artifact storage uploadを追加していない。既存契約の使用枠は消費する。請求書を監査したという意味ではない。

## 二段階の実AI修正（追加実証）

[PR45](https://github.com/kwgkw452-collab/Quest/pull/45)の架空JSON閉じ括弧欠落とJS構文エラーを実際のChatGPT契約AIで修正した。固定Policyは1回1ファイル、最大3回。故障SHA347a711e97338960f588291c220a61a32aec28c9 → JSON修正88a0969af6228ed7fe3c80d162ebd52b9c0938de → JS修正6516e9af9f4ffe393ede699c14be0e13ea3296b9。ローカル判定はFAIL→FAIL→PASS。各commitは許可した1ファイルのみ。

[修正前CI失敗](https://github.com/kwgkw452-collab/Quest/actions/runs/45844666530)→[修正後CI132/132成功](https://github.com/kwgkw452-collab/Quest/actions/runs/45845095767)。既存独立QAチャットでも限定実証PASSを確認した。証拠はevidence/staged-*.json。

`--wait-for-ci`を指定すれば、同一process内でpush後のCIも最大10回・60秒間隔で待ってQA待ちまで継続する。新しい自動タスクや常駐サービスは作らない。待機上限、未知障害、無料APIの利用制限はHOLDとして終了し、別タスクを妨げない。

その後の追加安全レビューで、検証中のHEAD/branch変更およびremoteだけが更新された場合をHOLDにした。QAゲートは現在のローカルHEADとGitHub公開branch先端も照合する。制作側ファイルの古いPASSだけでDirector待ちへ進めない。
