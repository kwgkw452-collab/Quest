# Character / Party Version 1.0

## Character ID

Character ID はNPC・仲間Characterを永久に識別する正の整数です。正式登場順に一度だけ割り当て、離脱、再加入、長期離脱、一時退場でも削除・再利用・再採番しません。IDやCharacter名をCamp固有分岐に使用しません。

Version 1.0で確定しているIDは次の2件だけです。

- `1`: ピコ (`pico`)
- `2`: コング (`kong`)

素材だけが存在し、正式登場順が未確定のCharacterは `id: null` のまま保持します。

## Character Database

恒久定義の正本は `data/characters.js` の `CharacterDatabase` です。各Characterは次の汎用schemaを使用します。

`id`, `key`, `name`, `gender`, `type`, `traits`, `folder`, `filePrefix`, `extension`, `defaultPose`, `availablePoses`

`08` はCamp専用のsleepではなく、汎用状態 `inactive` です。Camp専用Character属性は追加しません。

## Party state

現在同行しているCharacterの正本は `SaveData.party.companionIds` です。Character Databaseの複製ではありません。順序を維持した重複なしのCharacter ID配列としてSaveされます。Version 1.0では人数の強制上限を設けません。

汎用APIは既存のSaveManagerに置きます。

- `SaveManager.addCompanion(characterId)`
- `SaveManager.removeCompanion(characterId)`
- `SaveManager.getCompanionIds()`

離脱は `removeCompanion(2)` のようにParty状態だけからIDを外します。Character DatabaseのID 2は残ります。再加入は `addCompanion(2)` とし、同じIDを再使用します。

## Playerとの分離

Playerのシステム識別、ゲーム内で呼ばれるHandle Name (`SaveData.player.name`)、NPC・仲間のCharacter IDは別の概念です。主人公へCharacter IDは割り当てません。

## Campとの接続

Campは `SaveManager.getCompanionIds()` から現在同行IDを取得し、`CharacterDatabase.get(id)` でCharacter情報を解決します。したがって離脱Characterは候補外となり、同じIDで再加入すると再び候補になります。Character / Party側はCamp専用機能を持ちません。
