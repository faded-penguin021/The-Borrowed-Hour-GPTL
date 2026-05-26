#!/usr/bin/env bash
# Generate placeholder ambience samples via ffmpeg synthesis.
#
# These are CC0-by-author (generated procedurally from sine waves and
# coloured noise, no copyrightable source material). They are obviously
# synthetic and intended to be overwritten with real CC0 field recordings
# when those are sourced. Re-running this script is idempotent — it
# overwrites every file in place.
#
# Output format: mono 64 kbps mp3 at 44.1 kHz. Loops are ~12s; one-shots
# are 0.4–3s. Loudness is not LUFS-normalised (placeholder fidelity).

set -euo pipefail
cd "$(dirname "$0")"

mkdir -p space population events

# Common encode flags.
ENC=(-c:a libmp3lame -b:a 64k -ac 1 -ar 44100 -y -hide_banner -loglevel error)

LOOP=12

# Crossfade-loop helper: take a single noise generator stream, generate
# slightly longer than needed, and apply a short crossfade at the join
# point so AudioBufferSourceNode loop=true doesn't click.
# (For pure stationary noise this matters less; for tonal content it matters.)

gen() {
  local out="$1"; shift
  echo "  -> $out"
  ffmpeg "$@" "${ENC[@]}" "$out"
}

# ──────────────────────────────────────────────────────────────────────
# SPACE LOOPS — acoustic rooms
# ──────────────────────────────────────────────────────────────────────
echo "[space]"

gen space/intimate.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=brown:amplitude=0.06" \
  -af "lowpass=f=400,volume=0.35"

gen space/chamber.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=brown:amplitude=0.10" \
  -af "lowpass=f=700,volume=0.40"

gen space/hall.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.10" \
  -af "lowpass=f=900,highpass=f=80,volume=0.40"

gen space/cavern.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=brown:amplitude=0.18" \
  -f lavfi -i "sine=frequency=42:duration=${LOOP}" \
  -filter_complex "[0:a]lowpass=f=300[a];[1:a]volume=0.10[b];[a][b]amix=inputs=2:duration=shortest,volume=0.55"

gen space/street.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.15" \
  -af "bandpass=f=550:w=500,volume=0.45"

gen space/field.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.22" \
  -af "highpass=f=180,tremolo=f=0.3:d=0.35,volume=0.40"

gen space/forest.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.14" \
  -af "highpass=f=500,bandpass=f=2500:w=2000,tremolo=f=0.6:d=0.25,volume=0.40"

gen space/vehicle.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=brown:amplitude=0.22" \
  -f lavfi -i "sine=frequency=58:duration=${LOOP}" \
  -filter_complex "[0:a]lowpass=f=280[a];[1:a]volume=0.12[b];[a][b]amix=inputs=2:duration=shortest,vibrato=f=4:d=0.05,volume=0.55"

gen space/void.mp3 \
  -f lavfi -i "sine=frequency=180:duration=${LOOP}" \
  -f lavfi -i "sine=frequency=181.5:duration=${LOOP}" \
  -f lavfi -i "sine=frequency=270:duration=${LOOP}" \
  -filter_complex "[0:a]volume=0.10[a];[1:a]volume=0.10[b];[2:a]volume=0.06[c];[a][b][c]amix=inputs=3:duration=shortest,lowpass=f=700,tremolo=f=0.15:d=0.4"

# ──────────────────────────────────────────────────────────────────────
# POPULATION LOOPS — what fills the space
# ──────────────────────────────────────────────────────────────────────
echo "[population]"

gen population/solitary.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=brown:amplitude=0.04" \
  -af "lowpass=f=350,volume=0.35,tremolo=f=0.2:d=0.6"

gen population/sparse_voices.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.10" \
  -af "bandpass=f=900:w=700,tremolo=f=0.7:d=0.5,volume=0.32"

gen population/crowd.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.18" \
  -af "bandpass=f=600:w=900,tremolo=f=1.8:d=0.55,volume=0.40"

gen population/machinery.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=brown:amplitude=0.16" \
  -f lavfi -i "sine=frequency=92:duration=${LOOP}" \
  -filter_complex "[0:a]lowpass=f=450[a];[1:a]volume=0.10[b];[a][b]amix=inputs=2:duration=shortest,tremolo=f=4.5:d=0.30,volume=0.45"

gen population/nature.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.10" \
  -af "bandpass=f=3500:w=2500,tremolo=f=0.45:d=0.4,volume=0.32"

gen population/ceremony.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.12" \
  -f lavfi -i "sine=frequency=130:duration=${LOOP}" \
  -filter_complex "[0:a]bandpass=f=500:w=350[a];[1:a]volume=0.05[b];[a][b]amix=inputs=2:duration=shortest,tremolo=f=0.35:d=0.5,volume=0.38"

gen population/creature.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=brown:amplitude=0.12" \
  -f lavfi -i "sine=frequency=72:duration=${LOOP}" \
  -filter_complex "[0:a]lowpass=f=220[a];[1:a]volume=0.10[b];[a][b]amix=inputs=2:duration=shortest,vibrato=f=2.5:d=0.4,volume=0.42"

gen population/wild.mp3 \
  -f lavfi -i "anoisesrc=duration=${LOOP}:color=pink:amplitude=0.22" \
  -af "tremolo=f=0.7:d=0.6,highpass=f=120,volume=0.50"

# ──────────────────────────────────────────────────────────────────────
# EVENT ONE-SHOTS
# ──────────────────────────────────────────────────────────────────────
echo "[events]"

# Bells: layered sines with exponential decay applied via afade.
gen events/bell_toll.mp3 \
  -f lavfi -i "sine=frequency=110:duration=2.6" \
  -f lavfi -i "sine=frequency=220:duration=2.6" \
  -f lavfi -i "sine=frequency=330:duration=2.6" \
  -filter_complex "[0:a]volume=0.50[a];[1:a]volume=0.30[b];[2:a]volume=0.12[c];[a][b][c]amix=inputs=3:duration=shortest,afade=t=in:d=0.005,afade=t=out:st=0.05:d=2.5"

gen events/bell_distant.mp3 \
  -f lavfi -i "sine=frequency=220:duration=1.8" \
  -f lavfi -i "sine=frequency=440:duration=1.8" \
  -filter_complex "[0:a]volume=0.30[a];[1:a]volume=0.15[b];[a][b]amix=inputs=2:duration=shortest,afade=t=in:d=0.005,afade=t=out:st=0.05:d=1.7,lowpass=f=1200"

gen events/clock_chime.mp3 \
  -f lavfi -i "sine=frequency=523:duration=1.3" \
  -f lavfi -i "sine=frequency=783:duration=1.3" \
  -filter_complex "[0:a]volume=0.40[a];[1:a]volume=0.20[b];[a][b]amix=inputs=2:duration=shortest,afade=t=in:d=0.005,afade=t=out:st=0.10:d=1.15"

# Door close: low thud (brown burst + 70Hz sine, fast decay).
gen events/door_close.mp3 \
  -f lavfi -i "anoisesrc=duration=0.45:color=brown:amplitude=0.7" \
  -f lavfi -i "sine=frequency=70:duration=0.45" \
  -filter_complex "[0:a]lowpass=f=200,volume=0.7[a];[1:a]volume=0.5[b];[a][b]amix=inputs=2:duration=shortest,afade=t=out:st=0.04:d=0.4"

# Door creak: filtered noise with envelope.
gen events/door_creak.mp3 \
  -f lavfi -i "anoisesrc=duration=1.6:color=pink:amplitude=0.35" \
  -af "bandpass=f=650:w=300,vibrato=f=8:d=0.4,volume=0.45,afade=t=in:d=0.1,afade=t=out:st=0.4:d=1.2"

# Footsteps: two thuds via amix with a delay on the second.
gen events/footsteps_close.mp3 \
  -f lavfi -i "anoisesrc=duration=0.18:color=brown:amplitude=0.7" \
  -f lavfi -i "anoisesrc=duration=0.18:color=brown:amplitude=0.7" \
  -filter_complex "[0:a]lowpass=f=260,afade=t=out:st=0.02:d=0.16,apad=pad_dur=1.0[t1];[1:a]lowpass=f=260,afade=t=out:st=0.02:d=0.16,adelay=420|420,apad=pad_dur=1.0[t2];[t1][t2]amix=inputs=2,volume=0.6" \
  -t 1.0

gen events/footsteps_recede.mp3 \
  -f lavfi -i "anoisesrc=duration=0.16:color=brown:amplitude=0.6" \
  -f lavfi -i "anoisesrc=duration=0.16:color=brown:amplitude=0.6" \
  -f lavfi -i "anoisesrc=duration=0.16:color=brown:amplitude=0.6" \
  -filter_complex "[0:a]lowpass=f=240,afade=t=out:st=0.02:d=0.14,apad=pad_dur=1.6[t1];[1:a]lowpass=f=240,afade=t=out:st=0.02:d=0.14,volume=0.6,adelay=400|400,apad=pad_dur=1.6[t2];[2:a]lowpass=f=240,afade=t=out:st=0.02:d=0.14,volume=0.3,adelay=800|800,apad=pad_dur=1.6[t3];[t1][t2][t3]amix=inputs=3,volume=0.6" \
  -t 1.6

# Wind gust: rising/falling pink noise.
gen events/wind_gust.mp3 \
  -f lavfi -i "anoisesrc=duration=1.8:color=pink:amplitude=0.5" \
  -af "highpass=f=250,bandpass=f=700:w=600,afade=t=in:d=0.5,afade=t=out:st=1.0:d=0.8,volume=0.55"

# Distant thunder: low rumble with long decay.
gen events/distant_thunder.mp3 \
  -f lavfi -i "anoisesrc=duration=2.8:color=brown:amplitude=0.5" \
  -f lavfi -i "sine=frequency=45:duration=2.8" \
  -filter_complex "[0:a]lowpass=f=180,volume=0.7[a];[1:a]volume=0.15[b];[a][b]amix=inputs=2:duration=shortest,afade=t=in:d=0.3,afade=t=out:st=1.6:d=1.2"

# Paper rustle: short high-pass noise burst.
gen events/paper_rustle.mp3 \
  -f lavfi -i "anoisesrc=duration=0.55:color=pink:amplitude=0.5" \
  -af "highpass=f=2000,bandpass=f=4500:w=3000,tremolo=f=18:d=0.6,afade=t=in:d=0.02,afade=t=out:st=0.20:d=0.30,volume=0.40"

# Chair scrape: short low filtered sweep.
gen events/chair_scrape.mp3 \
  -f lavfi -i "anoisesrc=duration=0.7:color=brown:amplitude=0.55" \
  -af "bandpass=f=350:w=200,vibrato=f=12:d=0.5,afade=t=in:d=0.02,afade=t=out:st=0.3:d=0.4,volume=0.50"

# Glass set down: sharp transient + brief high tone.
gen events/glass_set_down.mp3 \
  -f lavfi -i "anoisesrc=duration=0.10:color=pink:amplitude=0.8" \
  -f lavfi -i "sine=frequency=1600:duration=0.50" \
  -filter_complex "[0:a]bandpass=f=1500:w=1000,afade=t=out:st=0.02:d=0.08,apad=pad_dur=0.5[h];[1:a]volume=0.18,afade=t=in:d=0.005,afade=t=out:st=0.05:d=0.45[t];[h][t]amix=inputs=2,volume=0.55" \
  -t 0.55

# Coin drop: metallic ping (high sine with ring).
gen events/coin_drop.mp3 \
  -f lavfi -i "sine=frequency=2400:duration=0.6" \
  -f lavfi -i "sine=frequency=3600:duration=0.6" \
  -filter_complex "[0:a]volume=0.35[a];[1:a]volume=0.20[b];[a][b]amix=inputs=2:duration=shortest,afade=t=in:d=0.002,afade=t=out:st=0.05:d=0.55,bandpass=f=2800:w=1500"

# Crowd hush: pink noise with sudden envelope drop.
gen events/crowd_hush.mp3 \
  -f lavfi -i "anoisesrc=duration=1.2:color=pink:amplitude=0.25" \
  -af "bandpass=f=600:w=900,tremolo=f=2:d=0.5,afade=t=in:d=0.05,afade=t=out:st=0.4:d=0.7,volume=0.45"

# Distant cough: short bandpass noise burst.
gen events/cough_distant.mp3 \
  -f lavfi -i "anoisesrc=duration=0.35:color=pink:amplitude=0.45" \
  -af "bandpass=f=900:w=500,afade=t=in:d=0.02,afade=t=out:st=0.10:d=0.22,volume=0.35"

# Held breath: very quiet noise envelope.
gen events/breath_held.mp3 \
  -f lavfi -i "anoisesrc=duration=1.5:color=pink:amplitude=0.20" \
  -af "highpass=f=300,bandpass=f=800:w=400,afade=t=in:d=0.4,afade=t=out:st=0.9:d=0.6,volume=0.30"

# Metal clang: struck metallic tone.
gen events/metal_clang.mp3 \
  -f lavfi -i "sine=frequency=440:duration=1.2" \
  -f lavfi -i "sine=frequency=659:duration=1.2" \
  -f lavfi -i "sine=frequency=880:duration=1.2" \
  -filter_complex "[0:a]volume=0.30[a];[1:a]volume=0.25[b];[2:a]volume=0.15[c];[a][b][c]amix=inputs=3:duration=shortest,afade=t=in:d=0.002,afade=t=out:st=0.05:d=1.1"

# Whisper close: bandpass-filtered noise resembling speech sibilants.
gen events/whisper_close.mp3 \
  -f lavfi -i "anoisesrc=duration=1.0:color=pink:amplitude=0.35" \
  -af "bandpass=f=2500:w=1500,tremolo=f=14:d=0.5,afade=t=in:d=0.05,afade=t=out:st=0.7:d=0.3,volume=0.32"

echo
echo "Done. Output sizes:"
du -sh space population events
ls -1 space population events | wc -l
