from enum import StrEnum

from pydantic import BaseModel


class ToolTag(StrEnum):
    """
    Tags for categorizing tools in the MCP server.
    Including domain tools and utility tools.
    """

    STUB = "stub"
    VERIFICATION = "verification"
    ROUTINE_SERVICE = "routine-service"
    EXERCISE_SERVICE = "exercise-service"
    FITNESS_BFF = "fitness-bff"


class ServerConfig(BaseModel):
    """
    Configuration for the MCP server.
    """

    api_url: str
    wiremock_url: str


class Configuration(BaseModel):
    tags: list[ToolTag]
    server: ServerConfig
