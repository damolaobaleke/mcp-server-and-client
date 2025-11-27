"""Data source interfaces."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional
from types import User, CreateUserDTO


@dataclass
class SearchResult:
    """Search result from a data source."""
    source: str
    title: str
    content: str
    relevance_score: float
    url: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class IDataSource(ABC):
    """Interface for searchable data sources."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Get the name of the data source."""
        pass
    
    @abstractmethod
    async def connect(self) -> None:
        """Connect to the data source."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the data source."""
        pass
    
    @abstractmethod
    async def search(self, query: str) -> list[SearchResult]:
        """Search the data source."""
        pass
    
    @abstractmethod
    def is_relevant_for(self, query: str) -> bool:
        """Determine if this data source is relevant for the query."""
        pass


class IUserDataSource(ABC):
    """Interface for user management data sources."""
    
    @abstractmethod
    async def connect(self) -> None:
        """Connect to the data source."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the data source."""
        pass
    
    @abstractmethod
    async def get_all_users(self) -> list[User]:
        """Get all users."""
        pass
    
    @abstractmethod
    async def get_user_by_id(self, user_id: int | str) -> Optional[User]:
        """Get a user by ID."""
        pass
    
    @abstractmethod
    async def create_user(self, user: CreateUserDTO) -> int | str:
        """Create a new user."""
        pass
    
    @abstractmethod
    async def update_user(self, user_id: int | str, user: dict[str, Any]) -> bool:
        """Update a user."""
        pass
    
    @abstractmethod
    async def delete_user(self, user_id: int | str) -> bool:
        """Delete a user."""
        pass
