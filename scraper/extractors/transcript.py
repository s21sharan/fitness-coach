"""VTT/transcript extraction utilities."""
import re


def parse_vtt(file_path: str) -> str:
    """Read a VTT file and return cleaned transcript text."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    return parse_vtt_string(content)


def parse_vtt_string(vtt_content: str) -> str:
    """Parse a WebVTT string into clean transcript text.

    Steps:
    1. Strip the WEBVTT header line.
    2. Remove timestamp lines (e.g. 00:00:00.000 --> 00:00:03.500 ...).
    3. Remove standalone cue IDs (lines that are only digits).
    4. Remove inline tags like <c>, </c>, <i>, etc.
    5. Deduplicate consecutive identical lines.
    6. Join non-empty lines with spaces.
    """
    # Remove WEBVTT header
    text = re.sub(r'^WEBVTT[^\n]*\n', '', vtt_content)

    # Remove timestamp lines
    text = re.sub(
        r'\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}.*\n',
        '',
        text
    )

    # Split into lines and filter
    lines = text.splitlines()

    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Skip blank lines
        if not stripped:
            continue
        # Skip standalone cue IDs (lines that are only digits)
        if stripped.isdigit():
            continue
        # Remove inline tags like <c>, </c>, <00:00:00.500>, etc.
        stripped = re.sub(r'<[^>]+>', '', stripped).strip()
        if not stripped:
            continue
        cleaned.append(stripped)

    # Deduplicate consecutive identical lines
    deduped = []
    for line in cleaned:
        if not deduped or line != deduped[-1]:
            deduped.append(line)

    return ' '.join(deduped)
