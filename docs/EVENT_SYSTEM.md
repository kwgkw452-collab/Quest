# EDQ EventSystem — Engine 2.0 beta2

EventSystemは、S001〜S100で繰り返し使うイベント進行を共通化する層です。
既存のS001は変更せず、将来のストーリーから段階的に利用できます。

## 共通イベントコマンド

- `sequence(steps)`：複数イベントを順番に実行
- `parallel(steps)`：複数イベントを同時に実行
- `branch(condition, thenSteps, elseSteps)`：条件分岐
- `repeat(steps, times)`：指定回数の繰り返し
- `event(name, payload, saveAs)`：登録済み共通イベントを呼び出す
- `checkpoint(id)`：安全な再開地点として進行状態を保存

## 条件の例

```javascript
C.branch(
  { flag: "bridgeOpened", equals: true },
  [C.dialogue("ピコ", "橋はもう開いているよ！")],
  [C.dialogue("ピコ", "橋を開く方法を探そう！")]
)
```

条件はstate、SaveManagerのflag、inventoryを参照できます。
`all`、`any`、`not`、`equals`、大小比較、`includes`に対応します。

## 登録イベント

```javascript
EventSystem.register("camp", async function (context) {
  // 共通キャンプ演出
});
```

ストーリー側：

```javascript
C.event("camp", { background: "camp" })
```

エンジンはイベント名を実行するだけで、世界観上の意味は解釈しません。
