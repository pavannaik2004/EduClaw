# Skill: Calendar Watch (Deadline Prep-Coach)

## Description
Reads course schedule YAML and sends personalized deadline alerts 3 days before
assignments/exams. Includes weak-topic drill recommendations.

## Trigger
- HEARTBEAT: daily at 9 AM

## Process
1. Read schedule.yaml for each course
2. Find assignments/exams due within 3 days
3. For each student, check Cognitive RAM for weak topics
4. Generate personalized prep checklist
5. Send alert via Telegram

## Runtime
- Language: Python 3.12
- Endpoint: POST `/skill/calendar_watch`
