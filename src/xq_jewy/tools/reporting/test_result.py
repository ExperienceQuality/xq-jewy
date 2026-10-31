from fastmcp.tools import tool

from xq_jewy.domain.enums.test_status import TestStatus
from xq_jewy.domain.models.test_result import TestResult
from xq_jewy.services.reporting_service import ReportingService

_service: ReportingService | None = None


def _reporting() -> ReportingService:
    global _service
    if _service is None:
        _service = ReportingService()
    return _service


@tool(tags={"reporting", "test-result"})
def report_test_result(
    test_id: str, name: str, status: str, detail: dict | None = None
) -> dict:
    """Record the outcome of a test.

    Args:
        test_id: Unique test identifier.
        name: Human-readable test name.
        status: One of passed, failed, skipped, error.
        detail: Optional extra data (durations, evidence, links).
    """
    result = TestResult(
        test_id=test_id,
        name=name,
        status=TestStatus(status),
        detail=detail or {},
    )
    return _reporting().report_test_result(result)


@tool(tags={"reporting", "test-result"})
def get_test_result(test_id: str) -> dict:
    """Retrieve a previously recorded test result.

    Args:
        test_id: Unique test identifier used in report_test_result.
    """
    return _reporting().get_test_result(test_id)
