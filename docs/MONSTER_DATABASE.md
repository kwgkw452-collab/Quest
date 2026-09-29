# Monster Database — Monster Battle Engine Version 1.0

## 目的

Monster Databaseは、各モンスターと共通Question Engineをデータで結ぶ。
モンスター自身は答え、正解候補、判定処理を持たない。

## ID

正式IDは小文字の `m000` 形式。例：`m001`。
互換入力として数字または旧大文字IDを渡した場合も、`m001` 形式へ正規化する。

## データ項目

- `monsterId`
- `questionId`
- `name`
- `image.normal`, `image.defeated`
- `effect.intro`, `effect.success`, `effect.retreat`
- `audio.intro`, `audio.success`, `audio.retreat`
- `encyclopedia`
- `hintNpcId`
- `battle.requiredUniqueAnswers`
- `battle.dictionaryId`
- `battle.duplicateMessage`
- `hints`（間接・強ヒント。答え提示はQuestion Databaseのhintから生成）

`get()`と`all()`は内部データのコピーを返すため、Battle側からDatabaseを書き換えられない。

## Story

Monster BattleのStory公開コマンドは次の1つだけ。

```text
MONSTER_BATTLE m001
```

従来の表示専用コマンドは既存Story互換のため維持する。

## m001

`m001`は`word.fruit`と`fruit.v1`を使用し、異なるFruitを3種類発話すると撃破できる。
Fruitの正解候補はMonster Dataへ複製せず、Word Dictionary Databaseを正本とする。
