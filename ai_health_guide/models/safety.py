from datetime import datetime
from pydantic import BaseModel, Field


class SafetyCheckResult(BaseModel):
    stage:             str
    approved:          bool
    issues:            list[str] = []
    corrective_action: str       = ""
    timestamp:         datetime  = Field(default_factory=datetime.utcnow)
