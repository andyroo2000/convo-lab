import { engineFetch } from '/engine-transport.mjs';

async function enabled() {
  const response = await engineFetch('/api/engine');
  return response.ok && (await response.json()).learning === true;
}
export async function rememberConversions(selections, status) {
  if (!selections.length) return;
  try {
    if (!(await enabled())) return;
    for (const [index, selection] of selections.entries()) {
      const response = await engineFetch('/api/learn', {
        method: 'POST',
        body: JSON.stringify(selection),
      });
      if (!response.ok) throw Error('Couldn’t save your preferred conversion.');
      // Prefer the confirmed whole phrase; use aligned sections only when the
      // user combined spellings that were not offered as one engine candidate.
      if ((await response.json()).learned && index === 0) break;
    }
    window.dispatchEvent(new Event('conversions-learned'));
  } catch (error) {
    status.textContent = error.message;
  }
}
export async function setupLearningControl(button, status) {
  button.hidden = !(await enabled());
  button.addEventListener('click', async () => {
    if (!window.confirm('Reset learned conversions in this browser? Your notebook text will stay.'))
      return;
    button.disabled = true;
    try {
      const response = await engineFetch('/api/reset-learning', { method: 'POST' });
      status.textContent = response.ok
        ? 'Learned conversions cleared.'
        : 'Couldn’t reset learned conversions. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
}
