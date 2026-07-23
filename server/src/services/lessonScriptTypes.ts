export type LessonScriptUnit =
  | { type: 'narration_L1'; text: string; voiceId: string; pitch?: number }
  | {
      type: 'L2';
      text: string;
      reading?: string;
      translation?: string;
      voiceId: string;
      speed?: number;
      pitch?: number;
    }
  | { type: 'pause'; seconds: number }
  | { type: 'marker'; label: string };
