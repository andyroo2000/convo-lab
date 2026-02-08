/* eslint-disable no-console */
import { Prisma } from '@prisma/client';

import { prisma } from '../db/client.js';

import { getAvatarUrlFromVoice, parseVoiceIdForGender } from './avatarService.js';
import { generateWithGemini } from './geminiClient.js';
import { processLanguageTextBatch } from './languageProcessor.js';
import {
  formatGrammarForPrompt,
  formatWordsForPrompt,
  getProficiencyFramework,
  sampleGrammar,
  sampleVocabulary,
} from './vocabularySeeding.js';

interface Speaker {
  name: string;
  voiceId: string;
  proficiency: string;
  tone: string;
  color?: string;
}

interface GenerateDialogueRequest {
  episodeId: string;
  speakers: Speaker[];
  variationCount?: number;
  dialogueLength?: number;
  jlptLevel?: string;
  vocabSeedOverride?: string;
  grammarSeedOverride?: string;
}

interface DialogueSentence {
  speaker: string;
  text: string;
  translation: string;
  variations: string[];
}

interface DialogueData {
  title: string;
  sentences: DialogueSentence[];
}

export async function generateDialogue(request: GenerateDialogueRequest) {
  const {
    episodeId,
    speakers,
    variationCount = 3,
    dialogueLength = 6,
    jlptLevel,
    vocabSeedOverride,
    grammarSeedOverride,
  } = request;

  // Get episode
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
  });

  if (!episode) {
    throw new Error('Episode not found');
  }

  // Update episode status
  await prisma.episode.update({
    where: { id: episodeId },
    data: { status: 'generating' },
  });

  try {
    // Build prompt for Gemini
    const systemInstruction = buildSystemInstruction(
      episode.targetLanguage,
      episode.nativeLanguage,
      speakers
    );

    const effectiveJlptLevel = jlptLevel || episode.jlptLevel || undefined;

    const prompt = await buildDialoguePrompt(
      episode.sourceText,
      speakers,
      variationCount,
      dialogueLength,
      episode.targetLanguage,
      effectiveJlptLevel,
      vocabSeedOverride,
      grammarSeedOverride
    );

    // Retry logic for Gemini API calls (handles transient JSON parsing errors)
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    let dialogueData: DialogueData | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `[DIALOGUE] Attempt ${attempt}/${MAX_RETRIES}: Generating dialogue with Gemini`
        );

        // Generate dialogue with Gemini
        const response = await generateWithGemini(prompt, systemInstruction);

        // Strip markdown code fences if present
        let jsonText = response.trim();
        // Remove opening fence (```json or ``` followed by optional newline)
        jsonText = jsonText.replace(/^```(?:json)?[\r\n]*/, '');
        // Remove closing fence (``` at end, with optional preceding newline)
        jsonText = jsonText.replace(/[\r\n]*```\s*$/, '');
        jsonText = jsonText.trim();

        // Parse response (expected JSON format)
        dialogueData = JSON.parse(jsonText);

        console.log(`[DIALOGUE] Success on attempt ${attempt}`);
        break; // Success! Exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.error(`[DIALOGUE] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);

        // If this was the last attempt, log the raw response for debugging
        if (attempt === MAX_RETRIES) {
          console.error('[DIALOGUE] All retry attempts exhausted. Last error:', lastError.message);
        } else {
          // Wait before retrying (exponential backoff: 1s, 2s, 4s)
          const delayMs = 2 ** (attempt - 1) * 1000;
          console.log(`[DIALOGUE] Retrying in ${delayMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // If we exhausted all retries without success, throw the last error
    if (!dialogueData) {
      throw new Error(
        `Failed to generate dialogue after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`
      );
    }

    // Create dialogue and sentences in database
    const dialogue = await createDialogueInDB(
      episodeId,
      speakers,
      dialogueData,
      episode.targetLanguage,
      episode.nativeLanguage
    );

    // Update episode status and title with LLM-generated title
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        status: 'ready',
        title: dialogueData.title || episode.title, // Use LLM-generated title, fallback to existing
      },
    });

    return dialogue;
  } catch (error) {
    // Update episode status to error
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'error' },
    });

    throw error;
  }
}

/**
 * Remove furigana notation from text
 * Example: "田中[たなか]さくら" → "田中さくら"
 */
function stripPhoneticNotation(text: string): string {
  return text.replace(/\[[^\]]+\]/g, '');
}

function buildSystemInstruction(
  targetLanguage: string,
  nativeLanguage: string,
  speakers: Speaker[]
): string {
  const languageName = getLanguageName(targetLanguage);

  // Strip furigana from speaker names for cleaner prompts
  const speakerNames = speakers.map((s) => stripPhoneticNotation(s.name));

  return `You are a dialogue generation expert for language learning. Your task is to create natural, engaging conversations in ${languageName} based on user stories.

Guidelines:
1. Generate authentic, natural dialogue that native speakers would use
2. Adapt language complexity to each speaker's proficiency level:
   - Beginner: Simple grammar, basic vocabulary
   - Intermediate: More complex sentences, common idioms
   - Advanced: Natural expressions, nuanced language
   - Native: Fully natural, including slang if appropriate
3. Match the specified tone (casual/polite/formal) for each speaker
4. Create ${languageName} dialogue that flows naturally
5. Provide English translations for each line
6. For each sentence, generate multiple variations (different ways to express the same idea)
7. Keep cultural context in mind

Speakers: ${speakers.map((s, i) => `${speakerNames[i]} (${s.proficiency}, ${s.tone})`).join(', ')}`;
}

function formatSeedOverride(seed: string): string {
  const trimmed = seed.trim();
  if (!trimmed) return '';
  const parts = trimmed
    .split(/\r?\n/)
    .flatMap((line) => line.split(','))
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return trimmed;
  return parts.map((part) => `- ${part}`).join('\n');
}

async function buildDialoguePrompt(
  sourceText: string,
  speakers: Speaker[],
  variationCount: number,
  dialogueLength: number,
  targetLanguage: string,
  jlptLevel?: string,
  vocabSeedOverride?: string,
  grammarSeedOverride?: string
): Promise<string> {
  // Strip furigana from speaker names for cleaner prompts
  const speakerNames = speakers.map((s) => stripPhoneticNotation(s.name));

  let vocabularySeed = '';
  let grammarSeed = '';

  if (vocabSeedOverride && vocabSeedOverride.trim()) {
    vocabularySeed = `

VOCABULARY SEEDS (override):
Use these words/phrases and prioritize them over any auto-suggested lists:
${formatSeedOverride(vocabSeedOverride)}`;
  } else if (jlptLevel && targetLanguage) {
    try {
      const seedWords = await sampleVocabulary(targetLanguage, jlptLevel, 30);
      if (seedWords.length > 0) {
        const framework = getProficiencyFramework(targetLanguage);
        vocabularySeed = `

SUGGESTED ${jlptLevel} VOCABULARY TO INCORPORATE:
Try to naturally use some of these ${framework} ${jlptLevel}-level words:
${formatWordsForPrompt(seedWords, targetLanguage)}

You don't need to use all of them - just incorporate 5-10 naturally where they fit the conversation context.`;
      }
    } catch (error) {
      console.warn(
        `[PromptBuilder] Could not load ${jlptLevel} vocabulary for ${targetLanguage}:`,
        error
      );
    }
  }

  if (grammarSeedOverride && grammarSeedOverride.trim()) {
    grammarSeed = `

GRAMMAR SEEDS (override):
Use these grammar patterns and prioritize them over any auto-suggested lists:
${formatSeedOverride(grammarSeedOverride)}`;
  } else if (jlptLevel && targetLanguage) {
    try {
      const seedGrammar = await sampleGrammar(targetLanguage, jlptLevel, 5);
      if (seedGrammar.length > 0) {
        const framework = getProficiencyFramework(targetLanguage);
        grammarSeed = `

SUGGESTED ${jlptLevel} GRAMMAR PATTERNS TO INCORPORATE:
Try to naturally use 2-3 of these ${framework} ${jlptLevel}-level grammar patterns:
${formatGrammarForPrompt(seedGrammar)}

Use these patterns where they naturally fit the conversation flow.`;
      }
    } catch (error) {
      console.warn(
        `[PromptBuilder] Could not load ${jlptLevel} grammar for ${targetLanguage}:`,
        error
      );
    }
  }

  const seedSection = `${vocabularySeed}${grammarSeed}`;

  const jlptConstraint = jlptLevel
    ? `\n\nIMPORTANT JLPT LEVEL CONSTRAINT:
- Target level: ${jlptLevel}
- Use vocabulary and grammar structures appropriate for students at this level
- Avoid using words or structures significantly above this level${seedSection}`
    : seedSection;

  return `Based on this story/experience, create a natural dialogue:

"${sourceText}"

Create a conversation between ${speakerNames.join(' and ')} discussing this experience.

For EACH line of dialogue, provide ${variationCount} alternative ways to say the same thing (variations in word choice, grammar, formality, etc.).
${jlptConstraint}

Return your response as JSON in this exact format:
{
  "title": "A short, topic-focused English title (e.g., 'Weekend Plans', 'Favorite Places', 'Summer Vacation')",
  "sentences": [
    {
      "speaker": "SpeakerName",
      "text": "The target language sentence",
      "translation": "English translation",
      "variations": ["Alternative 1", "Alternative 2", "Alternative 3"]
    }
  ]
}

IMPORTANT: Use EXACTLY these speaker names in your response: ${speakerNames.join(', ')}

Requirements:
- Generate a succinct, topic-focused title in English (2-4 words max, no speaker names)
- The title should capture the main topic or theme of the conversation
- Generate EXACTLY ${dialogueLength} dialogue lines with speakers STRICTLY ALTERNATING
- CRITICAL: Speakers must alternate on every line (${speakerNames[0]} → ${speakerNames[1]} → ${speakerNames[0]} → ${speakerNames[1]}, etc.)
- Never have the same speaker speak twice in a row
- Each line should be conversational and natural
- Progress the conversation naturally through the experience
- Include reactions, questions, and natural flow
- Ensure variations are genuinely different (not just particle changes)
- Use ONLY the exact speaker names provided above`;
}

async function createDialogueInDB(
  episodeId: string,
  speakers: Speaker[],
  dialogueData: DialogueData,
  targetLanguage: string,
  _nativeLanguage: string
) {
  // Create dialogue
  const dialogue = await prisma.dialogue.create({
    data: {
      episodeId,
    },
  });

  // Create speakers with avatar URLs
  const speakerRecords = await Promise.all(
    speakers.map(async (speaker, index) => {
      // Extract gender from voiceId
      const gender = parseVoiceIdForGender(speaker.voiceId);

      // Find matching avatar based on voiceId and tone
      const avatarUrl = await getAvatarUrlFromVoice(speaker.voiceId, speaker.tone);

      return prisma.speaker.create({
        data: {
          dialogueId: dialogue.id,
          name: speaker.name,
          voiceId: speaker.voiceId,
          proficiency: speaker.proficiency,
          tone: speaker.tone,
          gender,
          color: speaker.color || getDefaultSpeakerColor(index),
          avatarUrl,
        },
      });
    })
  );

  // Map speaker names to IDs (using stripped names for matching)
  const speakerMap = new Map(speakerRecords.map((s) => [stripPhoneticNotation(s.name), s.id]));

  // Batch process all sentence metadata in a single request
  const sentenceTexts = dialogueData.sentences.map((sent) => sent.text);
  console.log(`[DIALOGUE] Batching metadata for ${sentenceTexts.length} sentences`);
  const allMetadata = await processLanguageTextBatch(sentenceTexts, targetLanguage);
  console.log(`[DIALOGUE] Metadata batch complete (1 call instead of ${sentenceTexts.length})`);

  // Create sentences with precomputed metadata
  const sentences = await Promise.all(
    dialogueData.sentences.map(async (sent, index) => {
      // Strip phonetic notation from the speaker name for matching
      const normalizedSpeakerName = stripPhoneticNotation(sent.speaker);
      const speakerId = speakerMap.get(normalizedSpeakerName);
      if (!speakerId) {
        throw new Error(
          `Unknown speaker: ${sent.speaker} (normalized: ${normalizedSpeakerName}). Available speakers: ${Array.from(speakerMap.keys()).join(', ')}`
        );
      }

      // Use pre-computed metadata from batch call
      const metadata = allMetadata[index];

      return prisma.sentence.create({
        data: {
          dialogueId: dialogue.id,
          speakerId,
          order: index,
          text: sent.text,
          translation: sent.translation,
          metadata: metadata as Prisma.JsonValue, // Store precomputed metadata (cast for Prisma JSON type)
          variations: sent.variations || [],
          selected: false,
        },
      });
    })
  );

  return {
    dialogue,
    speakers: speakerRecords,
    sentences,
  };
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    ja: 'Japanese',
    en: 'English',
  };
  return names[code] || code;
}

function getDefaultSpeakerColor(index: number): string {
  const colors = ['#9333EA', '#F97316']; // Purple and Orange
  return colors[index % colors.length];
}
