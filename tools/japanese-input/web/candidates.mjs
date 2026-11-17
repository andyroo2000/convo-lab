export class CandidatePicker {
  items = [];
  selected = 0;
  generation = 0;
  request = null;

  constructor(elements, toKana, commit) {
    this.elements = elements;
    this.toKana = toKana;
    this.commit = commit;
  }

  invalidate() {
    this.generation += 1;
    this.request?.abort();
    this.items = [];
    this.elements.list.replaceChildren();
    this.elements.convert.disabled = false;
    this.elements.status.textContent = 'Space to convert, or add the kana as written.';
  }

  async convert() {
    this.invalidate();
    const generation = this.generation;
    const reading = this.toKana(this.elements.input.value).trim();
    if (!reading) return;
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
      if (generation !== this.generation) return;
      if (!response.ok) throw new Error(result.error);
      this.show(result.candidates);
      this.elements.metrics.textContent = `${result.engineMs.toFixed(1)} ms engine · ${(performance.now() - started).toFixed(0)} ms round trip`;
    } catch (error) {
      if (generation === this.generation && error.name !== 'AbortError') {
        this.elements.status.textContent = `${error.message} Your phrase has been kept.`;
      }
    } finally {
      if (generation === this.generation) this.elements.convert.disabled = false;
    }
  }

  show(items) {
    this.items = items;
    this.selected = 0;
    this.elements.status.textContent = items.length
      ? 'Choose a word or press Enter to add the highlighted choice.'
      : 'No full-phrase match. Try a shorter phrase, or add as kana.';
    this.elements.list.replaceChildren(
      ...items.map((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.lang = 'ja';
        button.textContent = item.text;
        button.setAttribute('aria-pressed', String(index === 0));
        button.addEventListener('click', () => this.accept(index));
        return button;
      })
    );
  }

  move(direction) {
    this.selected = (this.selected + direction + this.items.length) % this.items.length;
    [...this.elements.list.children].forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === this.selected));
    });
    this.elements.status.textContent = `Selected: ${this.items[this.selected].text}. Press Enter to add it.`;
  }

  accept(index = this.selected) {
    const text = this.items[index]?.text;
    if (text) this.commit(text);
  }

  handleKey(event) {
    if (event.isComposing || event.keyCode === 229) return;
    const handlers = {
      ' ': () => (this.items.length ? this.move(1) : this.convert()),
      ArrowDown: () => this.items.length && this.move(1),
      ArrowUp: () => this.items.length && this.move(-1),
      Enter: () => (this.items.length ? this.accept() : this.convert()),
      Escape: () => this.invalidate(),
    };
    const handler = handlers[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  }
}
