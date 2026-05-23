import sys
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
load_dotenv()

from utils.database import init_db


if __name__ == "__main__":
    init_db()
    print("Synced roles and question_patterns into PostgreSQL.")
