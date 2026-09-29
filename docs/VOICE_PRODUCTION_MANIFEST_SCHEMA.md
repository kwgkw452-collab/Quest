# Voice Production Manifest schema案

制作管理用ManifestはRuntime Audio Databaseと分離する。
今回はVoice Asset／MP3を登録しない。

```json
{
  "voiceKey": "voice_c02_s001_003",
  "characterId": 2,
  "storyOrEventId": "s001",
  "sequence": 3,
  "text": "",
  "file": "audio/voice/c02_kong/voice_c02_s001_003_v1.mp3",
  "voiceProfile": "",
  "speedProfile": "",
  "ttsService": "",
  "ttsVoiceId": "",
  "version": 1,
  "licenseRef": null,
  "peak": null,
  "lufs": null,
  "truePeak": null,
  "status": "planned"
}
```

Runtimeへ渡す情報は原則として`file`、`category: VOICE`、`loop`、
`version`、`licenseRef`に限定する。台詞、生成サービス、採用履歴、
ラウドネス測定値は制作Manifest側で管理する。
