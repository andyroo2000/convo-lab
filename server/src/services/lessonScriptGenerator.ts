import { generateWithGemini } from './geminiClient';
import { LessonPlan, LessonSection, DrillEvent } from './lessonPlanner';
import { CoreItem } from './courseItemExtractor';

// Script unit types for the audio timeline
export type LessonScriptUnit =
  | { type: 'narration_L1'; text: string; voiceId: string }
  | { type: 'L2'; text: string; reading?: string; voiceId: string; speed?: number }
  | { type: 'pause'; seconds: number }
  | { type: 'marker'; label: string };

export interface GeneratedScript {
  units: LessonScriptUnit[];
  estimatedDurationSeconds: number;
}

interface ScriptGenerationContext {
  episodeTitle: string;
  targetLanguage: string;
  nativeLanguage: string;
  l1VoiceId: string;
  l2VoiceId: string;
}

/**
 * Generate complete lesson script from lesson plan
 * Returns timeline of script units (narration, L2 audio, pauses, markers)
 *
 * OPTIMIZED: Uses batched Gemini calls to reduce API usage from 20+ to 3 calls per lesson
 */
export async function generateLessonScript(
  lessonPlan: LessonPlan,
  context: ScriptGenerationContext
): Promise<GeneratedScript> {
  const units: LessonScriptUnit[] = [];
  let currentTime = 0;

  // Find sections by type for batching
  const introSection = lessonPlan.sections.find(s => s.type === 'intro');
  const coreIntroSection = lessonPlan.sections.find(s => s.type === 'core_intro');
  const earlySRSSection = lessonPlan.sections.find(s => s.type === 'early_srs');
  const phraseSection = lessonPlan.sections.find(s => s.type === 'phrase_construction');
  const dialogueSection = lessonPlan.sections.find(s => s.type === 'dialogue_integration');
  const qaSection = lessonPlan.sections.find(s => s.type === 'qa');
  const roleplaySection = lessonPlan.sections.find(s => s.type === 'roleplay');
  const lateSRSSection = lessonPlan.sections.find(s => s.type === 'late_srs');
  const outroSection = lessonPlan.sections.find(s => s.type === 'outro');

  console.log('🚀 Generating lesson script with batched AI calls...');

  // BATCH 1: Intro + Core Intros + Early SRS
  let batch1Results: Awaited<ReturnType<typeof generateBatch1Script>> | null = null;
  if (introSection && coreIntroSection && earlySRSSection) {
    console.log('  📦 Batch 1: Intro + Core Intros + Early SRS');
    batch1Results = await generateBatch1Script(
      introSection,
      coreIntroSection,
      earlySRSSection,
      context
    );
  }

  // BATCH 2: Phrase Construction + Dialogue Integration + Q&A
  let batch2Results: Awaited<ReturnType<typeof generateBatch2Script>> | null = null;
  if (phraseSection && dialogueSection && qaSection) {
    console.log('  📦 Batch 2: Phrase Construction + Dialogue + Q&A');
    batch2Results = await generateBatch2Script(
      phraseSection,
      dialogueSection,
      qaSection,
      context
    );
  }

  // BATCH 3: Roleplay + Late SRS + Outro
  let batch3Results: Awaited<ReturnType<typeof generateBatch3Script>> | null = null;
  if (roleplaySection && lateSRSSection && outroSection) {
    console.log('  📦 Batch 3: Roleplay + Late SRS + Outro');
    batch3Results = await generateBatch3Script(
      roleplaySection,
      lateSRSSection,
      outroSection,
      context
    );
  }

  console.log('✅ All batched AI calls complete');

  // Add lesson start marker
  units.push({ type: 'marker', label: `Lesson ${lessonPlan.lessonNumber} Start` });

  // Track upcoming drills by their target time
  const upcomingDrills = [...lessonPlan.drillEvents];
  let nextDrillIndex = 0;

  // Process each section using batched results
  for (const section of lessonPlan.sections) {
    // Add section marker
    units.push({ type: 'marker', label: section.title });

    // Check if any drills should fire before this section
    while (
      nextDrillIndex < upcomingDrills.length &&
      upcomingDrills[nextDrillIndex].targetOffsetSeconds <= currentTime
    ) {
      const drill = upcomingDrills[nextDrillIndex];
      const drillUnits = generateDrillUnits(drill, context);
      units.push(...drillUnits);
      currentTime += estimateUnitsDuration(drillUnits);
      nextDrillIndex++;
    }

    // Generate section script using batched results
    const sectionUnits = await generateSectionScriptBatched(
      section,
      context,
      batch1Results,
      batch2Results,
      batch3Results
    );
    units.push(...sectionUnits);
    currentTime += estimateUnitsDuration(sectionUnits);
  }

  // Add any remaining drills (late review)
  while (nextDrillIndex < upcomingDrills.length) {
    const drill = upcomingDrills[nextDrillIndex];
    const drillUnits = generateDrillUnits(drill, context);
    units.push(...drillUnits);
    currentTime += estimateUnitsDuration(drillUnits);
    nextDrillIndex++;
  }

  // Add end marker
  units.push({ type: 'marker', label: `Lesson ${lessonPlan.lessonNumber} End` });

  return {
    units,
    estimatedDurationSeconds: currentTime,
  };
}

/**
 * Generate script units for a specific section using batched results
 */
async function generateSectionScriptBatched(
  section: LessonSection,
  context: ScriptGenerationContext,
  batch1Results: Awaited<ReturnType<typeof generateBatch1Script>> | null,
  batch2Results: Awaited<ReturnType<typeof generateBatch2Script>> | null,
  batch3Results: Awaited<ReturnType<typeof generateBatch3Script>> | null
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  switch (section.type) {
    case 'intro':
      if (batch1Results) {
        return [
          { type: 'narration_L1', text: batch1Results.introNarration, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 },
        ];
      }
      return generateIntroScript(section, context);

    case 'core_intro':
      if (batch1Results && section.coreItems) {
        const coreItems = section.coreItems;
        for (let i = 0; i < coreItems.length; i++) {
          const item = coreItems[i];
          const introNarration = batch1Results.coreIntros[i] || 'Listen carefully to this phrase.';

          // Pimsleur backward-build: teach components from end to beginning
          if (item.components && item.components.length > 1) {
            // Introduce the full phrase context
            units.push(
              { type: 'narration_L1', text: introNarration, voiceId: context.l1VoiceId },
              { type: 'pause', seconds: 0.5 }
            );

            // Sort components by order (0 = teach first, higher = teach later)
            const sortedComponents = [...item.components].sort((a, b) => a.order - b.order);

            // Teach each component in backward-build order
            for (const component of sortedComponents) {
              units.push(
                // Introduce the component meaning in L1
                {
                  type: 'narration_L1',
                  text: `Listen for "${component.translationL1}".`,
                  voiceId: context.l1VoiceId,
                },
                { type: 'pause', seconds: 0.5 },
                // Play component at normal speed
                {
                  type: 'L2',
                  text: component.textL2,
                  reading: component.readingL2,
                  voiceId: context.l2VoiceId,
                  speed: 1.0,
                },
                { type: 'pause', seconds: 1.0 },
                // Play component slowly
                {
                  type: 'L2',
                  text: component.textL2,
                  reading: component.readingL2,
                  voiceId: context.l2VoiceId,
                  speed: 0.75,
                },
                { type: 'pause', seconds: 1.5 }
              );
            }

            // After teaching all components, have learner try the full phrase
            units.push(
              {
                type: 'narration_L1',
                text: `Now try saying the full phrase: "${item.translationL1}".`,
                voiceId: context.l1VoiceId,
              },
              { type: 'pause', seconds: 3.0 },
              {
                type: 'L2',
                text: item.textL2,
                reading: item.readingL2 || undefined,
                voiceId: context.l2VoiceId,
                speed: 1.0,
              },
              { type: 'pause', seconds: 2.0 }
            );
          } else {
            // Simple phrase without components - original behavior
            units.push(
              { type: 'narration_L1', text: introNarration, voiceId: context.l1VoiceId },
              { type: 'pause', seconds: 0.5 },
              {
                type: 'L2',
                text: item.textL2,
                reading: item.readingL2 || undefined,
                voiceId: context.l2VoiceId,
                speed: 1.0,
              },
              { type: 'pause', seconds: 1.0 },
              {
                type: 'L2',
                text: item.textL2,
                reading: item.readingL2 || undefined,
                voiceId: context.l2VoiceId,
                speed: 0.75,
              },
              { type: 'pause', seconds: 2.0 }
            );
          }
        }
        return units;
      }
      return generateCoreIntroScript(section, context);

    case 'early_srs':
      if (batch1Results && section.coreItems) {
        units.push(
          { type: 'narration_L1', text: batch1Results.earlySRSIntro, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 }
        );

        for (const item of section.coreItems) {
          units.push(
            {
              type: 'narration_L1',
              text: `How do you say "${item.translationL1}"?`,
              voiceId: context.l1VoiceId,
            },
            { type: 'pause', seconds: 3.0 },
            {
              type: 'L2',
              text: item.textL2,
              reading: item.readingL2 || undefined,
              voiceId: context.l2VoiceId,
            },
            { type: 'pause', seconds: 1.5 }
          );
        }
        return units;
      }
      return generateEarlySRSScript(section, context);

    case 'phrase_construction':
      if (batch2Results && section.coreItems) {
        units.push(
          { type: 'narration_L1', text: batch2Results.phraseConstructionIntro, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 }
        );

        for (const item of section.coreItems.slice(0, 3)) {
          units.push(
            {
              type: 'narration_L1',
              text: `Try saying "${item.translationL1}"`,
              voiceId: context.l1VoiceId,
            },
            { type: 'pause', seconds: 3.0 },
            {
              type: 'L2',
              text: item.textL2,
              reading: item.readingL2 || undefined,
              voiceId: context.l2VoiceId,
            },
            { type: 'pause', seconds: 1.5 }
          );
        }
        return units;
      }
      return generatePhraseConstructionScript(section, context);

    case 'dialogue_integration':
      if (batch2Results && section.coreItems) {
        units.push(
          { type: 'narration_L1', text: batch2Results.dialogueIntegrationIntro, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 }
        );

        for (const item of section.coreItems.slice(0, 5)) {
          units.push(
            {
              type: 'narration_L1',
              text: `Listen and repeat: "${item.translationL1}"`,
              voiceId: context.l1VoiceId,
            },
            { type: 'pause', seconds: 0.5 },
            {
              type: 'L2',
              text: item.textL2,
              reading: item.readingL2 || undefined,
              voiceId: context.l2VoiceId,
            },
            { type: 'pause', seconds: 2.0 }
          );
        }
        return units;
      }
      return generateDialogueIntegrationScript(section, context);

    case 'qa':
      if (batch2Results && section.coreItems) {
        const qaItems = section.coreItems.slice(0, 4);
        const introNarration = `Now let's practice responding to questions. I'll give you a scenario, and you respond in ${context.targetLanguage}.`;

        units.push(
          { type: 'narration_L1', text: introNarration, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 }
        );

        for (let i = 0; i < qaItems.length; i++) {
          const item = qaItems[i];
          const scenario = batch2Results.qaScenarios[i] || `How would you say "${item.translationL1}"?`;

          units.push(
            {
              type: 'narration_L1',
              text: scenario,
              voiceId: context.l1VoiceId,
            },
            { type: 'pause', seconds: 4.0 },
            {
              type: 'L2',
              text: item.textL2,
              reading: item.readingL2 || undefined,
              voiceId: context.l2VoiceId,
            },
            { type: 'pause', seconds: 1.5 }
          );
        }
        return units;
      }
      return generateQAScript(section, context);

    case 'roleplay':
      if (batch3Results && section.coreItems && section.coreItems.length >= 2) {
        units.push(
          { type: 'narration_L1', text: batch3Results.roleplayIntro, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 }
        );

        units.push(
          {
            type: 'narration_L1',
            text: `You start the conversation. Say "${section.coreItems[0].translationL1}"`,
            voiceId: context.l1VoiceId,
          },
          { type: 'pause', seconds: 4.0 },
          {
            type: 'L2',
            text: section.coreItems[0].textL2,
            reading: section.coreItems[0].readingL2 || undefined,
            voiceId: context.l2VoiceId,
          },
          { type: 'pause', seconds: 1.0 },
          {
            type: 'narration_L1',
            text: 'Good! Now they respond.',
            voiceId: context.l1VoiceId,
          },
          { type: 'pause', seconds: 0.5 },
          {
            type: 'L2',
            text: section.coreItems[1].textL2,
            reading: section.coreItems[1].readingL2 || undefined,
            voiceId: context.l2VoiceId,
          },
          { type: 'pause', seconds: 2.0 }
        );
        return units;
      }
      return generateRolePlayScript(section, context);

    case 'late_srs':
      if (batch3Results && section.coreItems) {
        units.push(
          { type: 'narration_L1', text: batch3Results.lateSRSIntro, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 }
        );

        for (const item of section.coreItems) {
          units.push(
            {
              type: 'narration_L1',
              text: item.translationL1,
              voiceId: context.l1VoiceId,
            },
            { type: 'pause', seconds: 2.5 },
            {
              type: 'L2',
              text: item.textL2,
              reading: item.readingL2 || undefined,
              voiceId: context.l2VoiceId,
            },
            { type: 'pause', seconds: 1.0 }
          );
        }
        return units;
      }
      return generateLateSRSScript(section, context);

    case 'outro':
      if (batch3Results) {
        return [
          { type: 'narration_L1', text: batch3Results.outro, voiceId: context.l1VoiceId },
          { type: 'pause', seconds: 1.0 },
        ];
      }
      return generateOutroScript(section, context);

    default:
      return units;
  }
}

/**
 * Generate script units for a specific section
 */
async function generateSectionScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  switch (section.type) {
    case 'intro':
      return generateIntroScript(section, context);

    case 'core_intro':
      return generateCoreIntroScript(section, context);

    case 'early_srs':
      return generateEarlySRSScript(section, context);

    case 'phrase_construction':
      return generatePhraseConstructionScript(section, context);

    case 'dialogue_integration':
      return generateDialogueIntegrationScript(section, context);

    case 'qa':
      return generateQAScript(section, context);

    case 'roleplay':
      return generateRolePlayScript(section, context);

    case 'late_srs':
      return generateLateSRSScript(section, context);

    case 'outro':
      return generateOutroScript(section, context);

    default:
      return units;
  }
}

/**
 * BATCH 1: Generate intro, core vocabulary intros, and early SRS intro in one call
 */
async function generateBatch1Script(
  introSection: LessonSection,
  coreIntroSection: LessonSection,
  earlySRSSection: LessonSection,
  context: ScriptGenerationContext
): Promise<{
  introNarration: string;
  coreIntros: string[];
  earlySRSIntro: string;
}> {
  const coreItems = coreIntroSection.coreItems || [];

  const prompt = `You are creating a Pimsleur-style language learning lesson in ${context.targetLanguage} for ${context.nativeLanguage} speakers.

Generate ALL of the following narrations in a single JSON response:

1. LESSON_INTRO: A warm, encouraging introduction (2-3 sentences) that:
   - Welcomes the learner to the lesson
   - Briefly describes what they'll learn (based on episode: "${context.episodeTitle}")
   - Encourages them to respond out loud during pauses

2. CORE_ITEM_INTROS: For each of the ${coreItems.length} phrases below, write 1-2 sentences that:
   - Explains when/how to use this phrase
   - Prompts the learner to listen carefully

   Phrases:
${coreItems.map((item, i) => `   ${i + 1}. "${item.textL2}" (meaning: "${item.translationL1}")`).join('\n')}

3. EARLY_SRS_INTRO: A brief transition (1 sentence) introducing practice with ${context.nativeLanguage} prompts

Return as JSON with this exact structure:
{
  "lessonIntro": "...",
  "coreItemIntros": ["...", "...", ...],
  "earlySRSIntro": "..."
}

Write only the JSON, no additional text.`;

  const response = await generateWithGemini(prompt);

  // Parse JSON response (strip markdown code blocks if present)
  try {
    let jsonText = response.trim();

    // Remove markdown code blocks if present
    if (jsonText.includes('```')) {
      // Extract content between ``` markers
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonText);
    return {
      introNarration: parsed.lessonIntro,
      coreIntros: parsed.coreItemIntros,
      earlySRSIntro: parsed.earlySRSIntro,
    };
  } catch (err) {
    console.error('Failed to parse batch 1 response:', err);
    console.error('Response was:', response);
    // Fallback to simple splits if JSON parsing fails
    const lines = response.split('\n').filter(l => l.trim());
    return {
      introNarration: lines[0] || 'Welcome to this lesson.',
      coreIntros: coreItems.map((_, i) => lines[i + 1] || 'Listen carefully to this phrase.'),
      earlySRSIntro: lines[lines.length - 1] || "Now let's practice.",
    };
  }
}

/**
 * Generate introduction narration using Gemini
 */
async function generateIntroScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const prompt = `You are creating a Pimsleur-style language learning lesson in ${context.targetLanguage} for ${context.nativeLanguage} speakers.

Write a warm, encouraging introduction (2-3 sentences) that:
1. Welcomes the learner to the lesson
2. Briefly describes what they'll learn (based on episode: "${context.episodeTitle}")
3. Encourages them to respond out loud during pauses

Keep it natural and conversational. Write only the narration text, no formatting.`;

  const narration = await generateWithGemini(prompt);

  return [
    { type: 'narration_L1', text: narration.trim(), voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 },
  ];
}

/**
 * Generate core vocabulary introduction
 * Introduces each core item with L1 explanation + L2 pronunciation + slow version
 */
async function generateCoreIntroScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  if (!section.coreItems || section.coreItems.length === 0) {
    return units;
  }

  for (const item of section.coreItems) {
    // Generate intro narration for this item
    const prompt = `You are teaching ${context.targetLanguage}. Introduce this phrase to a beginner:

${context.targetLanguage} phrase: "${item.textL2}"
${context.nativeLanguage} meaning: "${item.translationL1}"

Write 1-2 sentences of ${context.nativeLanguage} narration that:
1. Explains when/how to use this phrase
2. Prompts the learner to listen carefully

Keep it brief and encouraging. Write only the narration text.`;

    const narration = await generateWithGemini(prompt);

    units.push(
      { type: 'narration_L1', text: narration.trim(), voiceId: context.l1VoiceId },
      { type: 'pause', seconds: 0.5 },
      // L2 at normal speed
      {
        type: 'L2',
        text: item.textL2,
        reading: item.readingL2 || undefined,
        voiceId: context.l2VoiceId,
        speed: 1.0,
      },
      { type: 'pause', seconds: 1.0 },
      // L2 slow for practice
      {
        type: 'L2',
        text: item.textL2,
        reading: item.readingL2 || undefined,
        voiceId: context.l2VoiceId,
        speed: 0.75,
      },
      { type: 'pause', seconds: 2.0 }
    );
  }

  return units;
}

/**
 * Early SRS practice - simple recall drills
 */
async function generateEarlySRSScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  if (!section.coreItems || section.coreItems.length === 0) {
    return units;
  }

  const introNarration = `Now let's practice what you just learned. Listen to the ${context.nativeLanguage} prompt, then try to say the ${context.targetLanguage} phrase before you hear it.`;

  units.push(
    { type: 'narration_L1', text: introNarration, voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 }
  );

  // Simple recall for each item
  for (const item of section.coreItems) {
    units.push(
      {
        type: 'narration_L1',
        text: `How do you say "${item.translationL1}"?`,
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 3.0 }, // Anticipation pause
      {
        type: 'L2',
        text: item.textL2,
        reading: item.readingL2 || undefined,
        voiceId: context.l2VoiceId,
      },
      { type: 'pause', seconds: 1.5 }
    );
  }

  return units;
}

/**
 * Phrase construction - building up from smaller parts
 */
async function generatePhraseConstructionScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  const prompt = `You are teaching ${context.targetLanguage}. Write 2-3 sentences of ${context.nativeLanguage} narration for a "phrase construction" section where learners combine simple phrases into more complex ones.

Keep it encouraging and explain that they'll practice building longer phrases.`;

  const narration = await generateWithGemini(prompt);

  units.push(
    { type: 'narration_L1', text: narration.trim(), voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 }
  );

  // For MVP, just practice the existing phrases
  // Future: actually construct new phrases from components
  if (section.coreItems) {
    for (const item of section.coreItems.slice(0, 3)) {
      units.push(
        {
          type: 'narration_L1',
          text: `Try saying "${item.translationL1}"`,
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 3.0 },
        {
          type: 'L2',
          text: item.textL2,
          reading: item.readingL2 || undefined,
          voiceId: context.l2VoiceId,
        },
        { type: 'pause', seconds: 1.5 }
      );
    }
  }

  return units;
}

/**
 * Dialogue integration - practice with conversation context
 */
async function generateDialogueIntegrationScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  const prompt = `You are teaching ${context.targetLanguage}. Write 2-3 sentences of ${context.nativeLanguage} narration introducing a "dialogue practice" section.

Explain that learners will now use these phrases in conversation. Keep it brief and encouraging.`;

  const narration = await generateWithGemini(prompt);

  units.push(
    { type: 'narration_L1', text: narration.trim(), voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 }
  );

  // Practice core items in dialogue context
  if (section.coreItems) {
    for (const item of section.coreItems.slice(0, 5)) {
      units.push(
        {
          type: 'narration_L1',
          text: `Listen and repeat: "${item.translationL1}"`,
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 0.5 },
        {
          type: 'L2',
          text: item.textL2,
          reading: item.readingL2 || undefined,
          voiceId: context.l2VoiceId,
        },
        { type: 'pause', seconds: 2.0 }
      );
    }
  }

  return units;
}

/**
 * BATCH 2: Generate phrase construction, dialogue integration, and Q&A scenarios in one call
 */
async function generateBatch2Script(
  phraseSection: LessonSection,
  dialogueSection: LessonSection,
  qaSection: LessonSection,
  context: ScriptGenerationContext
): Promise<{
  phraseConstructionIntro: string;
  dialogueIntegrationIntro: string;
  qaScenarios: string[];
}> {
  const qaItems = (qaSection.coreItems || []).slice(0, 4);

  const prompt = `You are creating a Pimsleur-style language learning lesson in ${context.targetLanguage} for ${context.nativeLanguage} speakers.

Generate ALL of the following narrations in a single JSON response:

1. PHRASE_CONSTRUCTION_INTRO: Write 2-3 sentences introducing a section where learners combine simple phrases into more complex ones. Keep it encouraging.

2. DIALOGUE_INTEGRATION_INTRO: Write 2-3 sentences introducing a dialogue practice section. Explain that learners will now use these phrases in conversation.

3. QA_SCENARIOS: For each phrase below, create a brief scenario (1 sentence) where a learner would respond with that phrase.
   Example format: "You're at a restaurant and want to order. What do you say?"

   Phrases to create scenarios for:
${qaItems.map((item, i) => `   ${i + 1}. "${item.translationL1}" (${context.targetLanguage}: "${item.textL2}")`).join('\n')}

Return as JSON with this exact structure:
{
  "phraseConstructionIntro": "...",
  "dialogueIntegrationIntro": "...",
  "qaScenarios": ["...", "...", ...]
}

Write only the JSON, no additional text.`;

  const response = await generateWithGemini(prompt);

  // Parse JSON response (strip markdown code blocks if present)
  try {
    let jsonText = response.trim();

    // Remove markdown code blocks if present
    if (jsonText.includes('```')) {
      // Extract content between ``` markers
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonText);
    return {
      phraseConstructionIntro: parsed.phraseConstructionIntro,
      dialogueIntegrationIntro: parsed.dialogueIntegrationIntro,
      qaScenarios: parsed.qaScenarios,
    };
  } catch (err) {
    console.error('Failed to parse batch 2 response:', err);
    console.error('Response was:', response);
    // Fallback
    return {
      phraseConstructionIntro: "Let's practice building longer phrases.",
      dialogueIntegrationIntro: "Now let's use these phrases in conversation.",
      qaScenarios: qaItems.map(item => `How would you say "${item.translationL1}"?`),
    };
  }
}

/**
 * Q&A drills - scenario-based prompts
 */
async function generateQAScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  const introNarration = `Now let's practice responding to questions. I'll give you a scenario, and you respond in ${context.targetLanguage}.`;

  units.push(
    { type: 'narration_L1', text: introNarration, voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 }
  );

  // For each core item, create a scenario-based drill
  if (section.coreItems) {
    for (const item of section.coreItems.slice(0, 4)) {
      const scenarioPrompt = `Create a brief scenario (1 sentence) in ${context.nativeLanguage} where a learner would respond with: "${item.translationL1}"

Example format: "You're at a restaurant and want to order. What do you say?"

Write only the scenario question.`;

      const scenario = await generateWithGemini(scenarioPrompt);

      units.push(
        {
          type: 'narration_L1',
          text: scenario.trim(),
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 4.0 }, // Longer pause for thinking
        {
          type: 'L2',
          text: item.textL2,
          reading: item.readingL2 || undefined,
          voiceId: context.l2VoiceId,
        },
        { type: 'pause', seconds: 1.5 }
      );
    }
  }

  return units;
}

/**
 * Role-play section - learner plays one role
 */
async function generateRolePlayScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  const prompt = `You are teaching ${context.targetLanguage}. Write 2-3 sentences of ${context.nativeLanguage} narration for a role-play section.

Explain that the learner will play one role in a conversation, responding at the appropriate times. Keep it encouraging.`;

  const narration = await generateWithGemini(prompt);

  units.push(
    { type: 'narration_L1', text: narration.trim(), voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 }
  );

  // Simple role-play with pauses for learner responses
  if (section.coreItems && section.coreItems.length >= 2) {
    units.push(
      {
        type: 'narration_L1',
        text: `You start the conversation. Say "${section.coreItems[0].translationL1}"`,
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 4.0 },
      {
        type: 'L2',
        text: section.coreItems[0].textL2,
        reading: section.coreItems[0].readingL2 || undefined,
        voiceId: context.l2VoiceId,
      },
      { type: 'pause', seconds: 1.0 },
      {
        type: 'narration_L1',
        text: 'Good! Now they respond.',
        voiceId: context.l1VoiceId,
      },
      { type: 'pause', seconds: 0.5 },
      {
        type: 'L2',
        text: section.coreItems[1].textL2,
        reading: section.coreItems[1].readingL2 || undefined,
        voiceId: context.l2VoiceId,
      },
      { type: 'pause', seconds: 2.0 }
    );
  }

  return units;
}

/**
 * Late SRS - final review of all items
 */
async function generateLateSRSScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const units: LessonScriptUnit[] = [];

  const introNarration = `Let's review everything you've learned in this lesson. Try to respond quickly.`;

  units.push(
    { type: 'narration_L1', text: introNarration, voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 }
  );

  // Rapid-fire review of all core items
  if (section.coreItems) {
    for (const item of section.coreItems) {
      units.push(
        {
          type: 'narration_L1',
          text: item.translationL1,
          voiceId: context.l1VoiceId,
        },
        { type: 'pause', seconds: 2.5 },
        {
          type: 'L2',
          text: item.textL2,
          reading: item.readingL2 || undefined,
          voiceId: context.l2VoiceId,
        },
        { type: 'pause', seconds: 1.0 }
      );
    }
  }

  return units;
}

/**
 * BATCH 3: Generate roleplay intro, late SRS intro, and outro in one call
 */
async function generateBatch3Script(
  roleplaySection: LessonSection,
  lateSRSSection: LessonSection,
  outroSection: LessonSection,
  context: ScriptGenerationContext
): Promise<{
  roleplayIntro: string;
  lateSRSIntro: string;
  outro: string;
}> {
  const prompt = `You are creating a Pimsleur-style language learning lesson in ${context.targetLanguage} for ${context.nativeLanguage} speakers.

Generate ALL of the following narrations in a single JSON response:

1. ROLEPLAY_INTRO: Write 2-3 sentences introducing a role-play section where the learner will play one role in a conversation, responding at the appropriate times. Keep it encouraging.

2. LATE_SRS_INTRO: Write 1 sentence introducing a final review section where learners should try to respond quickly.

3. LESSON_OUTRO: Write 2-3 sentences that:
   - Congratulates the learner
   - Summarizes what they practiced (based on episode: "${context.episodeTitle}")
   - Encourages them to continue

Return as JSON with this exact structure:
{
  "roleplayIntro": "...",
  "lateSRSIntro": "...",
  "outro": "..."
}

Write only the JSON, no additional text.`;

  const response = await generateWithGemini(prompt);

  // Parse JSON response (strip markdown code blocks if present)
  try {
    let jsonText = response.trim();

    // Remove markdown code blocks if present
    if (jsonText.includes('```')) {
      // Extract content between ``` markers
      const match = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        jsonText = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonText);
    return {
      roleplayIntro: parsed.roleplayIntro,
      lateSRSIntro: parsed.lateSRSIntro,
      outro: parsed.outro,
    };
  } catch (err) {
    console.error('Failed to parse batch 3 response:', err);
    console.error('Response was:', response);
    // Fallback
    return {
      roleplayIntro: "Now let's practice with a role-play conversation.",
      lateSRSIntro: "Let's review everything you've learned in this lesson.",
      outro: "Congratulations on completing this lesson! Keep practicing.",
    };
  }
}

/**
 * Outro - conclusion and encouragement
 */
async function generateOutroScript(
  section: LessonSection,
  context: ScriptGenerationContext
): Promise<LessonScriptUnit[]> {
  const prompt = `You are completing a ${context.targetLanguage} lesson. Write 2-3 sentences of ${context.nativeLanguage} narration that:
1. Congratulates the learner
2. Summarizes what they practiced
3. Encourages them to continue

Keep it warm and motivating.`;

  const narration = await generateWithGemini(prompt);

  return [
    { type: 'narration_L1', text: narration.trim(), voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 1.0 },
  ];
}

/**
 * Generate script units for a single drill event
 */
function generateDrillUnits(
  drill: DrillEvent,
  context: ScriptGenerationContext
): LessonScriptUnit[] {
  const item = drill.coreItem;
  const units: LessonScriptUnit[] = [];

  // Different prompts based on drill type
  let prompt: string;
  switch (drill.drillType) {
    case 'recall':
      prompt = `How do you say "${item.translationL1}"?`;
      break;
    case 'transform':
      prompt = `Try saying "${item.translationL1}" again.`;
      break;
    case 'expand':
      prompt = `One more time: "${item.translationL1}"`;
      break;
    case 'context':
      prompt = `Remember "${item.translationL1}"?`;
      break;
    case 'roleplay':
      prompt = `In the conversation, say "${item.translationL1}"`;
      break;
  }

  units.push(
    { type: 'narration_L1', text: prompt, voiceId: context.l1VoiceId },
    { type: 'pause', seconds: 3.0 },
    {
      type: 'L2',
      text: item.textL2,
      reading: item.readingL2 || undefined,
      voiceId: context.l2VoiceId,
    },
    { type: 'pause', seconds: 1.0 }
  );

  return units;
}

/**
 * Estimate duration for a set of script units
 * Uses heuristics: ~150 words/min for speech, exact duration for pauses
 */
function estimateUnitsDuration(units: LessonScriptUnit[]): number {
  let total = 0;

  for (const unit of units) {
    switch (unit.type) {
      case 'narration_L1':
      case 'L2':
        // Estimate speech duration: ~150 words per minute (2.5 words/sec)
        // For CJK languages, ~3 characters per second
        const text = unit.text;
        const isCJK = /[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/.test(text);

        if (isCJK) {
          total += text.length / 3; // ~3 CJK chars per second
        } else {
          const wordCount = text.split(/\s+/).length;
          total += wordCount / 2.5; // ~2.5 words per second
        }

        // Adjust for speed if specified
        if (unit.type === 'L2' && unit.speed) {
          total = total / unit.speed;
        }
        break;

      case 'pause':
        total += unit.seconds;
        break;

      case 'marker':
        // Markers don't add duration
        break;
    }
  }

  return total;
}
