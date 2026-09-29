# Pico Break Engine Specification Ver.1.0

## 目的
Pico Breakは固定の「英会話ワンポイント」ではない。ゲーム進行へ短く割り込み、次の用途を担う。

- API・外部処理の待ち時間を退屈にしない
- 待ち時間が少ない場合でも数話に一度は登場させる
- 低確率のランダムイベント
- 伏線、噂、世界観、ヒントを流す
- 物語上必須の情報は強制表示する

## 発生モード
- `wait`: API待ちが設定時間を超えた場合
- `interval`: 既定では4話ごと
- `random`: 既定確率12%
- `forced`: ID指定で必ず表示
- `manual`: 開発者・デバッグ操作から表示

## 重要仕様
- 第20話では `category: english` を候補から除外する。
- 第20話専用のif文をManagerへ直書きせず、コンテンツ側の `excludeStories: [20]` で制御する。
- `once: true` の伏線はセーブデータに表示履歴を保存する。
- 直近3件は原則再表示しない。
- Pico Break表示中も元のStory stateを変更しない。

## Storyからの呼び出し（正式コマンド）
```js
steps: [
  "PICO_BREAK",
  "PICO_BREAK_FORCE PB-FORESHADOW-001",
  "PICO_BREAK_WAIT",
  "PICO_BREAK_OFF",
  "PICO_BREAK_ON"
]
```

| コマンド | 動作 |
| --- | --- |
| `PICO_BREAK` | Managerが4話間隔を先に判定し、それ以外はランダム判定する |
| `PICO_BREAK_FORCE id` | IDを指定して表示する。`once`、話数除外、OFFは守る |
| `PICO_BREAK_WAIT` | API待ち監視を開始し、tokenをStory stateへ保存する |
| `PICO_BREAK_OFF` | 以後の通常・強制・API待ち表示を無効にし、セーブする |
| `PICO_BREAK_ON` | 表示を再開し、セーブする |

Storyには表示条件を書かない。文字列命令は`StoryCompiler`が内部stepへ変換し、`StoryEngine`が`PicoBreakManager`へ渡す。

JavaScriptでStoryを組み立てる場合は、同じ処理を`StoryCommands.picoBreak()`、`picoBreakForce(id)`、`picoBreakWait(task, options)`、`picoBreakOff()`、`picoBreakOn()`から呼べる。

## API待ちを包む
```js
var result = await PicoBreakManager.during(
  function () { return callExternalApi(); },
  { storyId: SceneManager.getCurrentStoryId(), thresholdMs: 1200 }
);
```

APIが1.2秒以内に返れば表示しない。超えた場合のみwaitカテゴリを表示し、API完了時に閉じる。

`PICO_BREAK_WAIT`を文字列だけで使った場合、開始tokenは`state.picoBreakWaitToken`へ入る。API処理側は完了時に`PicoBreakManager.endApiWait(token)`を呼ぶ。API処理をStory commandへ直接渡せる場合は、次の形で開始から終了まで自動管理する。

```js
StoryCommands.picoBreakWait(
  function () { return callExternalApi(); },
  { thresholdMs: 1200, saveAs: "apiResult" }
)
```

## 責務分離
- Story: `PICO_BREAK`系の1行命令だけを書く。
- StoryCompiler: 文字列命令を内部stepへ変換する。
- StoryEngine: 命令をManagerへ中継し、判定は持たない。
- PicoBreakManager: interval、random、wait、force、ON/OFFと表示ライフサイクルを管理する。
- PicoBreakCatalog: データ検証、ID索引、話数条件、once、履歴条件、重み付き抽選を管理する。
- PicoBreakStore: Pico Break専用セーブ状態とON/OFFを管理する。
- `data/pico-breaks.js`: 内容、重み、対象話、除外話を管理する。

## 競合時の動作
- API待ちの表示は、そのAPI処理だけを識別するトークンで管理する。
- 別のPico Breakが表示中なら、API完了時にその表示を閉じない。
- `forced` は抽選確率と直近履歴を無視するが、`once` と `excludeStories` は守る。
- 直近履歴はセーブデータにも保存し、再起動直後の連続表示を避ける。
- repeatable候補数が直近履歴数より少ない場合は、候補枯渇時だけrecent条件を緩める。once・話数除外は維持し、直前と同じ内容は可能な限り避ける。
