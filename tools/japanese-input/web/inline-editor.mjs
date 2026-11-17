import { InlineSession, kanaComposer } from './inline-session.mjs';
import { NotebookHistory } from './history.mjs';
import { CandidatePicker } from './candidates.mjs';

export class InlineEditor {
  native = false;
  internal = false;
  japanese = true;
  ready = false;

  constructor(elements, toHiragana) {
    this.elements = elements;
    this.field = elements.input;
    this.session = new InlineSession(this.field, kanaComposer(toHiragana), () => this.changed());
    this.history = new NotebookHistory(this.field, () => this.changed());
    this.picker = new CandidatePicker(elements, {
      active: () => this.session.atCaret(),
      preview: (text) => this.session.preview(text),
      accept: () => {
        this.finish();
        this.field.focus();
      },
    });
    this.listen();
  }

  listen() {
    this.field.addEventListener('beforeinput', (event) => this.beforeInput(event));
    this.field.addEventListener('input', () => this.externalInput());
    this.field.addEventListener('keydown', (event) => this.keydown(event));
    this.field.addEventListener('pointerdown', () => this.finish());
    this.field.addEventListener('blur', () => this.finish());
    this.field.addEventListener('compositionstart', () => {
      this.finish();
      this.native = true;
    });
    this.field.addEventListener('compositionend', () => {
      this.native = false;
      this.history.remember();
    });
  }

  changed() {
    this.internal = true;
    this.field.dispatchEvent(new Event('input', { bubbles: true }));
    this.internal = false;
  }

  externalInput() {
    if (this.internal) return;
    this.session.active = null;
    this.picker.invalidate();
    if (!this.native) this.history.remember();
  }

  setReady(ready) {
    this.ready = ready;
    if (!ready) this.finish();
    this.field.readOnly = !ready;
  }

  finish(preserveSelection = false) {
    this.session.finish(preserveSelection);
    this.picker.invalidate();
    this.history.remember();
    this.elements.status.textContent =
      'Type in the notebook · Space to convert · Enter to confirm.';
  }

  toggleMode() {
    this.finish();
    this.japanese = !this.japanese;
    this.field.focus();
    return this.japanese;
  }

  reconcileCaret() {
    if (!this.session.active || this.session.atCaret()) return;
    // A selection made by assistive technology or script must never be replaced
    // using the previous composition's offsets.
    this.session.active = null;
    this.picker.invalidate();
    this.history.remember();
  }

  beforeInput(event) {
    if (this.native || event.isComposing) return;
    if (event.inputType.startsWith('history')) {
      event.preventDefault();
      this.undo(event.inputType === 'historyRedo');
      return;
    }
    this.reconcileCaret();
    if (this.handleRomanInput(event)) return;
    if (this.handlePunctuation(event)) return;
    if (event.inputType === 'deleteContentBackward' && this.session.active) {
      event.preventDefault();
      this.picker.invalidate();
      this.session.backspace();
      return;
    }
    this.finish(this.field.selectionStart !== this.field.selectionEnd);
  }

  handlePunctuation(event) {
    if (!this.japanese || event.inputType !== 'insertText') return false;
    const text = { '.': '。', ',': '、', '?': '？', '!': '！', '/': '・' }[event.data];
    if (!text) return false;
    event.preventDefault();
    this.finish();
    this.insertLiteral(text);
    return true;
  }

  handleRomanInput(event) {
    if (!this.japanese || event.inputType !== 'insertText') return false;
    if (!/^[a-z'-]+$/i.test(event.data ?? '')) return false;
    event.preventDefault();
    if (this.session.active?.preview) this.finish();
    if (!this.session.active) this.history.remember();
    this.picker.invalidate();
    this.session.append(event.data);
    this.elements.status.textContent = 'Space to choose kanji · Enter to keep kana.';
    return true;
  }

  convert() {
    if (!this.ready || this.native) return false;
    this.reconcileCaret();
    if (this.picker.items.length) {
      this.picker.move(1);
      return true;
    }
    if (!this.session.active && !this.selectedKana()) return false;
    const reading = this.session.reading();
    if (!reading) return false;
    this.session.restore();
    if (/[a-z]/i.test(reading)) {
      this.elements.status.textContent = 'Finish the romaji sound before converting.';
      return true;
    }
    this.picker.convert(reading);
    return true;
  }

  selectedKana() {
    const text = this.field.value.slice(this.field.selectionStart, this.field.selectionEnd);
    if (!/^[\p{Script=Hiragana}\p{Script=Katakana}ー。、！？]+$/u.test(text)) return false;
    this.history.remember();
    this.session.begin(text);
    return true;
  }

  escape() {
    if (this.session.active?.preview) {
      this.picker.invalidate();
      this.session.restore();
    } else this.finish();
  }

  undo(redo) {
    this.finish();
    this.history.move(redo);
  }

  keydown(event) {
    if (this.nativeKey(event)) return;
    if (this.historyKey(event)) return;
    if ([event.metaKey, event.ctrlKey, event.altKey].some(Boolean)) return;
    this.reconcileCaret();
    if (this.compositionKey(event)) event.preventDefault();
    else if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', 'Delete'].includes(
        event.key
      )
    )
      this.finish();
  }

  nativeKey(event) {
    return [this.native, event.isComposing, event.keyCode === 229].some(Boolean);
  }

  historyKey(event) {
    if (!(event.metaKey || event.ctrlKey)) return false;
    const key = event.key.toLowerCase();
    if (!['z', 'y'].includes(key)) return false;
    event.preventDefault();
    this.undo(key === 'y' || event.shiftKey);
    return true;
  }

  compositionKey(event) {
    if (event.key === ' ' && this.japanese) return this.convert();
    if (!this.session.active) return false;
    const actions = { Enter: () => this.finish(), Escape: () => this.escape() };
    if (actions[event.key]) {
      actions[event.key]();
      return true;
    }
    if (!this.picker.items.length) return false;
    const direction = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!direction) return false;
    this.picker.move(direction);
    return true;
  }

  insertExample(reading) {
    this.finish();
    this.field.focus();
    this.history.remember();
    this.session.begin();
    this.session.append(reading);
    this.convert();
  }

  newline() {
    this.finish();
    this.insertLiteral('\n');
    this.field.focus();
  }

  insertLiteral(text) {
    this.field.setRangeText(text, this.field.selectionStart, this.field.selectionEnd, 'end');
    this.changed();
    this.history.remember();
  }
}
