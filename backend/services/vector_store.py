import os
import json
import numpy as np
import faiss
import shutil
from pathlib import Path
from typing import List, Dict, Any, Tuple

# Path where all user indices are stored
VECTOR_INDEXES_DIR = Path(__file__).parent.parent / "vector_indexes"
VECTOR_INDEXES_DIR.mkdir(exist_ok=True)

class VectorStore:
    def __init__(self, user_id: str, dimension: int, metric="inner_product"):
        self.user_id = user_id
        self.dimension = dimension
        self.metric = metric
        self.user_dir = VECTOR_INDEXES_DIR / self.user_id
        self.index_path = self.user_dir / "index.faiss"
        self.metadata_path = self.user_dir / "metadata.json"
        
        # We ensure user_dir exists
        self.user_dir.mkdir(parents=True, exist_ok=True)
        
        self.index = None
        self.metadata = {}  # Map integer string to metadata dict
        self.next_id = 0
        
        self.load()

    def load(self):
        if self.index_path.exists() and self.metadata_path.exists():
            self.index = faiss.read_index(str(self.index_path))
            with open(self.metadata_path, "r") as f:
                self.metadata = json.load(f)
            # Find next_id
            if self.metadata:
                self.next_id = max(int(k) for k in self.metadata.keys()) + 1
            else:
                self.next_id = 0
        else:
            if self.metric == "inner_product":
                self.index = faiss.IndexFlatIP(self.dimension)
            else:
                self.index = faiss.IndexFlatL2(self.dimension)
            # Ensure index uses IDMap to allow deletion
            self.index = faiss.IndexIDMap(self.index)
            self.metadata = {}
            self.next_id = 0

    def save(self):
        faiss.write_index(self.index, str(self.index_path))
        with open(self.metadata_path, "w") as f:
            json.dump(self.metadata, f, indent=2)
            
    def add_vectors(self, vectors: np.ndarray, metadatas: List[Dict[str, Any]]):
        if len(vectors) == 0:
            return
            
        assert len(vectors) == len(metadatas)
        num_vectors = len(vectors)
        
        ids = np.arange(self.next_id, self.next_id + num_vectors, dtype=np.int64)
        
        self.index.add_with_ids(vectors, ids)
        
        for i, idx in enumerate(ids):
            self.metadata[str(idx)] = metadatas[i]
            
        self.next_id += num_vectors
        self.save()

    def remove_document_vectors(self, document_id: str) -> int:
        """Removes all vectors belonging to a specific document."""
        ids_to_remove = []
        for str_idx, meta in self.metadata.items():
            if meta.get("document_id") == document_id:
                ids_to_remove.append(int(str_idx))
                
        if not ids_to_remove:
            return 0
            
        # faiss remove_ids operates on IndexIDMap
        ids_array = np.array(ids_to_remove, dtype=np.int64)
        self.index.remove_ids(ids_array)
        
        # Remove from metadata
        for idx in ids_to_remove:
            del self.metadata[str(idx)]
            
        self.save()
        return len(ids_to_remove)
        
    def rebuild(self, vectors: np.ndarray, metadatas: List[Dict[str, Any]]):
        """Rebuilds the entire index from scratch."""
        if self.metric == "inner_product":
            self.index = faiss.IndexFlatIP(self.dimension)
        else:
            self.index = faiss.IndexFlatL2(self.dimension)
        self.index = faiss.IndexIDMap(self.index)
        self.metadata = {}
        self.next_id = 0
        
        if len(vectors) > 0:
            self.add_vectors(vectors, metadatas)
        else:
            self.save()
            
    def destroy(self):
        """Removes the index and metadata from disk."""
        if self.user_dir.exists():
            shutil.rmtree(self.user_dir)
            
    def get_count(self) -> int:
        return self.index.ntotal
