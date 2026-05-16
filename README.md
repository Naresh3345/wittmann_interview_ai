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
- MongoDB question bank
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

Chrome may show a certificate warning the first time because the app creates a local development certificate. Click **Advanced**, continue to the site, then allow camera and microphone permission.

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

## MongoDB Question Bank

The live question bank is stored in MongoDB so HR/admin can edit questions directly in MongoDB Compass without changing application code.

### Local setup

Add these values to `.env`:

```text
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DB_NAME=wittmann_interview_ai
```

Create the starter collections and indexes:

```bash
python scripts/seed_mongodb_starter_bank.py
```

To import your own reviewed JSON questions:

```bash
python scripts/import_mongodb_questions.py
```

To make the role and pattern metadata visible in MongoDB Compass:

```bash
python scripts/sync_question_metadata_to_mongodb.py
```

This creates:

```text
roles
question_patterns
```

If you also want a read-only mirror of the current SQLite operational tables inside Compass for visibility:

```bash
python scripts/mirror_sqlite_to_mongodb.py
```

This creates:

```text
sqlite_users
sqlite_interviews
sqlite_candidate_answers
sqlite_test_links
sqlite_interview_questions
```

These mirrored collections are for reference only while the app remains on Option A. The live editable question source remains `questions`.

The editable collection is:

```text
wittmann_interview_ai.questions
```

Open it in MongoDB Compass to create, edit, disable, or import questions.

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

- MongoDB is the source of truth for the editable question bank.
- Each candidate receives a randomized role-based paper when the interview starts.
- The exact assigned paper is copied into SQLite `interview_questions` so later edits in MongoDB do not change an active or completed interview.
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
