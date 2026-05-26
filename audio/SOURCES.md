# Audio sample library

All files in this directory are **CC0** ("no rights reserved"). They are
served via jsDelivr from this repo's `main` branch:

```
https://cdn.jsdelivr.net/gh/faded-penguin021/The-Borrowed-Hour-GPTL@main/audio/<category>/<name>.mp3
```

The `AmbienceEngine` in `index.html` lazy-fetches them; missing files
fail silently (warn-once in the console) and the engine falls through to
music-only output for that lane.

## Format requirements

- **Codec**: MP3, mono.
- **Bitrate**: 64 kbps.
- **Loudness target**: −18 LUFS (integrated) for loops; −15 LUFS short-term peak for one-shots.
- **Loops** (`space/`, `population/`): 12–15 seconds, seamlessly looping (no clicks at the loop point).
- **One-shots** (`events/`): 0.4–3 seconds, fully decayed at the end.
- **Filename**: exactly matches the enum value, e.g. `intimate.mp3`, `bell_toll.mp3`.

Total expected budget: ~35 files, ~2 MB on disk.

## Required files

### `space/` (9 files — looped room tone, no foreground events)

| File              | Description                                                |
|-------------------|------------------------------------------------------------|
| `intimate.mp3`    | Small sealed room — soft hiss, distant low rumble.         |
| `chamber.mp3`     | Medium room — gentle air handling, slight resonance.       |
| `hall.mp3`        | Large interior — long reverb tail, faint movement.         |
| `cavern.mp3`      | Huge resonant space — cathedral or cave reverb, very low.  |
| `street.mp3`      | Outdoor with hard surfaces — distant traffic, alley echo.  |
| `field.mp3`       | Outdoor open — wind across grass, very wide.               |
| `forest.mp3`      | Outdoor organic — leaves, far birdsong, soft wind.         |
| `vehicle.mp3`     | Confined moving — train/carriage rumble, mechanical hum.   |
| `void.mp3`        | Abstract/unreal — slow shimmer, no specific space.         |

### `population/` (8 files — overlays designed to mix under a space tone)

| File                  | Description                                                 |
|-----------------------|-------------------------------------------------------------|
| `solitary.mp3`        | Single breath / fabric movement, sparse.                    |
| `sparse_voices.mp3`   | A few unintelligible voices, distant.                       |
| `crowd.mp3`           | Many voices, bustle, no individual words audible.           |
| `machinery.mp3`       | Mechanical/industrial loop — engines, generators, looms.    |
| `nature.mp3`          | Birds + insects + flowing water, mixed.                     |
| `ceremony.mp3`        | Distant chant / procession / muted ritual sounds.           |
| `creature.mp3`        | Non-human animal presence — breath, low growl, hooves.      |
| `wild.mp3`            | Untamed elements — surf, storm wind, distant fire.          |

### `events/` (18 files — one-shots)

| File                    | Description                                       |
|-------------------------|---------------------------------------------------|
| `bell_toll.mp3`         | Single deep bell strike, long decay.              |
| `bell_distant.mp3`      | Distant smaller bell, with reverb.                |
| `clock_chime.mp3`       | Single brass chime tone.                          |
| `door_close.mp3`        | Heavy wooden door closing.                        |
| `door_creak.mp3`        | Old hinges opening slowly.                        |
| `footsteps_close.mp3`   | 2–3 footsteps on stone, foreground.               |
| `footsteps_recede.mp3`  | Footsteps walking away into reverb.               |
| `wind_gust.mp3`         | Single gust rising and falling.                   |
| `distant_thunder.mp3`   | Far thunder rumble.                               |
| `paper_rustle.mp3`      | Page turning or paper being unfolded.             |
| `chair_scrape.mp3`      | Wooden chair pushed back on a hard floor.         |
| `glass_set_down.mp3`    | Glass placed on a wooden table.                   |
| `coin_drop.mp3`         | Single coin landing on stone or metal.            |
| `crowd_hush.mp3`        | Many voices falling suddenly silent.              |
| `cough_distant.mp3`     | A short cough, off-mic.                           |
| `breath_held.mp3`       | Audible held inhale.                              |
| `metal_clang.mp3`       | Single metallic strike, mid decay.                |
| `whisper_close.mp3`     | A single unintelligible whispered word.           |

## Attribution log

Add one line per file as it is committed:

```
<file>  —  <source URL>  —  <CC0 attestation, e.g. "Freesound user X, CC0 dedication">
```
