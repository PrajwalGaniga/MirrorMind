# Profile Update Persistence — Verification Report

## 1. Root Cause

**`POST /api/students/profile` silently discarded the MongoDB `update_one` result.**

```python
# BEFORE (broken)
await db.students.update_one({"user_id": user_id}, {"$set": update_doc})
# ↑ UpdateResult discarded. If matched_count == 0, nothing is updated.
return {"student_id": student_id, "message": "Profile saved successfully"}
# ↑ Frontend receives "success" regardless of whether MongoDB was touched.
```

If the `user_id` from the JWT didn't exactly match the student document's `user_id` (possible with legacy/migrated data), `matched_count` would be `0` — profile silently unchanged while the UI showed "success".

Additionally, the endpoint returned a static success string instead of the persisted document, giving the frontend no way to verify what was actually stored.

---

## 2. Files Changed

| File | Change |
|---|---|
| `backend/models/student.py` | Added `ProfileUpdateRequest` (all-optional Pydantic model) |
| `backend/routes/students.py` | Fixed `save_profile`; added GET /profile logging; added `PATCH /profile/update` |
| `frontend/src/pages/Onboarding.jsx` | Truthful save states; persistence verification; real error display |

---

## 3. MongoDB Schema (unchanged)

```json
{
  "_id": "<uuid>",
  "id": "<uuid>",
  "user_id": "<uuid from JWT sub>",
  "name": "Prajwal Ganiga",
  "branch": "CSE",
  "semester": 6,
  "college_tier": "Tier 2",
  "cgpa": 9.04,
  "backlog_count": 0,
  "skills": ["Python", "FastAPI"],
  "certifications": [],
  "career_interest": "SWE_BACKEND",
  "communication_rating": 8,
  "work_style_pref": "Independent",
  "updated_at": "<datetime>",
  "predictions": null,
  "internships": [...],
  "projects": [...],
  "semester_records": [...]
}
```

No schema changes were made.

---

## 4. Persistence Fix

### save_profile (POST /api/students/profile) — AFTER

```python
result = await db.students.update_one({"user_id": user_id}, {"$set": update_doc})
# matched_count and modified_count are now logged and checked
if result.matched_count == 0:
    raise HTTPException(status_code=404, detail="Profile not found.")
# Re-fetch the actual persisted document and return it
persisted = await db.students.find_one({"user_id": user_id})
return {
    "student_id": student_id,
    "message": "Profile saved successfully",
    "profile": await _serialize(persisted, db),
}
```

### New PATCH /api/students/profile/update

Safe partial update — only writes fields that are explicitly sent.
Arrays (internships, projects, semester_records) are never touched.

---

## 5. Authentication Consistency

Both GET and POST/PATCH /profile use `Depends(get_current_user)` which reads `sub` from JWT.
`sub` is set at register time as `new_user.id` (UUID).
At login, `str(user["_id"])` is the same UUID (since `_id = id` during insert).
No mismatch between GET and UPDATE paths.

---

## 6. Frontend State Fix

No stale cache existed. Profile.jsx and Dashboard.jsx both fetch GET /api/students/profile on every mount.
AuthContext does not cache profile data. localStorage only stores token, user, and student_id.

The fix adds truthful save UX:
- "Saving profile..." during POST
- Verifies `data.profile` exists in the response (confirms MongoDB wrote)
- Logs key fields to console for debugging
- "Saved — redirecting..." before navigate
- Real error message if API fails

---

## 7. Test Results

| Test | Status |
|---|---|
| Name update — refresh browser | Run manually |
| CGPA update — refresh browser | Run manually |
| Multiple field update | Run manually |
| Partial update preservation | Run manually |
| Browser refresh persistence | Run manually |
| Logout/login persistence | Run manually |
| Dashboard profile consistency | Run manually |
| RAG profile context | Run manually |
| Voice regression | Run manually |
| Backend log matched_count=1 visible | Run manually |

---

## 8. Manual Test Steps

1. Open /onboarding, change your name to something new, click Submit & Predict
2. Watch uvicorn console — verify: matched_count=1, modified_count=1, PERSISTENCE VERIFIED
3. Browser shows "Saved — redirecting..." then navigates to dashboard
4. Dashboard shows new name
5. Open /profile — new name shown
6. Refresh browser — new name still shown
7. Logout -> Login -> /profile — new name still shown from MongoDB

That is the acceptance criterion.
