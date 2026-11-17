import { phraseSections, preserveChoices } from './sections.mjs';
import { LiveRequest } from './live-request.mjs';
import { CandidatePicker } from './candidates.mjs';
import { CompositionView } from './composition-view.mjs';

export class LiveComposition {
  sections = [];
  pins = [];
  selected = -1;
  choosing = false;

  constructor(session, elements) {
    this.session = session;
    this.elements = elements;
    this.view = new CompositionView(elements.input);
    this.picker = new CandidatePicker(elements, (index) => this.choose(index));
    this.request = new LiveRequest(
      (job, result, elapsed) => this.receive(job, result, elapsed),
      (error) => {
        elements.status.textContent = `${error.message} Your text has been kept.`;
      }
    );
  }

  reset() {
    this.request.cancel();
    this.picker.hide();
    this.sections = [];
    this.pins = [];
    this.selected = -1;
    this.choosing = false;
    this.paint();
  }

  paint() {
    this.view.render(this.session.active, this.sections, this.choosing ? this.selected : -1);
  }

  typed() {
    this.request.cancel();
    this.picker.hide();
    this.sections = [];
    this.choosing = false;
    this.paint();
    const reading = this.session.kana(this.session.active.raw);
    if (!/[a-z]/i.test(reading) && reading.length >= 2) this.request.schedule(reading);
  }

  convert() {
    if (this.sections.length) {
      if (this.choosing) this.moveCandidate(1);
      else this.select(0);
      return;
    }
    const reading = this.session.reading();
    this.session.restore();
    this.paint();
    if (/[a-z]/i.test(reading)) {
      this.elements.status.textContent = 'Finish the romaji sound before converting.';
      return;
    }
    this.elements.status.textContent = 'Finding kanji…';
    this.request.schedule(reading, true);
  }

  receive(job, result, elapsed) {
    if (!this.session.atCaret()) return;
    const sections = phraseSections(job.reading, result.candidates);
    if (!sections.length) return;
    this.sections = preserveChoices(sections, this.pins);
    this.selected = 0;
    this.session.active.convertedReading = job.reading;
    this.session.active.preview = true;
    this.session.active.convertedText = this.text();
    this.session.replace(this.text());
    this.choosing = job.immediate;
    if (this.choosing) this.select(0);
    else this.paint();
    this.elements.metrics.textContent = `${result.engineMs.toFixed(1)} ms engine · ${elapsed.toFixed(0)} ms round trip`;
    this.elements.status.textContent =
      '← → sections · ↑ ↓ choices · Enter to commit · Esc for kana.';
  }

  text() {
    return this.sections.map((part) => part.text).join('');
  }

  select(index) {
    this.request.cancel();
    this.choosing = true;
    this.selected = Math.max(0, Math.min(index, this.sections.length - 1));
    const start =
      this.session.active.start +
      this.sections
        .slice(0, this.selected)
        .map((s) => s.text)
        .join('').length;
    this.session.select(start, start + this.sections[this.selected].text.length);
    this.picker.show(this.sections[this.selected]);
    this.paint();
  }

  choose(index) {
    const section = this.sections[this.selected];
    section.selected = index;
    section.text = section.choices[index];
    this.pins = this.pins.filter((pin) => pin.start !== section.start);
    this.pins.push({ ...section });
    this.session.active.convertedText = this.text();
    this.session.replace(this.text());
    this.select(this.selected);
    this.elements.input.focus();
  }

  moveCandidate(direction) {
    const part = this.sections[this.selected];
    this.choose(Math.max(0, Math.min(part.selected + direction, part.choices.length - 1)));
  }

  arrow(key) {
    if (!this.sections.length) return false;
    if (!this.choosing) {
      this.select(key === 'ArrowLeft' ? this.sections.length - 1 : 0);
      if (key === 'ArrowUp') this.moveCandidate(-1);
      return true;
    }
    const horizontal = { ArrowLeft: -1, ArrowRight: 1 }[key];
    if (horizontal) this.select(this.selected + horizontal);
    else this.moveCandidate(key === 'ArrowUp' ? -1 : 1);
    return true;
  }
}
