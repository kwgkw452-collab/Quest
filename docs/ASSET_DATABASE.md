# Asset Database — Engine 2.0 alpha6

## 目的

画像パスを各ストーリーへ直接書かず、キャラクター・背景・アイテムの登録名だけで参照する。
これにより、画像ファイルの場所を変更しても、原則としてデータベースだけを直せばよい。

## 配置

- `data/characters.js`：キャラクター定義と共通ポーズ番号
- `data/backgrounds.js`：背景名と画像パス
- `data/items.js`：アイテム名と画像パス
- `data/audio.js`：将来のBGM・SE・音声登録場所
- `engine/services/asset-resolver.js`：登録名を実際のパスへ変換

## キャラクター指定例

```javascript
{ id: "pico", character: "pico", pose: "inactive" }
```

これは次の画像へ自動変換される。

```text
images/characters/pico/pico_08.png
```

## 08 の正式解釈

共通ポーズ番号 `08` のエンジン上の名称は `Inactive`。

- ピコ：電池切れ・停止
- コング：睡眠
- バーニー：睡眠

エンジンは「活動していない状態」として扱い、物語上の意味はキャラクター設定が決める。

## 互換性

従来どおり画像パスを直接指定することも可能。既存の話を一度に書き換えなくても動作する。
