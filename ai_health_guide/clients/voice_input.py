"""OpenAI Whisper speech-to-text handler."""

from typing import Optional
from openai import AsyncOpenAI


class VoiceInputHandler:
    """Transcribes patient voice input using OpenAI Whisper."""

    def __init__(self, client: Optional[AsyncOpenAI], whisper_model: str) -> None:
        self._client = client
        self._model  = whisper_model

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.webm",
        language_hint: Optional[str] = None,
    ) -> str:
        """Transcribe patient audio to text.

        Args:
            audio_bytes:   Raw audio bytes (webm, mp4, mp3, wav supported).
            filename:      Filename with correct extension for MIME detection.
            language_hint: Optional ISO 639-1 language code to improve accuracy.

        Returns:
            Transcribed text in the patient's language.
        """
        # Build a file-like tuple accepted by the OpenAI client
        audio_file = (filename, audio_bytes)

        kwargs: dict = {"model": self._model, "file": audio_file}
        if language_hint:
            kwargs["language"] = language_hint

        transcript = await self._client.audio.transcriptions.create(**kwargs)
        return transcript.text
