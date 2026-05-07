# Skill: PDF Digest

## Description
Watches the inbox folder for new PDF files. When detected, extracts text, chunks it, 
summarizes using Claude API, and stores structured output in the course knowledge base.

## Trigger
- File watcher on `/data/inbox/{course_id}/`
- HEARTBEAT: daily at 7 AM for sending summaries

## Input
- PDF file path
- Course ID
- Topic name (derived from filename if not specified)

## Process
1. Extract text from PDF (PyMuPDF primary, pdfplumber fallback)
2. Clean text (strip headers, footers, page numbers)
3. Chunk text (512 tokens, 50-token overlap)
4. Send chunks to Claude API for summarization
5. Parse structured JSON response
6. Write to `/data/memory/courses/{course_id}/kb.yaml`

## Output
- 5-point summary
- Key terms with definitions
- Formulas list
- Topic tags
- Raw chunks stored for retrieval

## Runtime
- Language: Python 3.12
- Endpoint: POST `/skill/pdf_digest`
