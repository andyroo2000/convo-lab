import { InlineSession } from '../web/inline-session.mjs';

export class JournalSession extends InlineSession {
  replace(text, selected = false) {
    if (!this.active) return;
    const { start, end, visible } = this.active;
    const length = this.field.value.length - (end - start) + text.length;
    if (this.field.maxLength >= 0 && length > this.field.maxLength) {
      this.active.raw = visible;
      this.active.preview = false;
      this.active.convertedReading = '';
      return;
    }
    super.replace(text, selected);
  }
}
