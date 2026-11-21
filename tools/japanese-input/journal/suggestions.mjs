import { LiveComposition } from '../web/live-composition.mjs';
import { spellings } from '../web/sections.mjs';
import { rememberConversions } from '../web/confirmed-learning.mjs';

// Keep kana in the notebook until the writer chooses a spelling. Explicit
// conversion still uses the existing full-context section/boundary controller.
export class JournalComposition extends LiveComposition {
  suggesting = false;
  suggestions = [];

  typed() {
    this.suggesting = false;
    this.candidates = [];
    super.typed();
  }

  receive(job, result, elapsed) {
    if (job.immediate) {
      this.suggesting = false;
      super.receive(job, result, elapsed);
      return;
    }
    if (!this.session.atCaret()) return;
    this.suggesting = true;
    this.suggest(result.candidates);
    this.expansion.load(job.reading);
  }

  suggest(candidates) {
    const reading = this.session.reading();
    const raw = this.session.active.raw;
    const choices = spellings(
      reading,
      candidates[0]?.text,
      candidates.map((item) => item.text)
    );
    this.suggestions = [...new Set([...choices, raw])];
    this.candidates = candidates;
    this.elements.list.dataset.anchorOffset = String(this.session.active.start);
    this.picker.show({ choices: this.suggestions, selected: Math.min(1, choices.length - 1) });
  }

  select(index) {
    delete this.elements.list.dataset.anchorOffset;
    super.select(index);
  }

  extendChoices(reading, result) {
    if (this.suggesting) this.suggest(result.candidates);
    else super.extendChoices(reading, result);
  }

  choose(index) {
    if (!this.suggesting) {
      super.choose(index);
      return;
    }
    const reading = this.session.reading();
    const text = this.suggestions[index];
    this.session.active.preview = true;
    this.session.active.convertedReading = '';
    this.session.replace(text);
    if (this.session.active.visible !== text) return;
    this.session.finish();
    this.reset();
    void rememberConversions(
      [{ reading, text, start: 0, end: reading.length }],
      this.elements.status
    );
  }

  reset() {
    this.suggesting = false;
    super.reset();
  }

  arrow(key, shift) {
    if (this.suggesting) {
      this.suggesting = false;
      super.receive(
        { reading: this.session.reading(), immediate: true },
        { candidates: this.candidates, engineMs: 0 },
        0
      );
    }
    return super.arrow(key, shift);
  }
}
