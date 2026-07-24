from sqlalchemy import text
from db import engine

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE students ADD COLUMN cgpa FLOAT NOT NULL DEFAULT 0.0;"))
        print("Successfully added cgpa column.")
    except Exception as e:
        print(f"Error adding cgpa column: {e}")
