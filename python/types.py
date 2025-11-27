"""Type definitions for the MCP server."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class User:
    """User data model."""
    id: int | str
    name: str
    email: str
    address: str
    phone: str


@dataclass
class CreateUserDTO:
    """Data transfer object for creating a user."""
    name: str
    email: str
    address: str
    phone: str
