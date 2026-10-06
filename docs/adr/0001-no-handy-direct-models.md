# 0001 Use direct local models, no Handy dependency

Handy is a Tauri dictation app with no local API for other apps to call; integrating via its model folder or History DB would break on every update. We run the same weights directly (`faster-whisper` + `sherpa-onnx` Parakeet, CPU int8 offline) so transcription stays local, free and stable.
