from pydantic import BaseModel, Field


class AssertionResult(BaseModel):
    check: str
    passed: bool
    expected: object = None
    actual: object = None
    detail: dict = Field(default_factory=dict)
