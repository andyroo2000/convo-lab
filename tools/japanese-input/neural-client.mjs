import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EngineClient } from './engine-client.mjs';
import { engineInfo } from './contract.mjs';

const model = JSON.parse(readFileSync(new URL('./neural-model.json', import.meta.url)));
const binary = fileURLToPath(
  new URL('./.engines/neural-build/release/InputWorker', import.meta.url)
);
const weight = fileURLToPath(
  new URL(`./.engines/zenz-v3-small/${model.filename}`, import.meta.url)
);

export function neuralConfiguration(inferenceLimit) {
  return {
    info: {
      ...engineInfo,
      id: `azookey-zenzai-limit-${inferenceLimit}`,
      neural: true,
      model,
      inferenceLimit,
      accelerator: 'Metal',
      context: '',
      personalization: false,
      richCandidates: false,
    },
    createClient: () =>
      new EngineClient(binary, {
        args: [weight, String(inferenceLimit)],
        timeoutMs: 60000,
      }),
  };
}
