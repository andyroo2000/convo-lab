// Core type definitions for LanguageFlow Studio

export type LanguageCode = 'ja' | 'zh' | 'es' | 'fr' | 'ar' | 'he' | 'en';

export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'native';

export type ToneStyle = 'casual' | 'polite' | 'formal';

export type AudioSpeed = 'very-slow' | 'slow' | 'medium' | 'normal';

export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarColor?: string;
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
  audioSpeed?: AudioSpeed;
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
  variationsMetadata?: LanguageMetadata[];

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
  audioSpeed?: AudioSpeed;
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
  speed?: AudioSpeed;
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

// Pimsleur-style Course Types

export interface Course {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: 'draft' | 'generating' | 'ready' | 'error';
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  maxLessonDurationMinutes: number;
  l1VoiceId: string;
  useDraftMode: boolean;
  jlptLevel?: string; // N5, N4, N3, N2, N1
  speaker1Gender: 'male' | 'female';
  speaker2Gender: 'male' | 'female';
  createdAt: Date;
  updatedAt: Date;
  lessons?: Lesson[];
  courseEpisodes?: CourseEpisode[];
}

export interface CourseEpisode {
  id: string;
  courseId: string;
  episodeId: string;
  order: number;
  episode?: Episode;
}

export interface Lesson {
  id: string;
  courseId: string;
  order: number;
  title: string;
  scriptJson: LessonScriptUnit[];
  approxDurationSeconds: number;
  audioUrl?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
  coreItems?: LessonCoreItem[];
}

export interface LessonCoreItem {
  id: string;
  lessonId: string;
  textL2: string;
  readingL2?: string;
  translationL1: string;
  complexityScore: number;
  sourceEpisodeId?: string;
  sourceSentenceId?: string;
}

export type LessonScriptUnit =
  | { type: 'narration_L1'; text: string; voiceId: string }
  | { type: 'L2'; text: string; reading?: string; voiceId: string; speed?: number }
  | { type: 'pause'; seconds: number }
  | { type: 'marker'; label: string };

// API request/response types for courses

export interface CreateCourseRequest {
  title: string;
  description?: string;
  episodeIds: string[];
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  maxLessonDurationMinutes?: number;
  l1VoiceId?: string;
  useDraftMode?: boolean;
  jlptLevel?: string; // N5, N4, N3, N2, N1
  speaker1Gender?: 'male' | 'female';
  speaker2Gender?: 'male' | 'female';
  speaker1VoiceId?: string; // Specific voice ID for Speaker 1
  speaker2VoiceId?: string; // Specific voice ID for Speaker 2
}

export interface GenerateCourseRequest {
  courseId: string;
}

export interface GenerateCourseResponse {
  message: string;
  jobId: string;
  courseId: string;
}

export interface CourseStatusResponse {
  status: 'draft' | 'generating' | 'ready' | 'error';
  progress?: number;
  currentStage?: string;
  lessons: Array<{
    id: string;
    order: number;
    status: string;
  }>;
}
