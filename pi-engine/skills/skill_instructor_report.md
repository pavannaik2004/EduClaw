# Skill: Instructor Report

## Description
Generates weekly analytics report for instructors. Aggregates student doubt logs,
quiz scores, and identifies topics needing re-teaching.

## Trigger
- HEARTBEAT: Friday at 5 PM

## Process
1. Read all student YAML profiles for the course
2. Aggregate doubts by topic for the past 7 days
3. Compute quiz score averages per topic
4. Identify weak topics (avg score < 60%)
5. Generate .docx report using python-docx
6. Email to instructor via SendGrid

## Runtime
- Language: Python 3.12
- Endpoint: POST `/skill/instructor_report`
