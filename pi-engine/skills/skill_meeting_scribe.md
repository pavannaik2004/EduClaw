# Skill: Meeting Scribe

## Description
Takes a meeting transcript and generates structured meeting minutes.

## Trigger
- User command: /scribe followed by transcript text

## Process
1. Receive transcript text
2. Send to Claude API with meeting minutes prompt
3. Generate structured output: agenda, decisions, action items, next steps
4. Return formatted minutes

## Runtime
- Language: Python 3.12
- Endpoint: POST `/skill/meeting_scribe`
