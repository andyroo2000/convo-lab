"""
Furigana Generation Microservice
Generates furigana readings for Japanese text using fugashi (MeCab + UniDic)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import re

app = FastAPI(title="Furigana Service")

# CORS middleware to allow Node.js backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize fugashi tagger (MeCab + UniDic)
try:
    import fugashi
    tagger = fugashi.Tagger()
    print("Fugashi tagger initialized successfully")
except ImportError:
    print("ERROR: fugashi not installed. Run: pip install fugashi unidic-lite", flush=True)
    tagger = None
except Exception as e:
    print(f"Warning: Failed to initialize fugashi tagger: {e}")
    tagger = None


class TextRequest(BaseModel):
    text: str


class FuriganaResponse(BaseModel):
    kanji: str
    kana: str
    furigana: str  # Bracket-style: 漢[かん]字[じ]


def generate_furigana(text: str) -> FuriganaResponse:
    """
    Generate furigana for Japanese text using fugashi (MeCab + UniDic).

    Returns bracket-style format: 漢[かん]字[じ]
    Uses proper alignment algorithm to handle okurigana and compounds.
    """
    from alignment import align_furigana, is_kanji, is_kana, to_hiragana

    if not tagger:
        # Fallback if tagger not initialized
        return FuriganaResponse(
            kanji=text,
            kana=text,
            furigana=text
        )

    # Tokenize with MeCab
    tokens = tagger(text)

    result_parts = []
    kana_parts = []

    for token in tokens:
        surface = token.surface

        # Get reading from UniDic
        reading = None
        try:
            if hasattr(token.feature, 'kana') and token.feature.kana:
                reading = token.feature.kana
            elif hasattr(token.feature, 'pron') and token.feature.pron:
                # Fallback to pronunciation field
                reading = token.feature.pron
        except:
            pass

        # If no reading, use surface as-is
        if not reading:
            result_parts.append(surface)
            kana_parts.append(surface if all(is_kana(c) or not is_kanji(c) for c in surface) else '')
            continue

        # Convert reading to hiragana
        reading = to_hiragana(reading)

        # Check if surface is all kana (no furigana needed)
        if all(is_kana(c) or not is_kanji(c) for c in surface):
            result_parts.append(surface)
            kana_parts.append(reading)
            continue

        # Generate furigana with alignment
        try:
            furigana = align_furigana(surface, reading, is_jukujikun=False)
            result_parts.append(furigana)
            kana_parts.append(reading)
        except Exception as e:
            # Fallback: if alignment fails, use surface as-is
            result_parts.append(surface)
            kana_parts.append(reading)

    furigana_text = ''.join(result_parts)
    kana_text = ''.join(kana_parts)

    return FuriganaResponse(
        kanji=text,
        kana=kana_text,
        furigana=furigana_text
    )


@app.get("/")
async def root():
    return {
        "service": "Furigana Generation Service",
        "status": "running",
        "converter_initialized": tagger is not None
    }


@app.post("/furigana", response_model=FuriganaResponse)
async def process_furigana(request: TextRequest):
    """
    Generate furigana for Japanese text

    Example:
    POST /furigana
    {"text": "今日は良い天気です"}

    Returns:
    {
        "kanji": "今日は良い天気です",
        "kana": "きょうはいいてんきです",
        "furigana": "今日[きょう]は良[よ]い天気[てんき]です"
    }
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        result = generate_furigana(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Furigana generation failed: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "healthy", "converter": "initialized" if tagger else "not initialized"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
