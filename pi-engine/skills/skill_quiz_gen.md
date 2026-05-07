# Skill: Quiz Generation

## Description
Generates multiple-choice questions from course knowledge base content.
Triggered by HEARTBEAT at 6 PM daily or manually via /quiz command.

## Trigger
- HEARTBEAT: daily at 6 PM
- User command: /quiz {course_name}

## Input
- Course ID
- Topic ID (from today's schedule or user-specified)
- Count (default: 3)

## Process
1. Get today's topic from course schedule YAML
2. Retrieve relevant KB chunks for the topic
3. Send to Claude API with quiz generation prompt
4. Parse JSON response (validate 4 options, 1 correct)
5. Format for Telegram (sendPoll)
6. Send to all subscribed students
7. Collect answers, log scores to student YAML

## Output
- List of MCQ questions with options, correct answer, explanation

## Runtime
- Language: Python 3.12
- Endpoint: POST `/skill/quiz_gen`
