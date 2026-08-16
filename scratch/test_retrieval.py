import asyncio
import sys
from pathlib import Path
from bson import ObjectId
from unittest.mock import AsyncMock

backend_dir = str(Path(__file__).parent.parent / "backend")
sys.path.append(backend_dir)

from services.embedding_service import get_embedding_service
from services.vector_store import VectorStore
from services.retrieval_service import retrieve_semantic_chunks

class MockDB:
    def __init__(self):
        self.document_chunks = AsyncMock()
        self.user_documents = AsyncMock()
        self.chunks_data = {}
        self.docs_data = {}
        
        # Setup mocks
        async def mock_find_one_chunk(query):
            chunk_id = str(query.get("_id"))
            user_id = query.get("user_id")
            chunk = self.chunks_data.get(chunk_id)
            if chunk and chunk.get("user_id") == user_id:
                return chunk
            return None
            
        async def mock_find_one_doc(query):
            doc_id = str(query.get("_id"))
            user_id = query.get("user_id")
            doc = self.docs_data.get(doc_id)
            if doc and doc.get("user_id") == user_id:
                return doc
            return None
            
        self.document_chunks.find_one.side_effect = mock_find_one_chunk
        self.user_documents.find_one.side_effect = mock_find_one_doc

def add_mock_data(db, user_id, doc_id, text_list):
    doc_obj_id = str(ObjectId()) if not doc_id else doc_id
    db.docs_data[doc_obj_id] = {"_id": ObjectId(doc_obj_id), "user_id": user_id, "filename": f"test_doc.pdf"}
    
    chunks = []
    for i, text in enumerate(text_list):
        chunk_id = str(ObjectId())
        chunk = {
            "_id": ObjectId(chunk_id),
            "user_id": user_id,
            "document_id": doc_obj_id,
            "chunk_index": i,
            "page_start": 1,
            "page_end": 1,
            "text": text
        }
        db.chunks_data[chunk_id] = chunk
        chunks.append(chunk)
    return doc_obj_id, chunks

async def run_tests():
    print("Running retrieval tests...")
    
    es = get_embedding_service()
    dim = es.get_dimension()
    
    user_a = "retrieval_user_a"
    user_b = "retrieval_user_b"
    
    vs_a = VectorStore(user_a, dim)
    vs_a.destroy()
    vs_b = VectorStore(user_b, dim)
    vs_b.destroy()
    
    vs_a = VectorStore(user_a, dim)
    vs_b = VectorStore(user_b, dim)
    
    db = MockDB()
    
    # Setup User A documents for Ranking and Retrieval
    doc_a_id, chunks_a = add_mock_data(db, user_a, str(ObjectId()), [
        "Python, FastAPI, MongoDB and Docker are used for backend development.",
        "React, CSS and JavaScript are used to create frontend interfaces.",
        "TensorFlow, PyTorch and neural networks are used for machine learning."
    ])
    
    metas_a = [{"user_id": user_a, "document_id": doc_a_id, "chunk_id": str(c["_id"])} for c in chunks_a]
    embeddings_a = es.embed([c["text"] for c in chunks_a])
    vs_a.add_vectors(embeddings_a, metas_a)
    
    # TEST 1 & 2: Correct ranking
    res1 = await retrieve_semantic_chunks(user_a, "What technologies are used for backend development?", db)
    assert "FastAPI" in res1["results"][0]["text"]
    print("TEST 1/2 PASS: Backend query ranked correctly.")
    
    res2 = await retrieve_semantic_chunks(user_a, "What technologies are used for frontend development?", db)
    assert "React" in res2["results"][0]["text"]
    print("TEST 1/2 PASS: Frontend query ranked correctly.")
    
    # TEST 3: Top-K behavior
    res3 = await retrieve_semantic_chunks(user_a, "development", db, top_k=2)
    assert len(res3["results"]) == 2
    print("TEST 3 PASS: Top-K bounds honored.")
    
    # TEST 4: Empty query rejection
    try:
        await retrieve_semantic_chunks(user_a, "   ", db)
        assert False, "Should reject empty query"
    except ValueError:
        print("TEST 4 PASS: Empty query rejected.")
        
    # TEST 5: Missing index handling
    res5 = await retrieve_semantic_chunks("unknown_user", "test", db)
    assert len(res5["results"]) == 0
    assert "No indexed documents" in res5["message"]
    print("TEST 5 PASS: Missing index safely handled.")
    
    # TEST 6 & 7 & 21: User isolation and Cross-user attack
    # User B has different data
    doc_b_id, chunks_b = add_mock_data(db, user_b, str(ObjectId()), [
        "User B works with React and Node.js."
    ])
    metas_b = [{"user_id": user_b, "document_id": doc_b_id, "chunk_id": str(c["_id"])} for c in chunks_b]
    embeddings_b = es.embed([c["text"] for c in chunks_b])
    vs_b.add_vectors(embeddings_b, metas_b)
    
    res_a_iso = await retrieve_semantic_chunks(user_a, "What technologies do I work with? Node.js?", db)
    # User A should NOT get User B's document even if Node.js is matched conceptually
    for r in res_a_iso["results"]:
        assert "Node.js" not in r["text"]
    print("TEST 6/7/21 PASS: User isolation strictly enforced.")
    
    # TEST 8 & 22: Deleted document no longer retrieved
    vs_a.remove_document_vectors(doc_a_id)
    res_del = await retrieve_semantic_chunks(user_a, "FastAPI", db)
    assert len(res_del["results"]) == 0
    print("TEST 8/22 PASS: Deleted document not retrieved.")
    
    # TEST 9 & 23: Re-embedding does not duplicate
    vs_a.add_vectors(embeddings_a, metas_a)
    vs_a.remove_document_vectors(doc_a_id)
    vs_a.add_vectors(embeddings_a, metas_a)
    assert vs_a.get_count() == 3 # Should remain 3
    res_re = await retrieve_semantic_chunks(user_a, "FastAPI", db, top_k=10)
    # The text "Python, FastAPI..." should only appear once
    fastapi_count = sum(1 for r in res_re["results"] if "FastAPI" in r["text"])
    assert fastapi_count == 1
    print("TEST 9/23 PASS: Re-embedding handled cleanly without duplicates.")
    
    # TEST 10 & 24: Metadata correctness
    res_meta = await retrieve_semantic_chunks(user_a, "machine learning", db, top_k=1)
    meta = res_meta["results"][0]
    assert "document_id" in meta
    assert "chunk_id" in meta
    assert "score" in meta
    assert "text" in meta
    print("TEST 10/24 PASS: Metadata correctness verified.")
    
    # TEST 12 & 19: Real MirrorMind-style retrieval
    # Clear the index to isolate this test
    vs_a.destroy()
    vs_a = VectorStore(user_a, dim)
    doc_resume_id, chunks_resume = add_mock_data(db, user_a, str(ObjectId()), [
        "Developed REST APIs using Spring Boot and Java. Worked with MongoDB and Docker."
    ])
    vs_a.add_vectors(es.embed([c["text"] for c in chunks_resume]), 
                     [{"user_id": user_a, "document_id": doc_resume_id, "chunk_id": str(c["_id"])} for c in chunks_resume])
    
    res_mm = await retrieve_semantic_chunks(user_a, "What backend technologies has this student worked with?", db, top_k=2)
    # Both "Python, FastAPI..." and "Spring Boot..." are valid. Let's ensure Spring Boot is in one of the top results.
    texts = [r["text"] for r in res_mm["results"]]
    assert any("Spring Boot" in t for t in texts), f"Spring Boot not found in top 2 results: {texts}"
    print("TEST 12/19 PASS: MirrorMind natural language query works.")
    
    # TEST 13 & 20: Unrelated query behavior
    res_neg = await retrieve_semantic_chunks(user_a, "What are the symptoms of a particular disease?", db)
    # It will return something because of mathematical closeness, but score won't be artificially altered
    assert len(res_neg["results"]) > 0
    assert "score" in res_neg["results"][0]
    print("TEST 13/20 PASS: Unrelated query retrieves mathematical closest without crashing.")

    print("All retrieval tests passed successfully.")

if __name__ == "__main__":
    asyncio.run(run_tests())
