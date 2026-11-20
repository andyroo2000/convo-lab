function receive(data, handlers) {
  if (data.neural) handlers.neural(data.neural);
  else if (data.ready) handlers.ready();
  else if (data.id) handlers.result(data);
  else if (data.error) handlers.error(Error(data.error));
}

export function initializeWorker(worker, buffer, callbacks, startup) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(Error('Model startup timed out; please retry.')), 90000);
    const done = (error) => {
      clearTimeout(timer);
      startup.delete(worker);
      if (error) reject(error);
      else resolve();
    };
    startup.set(worker, done);
    worker.onerror = (event) => {
      const error = Error(event.message);
      done(error);
      callbacks.failure(error);
    };
    worker.onmessage = ({ data }) =>
      receive(data, {
        neural: callbacks.neural,
        result: callbacks.result,
        ready: () => done(),
        error: done,
      });
    worker.postMessage({ op: 'init', buffer });
  });
}
