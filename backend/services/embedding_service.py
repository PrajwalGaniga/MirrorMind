import os
import threading
import numpy as np
from typing import List
from sentence_transformers import SentenceTransformer
from pathlib import Path

# In the MirrorMind project, the ML model names are stored in ml_models
MODEL_DIR = Path(__file__).parent.parent / "ml_models"

class EmbeddingService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(EmbeddingService, cls).__new__(cls)
                cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        try:
            embed_name = (MODEL_DIR / "embedding_model.txt").read_text().strip()
        except FileNotFoundError:
            # Fallback if the file isn't there, as specified in requirements
            embed_name = "sentence-transformers/all-MiniLM-L6-v2"
            
        self.model_name = embed_name
        self.model = SentenceTransformer(self.model_name, device="cpu")
        # Ensure we can get the embedding dimension
        dummy = self.model.encode(["test"])
        self.dimension = dummy.shape[1]

    def embed(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """
        Generates normalized embeddings for a list of texts.
        Batch size is configurable but defaults to 32 to prevent RAM exhaustion.
        """
        if not texts:
            return np.empty((0, self.dimension))
            
        embeddings = self.model.encode(
            texts, 
            batch_size=batch_size, 
            normalize_embeddings=True
        )
        return embeddings

    def get_dimension(self) -> int:
        return self.dimension
        
    def get_model_name(self) -> str:
        return self.model_name

# Singleton accessor
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
