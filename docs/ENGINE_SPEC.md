# Eigo DE Quest ゲームエンジン仕様 Ver.2.0 alpha4

## 現在の位置づけ

Ver.1.7を完成見本として固定し、alpha3のSceneManagerとライフサイクルに、ストーリーデータ作成用の共通命令とコンパイラを追加した第4段階である。Version 1.0整合化ではS001末尾の旧Camp直書きを正式Camp commandへ移行した。

## 起動設定

`engine/config.js`

- `initialStoryId`：開始する話数ID。現在は `S001`
- `openingEnabled`：オープニングを表示するか。現在は `true`

## 話数の管理

- `StoryRegistry`：話数データの登録・取得・一覧
- `StoryCompiler`：ストーリーデータをEngine用の標準stepへ変換
- `StoryCommands`：ストーリー作成時に使う共通命令
- `StoryEngine`：各命令の検査と実行
- `SceneManager`：指定された1話の開始と実行状態を管理
- `StoryEvents`：話数・ステップの開始と終了を共通通知

## StoryCommands

新しい話では、`type`名を毎回直接書かず、共通命令を利用できる。

```javascript
var C = StoryCommands;

steps: [
  C.clear(),
  C.background("images/backgrounds/bg_forest.png"),
  C.characters([
    { id: "pico", src: "images/characters/pico/pico_01.png", className: "pos-center-low size-medium" }
  ]),
  C.dialogue("ピコ", "ここに台詞を書きます。"),
  C.wait(1000)
]
```

使用できる共通命令：

`clear` / `background` / `backgroundSequence` / `item` / `characters` / `characterImage` / `floatingText` / `dialogue` / `hideDialogue` / `wait` / `effect` / `filter` / `speech` / `confirmSpeechName` / `set` / `choice`

既存の `{ type: "dialogue", ... }` 形式も引き続き動作する。S001は安定版を守るため、alpha4では書き換えていない。

## StoryCompiler

`StoryRegistry.register(story)`の直前に自動で動作する。既存形式を壊さず、将来さらに短いデータ表記へ拡張するための変換層である。Engine本体と各話データの間に置くことで、第100話までEngineを変更せず追加しやすくする。

## Story開始

```javascript
await SceneManager.start("S001", initialState);
```

## ライフサイクル

話数：`onEnter` / `onComplete` / `onExit`

各step：`onEnter` / `onComplete`

通常の話では書かなくてよい。

## StoryEvents

`story:enter` / `story:complete` / `story:exit` / `step:enter` / `step:complete`

## キャラクターポーズ番号

| 番号 | 共通名称 | 日本語 |
|---|---|---|
| `01` | Normal | 通常 |
| `02` | Smile | 笑顔 |
| `03` | Surprised | 驚き |
| `04` | Sad | 悲しみ |
| `05` | Smug face | ドヤ顔 |
| `06` | Crying | 号泣 |
| `07` | Clapping | 拍手 |
| `08` | Inactive | 活動していない状態 |
| `09` | Side walk | 横歩き |
| `10` | Threatening | 威嚇 |

- 画像番号は共通規格である。
- 08はピコでは電池切れ、コングやバーニーでは睡眠として扱う。
- エンジンは意味を解釈せず、指定された画像を表示する。
- キャラクターごとに画像枚数が異なってよい。

## S001正式仕様

- ピコは `pico_08.png` で登場する。
- 「Hello（ハロー）と言ってください！」を表示する。
- Hello成功後に `pico_01.png` へ切り替える。
- JapanとYesにはカタカナを付けない。
- 第1話末尾は旧Story直書きCampではなく、正式Camp commandでCAMP_001を実行する。
- CAMP_001完了後にS001を終了し、SceneManagerの呼び出し元へ結果を返す。
- Morning RoutineはCAMP_001に含めず、独立Morning Engineで実行する。S001からは呼ばない。

## Engine 2.0 alpha6 — アセットデータベース

- キャラクター・背景・アイテムの画像パスを `data/` に集約する。
- ストーリーでは登録名とポーズ名を使用できる。
- 共通ポーズ `08` の正式名称は `Inactive`。
- 既存の直接パス指定も互換性のため引き続き使用できる。

## alpha7 — MonsterDatabase

- `data/monsters.js` にモンスター共通データ形式を追加。
- `MonsterManager` が表示、状態変更、消去を担当。
- `AssetResolver.monster(id, state)` が画像パスを解決。
- モンスターIDは数字で管理し、1桁は2桁へ正規化。
- 基本画像は `normal` / `defeated` の2枚構成。
- S001のストーリー・セリフ・演出には変更なし。

## alpha8 — AssetManager完成

- `AssetManager` を画像・音声・動画・エフェクトの統一窓口として追加。
- 既存名 `AssetResolver` は互換性のため維持。
- `data/videos.js` と `data/effects.js` を追加。
- `AudioManager` をBGM・SE・ボイスの実再生に対応。
- `VideoManager` と共通動画レイヤーを追加。
- StoryCommandsに `bgm` / `stopBgm` / `se` / `voice` / `video` / `stopVideo` を追加。
- オープニング動画も `VideoDatabase.opening` から解決。
- S001のストーリー、台詞、画像、camp演出は変更なし。

## alpha9: SpeechEngine

音声認識は `SpeechNormalizer`、`SpeechRecognitionAdapter`、`SpeechEngine` に分離した。
旧 `SpeechHelper` は互換窓口として維持する。詳細は `SPEECH_ENGINE.md` を参照。

## Engine 2.0 beta2 — Save System

`SaveManager` now owns persistent player data, story progress, flags, inventory, bestiary data, and cumulative play time. It uses a versioned schema and safely falls back to new data if stored JSON is unreadable. S001 contains no save-specific commands; automatic lifecycle hooks preserve compatibility.


## EventSystem（beta2）

共通イベント、順次・並列実行、条件分岐、繰り返し、チェックポイントを提供する。
EventSystemは必要なStoryから段階的に利用する。S001末尾のCamp接続は正式Camp commandへ移行済みである。
詳細は `docs/EVENT_SYSTEM.md` を参照。
