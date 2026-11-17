import { bind, toHiragana } from '/wanakana.js';
import { attachNotebook, attachPhrase, insertText } from './editor.mjs';
import { CandidatePicker } from './candidates.mjs';
import { watchReadiness } from './readiness.mjs';

const byId = (id) => document.getElementById(id);
const input = byId('phrase');
const notebook = byId('notebook');
const status = byId('status');
const say = (message) => {
  status.textContent = message;
};
const savePhrase = attachPhrase(input);
const picker = new CandidatePicker(
  {
    input,
    status,
    list: byId('candidates'),
    convert: byId('convert'),
    metrics: byId('metrics'),
  },
  toHiragana,
  (text) => {
    insertText(notebook, text);
    input.value = '';
    savePhrase();
    picker.invalidate();
    say('Added to your notebook. Keep writing.');
    input.focus();
  }
);

attachNotebook(notebook, say);
watchReadiness(() => picker.invalidate());
bind(input);
input.addEventListener('input', () => {
  picker.invalidate();
  savePhrase();
});
input.addEventListener('keydown', (event) => picker.handleKey(event));
byId('convert').addEventListener('click', () => picker.convert());
byId('keep-kana').addEventListener('click', () => {
  const text = toHiragana(input.value).trim();
  if (text) picker.commit(text);
});
byId('newline').addEventListener('click', () => {
  insertText(notebook, '\n\n');
  input.focus();
});
byId('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(notebook.value);
    say('Notebook copied.');
  } catch {
    say('Select the notebook text and copy it with your keyboard.');
  }
});
document.querySelectorAll('[data-reading]').forEach((button) => {
  button.addEventListener('click', () => {
    input.value = button.dataset.reading;
    savePhrase();
    picker.convert();
    input.focus();
  });
});
