import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "mirrormind")

# Initialize Motor Client
client = AsyncIOMotorClient(MONGODB_URI)
database = client[MONGODB_DATABASE]

async def setup_indexes():
    # Index for querying user chunks
    await database.document_chunks.create_index(
        [("user_id", 1), ("document_id", 1)]
    )

def get_db():
    """Dependency to get the database instance."""
    yield database
