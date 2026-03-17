"""BaseAgent abstract base class for all AI Health Guide agents."""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ai_health_guide.clients.medgemma_client import MedGemmaClient
    from ai_health_guide.config import AppConfig
    from ai_health_guide.models import SessionState


class BaseAgent(ABC):
    """Abstract base class for all AI Health Guide agents.

    Each concrete agent handles one pipeline stage. It accepts the current
    `SessionState` (read-only) and returns a dict of fields to merge into the state.
    """

    stage: str  # Which pipeline stage this agent handles

    def __init__(self, medgemma: "MedGemmaClient", config: "AppConfig") -> None:
        self.medgemma = medgemma
        self.config   = config

    @abstractmethod
    async def execute(
        self,
        session: "SessionState",
        corrections: list[str] | None = None,
    ) -> dict:
        """Execute the agent's task and return a partial SessionState update.

        Args:
            session:     Current session state (read-only).
            corrections: Safety Guardian feedback to address (if re-running after rejection).

        Returns:
            Dictionary of SessionState fields to update.
        """
        ...

    def _format_history(self, session: "SessionState") -> list[dict]:
        """Convert session conversation history to a list of chat messages."""
        return [
            {
                "role":    "user" if m.role == "patient" else "assistant",
                "content": m.content,
            }
            for m in session.conversation_history
        ]

    def _system_message(self, prompt: str) -> dict:
        return {"role": "system", "content": prompt}
