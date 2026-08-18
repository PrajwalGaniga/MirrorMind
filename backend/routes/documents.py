import os
import uuid
import cloudinary
import cloudinary.uploader
import cloudinary.api
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from typing import List, Optional
from bson import ObjectId
from pydantic import BaseModel, Field

from auth_utils import get_current_user
from db import get_db

router = APIRouter()

# Configure Cloudinary if not already configured globally
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

class DocumentResponse(BaseModel):
    id: str = Field(alias="_id")
    filename: str
    category: str
    file_type: str
    file_size: int
    processing_status: str
    embedding_status: Optional[str] = None
    embedding_error: Optional[str] = None
    uploaded_at: str
    
    class Config:
        populate_by_name = True

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    user_id: str = Depends(get_current_user),
    db = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename missing")
    
    # Read file content to check size and empty file
    content = await file.read()
    file_size = len(content)
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file rejected")
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum size of {MAX_FILE_SIZE/(1024*1024)}MB")
    
    # Validate MIME type and extension
    allowed_mimes = {"application/pdf"}
    if file.content_type not in allowed_mimes and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed currently")
        
    original_filename = file.filename
    file_ext = "pdf"
    
    now_str = datetime.now(timezone.utc).isoformat()
    
    document_data = {
        "user_id": user_id,
        "filename": original_filename,
        "original_filename": original_filename,
        "category": category,
        "file_type": file_ext,
        "mime_type": file.content_type,
        "file_size": file_size,
        "processing_status": "uploaded",
        "uploaded_at": now_str,
        "updated_at": now_str
    }
    
    # Insert to MongoDB
    try:
        result = await db.user_documents.insert_one(document_data)
        document_data["_id"] = str(result.inserted_id)
        
        # Save a temporary local copy for text extraction (Cloudinary blocks programmatic PDF downloads)
        local_path = os.path.join(os.path.dirname(__file__), "..", "uploads", f"{document_data['_id']}.pdf")
        with open(local_path, "wb") as f:
            f.write(content)
            
        print(f"[MIRRORMIND][DOCUMENT]\nDocument uploaded\ndocument_id={document_data['_id']}\nuser_id={user_id}\nfilename={original_filename}\n")
            
        return document_data
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save document metadata")

@router.get("", response_model=List[DocumentResponse])
async def list_documents(user_id: str = Depends(get_current_user), db = Depends(get_db)):
    cursor = db.user_documents.find({"user_id": user_id}).sort("uploaded_at", -1)
    documents = await cursor.to_list(length=100)
    for doc in documents:
        doc["_id"] = str(doc["_id"])
    return documents

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, user_id: str = Depends(get_current_user), db = Depends(get_db)):
    try:
        obj_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
        
    document = await db.user_documents.find_one({"_id": obj_id, "user_id": user_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    document["_id"] = str(document["_id"])
    return document

@router.get("/{document_id}/download")
async def download_document(document_id: str, user_id: str = Depends(get_current_user), db = Depends(get_db)):
    try:
        obj_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
        
    document = await db.user_documents.find_one({"_id": obj_id, "user_id": user_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    local_path = os.path.join(os.path.dirname(__file__), "..", "uploads", f"{document_id}.pdf")
    if not os.path.exists(local_path):
        # Fallback to cloudinary if it's an old document
        cloudinary_url = document.get("cloudinary_url")
        if cloudinary_url:
            from fastapi.responses import RedirectResponse
            return RedirectResponse(cloudinary_url)
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(local_path, media_type="application/pdf", filename=document.get("filename", "document.pdf"))

@router.delete("/{document_id}")
async def delete_document(document_id: str, user_id: str = Depends(get_current_user), db = Depends(get_db)):
    try:
        obj_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
        
    # Find the document and verify ownership
    document = await db.user_documents.find_one({"_id": obj_id, "user_id": user_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete local file if it exists
    local_path = os.path.join(os.path.dirname(__file__), "..", "uploads", f"{document_id}.pdf")
    if os.path.exists(local_path):
        try:
            os.remove(local_path)
        except:
            pass
            
    # Delete from MongoDB
    delete_result = await db.user_documents.delete_one({"_id": obj_id, "user_id": user_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete document from database")
        
    # Delete associated chunks
    await db.document_chunks.delete_many({"document_id": document_id, "user_id": user_id})
    
    # Delete vectors from VectorStore
    try:
        from services.embedding_service import get_embedding_service
        from services.vector_store import VectorStore
        es = get_embedding_service()
        vs = VectorStore(user_id, es.get_dimension())
        vs.remove_document_vectors(document_id)
        # Update vector_indexes metadata
        await db.vector_indexes.update_one(
            {"user_id": user_id},
            {"$set": {"vector_count": vs.get_count(), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    except Exception as e:
        import traceback; traceback.print_exc()
        
    return {"message": "Document deleted successfully"}

from utils.document_processor import process_pdf_document

@router.post("/{document_id}/process")
async def process_document(document_id: str, user_id: str = Depends(get_current_user), db = Depends(get_db)):
    try:
        obj_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
        
    document = await db.user_documents.find_one({"_id": obj_id, "user_id": user_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Set to processing
    await db.user_documents.update_one(
        {"_id": obj_id},
        {"$set": {"processing_status": "processing", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    try:
        print(f"[MIRRORMIND][PROCESS]\nProcessing started\ndocument_id={document_id}\n")
        
        # Run processing from local file
        local_path = os.path.join(os.path.dirname(__file__), "..", "uploads", f"{document_id}.pdf")
        result = await process_pdf_document(local_path, document_id, user_id)
        
        print(f"[MIRRORMIND][PROCESS]\nText extraction completed\ndocument_id={document_id}\npages={result['page_count']}\ncharacters={sum(len(c['text']) for c in result['chunks'])}\n")
        
        # Delete old chunks if any (safe reprocessing)
        await db.document_chunks.delete_many({"document_id": document_id, "user_id": user_id})
        
        # Insert new chunks
        chunks = result["chunks"]
        now_str = datetime.now(timezone.utc).isoformat()
        for chunk in chunks:
            chunk["created_at"] = now_str
            
        if chunks:
            await db.document_chunks.insert_many(chunks)
            print(f"[MIRRORMIND][CHUNK]\nChunks created\ndocument_id={document_id}\nchunk_count={len(chunks)}\n")
            
        # Update metadata
        await db.user_documents.update_one(
            {"_id": obj_id},
            {"$set": {
                "processing_status": "processed",
                "page_count": result["page_count"],
                "chunk_count": result["chunk_count"],
                "processed_at": now_str,
                "updated_at": now_str
            }}
        )
        
        return {"message": "Document processed successfully"}
        
    except Exception as e:
        # Mark as failed
        error_msg = str(e)
        # Use safe generic error if it's an unexpected type to not expose stack traces to frontend
        if not isinstance(e, ValueError):
            import traceback
            traceback.print_exc()
            error_msg = "An internal error occurred during processing."
            
        await db.user_documents.update_one(
            {"_id": obj_id},
            {"$set": {
                "processing_status": "failed",
                "processing_error": error_msg,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=400 if isinstance(e, ValueError) else 500, detail=error_msg)


@router.get("/{document_id}/status")
async def get_document_status(document_id: str, user_id: str = Depends(get_current_user), db = Depends(get_db)):
    try:
        obj_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
        
    document = await db.user_documents.find_one({"_id": obj_id, "user_id": user_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {
        "document_id": document_id,
        "processing_status": document.get("processing_status", "uploaded"),
        "page_count": document.get("page_count"),
        "chunk_count": document.get("chunk_count"),
        "processed_at": document.get("processed_at"),
        "processing_error": document.get("processing_error")
    }

@router.post("/{document_id}/embed")
async def embed_document(document_id: str, user_id: str = Depends(get_current_user), db = Depends(get_db)):
    try:
        obj_id = ObjectId(document_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid document ID format")
        
    document = await db.user_documents.find_one({"_id": obj_id, "user_id": user_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if document.get("processing_status") != "processed":
        raise HTTPException(status_code=400, detail="Document must be processed before embedding")
        
    # Mark as embedding
    await db.user_documents.update_one(
        {"_id": obj_id},
        {"$set": {"embedding_status": "embedding", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    print(f"[MIRRORMIND][EMBED]\nEmbedding requested\ndocument_id={document_id}\nuser_id={user_id}\n")
    
    try:
        # Get chunks
        chunks_cursor = db.document_chunks.find({"document_id": document_id, "user_id": user_id}).sort("chunk_index", 1)
        chunks = await chunks_cursor.to_list(length=None)
        
        if not chunks:
            # Handle empty document case
            await db.user_documents.update_one(
                {"_id": obj_id},
                {"$set": {"embedding_status": "failed", "embedding_error": "No embeddable text found in this document."}}
            )
            return {"message": "No embeddable text found in this document."}
            
        print(f"[MIRRORMIND][EMBED]\nChunks found for embedding\ndocument_id={document_id}\nchunk_count={len(chunks)}\n")
            
        from services.embedding_service import get_embedding_service
        from services.vector_store import VectorStore
        
        es = get_embedding_service()
        dimension = es.get_dimension()
        print(f"[MIRRORMIND][EMBED]\nEmbedding model loaded\n")
        
        # Idempotency: initialize store, remove existing vectors for this document
        vs = VectorStore(user_id, dimension)
        vs.remove_document_vectors(document_id)
        
        # Embed chunks
        texts = [chunk["text"] for chunk in chunks]
        embeddings = es.embed(texts)
        
        print(f"[MIRRORMIND][EMBED]\nEmbeddings generated\ndocument_id={document_id}\nvector_count={len(embeddings)}\ndimension={dimension}\n")
        
        # Prepare metadata
        metadatas = []
        for chunk in chunks:
            metadatas.append({
                "user_id": user_id,
                "document_id": document_id,
                "chunk_id": str(chunk["_id"]),
                "chunk_index": chunk.get("chunk_index", 0),
                "page_start": chunk.get("page_start", 1),
                "page_end": chunk.get("page_end", 1)
            })
            
        # Add to FAISS
        print(f"[MIRRORMIND][FAISS]\nVector index update started\nuser_id={user_id}\n")
        vs.add_vectors(embeddings, metadatas)
        
        # Update MongoDB vector metadata
        now_str = datetime.now(timezone.utc).isoformat()
        await db.vector_indexes.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "index_version": 1,
                    "embedding_model": es.get_model_name(),
                    "embedding_dimension": dimension,
                    "distance_metric": "inner_product",
                    "normalized": True,
                    "vector_count": vs.get_count(),
                    "index_path": str(vs.index_path),
                    "updated_at": now_str
                }
            },
            upsert=True
        )
        
        print(f"[MIRRORMIND][FAISS]\nVector index update completed\nuser_id={user_id}\ntotal_vectors={vs.get_count()}\n")
        
        # Update document status
        await db.user_documents.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "embedding_status": "embedded",
                    "embedded_chunk_count": len(chunks),
                    "embedded_at": now_str,
                    "updated_at": now_str
                },
                "$unset": {"embedding_error": ""}
            }
        )
        
        return {
            "document_id": document_id,
            "embedded_chunks": len(chunks),
            "embedding_dimension": dimension,
            "index_updated": True
        }
        
    except Exception as e:
        import traceback; traceback.print_exc()
        await db.user_documents.update_one(
            {"_id": obj_id},
            {"$set": {
                "embedding_status": "failed",
                "embedding_error": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        raise HTTPException(status_code=500, detail="Failed to embed document")
