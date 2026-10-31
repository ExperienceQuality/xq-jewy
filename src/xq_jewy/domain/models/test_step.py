from pydantic import BaseModel, Field

from xq_jewy.domain.enums.test_status import TestStatus


class TestStep(BaseModel):
    step_id: str
    test_id: str
    name: str
    status: TestStatus
    detail: dict = Field(default_factory=dict)
