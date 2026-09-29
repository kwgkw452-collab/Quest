# EDQ Save System — Engine 2.0 beta1

## 保存対象

- プレイヤー名
- 累積プレイ時間
- 現在のストーリーIDとステップ番号
- 完了済みストーリー
- ストーリーごとの状態
- フラグ
- 所持アイテムと個数
- モンスター図鑑（発見・撃破・回数）

保存先はブラウザの `localStorage` です。保存データが壊れている場合は、安全な初期データへ戻します。

プレイヤー名の永続正本は `SaveManager.player.name` です。OpeningとStory内の名前確認は
`SaveManager.setPlayerName()`へ保存し、Story stateには実行中に必要なコピーだけを置きます。

## 自動保存

- ストーリー開始時に進行位置を保存
- ストーリー完了時に状態と完了記録を保存
- ページを閉じる前にプレイ時間を保存

`GameConfig.autoSaveStepInterval` を 0 より大きくすると、そのステップ数ごとにも保存します。beta1ではS001の進行を変えないため0です。

## StoryCommands

```javascript
C.save();
C.setFlag("bridgeOpened", true);
C.addItem("battery", 1);
C.removeItem("battery", 1);
C.discoverMonster("01");
C.defeatMonster("01");
```

## JavaScript API

```javascript
SaveManager.getData();
SaveManager.save();
SaveManager.load();
SaveManager.reset();
SaveManager.setPlayerName("Hiro");
SaveManager.setFlag("key", true);
SaveManager.getFlag("key", false);
SaveManager.addItem("itemId", 1);
SaveManager.getItemCount("itemId");
SaveManager.recordMonsterEncounter("01");
SaveManager.recordMonsterDefeat("01");
SaveManager.exportData();
SaveManager.importData(jsonText);
```
