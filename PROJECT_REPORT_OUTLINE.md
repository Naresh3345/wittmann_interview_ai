# Project Report Outline

## 1. Abstract
This project presents an AI-Based Smart Interview System designed for WITTMANN BATTENFELD-oriented candidate evaluation. It uses NLP for answer assessment, OpenCV for facial confidence analysis, browser speech recognition for voice input, and PDF reporting for HR-style evaluation.

## 2. Problem Statement
Traditional interviews require manual evaluation and may lack structured scoring. This project automates initial mock interview evaluation by analyzing technical answers, communication quality, keyword relevance, and facial engagement.

## 3. Objectives
- Conduct company-specific mock interviews.
- Score answers using NLP.
- Analyze candidate face presence and confidence indicators.
- Generate professional feedback and PDF reports.
- Build a no-cost deployable prototype.

## 4. Methodology
- Flask handles web routes and API endpoints.
- Questions are loaded from JSON.
- Answers are scored using TF-IDF semantic similarity, keyword matching, and communication heuristics.
- Webcam frames are processed with OpenCV Haar cascades.
- ReportLab generates the final candidate report.

## 5. Modules
- Candidate Interface
- Question Bank
- NLP Scoring Engine
- Face Analysis Engine
- Result Dashboard
- PDF Report Generator

## 6. Future Scope
- BERT-based scoring
- MySQL candidate database
- Admin dashboard
- Real emotion recognition model
- Integration with HR systems
