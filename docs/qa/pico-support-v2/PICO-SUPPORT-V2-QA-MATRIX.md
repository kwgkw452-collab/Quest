# Pico Support V2 QA Matrix
HEAD 6e579f36ab3cc609428da1a27719fc65088fc384; base b1429931385b74f5eac7e15ba94cfee3b67c6bbc; 期待値バージョン QA56-20261128（Issue57 Director LOCK）。
| 項目 | 結果 | 根拠 |
|---|---|---|
| 問数 | PASS | 12+10+10=32 |
| Stage 0→1→2→3→3 | PASS | Node32/32、Chromium128/128 |
| Support1英単語 | PASS | 32/32 |
| PR7 Support1一致 | PASS | 31/32一致、Q10後続例外 |
| base Goal・model・Support2/3 | PASS | 各31/32一致、Q10後続例外（Issue57/PR56明記） |
| 108/140 reference px | PASS | 全幅でクラス一致、整数計測誤差あり |
| 認識feedback表示 | PASS | 128/128、Support後に誤答 |
| 誤答直後にSupport | FAIL | S005 Q1 全4幅でfeedbackがヒントを隠す |
| 長文ヒント | FAIL | S005 Q10のSupport3、320/390/844 |
| Engine layoutMode一致 | FAIL | 32/32、旧feedback初期stage twoRow |
| 次問reset | PASS（部分） | S005 Q4→Q5全4幅、個別初期化32×4。その他連続遷移HOLD |
| マイクハング時Support | PASS（mock） | 128/128、abort時onendなし |
| 再試行 | PASS（mock） | 128/128、誤答後modelEnを受理 |
| 正解→次のステップ | PASS（部分） | 128/128 accepted、成功画面なし、次のlineまたはchallenge。正式セリフ全一致はHOLD |
| 遅延Judge例外 | FAIL | Node非同期judgeの旧rejectで新試行READYに上書き |
| 実機音声・iPhone | HOLD | 実機なし |
| Save・旧Save | HOLD | 128個のV2 cursor起動は成功、旧Save/完走独立未実施 |
| Monster | HOLD | 3packにbattle定義なし、CI参考のみ |
| Graphic比較 | HOLD | 固定SHA画像未取得、ローカル補助画像のみ |
| CI | PASS | 3/3 success、46111486772 |
## 幅別実測
| viewport | ケース | 初期 ref px（offsetHeight丸め） | 3行 ref px | Support3の縦overflow |
|---|---:|---:|---:|---|
|320|32|107.06|137.65|S005 Q10|
|390|32|107.87|141.06|S005 Q10|
|844|32|108.70|139.22|S005 Q10|
|1280|32|108.23|140.57|Goalのscroll差は全32、フォント切断はHOLD|
全幅で32×4 Support観測、ボタン横overflowなし。CSS指定値108/140を確認。実機可読性HOLD。
