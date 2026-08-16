from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional

from auth_utils import get_current_user
from db import get_db
from services.retrieval_service import retrieve_semantic_chunks

router = APIRouter()

class RetrievalRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=10)

@router.post("/search")
async def search_documents(request: RetrievalRequest, user_id: str = Depends(get_current_user), db = Depends(get_db)):
    try:
        results = await retrieve_semantic_chunks(
            user_id=user_id,
            query=request.query,
            db=db,
            top_k=request.top_k
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error during semantic retrieval.")
