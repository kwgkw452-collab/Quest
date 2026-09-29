# Engine 2.0 alpha4 チェック項目

1. index.htmlのscript順で `story-commands.js` と `story-compiler.js` が `story-registry.js` より前に読み込まれる。
2. S001.jsとcss/style.cssはalpha3から変更されていない。
3. StoryRegistry.register時にStoryCompiler.compileが一度だけ実行される。
4. 従来の `{ type: "..." }` stepがそのまま動く。
5. S000_TEMPLATE.jsでStoryCommands形式が利用できる。
6. オープニングからcamp終了までalpha3と同じ表示・台詞・音声認識になる。
