# PR #11 — QA-11-01 / QA-11-02 限定修正

本書は実機フィードバック追加LOCK指示より前のQA限定修正の記録。後続のGoal/模範/認識救済変更は [S006追加LOCK記録](S006-Feedback-Lock-20261121.md) を参照。

状態: 独立QA Lab再検証待ち。QA-11-02の正式基準は未確定であり、最終PASSではない。

## 作業開始時に取得したHEAD

- Repository: `kwgkw452-collab/Quest`
- Production `s005-fixed-195-stage-clean-test`: `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`
- PR #11 `engine-guard-v1-20261121`: `999c514390a8e0faac7ec846d6c27c0008ae4a99`
- 修正先はPR #11専用branch。Productionへのmerge・書き込みは禁止。
- 既存ローカルProduction checkoutの未commit変更は触らず、PR最新HEADから専用checkoutを作成した。

## QA-11-01: 問題別の行為と対象

以前は全問で共有するboxパターンに `another` / `other` が入り、Q9/Q10でも別の箱を同じ対象としてACCEPTしていた。

S006データ定義だけで対象スロットを分離した。Q3は「ほかの箱の場所」を尋ねるため別の箱を許容する。Q2/Q4/Q5/Q7/Q9/Q10は特定の箱を指す。各問の行為に一致してもanother/other/different boxを明示する場合はREJECT。単にanother boxに言及する未判定の文章はUNKNOWN。Q1の申し出、Q6のリボン、Q8の停止依頼の意味は維持した。

共通Judge Core、Goal/model/ヒント/公開ID/pool/Story/配置は変更していない。

`tests/s006-qa11-targets.test.cjs`:

- QAの2再現発話はREJECT。正解のASR代替候補があっても別対象の主発話を救済しない。
- Q1〜Q10についてACCEPT/REJECT/UNKNOWNを実CommunicativeJudgeで検証。
- Q3の正当なanother/otherの場所質問を維持。
- 既存18件の期待値を変更せず再実行。

## QA-11-02: 信頼境界の設計案

PM回答: 独立QA管理の固定commitとrepository/pathは未確定。PR内の既存台帳を承認済みと扱わない。Production SHAは暫定比較に限る。正式基準がない場合はHOLD/FAIL。

このため `check-diff.cjs` は候補内の台帳から基準や許可を読み出して合格させない。未設定では `HOLD` / exit 2。`run.cjs` もHOLDをPASSに合算せず、全体exit 2とJUnit skippedに記録する。異常はFAIL / exit 1。

### 正式運用時の信頼経路（まだ導入・承認していない）

1. PRから書き換えられない管理元（独立QA repository + protected environmentの固定設定）が、承認済み40桁QA commitを選ぶ。branch名やcandidate指定のSHAは信頼基準に使わない。
2. そのcommitから**検証器とpolicyの両方**を取得する。期待ハッシュ、Production比較元、許可リスト、候補台帳の期待SHA-256、Final Reviewハッシュはpolicyから取得する。
3. 独立側の検証器がcandidateのGit差分とファイル実バイトを読み取る。candidateのJS/test/package/workflowを実行しない。
4. candidate台帳の内容を書き換えても、独立policyの期待ハッシュ/許可リストには反映されない。保護ファイルのhash照合と台帳自体のhash照合が失敗する。

候補側の `npm test` と自己申告の緑色チェックだけでは敵対的PRの変更を防げない。外部の検証起動元そのものを候補に編集させないことが必須。

### 必要なファイルと外部設定

| 管理場所 | ファイル/設定 | 用途 |
| --- | --- | --- |
| このPR | `tools/qc/check-diff.cjs` | ローカルbootstrap。未設定HOLD。外部固定commitの検証器を実行 |
| このPR（独立QAへの導入提案） | `tools/qc/verify-protected-policy.cjs` | standalone検証器。正式実行は独立QA commitに採用されたコピーだけ |
| このPR（導入提案） | `docs/engine-guard/independent-qa-workflow.proposed.yml` | protected base側で動く読取専用監督workflow。candidateコードは実行しない |
| 独立QA repositoryの承認済みcommit | `tools/qc/verify-protected-policy.cjs` | 信頼する検証器の固定実体 |
| 同じ独立QA commit | `specs/qa/engine-guard-policy.json` | baseline commit・保護blob・固定許可リスト・台帳期待ハッシュ・Final Review等 |
| GitHubの保護environment | `ENGINE_GUARD_QA_REPOSITORY` / `ENGINE_GUARD_QA_COMMIT` | candidate自身が変更できない信頼元。現在未設定 |
| ローカル独立QA環境 | candidate外のconfig JSON | `repository`（独立cloneの絶対path）, `commit`, `qaReviewed`, `userApproved` |

独立repositoryの正式名称/管理者、policyの正式保存先、承認SHAは**未確定**。上の2ファイルpathは提案する実行契約であり、正式採用を意味しない。実policyや承認済みconfigはこのPRに追加していない。

ローカル起動例（QAとユーザーの承認・設定後だけ）:

```sh
ENGINE_GUARD_QA_CONFIG=/independent-qa/approved-engine-guard.json node tools/qc/check-diff.cjs /candidate/repo
```

configはcandidate内を拒否し、QA cloneはcandidateと同じGit object storeを共有しない。QA cloneの未commit変更も使わず、固定commitの `git show` だけを使う。外部configの編集権限は独立QA管理側で保護する。candidateコードから環境変数/configを自由に上書きできる起動方法を正式運用に使わない。

### policy schema案（実基準は未作成）

`schemaVersion: 1`、`approval: {qaReview, userApproval}`、`baseline: {commit, files: [{path, git_blob}]}`、`scope: {allowedChangedFiles, s006ScriptVersion, finalReview: {path, sha256}}`、`candidatePolicyFiles: [{path, sha256}]`。

candidatePolicyFilesには少なくとも `specs/locked-content-baseline.json` と `specs/current/engine-guard-v1.json` を含める。両ファイルの変更は、許可リストに載っていても期待hashと違えば失敗。baseline保護blobは指定Production commitと一致することも検証する。配列を空にする・commit差し替え・許可リスト拡張で自己承認できない。

policy中のapproval文字列だけで承認を証明するのではない。**そのpolicyを含むcommitを独立QAが確認し、ユーザーが承認して外部の保護設定へ固定する手続き**が信頼根である。

### CI導入の境界とHOLD

新workflowはdocs下の提案ファイルであり、実行workflow/Productionには追加していない。`pull_request_target` は承認済みbase側workflowを使い、QA固定snapshotの検証器だけを実行する。candidateをcheckoutしても、そのnpm/scripts/actionsを実行しない。tokenはcontents:read、checkout credentialを保持しない。

Production/baseにこのworkflowが存在しない現在、このPR内に追加しただけでは独立した必須チェックにはならない。独立QA確認とユーザー承認後、別の管理変更で信頼するbase/default側または独立QA CIへ導入し、environmentレビュー権限・変数編集権限・required-check/rulesetを設定する必要がある。このPRでGitHubの保護設定は変更しない。

### 正式LOCK変更/基準更新の承認手順

1. 実装PRとは別に、対象path、旧/新hash、理由、必要な許可範囲、影響とテストを独立QAへ提出する。
2. 独立QAがbaseline/policy/検証器をレビューし、再検証結果と承認候補の固定SHAを提示する。
3. ユーザーがそのSHAと対象範囲を明示承認する。独立QA確認とユーザー承認のどちらかが無い場合、更新しない。
4. 管理者が独立QA管理元とprotected environmentの固定SHAを別手続きで更新する。PR自身の台帳変更や最新版branch追従で自動昇格しない。
5. 候補をその固定SHAで再実行し、独立QA再検証が終わってから統合を別途判断する。

### 負例

`tests/engine-guard-qa-trust.test.cjs` は一時的なcandidate/QA別repositoryを作る合成テスト。正式なQA基準ではない。

- 保護ファイル+期待blob台帳+許可リストの同時改変（未commit/commit後）。
- 許可リストを拡張して追加ファイルを通す試み、台帳だけの変更。
- candidateに偽PASS検証器を置く試み（実行されない）。
- QA cloneの未commit policy/検証器改変（固定commitが使われる）。
- candidate内config、未承認config、可変ref、candidate自身をQA管理元に指定する設定。
- 信頼基準未設定のまま台帳を書き換えてもHOLDのまま。

## 検証と残事項

Nodeの実行結果は `artifacts/engine-guard/`。ローカル技術テストの成功と独立QA最終PASSを区別する。正式policy未設定の保護検査はHOLDのままにする。

ブラウザ、PC描画、iPhone、実マイク/音声の検証は未実施。全体監査、Engine再設計、Story再制作は行わない。独立QA Labの再検証とユーザー承認前にProductionへmergeしない。
