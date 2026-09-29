# Voice Production Database V1.1

## 責務

Production Databaseは、DialogueをどのVoice、Model、演技、速度、Generation設定、Versionで音声化したかを管理する制作・再生成・履歴管理の正本である。

Story原文はDialogue内容の正本、Runtime Audio Databaseはゲーム実行時の再生情報だけを持つ。本DatabaseのProvider、Voice ID、Model、Audio Tags、Generation設定、License確認、履歴をRuntimeへ持ち込まない。

V1.1ではElevenLabsを正式Providerとして12件を`planned`登録する。Voice MP3生成、Runtime Voice Asset登録、Storyへの`voiceKey`接続は行わない。

## 分割構造

- `voice-production-index.json`: entry file、使用済みvoiceKey、tombstoneの索引
- `entries/*.json`: Story/Event単位のProduction entry
- `character-voice-profiles.json`: CharacterとElevenLabs Voiceの正式Mapping
- `speed-profiles.json`: Character別の速度検証状態
- `licenses/elevenlabs-license-record.json`: 利用条件の確認記録

## voiceKeyとVersion

- 形式は`voice_cXX_<story/event>_NNN`
- Runtime Keyにversionを含めない
- MP3予定パスは`<voiceKey>_v<version>.mp3`
- Voice、Model、Speed、Audio Tags、Generation設定変更時はvoiceKeyを維持してversionを上げる
- Story本文変更は`dialogueHash`で検知し、自動上書きしない
- 旧生成条件と旧Runtime fileは`history`へ保存する
- 使用済みまたは削除済みvoiceKeyと欠番は再利用しない

## DialogueとGeneration

- `dialogueText`: 現在のStory原文
- `dialogueHash`: UTF-8の`dialogueText`だけをSHA-256化
- `audioTags`: 人間が承認した演技指定。空配列を正式許容
- `deliveryInstructions`: 任意の制作指示
- `generationText`: 実際にProviderへ送った文字列。生成前は`null`
- `generationSettings`: 確認済みAPI parameterだけを保存。V1.1開始時は空Object

Audio Tags、Voice、Model、Speed、Generation設定、Versionを`dialogueHash`へ含めない。Story原文へAudio Tagsを書き込まない。Enhance結果を自動採用しない。

## ModelとSpeed

Auditionで使用した表示名として`modelLabel: "Eleven v3"`を保持する。API正式Model IDは未確認のため`modelId: null`とする。

全Characterへ一律速度を適用しない。Character別Speed Profileは`testing`、`speed: null`から開始し、Audition方針だけをnotesへ保存する。未確認の速度値やAPI parameter名をGeneration設定として登録しない。

## License

ElevenLabsの契約、商用利用、Attribution、Voice Library利用条件は未確認として管理する。確認完了前に許諾済みと推測しない。

## Pico Support

Pico Supportは日本語テキストのみであり、Voice化対象およびProduction entryに含めない。
