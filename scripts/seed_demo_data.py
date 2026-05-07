"""
Seed Demo Data Script
Creates sample course data and 5 test student profiles for demo purposes.
"""

import yaml
from pathlib import Path
from datetime import datetime, timedelta


DATA_DIR = "./data"


def seed_courses():
    """Create a sample course with schedule."""
    course_id = "networks_2024"
    course_dir = Path(DATA_DIR) / "memory" / "courses" / course_id
    course_dir.mkdir(parents=True, exist_ok=True)

    # Create schedule
    today = datetime.now()
    schedule = {
        "course_id": course_id,
        "course_name": "Computer Networks",
        "academic_year": "2025-2026",
        "semester": "Even",
        "schedule": [
            {
                "date": (today + timedelta(days=i)).strftime("%Y-%m-%d"),
                "topic_id": topic_id,
                "topic_name": topic_name,
                "type": "lecture",
            }
            for i, (topic_id, topic_name) in enumerate(
                [
                    ("tcp_ip", "TCP/IP Protocol Suite"),
                    ("data_link", "Data Link Layer"),
                    ("transport_layer", "Transport Layer Protocols"),
                    ("network_layer", "Network Layer & Routing"),
                    ("application_layer", "Application Layer Protocols"),
                ]
            )
        ],
        "assignments": [
            {
                "title": "Networks Lab 4 — Socket Programming",
                "due_date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
                "topic_ids": ["tcp_ip", "socket_api"],
                "description": "Implement a simple TCP client-server in Python",
            }
        ],
        "exams": [
            {
                "title": "Networks Internal Assessment 2",
                "date": (today + timedelta(days=15)).strftime("%Y-%m-%d"),
                "topics": ["tcp_ip", "transport_layer", "data_link"],
            }
        ],
    }

    with open(course_dir / "schedule.yaml", "w") as f:
        yaml.dump(schedule, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    # Create a sample KB entry
    kb = {
        "course_id": course_id,
        "course_name": "Computer Networks",
        "created_at": datetime.utcnow().isoformat(),
        "topics": [
            {
                "topic_id": "tcp_ip",
                "topic_name": "TCP/IP Protocol Suite",
                "source_file": "Unit3_TCP_IP.pdf",
                "ingested_at": datetime.utcnow().isoformat(),
                "summary_points": [
                    "TCP is connection-oriented; ensures reliable, ordered delivery via three-way handshake",
                    "UDP is connectionless; fast but provides no delivery guarantee — used for streaming/DNS",
                    "IP operates at the Network Layer, providing best-effort packet delivery across networks",
                    "TCP uses sequence numbers and ACKs for reliability; implements flow/congestion control",
                    "Efficiency formula: Stop-and-Wait = 1/(1+2a) where a = Tp/Tf — key exam concept",
                ],
                "key_terms": {
                    "TCP": "Transmission Control Protocol — reliable, ordered, connection-oriented",
                    "UDP": "User Datagram Protocol — unreliable, fast, connectionless",
                    "SYN": "Synchronise flag — initiates TCP connection",
                    "ACK": "Acknowledgement — confirms receipt of packet",
                    "RTT": "Round Trip Time — time for packet to travel and return",
                    "Three-way handshake": "SYN → SYN-ACK → ACK sequence to establish TCP connection",
                },
                "formulas": [
                    "Throughput = Window Size / RTT",
                    "Efficiency (Stop-and-Wait) = 1 / (1 + 2a) where a = Tp/Tf",
                ],
                "topic_tags": ["transport_layer", "tcp", "udp", "protocols"],
                "raw_chunks": [
                    {
                        "chunk_id": 1,
                        "text": "TCP/IP is a suite of communication protocols used to interconnect network devices on the internet. TCP provides reliable, ordered, and error-checked delivery of a stream of bytes between applications running on hosts communicating via an IP network.",
                        "word_count": 40,
                    },
                    {
                        "chunk_id": 2,
                        "text": "The three-way handshake is the method used by TCP to set up a TCP/IP connection. The three steps are: 1) SYN - The client sends a SYN segment to the server. 2) SYN-ACK - The server acknowledges with SYN-ACK. 3) ACK - The client sends ACK to establish the connection.",
                        "word_count": 52,
                    },
                    {
                        "chunk_id": 3,
                        "text": "UDP is a connectionless protocol that provides a simple unreliable message service. Unlike TCP, UDP does not guarantee delivery, ordering, or data integrity. UDP is used in applications where speed is more critical than reliability, such as video streaming, online gaming, and DNS lookups.",
                        "word_count": 48,
                    },
                ],
            }
        ],
    }

    with open(course_dir / "kb.yaml", "w") as f:
        yaml.dump(kb, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f"✅ Course '{course_id}' seeded with schedule and KB")


def seed_students():
    """Create 5 sample student profiles."""
    students_dir = Path(DATA_DIR) / "memory" / "students"
    students_dir.mkdir(parents=True, exist_ok=True)

    students = [
        ("telegram_100001", "Pavan Kumar", "1SI21CS042"),
        ("telegram_100002", "Aarav Sharma", "1SI21CS001"),
        ("telegram_100003", "Priya Nair", "1SI21CS033"),
        ("telegram_100004", "Rohit Menon", "1SI21CS036"),
        ("telegram_100005", "Sneha Reddy", "1SI21CS045"),
    ]

    for student_id, name, roll in students:
        profile = {
            "student_id": student_id,
            "name": name,
            "roll_number": roll,
            "enrolled_courses": ["networks_2024"],
            "quiz_scores": {
                "networks_2024": {
                    "tcp_ip": [80, 60, 90] if "Pavan" in name else [70, 55, 65],
                    "data_link": [70, 85] if "Pavan" in name else [50, 60],
                }
            },
            "doubt_log": [
                {
                    "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
                    "course": "networks_2024",
                    "question": "Difference between TCP and UDP?",
                    "answered": True,
                },
                {
                    "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
                    "course": "networks_2024",
                    "question": "How does three-way handshake work?",
                    "answered": True,
                },
            ],
            "weak_topics": ["transport_layer"] if "Rohit" in name else [],
            "subscription_active": True,
            "onboarded_at": (datetime.now() - timedelta(days=7)).isoformat(),
            "last_interaction": datetime.now().isoformat(),
        }

        with open(students_dir / f"{student_id}.yaml", "w") as f:
            yaml.dump(profile, f, default_flow_style=False, allow_unicode=True, sort_keys=False)

    print(f"✅ {len(students)} student profiles seeded")


def seed_inbox():
    """Create inbox directory for PDF drops."""
    inbox_dir = Path(DATA_DIR) / "inbox" / "networks_2024"
    inbox_dir.mkdir(parents=True, exist_ok=True)
    print(f"✅ Inbox created at {inbox_dir}")
    print(f"   Drop PDFs here: {inbox_dir.absolute()}")


if __name__ == "__main__":
    print("🌱 Seeding EduClaw demo data...\n")
    seed_courses()
    seed_students()
    seed_inbox()
    print("\n✅ All demo data seeded successfully!")
    print(f"\n📁 Data directory: {Path(DATA_DIR).absolute()}")
