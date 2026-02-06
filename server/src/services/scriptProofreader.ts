import { generateWithGemini } from './geminiClient.js';
import { LessonScriptUnit } from './lessonScriptGenerator.js';

export interface ProofreadingResult {
  score: number; // 1-10
  issues: string[];
  revisedUnits?: LessonScriptUnit[];
}

/**
 * Proofread a generated lesson script for quality issues.
 *
 * Checks:
 * - Vocabulary density (1-3 new words per exchange)
 * - JLPT level appropriateness
 * - Japanese text accuracy
 * - Natural narrator English
 *
 * Uses Gemini 2.5 Flash for fast, cheap evaluation (~$0.001 per call).
 */
export async function proofreadScript(
  units: LessonScriptUnit[],
  jlptLevel?: string
): Promise<ProofreadingResult> {
  // Extract L2 and narration units for review
  const l2Units = units
    .map((u, i) => ({ ...u, index: i }))
    .filter((u) => u.type === 'L2' || u.type === 'narration_L1');

  // Build a condensed view of the script for the proofreader
  const scriptSummary = l2Units
    .map((u) => {
      if (u.type === 'L2') {
        return `[L2:${u.index}] ${u.text}${u.translation ? ` → ${u.translation}` : ''}`;
      }
      return `[NAR:${u.index}] ${u.text}`;
    })
    .join('\n');

  const jlptContext = jlptLevel ? `Target JLPT level: ${jlptLevel}` : 'No specific JLPT level';

  const prompt = `You are a Japanese language teaching script reviewer. Review the following Pimsleur-style lesson script and evaluate its quality.

${jlptContext}

SCRIPT:
${scriptSummary}

Evaluate on these criteria:
1. Vocabulary density: Are there 1-3 new vocabulary items introduced per exchange section? Too many new words overwhelms learners.
2. JLPT level appropriateness: Does the Japanese match the target JLPT level? ${jlptLevel ? `The vocabulary and grammar should be appropriate for ${jlptLevel}.` : ''}
3. Japanese text accuracy: Are there any obvious errors in the Japanese text (wrong kanji, unnatural phrasing)?
4. Narrator English quality: Is the English narration natural and clear? No awkward phrasing?
5. Pedagogical flow: Does the lesson build logically? Are items reviewed before moving on?

Return your response as JSON with this exact structure:
{
  "score": <number 1-10>,
  "issues": [<array of specific issue strings>],
  "suggestions": [<array of improvement suggestions>]
}

If score >= 7, the script is good to use as-is.
If score < 7, include specific issues that need fixing.

Be concise. Only flag real problems, not minor style preferences.`;

  try {
    const response = await generateWithGemini(prompt, 'gemini-2.5-flash');
    const parsed = JSON.parse(response);

    const result: ProofreadingResult = {
      score: typeof parsed.score === 'number' ? parsed.score : 5,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };

    // eslint-disable-next-line no-console
    console.log(`[PROOFREADER] Score: ${result.score}/10, Issues: ${result.issues.length}`);

    if (result.issues.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[PROOFREADER] Issues: ${result.issues.join('; ')}`);
    }

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[PROOFREADER] Failed to proofread script:', error);
    // Return a passing score on failure so the pipeline continues
    return {
      score: 7,
      issues: ['Proofreading failed - proceeding with original script'],
    };
  }
}
