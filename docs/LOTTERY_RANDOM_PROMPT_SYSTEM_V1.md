# Lottery Foundation V1.0

## 責務

Lottery Foundationは、学習者へ「何を出すか」をDataから選択し、抽選時点のsnapshotを返す独立基盤である。

表示、Target発話、Recognition候補、意味を別Fieldとして扱う。

- `conceptId`: 意味を識別する安定ID
- `displayValue`: 学習者へ提示できる値
- `expectedUtterance`: 学習者に発話してほしいTarget表現
- `acceptedVariants`: 将来の判定側へ渡せるRecognition候補情報
- `promptType`: 注文、質問、時刻などのPrompt分類
- `difficulty`: 学習段階を選ぶFilter値

文字列そのものを意味IDにしない。同一`conceptId`を異なる表示やDifficultyのitemで利用できるため、conceptId重複は全面禁止しない。

## V1.0の処理

1. Pool取得
2. Pool validation
3. `difficulty`／`promptType`によるFilter
4. 注入可能なRandom sourceによる選択
5. 複数item時の直前`itemId`回避
6. 1item時の安全な重複許可
7. 空Pool・不一致時の安全なfailure snapshot
8. 抽選結果snapshotの生成

`draw(poolId, options)`は`options.randomFn`があればそれを利用し、省略時だけ`Math.random`を利用する。重複回避は候補のFilterだけで行い、Retry loopを使わない。

## Failure

存在しないPool、空Pool、Filter後0件ではExceptionを投げず、`status: "unavailable"`と理由を含むsnapshotを返す。

## Snapshot

snapshotは次を保持する。

- schemaVersion
- status／reason
- poolId
- itemId
- conceptId
- displayValue
- promptType
- difficulty
- expectedUtterance
- acceptedVariants
- metadata

返却値はPool Dataからcloneされる。将来Save／Resumeへ渡せるが、V1.0ではSave Manager、LocalStorage、Story Resumeへ接続しない。

## V1.0で担当しないもの

- Speech RecognitionとNormalize
- 正誤判定とCommunicative Judge
- Local／Growing Dictionary
- Question UIとStory進行
- Monster Battle、Morning、Camp、Pico Break
- Audio、Voice、Character表示
- Gemini、OpenAI、Local ModelなどのAPI／Provider
- Save Manager全体

`acceptedVariants`は情報として返すだけであり、Lottery Foundation自身は発話を判定しない。

## Sample Pool

`shopping.fruit.order.v1`にappleとbananaだけを登録する。各itemには`starter`と`basic`の注文表現がある。このDataはFoundation検証用であり、実Storyでは使用しない。

## Runtime接続状態

V1.0は`index.html`、`dev.html`、Story Commands、Story Engineへ読み込ませない。既存Story、Question、Speech、Monster、Morning、Camp、Pico Breakの実効動作は変化しない。

## Known Issues（今回対象外）

- 既存Speechの部分一致では、Acceptedが`1`の場合にRecognitionの`10`へ一次一致する可能性がある。
- Morning reaction Dataが空配列の場合の防御はMorning Manager側にない。

いずれもLottery Foundationの責務ではないため、V1.0では既存コードを変更しない。
