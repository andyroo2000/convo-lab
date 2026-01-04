import { generateWithGemini } from './geminiClient.js';

export interface DialogueReview {
  overallScore: number; // 1-10
  issues: Array<{
    exchangeIndex: number;
    issue: string;
    severity: 'minor' | 'major';
    suggestedFix?: string;
  }>;
  strengths: string[];
  needsRevision: boolean;
}

interface DialogueExchange {
  textL2: string;
  translationL1: string;
  speakerName: string;
}

export async function reviewDialogue(
  exchanges: DialogueExchange[],
  proficiencyLevel: string,
  targetLanguage: string
): Promise<DialogueReview> {
  const prompt = `Review this ${targetLanguage.toUpperCase()} dialogue for ${proficiencyLevel} level learners.

Evaluate on these criteria:
1. **Level appropriateness**: Vocabulary/grammar at ${proficiencyLevel} level
2. **Pedagogical quality**: Teaches useful, reusable phrases
3. **Natural flow**: Sounds like authentic conversation
4. **Grammar variety**: Showcases different structures
5. **Vocabulary quality**: Good teaching words, not filler

Dialogue (${exchanges.length} exchanges):
${exchanges.map((e, i) => `${i + 1}. ${e.speakerName}: ${e.textL2}\n   (${e.translationL1})`).join('\n\n')}

Provide constructive feedback. Return ONLY a JSON object:
{
  "overallScore": 8,
  "issues": [
    {"exchangeIndex": 3, "issue": "Uses advanced grammar instead of ${proficiencyLevel} level", "severity": "major", "suggestedFix": "Replace with simpler structure"}
  ],
  "strengths": ["Natural conversation flow", "Good variety of question types"],
  "needsRevision": false
}

Set needsRevision=true only if overallScore < 7 or there are major issues.`;

  try {
    const response = await generateWithGemini(prompt);
    let jsonText = response.trim();

    // Extract JSON from markdown code blocks if present
    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse dialogue review:', error);
    return {
      overallScore: 7,
      issues: [],
      strengths: [],
      needsRevision: false,
    };
  }
}

export async function editDialogue(
  exchanges: DialogueExchange[],
  review: DialogueReview,
  proficiencyLevel: string,
  targetLanguage: string
): Promise<DialogueExchange[]> {
  const issuesDescription = review.issues
    .map((i) => `- Exchange ${i.exchangeIndex + 1}: ${i.issue}. ${i.suggestedFix || ''}`)
    .join('\n');

  const prompt = `Revise this ${targetLanguage.toUpperCase()} dialogue for ${proficiencyLevel} level learners based on feedback.

Original dialogue:
${exchanges.map((e, i) => `${i + 1}. ${e.speakerName}: ${e.textL2}\n   (${e.translationL1})`).join('\n\n')}

Issues to fix:
${issuesDescription}

Provide the revised dialogue with the same number of exchanges. Keep the good parts, fix the issues.

Return ONLY a JSON array:
[
  {
    "textL2": "...",
    "translationL1": "...",
    "speakerName": "...",
    "relationshipDescription": "...",
    "vocabulary": [{"word": "...", "translation": "..."}]
  }
]`;

  try {
    const response = await generateWithGemini(prompt);
    let jsonText = response.trim();

    if (jsonText.includes('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse edited dialogue:', error);
    return exchanges; // Return original on error
  }
}
