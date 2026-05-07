# EduClaw HEARTBEAT Schedule

## Daily Digest (Pre-class)
trigger: "0 7 * * 1-6"   # 7 AM, Monday–Saturday
action: skill_pdf_digest
params:
  mode: "send_today_summary"
  course_schedule: "memory/courses/{course_id}/schedule.yaml"

## Daily Quiz (Post-class)
trigger: "0 18 * * 1-6"  # 6 PM, Monday–Saturday
action: skill_quiz_gen
params:
  topic: "today_from_schedule"
  count: 3

## Deadline Watch
trigger: "0 9 * * *"     # 9 AM daily
action: skill_calendar_watch
params:
  lookahead_days: 3

## Weekly Instructor Report
trigger: "0 17 * * 5"    # 5 PM Friday
action: skill_instructor_report
params:
  period: "last_7_days"
  send_via: "email"
