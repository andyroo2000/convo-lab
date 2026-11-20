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

export function validateConversionRequest(body) {
  const reading = validateConversion(body);
  if (body.expanded !== undefined && typeof body.expanded !== 'boolean')
    throw new Error('Expanded must be a boolean.');
  const boundaries = validateBoundaries(reading, body.boundaries);
  return { reading, expanded: body.expanded === true, ...(boundaries && { boundaries }) };
}

function validateBoundaries(reading, boundaries) {
  if (boundaries === undefined) return undefined;
  const positions = new Set(
    [...new Intl.Segmenter('ja').segment(reading)].map((part) => part.index)
  );
  if (!Array.isArray(boundaries) || boundaries.length > 119)
    throw new Error('Provide a list of section boundaries.');
  let previous = 0;
  for (const boundary of boundaries) {
    if (boundary <= previous || !positions.has(boundary))
      throw new Error('Section boundaries must follow reading characters in order.');
    previous = boundary;
  }
  return boundaries;
}

export function conversionResponse(reading, result, info = engineInfo) {
  return {
    schemaVersion: 1,
    engine: info,
    reading,
    candidates: result.candidates,
    engineMs: result.engineMs,
    expansion: result.expansion ?? undefined,
  };
}
