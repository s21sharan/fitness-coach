"""Audio transcription utilities using OpenAI Whisper."""
from __future__ import annotations

import os
import tempfile
import urllib.request


def transcribe_audio(audio_path: str, model_name: str = "base.en") -> str:
    """Transcribe an audio file using OpenAI Whisper.

    Args:
        audio_path: Path to the audio file to transcribe.
        model_name: Whisper model name (default: "base.en").

    Returns:
        Transcribed text as a string.
    """
    import whisper

    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path)
    return result["text"]


def transcribe_and_cleanup(audio_path: str, model_name: str = "base.en") -> str:
    """Transcribe an audio file and delete it afterward.

    Args:
        audio_path: Path to the audio file.
        model_name: Whisper model name.

    Returns:
        Transcribed text.
    """
    try:
        text = transcribe_audio(audio_path, model_name=model_name)
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)
    return text


def download_and_transcribe(url: str, model_name: str = "base.en") -> str:
    """Download an audio file from a URL, transcribe it, and clean up.

    Args:
        url: URL of the audio file.
        model_name: Whisper model name.

    Returns:
        Transcribed text.
    """
    suffix = os.path.splitext(url.split("?")[0])[-1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name

    urllib.request.urlretrieve(url, tmp_path)
    return transcribe_and_cleanup(tmp_path, model_name=model_name)
