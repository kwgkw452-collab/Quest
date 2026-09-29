# Codex Review Task: Pico Break Engine Experiment

対象: Eigo DE Quest Engine v2.0.1 Stable派生版

## 実施内容
1. `data/pico-breaks.js` のデータ検証
2. `engine/managers/pico-break-manager.js` の非同期競合確認
3. APIがPico Break表示前・表示中・表示直後に完了する3ケースをテスト
4. `once`, `excludeStories`, recent履歴、interval判定をテスト
5. 既存S001、Opening、Speech、Saveを壊していないことを確認
6. ストーリー内容・既存ファイル名は変更しない

## 合格条件
- API応答1.2秒未満: Pico Breakなし
- API応答1.2秒超: wait表示
- API完了: wait表示を安全に閉じる
- 第20話: englishカテゴリを選ばない
- forced伏線: 確率に関係なく表示
- once伏線: 二度表示しない
- 既存S001が開始から終了まで動く

## Codex検証結果（Experimental 0.2）
- PASS: API応答が閾値未満の場合は非表示
- PASS: API応答が閾値を超えた場合はwait表示し、完了時に安全に閉じる
- PASS: 無関係なPico BreakをAPI完了処理が閉じない
- PASS: 第20話のenglish除外
- PASS: forced表示、once再表示防止、recent履歴保存、interval判定
- PASS: S001の登録、全ステップ検証、Speechステップ保持

自動確認: `node tests/pico-break-manager.test.js && node tests/s001-smoke.test.js`

## Experimental 0.3 可視デモ
- 原因: 0.2にはエンジンを呼ぶ実験場面がなく、通常起動ではPico Breakが発生しなかった。
- 対応: `index.html`へ実験パネルを追加。S001のストーリー内容は変更していない。
- 「今すぐ表示」: 通常のtip表示
- 「API待ち（3秒）」: 1.2秒後にwait表示、3秒で自動終了
- 「第20話を確認」: english除外を判定し、代わりにrumorを表示

自動確認: `node tests/pico-break-demo.test.js`

## Pico Break Engine 1.0 完成項目
- PASS: `PICO_BREAK`文字列命令をStoryCompilerが解釈
- PASS: `PICO_BREAK_FORCE id`、`PICO_BREAK_WAIT`、`PICO_BREAK_OFF`、`PICO_BREAK_ON`
- PASS: 通常判定をManagerへ集約（4話間隔→ランダム）
- PASS: API待ち専用コンテンツを通常抽選から除外
- PASS: ON/OFF、once、直近3件、最終表示時刻をセーブ
- PASS: 閉じるアニメーションと次表示のタイマー競合を防止
- PASS: 旧Experimentalコマンドとの互換窓口を維持
- PASS: S001.js、S001.mdは変更なし

追加自動確認: `node tests/pico-break-story-commands.test.js`
