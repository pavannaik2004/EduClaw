"""
PDF Ingestion Pipeline
Extracts text from PDFs, chunks, summarises via OpenAI API,
and writes structured output to course knowledge base YAML.
"""

import fitz  # PyMuPDF
import pdfplumber
import yaml
import json
import re
import os
from pathlib import Path
from openai import OpenAI
from datetime import datetime

import structlog

log = structlog.get_logger()

LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
client = OpenAI()

CHUNK_SIZE = 512  # words
CHUNK_OVERLAP = 50
MAX_CHUNKS_FOR_SUMMARY = 10


def extract_text_pymupdf(pdf_path: str) -> str:
    """Primary extraction method. Fast, handles most PDFs."""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


def extract_text_pdfplumber(pdf_path: str) -> str:
    """Fallback. Better for table-heavy PDFs."""
    with pdfplumber.open(pdf_path) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    return text.strip()


def is_scanned_pdf(text: str, min_chars: int = 100) -> bool:
    """Detect if PDF has no extractable text (scanned image)."""
    return len(text.strip()) < min_chars


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    chunks = []
    start = 0
    chunk_id = 1

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_text_str = " ".join(words[start:end])
        chunks.append(
            {
                "chunk_id": chunk_id,
                "text": chunk_text_str,
                "word_count": end - start,
            }
        )
        chunk_id += 1
        start += chunk_size - overlap

    return chunks


def summarise_with_llm(chunks: list[dict], course_name: str) -> dict:
    """Send chunks to OpenAI, get structured summary."""
    selected_chunks = chunks[:MAX_CHUNKS_FOR_SUMMARY]
    combined_text = "\n\n---\n\n".join(c["text"] for c in selected_chunks)

    prompt = f"""Summarise the following lecture content for an engineering student studying {course_name}.

CONTENT:
{combined_text}

OUTPUT FORMAT (JSON only, no markdown fences, no explanation):
{{
  "summary_points": [
    "Point 1 — most important concept",
    "Point 2",
    "Point 3",
    "Point 4",
    "Point 5 — most likely exam question"
  ],
  "key_terms": {{
    "term1": "definition",
    "term2": "definition"
  }},
  "formulas": ["formula1 with context"],
  "topic_tags": ["tag1", "tag2"]
}}

RULES:
- Exactly 5 summary_points
- Max 15 key_terms
- Only include formulas actually in the content
- topic_tags: 1-3 words, lowercase, underscore_separated
"""

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": "You are an academic content summarizer. Output valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1000,
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()
    # Strip markdown fences if present
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.error("llm_json_parse_error", raw_response=raw[:200])
        return {
            "summary_points": ["Summary generation failed — raw text stored for retrieval"],
            "key_terms": {},
            "formulas": [],
            "topic_tags": [],
        }


def write_to_kb(
    course_id: str,
    topic_id: str,
    topic_name: str,
    source_file: str,
    summary: dict,
    chunks: list[dict],
    memory_dir: str = "./data/memory",
) -> None:
    """Append new topic to course knowledge base YAML."""
    from utils.yaml_io import read_yaml, write_yaml

    kb_path = Path(memory_dir) / "courses" / course_id / "kb.yaml"
    kb_path.parent.mkdir(parents=True, exist_ok=True)

    kb = read_yaml(kb_path) or {
        "course_id": course_id,
        "created_at": datetime.utcnow().isoformat(),
        "topics": [],
    }

    # Check if topic already exists
    existing_ids = [t["topic_id"] for t in kb.get("topics", [])]
    if topic_id in existing_ids:
        log.info("topic_already_exists", topic_id=topic_id, course_id=course_id)
        return

    new_topic = {
        "topic_id": topic_id,
        "topic_name": topic_name,
        "source_file": source_file,
        "ingested_at": datetime.utcnow().isoformat(),
        "summary_points": summary.get("summary_points", []),
        "key_terms": summary.get("key_terms", {}),
        "formulas": summary.get("formulas", []),
        "topic_tags": summary.get("topic_tags", []),
        "raw_chunks": chunks[:20],
    }

    kb.setdefault("topics", []).append(new_topic)
    write_yaml(kb_path, kb)
    log.info("kb_updated", course_id=course_id, topic_id=topic_id)


def get_kb_for_course(course_id: str, memory_dir: str = "./data/memory") -> dict | None:
    """Load the full KB for a course."""
    from utils.yaml_io import read_yaml

    kb_path = Path(memory_dir) / "courses" / course_id / "kb.yaml"
    return read_yaml(kb_path)


def ingest_pdf(
    pdf_path: str,
    course_id: str,
    topic_name: str,
    data_dir: str = "./data",
) -> dict:
    """
    Main ingestion function.
    Returns: {"success": bool, "topic_id": str, "summary": dict}
    """
    pdf_path_obj = Path(pdf_path)
    topic_id = pdf_path_obj.stem.lower().replace(" ", "_").replace("-", "_")
    memory_dir = f"{data_dir}/memory"

    log.info("pdf_ingestion_started", pdf=pdf_path_obj.name, course_id=course_id)

    # Extract text
    text = extract_text_pymupdf(str(pdf_path_obj))
    if is_scanned_pdf(text):
        log.warning("scanned_pdf_detected", pdf=pdf_path_obj.name)
        text = extract_text_pdfplumber(str(pdf_path_obj))
        if is_scanned_pdf(text):
            log.error("no_extractable_text", pdf=pdf_path_obj.name)
            return {"success": False, "error": "scanned_pdf_no_text"}

    # Chunk
    chunks = chunk_text(text)
    log.info("chunking_complete", chunk_count=len(chunks))

    # Summarise
    summary = summarise_with_llm(chunks, course_name=topic_name)

    # Write to KB
    write_to_kb(course_id, topic_id, topic_name, pdf_path_obj.name, summary, chunks, memory_dir)

    log.info("pdf_ingestion_complete", topic_id=topic_id)
    return {"success": True, "topic_id": topic_id, "summary": summary}
