# SpeechEngine（Engine 2.0 alpha9）

音声認識をストーリーや画面処理から分離する共通エンジン。

## Question Manager内部契約

`SpeechEngine.mission`は内部設定`retryOnMismatch: false`を受け取った場合のみ、
1回の発話後に`{ matched, answer }`を返す。

この設定を省略した通常Storyでは、従来どおり不一致時に内部再試行する。
公開Speech APIおよびStoryコマンドは変更しない。

## 構成

- `speech-normalizer.js`：小文字化、記号除去、空白整理、正解候補との部分一致
- `speech-recognition-adapter.js`：Web Speech APIとの接続
- `speech-engine.js`：認識状態、判定、再試行、イベント、ミッション進行
- `speech.js`：旧 `SpeechHelper` 互換窓口

## ストーリーコマンド

```javascript
C.speech("Hello（ハロー）と言ってください！", ["hello", "ハロー"], {
  lang: "en-US",
  saveAs: "greeting"
});
```

任意設定：`timeoutMs`、`buttonLabel`、`fallbackPrompt`。
`timeoutMs` を省略した場合は従来どおりブラウザ側の終了判定を使用する。

## 設計原則

- 認識中の文字はリアルタイム表示する。
- 判定は小文字化＋記号除去＋ `includes` を維持する。
- マイク非対応時は文字入力へ切り替える。
- S001のセリフと進行は変更しない。
