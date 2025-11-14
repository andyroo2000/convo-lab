"""
Kanji/Kana alignment logic for furigana generation.

Handles the complex rules for determining where to place furigana brackets:
- Okurigana (食べる → 食[た]べる)
- Compounds with hiragana (買い物 → 買[か]い物[もの])
- Pure kanji compounds (果物 → 果物[くだもの])
"""

import unicodedata
from typing import List, Tuple, Optional


def is_kanji(char: str) -> bool:
    """Check if a character is a kanji."""
    if not char:
        return False
    # CJK Unified Ideographs and extensions
    code = ord(char)
    return (
        (0x4E00 <= code <= 0x9FFF) or  # CJK Unified Ideographs
        (0x3400 <= code <= 0x4DBF) or  # CJK Unified Ideographs Extension A
        (0x20000 <= code <= 0x2A6DF) or  # CJK Unified Ideographs Extension B
        (0x2A700 <= code <= 0x2B73F) or  # CJK Unified Ideographs Extension C
        (0x2B740 <= code <= 0x2B81F) or  # CJK Unified Ideographs Extension D
        (0x2B820 <= code <= 0x2CEAF) or  # CJK Unified Ideographs Extension E
        (0xF900 <= code <= 0xFAFF) or  # CJK Compatibility Ideographs
        (0x2F800 <= code <= 0x2FA1F)  # CJK Compatibility Ideographs Supplement
    )


def is_hiragana(char: str) -> bool:
    """Check if a character is hiragana."""
    if not char:
        return False
    code = ord(char)
    return 0x3040 <= code <= 0x309F


def is_katakana(char: str) -> bool:
    """Check if a character is katakana."""
    if not char:
        return False
    code = ord(char)
    return 0x30A0 <= code <= 0x30FF


def is_kana(char: str) -> bool:
    """Check if a character is hiragana or katakana."""
    return is_hiragana(char) or is_katakana(char)


def segment_surface(surface: str) -> List[Tuple[str, str]]:
    """
    Segment a surface form into runs of KANJI, KANA, or OTHER.

    Returns list of (text, type) tuples where type is 'KANJI', 'KANA', or 'OTHER'.
    """
    if not surface:
        return []

    segments = []
    current_text = surface[0]

    if is_kanji(surface[0]):
        current_type = 'KANJI'
    elif is_kana(surface[0]):
        current_type = 'KANA'
    else:
        current_type = 'OTHER'

    for char in surface[1:]:
        if is_kanji(char):
            char_type = 'KANJI'
        elif is_kana(char):
            char_type = 'KANA'
        else:
            char_type = 'OTHER'

        if char_type == current_type:
            current_text += char
        else:
            segments.append((current_text, current_type))
            current_text = char
            current_type = char_type

    segments.append((current_text, current_type))
    return segments


def align_furigana(surface: str, reading: str, is_jukujikun: bool = False) -> str:
    """
    Align kanji surface form with its reading to produce bracketed furigana.

    Rules:
    1. If is_jukujikun, treat entire surface as one unit
    2. If surface is all kana, return as-is (no brackets)
    3. If surface has hiragana between kanji, separate each kanji with its reading
    4. If surface is pure kanji, group them together (unless multiple readings needed)

    Args:
        surface: The surface form (e.g., "買い物", "食べる")
        reading: The full reading in hiragana (e.g., "かいもの", "たべる")
        is_jukujikun: If True, force entire word to be bracketed as one unit

    Returns:
        Bracketed furigana string (e.g., "買[か]い物[もの]", "食[た]べる")
    """
    if not surface or not reading:
        return surface

    # Convert reading to hiragana if needed (should already be)
    reading = to_hiragana(reading)

    segments = segment_surface(surface)

    # If all kana, no furigana needed
    if all(seg_type == 'KANA' or seg_type == 'OTHER' for _, seg_type in segments):
        return surface

    # If all kanji and jukujikun, bracket the whole thing
    if is_jukujikun and len(segments) == 1 and segments[0][1] == 'KANJI':
        return f"{surface}[{reading}]"

    # If pure kanji (no kana between them), treat as one unit
    # We can't split without knowing individual kanji readings
    if len(segments) == 1 and segments[0][1] == 'KANJI':
        return f"{surface}[{reading}]"

    # Complex case: kanji with kana between them (okurigana or compound)
    # Need to distribute reading across kanji segments
    result = []
    reading_pos = 0

    for segment_text, segment_type in segments:
        if segment_type == 'KANJI':
            # Find how much of the reading to consume for this kanji segment
            # Look ahead to see if there's kana after this kanji
            next_kana = None
            idx = len(result)
            for i, (seg_text, seg_type) in enumerate(segments):
                if ''.join([s[0] for s in segments[:i]]) == ''.join(result):
                    # Found current position
                    if i + 1 < len(segments) and segments[i + 1][1] == 'KANA':
                        next_kana = segments[i + 1][0]
                    break

            if next_kana:
                # Find where the next kana appears in the reading
                next_kana_hiragana = to_hiragana(next_kana)
                kana_pos = reading.find(next_kana_hiragana, reading_pos)

                if kana_pos >= 0:
                    # Reading for this kanji is up to the kana
                    kanji_reading = reading[reading_pos:kana_pos]
                    result.append(f"{segment_text}[{kanji_reading}]")
                    reading_pos = kana_pos
                else:
                    # Fallback: couldn't find next kana, use remaining reading
                    kanji_reading = reading[reading_pos:]
                    result.append(f"{segment_text}[{kanji_reading}]")
                    reading_pos = len(reading)
            else:
                # No kana after this kanji, use remaining reading
                kanji_reading = reading[reading_pos:]
                result.append(f"{segment_text}[{kanji_reading}]")
                reading_pos = len(reading)

        elif segment_type == 'KANA':
            # Kana in surface should match kana in reading
            kana_hiragana = to_hiragana(segment_text)
            if reading[reading_pos:reading_pos + len(kana_hiragana)] == kana_hiragana:
                result.append(segment_text)
                reading_pos += len(kana_hiragana)
            else:
                # Mismatch - fallback to surface form
                result.append(segment_text)

        else:  # OTHER
            result.append(segment_text)

    return ''.join(result)


def to_hiragana(text: str) -> str:
    """Convert katakana to hiragana."""
    result = []
    for char in text:
        if is_katakana(char):
            # Convert katakana to hiragana (subtract 0x60)
            result.append(chr(ord(char) - 0x60))
        else:
            result.append(char)
    return ''.join(result)
