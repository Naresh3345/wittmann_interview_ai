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
        if question_type in {"Aptitude", "Programming", "Coding"}:
            return self._local_generate_question(role_name, question_type, topic, index)
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
        if question_type == "Aptitude":
            text = self._aptitude_question(role_name, topic)
            expected = (
                f"A strong answer solves the {topic} question with clear reasoning, correct grammar or logic, "
                "and gives the final answer directly."
            )
        elif question_type == "Programming":
            text, expected = self._programming_question(topic)
            difficulty = "Medium"
        elif question_type == "Coding":
            text, expected = self._programming_question(topic)
            difficulty = "Medium"
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

    def _aptitude_question(self, role_name, topic):
        questions = {
            "Logical Reasoning": "Logical Reasoning: If all quality reports are reviewed and some reviewed reports need retesting, can every retesting report be a quality report? Explain your answer.",
            "Verbal Ability": "Verbal Ability: Choose the correct sentence and explain why: 'The test cases was executed' or 'The test cases were executed'.",
            "Programming Aptitude": "Programming Aptitude: If a loop starts at 1 and doubles the value each time until it becomes greater than 32, how many times does the loop run?",
        }
        return questions.get(topic, f"{topic}: A candidate must review 24 tasks in 4 hours for the {role_name} role. If 6 tasks are role-specific high-priority tasks, what percentage of total tasks are high priority?")

    def _programming_question(self, topic):
        questions = {
            "Java output tracing for strings": (
                "Programming - Java compiler style question:\n\nCode:\nString s = \"test\";\nSystem.out.println(s.substring(1, 3).toUpperCase());\n\nWhat is the output?\nTest case: input = \"test\"",
                "The output is ES because substring(1, 3) returns es and toUpperCase converts it to ES.",
            ),
            "Python list output tracing": (
                "Programming - Python compiler style question:\n\nCode:\nnums = [2, 4, 6]\nprint(sum(nums) // len(nums))\n\nWhat is the output?\nTest case: nums = [2, 4, 6]",
                "The output is 4 because sum(nums) is 12, len(nums) is 3, and integer division gives 4.",
            ),
            "C array output tracing": (
                "Programming - C compiler style question:\n\nCode:\nint a[3] = {1, 2, 3};\nprintf(\"%d\", a[0] + a[2]);\n\nWhat is the output?\nTest case: a = {1, 2, 3}",
                "The output is 4 because a[0] is 1 and a[2] is 3.",
            ),
            "C++ loop output tracing": (
                "Programming - C++ compiler style question:\n\nCode:\nint total = 0;\nfor (int i = 1; i <= 3; i++) total += i;\ncout << total;\n\nWhat is the output?\nTest case: loop from 1 to 3",
                "The output is 6 because 1 + 2 + 3 equals 6.",
            ),
        }
        return questions.get(topic, questions["Java output tracing for strings"])

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
