import numpy as np
from bson import ObjectId
from typing import List, Dict, Any
from services.embedding_service import get_embedding_service
from services.vector_store import VectorStore

async def retrieve_semantic_chunks(user_id: str, query: str, db, top_k: int = 5) -> Dict[str, Any]:
    """
    Retrieves the most semantically relevant chunks for a user's query.
    Ensures strict user isolation.
    """
    if not query or not query.strip():
        raise ValueError("Query cannot be empty.")
        
    if top_k < 1 or top_k > 10:
        raise ValueError("top_k must be between 1 and 10.")
        
    # Get the embedding service and ensure we use the exact same logic
    es = get_embedding_service()
    
    print(f"[MIRRORMIND][RETRIEVAL]\nQuery received\nuser_id={user_id}\nquery=\"{query}\"\n")
    
    # Load user's isolated vector store
    vs = VectorStore(user_id, es.get_dimension())
    
    # If the user has no index or an empty index, return early safely
    if vs.index is None or vs.get_count() == 0:
        print(f"[MIRRORMIND][RETRIEVAL]\nWARNING: No FAISS index found for user\nuser_id={user_id}\n")
        return {
            "query": query,
            "results": [],
            "message": "No indexed documents available."
        }
        
    print(f"[MIRRORMIND][RETRIEVAL]\nUser vector index found\nuser_id={user_id}\nvector_count={vs.get_count()}\n")
        
    # Generate normalized query embedding
    query_embedding = es.embed([query]) # returns shape (1, dimension)
    
    # Perform search. Since embedding is normalized and FAISS is IndexFlatIP, this is Cosine Similarity.
    # Safe guard if top_k > count
    actual_top_k = min(top_k, vs.get_count())
    distances, indices = vs.index.search(query_embedding, actual_top_k)
    
    print(f"[MIRRORMIND][RETRIEVAL]\nFAISS search completed\nrequested_top_k={top_k}\nreturned_vectors={len(indices[0])}\n")
    
    # Process results
    results = []
    
    for i, vector_idx in enumerate(indices[0]):
        if vector_idx == -1:
            continue
            
        score = float(distances[0][i])
        metadata = vs.metadata.get(str(vector_idx))
        
        if not metadata:
            continue
            
        # Defense-in-depth: Verify metadata ownership
        if metadata.get("user_id") != user_id:
            continue
            
        chunk_id_str = metadata.get("chunk_id")
        document_id = metadata.get("document_id")
        
        try:
            chunk_obj_id = ObjectId(chunk_id_str)
            doc_obj_id = ObjectId(document_id)
        except:
            continue
            
        # Retrieve actual chunk text from MongoDB
        chunk = await db.document_chunks.find_one({"_id": chunk_obj_id, "user_id": user_id})
        
        if not chunk:
            # Stale vector. Log but continue.
            print(f"Warning: Stale vector {vector_idx} for missing chunk {chunk_id_str}")
            continue
            
        # Get filename if available from user_documents
        doc = await db.user_documents.find_one({"_id": doc_obj_id, "user_id": user_id})
        filename = doc.get("filename", "Unknown") if doc else "Unknown"
            
        results.append({
            "score": score,
            "document_id": document_id,
            "chunk_id": chunk_id_str,
            "chunk_index": metadata.get("chunk_index", 0),
            "page_start": metadata.get("page_start", 1),
            "page_end": metadata.get("page_end", 1),
            "filename": filename,
            "text": chunk.get("text", "")
        })
        
    # Sort results explicitly descending by score just in case, though FAISS returns them sorted
    results.sort(key=lambda x: x["score"], reverse=True)
    
    print(f"[MIRRORMIND][RETRIEVAL]\nMongoDB chunks reconstructed\nreturned_chunks={len(results)}\n")
    
    return {
        "query": query,
        "results": results
    }
