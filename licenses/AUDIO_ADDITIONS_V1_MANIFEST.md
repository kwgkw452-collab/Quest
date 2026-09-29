# Eigo DE Quest Audio Additions V1 Manifest

## Prepared assets

| Formal file | Purpose | Source title | Creator | Source / original file | Duration | Editing |
|---|---|---|---|---|---:|---|
| `ambient_morning_garden_v1.mp3` | S001 morning / Morning Routine atmosphere | Garden Ambience | Soul Serenity Sounds | Pixabay / `soul_serenity_sounds-garden-ambience-236744.mp3` | 126.384 sec | None |
| `bgm_future_city_pixel_v1.mp3` | Future City scene music | Video Game Pixel Chiptune Music | Alex Morgan | Pixabay / `alex-morgan-video-game-pixel-chiptune-music-583271.mp3` | 146.880 sec | None |
| `se_monster_defeat_explosion_v1.mp3` | m001 Fruit Monster explosion / defeat | Bomb explosion (Close) | Cartoon Music | Pixabay / `cartoon_music-bomb-explosion-close-517331.mp3` | 3.336 sec | None |

## Intended initial playback levels

- Morning ambience: 0.10–0.14
- Future City music: 0.08–0.12
- m001 explosion: 0.40–0.50

## Playback notes

- Morning ambience should start in S001 morning scenes and in MORNING_001 when the bright morning scene appears.
- Future City music should be scene-limited and must stop before speech recognition via the existing `AudioManager.stopAll()` path.
- m001 explosion should play with the final explosion graphic instead of `battlePurify`.
- Do not use these files as substitutes in unrelated scenes.

## Source

All three assets were supplied by the user after downloading from Pixabay. Preserve the original source metadata and confirm current Pixabay license requirements before public distribution.
