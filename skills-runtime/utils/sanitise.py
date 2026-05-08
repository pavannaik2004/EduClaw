"""
Prompt injection prevention.
Defense-in-depth — SOUL.md is the primary protection.
"""



INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"ignore all instructions",
    r"you are now",
    r"act as",
    r"pretend you are",
    r"forget everything",
    r"new persona",
    r"system prompt",
    r"jailbreak",
    r"disregard",
    r"override",
]


def sanitise_user_input(text: str, max_length: int = 500) -> str:
    """
    Sanitise user input to prevent prompt injection.

    Args:
        text: Raw user input text.
        max_length: Maximum allowed input length.

    Returns:
        Sanitised text, or a warning message if injection detected.
    """
    text_lower = text.lower().strip()

    for pattern in INJECTION_PATTERNS:
        if pattern in text_lower:
            return "[Message filtered: contains disallowed instructions]"

    # Limit input length
    return text[:max_length]
