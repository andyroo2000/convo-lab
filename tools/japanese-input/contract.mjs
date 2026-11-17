export const engineInfo = Object.freeze({
  id: 'azookey-dictionary',
  version: '0.11.2',
  revision: '80b8204f1cdfb364bb2ed355cf52c7ebb2519a0c',
  neural: false,
  learning: false,
});

export function validateConversion(body) {
  if (!body || typeof body.reading !== 'string') throw new Error('Provide a reading.');
  const reading = body.reading.normalize('NFC').trim();
  if (!reading || [...reading].length > 120) {
    throw new Error('Convert a phrase of 1–120 characters at a time.');
  }
  if (/[\u0000-\u001f\u007f]/u.test(reading)) throw new Error('Convert one line at a time.');
  return reading;
}

export function conversionResponse(reading, result) {
  return {
    schemaVersion: 1,
    engine: engineInfo,
    reading,
    candidates: result.candidates,
    engineMs: result.engineMs,
  };
}
