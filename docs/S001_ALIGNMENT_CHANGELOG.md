# S001 Engine整合化 変更履歴

## 対象

S001と共通Engineだけを対象とし、次話遷移とMonster BattleのStory接続は行わない。

## SHA-256

- 変更前 `engine/stories/S001.js`: `66af621845c514874b6f61006880120da009fba5f6266a6c10367ffd7ab3cc72`
- 変更後 `engine/stories/S001.js`: `e271320058d89427524222064bb454762c0a21844cd450f69cb9040fd10db002`

## 旧仕様からの変更

- S001の`nextStoryId`と製品版の対象外Story読込を除外。
- S001全stepをStoryCommands形式へ統一。
- Hello/Japan/YesをQuestionDatabase正本＋Question commandへ統一。
- `screen-flash`直接指定をEffectDatabaseの`flash`へ統一。
- player nameの永続正本をSaveManagerへ統一。
- MorningManager、MorningDatabase、MORNING commandを追加。S001からは未接続。
- Campから未使用の`recovery`、`morning`、`picoBreak`メタデータと固定Pico stepを除外。
- Monster Hint文章をQuestionDatabaseから生成し、重複Dataと未使用Presenter経路を整理。
- `engine/stories/S001.js`をStory正本、`stories/S001.md`を生成確認資料に統一。

## 意図的に追加していないもの

- S001のMonster Battle
- m001・フルーツモンスターのStory接続
- S001のMorning command
- S001のPico Break
- 推測によるBGM、SE、Voice
- mysteryBookの所持品化
- コング加入flag
