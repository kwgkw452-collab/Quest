# V1 実行記録

2026-11-23 JST。Node v24.22.3、Git、一時的な隔離repoで `node tools/swamp/test.cjs` を実行。20/20成功。内訳と標準出力はTEST-RESULTS.txt。サンプルMarkdownは同じ実行で生成した架空の仕様違反レポート。収録SHAはテスト用commitでありQuestの正式仕様・履歴ではない。

開始時にoriginのProductionとPR #11をfetchし、GitHub PRメタデータも確認した。Production 70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f、PR #11 1a962035e476d8fb7852f39febbf6bb816a0c123。QA候補55035f47ad2a64d131e2d8fef3a968f6c25d2a05の親が旧8fd7614853d4745237fe715bae4aa528f8516f97であることもローカルで確認した。候補の承認・PR #11完了宣言は行っていない。

今回検証した範囲：必須6ケース、外部固定基準の分離、未承認基準、同一object store拒否、dirty treeとの分離、FULL明示指定、仕様reviewルール、重複コードの根拠、CLI出力、symlink経由の候補内書き込み拒否、依存一覧、不正仕様拒否。

未実施：実Productionに対する広範囲診断、独立QA Lab検収、QA-11-02の正式承認／保護検査再実行、S006 Judge独立実行、ブラウザ、iPhone実機、音声。これらをPASS扱いしない。既存Engine Guardは変更しておらず今回再実行していない。

CLIにはfetch・候補コード実行・Git変更・自動修復の処理はない。Git履歴とblobを読み、指定された候補repo外の出力先だけへレポートを書く。完全なOSサンドボックスではないため、独立QA環境でも通常の読み取り専用権限を適用する。

## PR #12 origin未設定時のHOLD限定修正

開始時のfetchで、専用branch最新HEADがQA対象 `aa7bf19f6476f64186a3270bcdc3a2f8a8492152` と一致することを確認した。

原因：`git config --get remote.origin.url` は未設定時に非0終了する。従来の `git(...) || root` は例外を捕捉せず、レポート生成前に停止していた。修正はこの情報取得だけをtry/catchで囲み、取得不可／空ならローカルrepoの正規化pathを使用してREPOSITORY_UNKNOWNをunknownsに記録する。既存の証拠不足判定がINSUFFICIENT_EVIDENCEとし、両形式のレポート出力まで到達する。比較元・対象commitの解決など、他のGitエラーを無差別に握り潰す変更はしていない。

独立した一時repoと明示した比較元・対象SHAで、追加3件を実行した：(1) originなし・基準なし、(2) originなし・承認済み架空仕様あり、(3) originあり・承認済み架空仕様あり。originなしの両ケースはsignalなし、stderr空、終了コード2、INSUFFICIENT_EVIDENCE、Markdown・JSONの両ファイルを確認。(2) はRepository情報不足だけでCLEARを防ぐことも確認。(3) はURL保持・終了コード0・CLEAR・両ファイルを確認した。

既存20件と合わせて23/23ローカル成功。検査仕様の変更、全体監査、QA-11-02再作業、Production／PR #11変更はしていない。今回の再検収依頼はこのHOLD原因と回帰テストだけを対象とする。独立QAのHOLD解除は宣言しない。
