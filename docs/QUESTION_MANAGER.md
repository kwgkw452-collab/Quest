# Question Manager Version 1.0

## 目的

Question Managerは、Eigo DE Quest全体で利用する共通Question Engineである。
Version 1.0は単語音声問題だけを扱う。

## 公開API（Version 1.0ロック対象）

```javascript
QuestionManager.start(questionId)
QuestionManager.cancel()
QuestionManager.getResult()
QuestionManager.reset()
```

`start`は完了結果を返すPromiseである。`getResult`は現在または直前の結果のコピーを返す。

## 責務

- `data/questions.js`: 問題データの登録・取得
- `QuestionManager`: 問題IDの解決、実行状態、結果
- `GameCore.speechMission`: 既存Speech Engineと画面表示の接続
- `SpeechEngine`: 音声認識と既存の正解候補判定
- `MonsterBattleManager`: Question Managerの呼び出し

Question ManagerはDOMを操作しない。Monster情報を参照しない。Speech Engineの内部実装も変更しない。

## Questionデータ

```javascript
{
  id: "word.hello",
  category: "word",
  prompt: "Hello（ハロー）と言ってください！",
  answers: ["hello", "ハロー"],
  success: "その調子！",
  failure: "もう一度、一緒にやってみよう！",
  hint: "ハロー"
}
```

必須項目は`id`, `category`, `prompt`, `answers`, `success`, `failure`, `hint`。
Version 1.0が実行するcategoryは`word`のみ。将来の種類はcategory別の実行処理を追加する。

## 結果

`status`は`running`, `success`, `failure`, `cancelled`のいずれか。
結果には`questionId`, `category`, `answer`, `success`, `failure`, `hint`, `error`を含む。

## Battle側

```javascript
MonsterBattleManager.start("m001")
```

`m001 → monster.questionId → QuestionManager.start(questionId)` の方向で呼び出す。
Battle側はMonster IDだけを知り、prompt、answers、判定方法を持たない。

`word.fruit`もVersion 1.0の`word`問題であり、公開APIは変更しない。
20種類のFruitと単数・複数等の表記揺れは`data/word-dictionaries.js`が管理する。
Question Managerは1回の発話結果を返すだけで、3種類の蓄積と重複排除はMonster Battle Managerが担当する。

Question Managerは内部設定`retryOnMismatch: false`でSpeech missionを呼ぶ。
そのため1回の発話で、正解なら`success`、不一致なら`failure`として完了する。
通常StoryのSpeech missionはこの内部設定を指定しないため、従来どおり不一致時に再試行する。

StoryでQuestionDatabaseの問題を使う場合は `StoryCommands.question(questionId)` または
`QUESTION questionId` を使用する。Story handlerはfailure時に同じ公開APIを再実行し、
成功するまで待つ。S001はHello/Japan/Yesをこの経路で実行し、promptやanswersを重複保持しない。

## Version 1.0以降

複数候補、カテゴリ問題、会話、穴埋め、並べ替えはVersion 1.0には実装しない。
Questionデータと公開APIを維持し、category別の実行処理として段階的に追加する。
