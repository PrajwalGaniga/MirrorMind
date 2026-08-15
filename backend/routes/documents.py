import os
import uuid
import cloudinary
import cloudinary.uploader
import cloudinary.api
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
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
    
    # Upload to Cloudinary
    try:
        cloudinary_response = cloudinary.uploader.upload(
            content,
            folder=f"mirrormind/users/{user_id}/documents",
            resource_type="auto",
            public_id=f"{uuid.uuid4().hex}_{original_filename.replace(' ', '_')}"
        )
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail="Cloudinary upload failed")
        
    secure_url = cloudinary_response.get("secure_url")
    public_id = cloudinary_response.get("public_id")
    resource_type = cloudinary_response.get("resource_type")
    
    now_str = datetime.now(timezone.utc).isoformat()
    
    document_data = {
        "user_id": user_id,
        "filename": original_filename,
        "original_filename": original_filename,
        "category": category,
        "file_type": file_ext,
        "mime_type": file.content_type,
        "file_size": file_size,
        "cloudinary_url": secure_url,
        "cloudinary_public_id": public_id,
        "cloudinary_resource_type": resource_type,
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
            
        return document_data
    except Exception as e:
        # Revert cloudinary upload if db insert fails
        try:
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        except:
            pass
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
        
    public_id = document.get("cloudinary_public_id")
    resource_type = document.get("cloudinary_resource_type", "image") # Auto handles fallback but 'raw' might be used for PDFs
    
    # Delete from Cloudinary
    if public_id:
        try:
            # For PDFs, Cloudinary often treats them as 'image' in the uploader if resource_type="auto"
            cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        except Exception as e:
            # We log it but proceed to delete from our db so user isn't stuck
            pass
            
    # Delete from MongoDB
    delete_result = await db.user_documents.delete_one({"_id": obj_id, "user_id": user_id})
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete document from database")
        
    # Delete associated chunks
    await db.document_chunks.delete_many({"document_id": document_id, "user_id": user_id})
        
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
        
    if not document.get("cloudinary_url"):
        raise HTTPException(status_code=400, detail="Document missing Cloudinary URL")
        
    # Set to processing
    await db.user_documents.update_one(
        {"_id": obj_id},
        {"$set": {"processing_status": "processing", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    try:
        # Run processing from local file
        local_path = os.path.join(os.path.dirname(__file__), "..", "uploads", f"{document_id}.pdf")
        result = await process_pdf_document(local_path, document_id, user_id)
        
        # Delete old chunks if any (safe reprocessing)
        await db.document_chunks.delete_many({"document_id": document_id, "user_id": user_id})
        
        # Insert new chunks
        chunks = result["chunks"]
        now_str = datetime.now(timezone.utc).isoformat()
        for chunk in chunks:
            chunk["created_at"] = now_str
            
        if chunks:
            await db.document_chunks.insert_many(chunks)
            
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
        
        # Delete local file after processing
        if os.path.exists(local_path):
            os.remove(local_path)
            
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
