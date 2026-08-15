import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# Configuration
PG_URL = os.getenv("DATABASE_URL", "postgresql://postgres:0608@localhost:5432/major-project")
# Fallback to hardcoded if env var was removed
if "postgresql+" in PG_URL:
    PG_URL = PG_URL.replace("postgresql+psycopg2://", "postgresql://")
    
MONGO_URI = os.getenv("MONGODB_URI")
MONGO_DB = os.getenv("MONGODB_DATABASE", "mirrormind")

def migrate():
    print(f"Connecting to Postgres: {PG_URL}")
    pg_conn = psycopg2.connect(PG_URL)
    pg_cursor = pg_conn.cursor(cursor_factory=RealDictCursor)
    
    print(f"Connecting to MongoDB: {MONGO_DB}")
    mongo_client = MongoClient(MONGO_URI)
    mongo_db = mongo_client[MONGO_DB]
    
    # 1. Migrate Users & Extension API Keys
    print("Migrating Users...")
    pg_cursor.execute("SELECT * FROM users")
    users = pg_cursor.fetchall()
    
    pg_cursor.execute("SELECT * FROM extension_api_keys")
    api_keys = {k["user_id"]: k for k in pg_cursor.fetchall()}
    
    for u in users:
        u_id = u["id"]
        u["_id"] = u.pop("id")
        
        # embed api key
        if u_id in api_keys:
            key = dict(api_keys[u_id])
            key.pop("id", None)
            key.pop("user_id", None)
            u["extension_api_key"] = key
            
        mongo_db.users.update_one({"_id": u["_id"]}, {"$set": dict(u)}, upsert=True)
    
    print(f"Migrated {len(users)} users.")
    
    # 2. Migrate Skills
    print("Migrating Skills...")
    pg_cursor.execute("SELECT * FROM skills")
    skills = pg_cursor.fetchall()
    if skills:
        mongo_db.skills.delete_many({})
        for s in skills:
            s["_id"] = s.pop("id")
        mongo_db.skills.insert_many([dict(s) for s in skills])
    print(f"Migrated {len(skills)} skills.")
    
    # 3. Migrate Error Logs
    print("Migrating Error Logs...")
    pg_cursor.execute("SELECT * FROM error_logs")
    error_logs = pg_cursor.fetchall()
    if error_logs:
        mongo_db.error_logs.delete_many({})
        for e in error_logs:
            e["_id"] = e.pop("id")
        mongo_db.error_logs.insert_many([dict(e) for e in error_logs])
    print(f"Migrated {len(error_logs)} error logs.")

    # 4. Migrate Extension Activity Logs
    print("Migrating Activity Logs...")
    pg_cursor.execute("SELECT * FROM extension_activity_log")
    activity_logs = pg_cursor.fetchall()
    if activity_logs:
        mongo_db.extension_activity_log.delete_many({})
        for a in activity_logs:
            a["_id"] = a.pop("id")
        mongo_db.extension_activity_log.insert_many([dict(a) for a in activity_logs])
    print(f"Migrated {len(activity_logs)} activity logs.")

    # 5. Migrate Prediction Cache
    print("Migrating Prediction Cache...")
    pg_cursor.execute("SELECT * FROM prediction_cache")
    prediction_caches = pg_cursor.fetchall()
    if prediction_caches:
        mongo_db.prediction_cache.delete_many({})
        for pc in prediction_caches:
            pc["_id"] = pc.pop("id")
        mongo_db.prediction_cache.insert_many([dict(pc) for pc in prediction_caches])
    print(f"Migrated {len(prediction_caches)} prediction caches.")

    # 6. Migrate Students with Embedded Data
    print("Migrating Students...")
    pg_cursor.execute("SELECT * FROM students")
    students = pg_cursor.fetchall()
    
    pg_cursor.execute("SELECT * FROM internships")
    internships = pg_cursor.fetchall()
    internships_by_student = {}
    for i in internships:
        s_id = i.pop("student_id")
        internships_by_student.setdefault(s_id, []).append(dict(i))
        
    pg_cursor.execute("SELECT * FROM projects")
    projects = pg_cursor.fetchall()
    projects_by_student = {}
    for p in projects:
        s_id = p.pop("student_id")
        projects_by_student.setdefault(s_id, []).append(dict(p))
        
    pg_cursor.execute("SELECT * FROM semester_records")
    semester_records = pg_cursor.fetchall()
    
    pg_cursor.execute("SELECT * FROM subject_marks")
    subject_marks = pg_cursor.fetchall()
    marks_by_sem = {}
    for sm in subject_marks:
        sm_id = sm.pop("semester_record_id")
        marks_by_sem.setdefault(sm_id, []).append(dict(sm))
        
    sem_by_student = {}
    for sr in semester_records:
        s_id = sr.pop("student_id")
        sr_dict = dict(sr)
        sr_dict["subjects"] = marks_by_sem.get(sr_dict["id"], [])
        sem_by_student.setdefault(s_id, []).append(sr_dict)
        
    for s in students:
        s_id = s["id"]
        s_dict = dict(s)
        s_dict["_id"] = s_dict.pop("id")
        
        s_dict["internships"] = internships_by_student.get(s_id, [])
        s_dict["projects"] = projects_by_student.get(s_id, [])
        s_dict["semester_records"] = sem_by_student.get(s_id, [])
        
        mongo_db.students.update_one({"_id": s_dict["_id"]}, {"$set": s_dict}, upsert=True)
        
    print(f"Migrated {len(students)} students.")
    
    print("Migration completed successfully!")
    
if __name__ == "__main__":
    migrate()
