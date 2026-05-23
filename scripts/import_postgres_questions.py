import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
load_dotenv()

from utils.database import init_db
from utils.question_bank import ensure_question_bank_indexes, import_questions_from_json


if __name__ == "__main__":
    source = BASE_DIR / "data" / "postgres_questions.sample.json"
    init_db()
    ensure_question_bank_indexes()
    total = import_questions_from_json(source)
    print(f"Imported or updated {total} PostgreSQL questions from {source}")
