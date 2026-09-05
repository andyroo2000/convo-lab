export { getTtsVoiceAvatarFilename, getTtsVoiceAvatarPath } from './voiceAvatar.js';
export {
  getAudioScriptTtsVoices,
  getCourseSpeakerVoices,
  getDialogueSpeakerVoices,
  getSelectableTtsVoices,
  getTtsVoiceById,
  getTtsVoices,
} from './voiceCatalog.js';
export {
  getLanguageCodeFromVoiceId,
  getProviderFromVoiceId,
  voiceIdToFilename,
} from './voiceIdentifiers.js';
export type {
  CourseSpeakerVoices,
  DialogueSpeakerVoice,
  VoiceAvatarTone,
  VoiceConfig,
  VoiceId,
  VoiceLanguage,
  VoiceLanguageCode,
} from './voiceTypes.js';
