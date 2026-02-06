import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { CoreItem } from '../../../services/courseItemExtractor.js';
import { LessonPlan, LessonSection, DrillEvent } from '../../../services/lessonPlanner.js';
import { generateLessonScript, LessonScriptUnit } from '../../../services/lessonScriptGenerator.js';

// Create hoisted mocks
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());

vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

describe('lessonScriptGenerator', () => {
  // Helper to create mock core items
  const createCoreItems = (count: number): CoreItem[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      textL2: `Japanese text ${i}`,
      readingL2: `reading ${i}`,
      translationL1: `English translation ${i}`,
      complexityScore: 10 + i,
      sourceEpisodeId: 'episode-123',
      sourceSentenceId: `sentence-${i}`,
      order: i,
    }));

  // Helper to create a mock lesson plan
  const createMockLessonPlan = (coreItems: CoreItem[]): LessonPlan => ({
    lessonNumber: 1,
    title: 'Test Lesson - Lesson 1',
    coreItems,
    sections: [
      { type: 'intro', title: 'Introduction', targetDurationSeconds: 120 },
      { type: 'core_intro', title: 'New Vocabulary', targetDurationSeconds: 450, coreItems },
      { type: 'early_srs', title: 'Early Practice', targetDurationSeconds: 120, coreItems },
      {
        type: 'phrase_construction',
        title: 'Phrase Building',
        targetDurationSeconds: 120,
        coreItems,
      },
      {
        type: 'dialogue_integration',
        title: 'Dialogue Practice',
        targetDurationSeconds: 180,
        coreItems,
      },
      { type: 'qa', title: 'Q&A Practice', targetDurationSeconds: 180, coreItems },
      { type: 'roleplay', title: 'Role Play', targetDurationSeconds: 240, coreItems },
      { type: 'late_srs', title: 'Final Review', targetDurationSeconds: 300, coreItems },
      { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
    ] as LessonSection[],
    drillEvents: [
      {
        coreItemId: 'item-0',
        coreItem: coreItems[0],
        targetOffsetSeconds: 60,
        drillType: 'recall',
        intervalIndex: 0,
      },
      {
        coreItemId: 'item-0',
        coreItem: coreItems[0],
        targetOffsetSeconds: 180,
        drillType: 'transform',
        intervalIndex: 1,
      },
    ] as DrillEvent[],
    totalEstimatedDuration: 1200,
  });

  const mockContext = {
    episodeTitle: 'Test Episode',
    targetLanguage: 'Japanese',
    nativeLanguage: 'English',
    l1VoiceId: 'en-US-Neural2-A',
    l2VoiceId: 'ja-JP-Neural2-B',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock batch responses
    const batch1Response = JSON.stringify({
      lessonIntro: 'Welcome to this lesson!',
      coreItemIntros: ['Listen to phrase 1', 'Listen to phrase 2', 'Listen to phrase 3'],
      earlySRSIntro: "Let's practice what you learned.",
    });

    const batch2Response = JSON.stringify({
      phraseConstructionIntro: "Let's build longer phrases.",
      dialogueIntegrationIntro: "Now let's use these in conversation.",
      qaScenarios: ['Scenario 1?', 'Scenario 2?', 'Scenario 3?'],
    });

    const batch3Response = JSON.stringify({
      roleplayIntro: "Let's do a role play.",
      lateSRSIntro: "Let's review everything.",
      outro: 'Great job completing this lesson!',
    });

    // Return different responses based on call order
    mockGenerateWithGemini
      .mockResolvedValueOnce(batch1Response)
      .mockResolvedValueOnce(batch2Response)
      .mockResolvedValueOnce(batch3Response);
  });

  describe('generateLessonScript', () => {
    it('should generate a complete lesson script', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      expect(result).toHaveProperty('units');
      expect(result).toHaveProperty('estimatedDurationSeconds');
      expect(Array.isArray(result.units)).toBe(true);
      expect(result.units.length).toBeGreaterThan(0);
    });

    it('should include lesson start and end markers', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      const markers = result.units.filter(
        (u): u is Extract<LessonScriptUnit, { type: 'marker' }> => u.type === 'marker'
      );
      const markerLabels = markers.map((m) => m.label);

      expect(markerLabels).toContain('Lesson 1 Start');
      expect(markerLabels).toContain('Lesson 1 End');
    });

    it('should include section markers', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      const markers = result.units.filter(
        (u): u is Extract<LessonScriptUnit, { type: 'marker' }> => u.type === 'marker'
      );
      const markerLabels = markers.map((m) => m.label);

      expect(markerLabels).toContain('Introduction');
      expect(markerLabels).toContain('New Vocabulary');
      expect(markerLabels).toContain('Conclusion');
    });

    it('should make exactly 3 batched API calls', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      await generateLessonScript(lessonPlan, mockContext);

      expect(mockGenerateWithGemini).toHaveBeenCalledTimes(3);
    });

    it('should include L1 narration units', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      const narrations = result.units.filter(
        (u): u is Extract<LessonScriptUnit, { type: 'narration_L1' }> => u.type === 'narration_L1'
      );
      expect(narrations.length).toBeGreaterThan(0);
      expect(narrations[0].voiceId).toBe('en-US-Neural2-A');
    });

    it('should include L2 audio units', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      const l2Units = result.units.filter(
        (u): u is Extract<LessonScriptUnit, { type: 'L2' }> => u.type === 'L2'
      );
      expect(l2Units.length).toBeGreaterThan(0);
      expect(l2Units[0].voiceId).toBe('ja-JP-Neural2-B');
    });

    it('should include pause units', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      const pauses = result.units.filter(
        (u): u is Extract<LessonScriptUnit, { type: 'pause' }> => u.type === 'pause'
      );
      expect(pauses.length).toBeGreaterThan(0);
      expect(pauses[0].seconds).toBeGreaterThan(0);
    });

    it('should include drill events in the script', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      // Drill events should generate narration asking "How do you say..."
      const narrations = result.units.filter(
        (u): u is Extract<LessonScriptUnit, { type: 'narration_L1' }> => u.type === 'narration_L1'
      );
      const drillNarrations = narrations.filter(
        (n) =>
          n.text.includes('How do you say') ||
          n.text.includes('Try saying') ||
          n.text.includes('One more time') ||
          n.text.includes('Remember')
      );

      expect(drillNarrations.length).toBeGreaterThan(0);
    });

    it('should estimate duration greater than zero', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      expect(result.estimatedDurationSeconds).toBeGreaterThan(0);
    });
  });

  describe('batch API fallback', () => {
    it('should handle markdown code fences in batch 1 response', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const batch1Response = `\`\`\`json\n${JSON.stringify({
        lessonIntro: 'Welcome!',
        coreItemIntros: ['Intro 1', 'Intro 2', 'Intro 3'],
        earlySRSIntro: 'Practice time.',
      })}\n\`\`\``;

      mockGenerateWithGemini
        .mockReset()
        .mockResolvedValueOnce(batch1Response)
        .mockResolvedValueOnce(
          JSON.stringify({
            phraseConstructionIntro: 'Build phrases.',
            dialogueIntegrationIntro: 'Use in conversation.',
            qaScenarios: ['Q1?', 'Q2?', 'Q3?'],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            roleplayIntro: 'Role play time.',
            lateSRSIntro: 'Review time.',
            outro: 'Great job!',
          })
        );

      const result = await generateLessonScript(lessonPlan, mockContext);

      expect(result.units.length).toBeGreaterThan(0);
    });

    it('should use fallback when batch 1 JSON parsing fails', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      // Return invalid JSON for batch 1
      mockGenerateWithGemini
        .mockReset()
        .mockResolvedValueOnce('Invalid JSON response\nLine 2\nLine 3')
        .mockResolvedValueOnce(
          JSON.stringify({
            phraseConstructionIntro: 'Build phrases.',
            dialogueIntegrationIntro: 'Use in conversation.',
            qaScenarios: ['Q1?', 'Q2?', 'Q3?'],
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            roleplayIntro: 'Role play time.',
            lateSRSIntro: 'Review time.',
            outro: 'Great job!',
          })
        );

      const result = await generateLessonScript(lessonPlan, mockContext);

      // Should still generate a script using fallback
      expect(result.units.length).toBeGreaterThan(0);
    });
  });

  describe('section script generation', () => {
    it('should generate intro section with narration and pause', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      // Find intro section units (between intro marker and next marker)
      const introMarkerIndex = result.units.findIndex(
        (u): u is Extract<LessonScriptUnit, { type: 'marker' }> =>
          u.type === 'marker' && u.label === 'Introduction'
      );
      expect(introMarkerIndex).toBeGreaterThanOrEqual(0);

      // The next unit after intro marker should be narration
      if (introMarkerIndex < result.units.length - 1) {
        const nextUnit = result.units[introMarkerIndex + 1];
        expect(nextUnit.type).toBe('narration_L1');
      }
    });

    it('should generate core_intro section with L2 audio at different speeds', async () => {
      const coreItems = createCoreItems(2);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      const l2Units = result.units.filter(
        (u): u is Extract<LessonScriptUnit, { type: 'L2' }> => u.type === 'L2'
      );

      // Should have L2 units at normal speed (1.0) and slow speed (0.75)
      const normalSpeed = l2Units.filter((u) => u.speed === 1.0);
      const slowSpeed = l2Units.filter((u) => u.speed === 0.75);

      expect(normalSpeed.length).toBeGreaterThan(0);
      expect(slowSpeed.length).toBeGreaterThan(0);
    });

    it('should generate early_srs section with "How do you say" prompts', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);

      const result = await generateLessonScript(lessonPlan, mockContext);

      const narrations = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      const howDoYouSay = narrations.filter((n) => n.text.includes('How do you say'));

      expect(howDoYouSay.length).toBeGreaterThan(0);
    });

    it('should include reading in L2 units when available', async () => {
      const coreItems = createCoreItems(2);
      coreItems[0].readingL2 = 'かんじ';

      const lessonPlan = createMockLessonPlan(coreItems);
      const result = await generateLessonScript(lessonPlan, mockContext);

      const l2Units = result.units.filter((u) => u.type === 'L2') as Extract<
        LessonScriptUnit,
        { type: 'L2' }
      >[];
      const withReading = l2Units.filter((u) => u.reading !== undefined);

      expect(withReading.length).toBeGreaterThan(0);
    });
  });

  describe('drill event generation', () => {
    it('should generate recall drill with "How do you say" prompt', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);
      // Place drill event early so it fires before most sections
      lessonPlan.drillEvents = [
        {
          coreItemId: 'item-0',
          coreItem: coreItems[0],
          targetOffsetSeconds: 10, // Early timing
          drillType: 'recall',
          intervalIndex: 0,
        },
      ];

      const result = await generateLessonScript(lessonPlan, mockContext);

      const narrations = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      const recallPrompt = narrations.find((n) => n.text.includes('How do you say'));

      expect(recallPrompt).toBeDefined();
    });

    it('should generate transform drill with "Try saying" prompt', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);
      lessonPlan.drillEvents = [
        {
          coreItemId: 'item-0',
          coreItem: coreItems[0],
          targetOffsetSeconds: 10,
          drillType: 'transform',
          intervalIndex: 1,
        },
      ];

      const result = await generateLessonScript(lessonPlan, mockContext);

      const narrations = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      const transformPrompt = narrations.find((n) => n.text.includes('Try saying'));

      expect(transformPrompt).toBeDefined();
    });

    it('should generate expand drill with "One more time" prompt', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);
      lessonPlan.drillEvents = [
        {
          coreItemId: 'item-0',
          coreItem: coreItems[0],
          targetOffsetSeconds: 10,
          drillType: 'expand',
          intervalIndex: 2,
        },
      ];

      const result = await generateLessonScript(lessonPlan, mockContext);

      const narrations = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      const expandPrompt = narrations.find((n) => n.text.includes('One more time'));

      expect(expandPrompt).toBeDefined();
    });

    it('should generate context drill with "Remember" prompt', async () => {
      const coreItems = createCoreItems(3);
      const lessonPlan = createMockLessonPlan(coreItems);
      lessonPlan.drillEvents = [
        {
          coreItemId: 'item-0',
          coreItem: coreItems[0],
          targetOffsetSeconds: 10,
          drillType: 'context',
          intervalIndex: 3,
        },
      ];

      const result = await generateLessonScript(lessonPlan, mockContext);

      const narrations = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      const contextPrompt = narrations.find((n) => n.text.includes('Remember'));

      expect(contextPrompt).toBeDefined();
    });
  });

  describe('Pimsleur backward-build', () => {
    it('should generate backward-build units for phrases with components', async () => {
      const coreItems = createCoreItems(3);
      coreItems[0].components = [
        { textL2: 'です', readingL2: 'です', translationL1: 'it is', order: 0 },
        {
          textL2: '行きたいです',
          readingL2: 'いきたいです',
          translationL1: 'want to go',
          order: 1,
        },
        {
          textL2: '東京に行きたいです',
          readingL2: 'とうきょうにいきたいです',
          translationL1: 'want to go to Tokyo',
          order: 2,
        },
      ];

      const lessonPlan = createMockLessonPlan(coreItems);
      const result = await generateLessonScript(lessonPlan, mockContext);

      // Should have narrations that introduce each component
      const narrations = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      const componentIntros = narrations.filter((n) => n.text.includes('Listen for'));

      // Should have 3 "Listen for" prompts, one for each component
      expect(componentIntros.length).toBe(3);
    });

    it('should generate simple script for phrases without components', async () => {
      const coreItems = createCoreItems(3);
      // No components set (undefined by default)

      const lessonPlan = createMockLessonPlan(coreItems);
      const result = await generateLessonScript(lessonPlan, mockContext);

      // Should not have "Listen for" prompts (used only for backward-build)
      const narrations = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      const componentIntros = narrations.filter((n) => n.text.includes('Listen for'));

      expect(componentIntros.length).toBe(0);
    });
  });

  describe('lesson plan without all sections', () => {
    it('should handle missing sections gracefully', async () => {
      const coreItems = createCoreItems(2);
      const lessonPlan: LessonPlan = {
        lessonNumber: 1,
        title: 'Test Lesson - Lesson 1',
        coreItems,
        sections: [
          { type: 'intro', title: 'Introduction', targetDurationSeconds: 120 },
          { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
        ] as LessonSection[],
        drillEvents: [],
        totalEstimatedDuration: 180,
      };

      // Reset mocks - when sections are missing, individual generators will be called
      // These call generateWithGemini directly, so we need to provide proper responses
      mockGenerateWithGemini.mockReset().mockResolvedValue('Simple fallback narration text.');

      const result = await generateLessonScript(lessonPlan, mockContext);

      // Should still generate a valid script with markers at minimum
      expect(result.units.length).toBeGreaterThan(0);
      // Should have start and end markers plus section markers
      const markers = result.units.filter((u) => u.type === 'marker');
      expect(markers.length).toBeGreaterThanOrEqual(2); // At least start and end
    });
  });
});
