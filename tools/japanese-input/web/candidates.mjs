import { placeCandidates } from './caret.mjs';

export class CandidatePicker {
  lifetime = new AbortController();
  constructor(elements, choose) {
    this.elements = elements;
    this.choose = choose;
    elements.list.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target.closest('button')) event.preventDefault();
      },
      { signal: this.lifetime.signal }
    );
    const reposition = () => placeCandidates(elements.input, elements.list);
    window.addEventListener('resize', reposition, { signal: this.lifetime.signal });
    window.addEventListener('scroll', reposition, { capture: true, signal: this.lifetime.signal });
    this.observer = new ResizeObserver(reposition);
    this.observer.observe(elements.input);
    document.fonts.ready.then(reposition);
  }

  dispose() {
    this.lifetime.abort();
    this.observer.disconnect();
    this.hide();
  }

  hide() {
    this.elements.list.hidden = true;
    this.elements.list.replaceChildren();
  }

  show(section) {
    const list = this.elements.list;
    list.replaceChildren(
      ...section.choices.map((text, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.lang = 'ja';
        button.textContent = text;
        button.setAttribute('aria-pressed', String(index === section.selected));
        button.addEventListener('click', () => this.choose(index));
        return button;
      })
    );
    list.hidden = false;
    const maximum = Number(list.dataset.maxHeight ?? 190);
    list.style.height = `${Math.min(maximum, (section.choices.length - section.selected) * list.firstElementChild.offsetHeight + 20)}px`;
    placeCandidates(this.elements.input, list);
    // Kana sits immediately above the best suggestion, reachable with Up.
    // Start the scroller at the current choice rather than the kana row.
    list.scrollTop = list.children[section.selected]?.offsetTop - list.firstElementChild.offsetTop;
  }
}
