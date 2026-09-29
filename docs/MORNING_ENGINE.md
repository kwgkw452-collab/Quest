# Morning Routine Scene Specification Ver.1.1

Morning Managerは、共通Morning Routineを実行して結果を返します。Story遷移、Camp、Monster Battle、Question、Pico Breakの責務は持ちません。音声認識はSpeech Engineを利用し、判定辞書と全肯定リアクションは`data/mornings.js`が管理します。

## 正式フロー

```text
Continue → scene_morning_routine → 前回セーブ地点
```

New Gameでは実行しません。現在のS001末尾にある`MORNING_001`は、Camp後の実画面確認用の一時接続です。

## 公開API

```javascript
MorningManager.start(morningId)
MorningManager.cancel()
MorningManager.getResult()
MorningManager.reset()
```

既存の公開APIは変更しません。

## Data

`data/mornings.js`の`MorningDatabase`が以下を管理します。

- Scene ID: `scene_morning_routine`
- Player Nameを使う問いかけ
- 前回Camp種別に応じた朝背景
- Campの暗さから約3秒で朝へ明るくなる開始演出
- 感情キーワード辞書（73登録、68ユニーク。今後育てる辞書）
- 判定順
- Positive / Neutral / Negative / Sick / Hungry / Unknown / Silent
- カテゴリー別リアクション18パターン
- 将来の音声ファイルを登録する空の`voice`項目

音声素材は現時点では未作成です。`voice`が空の場合は英語・日本語字幕だけで正常に完了し、将来パスを登録すると同じData構造で音声を追加できます。

## 判定

発話をSpeech Engineで正規化し、カテゴリーごとのキーワードを`includes`方式で判定します。`unhappy`を`happy`と誤認しないよう、Sick / Hungry / Negative / Neutral / Positiveの順で判定し、同一カテゴリー内では長い語句を先に確認します。該当なしはUnknown、本当に規定時間発話がなかった場合だけSilentです。権限エラーやマイク開始エラーをSilentとして即時処理せず、ユーザー操作後に再開します。

## Story command

```javascript
StoryCommands.morning("MORNING_001")
```

```text
MORNING MORNING_001
```

## cleanup

完了・cancel・failureの各経路で、音声認識、認識文字、Dialogue、Morning Characterをcleanupします。
