import { placeCandidates } from './caret.mjs';

export class CandidatePicker {
  items = [];
  selected = 0;
  generation = 0;
  request = null;

  constructor(elements, callbacks) {
    this.elements = elements;
    this.callbacks = callbacks;
    elements.list.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) event.preventDefault();
    });
    const reposition = () => placeCandidates(elements.input, elements.list);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    new ResizeObserver(reposition).observe(elements.input);
    document.fonts.ready.then(reposition);
  }

  invalidate() {
    this.generation += 1;
    this.request?.abort();
    this.items = [];
    this.elements.list.replaceChildren();
    this.elements.list.hidden = true;
    this.elements.convert.disabled = false;
  }

  async convert(reading) {
    this.invalidate();
    const generation = this.generation;
    this.elements.convert.disabled = true;
    this.elements.status.textContent = 'Finding kanji…';
    this.request = new AbortController();
    const started = performance.now();
    try {
      const response = await fetch('/api/v1/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading }),
        signal: this.request.signal,
      });
      const result = await response.json();
      if (generation !== this.generation || !this.callbacks.active()) return;
      if (!response.ok) throw new Error(result.error);
      this.show(result.candidates);
      this.elements.metrics.textContent = `${result.engineMs.toFixed(1)} ms engine · ${(performance.now() - started).toFixed(0)} ms round trip`;
    } catch (error) {
      if (generation === this.generation && error.name !== 'AbortError')
        this.elements.status.textContent = `${error.message} Your text has been kept.`;
    } finally {
      if (generation === this.generation) this.elements.convert.disabled = false;
    }
  }

  show(items) {
    this.items = items;
    this.selected = 0;
    this.elements.status.textContent = items.length
      ? 'Space or arrows to choose · Enter to confirm · Esc to return to kana.'
      : 'No full-phrase match. Press Enter to keep the kana.';
    this.elements.list.replaceChildren(
      ...items.map((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.lang = 'ja';
        button.textContent = item.text;
        button.setAttribute('aria-pressed', String(index === 0));
        button.addEventListener('click', () => {
          this.callbacks.preview(item.text);
          this.callbacks.accept();
        });
        return button;
      })
    );
    this.elements.list.hidden = !items.length;
    if (items.length) this.preview();
  }

  preview() {
    this.callbacks.preview(this.items[this.selected].text);
    placeCandidates(this.elements.input, this.elements.list);
    [...this.elements.list.children].forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === this.selected));
    });
    this.elements.list.children[this.selected]?.scrollIntoView({ block: 'nearest' });
  }

  move(direction) {
    this.selected = (this.selected + direction + this.items.length) % this.items.length;
    this.preview();
  }
}
