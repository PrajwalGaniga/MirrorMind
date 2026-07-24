from db import engine, Base
import models.db_models
from sqlalchemy import text

def test_connection():
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully.")
        
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print(f"Database connection successful! Result: {result.scalar()}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    test_connection()
