# Language Seed Data Generation

This directory contains tools for systematically generating vocabulary and grammar seed data for all supported languages.

## Overview

The harness (`generate-language-seeds.ts`) automates the creation of comprehensive vocabulary and grammar lists for:

- **Chinese (Mandarin)** - HSK levels 1-6
- **Spanish** - CEFR levels A1-C2
- **French** - CEFR levels A1-C2
- **Arabic** - CEFR levels A1-C2

## Target Sizes

### Chinese (HSK)

| Level | Vocabulary | Grammar |
| ----- | ---------- | ------- |
| HSK1  | 150        | 40      |
| HSK2  | 300        | 80      |
| HSK3  | 600        | 120     |
| HSK4  | 1,200      | 160     |
| HSK5  | 2,500      | 200     |
| HSK6  | 5,000      | 240     |

### Spanish, French, Arabic (CEFR)

| Level | Vocabulary | Grammar |
| ----- | ---------- | ------- |
| A1    | 800        | 50      |
| A2    | 1,500      | 80      |
| B1    | 3,000      | 120     |
| B2    | 6,000      | 150     |
| C1    | 10,000     | 180     |
| C2    | 15,000     | 200     |

## Usage

### Quick Test (Recommended First)

Test the harness with a tiny sample (5 vocab words, 3 grammar points for Chinese HSK1):

```bash
npm run harness:lang-seeds:test
```

This completes in ~30 seconds and verifies:

- ✅ API key is working
- ✅ Claude can generate valid JSON
- ✅ Files are saved correctly
- ✅ Validation runs successfully

### Run Complete Generation (All Languages)

```bash
npm run harness:lang-seeds
```

This will:

1. Generate vocabulary and grammar for all 4 languages
2. Create 48 JSON files total (24 vocabulary + 24 grammar)
3. Save each file as it's generated (incremental progress)
4. Process all files autonomously without stopping

**Estimated time:** 2-4 hours for all languages (agent works through files sequentially)

### Run for Specific Language

```bash
npm run harness:lang-seeds:chinese   # Chinese (HSK 1-6) only
npm run harness:lang-seeds:spanish   # Spanish (CEFR A1-C2) only
npm run harness:lang-seeds:french    # French (CEFR A1-C2) only
npm run harness:lang-seeds:arabic    # Arabic (CEFR A1-C2) only
```

### Run for Specific Level

```bash
# Just HSK1 for Chinese
npx tsx scripts/generate-language-seeds.ts --language=zh --level=HSK1

# Just A1 for Spanish
npx tsx scripts/generate-language-seeds.ts --language=es --level=A1
```

## How It Works

This harness uses the **Claude Agent SDK** (same as your i18n, test, and other harnesses) to autonomously generate seed data files.

### 1. Agent-Based Generation

- Spawns a Claude agent with expert language curriculum knowledge
- Agent systematically works through each language and level
- Uses Write tool to create JSON files directly
- Progress is visible in real-time

### 2. Autonomous Execution

- Processes all files without stopping to ask for confirmation
- Saves each file as it's generated (progress is incremental)
- Continues until all files are complete or max turns reached

### 3. Quality Standards

- Level-appropriate vocabulary and grammar for each proficiency level
- Accurate translations, readings (pinyin for Chinese), and examples
- Natural, authentic language usage
- Proper JSON formatting

### 4. Output

Files are saved to:

```
server/src/data/
├── vocabulary/
│   ├── zh/
│   │   ├── hsk1.json
│   │   ├── hsk2.json
│   │   └── ...
│   ├── es/
│   │   ├── a1.json
│   │   ├── a2.json
│   │   └── ...
│   ├── fr/ ...
│   └── ar/ ...
└── grammar/
    ├── zh/ ...
    ├── es/ ...
    ├── fr/ ...
    └── ar/ ...
```

## Progress Tracking

### View Progress

Check `.language-seed-progress.json` for detailed status of each task.

### View Logs

```bash
tail -f scripts/language-seed-generation.log
```

### Progress States

- `pending` - Not yet started
- `in_progress` - Currently being generated
- `completed` - Successfully generated and saved
- `validated` - Validated against web resources

## Data Format

### Vocabulary Example (Chinese)

```json
{
  "language": "zh",
  "level": "HSK1",
  "framework": "HSK",
  "vocabulary": [
    {
      "word": "你好",
      "reading": "nǐ hǎo",
      "translation": "hello",
      "partOfSpeech": "greeting"
    }
  ]
}
```

### Grammar Example (Spanish)

```json
{
  "language": "es",
  "level": "A1",
  "framework": "CEFR",
  "grammarPoints": [
    {
      "pattern": "estar + gerundio",
      "meaning": "present progressive",
      "usage": "Use to describe ongoing actions",
      "example": "Estoy estudiando",
      "exampleTranslation": "I am studying"
    }
  ]
}
```

## Troubleshooting

### Invalid or Incomplete Files

If a file is incomplete or has errors, simply delete it and re-run for that specific language/level:

```bash
# Delete the failed file and re-run
rm server/src/data/vocabulary/zh/hsk1.json
npx tsx scripts/generate-language-seeds.ts --language=zh --level=HSK1
```

### Authentication Issues

This harness uses Claude Code's built-in authentication (the same as your other harnesses). No separate API key needed!

### Agent Stops Early

If the agent stops before completing all files, simply re-run the same command. The agent will see which files exist and can continue from where it left off.

## Quality Assurance

Each generated list is validated for:

- ✅ Level appropriateness
- ✅ Completeness (no major omissions)
- ✅ Accuracy (correct translations, readings, examples)
- ✅ Alignment with official frameworks (HSK, CEFR)
- ✅ Natural, authentic examples

## Next Steps

After generation is complete:

1. Review validation feedback in logs
2. Spot-check a few files for quality
3. Run the existing vocabulary seeding service to test integration
4. Expand lists further if needed (script can be re-run with higher targets)
