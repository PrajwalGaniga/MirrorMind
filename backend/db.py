from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "mirrormind")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

users_collection = db["users"]
students_collection = db["students"]
