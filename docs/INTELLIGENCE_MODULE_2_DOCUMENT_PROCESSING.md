# MirrorMind Intelligence Layer — Module 2
## Document Processing, Text Extraction & Chunking

### Overview
Module 2 is responsible for retrieving uploaded PDFs, extracting and cleaning their text, and splitting the text into chunks stored in MongoDB. This lays the groundwork for vector embeddings and RAG in Module 3.

### Key Components

1. **Local Processing Fallback**:
   Because Cloudinary's "Strict Delivery" blocks backend downloading of PDFs programmatically via `httpx` (returning `401 Unauthorized`), the system implements a local file fallback:
   - When a user uploads a document, `backend/routes/documents.py` temporarily saves the raw bytes to `backend/uploads/{document_id}.pdf`.
   - Cloudinary uploading remains exactly the same, so frontend viewing is uninterrupted (Module 1 intact).
   - When the user calls `/process`, the system reads from this temporary local file, bypassing the need to authenticate backend HTTP requests to Cloudinary.
   - Once processing completes, the temporary file is deleted.

2. **Text Extraction (`pypdf`)**:
   `pypdf` is used in `backend/utils/document_processor.py` for pure-Python, dependency-free text extraction. It preserves page boundaries for accurate chunk metadata.

3. **Deterministic Chunking**:
   - `CHUNK_SIZE = 1000` characters.
   - `CHUNK_OVERLAP = 200` characters.
   - Preserves `page_start` and `page_end` mapping.

4. **MongoDB Storage (`document_chunks`)**:
   - Chunks are stored in the `document_chunks` collection.
   - Schema includes `user_id`, `document_id`, `chunk_index`, `page_start`, `page_end`, `text`, and `created_at`.
   - A compound index on `user_id` + `document_id` ensures O(1) query time.
   - If a document is re-processed, old chunks are automatically deleted before inserting new ones.
   - If a document is deleted via `DELETE /api/documents/{id}`, its corresponding chunks are also deleted.

5. **Security & Ownership**:
   Every endpoint enforces `user_id = Depends(get_current_user)`. Users can strictly only process, view status, and delete chunks belonging to their own documents.
