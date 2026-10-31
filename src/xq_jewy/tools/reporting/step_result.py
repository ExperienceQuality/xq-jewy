from fastmcp.tools import tool

from xq_jewy.domain.enums.test_status import TestStatus
from xq_jewy.domain.models.test_step import TestStep
from xq_jewy.services.reporting_service import ReportingService

_service: ReportingService | None = None


def _reporting() -> ReportingService:
    global _service
    if _service is None:
        _service = ReportingService()
    return _service


@tool(tags={"reporting", "test-step"})
def report_step_result(
    step_id: str,
    test_id: str,
    name: str,
    status: str,
    detail: dict | None = None,
) -> dict:
    """Record the outcome of a single test step.

    Args:
        step_id: Unique step identifier.
        test_id: Parent test identifier.
        name: Human-readable step name.
        status: One of passed, failed, skipped, error.
        detail: Optional extra data.
    """
    step = TestStep(
        step_id=step_id,
        test_id=test_id,
        name=name,
        status=TestStatus(status),
        detail=detail or {},
    )
    return _reporting().report_step_result(step)


@tool(tags={"reporting", "test-step"})
def get_step_result(step_id: str) -> dict:
    """Retrieve a previously recorded step result.

    Args:
        step_id: Unique step identifier used in report_step_result.
    """
    return _reporting().get_step_result(step_id)
