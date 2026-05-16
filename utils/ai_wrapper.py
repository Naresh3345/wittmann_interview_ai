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
            text, expected = self._aptitude_question(role_name, topic)
        elif question_type == "Programming":
            text, expected = self._programming_question(topic)
            if topic.lower().startswith("easy"):
                difficulty = "Easy"
            elif topic.lower().startswith("hard"):
                difficulty = "Hard"
            else:
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
            "Logical Reasoning": ("Logical Reasoning: If all plastics are materials and some materials are recyclable, which conclusion is valid?\nOptions:\nA. All plastics are recyclable\nB. Some materials are plastics\nC. No material is recyclable\nD. All recyclable items are plastics", "B. Some materials are plastics"),
            "Verbal Ability": ("Verbal Ability: Choose the grammatically correct sentence.\nOptions:\nA. The test cases was executed\nB. The test cases were executed\nC. The test cases is executed\nD. The test cases has executed", "B. The test cases were executed"),
            "Programming Aptitude": ("Programming Aptitude: A loop starts at 1 and doubles the value each time until it becomes greater than 32. How many times does it run?\nOptions:\nA. 4\nB. 5\nC. 6\nD. 7", "C. 6"),
            "Number Series": ("Number Series: Find the next number: 3, 6, 12, 24, ?\nOptions:\nA. 36\nB. 42\nC. 48\nD. 54", "C. 48"),
            "Percentage": ("Percentage: 20% of 250 is equal to which value?\nOptions:\nA. 25\nB. 40\nC. 50\nD. 60", "C. 50"),
            "Ratio and Proportion": ("Ratio and Proportion: If A:B = 2:3 and B:C = 3:4, what is A:C?\nOptions:\nA. 1:2\nB. 2:4\nC. 2:3\nD. 3:4", "B. 2:4"),
            "Time and Work": ("Time and Work: If 4 people finish a task in 6 days, how many person-days are needed?\nOptions:\nA. 10\nB. 18\nC. 24\nD. 30", "C. 24"),
            "Data Interpretation": ("Data Interpretation: A report shows 80 passed tests out of 100 executed tests. What is the pass percentage?\nOptions:\nA. 70%\nB. 75%\nC. 80%\nD. 85%", "C. 80%"),
            "Statement and Conclusion": ("Statement and Conclusion: Statement: All robots need calibration. WITTMANN robot R1 is a robot. Conclusion: R1 needs calibration.\nOptions:\nA. Definitely true\nB. Definitely false\nC. Cannot be determined\nD. Irrelevant", "A. Definitely true"),
            "Error Spotting": ("Error Spotting: Choose the sentence without an error.\nOptions:\nA. He do the testing daily\nB. She write reports clearly\nC. They are checking the module\nD. It are working now", "C. They are checking the module"),
            "Synonyms": ("Synonyms: Choose the closest meaning of 'accurate'.\nOptions:\nA. Fast\nB. Correct\nC. Large\nD. Late", "B. Correct"),
            "Pseudocode Logic": ("Pseudocode Logic: x = 5; x = x + 3; print(x). What is printed?\nOptions:\nA. 3\nB. 5\nC. 8\nD. 15", "C. 8"),
        }
        role_question = (
            f"{topic}: In the {role_name} role, 6 out of 24 assigned tasks are marked high priority. What percentage of tasks are high priority?\nOptions:\nA. 15%\nB. 20%\nC. 25%\nD. 30%",
            "C. 25%",
        )
        return questions.get(topic, role_question)

    def _programming_question(self, topic):
        questions = {
            "Easy Java output tracing": (
                "Programming - Java compiler style question:\n\nCode:\nString s = \"test\";\nSystem.out.println(s.substring(1, 3).toUpperCase());\n\nWhat is the output?\nTest case: input = \"test\"",
                "ES",
            ),
            "Medium Python output tracing": (
                "Programming - Python compiler style question:\n\nCode:\nnums = [2, 4, 6]\nprint(sum(nums) // len(nums))\n\nWhat is the output?\nTest case: nums = [2, 4, 6]",
                "4",
            ),
            "Hard C++ output tracing": (
                "Programming - C++ compiler style question:\n\nCode:\nint a[] = {1, 2, 3, 4};\nint total = 0;\nfor (int i = 0; i < 4; i++) {\n    if (a[i] % 2 == 0) total += a[i] * i;\n}\ncout << total;\n\nWhat is the output?\nTest case: a = {1, 2, 3, 4}",
                "14",
            ),
        }
        return questions.get(topic, questions["Easy Java output tracing"])

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
