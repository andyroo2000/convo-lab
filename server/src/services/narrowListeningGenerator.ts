import { SUPPORTED_LANGUAGES } from "@languageflow/shared/src/constants-new.js";
import { generateWithGemini } from './geminiClient.js';

export interface StorySegment {
  targetText: string;
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
 * Get language name from code
 */
function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES[code as keyof typeof SUPPORTED_LANGUAGES];
  return lang?.name || code;
}

/**
 * Get proficiency level description based on language
 */
function getProficiencyDescription(targetLanguage: string, level: string): string {
  if (targetLanguage === 'ja') {
    switch (level) {
      case 'N5':
      case 'N4':
        return 'beginner level - simple grammar and vocabulary';
      case 'N3':
        return 'intermediate level - more complex grammar and natural expressions';
      case 'N2':
      case 'N1':
        return 'advanced level - sophisticated grammar and nuanced expressions';
      default:
        return 'intermediate level';
    }
  } else if (targetLanguage === 'zh') {
    switch (level) {
      case 'HSK1':
      case 'HSK2':
        return 'beginner level - simple grammar and basic vocabulary (150-300 words)';
      case 'HSK3':
      case 'HSK4':
        return 'intermediate level - more complex sentence structures (600-1200 words)';
      case 'HSK5':
      case 'HSK6':
        return 'advanced level - sophisticated expressions and formal vocabulary (2500+ words)';
      default:
        return 'intermediate level';
    }
  }
  return 'intermediate level';
}

/**
 * Get variation types based on language
 */
function getVariationTypes(targetLanguage: string): string {
  if (targetLanguage === 'ja') {
    return `Example variation types for Japanese:
- PAST_CASUAL: Past tense with casual forms (た、だ)
- PRESENT_POLITE: Present tense with polite forms (ます、です)
- FUTURE_POLITE: Future/intention forms (つもり、予定)
- PARTICLE_FOCUS: Emphasize は vs が、に vs で contrasts
- FORMALITY_CONTRAST: Mix of casual and formal speech`;
  } if (targetLanguage === 'zh') {
    return `Example variation types for Chinese:
- ASPECT_MARKERS: Variations using 了/过/着 aspect markers
- MEASURE_WORDS: Different classifier/measure word usage
- FORMAL_REGISTER: 您 vs 你, formal vs casual vocabulary
- BA_CONSTRUCTION: 把 sentence patterns vs standard SVO
- DIRECTIONAL_COMPLEMENTS: Using 来/去 and directional verb complements`;
  }
  return '';
}

/**
 * Get language-specific constraints
 */
function getLanguageConstraints(targetLanguage: string): string {
  if (targetLanguage === 'ja') {
    return '- Do NOT use furigana or romaji. Use standard Japanese orthography and natural punctuation.';
  } if (targetLanguage === 'zh') {
    return '- Use simplified Chinese characters. Do NOT include pinyin. Use natural Chinese punctuation (。！？).';
  }
  return '';
}

/**
 * Generate system instruction for the target language
 */
function getSystemInstruction(targetLanguage: string): string {
  const languageName = getLanguageName(targetLanguage);

  return `You are a ${languageName} language content generator for a Narrow Listening feature.

Goal:
- Given a topic and proficiency level, create one short, coherent story and 3–5 versions (variations) of that story.
- Each version keeps the same core content (who, where, what happens) but changes grammar and/or style.
- Output STRICT JSON matching the provided schema, with NO extra commentary or markdown formatting.

Constraints:
- Match the requested proficiency level for vocabulary and grammar complexity.
- Each story version should be 4–8 sentences.
- Keep names and main events consistent across versions.
- Make each version pedagogically distinct (e.g., grammar patterns, formality, word choice).
${getLanguageConstraints(targetLanguage)}
- Provide a natural English translation for each segment.
- The JSON MUST be valid and parseable.
- Do NOT wrap the JSON in markdown code blocks or any other formatting.`;
}

/**
 * Generate narrow listening pack using Gemini
 */
export async function generateNarrowListeningPack(
  topic: string,
  targetLanguage: string,
  proficiencyLevel: string,
  versionCount: number,
  grammarFocus: string = ''
): Promise<StoryPack> {
  const languageName = getLanguageName(targetLanguage);
  const proficiencyDesc = getProficiencyDescription(targetLanguage, proficiencyLevel);
  const variationTypes = getVariationTypes(targetLanguage);

  const prompt = `Create a Narrow Listening pack for ${languageName} learners.

Topic prompt:
${topic}

Target proficiency: ${proficiencyLevel} (${proficiencyDesc})

Number of versions:
${versionCount}

${grammarFocus ? `Optional grammar/style focus:\n${grammarFocus}\n` : ''}

For each version:
- Use the same characters and general scenario.
- Change grammar/style/formality according to a variation type.
- Keep vocabulary mostly the same to maximize repetition.

Use this JSON schema exactly:

{
  "title": "string - overall story pack title (in English)",
  "versions": [
    {
      "variationType": "string - describes the grammar/style variation",
      "title": "string - brief description in English, e.g. 'Past tense, casual'",
      "segments": [
        {
          "targetText": "string - one sentence in ${languageName}",
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
- Choose variationTypes that make sense given the grammar focus and proficiency level.
- Each story should be 4-8 sentences.

${variationTypes}

Output only the JSON now:`;

  try {
    console.log(`Calling Gemini to generate ${languageName} narrow listening pack...`);
    const systemInstruction = getSystemInstruction(targetLanguage);
    const response = await generateWithGemini(prompt, systemInstruction, 'gemini-2.5-flash');

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
        if (!segment.targetText || !segment.englishTranslation) {
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
