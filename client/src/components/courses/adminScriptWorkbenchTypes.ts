export interface DialogueExchange {
  order: number;
  speakerName: string;
  relationshipName: string;
  speakerVoiceId: string;
  textL2: string;
  readingL2: string | null;
  translationL1: string;
  vocabularyItems: VocabularyItem[];
}

export interface VocabularyItem {
  textL2: string;
  readingL2?: string;
  translationL1: string;
  jlptLevel?: string;
}

export interface ScriptUnit {
  type: 'narration_L1' | 'L2' | 'pause' | 'marker';
  text?: string;
  reading?: string;
  translation?: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
  seconds?: number;
  label?: string;
}

export interface PromptMetadata {
  targetExchangeCount: number;
  vocabularySeeds: string;
  grammarSeeds: string;
}

export interface ScriptConfig {
  reviewAnticipationSeconds: number;
  reviewRepeatPauseSeconds: number;
  reviewSlowSpeed: number;
  pauseAfterScenarioIntro: number;
  pauseAfterSpeakerIntro: number;
  pauseAfterL2Playback: number;
  pauseAfterTranslation: number;
  pauseAfterVocabItem: number;
  pauseAfterFullPhrase: number;
  pauseForLearnerResponse: number;
  pauseBetweenRepetitions: number;
  scenarioIntroPrompt: string;
  progressivePhrasePrompt: string;
  speakerSaysTemplate: string;
  translationTemplate: string;
  vocabIntroTemplate: string;
  responseIntroTemplate: string;
  vocabTeachTemplate: string;
  progressiveChunkTemplate: string;
  fullPhraseTemplate: string;
  fullPhraseReplayTemplate: string;
  noVocabTeachTemplate: string;
  reviewIntroTemplate: string;
  reviewQuestionTemplate: string;
  outroTemplate: string;
}

export interface LineRendering {
  id: string;
  unitIndex: number;
  text: string;
  speed: number;
  voiceId: string;
  audioUrl: string;
  createdAt: string;
}

export type PipelineStage = 'prompt' | 'exchanges' | 'config' | 'script' | 'audio';
