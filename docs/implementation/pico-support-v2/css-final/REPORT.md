# PICO-03 CSS限定修正

独立QA基準39d6b2666158848bb42ec16485c1624e2de3b357と期待値は変更していない。開始HEAD41177d197df76c458e72c01b800f9d4556e37802。

unified.cssのみ実装修正：Goal/Supportのline-heightを1.5へ。フォントサイズは維持。3行モードの上下paddingを6→2 reference px、row-gapを3→2 reference pxへ配分。108/140px外形・色・ボタン横一列を維持。overflow属性による隠蔽なし。状態管理、Judge、Save、Battle、Story、Graphic、Audio/Voiceは変更なし。

行高だけの初回修正は390pxで不足しCI46131530060で失敗したため、上記余白配分を追加した。最終ローカル128/128ケース成功。1280px Q10 Support3および再押下のGoal clientHeight/scrollHeight=29/29、Support=51/51。独立QAの37/39という不足条件を満たさない状態を解消。ローカルとLabのフォント環境差はあるため、Lab自身の再検証が必要。

measurements.jsonに4幅の実測、Q10-*.pngにStage画像、matrix/matrix.jsonに全128ケースを保存。既存回帰テストは無変更。独立QAへはPICO-03中心、PICO-01/02/04は回帰のみを依頼する。独立QA PASSまではRC採用・Production統合禁止。iPhone実機等はHOLD継続。
