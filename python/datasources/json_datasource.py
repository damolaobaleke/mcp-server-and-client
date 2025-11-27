"""JSON file data source implementation."""

import json
import aiofiles
from pathlib import Path
from typing import Optional
from ..types import User, CreateUserDTO
from .interfaces import IUserDataSource


class JSONDataSource(IUserDataSource):
    """JSON file data source for user management."""
    
    def __init__(self, file_path: str):
        """Initialize JSON data source."""
        self.file_path = Path(file_path)
    
    async def connect(self) -> None:
        """Ensure file exists."""
        if not self.file_path.exists():
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(self.file_path, 'w') as f:
                await f.write('[]')
        print("JSON DataSource ready")
    
    async def disconnect(self) -> None:
        """Disconnect (no-op for JSON)."""
        print("JSON DataSource disconnected")
    
    async def _read_users(self) -> list[User]:
        """Read users from file."""
        async with aiofiles.open(self.file_path, 'r') as f:
            data = await f.read()
            users_data = json.loads(data)
            return [User(**u) for u in users_data]
    
    async def _write_users(self, users: list[User]) -> None:
        """Write users to file."""
        users_data = [
            {
                'id': u.id,
                'name': u.name,
                'email': u.email,
                'address': u.address,
                'phone': u.phone
            }
            for u in users
        ]
        async with aiofiles.open(self.file_path, 'w') as f:
            await f.write(json.dumps(users_data, indent=2))
    
    async def get_all_users(self) -> list[User]:
        """Get all users."""
        return await self._read_users()
    
    async def get_user_by_id(self, user_id: int | str) -> Optional[User]:
        """Get a user by ID."""
        users = await self._read_users()
        for user in users:
            if str(user.id) == str(user_id):
                return user
        return None
    
    async def create_user(self, user: CreateUserDTO) -> int:
        """Create a new user."""
        users = await self._read_users()
        new_id = max([int(u.id) for u in users], default=0) + 1
        
        new_user = User(
            id=new_id,
            name=user.name,
            email=user.email,
            address=user.address,
            phone=user.phone
        )
        users.append(new_user)
        await self._write_users(users)
        
        return new_id
    
    async def update_user(self, user_id: int | str, user_data: dict) -> bool:
        """Update a user."""
        users = await self._read_users()
        
        for i, user in enumerate(users):
            if str(user.id) == str(user_id):
                # Update fields
                if 'name' in user_data:
                    users[i].name = user_data['name']
                if 'email' in user_data:
                    users[i].email = user_data['email']
                if 'address' in user_data:
                    users[i].address = user_data['address']
                if 'phone' in user_data:
                    users[i].phone = user_data['phone']
                
                await self._write_users(users)
                return True
        
        return False
    
    async def delete_user(self, user_id: int | str) -> bool:
        """Delete a user."""
        users = await self._read_users()
        original_length = len(users)
        
        users = [u for u in users if str(u.id) != str(user_id)]
        
        if len(users) < original_length:
            await self._write_users(users)
            return True
        
        return False
