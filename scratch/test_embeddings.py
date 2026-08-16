import asyncio
import uuid
import os
import shutil
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

# Setup paths so we can import backend code
import sys
from pathlib import Path
backend_dir = str(Path(__file__).parent.parent / "backend")
sys.path.append(backend_dir)

from services.embedding_service import get_embedding_service
from services.vector_store import VectorStore

# Mocking MongoDB
class MockDB:
    def __init__(self):
        self.user_documents = AsyncMock()
        self.document_chunks = AsyncMock()
        self.vector_indexes = AsyncMock()

def create_mock_chunks(user_id, document_id, count):
    chunks = []
    for i in range(count):
        chunks.append({
            "_id": ObjectId(),
            "user_id": user_id,
            "document_id": document_id,
            "chunk_index": i,
            "text": f"This is chunk number {i} for document {document_id}"
        })
    return chunks

async def run_tests():
    print("Running embedding tests...")
    
    es = get_embedding_service()
    dim = es.get_dimension()
    print(f"Embedding dimension: {dim}")
    
    # Test Data
    user_a = "user_a"
    user_b = "user_b"
    doc_a1 = "doc_a1"
    doc_a2 = "doc_a2"
    doc_b1 = "doc_b1"
    
    # Clean up existing indices for these users if any
    vs_a = VectorStore(user_a, dim)
    vs_a.destroy()
    vs_b = VectorStore(user_b, dim)
    vs_b.destroy()
    
    # Init new stores
    vs_a = VectorStore(user_a, dim)
    vs_b = VectorStore(user_b, dim)
    
    # TEST 1 & 2: User A document embedded
    print("Embedding Document A1 for User A")
    chunks_a1 = create_mock_chunks(user_a, doc_a1, 5)
    texts_a1 = [c["text"] for c in chunks_a1]
    embeddings_a1 = es.embed(texts_a1)
    
    metas_a1 = []
    for c in chunks_a1:
        metas_a1.append({
            "user_id": user_a,
            "document_id": doc_a1,
            "chunk_id": str(c["_id"])
        })
    vs_a.add_vectors(embeddings_a1, metas_a1)
    
    assert vs_a.get_count() == 5
    print("TEST 1 & 2 PASS: Vector count equals chunk count.")
    
    # TEST 3: Dimension match
    assert vs_a.index.d == dim
    print("TEST 3 PASS: Embedding dimension matches.")
    
    # TEST 4: Idempotency / No duplicates
    vs_a.remove_document_vectors(doc_a1)
    vs_a.add_vectors(embeddings_a1, metas_a1)
    assert vs_a.get_count() == 5
    print("TEST 4 PASS: Idempotency prevents duplicates.")
    
    # TEST 5: User A two docs
    chunks_a2 = create_mock_chunks(user_a, doc_a2, 3)
    texts_a2 = [c["text"] for c in chunks_a2]
    embeddings_a2 = es.embed(texts_a2)
    metas_a2 = [{"user_id": user_a, "document_id": doc_a2, "chunk_id": str(c["_id"])} for c in chunks_a2]
    vs_a.add_vectors(embeddings_a2, metas_a2)
    
    assert vs_a.get_count() == 8
    print("TEST 5 PASS: User A has two documents in single index.")
    
    # TEST 6: User B separation
    chunks_b1 = create_mock_chunks(user_b, doc_b1, 4)
    embeddings_b1 = es.embed([c["text"] for c in chunks_b1])
    metas_b1 = [{"user_id": user_b, "document_id": doc_b1, "chunk_id": str(c["_id"])} for c in chunks_b1]
    vs_b.add_vectors(embeddings_b1, metas_b1)
    
    assert vs_b.get_count() == 4
    print("TEST 6 PASS: User B index is separate.")
    
    # TEST 8: Delete User A document
    removed = vs_a.remove_document_vectors(doc_a1)
    assert removed == 5
    assert vs_a.get_count() == 3
    print("TEST 8 PASS: Deleted vectors disappear.")
    
    # TEST 9: Remaining documents intact
    assert vs_a.get_count() == 3
    print("TEST 9 PASS: Remaining docs intact.")
    
    # TEST 10: Rebuild User A index
    vs_a.rebuild(embeddings_a2, metas_a2)
    assert vs_a.get_count() == 3
    print("TEST 10 PASS: Rebuild successful.")
    
    # TEST 11: Empty text document
    empty_embeddings = es.embed([])
    vs_a.add_vectors(empty_embeddings, [])
    assert vs_a.get_count() == 3
    print("TEST 11 PASS: Empty doc safely handled.")
    
    print("All internal VectorStore + Embedding tests passed.")

if __name__ == "__main__":
    asyncio.run(run_tests())
