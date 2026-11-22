import { JsonRequestError } from '../../lib/apiClient';
import { saveJournalDraft } from './journalApi';
import { JournalDraftStore } from './journalDrafts';
import JournalSyncStorage from './journalSyncStorage';
import type { JournalDraft, JournalEntry } from './types';

export interface JournalSyncReceipt {
  sent: JournalDraft;
  entry: JournalEntry;
}
type Send = (draft: JournalDraft, signal: AbortSignal, ownerId: string) => Promise<JournalEntry>;

/** Account-owned durable retries. Sending a draft never requests LLM feedback. */
export default class JournalDraftOutbox {
  readonly drafts: JournalDraftStore;

  readonly checkpoints: JournalSyncStorage;

  readonly receipts = new Map<string, JournalSyncReceipt>();

  readonly blocked = new Map<string, number>();

  private readonly running = new Map<string, Promise<JournalEntry>>();

  private readonly paused = new Set<string>();

  private readonly retryAt = new Map<string, number>();

  private readonly failures = new Map<string, number>();

  private readonly listeners = new Set<() => void>();

  private controller = new AbortController();

  private revision = 0;

  constructor(
    readonly ownerId: string,
    storage: Storage = localStorage,
    private readonly send: Send = saveJournalDraft
  ) {
    this.drafts = new JournalDraftStore(ownerId, storage);
    this.checkpoints = new JournalSyncStorage(ownerId, storage);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = () => this.revision;

  isSyncing(id: string) {
    return this.running.has(id);
  }

  edited(draft: JournalDraft) {
    const checkpoint = this.checkpoints.get(draft.id);
    if (![400, 422].includes(checkpoint.rejection ?? 0) || checkpoint.pending?.editId === draft.editId) return;
    this.checkpoints.remove(draft.id);
    this.blocked.delete(draft.id);
    this.retryAt.delete(draft.id);
    this.changed();
  }

  reconnect() {
    this.retryAt.clear();
  }

  resume() {
    if (this.controller.signal.aborted) this.controller = new AbortController();
  }

  stop() {
    this.controller.abort();
  }

  synchronize(now = Date.now()): Promise<void> {
    return this.drafts.list().reduce((previous, draft) =>
      previous.then(() => this.attempt(draft, now)), Promise.resolve());
  }

  private async attempt(draft: JournalDraft, now: number) {
    if (this.controller.signal.aborted || !this.eligible(draft, now)) return;
    try {
      await this.save(draft);
      this.failures.delete(draft.id);
      this.retryAt.delete(draft.id);
    } catch {
      const count = Math.min(5, (this.failures.get(draft.id) ?? 0) + 1);
      this.failures.set(draft.id, count);
      this.retryAt.set(draft.id, now + 2 ** count * 1000);
    }
  }

  save(draft: JournalDraft): Promise<JournalEntry> {
    const current = this.running.get(draft.id);
    if (current) return current;
    const task = this.lock(draft.id, () => this.transmit(draft)).finally(() => {
      this.running.delete(draft.id);
      this.changed();
    });
    this.running.set(draft.id, task);
    this.changed();
    return task;
  }

  async saveLatest(draft: JournalDraft): Promise<JournalEntry> {
    const entry = await this.save(draft);
    const remaining = this.drafts.get(draft.id);
    return remaining ? this.saveLatest(remaining) : entry;
  }

  async mutate<T>(id: string, operation: (version: number) => Promise<T>): Promise<T> {
    this.paused.add(id);
    try {
      await this.running.get(id)?.catch(() => undefined);
      return await this.lock(id, async () => {
        const checkpoint = this.checkpoints.get(id);
        if (checkpoint.pending && !checkpoint.rejection) await this.transmit(checkpoint.pending);
        const version =
          this.receipts.get(id)?.entry.version ?? this.drafts.get(id)?.expectedVersion ?? 0;
        return operation(version);
      });
    } finally {
      this.paused.delete(id);
    }
  }

  private eligible(draft: JournalDraft, now: number) {
    return (
      !draft.rootEntryId &&
      Boolean(draft.body.trim()) &&
      !this.paused.has(draft.id) &&
      now >= (this.retryAt.get(draft.id) ?? 0)
    );
  }

  private async transmit(fallback: JournalDraft): Promise<JournalEntry> {
    this.controller.signal.throwIfAborted();
    const checkpoint = this.checkpoints.get(fallback.id);
    if (checkpoint.rejection && checkpoint.rejection !== 403) {
      this.blocked.set(fallback.id, checkpoint.rejection);
      throw new JsonRequestError(
        'This draft needs attention before it can sync.',
        checkpoint.rejection,
        {}
      );
    }
    const sent = checkpoint.pending ?? this.drafts.get(fallback.id) ?? fallback;
    this.checkpoints.put(sent.id, { pending: sent });
    const entry = await this.request(sent);
    this.drafts.acknowledge(sent, entry);
    this.checkpoints.remove(sent.id);
    this.receipts.set(sent.id, { sent, entry });
    this.blocked.delete(sent.id);
    this.changed();
    return entry;
  }

  private async request(sent: JournalDraft) {
    try {
      return await this.send(sent, this.controller.signal, this.ownerId);
    } catch (error) {
      if (error instanceof JsonRequestError && [400, 403, 404, 409, 422].includes(error.status)) {
        this.checkpoints.put(sent.id, { pending: sent, rejection: error.status === 403 ? undefined : error.status });
        this.blocked.set(sent.id, error.status);
      }
      throw error;
    }
  }

  private async lock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    return navigator.locks
      ? navigator.locks.request(`journal-sync:${this.ownerId}:${id}`, operation)
      : operation();
  }

  private changed() {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
  }
}
