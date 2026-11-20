import { createPlaygroundServer } from '../../server.mjs';
import { EngineClient } from '../../engine-client.mjs';
import { NeuralRuntime } from '../../neural-runtime.mjs';
import { engineInfo } from '../../contract.mjs';
const runtime = new NeuralRuntime({
  info: {
    ...engineInfo,
    id: 'azookey-server-cpu',
    neural: true,
    accelerator: 'CPU',
    inferenceLimit: 1,
    learning: false,
  },
  createClient: () =>
    new EngineClient('/experiment/server-swift/.build/release/InputWorker', {
      args: ['/experiment/ggml-model-Q5_K_M.gguf', '1'],
      timeoutMs: 60000,
    }),
});
const server = createPlaygroundServer(runtime);
server.listen(5191, '127.0.0.1', () =>
  console.log('Private server experiment listening on loopback:5191')
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
