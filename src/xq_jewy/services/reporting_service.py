from xq_jewy.domain.models.test_result import TestResult
from xq_jewy.domain.models.test_step import TestStep


class ReportingService:
    """Process-local result store.

    Swappable later for a persistent backend (file/DB) without tool changes.
    """

    _tests: dict[str, TestResult] = {}
    _steps: dict[str, TestStep] = {}

    def report_test_result(self, result: TestResult) -> dict:
        self._tests[result.test_id] = result
        return {"test_id": result.test_id, "recorded": True}

    def get_test_result(self, test_id: str) -> dict:
        result = self._tests.get(test_id)
        if result is None:
            return {"test_id": test_id, "found": False}
        return {"test_id": test_id, "found": True, "result": result.model_dump()}

    def report_step_result(self, step: TestStep) -> dict:
        self._steps[step.step_id] = step
        return {"step_id": step.step_id, "recorded": True}

    def get_step_result(self, step_id: str) -> dict:
        step = self._steps.get(step_id)
        if step is None:
            return {"step_id": step_id, "found": False}
        return {"step_id": step_id, "found": True, "result": step.model_dump()}
