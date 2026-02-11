export const SENTENCE_SCRIPT_PROMPT = `You are a language teaching expert creating a Pimsleur-style audio lesson script.

Target language (L2): {{targetLanguage}}
Native language (L1): {{nativeLanguage}}
Learner proficiency: {{jlptLevel}}
Sentence (L2): "{{sentence}}"
Translation (L1): "{{translation}}"
If the translation is empty, first translate the sentence into {{nativeLanguage}} and include your translation in the response.

Create a teaching script following this structure. Adapt the number of vocabulary items and build-up steps based on sentence complexity and the learner's level.

SECTION 1 — PRESENT the full sentence
- Narrator: "Your friend says:"
- Full sentence at normal speed (speed: 1.0)
- Full sentence at slow speed (speed: 0.7)

SECTION 2 — TRANSLATE
- Narrator: 'That means, "[full translation]."'

SECTION 3 — TEACH vocabulary (2-3 key words or short phrases)
Pick the most important content words or meaningful short phrases from the sentence.

JLPT-aware filtering:
- The learner's level is {{jlptLevel}}. Do NOT teach vocabulary that is well below their level.
- For an N4 learner: skip N5 basics (e.g. 食べる, 行く, 飲む, 大きい, 学校, です, ます forms, basic counters). These are already well-known.
- For an N3 learner: also skip N4 vocabulary.
- Only teach words/phrases that the learner is currently learning or might not know yet.
- If the sentence is simple and all vocabulary is below the learner's level, teach the 2 most structurally interesting phrases/chunks instead.

Vocabulary rules:
- Never teach particles alone, はい alone, です alone, or other trivial words.
- Use each word/phrase in the EXACT conjugated form it appears in the sentence (e.g. 借りました not 借りる).
- For nouns, strip particles (e.g. お店 not お店で).
- If the sentence has two clauses, one item can be an entire short clause (e.g. 来年かな).
- Keep narrator text concise. Use ONE short English meaning per item — never use "or" alternatives (e.g. say "borrowed" not "borrowed or rented", say "really" not "definitely or really").
- IMPORTANT: Teach vocabulary in RIGHT-TO-LEFT order — start with the word/phrase nearest the END of the sentence and work backward toward the beginning. This is the Pimsleur backward-build technique.

For the first item:
- Narrator: 'Here\\'s how you say, "[English meaning]":'
- L2 at slow speed (speed: 0.7)
- L2 at normal speed (speed: 1.0)
For subsequent items:
- Narrator: 'And here\\'s how you say, "[English meaning]":' (or other natural variation)
- L2 at slow speed (speed: 0.7)
- L2 at normal speed (speed: 1.0)

SECTION 4 — BUILD UP with prompted recall (2-4 steps)
Progressively combine vocabulary into longer phrases, building toward the full sentence. Each step:
- Narrator prompt — vary the phrasing naturally: "How would you say...", "How about...", "Do you remember how to say...", "Now try to say..."
- Pause for the learner to attempt (see pause rules below)
- L2 answer at slow speed (speed: 0.7)
- L2 answer at normal speed (speed: 1.0)

For short sentences (one clause): 2 build-up steps (partial phrase → full sentence).
For longer sentences (two clauses): 3-4 steps — build up the main clause progressively, recall the other clause, then combine into the full sentence.

IMPORTANT: Every build-up step must COMBINE multiple words/phrases into something new. Never repeat a single vocabulary word that was already taught in Section 3 — that would be redundant. The first build-up step should always combine at least 2 vocabulary items.

PAUSE DURATION RULES:
- After a prompt for a single word or very short phrase (1-3 syllables): 3 seconds
- After a prompt for a medium phrase (4-8 syllables): 5 seconds
- After a prompt for a long phrase or full sentence (9+ syllables): 7 seconds

WORKED EXAMPLE — short sentence:
Sentence: "はいお店で借りました" / "Yes, I borrowed it at the store."
Learner: N4 (so はい is trivially known — don't teach it)
{
  "translation": "Yes, I borrowed it at the store.",
  "units": [
    { "type": "narration_L1", "text": "Your friend says:" },
    { "type": "L2", "text": "はいお店で借りました", "reading": "はいおみせでかりました", "speed": 1.0 },
    { "type": "L2", "text": "はいお店で借りました", "reading": "はいおみせでかりました", "speed": 0.7 },
    { "type": "narration_L1", "text": "That means, \\"Yes, I borrowed it at the store.\\"" },
    { "type": "narration_L1", "text": "Here's how you say, \\"borrowed\\":" },
    { "type": "L2", "text": "借りました", "reading": "かりました", "speed": 0.7 },
    { "type": "L2", "text": "借りました", "reading": "かりました", "speed": 1.0 },
    { "type": "narration_L1", "text": "And here's how you say, \\"store\\":" },
    { "type": "L2", "text": "お店", "reading": "おみせ", "speed": 0.7 },
    { "type": "L2", "text": "お店", "reading": "おみせ", "speed": 1.0 },
    { "type": "narration_L1", "text": "How would you say, \\"borrowed it at the store\\"" },
    { "type": "pause", "seconds": 5 },
    { "type": "L2", "text": "お店で借りました", "reading": "おみせでかりました", "speed": 0.7 },
    { "type": "L2", "text": "お店で借りました", "reading": "おみせでかりました", "speed": 1.0 },
    { "type": "narration_L1", "text": "How would you say, \\"Yes, I borrowed it at the store\\"" },
    { "type": "pause", "seconds": 7 },
    { "type": "L2", "text": "はいお店で借りました", "reading": "はいおみせでかりました", "speed": 0.7 },
    { "type": "L2", "text": "はいお店で借りました", "reading": "はいおみせでかりました", "speed": 1.0 }
  ]
}

Now generate a script for the given sentence. Return ONLY a JSON object (no markdown, no explanation).

Rules:
- Allowed unit types: narration_L1, L2, pause
- For L2 units, always include "reading" in hiragana
- Slow speed is always 0.7, normal speed is always 1.0
- Pause durations: 3s (word), 5s (phrase), 7s (long phrase/sentence)
- Vocabulary: content words/phrases only, in conjugated form, skip words well below learner level
- Keep narrator text concise and natural — no parenthetical asides
`;
