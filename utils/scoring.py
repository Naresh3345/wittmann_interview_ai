import re
from typing import Dict, List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def clean_text(text: str) -> str:
    text = text or ""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def keyword_score(answer: str, keywords: List[str]) -> float:
    answer_clean = clean_text(answer)
    if not keywords:
        return 0.0
    hits = 0
    for kw in keywords:
        if clean_text(kw) in answer_clean:
            hits += 1
    return hits / len(keywords)


def semantic_score(answer: str, ideal_answer: str) -> float:
    answer = clean_text(answer)
    ideal_answer = clean_text(ideal_answer)
    if not answer or len(answer.split()) < 3:
        return 0.0
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    vectors = vectorizer.fit_transform([answer, ideal_answer])
    answer_vec = vectors.getrow(0)
    ideal_vec = vectors.getrow(1)
    return float(cosine_similarity(answer_vec, ideal_vec)[0, 0])


def communication_score(answer: str) -> float:
    words = clean_text(answer).split()
    if not words:
        return 0.0
    length_score = min(len(words) / 70, 1.0)
    unique_ratio = len(set(words)) / max(len(words), 1)
    clarity_score = 1.0 if 25 <= len(words) <= 120 else 0.65
    return float((length_score * 0.45) + (unique_ratio * 0.25) + (clarity_score * 0.30))


def score_answer(answer: str, question: Dict) -> Dict:
    kw = keyword_score(answer, question.get("keywords", []))
    sem = semantic_score(answer, question.get("ideal_answer", ""))
    comm = communication_score(answer)
    total = (kw * 0.35) + (sem * 0.45) + (comm * 0.20)
    return {
        "keyword_score": round(kw * 100, 2),
        "semantic_score": round(sem * 100, 2),
        "communication_score": round(comm * 100, 2),
        "total_score": round(total * 100, 2),
        "matched_keywords": [kw for kw in question.get("keywords", []) if clean_text(kw) in clean_text(answer)],
        "missing_keywords": [kw for kw in question.get("keywords", []) if clean_text(kw) not in clean_text(answer)],
    }


def feedback_from_score(score: float) -> str:
    if score >= 80:
        return "Excellent answer. Strong technical relevance and clear company alignment."
    if score >= 65:
        return "Good answer. Add more specific production, automation, or Industry 4.0 examples to improve."
    if score >= 45:
        return "Average answer. Include more WITTMANN-related keywords and explain your idea with clearer structure."
    return "Needs improvement. Try to answer with specific technical points, practical examples, and company context."
