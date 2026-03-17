"""OpenAI client for report generation (GPT-4o)."""

from openai import AsyncOpenAI

from ai_health_guide.config import AppConfig


class OpenAIReportClient:
    """Async wrapper around the OpenAI chat completions API for report generation."""

    def __init__(self, config: AppConfig) -> None:
        self._client = AsyncOpenAI(api_key=config.openai_api_key)
        self._model = config.openai_report_model

    async def generate(self, messages: list[dict]) -> str:
        """Send messages to OpenAI and return the assistant's response text."""
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            temperature=0.3,
            max_tokens=4096,
        )
        return response.choices[0].message.content or ""
