from db import SessionLocal
from models.db_models import User, Student, Internship, Project, SemesterRecord, SubjectMark
from datetime import datetime

def run_verification():
    db = SessionLocal()
    try:
        # 1. Ensure user exists
        email = "prajwalganiga06@gmail.com"
        user = db.query(User).filter_by(email=email).first()
        if not user:
            user = User(name="Prajwal Ganiga", email=email, password="12345678")
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created User.")
        else:
            print("User already exists.")

        # 2. Clear old profile if exists
        student = db.query(Student).filter_by(user_id=user.id).first()
        if student:
            # Cascading deletes or manual deletes
            db.query(Internship).filter_by(student_id=student.id).delete()
            db.query(Project).filter_by(student_id=student.id).delete()
            for sem in student.semester_records:
                db.query(SubjectMark).filter_by(semester_record_id=sem.id).delete()
            db.query(SemesterRecord).filter_by(student_id=student.id).delete()
            db.delete(student)
            db.commit()

        # 3. Create Student Profile (Backend Developer Focus)
        student = Student(
            user_id=user.id,
            name="Prajwal Ganiga",
            branch="Computer Science",
            semester=6,
            college_tier="Tier 2",
            backlog_count=0,
            skills=["Python", "PostgreSQL", "FastAPI", "Docker", "AWS", "Git"],
            certifications=["AWS Certified Developer", "Docker Mastery"],
            career_interest="Backend Development",
            communication_rating=8,
            work_style_pref="Independent"
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        print("Created Student Profile.")

        # 4. Add Internship
        internship = Internship(
            student_id=student.id,
            company_name="Tech Solutions Inc",
            domain="Backend Engineering",
            role="Backend Intern",
            start_date=datetime(2025, 6, 1),
            end_date=datetime(2025, 8, 30),
            is_current=0,
            description="Built microservices using FastAPI and PostgreSQL."
        )
        db.add(internship)

        # 5. Add Projects
        projects = [
            Project(student_id=student.id, title="E-Commerce API", description="RESTful API for e-commerce", tech_stack=["FastAPI", "PostgreSQL"]),
            Project(student_id=student.id, title="Real-time Chat", description="WebSockets based chat app", tech_stack=["Python", "Redis"]),
            Project(student_id=student.id, title="Task Manager", description="Task management tool", tech_stack=["Django", "Docker"])
        ]
        db.add_all(projects)

        # 6. Add Semester Records and Marks
        sem1 = SemesterRecord(student_id=student.id, semester=1, sgpa=8.5, credits_earned=22)
        db.add(sem1)
        db.commit()
        db.refresh(sem1)
        
        db.add(SubjectMark(semester_record_id=sem1.id, subject_name="Maths I", marks_obtained=85, max_marks=100, grade="A"))
        db.add(SubjectMark(semester_record_id=sem1.id, subject_name="Programming", marks_obtained=90, max_marks=100, grade="S"))

        sem2 = SemesterRecord(student_id=student.id, semester=2, sgpa=8.8, credits_earned=22)
        db.add(sem2)
        db.commit()
        db.refresh(sem2)
        
        db.add(SubjectMark(semester_record_id=sem2.id, subject_name="Maths II", marks_obtained=88, max_marks=100, grade="A"))
        db.add(SubjectMark(semester_record_id=sem2.id, subject_name="Data Structures", marks_obtained=92, max_marks=100, grade="S"))

        db.commit()
        print("Inserted Projects, Internships, and Semesters.")

        # 7. Test dynamic ML calculations
        db.refresh(student)
        
        # Simulated logic from predict.py
        projects_count = len(student.projects)
        internships_count = len(student.internships)
        total_credits = sum(r.credits_earned for r in student.semester_records)
        cgpa = float(sum(r.sgpa * r.credits_earned for r in student.semester_records) / total_credits)
        
        print(f"Calculated CGPA: {cgpa:.2f}")
        print(f"Projects count: {projects_count}")
        print(f"Internships count: {internships_count}")

        # Call predict logic
        from inference.predictor import predict_career, USE_MOCK, MOCK_PREDICTIONS
        if USE_MOCK:
            print("Running in MOCK mode (No ML models found).")
            print("Inference Result:", [p["role"] for p in MOCK_PREDICTIONS])
        else:
            result = predict_career(student.skills, cgpa, projects_count, internships_count, top_k=3)
            print("Inference Result:", [p["role"] for p in result["predictions"]])

        print("Verification completed successfully!")

    except Exception as e:
        db.rollback()
        print("Error during verification:", e)
    finally:
        db.close()

if __name__ == "__main__":
    run_verification()
