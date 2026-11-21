# Eigo DE Quest — S006 Communication V2
## 実機検収フィードバック反映・正式LOCK変更実装指示 V1

### 0. 今回の任務

ユーザーが2026年11月21日に承認したS006 Communication V2の修正を実装してください。

**作業区分：C. 部分修正**

今回はS006 CommunicationのGoal・模範英文・ピコサポート・ACCEPT判定だけを修正します。

**全体監査、Story再制作、Graphic再生成、共通Engine再設計は禁止します。**

### 1. 正式GitHub

Repository：`kwgkw452-collab/Quest`

Production Branch：
`s005-fixed-195-stage-clean-test`

前回確認Production HEAD：
`70706cfa8dd7efd404b1fb45ef2ec9254e82ca4f`

既存の開発対象：
PR #11 — Engine Guard V1

作業開始時にProductionとPR #11の最新HEAD SHAを再確認してください。

PR #11では、以下の修正が並行して進行中です。

- QA-11-01：別の箱を誤ACCEPTする問題
- QA-11-02：保護台帳・許可リストの信頼性問題

**既存の修正成果を引き継ぎ、古いPR #10やProductionのS006データで上書きしないこと。**

PR #11に未commitの変更がある場合は、その内容を確認し、消失させず安全に引き継いでください。

必要なら専用Branchを分離してください。

### 2. 正式変更の範囲

今回のユーザー承認内容は、以前のV2 Final Reviewの該当部分を置き換えます。

変更対象：

- `data/s006-communication.js`
- S006のACCEPT／REJECT／UNKNOWNテスト
- 必要な仕様台帳・変更記録
- 必要なS006用キャッシュ識別

変更禁止：

- `engine/stories/S006.js`
- S006 Graphic全13枚
- S006 Ending
- S005／S007
- 共通Judge Core
- Speech Engine
- Audio
- Save
- Monster Battle
- 共通UIの無関係な部分

### 3. Q1 — ACCEPT拡張

Goal：お手伝いしましょうか？

模範英文：`Can I help you?`

以下をACCEPTに追加・維持する。

- Let us help you.
- Let us help you?
- Could I help you?
- Could we help you?
- Could I help?
- Could we help?

I／weの違い、文末の疑問符の有無で不合格にしない。

ただし `Help me.` や `Can you help me?` は依頼の方向が逆なのでREJECTを維持する。

### 4. Q2 — ACCEPT拡張

Goal：あなたの箱は何色ですか？

模範英文：`What color is it?`

追加・維持：

- What color is it?
- What is the color?
- What is its color?
- What color is your box?
- What colour is the box?

「何色か」を質問していると判断できればACCEPTする。

`What size is the box?` など、別の情報を尋ねる発話はREJECTを維持する。

### 5. Q4 — Show me / Show us 対応

Goal：その箱を見せてもらえますか？

模範英文：`Can I see the box?`

追加・維持：

- Show me the box.
- Show us the box.
- Show me that box.
- Show us that box.
- Please show me the box.
- Please show us the box.
- Show me box.
- Show us box.

`Show me` と `Show us` の両方を認める。

ただし、単に文字列にshowとboxが含まれるだけではなく、箱を見せてもらう依頼の意図を判定すること。

`Open the box.` など別の行為はREJECT。

### 6. Q6 — ribbon認識困難への対応

Goal：このリボンを見てください。

模範英文：`Look at this ribbon.`

実機でribbonが何度発話しても認識されない問題が確認されている。

追加ACCEPT：

- Look at that.
- Look at this.
- Look at it.
- Please look at that.
- Please look at this.
- Look at the ribbon.
- Look at ribbon.

さらに、S006 Q6に限定して、認識結果が `Look at the` で終わる場合もACCEPTする。

ただし、否定文や別の行動を示す発話はREJECT。

この救済はQ6専用とし、共通Judge Coreには追加しない。

第3段階のピコサポートは正しい模範英文を維持する。

### 7. Q7 — 日本語Goal変更

旧Goal：
探している箱を見ましたか？

**新Goal：箱を見ましたか？**

模範英文：
`Did you see the box?`

Goalのみの変更を原則とし、既存の正しいACCEPT／REJECT判定、NPC返答、Story配置は維持する。

### 8. Q8 — 待機依頼の表現拡張

Goal：ちょっと待ってください！

模範英文：`Wait, please!`

追加・維持：

- Wait a minute.
- Wait a moment.
- Wait a second.
- Just a minute.
- Just a moment.
- Just a second.
- One moment, please.
- One second, please.
- Hold on a minute.
- Wait for me.
- Wait for us.
- Please wait.
- Wait!

音声認識による軽微な誤りは、実際の認識結果と合わせて問題別に救済する。

`Go!`、`Don't wait!`、`Hurry up!` など逆意図はREJECT。

### 9. Q9 — Goal・模範英文変更

**新Goal：その箱を見つけてください。**

**新模範英文：`Please find the box.`**

旧模範：
`Please look for the box.`

旧表現は削除せず、自然なACCEPT表現として維持する。

ACCEPT例：

- Please find the box.
- Find the box, please.
- Find the box.
- Can you find the box?
- Please look for the box.
- Can you look for the box?
- Please help us find the box.
- Please find my box.

ピコサポートも新模範に合わせて更新する。

①「見つける」は find。「箱」は box だピコ。

② Please のあとに find the box を続けるピコ。

③ Please find the box.

ただし、QA-11-01の修正を維持する。

`Please find another box.` はREJECT。

Q3ではanother boxを尋ねる正しい表現を引き続きACCEPTする。

### 10. Q10 — Goal・模範英文変更

**新Goal：これがあなたの箱です。**

**新模範英文：`This is your box.`**

旧模範：
`Here is your box!`

旧表現は自然なACCEPTとして維持する。

ACCEPT例：

- This is your box.
- Here is your box.
- Here's your box!
- Here you are!
- I found your box!
- We have your box!
- This is the box.

ピコサポートも新模範に合わせて更新する。

①「これ」は This。「あなたの箱」は your box だピコ。

② This is のあとに your box を続けるピコ。

③ This is your box.

QA-11-01の修正を維持する。

`Here is another box!`、`This is another box.` はREJECT。

主人公が箱を実際に手渡す動作はStoryへ追加しない。

### 11. S006全体 — box/book認識救済

ユーザーによる実機確認では、boxがbookまたはbooksと認識される問題が繰り返し発生している。

**S006限定で、箱を指す発話中のbook/booksを、box/boxesの認識候補として救済する。**

例：

- Did you see the book?
- Do you have the book?
- Show me the book.
- Please find the book.
- This is your book.

これらは、対応するQの意図と文脈に合致した場合、ACCEPT対象にする。

ただし、以下を守る。

1. S006以外には適用しない。
2. 共通Judge Coreは変更しない。
3. 質問ごとの行為・対象を確認する。
4. `another book` 等がQ9・Q10で別の箱を意味する場合はREJECT。
5. Q3のother／anotherを含む正当な質問は維持。
6. 単語の置換だけで、逆意図・別行為までACCEPTしない。
7. 旧S006 V1の判定ロジックを丸ごと復活させない。

この変更は、ユーザーが今回明示承認した新仕様としてテスト期待値を更新する。

### 12. 回帰テスト

最低限、次を検査すること。

- Q1〜Q10の新Goal・模範英文
- 追加ACCEPT全文
- 既存ACCEPTの維持
- 明確な別意図のREJECT
- 未対応表現のUNKNOWN
- QA-11-01の別の箱対策
- 既存18件の修正維持
- ピコサポート①→②→③→③
- Retry時のStage保持
- 次問Stage 0リセット
- 問題数10／rule10／pool10
- 3ボタン構成
- 旧仕様混入防止
- Story／Graphic／Endingの保護

Q7の旧book拒否テストは、今回承認された認識救済方針に合わせて更新する。

旧期待値を残して新仕様をFAILにしてはいけない。一方、必要なテストを削除してPASSを作ってもいけない。

### 13. Engine Guardとの関係

QA-11-02の外部信頼基準は現在整備中。

正式なQA固定コミットが未設定なら、保護検査HOLDを維持すること。

今回の仕様変更を、PR内の台帳を書き換えるだけで無条件PASSにしてはいけない。

今回のユーザー承認内容、変更前後の差分、テスト期待値の変更理由を文書化し、独立QA Labが照合できる状態にする。

### 14. 完了報告

以下を報告してください。

1. 作業開始時のProduction HEADと作業HEAD
2. 変更ファイル一覧
3. 新commit SHA／Branch
4. 全10問のGoal・模範英文
5. 追加したACCEPT・REJECTケース
6. 実施したテストと結果
7. QA-11-01・02の維持状況
8. 未検証事項
9. Productionへの影響

**修正実装後もProductionへのmergeは禁止。**

独立QA Labの検証とユーザーの統合承認を待つこと。

### 最重要原則

中学1年生が意味の通じる英語を話した場合、軽微な文法ミスや既知の音声認識誤りだけで冒険が止まらないようにする。

同時に、明らかに異なる意図や対象を誤ACCEPTしないこと。

**S006の完成済みStory・Graphic・Endingを保護し、承認済みのCommunication修正だけを実装する。**