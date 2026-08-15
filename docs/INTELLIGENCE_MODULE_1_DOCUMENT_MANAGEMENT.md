# MirrorMind Intelligence Layer — Module 1: User Document Management

## Overview
This module provides the foundational capability for the upcoming MirrorMind Intelligence Layer by allowing users to securely upload, list, and manage their documents (primarily resumes, academic papers, and project reports in PDF format). 

## Architecture
- **Storage Layer (Files):** Cloudinary is used to store the physical files securely in the cloud under `mirrormind/users/{user_id}/documents`.
- **Database Layer (Metadata):** MongoDB's `user_documents` collection is used to track the document references (original filename, Cloudinary URL, file size, category).
- **API Layer:** FastAPI with `python-multipart` handles the incoming file chunks securely.
- **Frontend Layer:** React UI (`Documents.jsx`) embedded in the existing Dashboard.

## Endpoints
- `POST /api/documents`
  - Requires: `UploadFile` as `file`, `category` (string)
  - Returns: Created document metadata JSON
  - Status: 201 Created
- `GET /api/documents`
  - Returns: List of all documents owned by the authenticated user
- `GET /api/documents/{id}`
  - Returns: Specific document
- `DELETE /api/documents/{id}`
  - Deletes the document from Cloudinary and MongoDB.

## Security Constraints Implemented
- Frontend never dictates the owner of the document; `user_id` is securely extracted from the JWT token using `get_current_user`.
- Documents are strictly scoped to the owner during retrieval and deletion.
- Empty files and files exceeding 10MB are rejected.
- Only `application/pdf` (and `.pdf`) files are accepted.
- Cloudinary credentials remain strictly on the backend.
