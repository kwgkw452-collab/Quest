# V1 実行記録

2026-11-23 JST。Node v24.22.3、Git、一時的な隔離repoで `node tools/swamp/test.cjs` を実行。20/20成功。内訳と標準出力はTEST-RESULTS.txt。サンプルMarkdownは同じ実行で生成した架空の仕様違反レポート。収録SHAはテスト用commitでありQuestの正式仕様・履歴ではない。

開始時にoriginのProductionとPR #11をfetchし、GitHub PRメタデータも確認した。Production 70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f、PR #11 1a962035e476d8fb7852f39febbf6bb816a0c123。QA候補55035f47ad2a64d131e2d8fef3a968f6c25d2a05の親が旧8fd7614853d4745237fe715bae4aa528f8516f97であることもローカルで確認した。候補の承認・PR #11完了宣言は行っていない。

今回検証した範囲：必須6ケース、外部固定基準の分離、未承認基準、同一object store拒否、dirty treeとの分離、FULL明示指定、仕様reviewルール、重複コードの根拠、CLI出力、symlink経由の候補内書き込み拒否、依存一覧、不正仕様拒否。

未実施：実Productionに対する広範囲診断、独立QA Lab検収、QA-11-02の正式承認／保護検査再実行、S006 Judge独立実行、ブラウザ、iPhone実機、音声。これらをPASS扱いしない。既存Engine Guardは変更しておらず今回再実行していない。

CLIにはfetch・候補コード実行・Git変更・自動修復の処理はない。Git履歴とblobを読み、指定された候補repo外の出力先だけへレポートを書く。完全なOSサンドボックスではないため、独立QA環境でも通常の読み取り専用権限を適用する。
