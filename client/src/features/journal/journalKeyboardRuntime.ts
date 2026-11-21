export interface KeyboardRuntime {
  readiness: () => { state: string; error?: string };
  retry: () => Promise<void>;
  attach: (field: HTMLTextAreaElement, list: HTMLElement) => { dispose: () => void };
}
let loading: Promise<KeyboardRuntime> | undefined;
export function loadKeyboard(): Promise<KeyboardRuntime> {
  const url = new URL('/japanese-input/v1/journal/entry.mjs', window.location.origin).href;
  loading ??= import(/* @vite-ignore */ url).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
