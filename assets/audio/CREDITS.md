# Audio assets

`impactBell_heavy_000.ogg`, `impactMetal_heavy_000.ogg`, and
`impactTin_medium_000.ogg` are from Kenney's Impact Sounds pack.

- Source: https://kenney.nl/assets/impact-sounds
- License: Creative Commons CC0
- Downloaded: 2026-09-08

The game loads these files opportunistically. If the files cannot be fetched
(including offline play), the WebAudio synthesis fallback remains active.

## BGM used by the six scene routes

These files are streamed by `game-audio.js`; they are not decoded into Web Audio buffers. No audio audition was possible in this environment.

- `reference/prologue_theme_cleyton_kauffman.ogg` — “Prologue Theme”, CleytonKauffman; title route. CC0. Source: https://opengameart.org/content/prologue-theme
- `bgm_war_theme_spring_spring.ogg` — “War Theme”, Spring Spring; 283.744 s, 44.1 kHz stereo Vorbis. Source: https://opengameart.org/content/war-theme
- `bgm_space_battle_mintodog.ogg` — “Space Battle”, MintoDog; 88.615 s, 44.1 kHz stereo Vorbis. Source: https://opengameart.org/content/space-battle
- `bgm_sci_fi_theme_spring_spring.ogg` — “Unfinished Sci-Fi Theme”, Spring Spring; 214.286 s, 48 kHz stereo Vorbis. Source: https://opengameart.org/content/unfinished-sci-fi-theme
- `bgm_victory_spring_spring.ogg` — “Victory! Victory! Victory!” (`snd_music_victorytheme.ogg`), Spring Spring; 88.511 s, 44.1 kHz stereo Vorbis. CC0. Source: https://opengameart.org/content/victory-victory-victory
- `bgm_defeat_no_hope_cleyton_kauffman.ogg` — “No Hope” contemporary version, CleytonKauffman; 13.102 s, 44.1 kHz stereo Vorbis. CC0. Source: https://opengameart.org/content/game-over-theme

License evidence: each source page displayed `CC0`; the pages identify the authors and downloadable files. Keep this file with the downloaded assets when redistributing the prototype. The short defeat track loops while its result screen remains open; this is a functional fallback and should be auditioned before release because a 13-second loop may become repetitive.

## Cannon and explosion effects used by the game

- `cannon_doomsday_laser_tad_short.wav` — “Doomsday Laser Cannon Sound Effect”, TAD; 3.500 s, 44.1 kHz stereo PCM. Source: https://opengameart.org/content/doomsday-laser-cannon-sound-effect. CC0.
- `explosion_mechanical_spring_spring.wav` — “Mechanical Explosion”, Spring Spring; 1.360 s, 96 kHz stereo PCM. Source: https://opengameart.org/content/mechanical-explosion. CC0; source page requests attribution to Spring Spring.
- `explosion_muffled_distant_nenadsimic.wav` — “Muffled Distant Explosion”, NenadSimic; 5.143 s, 44.1 kHz stereo PCM. Source: https://opengameart.org/content/muffled-distant-explosion. CC0.

All three were downloaded 2026-09-08 and checked with ffprobe. They were not auditioned in this environment.

## Physical weapon candidates

- `cannon_fire_thimras.ogg` — “Battle at sea”, Thimras; CC0. Source: https://opengameart.org/content/battle-at-sea (direct file `cannon_fire.ogg`). Downloaded 2026-09-08; ffprobe checked; not auditioned.
- `lmg_fire01_kuraiwolf.mp3` — “Light Machine Gun”, KuraiWolf; CC BY 4.0. Source: https://opengameart.org/content/light-machine-gun (direct file `lmg_fire01.mp3`). Attribution required: KuraiWolf. Downloaded 2026-09-08; ffprobe checked; not auditioned.

## Mecha movement candidate

- `mecha_dash_whoosh_sword_sfx.wav` — “Sword Swing”, DavidW; OGA-BY 4.0. Source: https://opengameart.org/content/sword-swing (direct file `sword_sfx.wav`). Attribution required: DavidW. 0.300 s, 48 kHz stereo WAV/PCM. Downloaded 2026-09-08; ffprobe checked; not auditioned in this environment.
