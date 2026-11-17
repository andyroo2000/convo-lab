const mapping = {
  nn: 'ん',
  nna: 'んな',
  nni: 'んに',
  nnu: 'んぬ',
  nne: 'んね',
  nno: 'んの',
  nnya: 'んにゃ',
  nnyu: 'んにゅ',
  nnyo: 'んにょ',
};

export function kanaComposer(toHiragana) {
  return (raw, final = false) =>
    toHiragana(raw, {
      IMEMode: !final && !raw.endsWith('nn'),
      customKanaMapping: mapping,
    });
}

export class InlineSession {
  active = null;

  constructor(field, kana, changed) {
    this.field = field;
    this.kana = kana;
    this.changed = changed;
  }

  begin(raw = '') {
    this.active = {
      start: this.field.selectionStart,
      end: this.field.selectionEnd,
      raw,
      visible: this.field.value.slice(this.field.selectionStart, this.field.selectionEnd),
      preview: false,
    };
  }

  intact() {
    if (!this.active) return false;
    const { start, end, visible } = this.active;
    return this.field.value.slice(start, end) === visible;
  }

  atCaret() {
    if (!this.intact()) return false;
    const { start, end } = this.active;
    return this.field.selectionEnd === end && [start, end].includes(this.field.selectionStart);
  }

  replace(text, selected = false) {
    if (!this.intact()) return;
    const active = this.active;
    this.field.setRangeText(text, active.start, active.end, 'end');
    active.end = active.start + text.length;
    active.visible = text;
    if (selected) this.field.setSelectionRange(active.start, active.end);
    this.changed();
  }

  append(text) {
    if (!this.active) this.begin();
    this.active.raw += text;
    this.active.preview = false;
    this.replace(this.kana(this.active.raw));
  }

  reading() {
    return this.active ? this.kana(this.active.raw, true) : '';
  }

  preview(text) {
    if (!this.atCaret()) return;
    this.active.preview = true;
    this.replace(text, true);
  }

  restore() {
    if (!this.active) return;
    this.active.preview = false;
    this.replace(this.reading());
  }

  backspace() {
    if (this.active.preview) return this.restore();
    const characters = [...this.active.visible];
    characters.pop();
    this.active.raw = characters.join('');
    this.replace(this.active.raw);
  }

  finish(preserveSelection = false) {
    if (!this.active) return;
    if (preserveSelection) {
      this.active = null;
      return;
    }
    if (!this.active.preview) this.replace(this.reading());
    this.field.setSelectionRange(this.active.end, this.active.end);
    this.active = null;
  }
}
