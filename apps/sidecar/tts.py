"""Piper TTS example playback for Repeat-after-me (ticket #4).

Real Piper when the `piper` binary + voice model are installed; otherwise a
deterministic WAV stub (440Hz sine scaled by text length) so tests and
offline demos pass. The X-TTS-Engine header always says honestly which one
served the audio: `piper` or `stub`.
"""

import math
import shutil
import struct
import subprocess
import wave
from io import BytesIO

SAMPLE_RATE = 16000


def piper_available() -> bool:
    return shutil.which("piper") is not None


def stub_wav_bytes(text: str) -> bytes:
    """Deterministic 16kHz mono WAV: tone length scales with text length."""
    seconds = max(0.5, min(8.0, 0.25 * max(1, len(text.split()))))
    frames = int(SAMPLE_RATE * seconds)
    pcm = bytearray()
    for n in range(frames):
        sample = int(12000 * math.sin(2 * math.pi * 440 * n / SAMPLE_RATE))
        pcm += struct.pack("<h", sample)
    buf = BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(bytes(pcm))
    return buf.getvalue()


def synthesize(text: str) -> tuple[bytes, str]:
    """Return (wav_bytes, engine). Engine is `piper` or `stub`."""
    if piper_available():
        try:
            proc = subprocess.run(
                ["piper", "--output-raw"],
                input=text.encode("utf-8"),
                capture_output=True,
                timeout=30,
            )
            if proc.returncode == 0 and proc.stdout:
                raw = proc.stdout
                buf = BytesIO()
                with wave.open(buf, "wb") as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(SAMPLE_RATE)
                    wav.writeframes(raw)
                return buf.getvalue(), "piper"
        except (OSError, subprocess.SubprocessError):
            pass
    return stub_wav_bytes(text), "stub"
