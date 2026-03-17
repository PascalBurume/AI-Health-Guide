"""OpenAI TTS text-to-speech handler."""

from openai import AsyncOpenAI
from typing import AsyncIterator, Optional


class VoiceOutputHandler:
    """Converts patient report text to speech using OpenAI TTS."""

    def __init__(self, client: Optional[AsyncOpenAI], tts_model: str, tts_voice: str) -> None:
        self._client = client
        self._model  = tts_model
        self._voice  = tts_voice

    async def synthesize(self, text: str) -> bytes:
        """Convert text to speech and return the full MP3 audio bytes.

        Args:
            text: The patient report text to read aloud.

        Returns:
            Audio bytes in MP3 format.
        """
        response = await self._client.audio.speech.create(
            model=self._model,
            voice=self._voice,
            input=text,
        )
        return response.content

    async def synthesize_stream(self, text: str) -> AsyncIterator[bytes]:
        """Stream TTS audio chunks for progressive playback."""
        async with self._client.audio.speech.with_streaming_response.create(
            model=self._model,
            voice=self._voice,
            input=text,
        ) as response:
            async for chunk in response.iter_bytes(chunk_size=4096):
                yield chunk
