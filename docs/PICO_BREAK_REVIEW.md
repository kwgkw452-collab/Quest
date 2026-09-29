# Pico Break Engine 1.0 Architecture Review

## 結論

Pico Break Engineの公開コマンドとデータ形式は、Version 1.0としてロック可能。
Story本文と既存ファイル名は変更していない。

## レビューと改善

| 観点 | 評価 | 対応 |
| --- | --- | --- |
| 責務分離 | 良好 | CatalogとStoreをManagerから分離 |
| Story Engine結合 | 弱い | Story Engineは5命令の中継だけ。判定はManager/Catalog側 |
| Manager規模 | 適正 | 260行から215行へ削減。表示・待機・進行制御へ集中 |
| データ駆動 | 良好 | min/max/exclude/category/weight/onceをデータで処理 |
| コマンド | 良好 | Storyは`PICO_BREAK`の1行で通常判定を呼べる |
| 保守性 | 良好 | 起動時データ検証、ID重複検出、旧API互換を追加 |
| 命名 | 良好 | 正式名`force`を追加し、旧`forced`は互換名として維持 |
| 重複 | 改善済み | Story Engineのcontext生成とforce処理を共通化 |
| 不要処理 | 改善済み | 未使用session表示回数とManager内の重複選択処理を削除 |
| 性能 | 問題なし | 強制ID検索は索引によりO(1)、通常抽選は候補数に対してO(n)。500件×10,000回の選択で約2.23秒（約0.23ms/回） |
| 100話運用 | 対応 | S100選択試験、100件Catalog試験、履歴枯渇回復試験を追加 |

## 長期運用対策

- `once`を使い切り、repeatable候補が直近3件より少なくなっても永久停止しない。
- 候補枯渇時だけrecent条件を緩め、直前の内容は可能な限り避ける。
- once、話数範囲、除外話、カテゴリ条件は緩めない。
- データID重複、不正weight、不正話数範囲を起動時に検出する。
- 旧Experimental 0.2の`forced`系APIは互換窓口として残す。

## 完成度

96 / 100

## 残課題

1. 第100話までの実コンテンツ追加。Engineではなくデータ制作作業。
2. 実APIを接続した状態で、通信失敗・15秒上限・復帰を含む端末実地試験。
3. Edge/Chrome、PC/スマートフォンでのフォーカス操作と画面サイズの最終目視確認。

## Version 1.0ロック判定

ロック可。

次の公開契約をVersion 1.0として固定する。

- `PICO_BREAK`
- `PICO_BREAK_FORCE id`
- `PICO_BREAK_WAIT`
- `PICO_BREAK_OFF`
- `PICO_BREAK_ON`
- `PicoBreakData`の`id/category/title/text/minStory/maxStory/excludeStories/weight/once`

残課題は公開契約を壊さず、データ追加・API接続・QAとして進められる。
