import { prisma } from '../db/client.js';
import { generateWithGemini } from './geminiClient.js';
import { uploadImage } from './storageClient.js';

interface GenerateImagesRequest {
  episodeId: string;
  dialogueId: string;
  imageCount?: number;
}

export async function generateDialogueImages(request: GenerateImagesRequest) {
  const { episodeId, dialogueId, imageCount = 3 } = request;

  // Get dialogue
  const dialogue = await prisma.dialogue.findUnique({
    where: { id: dialogueId },
    include: {
      sentences: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!dialogue) {
    throw new Error('Dialogue not found');
  }

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
  });

  if (!episode) {
    throw new Error('Episode not found');
  }

  // Divide dialogue into sections
  const totalSentences = dialogue.sentences.length;
  const sentencesPerImage = Math.ceil(totalSentences / imageCount);

  const images = [];

  for (let i = 0; i < imageCount; i++) {
    const startIdx = i * sentencesPerImage;
    const endIdx = Math.min(startIdx + sentencesPerImage, totalSentences);
    const section = dialogue.sentences.slice(startIdx, endIdx);

    if (section.length === 0) continue;

    // Generate image prompt
    const imagePrompt = await generateImagePrompt(
      episode.sourceText,
      section.map(s => s.text).join(' '),
      episode.targetLanguage
    );

    // For MVP, we'll store the prompt but not actually generate images yet
    // TODO: Integrate with Imagen API or Nano Banana
    // For now, create placeholder
    const imageUrl = `https://placehold.co/800x600/EEF3FB/5E6AD8?text=Scene+${i + 1}`;

    // Create image record
    const image = await prisma.image.create({
      data: {
        episodeId,
        url: imageUrl,
        prompt: imagePrompt,
        order: i,
        sentenceStartId: section[0].id,
        sentenceEndId: section[section.length - 1].id,
      },
    });

    images.push(image);
  }

  return images;
}

async function generateImagePrompt(
  sourceText: string,
  dialogueSection: string,
  targetLanguage: string
): Promise<string> {
  const prompt = `Based on this story and dialogue section, create a detailed image prompt for a realistic scene:

Story: ${sourceText}

Dialogue section: ${dialogueSection}

Generate a detailed image prompt that:
1. Captures the key visual elements of this scene
2. Uses photo-realistic style
3. Shows Japanese people if the language is Japanese
4. Includes appropriate setting and atmosphere
5. Is suitable for language learning (clear, engaging, culturally appropriate)

Return only the image prompt, no other text.`;

  const imagePrompt = await generateWithGemini(
    prompt,
    'You are an expert at creating detailed, vivid image prompts for realistic scenes.'
  );

  return imagePrompt.trim();
}
