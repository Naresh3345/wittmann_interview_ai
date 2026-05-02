# Whittmann AI-Based Smart Interview System

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
http://127.0.0.1:5000
```

## Important Notes

- Use Chrome for speech recognition.
- Allow camera permission for face analysis.
- The system works without camera also; only text/NLP scoring will be used.
- Reports are saved in the `reports` folder.

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
