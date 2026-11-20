import { engineFetch } from '/engine-transport.mjs';

async function enabled() {
  const response = await engineFetch('/api/engine');
  return response.ok && (await response.json()).learning === true;
}
export async function rememberConversions(selections, status) {
  if (!selections.length) return;
  try {
    if (!(await enabled())) return;
    const learned = await learnSelections(selections);
    if (learned) window.dispatchEvent(new Event('conversions-learned'));
  } catch (error) {
    status.textContent = error.message;
  }
}
async function learnSelections(selections) {
  let learned = false;
  for (const [index, selection] of selections.entries()) {
    const response = await engineFetch('/api/learn', {
      method: 'POST',
      body: JSON.stringify(selection),
    });
    if (!response.ok) throw Error('Couldn’t save your preferred conversion.');
    const result = await response.json();
    learned ||= result.learned === true;
    // Prefer the whole phrase; otherwise learn its aligned, confirmed sections.
    if (result.learned && index === 0) break;
  }
  return learned;
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
