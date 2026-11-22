import { z } from 'zod';
import { draftSchema } from './journalDrafts';

const checkpointSchema = z.object({
  pending: draftSchema.optional(),
  rejection: z.number().int().optional(),
});
export type JournalSyncCheckpoint = z.infer<typeof checkpointSchema>;
export const journalSyncPrefix = (ownerId: string) =>
  `convolab:journal-sync:v1:${encodeURIComponent(ownerId)}:`;

export default class JournalSyncStorage {
  constructor(
    private readonly ownerId: string,
    private readonly storage: Storage = localStorage
  ) {}

  get(id: string): JournalSyncCheckpoint {
    const raw = this.storage.getItem(this.key(id));
    // A corrupt pending payload must never be silently replaced with newer writing.
    const checkpoint = raw === null ? {} : checkpointSchema.parse(JSON.parse(raw));
    if (checkpoint.pending && checkpoint.pending.id !== id)
      throw new Error('Invalid saved sync identity');
    return checkpoint;
  }

  put(id: string, checkpoint: JournalSyncCheckpoint) {
    this.storage.setItem(this.key(id), JSON.stringify(checkpointSchema.parse(checkpoint)));
  }

  remove(id: string) {
    this.storage.removeItem(this.key(id));
  }

  private key(id: string) {
    if (!/^[0-9a-hjkmnp-tv-z]{26}$/.test(id)) throw new Error('Invalid journal identity');
    return `${journalSyncPrefix(this.ownerId)}${id}`;
  }
}
