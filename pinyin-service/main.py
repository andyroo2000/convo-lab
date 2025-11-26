#!/usr/bin/env python3
"""
Pinyin microservice for Chinese text processing
Generates both tone mark and tone number formats for pinyin
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypinyin import pinyin, Style
from typing import List
import uvicorn

app = FastAPI(title="Pinyin Service")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PinyinRequest(BaseModel):
    text: str


class BatchPinyinRequest(BaseModel):
    texts: List[str]


class PinyinResponse(BaseModel):
    characters: str
    pinyinToneMarks: str  # nǐ hǎo
    pinyinToneNumbers: str  # ni3 hao3


def generate_pinyin_for_text(text: str) -> PinyinResponse:
    """
    Generate pinyin for a single Chinese text string.
    """
    text = text.strip()

    # Generate pinyin with tone marks (default style)
    pinyin_tone_marks = pinyin(text, style=Style.TONE)
    pinyin_tone_marks_str = ' '.join([item[0] for item in pinyin_tone_marks])

    # Generate pinyin with tone numbers
    pinyin_tone_numbers = pinyin(text, style=Style.TONE3)
    pinyin_tone_numbers_str = ' '.join([item[0] for item in pinyin_tone_numbers])

    return PinyinResponse(
        characters=text,
        pinyinToneMarks=pinyin_tone_marks_str,
        pinyinToneNumbers=pinyin_tone_numbers_str
    )


@app.get("/")
async def root():
    return {
        "service": "Pinyin Service",
        "version": "1.0.0",
        "endpoints": {
            "/pinyin": "POST - Convert Chinese text to pinyin (both formats)",
            "/pinyin/batch": "POST - Convert multiple Chinese texts to pinyin"
        }
    }


@app.post("/pinyin", response_model=PinyinResponse)
async def generate_pinyin(request: PinyinRequest):
    """
    Generate pinyin for Chinese text in both tone mark and tone number formats
    """
    try:
        if not request.text:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        return generate_pinyin_for_text(request.text)

    except Exception as e:
        print(f"Error processing Chinese text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing text: {str(e)}")


@app.post("/pinyin/batch", response_model=List[PinyinResponse])
async def generate_pinyin_batch(request: BatchPinyinRequest):
    """
    Generate pinyin for multiple Chinese texts in a single request

    Example:
    POST /pinyin/batch
    {"texts": ["你好", "再见"]}

    Returns array of PinyinResponse objects in same order as input
    """
    try:
        if not request.texts:
            raise HTTPException(status_code=400, detail="Texts array is required")

        results = [generate_pinyin_for_text(text) for text in request.texts]
        return results

    except Exception as e:
        print(f"Error processing batch: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
