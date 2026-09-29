# Camp Engine Version 1.0

Camp Engineは、通常キャンプと疑似キャンプを同じデータ形式で実行します。
呼び出し元がStoryかBattleかをCampManagerは判定しません。

## 公開API

```javascript
CampManager.start(campId)
CampManager.cancel()
CampManager.getResult()
CampManager.reset()
```

## データ

キャンプ定義は `data/camps.js` の `CampDatabase` に登録します。
`enabled` と `steps` によるデータ駆動です。

通常Campは夜のCamp処理と「休む」までを担当します。Morning Routineは
独立Morning Engineを正式commandから呼び、通常Campへ含めません。Pico BreakもCampへ固定せず、
必要なStory位置から正式なPICO_BREAK commandで呼び出します。

Version 1.0のstepは `background`, `dialogue`, `effect`, `audio`
をサポートします。

## 呼び出し

JavaScript Storyでは次のコマンドを使用できます。

```javascript
StoryCommands.camp("CAMP_001")
```

テキストコマンドは次の形式です。

```text
CAMP CAMP_001
```

Monster Battleは3回失敗するたび、Monster Databaseに登録されたcamp IDを
CampManagerへ渡します。CampManagerは戦闘状態や再開先を保持しません。
