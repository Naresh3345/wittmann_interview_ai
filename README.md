# Wittmann AI-Based Smart Interview System

A professional final-year B.Tech AI & Data Analytics project for a company-focused mock interview system inspired by WITTMANN BATTENFELD's plastics injection molding, automation, robotics, peripheral equipment, and Industry 4.0 ecosystem.

## Features

- Company-specific WITTMANN interview questions
- NLP answer scoring using keyword matching + TF-IDF semantic similarity
- Webcam face presence and confidence signal analysis using OpenCV
- Browser speech-to-text support for voice answers
- Professional Flask web interface
- PDF interview report generation
- No paid APIs required

## Tech Stack

- Python
- Flask
- PostgreSQL database and live question bank
- OpenCV
- Scikit-learn
- HTML, CSS, JavaScript
- ReportLab PDF generation

## Folder Structure

```text
wittmann_interview_ai/
├── app.py
├── requirements.txt
├── .env.example
├── README.md
├── data/
│   └── questions.json
├── reports/
│   └── .gitkeep
├── static/
│   ├── css/style.css
│   └── js/interview.js
├── templates/
│   ├── base.html
│   ├── index.html
│   └── interview.html
└── utils/
    ├── scoring.py
    └── report.py
```

## How to Run

### 1. Create virtual environment

```bash
python -m venv venv
```

### 2. Activate virtual environment

Windows PowerShell:

```bash
venv\Scripts\activate
```

Mac/Linux:

```bash
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the project

```bash
python app.py
```

Open this URL in Chrome:

```text
https://127.0.0.1:5000
```

For another system on the same Wi-Fi/LAN, open the host machine address shown in the Flask terminal, for example:

```text
https://192.168.70.102:5000
```

The LAN certificate must be trusted on each Windows computer that opens the interview link. On each computer, open PowerShell as Administrator from the project folder and run:

```powershell
.\scripts\trust_lan_certificate.ps1
```

Restart Chrome/Edge after installing the certificate, then open:

```text
https://192.168.70.102:5000
```

If the browser still shows "Your connection isn't private", the app is running with a temporary certificate or that computer has not trusted `.certs\lan-server.crt` yet.

To temporarily run without HTTPS, set this in `.env`, but camera and microphone will be blocked on LAN IP addresses:

```text
ENABLE_HTTPS=0
```

## Important Notes

- Use Chrome for speech recognition.
- Use HTTPS for camera and microphone when opening the app from another system on the LAN.
- Allow camera permission for face analysis.
- The system works without camera also; only text/NLP scoring will be used.
- Reports are saved in the `reports` folder.

## PostgreSQL Database And Question Bank

All application data and the live question bank are stored in PostgreSQL. HR/admin can edit questions directly in the separate HR portal, pgAdmin, DBeaver, or SQL while the Flask app is running.

### Local setup

Add these values to `.env`:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wittmann_interview_ai
```

Create the starter tables and seed the editable question bank:

```bash
python scripts/seed_postgres_starter_bank.py
```

To import your own reviewed JSON questions:

```bash
python scripts/import_postgres_questions.py
```

To refresh the role and pattern metadata:

```bash
python scripts/sync_question_metadata_to_postgres.py
```

To migrate existing local SQLite operational data into PostgreSQL:

```bash
python scripts/migrate_sqlite_to_postgres.py
```

The editable table is:

```text
question_bank
```

Open it in the HR portal or your PostgreSQL client to create, edit, disable, or import questions.

### Question format

```json
{
  "question_code": "manual-testing-aptitude-001",
  "role_slug": "manual-testing",
  "section": "Aptitude",
  "topic": "Logical Reasoning",
  "difficulty": "Easy",
  "question_text": "Question text",
  "options": ["A...", "B...", "C...", "D..."],
  "correct_answer": "B...",
  "keywords": ["logical", "reasoning"],
  "marks": 5,
  "active": true
}
```

### Live exam behavior

- PostgreSQL `question_bank` is the source of truth for the editable question bank.
- Each candidate receives a randomized role-based paper when the interview starts.
- The exact assigned paper is copied into PostgreSQL `interview_questions` so later edits in `question_bank` do not change an active or completed interview.
- Question selection favors the least-used questions first to reduce overlap when many candidates start at the same time.
- To give 200 candidates completely non-overlapping 18-question papers for one role, the bank would need at least 3,600 active questions for that role. A 500-question bank supports different randomized papers, but not zero reuse across all candidates.

## Suggested Final Year Enhancements

1. Add user login for HR/admin.
2. Store candidates and scores in MySQL.
3. Add BERT or Sentence Transformers for better NLP scoring.
4. Add role-based questions: AI Engineer, Data Analyst, Automation Engineer.
5. Add dashboard analytics using Chart.js or Power BI.

## Academic Project Title

**AI-Based Smart Interview System for WITTMANN BATTENFELD using NLP, Computer Vision, and Data Analytics**

## Disclaimer

This is an academic/demo project. Company-specific content is prepared for educational use and should be reviewed before official company deployment.
