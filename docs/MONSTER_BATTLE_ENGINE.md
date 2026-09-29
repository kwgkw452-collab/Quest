# Monster Battle Engine Version 1.0

## Storyコマンド

```javascript
StoryCommands.monsterBattle("m001")
```

Story記法では `MONSTER_BATTLE m001` に対応する。Monster IDの正本は小文字とする。

## 責務分離

- `MonsterBattleManager`: 状態遷移、失敗回数、疑似キャンプ、各Managerの呼び出し
- `MonsterBattleData`: Monster取得、Hint解決、辞書回答のcanonical化
- `MonsterBattlePresenter`: Monster表示とHint表示。DOMを直接操作しない
- `QuestionManager`: 問題実行と結果（公開APIはVersion 1.0のまま）
- `MonsterDatabase`: `monsterId` と `questionId`、画像・演出・音声・図鑑・Hint情報

Monster Battle Managerは問題本文、答え、音声認識、正解判定、DOM操作を持たない。

## Hit SE（V1正式仕様）

正解時のhit SEは全Monster共通で`battleHit`を使用する。Monster Databaseにhit SE指定Fieldは持たせず、
MonsterBattleManagerにもMonster固有hit SE hookは追加しない。Monster別の差別化が実際に必要になった場合だけ、
V2以降の拡張候補として再検討する。

## BattleContext

`battleId`, `monsterId`, `phase`, `failureCount`, `retreatCount`, `hintLevel`,
`hintNpcId`, `hitCount`, `requiredHits`, `acceptedAnswers`, `cleared`, `aborted` を保持する。外部へはコピーを返す。

## 状態遷移

`IDLE → INTRO → QUESTION → LISTEN → JUDGE` を基本経路とする。
成功時は `SUCCESS → COMPLETE`。失敗時は `FAILURE → RETRY`。
現行Finite Rescueは `Support 1 → Support 2 → Support 3 → Rescue → 追加Retry 1回 → Adventure Return` とする。
旧仕様の、累計3回ごとに疑似Campへ移動してBattleを再開する反復経路は使用しない。

通常Monsterは`requiredUniqueAnswers: 1`で従来動作を維持する。m001はFruit Dictionaryを使い、
異なるcanonical wordを3種類集めた時だけCOMPLETEになる。同一単語の単数形・複数形を再使用しても
新しい正解には数えず、`One more fruit!`で別の単語を促す。重複反復はfailureCountへ接続し、
有限回数で現行Finite Rescueへ到達する。

Hint Levelと疑似Campデータは旧仕様との互換・履歴確認用に残すが、現行Runtimeの反復経路では使用しない。

Hint内容の正本はQuestion Databaseの `hint` と `answers` である。
`MonsterBattleData.getHint()` がHint Level別の表示文を生成し、疑似Camp Dataはその結果を表示する。
Monster DataとCamp Dataには同じHint文章を重複保存しない。

## ロック対象

Version 1.0の公開Storyコマンドは `MONSTER_BATTLE monsterId` のみ。
Question ManagerおよびPico Break Engineの公開APIは変更していない。
