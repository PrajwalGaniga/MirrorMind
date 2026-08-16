# Module 3 Implementation Details

## 1. Architecture
- **MongoDB**: Used as the source of truth for documents, chunks, and vector index metadata.
- **FAISS**: CPU-based indexing (`faiss-cpu`) utilized as the vector storage engine.
- **SentenceTransformer**: Reused from the existing ML pipeline (`all-MiniLM-L6-v2`) via `embedding_service.py` to handle chunk text embedding.

## 2. Embedding Model
- The model `all-MiniLM-L6-v2` is loaded once as a Singleton inside `embedding_service.py` to prevent redundant initialization across requests.
- Fetches model name from `ml_models/embedding_model.txt` with a fallback if absent.

## 3. Embedding Dimension
- Discovered dynamically by passing a dummy text to the model (`384` for `all-MiniLM-L6-v2`).

## 4. Normalization Strategy
- Embeddings are generated with `normalize_embeddings=True` to support scalable cosine similarity mappings.

## 5. FAISS Metric
- `IndexFlatIP` (Inner Product) is used, as vectors are already normalized.

## 6. Index Storage
- Isolated storage implemented at `backend/vector_indexes/<user_id>/`.
- Contains `index.faiss` and `metadata.json`.

## 7. MongoDB Metadata
- Integrated `db.vector_indexes` to track the state of FAISS indices per user (e.g., dimension, vector count, version, updated time).

## 8. User Isolation
- Strictly enforced by creating an independent FAISS store and `metadata.json` dict per `user_id`. Each request validates the user token against document ownership.

## 9. Idempotency
- Duplicate vectors are mitigated by automatically clearing any existing vectors linked to a `document_id` inside the `VectorStore` before generating fresh embeddings.

## 10. Rebuild Strategy
- A `rebuild()` method is implemented in `VectorStore`, capable of wiping and recreating the FAISS state from a fresh list of vectors and metadata mappings.

## 11. Delete Behavior
- Triggered internally via the `DELETE /api/documents/{document_id}` endpoint.
- Flushes related vectors from `VectorStore` using `remove_document_vectors` before updating MongoDB document records.

## 12. Error Handling
- Invalid or unprocessable states (e.g. empty PDF text) gracefully update `embedding_status` to `"failed"` without halting the system or generating corrupted FAISS binaries. 

## 13. Deployment Limitation of Local FAISS Storage
- Notice: The local `vector_indexes/` folder relies on persistent file storage. In serverless or ephemeral environments, these indices must be mapped to durable block storage or moved to a specialized vector database.

## 14. API Endpoints
- `POST /api/documents/{document_id}/embed`

## 15. Test Results
- Standard integration scenarios passed across dimension mapping, idempotency constraints, multi-document indexing, and targeted metadata deletion.
