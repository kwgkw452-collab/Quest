# AssetManager — Engine 2.0 alpha8

`AssetManager` は画像・音声・動画・エフェクトの登録名を、実際のパスまたはCSS設定へ変換する統一窓口です。

## データファイル

- `data/characters.js`
- `data/backgrounds.js`
- `data/items.js`
- `data/monsters.js`
- `data/audio.js`
- `data/videos.js`
- `data/effects.js`

## 主な呼び出し

```javascript
AssetManager.character("pico", "inactive");
AssetManager.background("camp");
AssetManager.monster("01", "defeated");
AssetManager.audio("bgm", "forest");
AssetManager.video("opening");
AssetManager.effect("shake");
```

直接パス指定も互換性のため利用できます。

## StoryCommands

```javascript
C.bgm("forest");
C.se("attack");
C.voice("picoHello");
C.video("opening", { skippable: true });
C.effect("shake");
C.stopBgm();
```

音声素材がまだ登録されていない場合、該当コマンドをストーリーから呼び出さない限り、現在のS001動作には影響しません。
