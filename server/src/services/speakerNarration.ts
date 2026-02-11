import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';

import type { DialogueExchange } from './courseItemExtractor.js';

const DESCRIPTOR_PREFIXES = ['your ', 'the ', 'a ', 'an ', 'my ', 'our ', 'this ', 'that '];

const ROLE_KEYWORDS = [
  'friend',
  'cashier',
  'clerk',
  'barista',
  'bartender',
  'server',
  'waiter',
  'waitress',
  'host',
  'hostess',
  'manager',
  'boss',
  'coworker',
  'colleague',
  'neighbor',
  'customer',
  'client',
  'student',
  'teacher',
  'professor',
  'doctor',
  'nurse',
  'receptionist',
  'agent',
  'driver',
  'taxi',
  'rider',
  'passenger',
  'attendant',
  'guide',
  'parent',
  'mother',
  'father',
  'mom',
  'dad',
  'sister',
  'brother',
  'child',
  'son',
  'daughter',
  'spouse',
  'partner',
  'husband',
  'wife',
  'girlfriend',
  'boyfriend',
  'roommate',
  'landlord',
  'shopkeeper',
  'officer',
  'police',
  'pharmacist',
  'librarian',
  'banker',
  'teller',
  'chef',
  'cook',
  'baker',
  'translator',
  'interpreter',
  'assistant',
  'classmate',
  'teammate',
  'coach',
  'guest',
  'staff',
  'employee',
  'vendor',
  'merchant',
  'shop',
];

const ROLE_REGEX = new RegExp(`\\b(${ROLE_KEYWORDS.join('|')})\\b`, 'i');
const HONORIFIC_REGEX = /^(mr|mrs|ms|miss|dr|prof|sir|madam)\.?\s+/i;
const CJK_REGEX = /[\u3040-\u30ff\u3400-\u9fff]/;

function getVoiceGender(voiceId?: string): 'male' | 'female' | undefined {
  if (!voiceId) return undefined;

  for (const config of Object.values(TTS_VOICES)) {
    const voice = config.voices.find((v) => v.id === voiceId);
    if (voice?.gender === 'male' || voice?.gender === 'female') {
      return voice.gender;
    }
  }

  return undefined;
}

function getPronoun(voiceId?: string): string {
  const gender = getVoiceGender(voiceId);
  if (gender === 'male') return 'He';
  if (gender === 'female') return 'She';
  return 'They';
}

function isDescriptor(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (DESCRIPTOR_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  return ROLE_REGEX.test(normalized);
}

function looksLikeProperName(name: string, speakerName?: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;

  const normalized = trimmed.toLowerCase();
  if (speakerName && normalized === speakerName.trim().toLowerCase()) return true;
  if (HONORIFIC_REGEX.test(trimmed)) return true;
  if (CJK_REGEX.test(trimmed)) return true;

  if (!trimmed.includes(' ')) return true;

  const titleCaseParts = trimmed.split(/\s+/).filter(Boolean);
  const isTitleCase = titleCaseParts.every((part) => {
    const first = part[0];
    const rest = part.slice(1);
    return first === first.toUpperCase() && rest === rest.toLowerCase();
  });

  return isTitleCase;
}

function resolveSpeakerLabel(exchange: DialogueExchange): string {
  const raw = exchange.relationshipName?.trim() || '';
  if (!raw) return getPronoun(exchange.speakerVoiceId);

  const normalized = raw.toLowerCase();
  if (normalized === 'speaker' || normalized === 'someone' || normalized === 'person') {
    return getPronoun(exchange.speakerVoiceId);
  }

  const descriptor = isDescriptor(raw);
  if (descriptor) return raw;

  if (looksLikeProperName(raw, exchange.speakerName)) {
    return getPronoun(exchange.speakerVoiceId);
  }

  return raw;
}

export function buildSpeakerIntro(exchange: DialogueExchange): string {
  const label = resolveSpeakerLabel(exchange);
  const verb = label.toLowerCase() === 'they' ? 'say' : 'says';
  return `${label} ${verb}:`;
}
