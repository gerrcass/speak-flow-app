# Speak Flow Practice

Desktop app for practicing spoken English with local transcription and pronunciation feedback, no paid APIs.

## Language

**Speaking**:
General ability to produce spoken English in a practice session.
_Avoid_: Talking, speech (as skill name)

**Pronunciation**:
Accuracy of individual sounds, stress and intonation against a Reference.
_Avoid_: Accent, enunciation

**Fluency**:
Smoothness of delivery measured via WPM, pause ratio and filler rate, independent of accent.
_Avoid_: Speed, fluidity

**Repeat-after-me**:
Format where the app plays a Reference and the learner repeats it verbatim.
_Avoid_: Listen-and-repeat, repeat sentence

**Read-Aloud**:
Format where the learner reads a visible Reference text out loud.
_Avoid_: Reading, read-out-loud

**Free-talk**:
Format where the learner speaks 30-90s from a Prompt with no exact Reference.
_Avoid_: Free talk, freetalk, conversation

**Prompt**:
Short topic or cue-card that triggers a Free-talk Attempt.
_Avoid_: Topic, question

**Reference**:
Exact expected text for Repeat-after-me and Read-Aloud.
_Avoid_: Target, original, expected sentence

**Transcript**:
What the local STT actually heard from the learner's audio.
_Avoid_: Transcription, recognized text

**Attempt**:
One recorded try at a Prompt or Reference, with audio + Transcript + scores.
_Avoid_: Try, recording, submission

**Pronunciation Score**:
Word-level proxy `100 - WER` of Transcript vs Reference, plus failed-word list.
_Avoid_: Pronunciation mark, accuracy score

**Fluency Stats**:
WPM, pause ratio and filler rate computed from audio + Transcript via VAD.
_Avoid_: Fluency score, speed stats

**Content Pack**:
Curated local JSON of References and Prompts tagged by focus (th, ed, stress, level).
_Avoid_: Pack, dataset, lesson

**Drill**:
Repetition of a failed Reference scheduled via spaced repetition.
_Avoid_: Exercise, practice
