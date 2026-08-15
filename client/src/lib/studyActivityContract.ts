import type {
  StudyActivityOrigin,
  StudyActivityProvider,
  StudyActivitySession,
  StudyActivitySessionInput,
} from '../types/studyActivity';

const STUDY_ACTIVITY_ORIGINS = new Set<StudyActivityOrigin>([
  'legacy',
  'ios',
  'web',
  'google_calendar',
  'wanikani',
  'system',
]);

export type StudyActivitySessionWire = StudyActivitySessionInput & {
  origin?: unknown;
};

function decodeOrigin(origin: unknown): StudyActivityOrigin {
  return typeof origin === 'string' && STUDY_ACTIVITY_ORIGINS.has(origin as StudyActivityOrigin)
    ? (origin as StudyActivityOrigin)
    : 'legacy';
}

function providerForOrigin(origin: StudyActivityOrigin): StudyActivityProvider | null {
  if (origin === 'google_calendar' || origin === 'wanikani') return origin;
  return null;
}

function isEditable(session: StudyActivitySessionInput, origin: StudyActivityOrigin) {
  if (session.source === 'automatic') return false;
  return origin !== 'system' && origin !== 'wanikani';
}

export function decodeStudyActivitySession(
  session: StudyActivitySessionWire
): StudyActivitySession {
  const origin = decodeOrigin(session.origin);
  return {
    ...session,
    editable: isEditable(session, origin),
    origin,
    provider: providerForOrigin(origin),
  };
}

export function encodeStudyActivitySession(
  session: StudyActivitySessionInput | StudyActivitySession
): StudyActivitySessionWire & { origin: 'web' } {
  const {
    editable: _editable,
    origin: _origin,
    provider: _provider,
    ...payload
  } = session as StudyActivitySession;

  return { ...payload, origin: 'web' };
}
