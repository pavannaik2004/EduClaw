"""
PDF Folder Watcher
Watches the inbox directory for new PDF files and auto-ingests them.
Uses watchdog for file system events.
"""

import os
import sys
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Add parent directory to path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from utils.logger import setup_logging
from pdf_digest.ingest import ingest_pdf

import structlog

setup_logging()
log = structlog.get_logger()

DATA_DIR = os.getenv("DATA_DIR", "../data")


class PDFHandler(FileSystemEventHandler):
    """Handles new PDF files dropped into course inbox folders."""

    def on_created(self, event):
        if event.is_directory:
            return

        file_path = Path(event.src_path)

        # Only process PDF files
        if file_path.suffix.lower() != ".pdf":
            return

        # Extract course_id from directory structure: inbox/{course_id}/file.pdf
        try:
            course_id = file_path.parent.name
        except Exception:
            course_id = "unknown_course"

        # Derive topic name from filename
        topic_name = file_path.stem.replace("_", " ").replace("-", " ").title()

        log.info(
            "new_pdf_detected",
            file=file_path.name,
            course_id=course_id,
            topic_name=topic_name,
        )

        # Wait a moment for the file to finish writing
        time.sleep(2)

        try:
            result = ingest_pdf(
                pdf_path=str(file_path),
                course_id=course_id,
                topic_name=topic_name,
                data_dir=DATA_DIR,
            )

            if result["success"]:
                log.info(
                    "pdf_ingestion_success",
                    topic_id=result["topic_id"],
                    summary_points=len(result["summary"].get("summary_points", [])),
                )
                print(f"✅ Ingested: {file_path.name} → topic '{result['topic_id']}'")
            else:
                log.error("pdf_ingestion_failed", error=result.get("error"))
                print(f"❌ Failed to ingest: {file_path.name} — {result.get('error')}")

        except Exception as e:
            log.error("pdf_ingestion_exception", error=str(e))
            print(f"❌ Error processing {file_path.name}: {e}")


def main():
    inbox_dir = Path(DATA_DIR) / "inbox"
    inbox_dir.mkdir(parents=True, exist_ok=True)

    print(f"👁️  EduClaw PDF Watcher started")
    print(f"📁 Watching: {inbox_dir.absolute()}")
    print(f"   Drop PDFs into: {inbox_dir.absolute()}/{{course_id}}/")
    print(f"   Example: {inbox_dir.absolute()}/networks_2024/lecture5.pdf")
    print(f"   Press Ctrl+C to stop.\n")

    handler = PDFHandler()
    observer = Observer()
    observer.schedule(handler, str(inbox_dir), recursive=True)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n👋 PDF Watcher stopped.")

    observer.join()


if __name__ == "__main__":
    main()
