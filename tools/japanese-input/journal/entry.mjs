import { toHiragana } from '../vendor/wanakana.js';
import { InlineEditor } from '../web/inline-editor.mjs';
import { getRuntime } from './transport.mjs';
import { JournalComposition } from './suggestions.mjs';
import { JournalSession } from './session.mjs';

export function readiness() {
  const runtime = getRuntime();
  return { state: runtime.state, error: runtime.error };
}
export function retry() {
  return getRuntime().preload();
}
export function attach(field, list) {
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.className = 'sr-only';
  field.parentNode.append(status);
  const editor = new InlineEditor(
    {
      input: field,
      list,
      status,
      metrics: document.createElement('span'),
      composition: JournalComposition,
      session: JournalSession,
    },
    toHiragana
  );
  editor.ready = true;
  list.dataset.placement = 'below';
  list.dataset.maxHeight = '236';
  const choose = editor.live.picker.choose;
  editor.live.picker.choose = (index) => {
    choose(index);
    editor.commit();
  };
  return {
    dispose() {
      editor.dispose();
      status.remove();
    },
  };
}
