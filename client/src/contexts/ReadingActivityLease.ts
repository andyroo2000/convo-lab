import type { ActiveStudyActivity } from '../types/studyActivity';

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_EXPIRY_MS = 300_000;
const LEGACY_RECOVERY_LIMIT_MS = 300_000;

interface Heartbeat {
  sessionId: string;
  seenAt: number;
}

export default class ReadingActivityLease {
  private owner?: Heartbeat;

  private readonly key: string;

  constructor(private readonly activeKey: string) {
    this.key = `${activeKey}.reading-heartbeat`;
  }

  isCurrent(sessionId: string) {
    try {
      const active = JSON.parse(
        localStorage.getItem(this.activeKey) ?? 'null'
      ) as ActiveStudyActivity | null;
      return active?.clientSessionId === sessionId;
    } catch {
      return false;
    }
  }

  claim(sessionId: string) {
    this.owner = { sessionId, seenAt: Date.now() };
    try {
      localStorage.setItem(this.key, JSON.stringify(this.owner));
    } catch {
      // Keep tracking in this reader when the cross-tab heartbeat cannot be saved.
    }
  }

  refresh(session: ActiveStudyActivity) {
    if (this.owner?.sessionId !== session.clientSessionId) return;
    if (!this.isCurrent(session.clientSessionId)) return;
    if (Date.now() - this.owner.seenAt >= HEARTBEAT_INTERVAL_MS)
      this.claim(session.clientSessionId);
  }

  release(sessionId: string) {
    if (this.owner?.sessionId === sessionId) this.owner = undefined;
    try {
      if (this.read()?.sessionId === sessionId) localStorage.removeItem(this.key);
    } catch {
      // A leftover heartbeat expires; leaving the reader must remain safe.
    }
  }

  recoveryEnd(session: ActiveStudyActivity): Date | undefined {
    const heartbeat = this.owner?.sessionId === session.clientSessionId ? this.owner : this.read();
    if (heartbeat?.sessionId === session.clientSessionId) {
      if (Date.now() - heartbeat.seenAt < HEARTBEAT_EXPIRY_MS) return undefined;
      return new Date(heartbeat.seenAt);
    }
    const legacyLimit = new Date(session.startedAt).getTime() + LEGACY_RECOVERY_LIMIT_MS;
    return new Date(Math.min(Date.now(), legacyLimit));
  }

  private read(): Heartbeat | undefined {
    try {
      const value = JSON.parse(localStorage.getItem(this.key) ?? 'null') as Heartbeat | null;
      return value && Number.isFinite(value.seenAt) ? value : undefined;
    } catch {
      return undefined;
    }
  }
}
