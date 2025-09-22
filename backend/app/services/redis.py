import json
import redis.asyncio as redis
from typing import Optional, Any
from app.config import settings


class RedisService:
    def __init__(self):
        self.redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )

    async def get(self, key: str) -> Optional[Any]:
        """Get a value from Redis"""
        try:
            value = await self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Redis get error: {e}")
            return None

    async def set(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """Set a value in Redis with optional expiration"""
        try:
            serialized_value = json.dumps(value, default=str)
            result = await self.redis_client.set(key, serialized_value, ex=expire)
            return result is True
        except Exception as e:
            print(f"Redis set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete a key from Redis"""
        try:
            result = await self.redis_client.delete(key)
            return result > 0
        except Exception as e:
            print(f"Redis delete error: {e}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if a key exists in Redis"""
        try:
            result = await self.redis_client.exists(key)
            return result > 0
        except Exception as e:
            print(f"Redis exists error: {e}")
            return False

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Increment a numeric value in Redis"""
        try:
            result = await self.redis_client.incrby(key, amount)
            return result
        except Exception as e:
            print(f"Redis increment error: {e}")
            return None

    async def close(self):
        """Close the Redis connection"""
        await self.redis_client.close()


redis_service = RedisService()