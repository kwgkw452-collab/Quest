# S006 V2: 18件の個別修正記録

原本: `specs/approved/s006-communication-v2/Final-Review.md`。SHA-256は仕様台帳に固定。共通Judge Coreは変更しない。

10件は未対応の曖昧表現をUNKNOWNとする方針、8件は「対象の箱が明確な場面」の代名詞許容方針に基づく。後者の具体文は原本文表の逐語例ではなく、本文方針から導いた検査例である。

| No. | Q | 発話 | 期待 | PR10実際 | 修正後 | 原因 | 修正 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Q1 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 2 | Q2 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 3 | Q2 | What colour is that? | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |
| 4 | Q3 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 5 | Q3 | Where is it? | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |
| 6 | Q4 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 7 | Q4 | Can we see it? | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |
| 8 | Q5 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 9 | Q5 | Do you have this? | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |
| 10 | Q6 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 11 | Q6 | Look at that, please. | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |
| 12 | Q7 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 13 | Q7 | Did you see that? | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |
| 14 | Q8 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 15 | Q9 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 16 | Q9 | Please look for it. | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |
| 17 | Q10 | I am not sure. | UNKNOWN | REJECT | UNKNOWN | 否定語notだけで一律拒否 | 明示的逆意図／認識可能な対象行為の否定に限定 |
| 18 | Q10 | This is it! | ACCEPT | UNKNOWN | ACCEPT | 対象スロットが代名詞に未対応 | 対象スロットだけit/this/thatを許容 |

18件すべて期待判定に一致。原本由来の183検査はFAIL 0。PR10由来の198判定ケースも別途継続実行し、逆意図・別対象・Q7旧台車・book誤変換・Q9 look atの非ACCEPTを維持する。
