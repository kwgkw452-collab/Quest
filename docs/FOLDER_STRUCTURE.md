# Eigo DE Quest — Folder Structure (Engine 2.0 alpha6)

```text
Eigo-DE-Quest/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
├── stories/
│   └── S001.md                 # S001.jsから生成する確認用仕様書
├── data/
│   ├── characters.js           # キャラクターと共通ポーズ定義
│   ├── backgrounds.js          # 背景画像登録
│   ├── items.js                # アイテム画像登録
│   └── audio.js                # 音源登録（準備）
├── engine/
│   ├── config.js
│   ├── commands/
│   ├── core/
│   ├── managers/
│   ├── services/
│   │   └── asset-resolver.js
│   └── stories/
│       ├── S000_TEMPLATE.js
│       └── S001.js             # Storyの正本兼実行データ
└── docs/
```

## 役割

- `stories/`：正本JSから生成する人間向け確認資料（直接編集しない）
- `engine/stories/`：StoryCommands形式の正本兼実行データ
- `data/`：作品固有の登録情報。エンジン本体から分離する
- `engine/`：100話で共用する処理
- `docs/`：エンジン設計・確認資料

### alpha7追加

- `data/monsters.js` — モンスター番号、画像2枚、英単語、セリフ、判定語、演出情報
- `engine/managers/monster-manager.js` — モンスターの表示・状態変更・消去
- `docs/MONSTER_DATABASE.md` — MonsterDatabase仕様


## alpha8追加

- `data/videos.js`：動画登録
- `data/effects.js`：共通エフェクト登録
- `engine/managers/video-manager.js`：ストーリー動画の再生・終了
- `docs/ASSET_MANAGER.md`：統一アセット管理仕様
