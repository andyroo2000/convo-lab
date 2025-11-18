import { generateWithGemini } from './geminiClient.js';

export interface StorySegment {
  japaneseText: string;
  englishTranslation: string;
}

export interface StoryVersion {
  variationType: string;
  title: string;
  segments: StorySegment[];
}

export interface StoryPack {
  title: string;
  versions: StoryVersion[];
}

/**
 * System instruction for Gemini to generate narrow listening packs
 */
const SYSTEM_INSTRUCTION = `You are a Japanese language content generator for a Narrow Listening feature.

Goal:
- Given a topic and JLPT level, create one short, coherent story and 3–5 versions (variations) of that story.
- Each version keeps the same core content (who, where, what happens) but changes grammar and/or politeness.
- Output STRICT JSON matching the provided schema, with NO extra commentary or markdown formatting.

Constraints:
- Match the requested JLPT level:
  - N5/N4: simple grammar and vocabulary.
  - N3+: more complex grammar and natural expressions.
- Each story version should be 4–8 sentences.
- Keep names and main events consistent across versions.
- Make each version pedagogically distinct (e.g., tense, politeness, particle focus).
- Do NOT use furigana or romaji. Use standard Japanese orthography and natural punctuation.
- Provide a natural English translation for each version.
- The JSON MUST be valid and parseable.
- Do NOT wrap the JSON in markdown code blocks or any other formatting.`;

/**
 * Generate narrow listening pack using Gemini
 */
export async function generateNarrowListeningPack(
  topic: string,
  jlptLevel: string,
  versionCount: number,
  grammarFocus: string = ''
): Promise<StoryPack> {
  const prompt = `Create a Narrow Listening pack for Japanese learners.

Topic prompt:
${topic}

Target JLPT level:
${jlptLevel}

Number of versions:
${versionCount}

${grammarFocus ? `Optional grammar focus:\n${grammarFocus}\n` : ''}

For each version:
- Use the same characters and general scenario.
- Change grammar/tense/politeness/particle usage according to a variation type.
- Keep vocabulary mostly the same to maximize repetition.

Use this JSON schema exactly:

{
  "title": "string - overall story pack title",
  "versions": [
    {
      "variationType": "string - one of: PAST_CASUAL, PRESENT_POLITE, FUTURE_POLITE, PARTICLE_FOCUS, FORMALITY_CONTRAST, etc.",
      "title": "string - brief description in English, e.g. 'Past, casual'",
      "segments": [
        {
          "japaneseText": "string - one sentence in Japanese ending with 。！or ？",
          "englishTranslation": "string - English translation of ONLY this sentence"
        }
      ]
    }
  ]
}

Requirements:
- Output MUST be valid JSON only, with no markdown formatting, no code blocks, no extra text.
- No extra keys or comments.
- Number of versions MUST equal ${versionCount}.
- Choose variationTypes that make sense given the grammar focus and JLPT level.
- Each story should be 4-8 sentences.

Example variation types:
- PAST_CASUAL: Past tense with casual forms (た、だ)
- PRESENT_POLITE: Present tense with polite forms (ます、です)
- FUTURE_POLITE: Future/intention forms (つもり、予定、will)
- PARTICLE_FOCUS: Emphasize は vs が、に vs で contrasts
- FORMALITY_CONTRAST: Mix of casual and formal speech

Output only the JSON now:`;

  try {
    console.log('Calling Gemini to generate narrow listening pack...');
    const response = await generateWithGemini(prompt, SYSTEM_INSTRUCTION, 'gemini-2.5-flash');

    console.log('Gemini response received, parsing JSON...');

    // Clean up response (remove markdown code blocks if present)
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse JSON
    const storyPack = JSON.parse(cleanedResponse) as StoryPack;

    // Validate structure
    if (!storyPack.title || !storyPack.versions || !Array.isArray(storyPack.versions)) {
      throw new Error('Invalid story pack structure from Gemini');
    }

    if (storyPack.versions.length !== versionCount) {
      console.warn(`Expected ${versionCount} versions, got ${storyPack.versions.length}`);
    }

    // Validate each version
    for (const version of storyPack.versions) {
      if (!version.variationType || !version.title || !version.segments || !Array.isArray(version.segments)) {
        throw new Error('Invalid version structure from Gemini');
      }

      // Validate each segment
      for (const segment of version.segments) {
        if (!segment.japaneseText || !segment.englishTranslation) {
          throw new Error('Invalid segment structure from Gemini');
        }
      }
    }

    console.log(`✅ Successfully generated story pack: "${storyPack.title}" with ${storyPack.versions.length} versions`);

    return storyPack;
  } catch (error: any) {
    console.error('Error generating narrow listening pack with Gemini:', error);
    if (error instanceof SyntaxError) {
      console.error('JSON parsing error. Raw response:', error.message);
    }
    throw new Error(`Failed to generate narrow listening pack: ${error.message}`);
  }
}
