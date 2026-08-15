import type {
  StudyActivityOrigin,
  StudyActivityProvider,
  StudyActivitySession,
  StudyActivitySessionInput,
} from '../types/studyActivity';
import { STUDY_ACTIVITY_ORIGINS } from '../types/studyActivity';

const STUDY_ACTIVITY_ORIGIN_SET = new Set<string>(STUDY_ACTIVITY_ORIGINS);

export type StudyActivitySessionWire = StudyActivitySessionInput & {
  origin?: unknown;
};

function decodeOrigin(origin: unknown): { origin: StudyActivityOrigin; recognized: boolean } {
  if (typeof origin === 'string' && STUDY_ACTIVITY_ORIGIN_SET.has(origin)) {
    return { origin: origin as StudyActivityOrigin, recognized: true };
  }
  return { origin: 'legacy', recognized: origin === undefined || origin === null };
}

function providerForOrigin(origin: StudyActivityOrigin): StudyActivityProvider | null {
  if (origin === 'google_calendar' || origin === 'wanikani') return origin;
  return null;
}

function isEditable(
  session: StudyActivitySessionInput,
  origin: StudyActivityOrigin,
  recognized: boolean
) {
  if (!recognized) return false;
  if (session.source === 'automatic') return false;
  return origin === 'legacy' || origin === 'ios' || origin === 'web';
}

export function decodeStudyActivitySession(
  session: StudyActivitySessionWire
): StudyActivitySession {
  const { origin, recognized } = decodeOrigin(session.origin);
  return {
    ...session,
    editable: isEditable(session, origin, recognized),
    origin,
    provider: providerForOrigin(origin),
  };
}

export function encodeStudyActivitySession(
  session: StudyActivitySessionInput | StudyActivitySession
): StudyActivitySessionWire & { origin: 'web' } {
  return {
    ...(session.id === undefined ? {} : { id: session.id }),
    clientSessionId: session.clientSessionId,
    category: session.category,
    activity: session.activity,
    source: session.source,
    ...(session.name === undefined ? {} : { name: session.name }),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs,
    ...(session.audioPlaybackMs === undefined ? {} : { audioPlaybackMs: session.audioPlaybackMs }),
    ...(session.cardsCreated === undefined ? {} : { cardsCreated: session.cardsCreated }),
    origin: 'web',
  };
}
