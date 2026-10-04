import { getReadingAudio } from './readingsApi';

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export default class SentenceAudioPlayer {
  private player = new Audio();

  private pending: AbortController | null = null;

  private url: string | null = null;

  private disposed = false;

  constructor(
    private readingId: string,
    private sentence: number,
    private onStatus: (status: AudioStatus) => void
  ) {
    this.player.onended = () => onStatus('paused');
    this.player.onerror = () => onStatus('error');
  }

  async toggle() {
    if (this.disposed || this.pending) return;
    if (!this.player.paused) {
      this.player.pause();
      this.onStatus('paused');
      return;
    }
    await this.start();
  }

  private async start() {
    const controller = new AbortController();
    this.pending = controller;
    try {
      await this.load(controller.signal);
      if (controller.signal.aborted) return;
      if (this.player.ended) this.player.currentTime = 0;
      await this.player.play();
      if (!controller.signal.aborted) this.onStatus('playing');
    } catch {
      if (!controller.signal.aborted) this.onStatus('error');
    } finally {
      if (this.pending === controller) this.pending = null;
    }
  }

  private async load(signal: AbortSignal) {
    if (this.url) return;
    this.onStatus('loading');
    const blob = await getReadingAudio(this.readingId, this.sentence, signal);
    if (signal.aborted) return;
    this.url = URL.createObjectURL(blob);
    this.player.src = this.url;
  }

  dispose() {
    this.disposed = true;
    this.pending?.abort();
    this.player.pause();
    this.player.onended = null;
    this.player.onerror = null;
    this.player.removeAttribute('src');
    if (this.url) URL.revokeObjectURL(this.url);
  }
}
