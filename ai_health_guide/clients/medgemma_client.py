"""MedGemma client — communicates with a local Ollama instance."""

import httpx

from ai_health_guide.config import AppConfig


class MedGemmaClient:
    """Async HTTP client for the Ollama /api/chat endpoint."""

    def __init__(self, config: AppConfig) -> None:
        self._base_url = config.medgemma_ollama_base_url.rstrip("/")
        self._model = config.medgemma_model_name
        self._max_tokens = config.medgemma_max_tokens
        self._temperature = config.medgemma_temperature
        self._client = httpx.AsyncClient(timeout=120.0)

    async def generate(
        self,
        messages: list[dict],
        image_b64: str | None = None,
    ) -> str:
        """Send a chat completion request to Ollama and return the assistant text.

        Args:
            messages:  List of {role, content} dicts.
            image_b64: Optional base64 image string for multimodal prompts.

        Returns:
            The assistant's response text.
        """
        ollama_messages = []
        for msg in messages:
            entry: dict = {"role": msg["role"], "content": msg["content"]}
            ollama_messages.append(entry)

        # Attach image to the last user message if provided
        if image_b64 and ollama_messages:
            ollama_messages[-1]["images"] = [image_b64]

        payload = {
            "model": self._model,
            "messages": ollama_messages,
            "stream": False,
            "options": {
                "num_predict": self._max_tokens,
                "temperature": self._temperature,
            },
        }

        resp = await self._client.post(f"{self._base_url}/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"]

    async def is_available(self) -> bool:
        """Check if the Ollama model is loaded and responding."""
        try:
            resp = await self._client.post(
                f"{self._base_url}/api/show",
                json={"name": self._model},
            )
            return resp.status_code == 200
        except Exception:
            return False
