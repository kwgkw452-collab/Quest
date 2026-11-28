# Pico Support V2 リファクタリング審査
対象 6e579f36ab3cc609428da1a27719fc65088fc384 / [Issue #57](https://github.com/kwgkw452-collab/Quest/issues/57)
**GO（専用branch・限定整理のみ）。Production統合HOLD。**
Issue #57の単一状態責務、専用branch、正規bundle再生成、回帰保証は妥当。修正範囲はPICO-01〜04の再現根拠に限定する。
| 分類 | 対象 | 方針 |
|---|---|---|
| 削除 | unified.js L4,131,152 dialogueVoice | 未使用変数・代入 |
| 削除候補 | L141 stop分岐、L43/48重複、L97 stale表示 | stop API使用者と到達性を検索してから、正常状態の消去は避ける |
| 統合 | communication.cjs L5–16 / unified.js L28–40 | normal/listening/support/feedbackをEngine viewの単一契約へ。Support押下時feedback消去。layoutModeを二重計算しない |
| 整理 | unified.css L22–45 | 質問の2/3行と文書等のsecondaryを分離。旧横並びCSSは使用箇所単位で判断 |
| 保持 | runner.cjs L23–39, speech-browser.cjs L5–18 | Stage/Save/Story進行、Battle分離、cancel・期限・callback無効化 |
| 保持 | unified.js L42–61,126–185 | 台詞Support契約、Story切替のsessionEpoch、旧Save read-only |
| 生成 | quest-v2.browser.js | 正規buildで再生成、差分確認 |
新フレームワークや全面状態機械導入は不要。純粋なview導出関数と状態イベントだけで十分。別層のtokenは責務が違うため維持。
## 必須回帰テスト
32問×4幅、全Support段階、誤答→Support・UNKNOWN→Support・timeout→Support、マイク停止→再試行、無応答abort、遅延callbackと遅延Judge resolve/reject、次問reset、長文ヒント可視性、正解→次の実際のStoryステップ（S005 Q4→Q5は連続質問の例外）、台詞Support / 文書 / Battle / Save / Story切替。故意FAILは教育UIの期待値違反で検査し、手動で確認。固定SHA CIと独立検証を再実行。S001〜S004・Audio/Voice・Story/Graphic/Judgeデータ変更禁止。LOC/分岐数は改修前後比較し削除の妥当性を説明。
