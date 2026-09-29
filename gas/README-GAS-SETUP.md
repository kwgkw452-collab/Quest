# Google Spreadsheet Candidate Store setup

必要な操作は4つです。

1. Google Spreadsheetを1つ作り、拡張機能からApps Scriptを開きます。
2. `Code.gs`の内容を貼り付け、`setupRecognitionCandidatesSheet`を1回実行します。
3. 「デプロイ → 新しいデプロイ → ウェブアプリ」で、実行ユーザーを自分、アクセス権を利用環境に合わせて設定し、デプロイします。
4. 発行された`/exec` URLを`dev/central-candidate-store-config.js`の`gasWebAppUrl`へ貼り、`provider`を`"gas"`へ変更します。

Sheet名は`RecognitionCandidates`です。Web App URLが空の間はlocalhost用Storeが選択され、ゲーム処理は止まりません。

ブラウザからのPOSTは、GASでpreflight問題を起こしにくい`text/plain` JSONを使います。Candidate以外の氏名、ID、メール、音声等は送信しません。
