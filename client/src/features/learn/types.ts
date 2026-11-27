import type { JournalSegment } from '../journal/types';

export interface LearnLesson {
  id: string;
  title: string;
  subtitle: string;
  source: string;
  reference: string;
  exerciseCount: number;
  checkCount: number;
}
export interface LearnPrompt {
  id: string;
  prompt: string;
  instruction?: string;
  source?: string;
  teaching?: {
    title: string;
    explanation: string;
    example: { japanese: string; english: string };
  };
  sourceAudio?: { url: string; label: string };
}
export type LearnAction =
  | 'message'
  | 'answer'
  | 'clarify'
  | 'next'
  | 'previous'
  | 'restart'
  | 'review'
  | 'understand'
  | 'ready'
  | 'workbook'
  | 'reflect';
export interface LearnTurn {
  id: string;
  stepKey: string;
  prompt?: LearnPrompt | null;
  kind: 'answer' | 'clarify' | 'acknowledge';
  text: string;
  message: string;
  segments: JournalSegment[];
}
export interface LearnSession {
  id: string;
  lessonId: string;
  version: number;
  state: {
    phase: 'check' | 'ready' | 'exercise' | 'complete';
    index: number;
    answered: boolean;
    completed?: boolean;
    reviewing?: boolean;
    reviewRun?: number;
    turns: LearnTurn[];
  };
  prompt: LearnPrompt | null;
  nextStep?: {
    phase: LearnSession['state']['phase'];
    index: number;
    prompt: LearnPrompt | null;
    answered?: boolean;
    reviewing?: boolean;
    completed?: boolean;
  } | null;
  busy: boolean;
  updatedAt: string;
}
export interface LearnCollection {
  lessons: LearnLesson[];
  sessions: LearnSession[];
}
