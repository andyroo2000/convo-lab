// Core type definitions for LanguageFlow Studio

export type LanguageCode = 'ja' | 'zh' | 'es' | 'fr' | 'ar' | 'he' | 'en';

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'native';

export type ToneStyle = 'casual' | 'polite' | 'formal';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Episode {
  id: string;
  userId: string;
  title: string;
  sourceText: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  status: 'draft' | 'generating' | 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
  dialogue?: Dialogue;
  images?: Image[];
  audioUrl?: string;
}

export interface Dialogue {
  id: string;
  episodeId: string;
  sentences: Sentence[];
  speakers: Speaker[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Speaker {
  id: string;
  name: string;
  voiceId: string;
  proficiency: ProficiencyLevel;
  tone: ToneStyle;
  color?: string; // For UI differentiation
}

export interface Sentence {
  id: string;
  dialogueId: string;
  speakerId: string;
  order: number;

  // Core text
  text: string;
  translation: string;

  // Language-specific metadata (extensible)
  metadata: LanguageMetadata;

  // Audio timing
  audioUrl?: string;
  startTime?: number; // milliseconds
  endTime?: number;   // milliseconds

  // Generation
  variations?: string[];
  selected: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface LanguageMetadata {
  japanese?: JapaneseMetadata;
  chinese?: ChineseMetadata;
  // Future languages can be added here
}

export interface JapaneseMetadata {
  kanji: string;
  kana: string;
  furigana: string; // Bracket-style: 漢[かん]字[じ]
}

export interface ChineseMetadata {
  characters: string;
  pinyin: string;
}

export interface Image {
  id: string;
  episodeId: string;
  url: string;
  prompt: string;
  order: number;
  sentenceStartId?: string; // Which sentence this image corresponds to
  sentenceEndId?: string;
  createdAt: Date;
}

// API request/response types
export interface CreateEpisodeRequest {
  title: string;
  sourceText: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  speakers: Omit<Speaker, 'id'>[];
}

export interface GenerateDialogueRequest {
  episodeId: string;
  sourceText: string;
  targetLanguage: LanguageCode;
  speakers: Speaker[];
  variationCount?: number;
}

export interface GenerateDialogueResponse {
  dialogue: Dialogue;
}

export interface GenerateAudioRequest {
  episodeId: string;
  dialogueId: string;
  speed?: 'normal' | 'slow';
  pauseMode?: boolean;
}

export interface GenerateAudioResponse {
  audioUrl: string;
  duration: number;
  sentenceTimings: Array<{
    sentenceId: string;
    startTime: number;
    endTime: number;
  }>;
}

export interface GenerateImagesRequest {
  episodeId: string;
  dialogueId: string;
  imageCount?: number;
}

export interface GenerateImagesResponse {
  images: Image[];
}
