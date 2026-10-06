# Practice Formats Roadmap

Future-facing catalog of speaking practice formats. MVP is Repeat-after-me + Read-Aloud + Free-talk. Everything else is v2/v3. Offline, solo, no paid APIs.

## MVP (v1) — solo-speaking

### F1 Repeat-after-me
Listen 3-9s Reference (TTS Piper), repeat verbatim in ~15s. Score = Pronunciation Score (`100-WER`) + failed words in red + Reintentar 1-tap.

### F2 Read-Aloud
Read visible Reference (≤60 words) in ~40s. Same scoring as F1, no memory load, low anxiety starter.

### F3 Free-talk with Prompt
Cue-card Prompt + timer 45/60/90s, no Reference. Soft rubric only: Fluency Stats (WPM target 80-120, pause_ratio <25%, fillers <3/min) + keyword recall + TTR vocab. No hard grade.

Scoring thresholds (MVP intermediate, with disclaimer "emulación calibrada, no certificador"):
- >85% verde, 70-85 amarillo, <70 rojo
- Phoneme proxy via CMUdict / espeak-ng mapping for top failed phonemes + TTS example

Content: `Content Pack` JSON local — `phrases_100.json` (3 levels, tags th/ed/stress) + `prompts_30.json`. Plus manual import (paste text) day 1, plus AI generation via local inference (Ollama / llama.cpp small model, offline) for new References/Prompts on demand.

Persistence (SQLite from day 1):
`attempts(id, format, prompt_id, transcript, wpm, pause_ratio, wer, date)` + `srs_cards(phrase_id, next_due, ease)` even before v2 UI uses it.

Session rule: <10min, 1 skill, feedback <2s, 1-tap retry. 1 Attempt/day = streak.

## v2 Lúdica — jugable

Goal: 5-min daily habit.

1. **Daily Challenge**: 1 Repeat + 1 Read-Aloud + 1 Picture = cofre si 3/3.
2. **XP + Streak**: `XP = base + accuracy bonus + no-pause bonus`. Solo-league vs own ghost (last week). Streak Freeze 1x/semana.
3. **Badges**: 7-day streak, filler-free 60s, minimal-pair master b/v, early bird.
4. **Spaced repetition Drills**: WER>30% or word failed 2x → `srs_cards` SM-2 (1d,3d,7d). Killer-feature vs generic apps.
5. **New cheap formats**:
   - F4 Minimal Pairs ABX (ship/sheep, bit/beat, full/fool, very/berry, thin/sin) — 10 rounds, discrimination %; <70% retrain ear first. High value for Spanish L1.
   - F6 Picture Description (20 local imgs + template What I see / In foreground / It suggests...) — bridge F2→F3.
   - F9 Q&A Interview as F3 skin (5Qs, 45-60s each).

All JSON-local + 1 table, zero API.

## v3 Avanzada

- F5 Shadowing: phrase-by-phrase player 0.75x→1.1x, selective/blind modes, same clip 3 days. Measures lag + completion.
- F7 Role-play branching offline: YAML nodes `prompt → options → next` + keyword slot-check, no LLM needed. Scripted v2 → branching v3.
- F8 Retell/Summarize (PTE/TOEFL style): 60s listen, 40s retell, keyword coverage scoring.
- Real prosody offline: pitch tracking (F0 variance, energy stress) + VAD pauses, mapped to CEFR A1-C1 bands locally.
- Importable packs: `pack.zip` (texts/images).

## What we deliberately don't clone

F10 ELSA-like phoneme-perfect feedback needs proprietary accent models. Offline we approximate (WER + CMUdict proxy + tú-vs-TTS re-listen + targeted minimal drill). That delivers ~80% perceived value without promising 95% phoneme accuracy.

## Ticket #4 crumb
Repeat-after-me + Read-Aloud scored loop ships bands pass >85 / warn 70-85 / fail <70 on Pronunciation Score (100-WER) with disclaimer "emulacion calibrada, no certificador"; scoreAttempt demands AttemptTranscribed, TTS example is Piper-or-stub via honest X-TTS-Engine header.

## Ticket #5 crumb
Free-talk loop ships cue-card Prompts + 45/60/90s timer with auto-stop, TS-only soft rubric (keyword recall + TTR + CEFR hints, no grade), and node:sqlite attempts/srs_cards tables in userData via main-process IPC (wer null for free-talk); sidecar untouched.
