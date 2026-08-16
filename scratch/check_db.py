import asyncio
import os
import sys
from pathlib import Path

backend_dir = str(Path(__file__).parent.parent / "backend")
sys.path.append(backend_dir)

from db import get_db

async def run_diagnostics():
    db = next(get_db())
    print("[MIRRORMIND][DIAGNOSTIC]")
    print("Checking documents...")
    cursor = db.user_documents.find({})
    docs = await cursor.to_list(length=None)
    
    for doc in docs:
        doc_id = str(doc['_id'])
        user_id = doc['user_id']
        filename = doc.get('filename')
        processing = doc.get('processing_status')
        
        print(f"\nDocument: {filename}")
        print(f"Document ID: {doc_id}")
        print(f"User ID: {user_id}")
        print(f"Processing: {processing}")
        print(f"Embedding status: {doc.get('embedding_status', 'None')}")
        
        # Chunks
        chunks = await db.document_chunks.count_documents({"document_id": doc_id})
        print(f"MongoDB chunks: {chunks}")
        
        # Vector Index
        index = await db.vector_indexes.find_one({"user_id": user_id})
        if index:
            print(f"FAISS index: FOUND")
            print(f"FAISS vectors: {index.get('vector_count', 0)}")
        else:
            print(f"FAISS index: NOT_FOUND")
            
        if doc.get('embedding_status') == 'embedded' and index:
            print(f"Status: READY_FOR_RETRIEVAL")
        else:
            print(f"Status: NOT_READY")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
