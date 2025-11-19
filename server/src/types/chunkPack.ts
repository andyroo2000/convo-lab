/**
 * Type definitions for Lexical Chunk Packs
 */

import { JLPTLevel, ChunkPackTheme } from '../config/chunkThemes.js';

// ===== Generation Types =====

export interface GenerateChunkPackRequest {
  jlptLevel: JLPTLevel;
  theme: ChunkPackTheme;
}

export interface ChunkData {
  form: string; // Japanese chunk (e.g., 「〜ておきます」)
  translation: string; // Natural English gloss
  literalGloss?: string; // Optional literal meaning
  register: 'polite' | 'casual' | 'neutral';
  function: string; // Short usage description
  notes: string; // 1-2 notes on nuance
}

export interface ChunkExampleData {
  chunkForm: string; // Which chunk this exemplifies
  sentence: string; // Japanese sentence
  english: string; // Translation
  contextNote?: string; // Optional context
}

export interface ChunkStorySegmentData {
  japaneseText: string;
  englishTranslation: string;
}

export interface ChunkStoryData {
  title: string;
  type: 'narrative' | 'dialogue';
  storyText: string; // Full Japanese text
  english: string; // Full translation
  segments: ChunkStorySegmentData[];
}

export type ChunkExerciseType = 'chunk_to_meaning' | 'meaning_to_chunk' | 'gap_fill_mc';

export interface ChunkExerciseData {
  exerciseType: ChunkExerciseType;
  prompt: string; // What user sees
  options: string[]; // 2-3 options
  correctOption: string; // The correct answer
  explanation: string; // Usage-based explanation
}

// Generated content from Gemini
export interface GeneratedChunkPack {
  title: string;
  chunks: ChunkData[];
  examples: ChunkExampleData[];
  stories: ChunkStoryData[];
  exercises: ChunkExerciseData[];
}

// ===== Response Types =====

export interface ChunkPackResponse {
  id: string;
  userId: string;
  title: string;
  theme: string;
  jlptLevel: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  chunks: ChunkResponse[];
  examples: ChunkExampleResponse[];
  stories: ChunkStoryResponse[];
  exercises: ChunkExerciseResponse[];
}

export interface ChunkResponse {
  id: string;
  order: number;
  form: string;
  translation: string;
  literalGloss?: string;
  register: string;
  function: string;
  notes: string;
}

export interface ChunkExampleResponse {
  id: string;
  chunkId: string;
  order: number;
  sentence: string;
  english: string;
  contextNote?: string;
  audioUrl?: string;
}

export interface ChunkStoryResponse {
  id: string;
  title: string;
  type: string;
  storyText: string;
  english: string;
  audioUrl?: string;
  segments: ChunkStorySegmentResponse[];
}

export interface ChunkStorySegmentResponse {
  id: string;
  order: number;
  japaneseText: string;
  englishTranslation: string;
  audioUrl?: string;
  startTime?: number;
  endTime?: number;
}

export interface ChunkExerciseResponse {
  id: string;
  order: number;
  exerciseType: string;
  prompt: string;
  options: string[];
  correctOption: string;
  explanation: string;
  audioUrl?: string;
}

// ===== Job Types =====

export interface ChunkPackJobData {
  userId: string;
  jlptLevel: JLPTLevel;
  theme: ChunkPackTheme;
}

export interface ChunkPackJobResult {
  packId: string;
  status: 'completed' | 'error';
  error?: string;
}
