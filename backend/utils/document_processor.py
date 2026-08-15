import io
import os
import re
import httpx
from pypdf import PdfReader
from typing import List, Dict

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

def clean_text(text: str) -> str:
    """Cleans extracted text by normalizing whitespace and line breaks."""
    # Replace multiple spaces with a single space
    text = re.sub(r' +', ' ', text)
    # Replace 3 or more newlines with double newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Strip leading/trailing whitespace
    return text.strip()

def chunk_text(page_texts: List[Dict]) -> List[Dict]:
    """
    Splits text into chunks of approx CHUNK_SIZE characters with CHUNK_OVERLAP.
    Preserves page metadata.
    page_texts is a list of dicts: {"page_num": int, "text": str}
    """
    chunks = []
    chunk_index = 0
    current_chunk = ""
    start_page = 1
    
    for pt in page_texts:
        page_num = pt["page_num"]
        text = pt["text"]
        
        # If this is the start of a new chunk, record the start page
        if not current_chunk:
            start_page = page_num
            
        words = text.split(" ")
        
        for word in words:
            if len(current_chunk) + len(word) + 1 > CHUNK_SIZE:
                # Store the current chunk
                chunks.append({
                    "chunk_index": chunk_index,
                    "page_start": start_page,
                    "page_end": page_num,
                    "text": current_chunk.strip()
                })
                chunk_index += 1
                
                # Start new chunk with overlap
                # Go back roughly OVERLAP characters from the end of current_chunk
                overlap_text = current_chunk[-CHUNK_OVERLAP:] if len(current_chunk) > CHUNK_OVERLAP else current_chunk
                # Find the first space in overlap_text to not split words
                space_idx = overlap_text.find(' ')
                if space_idx != -1:
                    overlap_text = overlap_text[space_idx+1:]
                
                current_chunk = overlap_text + " " + word
                # We assume the new chunk effectively starts near this page_num
                start_page = page_num
            else:
                if current_chunk:
                    current_chunk += " " + word
                else:
                    current_chunk = word
                    
    # Add any remaining text
    if current_chunk.strip():
        chunks.append({
            "chunk_index": chunk_index,
            "page_start": start_page,
            "page_end": page_texts[-1]["page_num"] if page_texts else 1,
            "text": current_chunk.strip()
        })
        
    return chunks

async def process_pdf_document(local_path: str, document_id: str, user_id: str) -> Dict:
    """
    Reads a PDF from local path, extracts text, cleans it, and chunks it.
    Returns {"success": True, "chunks": [...], "page_count": N}
    Raises Exception if no text is extractable or read fails.
    """
    if not os.path.exists(local_path):
        raise ValueError("PDF file not found on server for processing. Please re-upload the document.")
        
    # 1. Read PDF locally
    with open(local_path, "rb") as f:
        pdf_bytes = f.read()
        
    # 2. Extract text
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_texts = []
    
    total_pages = len(reader.pages)
    
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            cleaned = clean_text(text)
            if cleaned:
                page_texts.append({
                    "page_num": i + 1,
                    "text": cleaned
                })
                
    if not page_texts:
        raise ValueError("No extractable text found in PDF.")
        
    # 3. Chunk text
    chunks = chunk_text(page_texts)
    
    if not chunks:
        raise ValueError("Failed to create chunks from text.")
        
    # Add ownership metadata
    for chunk in chunks:
        chunk["document_id"] = document_id
        chunk["user_id"] = user_id
        
    return {
        "success": True,
        "chunks": chunks,
        "page_count": total_pages,
        "chunk_count": len(chunks)
    }
