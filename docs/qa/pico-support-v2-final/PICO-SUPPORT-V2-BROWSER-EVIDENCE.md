# 独立Chromium evidence
HEAD 41177d197df76c458e72c01b800f9d4556e37802; 期待値 QA56-20261128 fixed audit 509de4df... / Issue57。GitHub固定SHAのソースを取得（末尾改行追加のローカル写し）。128件、各4段ヒント、mock SpeechRecognition。固定監査JSONのヒント文字列と直接比較。幅ごとに32件。 
| 幅 | 初期 ref px | 3行 ref px | hint一致 | accepted | stale無変化 | support縦overflow(128観測) |
|---|---:|---:|---:|---:|---:|---:|
|320|107.935|139.957|32/32|32/32|32/32|0|
|390|107.937|139.962|32/32|32/32|32/32|0|
|844|107.989|139.992|32/32|32/32|32/32|0|
|1280|107.996|139.991|32/32|32/32|32/32|2|
測定はdialogue.getBoundingClientRect().height / (game.clientWidth/1560)。色 Goal rgb(245,248,255)、Support rgb(255,223,145)。全件操作ボタン同じtop。1280 Goal 縦overflow初期32/32、feedback32/32、support128/128。 
## 再現 PICO-03
固定HEAD unified.css L28–40（grid auto/minmax と font/line-height、overflow-y:auto）。1280x720 viewport、S005 scene05 index20 (Q10) 起動→Support 3回。Node/Chromium独立測定: support clientHeight37, scrollHeight39, rect top648.390625 bottom685.515625、2行目テキストrect bottom686.953125。Goal client22 scroll24。期待: 全文収容・縦overflowなし（140 reference px維持）。実際: 内部scroll差2、テキスト範囲は容器を越える。文字列自体は完全一致。実際の字形切断は未保証。修正はフォントメトリクスと行高/余白配分、ヒントデータ・140pxの仕様変更は禁止。過度な縮小も不可。
テスト再現用ファイルは evidence/ に記録。
