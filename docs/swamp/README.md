# 沼脱出検証システム V1 — 手動CLI

候補実装。独立QA未検収。通常のcommit/push/PRでは起動しない。
Node.js 22以上、Gitが必要。依存パッケージ、package.jsonフック、常駐処理、Actions登録はない。

## 起動

先に担当者が読み取り用cloneで正式HEADを取得する。診断CLIはfetchも書き込みもしない。

```bash
git fetch origin s005-fixed-195-stage-clean-test
git rev-parse origin/s005-fixed-195-stage-clean-test
node /trusted-review-checkout/tools/swamp/diagnose.cjs \
  --repo /path/to/Quest \
  --production origin/s005-fixed-195-stage-clean-test \
  --target FULL_40_CHARACTER_TARGET_SHA \
  --mode FOCUSED --files engine/stories/S006.js \
  --out /tmp/swamp-s006
```

例は起動方法であり、S006の今回の監査・改修を指示するものではない。指定ファイルは対象commitに存在する正確なパスに合わせる。複数ファイルはカンマ区切り。`--structure`で構造ヒューリスティックと静的import一覧を追加する。履歴は既定40変更、`--history-limit 80`などで2〜200まで指定できる。打ち切り時は証拠不足を明記する。

FULLは担当者への明示指示があるときだけ、`--mode FULL --confirm-full`を両方指定する。対象commitのJS/JSON/HTML/CSS/Markdown全体が対象になる。画像そのものは解析せず、参照を含むテキストを調べる。今回は実Productionに対するFULL実行は行っていない。

出力先は候補repoの外。MarkdownとJSONを出力する。終了コード0=CLEAR、1=INVESTIGATEまたはREWORK_RECOMMENDED、2=INSUFFICIENT_EVIDENCEまたは起動失敗。エラーはstderr、成功起動時は必ずレポートに残す。CLEARは設定済みの検査範囲のみ。正式QA PASSではない。

## 承認済み仕様の指定

`--trust /absolute/qa-controlled/trust.json`を指定する。設定例はこのディレクトリの `examples/trust.example.json`、仕様形式は `examples/spec.example.json`。**例は架空の仕様であり、製品仕様として使用禁止**。

設定・仕様・検証器をレビュー済みの独立した配置元から提供する。候補repo外の設定で、別Git object storeのQA repo、固定40桁SHA、仕様pathを指定する。仕様は固定SHAのGit blobから読む。候補自身のJSON、作業ツリーの仕様、同じobject storeのworktreeは信頼元にしない。QAとユーザーの承認が両方ない場合はTRUST_NOT_ESTABLISHED。基準未指定はBASELINE_UNKNOWN。未対応ファイル、読めないblob、履歴打ち切りも証拠不足。部分的に違反が見つかった場合でも総合判定は証拠不足を優先し、違反は個別に残す。

`qaReviewed`と`userApproved`の真偽値は承認証明・署名ではない。独立管理者が設定を管理し、実承認と固定SHAを照合する運用が必要。候補制作者が設定やCLI自体を管理できる環境に対する耐改ざん保証はない。CLIを候補commitから実行せず、QAが承認した配布版とSHA-256を使うこと。レポートには検証器SHA-256を記録する。機密値・認証情報は設定に入れない。

仕様ルールはファイルごとの `required`（全literal必要）、`forbidden`（いずれのliteralも禁止）、`coexistence`（指定literal全ての同時存在禁止）、`review`（人の確認必須）。セリフ・画像path・accept条件・廃止コード等の**承認済みの正確な文字列**だけを指定する。期待値を推測して追加しない。ルールIDは一意。旧ファイルの単なる存在は違反にしない。内容literalがコメントや未実行部分にあっても一致するため、意味の保証には構造化された承認済みルールまたは独立確認が必要。literal検査で意味同値や実行動作は保証しない。

## 履歴・構造解析の限界

履歴はファイル限定、対象SHA以前の最大指定変更数。blob状態の再出現、20行区間の反復編集、patch変更行数の増加を示す。位置は当時のdiffを20行区間に近似したもの。rename追従、merge全親の取消解析は網羅しない。多数変更だけで不具合とはしない。

構造解析は重複5行、複数ファイルの同一property代入、静的import一覧と高import数の疑いに限定。コメント・文字列による誤検出があり得る。実行時競合、dead code、動的依存は断定しない。新旧実装の同居は承認ルールがあれば検査し、それ以外は追加確認する。不要コードの確定や全Engine安全性の保証は対象外。

## Engine Guardとの役割分担と開始時状態

2026-11-23にGitHub fetchで確認：
- Production `70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`
- PR #11 `1a962035e476d8fb7852f39febbf6bb816a0c123`、open/draft、未merge。
- QA固定候補 `55035f47ad2a64d131e2d8fef3a968f6c25d2a05`（旧 `8fd7614853d4745237fe715bae4aa528f8516f97`）は未承認。

PR #11の `tools/qc/check-diff.cjs` の独立設定・固定commitの考え方を再利用した。既存コードは変更・移植せず、小規模な診断モジュールを追加した。Engine Guardは固定Policyの397保護対象・70許可path・期待ハッシュ／モード等の保護検査。本CLIは手動の仕様混入／履歴／静的兆候の診断。固定保護検査やS006 Judge実行テストは重複実装せず、起動もしない。QA-11-02依存の正式な保証はTRUST_NOT_ESTABLISHEDを維持する。独立仕様の診断がCLEARでもQA-11-02を解除しない。

## テスト

```bash
node tools/swamp/test.cjs
```

全て一時ディレクトリの架空Git履歴。実StoryやProductionを改変しない。サンプルは `examples/SWAMP-DIAGNOSIS-REPORT.md`。実Production診断結果ではない。
