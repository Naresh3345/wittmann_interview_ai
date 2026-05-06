import json
import os
import urllib.request

from utils.scoring import feedback_from_score, score_answer


class AIWrapper:
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "local").strip().lower()
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip()

    def generate_question(self, role_name, question_type, topic, index):
        if self.provider == "openai" and self.api_key:
            generated = self._openai_generate_question(role_name, question_type, topic, index)
            if generated:
                return generated
        return self._local_generate_question(role_name, question_type, topic, index)

    def evaluate_answer(self, answer, question):
        base_score = score_answer(answer, question)
        feedback = feedback_from_score(base_score["total_score"])
        if self.provider == "openai" and self.api_key and answer.strip():
            ai_feedback = self._openai_feedback(answer, question, base_score)
            if ai_feedback:
                feedback = ai_feedback
        return {
            "score": base_score,
            "feedback": feedback,
        }

    def _local_generate_question(self, role_name, question_type, topic, index):
        difficulty = "Easy" if index % 2 else "Medium"
        if question_type == "Technical":
            text = f"Explain {topic} for the {role_name} role and give one practical WITTMANN interview example."
            expected = (
                f"A strong answer explains {topic}, connects it to the {role_name} role, "
                "and includes a practical example related to WITTMANN quality, customer support, automation, or software work."
            )
        elif question_type == "HR":
            text = f"How would you show {topic} while working in a WITTMANN {role_name} team?"
            expected = (
                f"A strong answer gives a clear personal example of {topic}, shows communication and ownership, "
                "and explains how the candidate would work professionally with the WITTMANN team."
            )
        else:
            text = f"Describe a project experience where you used {topic} and how it matches the {role_name} role."
            expected = (
                f"A strong answer describes the project context, the candidate's contribution in {topic}, "
                "the tools or methods used, the result, and how it connects to the selected WITTMANN role."
            )
        return {
            "question": text,
            "expected_answer": expected,
            "difficulty": difficulty,
        }

    def _openai_generate_question(self, role_name, question_type, topic, index):
        prompt = (
            "Generate one concise interview question and expected answer as JSON. "
            f"Role: {role_name}. Question type: {question_type}. Topic: {topic}. "
            "Difficulty must be Easy or Medium. Keys: question, expected_answer, difficulty."
        )
        data = self._openai_json(prompt)
        if not data:
            return None
        if not all(key in data for key in ("question", "expected_answer", "difficulty")):
            return None
        return data

    def _openai_feedback(self, answer, question, score):
        prompt = (
            "Give short interview feedback in one sentence. "
            f"Question: {question.get('question')}. Expected answer: {question.get('ideal_answer')}. "
            f"Candidate answer: {answer}. Local score: {score['total_score']}%."
        )
        data = self._openai_json(prompt)
        return data.get("feedback") if data else None

    def _openai_json(self, prompt):
        request_body = {
            "model": self.model,
            "input": prompt,
            "text": {"format": {"type": "json_object"}},
        }
        request = urllib.request.Request(
            "https://api.openai.com/v1/responses",
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            text = self._extract_response_text(payload)
            return json.loads(text) if text else None
        except Exception:
            return None

    def _extract_response_text(self, payload):
        if payload.get("output_text"):
            return payload["output_text"]
        for item in payload.get("output", []):
            for content in item.get("content", []):
                if content.get("type") in {"output_text", "text"}:
                    return content.get("text", "")
        return ""


ai_wrapper = AIWrapper()
