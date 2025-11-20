# Pinyin Microservice

Python microservice for converting Chinese text to pinyin with both tone mark and tone number formats.

## Setup

```bash
# Install dependencies
pip3 install -r requirements.txt

# Run the service
python3 main.py
```

The service will start on `http://localhost:8001`

## API Endpoints

### POST /pinyin

Convert Chinese text to pinyin in both formats.

**Request:**
```json
{
  "text": "你好"
}
```

**Response:**
```json
{
  "characters": "你好",
  "pinyinToneMarks": "nǐ hǎo",
  "pinyinToneNumbers": "ni3 hao3"
}
```

## Usage Example

```bash
curl -X POST http://localhost:8001/pinyin \
  -H "Content-Type: application/json" \
  -d '{"text": "你好世界"}'
```
