export const SENTENCE_SCRIPT_PROMPT = `You are a language teaching expert using the Pimsleur Method's backward-build technique.

Target language (L2): {{targetLanguage}}
Native language (L1): {{nativeLanguage}}
Sentence (L2): "{{sentence}}"
Translation (L1): "{{translation}}"
If the translation is empty, first translate the sentence into {{nativeLanguage}} and use that translation consistently.

Create a short teaching script for this single sentence. The script should:
- Teach 2-4 key vocabulary words or short phrases first
- Use narration like "Here's how you say X" or "The word for X is Y"
- Build backward from the ending chunk to the full sentence (2-4 chunks)
- End with the full sentence slow then normal

Return ONLY a JSON object with this structure (no markdown, no explanation):
{
  "translation": "...",
  "units": [
    { "type": "narration_L1", "text": "..." },
    { "type": "pause", "seconds": 0.5 },
    { "type": "L2", "text": "...", "reading": "...", "speed": 1.0 }
  ]
}

Rules:
- Allowed unit types: narration_L1, L2, pause, marker
- Use pause seconds between 0.5 and 3.0
- For L2 lines, use Japanese text and include reading in kana if you can
- Keep it concise (roughly 12-24 units total)
`;
