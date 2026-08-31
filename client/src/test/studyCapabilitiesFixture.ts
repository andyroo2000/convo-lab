import type { StudyClientCapabilities } from '@languageflow/shared/src/types';

const studyCapabilitiesFixture: StudyClientCapabilities = {
  version: 1,
  settings: {
    newCardsPerDay: { default: 20, min: 0, max: 1000 },
    lessonBatchSize: { default: 5, min: 3, max: 10 },
    reviewTimeBudgetMinutes: { default: 90, min: 15, max: 240 },
    newCardLaneWeights: {
      standard: { default: 3, min: 1, max: 20 },
      lessonFollowup: { default: 1, min: 0, max: 20 },
      wanikani: { default: 1, min: 0, max: 20 },
    },
  },
  cardAuthoring: {
    creationKinds: [
      'text-recognition',
      'audio-recognition',
      'production-text',
      'production-image',
      'cloze',
    ],
    imagePlacements: ['none', 'prompt', 'answer', 'both'],
    previewAudioRoles: ['prompt', 'answer'],
    defaultAnswerAudioVoiceId: 'fishaudio:abb4362e736f40b7b5716f4fafcafa9f',
    defaultFemaleAnswerAudioVoiceId: 'fishaudio:9639f090aa6346329d7d3aca7e6b7226',
    limits: {
      combinedPayloadBytes: 24576,
      payloadDepth: 8,
      imagePromptCharacters: 1000,
      imageUploadBytes: 10485760,
    },
  },
  dailyAudio: { targetDurationMinutes: { default: 30, min: 5, max: 60 } },
  offlineReserve: { days: 5, maxScheduledCards: 1000 },
  imports: { maxArchiveBytes: 2147483648 },
  studyActivity: {
    categoriesByActivity: {
      card_review: 'review',
      daily_audio: 'listen',
      card_creation: 'create',
      tv: 'immerse',
      podcast: 'immerse',
      reading: 'immerse',
      conversation: 'conversation',
      wanikani_review: 'wanikani',
      other: 'immerse',
    },
  },
};

export default studyCapabilitiesFixture;
