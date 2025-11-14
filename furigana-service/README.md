# Furigana Generation Microservice

Python FastAPI service that generates furigana readings for Japanese text.

## Setup

```bash
./start.sh
```

This will:
1. Create a Python virtual environment
2. Install dependencies (fugashi, FastAPI, uvicorn)
3. Start the service on http://localhost:8000

## API Endpoints

### POST /furigana

Generate furigana for Japanese text.

**Request:**
```json
{
  "text": "今日は良い天気です"
}
```

**Response:**
```json
{
  "kanji": "今日は良い天気です",
  "kana": "きょうはいいてんきです",
  "furigana": "今日[きょう]は良[い]い天気[てんき]です"
}
```

### GET /health

Health check endpoint.

## Technology

- **FastAPI**: Web framework
- **fugashi**: MeCab wrapper for Japanese morphological analysis
- **UniDic Lite**: Japanese dictionary for tokenization
