# PR #6 残存2件の再検収

2026-11-19 JST。対象は `communication-recovery-visible-v1` のみ。

## 対象SHAと今回の差分

- ユーザー検収済み：`e4c07673895c3644a912bb26fe4f9bcf0c63baf4`。
- 作業開始時最新HEAD：`8198a18c7d7fb30ff46178939b38648bc0691b0f`。検収済みSHAから1コミット進んでおり、2行Goal用のクラス／ResizeObserver／35px操作行／スクロールリセットと、ホテル背景の `center -40px` が既に追加されていた。
- 旧SHAでFAILを再現し、最新版で同じ検証がPASSすることを確認した。重複するProduction修正は追加せず、ブラウザ回帰テスト・旧CSSセレクタ検査1行の更新・本記録を追加する。
- Story、Goal、模範英文、ACCEPT、Graphic画像、S006 Graphic/Ending、Audio/Speech/Judge、PR #7文章は変更していない。Productionブランチへpush／mergeしない。

## 検証環境と再現

Playwrightのchromium API、Google Chrome 157.0.8103.79、headless、1560×720、deviceScaleFactor=1。認識APIイベントだけ模擬し、実際のPRソースのDOM・CSS・Story question・QuestionManager・Judge・Presenter・Flowを使用。自動main.js開始を外したindexコピーをローカル配信する。UNKNOWNは判定結果を注入。実マイク、iPhone/Safari、全端末幅は未検証。

2行Goalは合成fixtureで自然折り返しを発生させる。ProductionのGoalは編集しない。ホテルとS006指定6場面の画像はGit blob SHA一致を確認した原本を使用し、再生成・加工しない。

| 項目 | 検収済み旧SHA | 作業開始時最新HEAD |
|---|---:|---:|
| 2行Goalの高さ | 62.375px | 54px（文字26px、行間27px） |
| 通常枠 | 100.1875px、ボタン下端が欠ける | 100.1875px、Goalとボタン全体を表示 |
| REJECT枠 | 140px、外枠scrollTop=22、Goal上部が欠ける | 140px、scrollTop=0 |
| REJECT情報欄 | 28px、文字行を下回る | 39px |
| サポート情報欄 | 5.625px | 31.1875px |
| ホテル受付140px | ピコの足元がパネルに隠れる | 頭・足元とも可視 |
| ホテル通常100.2px | 既存位置 | 同じ位置を維持 |

ホテルの原画像内でピコを包含する保守的矩形（y=419〜713、原寸1846×852）を、実測backgroundサイズ／位置で投影した。足元とパネルの余裕は通常約17.28px、140px時約17.46px。矩形計算だけでなく、原画像と描画スクリーンショットで頭・足元を目視確認した。高さの例外追加は不要。

## 維持項目

S005/S006/S007の各Q1に同じ `Yes, we do.` を認識結果として入力し、実ルールでREJECTを確認。

- REJECTの0・1・3・5秒後に認識文・Goal・3操作が見え、選択前にStoryが進まない。
- 結果情報欄は0pxにならない。2行Goalでも同じ時間点を検証。
- UNKNOWNは認識結果と案内、結果なしのno-speechは失敗案内を可視表示。
- サポート後の再REJECTは最新の認識結果を優先。
- 通常100.2px、REJECT／サポート140px。2行Goalでも同じ外枠高。
- 次の開始で古い結果をreset。ACCEPTはRecoveryを追加せず、実際の後続Story台詞へ進む。
- 2行Goalの切替直後と、実際に情報欄をスクロールさせた後の切替で、外枠・情報欄のscrollTopが0へ戻る。
- S006 Scene04/07/08/10/11/12は通常・REJECT・サポートの18描画を記録。背景のheight、positionを検査し、拡張時6画像を目視確認。既存の-12px／-32pxと背景高を維持。S006 CSS・画像に新規変更なし。

## テスト

追加：`tests/communication-multiline-browser.test.cjs`。DOM内の文字列だけでなく、Goal上下端、ボタン上下端、情報欄の行高、スクロール残留、ホテルの頭足境界、S006背景geometryを検査し、各状態のPNGとmeasurements.jsonを出力する。

```sh
# Playwrightが通常インストールされている環境
node tests/communication-multiline-browser.test.cjs

# インストール場所・Chrome実行ファイル・証拠保存先は任意指定可能
QUEST_PLAYWRIGHT_MODULE=/path/to/playwright-core \
QUEST_CHROMIUM_PATH=/path/to/chrome \
QUEST_EVIDENCE_DIR=/tmp/pr6-evidence \
node tests/communication-multiline-browser.test.cjs
```

旧SHA比較は `QUEST_SOURCE_ROOT` と `QUEST_SOURCE_SHA` で独立した原本コピーを指定できる。新テストは旧SHAではホテル2件および2行Goalの既知FAILを検出し、最新版では58測定レコード・FAIL 0。55枚の描画スクリーンショットと3件のホテル境界測定を含む。

既存関連テスト：communication-recovery-visible-v1、communication-recovery-ui-v21、dialogue-information-layout、formal-communicative-flow-v1、speech-engine-retry-contract、s006-restored-all-ten-layout-v1はPASS。最後のテストはPR #6以前のCSSセレクタを検査していたため、その1行だけ現行の `:is(.communication-has-explanation, .communication-feedback)` に更新した。内容・Judge検査は変更しない。

これは対象範囲の検証であり、リポジトリ全テストや実機マイクをPASSとするものではない。証拠は作業チャットに提出する。PR #6は未mergeのまま維持する。
