"""Semantic similarity backend.

Preferred: Sentence Transformers (all-MiniLM-L6-v2) - true contextual embeddings.
Fallback:  TF-IDF (word + char n-grams, scikit-learn) - lexical similarity only. It is NOT
           contextual; `info()` reports which one is active so the UI can state it plainly.
"""
from __future__ import annotations
import numpy as np

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

_st_model = None
_st_tried = False


def _load_st():
    global _st_model, _st_tried
    if _st_tried:
        return _st_model
    _st_tried = True
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        _st_model = SentenceTransformer(MODEL_NAME)
    except Exception:
        _st_model = None
    return _st_model


def info() -> dict:
    m = _load_st()
    if m is not None:
        return {"engine": "sentence-transformers", "model": MODEL_NAME, "contextual": True,
                "note": "Semantic embeddings active."}
    return {"engine": "tfidf-fallback", "model": "TF-IDF (scikit-learn)", "contextual": False,
            "note": "sentence-transformers is not installed/available: semantic matching falls back to TF-IDF "
                    "lexical similarity, which cannot link differently-worded phrases as well."}


def is_contextual() -> bool:
    return _load_st() is not None


# calibration: raw cosine -> 0..1 relevance
def calibrate(raw: float) -> float:
    lo, hi = (0.15, 0.65) if is_contextual() else (0.02, 0.35)
    return float(min(1.0, max(0.0, (raw - lo) / (hi - lo))))


# threshold above which a skill concept counts as evidenced by a resume sentence
def concept_threshold() -> float:
    return 0.50 if is_contextual() else 0.22


def similarity_matrix(queries: list[str], docs: list[str]) -> np.ndarray:
    """Cosine similarity matrix (len(queries) x len(docs))."""
    if not queries or not docs:
        return np.zeros((len(queries), len(docs)))
    m = _load_st()
    if m is not None:
        q = m.encode(queries, normalize_embeddings=True, show_progress_bar=False)
        d = m.encode(docs, normalize_embeddings=True, show_progress_bar=False)
        return np.asarray(q) @ np.asarray(d).T
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    corpus = queries + docs
    vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True).fit(corpus)
    return cosine_similarity(vec.transform(queries), vec.transform(docs))
