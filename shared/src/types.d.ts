export type LanguageCode = 'ja' | 'en';
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'native';
export type ToneStyle = 'casual' | 'polite' | 'formal';
export type EpisodeStatus = 'draft' | 'generating' | 'ready' | 'error';
export type JobState = 'waiting' | 'active' | 'completed' | 'failed';
export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
}
//# sourceMappingURL=types.d.ts.map
