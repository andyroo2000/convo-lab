import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { CoreItem } from '../../../services/courseItemExtractor.js';
import { LessonPlan, LessonSection, DrillEvent } from '../../../services/coursePlanner.js';
import { generateCourseScript, LessonScriptUnit } from '../../../services/courseScriptGenerator.js';

// Create hoisted mocks
const mockGenerateWithGemini = vi.hoisted(() => vi.fn());

// Mock dependencies
vi.mock('../../../services/geminiClient.js', () => ({
  generateWithGemini: mockGenerateWithGemini,
}));

describe('courseScriptGenerator', () => {
  const mockContext = {
    episodeTitle: 'Ordering at a Restaurant',
    targetLanguage: 'Japanese',
    nativeLanguage: 'English',
    l1VoiceId: 'en-US-Neural2-D',
    l2VoiceId: 'ja-JP-Neural2-B',
  };

  const mockCoreItem: CoreItem = {
    id: 'core-item-1',
    textL2: 'これをください',
    translationL1: 'I would like this please',
    readingL2: 'kore o kudasai',
    complexityScore: 1,
    sourceEpisodeId: 'episode-1',
    sourceSentenceId: 'sentence-1',
    order: 0,
  };

  const mockCoreItem2: CoreItem = {
    id: 'core-item-2',
    textL2: 'いくらですか',
    translationL1: 'How much is it?',
    readingL2: 'ikura desu ka',
    complexityScore: 1,
    sourceEpisodeId: 'episode-1',
    sourceSentenceId: 'sentence-2',
    order: 1,
  };

  const createMinimalLessonPlan = (sections: LessonSection[]): LessonPlan => ({
    lessonNumber: 1,
    title: 'Test Lesson',
    sections,
    coreItems: [],
    totalEstimatedDuration: sections.reduce(
      (total, section) => total + section.targetDurationSeconds,
      0
    ),
    drillEvents: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for Gemini - return valid JSON for batch calls
    mockGenerateWithGemini.mockImplementation(async (prompt: string) => {
      // Detect which batch call based on prompt content
      if (prompt.includes('LESSON_INTRO') && prompt.includes('CORE_ITEM_INTROS')) {
        return JSON.stringify({
          lessonIntro: 'Welcome to this lesson about ordering at a restaurant.',
          coreItemIntros: ['Listen to how to ask for something.', 'Now learn to ask about price.'],
          earlySRSIntro: "Let's practice what you learned.",
        });
      }
      if (
        prompt.includes('PHRASE_CONSTRUCTION_INTRO') &&
        prompt.includes('DIALOGUE_INTEGRATION_INTRO')
      ) {
        return JSON.stringify({
          phraseConstructionIntro: "Let's build longer phrases.",
          dialogueIntegrationIntro: "Now let's use these in conversation.",
          qaScenarios: [
            'You want to order something. What do you say?',
            'You want to know the price. What do you ask?',
          ],
        });
      }
      if (prompt.includes('ROLEPLAY_INTRO') && prompt.includes('LATE_SRS_INTRO')) {
        return JSON.stringify({
          roleplayIntro: "Let's practice a conversation.",
          lateSRSIntro: 'Final review time.',
          outro: 'Great job completing this lesson!',
        });
      }
      // Fallback for single prompts
      return 'Listen carefully to this phrase.';
    });
  });

  describe('generateCourseScript', () => {
    it('should generate script with lesson start and end markers', async () => {
      const lessonPlan = createMinimalLessonPlan([]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      expect(result.units).toContainEqual({ type: 'marker', label: 'Lesson 1 Start' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Lesson 1 End' });
    });

    it('should add section markers for each section', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      expect(result.units).toContainEqual({ type: 'marker', label: 'Introduction' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Conclusion' });
    });

    it('should return estimated duration in seconds', async () => {
      const lessonPlan = createMinimalLessonPlan([]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      expect(result.estimatedDurationSeconds).toBeGreaterThanOrEqual(0);
      expect(typeof result.estimatedDurationSeconds).toBe('number');
    });

    it('should process drill events at correct times', async () => {
      const drillEvent: DrillEvent = {
        id: 'drill-recall-1',
        coreItemId: mockCoreItem.id,
        coreItem: mockCoreItem,
        drillType: 'recall',
        targetOffsetSeconds: 0,
      };

      const lessonPlan: LessonPlan = {
        lessonNumber: 1,
        title: 'Drill Event Lesson',
        sections: [{ type: 'intro', title: 'Introduction', targetDurationSeconds: 60 }],
        coreItems: [mockCoreItem],
        totalEstimatedDuration: 60,
        drillEvents: [drillEvent],
      };

      const result = await generateCourseScript(lessonPlan, mockContext);

      // Should contain drill prompt
      const narrationUnits = result.units.filter((u) => u.type === 'narration_L1');
      const hasRecallPrompt = narrationUnits.some(
        (u) => u.type === 'narration_L1' && u.text.includes('How do you say')
      );
      expect(hasRecallPrompt).toBe(true);
    });
  });

  describe('batch 1 processing (intro + core_intro + early_srs)', () => {
    it('should use batched results for intro section', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      // Should contain the intro narration from batch response
      const introNarration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Welcome to this lesson')
      );
      expect(introNarration).toBeDefined();
    });

    it('should use batched core intros for vocabulary introduction', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem, mockCoreItem2],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      await generateCourseScript(lessonPlan, mockContext);

      // Should have generated Gemini call for batch 1
      expect(mockGenerateWithGemini).toHaveBeenCalled();
    });

    it('should generate L2 audio units for core items', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const l2Units = result.units.filter((u) => u.type === 'L2');
      expect(l2Units.length).toBeGreaterThan(0);

      const l2Unit = l2Units[0] as Extract<LessonScriptUnit, { type: 'L2' }>;
      expect(l2Unit.text).toBe('これをください');
      expect(l2Unit.voiceId).toBe('ja-JP-Neural2-B');
    });

    it('should include pause units after L2 audio', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const pauseUnits = result.units.filter((u) => u.type === 'pause');
      expect(pauseUnits.length).toBeGreaterThan(0);
    });
  });

  describe('batch 2 processing (phrase_construction + dialogue_integration + qa)', () => {
    it('should generate batch 2 content when sections exist', async () => {
      const lessonPlan = createMinimalLessonPlan([
        {
          type: 'phrase_construction',
          title: 'Phrase Building',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        {
          type: 'dialogue_integration',
          title: 'Dialogue Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        {
          type: 'qa',
          title: 'Q&A Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      await generateCourseScript(lessonPlan, mockContext);

      // Should have made batch 2 call
      const batch2Call = mockGenerateWithGemini.mock.calls.find((call) =>
        call[0].includes('PHRASE_CONSTRUCTION_INTRO')
      );
      expect(batch2Call).toBeDefined();
    });

    it('should use qa scenarios from batch response', async () => {
      const lessonPlan = createMinimalLessonPlan([
        {
          type: 'phrase_construction',
          title: 'Phrase Building',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        {
          type: 'dialogue_integration',
          title: 'Dialogue Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        {
          type: 'qa',
          title: 'Q&A Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      // Should contain QA scenario from batch response
      const qaNarration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('want to order')
      );
      expect(qaNarration).toBeDefined();
    });
  });

  describe('batch 3 processing (roleplay + late_srs + outro)', () => {
    it('should generate batch 3 content when sections exist', async () => {
      const lessonPlan = createMinimalLessonPlan([
        {
          type: 'roleplay',
          title: 'Role Play',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem, mockCoreItem2],
        },
        {
          type: 'late_srs',
          title: 'Final Review',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
      ]);

      await generateCourseScript(lessonPlan, mockContext);

      // Should have made batch 3 call
      const batch3Call = mockGenerateWithGemini.mock.calls.find((call) =>
        call[0].includes('ROLEPLAY_INTRO')
      );
      expect(batch3Call).toBeDefined();
    });

    it('should include outro narration from batch response', async () => {
      const lessonPlan = createMinimalLessonPlan([
        {
          type: 'roleplay',
          title: 'Role Play',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem, mockCoreItem2],
        },
        {
          type: 'late_srs',
          title: 'Final Review',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const outroNarration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Great job')
      );
      expect(outroNarration).toBeDefined();
    });
  });

  describe('fallback handling for JSON parsing errors', () => {
    it('should fallback gracefully when batch 1 JSON parsing fails', async () => {
      mockGenerateWithGemini.mockResolvedValueOnce('Invalid JSON response');

      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      // Should not throw, should fallback
      const result = await generateCourseScript(lessonPlan, mockContext);
      expect(result.units.length).toBeGreaterThan(0);
    });

    it('should handle markdown code blocks in JSON response', async () => {
      mockGenerateWithGemini.mockResolvedValueOnce(`\`\`\`json
{
  "lessonIntro": "Welcome wrapped in markdown!",
  "coreItemIntros": ["Listen carefully."],
  "earlySRSIntro": "Practice time."
}
\`\`\``);

      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const introNarration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Welcome wrapped in markdown')
      );
      expect(introNarration).toBeDefined();
    });
  });

  describe('drill event types', () => {
    const createDrillPlan = (drillType: DrillEvent['drillType']): LessonPlan => ({
      lessonNumber: 1,
      title: 'Drill Test Lesson',
      sections: [{ type: 'intro', title: 'Introduction', targetDurationSeconds: 60 }],
      coreItems: [mockCoreItem],
      totalEstimatedDuration: 60,
      drillEvents: [
        {
          id: `drill-${drillType}`,
          coreItemId: mockCoreItem.id,
          coreItem: mockCoreItem,
          drillType,
          targetOffsetSeconds: 0,
        },
      ],
    });

    it('should generate recall drill with "How do you say" prompt', async () => {
      const result = await generateCourseScript(createDrillPlan('recall'), mockContext);

      const narration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('How do you say')
      );
      expect(narration).toBeDefined();
    });

    it('should generate transform drill with "Try saying" prompt', async () => {
      const result = await generateCourseScript(createDrillPlan('transform'), mockContext);

      const narration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Try saying')
      );
      expect(narration).toBeDefined();
    });

    it('should generate expand drill with "One more time" prompt', async () => {
      const result = await generateCourseScript(createDrillPlan('expand'), mockContext);

      const narration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('One more time')
      );
      expect(narration).toBeDefined();
    });

    it('should generate context drill with "Remember" prompt', async () => {
      const result = await generateCourseScript(createDrillPlan('context'), mockContext);

      const narration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Remember')
      );
      expect(narration).toBeDefined();
    });

    it('should generate roleplay drill with "In the conversation" prompt', async () => {
      const result = await generateCourseScript(createDrillPlan('roleplay'), mockContext);

      const narration = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('In the conversation')
      );
      expect(narration).toBeDefined();
    });
  });

  describe('core items with components (backward-build)', () => {
    it('should teach components in backward-build order', async () => {
      const coreItemWithComponents: CoreItem = {
        id: 'core-item-components-1',
        textL2: '水をください',
        translationL1: 'Water please',
        readingL2: 'mizu o kudasai',
        complexityScore: 1,
        sourceEpisodeId: 'episode-1',
        sourceSentenceId: 'sentence-components-1',
        order: 0,
        components: [
          { textL2: 'ください', translationL1: 'please', readingL2: 'kudasai', order: 0 },
          { textL2: '水を', translationL1: 'water (object)', readingL2: 'mizu o', order: 1 },
        ],
      };

      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [coreItemWithComponents],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [coreItemWithComponents],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      // Should have L2 units for components
      const l2Units = result.units.filter((u) => u.type === 'L2') as Extract<
        LessonScriptUnit,
        { type: 'L2' }
      >[];
      const componentTexts = l2Units.map((u) => u.text);

      expect(componentTexts).toContain('ください');
      expect(componentTexts).toContain('水を');
    });

    it('should prompt learner to try full phrase after components', async () => {
      const coreItemWithComponents: CoreItem = {
        id: 'core-item-components-2',
        textL2: '水をください',
        translationL1: 'Water please',
        readingL2: 'mizu o kudasai',
        complexityScore: 1,
        sourceEpisodeId: 'episode-1',
        sourceSentenceId: 'sentence-components-2',
        order: 0,
        components: [
          { textL2: 'ください', translationL1: 'please', order: 0 },
          { textL2: '水を', translationL1: 'water', order: 1 },
        ],
      };

      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [coreItemWithComponents],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [coreItemWithComponents],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const fullPhrasePrompt = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Now try saying the full phrase')
      );
      expect(fullPhrasePrompt).toBeDefined();
    });
  });

  describe('section without coreItems', () => {
    it('should handle sections with empty coreItems', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        { type: 'core_intro', title: 'Core Vocabulary', targetDurationSeconds: 300, coreItems: [] },
        { type: 'early_srs', title: 'Early Practice', targetDurationSeconds: 180, coreItems: [] },
      ]);

      // Should not throw
      const result = await generateCourseScript(lessonPlan, mockContext);
      expect(result).toBeDefined();
    });

    it('should handle sections with undefined coreItems', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        { type: 'core_intro', title: 'Core Vocabulary', targetDurationSeconds: 300 },
        { type: 'early_srs', title: 'Early Practice', targetDurationSeconds: 180 },
      ]);

      // Should not throw
      const result = await generateCourseScript(lessonPlan, mockContext);
      expect(result).toBeDefined();
    });
  });

  describe('roleplay section', () => {
    it('should require at least 2 core items for roleplay', async () => {
      const lessonPlan = createMinimalLessonPlan([
        {
          type: 'roleplay',
          title: 'Role Play',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem, mockCoreItem2],
        },
        {
          type: 'late_srs',
          title: 'Final Review',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      // Should have "You start the conversation" prompt
      const startPrompt = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('You start the conversation')
      );
      expect(startPrompt).toBeDefined();
    });

    it('should include response prompt after learner speaks', async () => {
      const lessonPlan = createMinimalLessonPlan([
        {
          type: 'roleplay',
          title: 'Role Play',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem, mockCoreItem2],
        },
        {
          type: 'late_srs',
          title: 'Final Review',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
        { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      // Should have "Good! Now they respond" prompt
      const responsePrompt = result.units.find(
        (u) => u.type === 'narration_L1' && u.text.includes('Good! Now they respond')
      );
      expect(responsePrompt).toBeDefined();
    });
  });

  describe('L2 unit properties', () => {
    it('should set correct voice ID on L2 units', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const l2Units = result.units.filter((u) => u.type === 'L2') as Extract<
        LessonScriptUnit,
        { type: 'L2' }
      >[];
      expect(l2Units.every((u) => u.voiceId === 'ja-JP-Neural2-B')).toBe(true);
    });

    it('should include reading when available', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const l2Unit = result.units.find((u) => u.type === 'L2') as Extract<
        LessonScriptUnit,
        { type: 'L2' }
      >;
      expect(l2Unit.reading).toBe('kore o kudasai');
    });

    it('should set speed on L2 units when specified', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const l2Units = result.units.filter((u) => u.type === 'L2') as Extract<
        LessonScriptUnit,
        { type: 'L2' }
      >[];
      // Should have some units with speed 1.0 and some with speed 0.75
      const speeds = l2Units.map((u) => u.speed).filter(Boolean);
      expect(speeds).toContain(1.0);
      expect(speeds).toContain(0.75);
    });
  });

  describe('narration L1 properties', () => {
    it('should set correct voice ID on narration units', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const narrationUnits = result.units.filter((u) => u.type === 'narration_L1') as Extract<
        LessonScriptUnit,
        { type: 'narration_L1' }
      >[];
      expect(narrationUnits.every((u) => u.voiceId === 'en-US-Neural2-D')).toBe(true);
    });
  });

  describe('pause durations', () => {
    it('should have appropriate pause durations for different contexts', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const pauseUnits = result.units.filter((u) => u.type === 'pause') as Extract<
        LessonScriptUnit,
        { type: 'pause' }
      >[];
      const durations = pauseUnits.map((u) => u.seconds);

      // Should have various pause durations
      expect(durations.some((d) => d >= 0.5 && d <= 1.0)).toBe(true); // Short pauses
      expect(durations.some((d) => d >= 2.0)).toBe(true); // Longer pauses for practice
    });

    it('should have anticipation pauses (3+ seconds) for SRS drills', async () => {
      const lessonPlan = createMinimalLessonPlan([
        { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
        {
          type: 'core_intro',
          title: 'Core Vocabulary',
          targetDurationSeconds: 300,
          coreItems: [mockCoreItem],
        },
        {
          type: 'early_srs',
          title: 'Early Practice',
          targetDurationSeconds: 180,
          coreItems: [mockCoreItem],
        },
      ]);

      const result = await generateCourseScript(lessonPlan, mockContext);

      const pauseUnits = result.units.filter((u) => u.type === 'pause') as Extract<
        LessonScriptUnit,
        { type: 'pause' }
      >[];
      const anticipationPauses = pauseUnits.filter((u) => u.seconds >= 3.0);

      expect(anticipationPauses.length).toBeGreaterThan(0);
    });
  });

  describe('complete lesson flow', () => {
    it('should generate a complete lesson with all section types', async () => {
      const lessonPlan: LessonPlan = {
        lessonNumber: 1,
        title: 'Complete Lesson',
        sections: [
          { type: 'intro', title: 'Introduction', targetDurationSeconds: 60 },
          {
            type: 'core_intro',
            title: 'Core Vocabulary',
            targetDurationSeconds: 300,
            coreItems: [mockCoreItem, mockCoreItem2],
          },
          {
            type: 'early_srs',
            title: 'Early Practice',
            targetDurationSeconds: 180,
            coreItems: [mockCoreItem, mockCoreItem2],
          },
          {
            type: 'phrase_construction',
            title: 'Phrase Building',
            targetDurationSeconds: 180,
            coreItems: [mockCoreItem],
          },
          {
            type: 'dialogue_integration',
            title: 'Dialogue Practice',
            targetDurationSeconds: 180,
            coreItems: [mockCoreItem],
          },
          {
            type: 'qa',
            title: 'Q&A Practice',
            targetDurationSeconds: 180,
            coreItems: [mockCoreItem],
          },
          {
            type: 'roleplay',
            title: 'Role Play',
            targetDurationSeconds: 180,
            coreItems: [mockCoreItem, mockCoreItem2],
          },
          {
            type: 'late_srs',
            title: 'Final Review',
            targetDurationSeconds: 180,
            coreItems: [mockCoreItem, mockCoreItem2],
          },
          { type: 'outro', title: 'Conclusion', targetDurationSeconds: 60 },
        ],
        coreItems: [mockCoreItem, mockCoreItem2],
        totalEstimatedDuration: 1620,
        drillEvents: [],
      };

      const result = await generateCourseScript(lessonPlan, mockContext);

      // Should have all section markers
      expect(result.units).toContainEqual({ type: 'marker', label: 'Introduction' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Core Vocabulary' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Early Practice' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Phrase Building' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Dialogue Practice' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Q&A Practice' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Role Play' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Final Review' });
      expect(result.units).toContainEqual({ type: 'marker', label: 'Conclusion' });

      // Should have reasonable duration
      expect(result.estimatedDurationSeconds).toBeGreaterThan(60);
    });
  });
});
