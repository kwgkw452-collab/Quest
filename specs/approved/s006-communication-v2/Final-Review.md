# Eigo DE Quest — S006 Communication V2 Final Review
状態：最終承認用・LOCK準備／未承認／実装未着手
作成日：2026年11月19日（日本時間）

## 前提と今回の変更範囲

- 正式Repository：kwgkw452-collab/Quest
- Production Branch：s005-fixed-195-stage-clean-test
- 作業開始時に確認した最新HEAD：70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f
- 設計時HEADと一致。既存Draftを引き継ぐ仕上げであり、全体監査や新たな10問の再設計は行っていない。
- 引継ぎ元：S006-Communication-V2-Design-Draft.md（libfile_04da75836dcc8191bac14dd678f7f6aa）の現行内容を読み取り。
- Q1〜Q9のGoal・模範英文・ACCEPT例・ピコサポート・許容方針はDraftから維持。Q10のGoal・模範英文・ACCEPT例・ヒントも維持し、場面の解釈だけを明確化した。
- 問題数10、配置、ID、Graphic全13枚、画像パスと背景位置、Ending、Story通常セリフ、共通Engine・Audio・Speech・Judge Core、Dialogue UI・CSS、S005・S007は変更しない。
- Production変更・コード実装・commit・push・mergeなし。PR #6／#7も変更していない。

前回の「実行定義は問題10・rule10・pool10、重複なし」を引き継ぐ。旧台車Q7のテストは交換対象。この結果を再監査していない。

## 1. Q10の最終推奨案と理由

**推奨：Goal「はい、あなたの箱です！」／模範英文「Here is your box!」を維持する。**

### 確認した場面

現行Storyの順序は次のとおり。

1. Graphic：images/006/S006-Scene-12.png を表示。
2. 「運転手が荷物を動かすと、奥から小さな木箱が現れた。」
3. Bernie: “The ribbon!”
4. リボンの切れ端が合うという説明。
5. Little Monster: “That's my box!”
6. Q10：s006.communication.10。
7. Little Monster: “Thank you! Thank you!”
8. カワウソの子が木箱を抱えてバスに乗る。

Graphicでは、赤いリボンの木箱が荷物室の中央に置かれ、右に運転手、左に子モンスターとピコが見える。箱を主人公が持つ・手渡す描写はない。確認したローカル画像のGit blobは6684b9aae02d77d973fd2e03b2070caf3bd55ff4で、最新Production HEADの同一パスのblobと一致する。別Branchの独自画像を根拠にしていない。

### 判断

“Here is your box!” は物を手渡す場合だけでなく、目の前に見つかった物を相手に示す場合にも使える。この場面では「ほら、ここにあなたの箱があるよ」という提示として扱う。

したがって、運転手が見つけた事実、子モンスターの所有確認、目の前の箱、続く感謝と矛盾しない。主人公が箱を持つ・運ぶ・手渡すという行動を追加する必要はない。子モンスターが既に“That’s my box!”と言っていても、仲間が箱を示して応じ、その一行に子モンスターが感謝する会話として成立する。

**前回Draftの「箱を渡す→感謝」という説明は、「見つかった箱を示す→感謝」へ訂正する。** これは場面説明の精密化であり、StoryやGraphicの変更案ではない。前回説明から主人公の手渡し動作を実装・追加してはいけない。

矛盾はないと判断したため、別の模範英文への変更提案は行わない。Q10を含む以下の10問は、ユーザーによる最終承認前の候補である。

## 2. Q1〜Q10のGoal・模範英文・ACCEPT例


以下のNPC英文は、現行Storyからの引用。V2用に書き換えた返答ではない。

| 問 | 背景／相手 | 日本語Goal案 | 模範英文案 | 自然なACCEPT例 | 発話後の現行NPC返答 |
|---|---|---|---|---|---|
| Q1 | Scene04／駅員 | お手伝いしましょうか？ | Can I help you? | Can we help you? ／ Do you need help? ／ Let me help you. ／ Would you like some help? ／ May I help? | Station Staff: Oh, thank you! |
| Q2 | Scene05／子モンスター | あなたの箱は何色ですか？ | What color is it? | What color is your box? ／ What colour is the box? ／ What does your box look like? ／ Can you describe your box? | Little Monster: It's brown. It's a wooden box with a red ribbon. |
| Q3 | Scene06／駅員 | ほかの箱はどこにありますか？ | Where are the other boxes? | Where is the other box? ／ Where are the boxes? ／ Where can we find the other boxes? ／ Where did the other box go? | Station Staff: One went to the train. I don't know about the other. |
| Q4 | Scene07／荷物係 | その箱を見せてもらえますか？ | Can I see the box? | Can we see that box? ／ May I look at the box? ／ Please show me the box. ／ Could you show us that box? | Worker: Sure. 続いてLittle Monster: No. Not mine. |
| Q5 | Scene08／荷物係 | その箱を持っていますか？ | Do you have the box? | Have you got the box? ／ Do you have my box? ／ Is the box here? ／ Have you got it? | Worker: No. It's over there. |
| Q6 | Scene09／駅員 | このリボンを見てください。 | Look at this ribbon. | Please look at the ribbon. ／ Can you look at this ribbon? ／ Take a look at this red ribbon. ／ Please check this ribbon. | Station Staff: It may be from that box. |
| Q7 | Scene10／荷物係 | 探している箱を見ましたか？ | Did you see the box? | Have you seen the box? ／ Have you seen a brown box? ／ Did you see a box with a red ribbon? ／ Do you know where the box is? | Worker: Yes. I saw it. Someone took it to the bus terminal. |
| Q8 | Scene11／運転手 | ちょっと待ってください！ | Wait, please! | Please wait! ／ Wait! ／ Just a moment! ／ Hold on! ／ Please don't leave yet! | Driver: What's wrong? |
| Q9 | Scene11／運転手 | その箱を探してください。 | Please look for the box. | Can you look for the box? ／ Please help us find the box. ／ Can you check for the box? ／ Please find my box. | Driver: Sure. Let me check. |
| Q10 | Scene12／子モンスター | はい、あなたの箱です！ | Here is your box! | Here's your box! ／ This is your box! ／ Here you are! ／ I found your box! ／ We have your box! | Little Monster: Thank you! Thank you! |

Q3・Q5・Q7の模範は、現在の会話目的と短さを再評価して採用。旧案を正解として無条件に持ち越す扱いではない。Q2の外見質問は、色と素材・リボンを含む現行返答で答えが返るためACCEPT対象にする。


### ACCEPTと軽微な誤りの扱い（Draftを維持）



ここで「許容例」とした不完全な英文は、教える模範ではなくACCEPT対象。画面上の第3段階は正しい基本英文に統一する。

| 問 | 許容する軽微な誤り・省略例 | ACCEPTしない意味／誤答例 |
|---|---|---|
| Q1 | Can I help? ／ I help you?。I／we、youの省略を場面上許容 | I can't help you. ／ Help me.（助けを求める方向が逆） |
| Q2 | What color your box? ／ What color are the box?。be動詞・冠詞の欠落、不一致を許容 | Is it brown?（情報を尋ねる目的に対して返答が不自然）／ What size is the box? |
| Q3 | Where is other box? ／ Where are the other box? ／ The other boxes, where?。単複・be動詞・冠詞を許容 | Where is the bus? ／ The box is here.（別対象／断定） |
| Q4 | Can I see box? ／ Show me box, please.。冠詞省略、I／we、me／usを許容 | I can't see the box.（見せてほしい依頼ではない）／ Open the box.（中身を開ける別行動） |
| Q5 | You have the box? ／ Do you has the box?。疑問文の語順・動詞形の小さな誤りを許容 | I have the box. ／ You don't have the box.（質問でない断定） |
| Q6 | Look this ribbon. ／ Look at ribbon.。at・冠詞の省略を許容 | Give me the ribbon. ／ Don't look at the ribbon. |
| Q7 | Did you saw the box? ／ You see the box? ／ Do you see the box?。過去形・疑問文の語順を許容。現在形も「見かけたか」の意図として救済 | Is the box on the cart?（別の質問）／ Did you see the book?（箱でなく本） |
| Q8 | Wait! ／ Please wait me.。緊急場面なので一語、forの省略も許容 | Go! ／ Don't wait! ／ Hurry up!（相手を止める意図と逆） |
| Q9 | Please look for box. ／ Please find box. ／ Can you finds the box?。冠詞・動詞の語尾を許容 | I found the box.（既に発見したという報告）／ Don't find the box. ／ Please look at the box.（探す依頼にならない） |
| Q10 | Here your box! ／ Here are your box! ／ I find your box!。be動詞・単複・時制の軽微な誤りを許容 | Where is your box? ／ This is not your box. ／ Give me your box. |

対象の箱が明確な場面ではit／this／thatも許容候補に含める。単複、my／your／ourは「子モンスターの箱を一行が代わりに探している」という文脈で同じ対象を指す限り許容する。別の荷物・別の物を明示した発話まで自動的に同一視しない。

Q7のbook／booksは旧実装の認識誤り救済だが、V2では自動継承しない。Speechを変更せず「bookをboxに読み替える」特例は追加しない。必要なら、実機で得た認識記録と意味の取り違えリスクを別途示して承認対象にする。




実装時は、1つのV2問題表からQuestion、rule、poolを生成する。意図、対象、言い換え、軽微な誤り、明確な逆意図を問題ごとにまとめ、answers・variants・acceptedVariantsへ別々に手入力しない。

- 大文字小文字、句読点、color／colour、短縮形、pleaseの位置を正規化。
- modal、代名詞、冠詞、単複、疑問文の軽微な崩れを、各問の意味に沿う組み合わせで許容。
- 全文が長いから、模範と違うから、という理由だけで不正解にしない。
- 肯定prefixだけの部分一致では通さず、逆意図や別目的を含まないか確認。
- 「許容パターンに一致しない非空文字列はすべてREJECT」という現行の問題別reject関数は持ち越さない。明確な逆意図・明確な別対象・別行為はREJECT、未判定の表現はUNKNOWNとする案。
- 無音・空結果は認識失敗経路を維持し、無理に英文の誤答にしない。
- 共通Coreはそのまま。新しい英語を無制限に意味理解するAIを追加する案ではない。未対応だが意味の通る言い換えは、V2問題別データを更新して対応する。

重要：現行Coreはrule.rejectをvariantsより先に評価する。したがって、V2のreject関数が自然な許容例を先に弾かないことを必須テストにする。主候補が明確な逆意図でREJECTなら、正しい認識候補が別にあっても既存Coreは救済しない。この挙動は変更しない。


Q1はCan I help you?／Can we help you?を両方ACCEPT。Q4はCan I see the box?／Can we see the box?を両方ACCEPTする。I／weの違いで不合格にしない。

Q10の“I found your box!”／“We have your box!”等も、Draftどおり成功した探索の報告として許容例に残す。ただし、模範には手渡し・所持・主人公単独の発見を必要としないHere is your box!を用いる。許容発話のために新たな行動やセリフを挿入しない。

## 3. Q1〜Q10のピコサポート①②③


| 問 | ① 英語の手掛かり | ② 組み立て支援 | ③ 模範英文 |
|---|---|---|---|
| Q1 | 「手伝う」は help。Can I ...? で始めるピコ。 | Can I のあとに help you を続けるピコ。 | Can I help you? |
| Q2 | 「何色」は What color。これで始めるピコ。 | What color のあとに is it を続けるピコ。 | What color is it? |
| Q3 | 「どこ」は Where。「ほかの箱」は the other boxes だピコ。 | Where are のあとに the other boxes を続けるピコ。 | Where are the other boxes? |
| Q4 | 「見てもいい？」は Can I see ...? だピコ。 | Can I see のあとに the box を続けるピコ。 | Can I see the box? |
| Q5 | 「持っていますか？」は Do you have ...? だピコ。 | Do you have のあとに the box を続けるピコ。 | Do you have the box? |
| Q6 | 「見て」は Look at ...。「リボン」は ribbon だピコ。 | Look at のあとに this ribbon を続けるピコ。 | Look at this ribbon. |
| Q7 | 「見ましたか？」は Did you see ...? だピコ。 | Did you see のあとに the box を続けるピコ。 | Did you see the box? |
| Q8 | 「待って」は Wait。一言でも伝わるピコ。 | Wait に please を添えると丁寧になるピコ。 | Wait, please! |
| Q9 | 「探す」は look for。「箱」は box だピコ。 | Please のあとに look for the box を続けるピコ。 | Please look for the box. |
| Q10 | 「はい、どうぞ」は Here is ...。「あなたの箱」は your box だピコ。 | Here is のあとに your box を続けるピコ。 | Here is your box! |

Q7は過去形の活用をゼロから要求せず、Did you seeを一つの短いかたまりとして示す。Q9もlook forを一組で示す。別表現で意味が伝わったら、模範へ言い直させない。


### 共通の動作契約

- 1回目：①、2回目：②、3回目：③。
- 4回目以降も③を維持し、①へ循環させない。
- 次問へ進んだら段階をリセットする。新しい問題の最初のサポートは①。
- 同じ問題の再発話だけでサポート段階を先へ進めたり、次問扱いでリセットしたりしない。
- 第1段階から全10問に英単語または英文の出だしを含める。
- 正しい別表現を話した場合、模範英文へ言い直させない。
- 文字入力による代替回答を追加しない。
- これらは既存の共通動作を使用する契約。共通Engineを改造しない。
- サポート後の新しい認識結果の表示優先順位はPR #6の別作業と整合させ、V2側では表示処理を変更しない。

Q10の①「はい、どうぞ」は提示表現を学ぶ手掛かりとして維持する。箱の受け渡し操作を指示する文ではない。

## 4. 各問のNPC返答との整合性

| 問 | 発話の目的 → 現行返答 | 判断・留意点 |
|---|---|---|
| Q1 | 手伝いを申し出る → Oh, thank you! | 整合。I／weどちらでも感謝が自然に返る |
| Q2 | 箱の色・外見を尋ねる → 茶色、木箱、赤いリボンの説明 | 整合。itは会話中の箱を指す。外見を尋ねる言い換えにも答えられる |
| Q3 | ほかの箱の所在を尋ねる → 一つは列車へ、もう一つは不明 | 整合。単数・複数の軽微な違いで拒否しない |
| Q4 | 箱を見る許可を求める → Sure. → No. Not mine. | 整合。許可を得て、子モンスターが別の箱と確認する。箱を開ける依頼には置き換えない |
| Q5 | 荷物係の所持／その場の所在を尋ねる → No. It's over there. | 整合。荷物係の手元にはなく、あちらを示す返答として扱う。指示先に多少の曖昧さはあるが、Story変更は提案しない |
| Q6 | リボンへ注意を向ける → あの箱のものかもしれない | 整合。指示・依頼の言い換えを許容 |
| Q7 | 探している箱の目撃情報を聞く → 見た、バス乗り場へ運ばれた | 整合。旧「台車の上にありますか？」は再導入しない |
| Q8 | 出発を待ってもらう → What's wrong? | 整合。短いWait!でも事情説明への会話が始まる |
| Q9 | 箱を探す／確認するよう頼む → Sure. Let me check. | 整合。findでの依頼も自然な言い換えとして許容し、旧find文面だけを唯一の正解にしない |
| Q10 | 見つかった箱を示す → Thank you! Thank you! | 整合。主人公が手渡したとは解釈しない。箱を示す発話として維持 |

**NPC返答・通常Storyセリフの変更候補：なし。** 10問の位置も変えない。Scene番号は画像ファイル番号を指す。Q8／Q9はともにScene11、Q10はScene12。EndingはScene13のまま。

## 5. V2実装時に交換するファイル・テスト一覧

以下は承認後の計画であり、今回実行していない。

### 交換方式

data/s006-communication.jsをV2単一仕様へ全面交換する。古い配列への追記・旧ruleとの併存・二重script読込は行わない。Question、rule、poolをV2の同じ問題表から生成し、許容例の別々の手入力によるずれを防ぐ。

| 項目 | 維持／交換 |
|---|---|
| 問題数・配置 | 10問・現行配置を維持 |
| 公開問題ID | s006.communication.1〜10を維持 |
| 状態保存キー | s006Challenge1〜10を維持 |
| conceptId | Draft案のs006.mystery.v2.1〜10へ交換 |
| poolId | Draft案のs006.communication.1.v2〜10.v2へ交換 |
| 旧concept・pool | V2実行時に登録しない |
| Graphic・背景・Ending・Story | 変更しない |
| Git履歴 | 保持。削除しない |



実行コード側は3ファイル。Story・Graphic・CSS・Coreを変更しない。

| ファイル | 承認後の変更内容 |
|---|---|
| data/s006-communication.js | Goal、模範、ACCEPT、3段サポート、S006用rule／poolをV2の単一表から生成する内容へ全面交換 |
| index.html | 当該S006 Communication scriptのcache queryだけ更新 |
| dev.html | 同上。PR #6由来の他script／CSSのqueryを保持 |

テスト側は、旧基準を残したままV2テストを上乗せしないため、以下を同時整理する。

| 変更候補 | 方針 |
|---|---|
| tests/s006-communication-final-v1.test.js → tests/s006-communication-v2.test.js | V2の各問の目的・登録・判定・共通Flow接続のテストへ交換 |
| tests/s006-communication-final-cases.json → tests/s006-communication-v2-cases.json | 承認済みACCEPT／軽微ミス／逆意図／未判定ケースを新規に記載 |
| tests/s006-q7-final-correction-v1.test.js、tests/s006-q7-final-cases.json | 旧台車Q7の独立テストを現役テストから撤去。必要な検証はV2 Q7へ統合。履歴はGitに保持 |
| tests/s006-restored-all-ten-layout-v1.test.js | 旧文面・book許容等の内容固定を廃止し、V2接続／LOCK保護のテストへ整理。既存UI仕様の確認は実装変更なしで維持 |

旧テストをそのまま走らせて新V2を旧Q7へ戻す対応は禁止。テストランナーや明示列挙スクリプトが実装時の最新HEADにある場合は、その参照だけ追加で更新候補にする。今回確認したHEADでpackage.jsonや専用テストランナーは見当たらず、各Nodeテストは独立している。


### 承認後の検証条件（引継ぎ）



1. **版と件数**：index／dev両起動経路でS006問題10・rule10・pool10。問題IDは各1件、conceptIdはV2のみ、poolIdもV2のみ。V1 IDのrule／poolや別scriptロードがない。
2. **単一仕様整合**：全問の模範が自身のACCEPT条件を通過。answers／rule variants／pool acceptedVariantsが同一仕様から生成される。Goalとpool.displayValue、promptType、difficultyが一致し、QuestionManagerのfallbackで不整合が隠れない。
3. **意味の判定**：本書の自然なACCEPT例と軽微ミス例を全件実行。冠詞・単複・代名詞・polite表現の追加組み合わせも確認。逆意図・別対象・別行為を通さない。未対応の曖昧表現と無音は、誤答と混同せずUNKNOWN／speech-failureの既存経路へ。
4. **逆転防止**：肯定文＋否定の続き、否定主候補＋肯定代替候補、別の質問の語句だけ一致、Q7のbook、Q9のlook atなど、似た語で別目的の発話を確認。
5. **実際の共通経路**：V2定義＋既存QuestionManager／Judge／Flow／PresenterでS006を通す。認識結果を注入するテストと実マイク検証を区別して記録。CoreやSpeechのモックだけで完成扱いしない。
6. **ヒント**：①に英語の手掛かり、②組み立て、③模範。1→2→3→3、同問再発話時の段階保持、次問リセット、文字入力ボタンを出さないことを確認。#6の最新認識結果優先は別作業の期待値と整合させる。
7. **Story／Ending**：13背景パスと順番、10問の呼出IDと順番、NPC返答、通常セリフ、Ending16朗読と手紙、状態キーが基準と一致。既存Ending回帰テストは再利用する。
8. **LOCK保護**：基準HEADとの差分で13画像、Ending素材・コード、S006 Story、背景位置、CSS、共通Engine、Audio／Speech／Judge Core、S005／S007の対象ファイルが同一であることを確認。#6／#7統合済みなら、その取り込み後の基準とV2差分を分けて比較する。
9. **画面検収**：承認後の実装段階で実ChromeとiPhoneを確認。Goal／各段ヒントの長さ、REJECT／UNKNOWN／認識失敗、再発話、ACCEPT後のNPC返答と次場面。表示高・0〜5秒保持・S006背景Scene04／07／08／10／11／12は#6検収と共通で記録。V2の文言が収まらない場合は、まず問題別テキストの短縮案を提示し、LOCKしたCSSを変更しない。


今回行ったのは、文書の内容確認、最新HEAD確認、Q10に限ったStoryと既存画像の照合。V2の実装テスト・ブラウザ検収が済んだという意味ではない。

## 6. PR #6・#7との競合回避方法


| 並行作業 | 重複 | 解決方針 |
|---|---|---|
| PR #6 表示修正 | index.html／dev.htmlを共有 | PR #6をV2へ無断取込しない。統合順にかかわらずS006 Communicationのscript queryだけを編集し、#6のCSS・DialogManager・FlowController・他queryを保持。両機能が揃ったHEADで最終ブラウザ検収 |
| PR #7 第1段階ヒント | data/s006-communication.jsが直接重複 | S006部分はV2全置換で置き換える。#7のS006旧ヒントをV2へ重ねない。S005／S007側の改善は別作業として保持し、V2のために変更しない |
| PR #7の英語ヒント検査 | V2第1段階も検査対象になりうる | 第1段階に英語を含むという条件はV2でも満たす。#7のテストが旧文言まで固定していないか、実装時に最新の差分を再確認 |
| 同時更新全般 | 最新HEADの移動 | 実装開始・PR作成・統合検討の各時点で正式HEADと両PRのHEADを再取得。古いファイル全体で上書きしない |

推奨順序は、#7のS006差分を別作業担当がV2により置換予定と把握したうえで、V2承認後の最新Productionから専用Branchを作ること。#7が先に統合された場合もそのS006データを全置換する。V2が先なら、後から#7の旧S006差分を適用しない。#6の表示検収は独立して継続できる。


今回、両PRへのコメント・修正・統合・状態変更は行っていない。上表は将来のV2実装時の競合回避方法であり、今回PRを操作する指示ではない。

## 最終承認の対象

承認対象は、本書の10問のGoal・模範英文・ACCEPTと軽微な誤りの許容方針・3段階ヒント・既存NPC返答との接続・安全な交換方針。

- Q1〜Q9：既存V2 Draftを維持。
- Q10：Here is your box!を維持。「箱を渡す」ではなく「見つかった箱を示す」と解釈する。
- 旧仕様の重ね合わせは行わない。
- 状態：最終承認待ち。ユーザーのV2最終仕様への明示承認までは実装しない。
- 今回の作成依頼は、commit・push・mergeの許可ではない。

## 確認元

- [Production確認HEAD](https://github.com/kwgkw452-collab/Quest/commit/70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f)
- [現行S006 Story](https://github.com/kwgkw452-collab/Quest/blob/70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f/engine/stories/S006.js)
- [現行Scene12 Graphic](https://github.com/kwgkw452-collab/Quest/blob/70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f/images/006/S006-Scene-12.png)
- [引継ぎV2 Draft](https://chatgpt.com/library?file_id=libfile_04da75836dcc8191bac14dd678f7f6aa&account_id=personal)

