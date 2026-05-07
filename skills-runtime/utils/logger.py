"""
Structured logging setup using structlog.
All logs are JSON-formatted for easy querying.
"""

import structlog
import logging
from pathlib import Path


def setup_logging(log_dir: str = "./data/logs"):
    """Configure structured JSON logging."""
    Path(log_dir).mkdir(parents=True, exist_ok=True)

    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.BoundLogger,
        logger_factory=structlog.PrintLoggerFactory(),
    )

    # Also configure standard logging to use structlog
    logging.basicConfig(
        format="%(message)s",
        level=logging.INFO,
    )
