import { generateWithGemini } from './geminiClient.js';
import { prisma } from '../db/client.js';

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
}

export async function generateDialogue(request: GenerateDialogueRequest) {
  const { episodeId, speakers, variationCount = 3, dialogueLength = 6 } = request;

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

    const prompt = buildDialoguePrompt(
      episode.sourceText,
      speakers,
      variationCount,
      dialogueLength
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
    const dialogueData = JSON.parse(jsonText);

    // Create dialogue and sentences in database
    const dialogue = await createDialogueInDB(
      episodeId,
      speakers,
      dialogueData,
      episode.targetLanguage,
      episode.nativeLanguage
    );

    // Update episode status
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'ready' },
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
 * Remove furigana/pinyin notation from text
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

  // Strip furigana/pinyin from speaker names for cleaner prompts
  const speakerNames = speakers.map(s => stripPhoneticNotation(s.name));

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

function buildDialoguePrompt(
  sourceText: string,
  speakers: Speaker[],
  variationCount: number,
  dialogueLength: number
): string {
  // Strip furigana/pinyin from speaker names for cleaner prompts
  const speakerNames = speakers.map(s => stripPhoneticNotation(s.name));

  return `Based on this story/experience, create a natural dialogue:

"${sourceText}"

Create a conversation between ${speakerNames.join(' and ')} discussing this experience.

For EACH line of dialogue, provide ${variationCount} alternative ways to say the same thing (variations in word choice, grammar, formality, etc.).

Return your response as JSON in this exact format:
{
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
- Generate EXACTLY ${dialogueLength} dialogue lines (back and forth turns)
- Each line should be conversational and natural
- Progress the conversation naturally through the experience
- Include reactions, questions, and natural flow
- Ensure variations are genuinely different (not just particle changes)
- Use ONLY the exact speaker names provided above`;
}

async function createDialogueInDB(
  episodeId: string,
  speakers: Speaker[],
  dialogueData: any,
  targetLanguage: string,
  nativeLanguage: string
) {
  // Create dialogue
  const dialogue = await prisma.dialogue.create({
    data: {
      episodeId,
    },
  });

  // Create speakers
  const speakerRecords = await Promise.all(
    speakers.map((speaker, index) =>
      prisma.speaker.create({
        data: {
          dialogueId: dialogue.id,
          name: speaker.name,
          voiceId: speaker.voiceId,
          proficiency: speaker.proficiency,
          tone: speaker.tone,
          color: speaker.color || getDefaultSpeakerColor(index),
        },
      })
    )
  );

  // Map speaker names to IDs (using stripped names for matching)
  const speakerMap = new Map(
    speakerRecords.map(s => [stripPhoneticNotation(s.name), s.id])
  );

  // Create sentences
  const sentences = await Promise.all(
    dialogueData.sentences.map(async (sent: any, index: number) => {
      // Strip phonetic notation from the speaker name for matching
      const normalizedSpeakerName = stripPhoneticNotation(sent.speaker);
      const speakerId = speakerMap.get(normalizedSpeakerName);
      if (!speakerId) {
        throw new Error(`Unknown speaker: ${sent.speaker} (normalized: ${normalizedSpeakerName}). Available speakers: ${Array.from(speakerMap.keys()).join(', ')}`);
      }

      return prisma.sentence.create({
        data: {
          dialogueId: dialogue.id,
          speakerId,
          order: index,
          text: sent.text,
          translation: sent.translation,
          metadata: {}, // Empty metadata - furigana generated on-the-fly
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
    zh: 'Chinese',
    es: 'Spanish',
    fr: 'French',
    ar: 'Arabic',
    he: 'Hebrew',
  };
  return names[code] || code;
}

function getDefaultSpeakerColor(index: number): string {
  const colors = ['#5E6AD8', '#4EA6B1', '#FF6A6A', '#A6F2C2'];
  return colors[index % colors.length];
}
