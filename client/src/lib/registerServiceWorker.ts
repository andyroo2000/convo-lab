import registerPwaServiceWorker from './pwaRegister';

export default function registerConvoLabServiceWorker() {
  let updateServiceWorker: ReturnType<typeof registerPwaServiceWorker> | null = null;

  updateServiceWorker = registerPwaServiceWorker({
    // Register before window load so first-session audio warming can reach the SW quickly.
    // VitePWA's `immediate` controls registration timing, not skip-waiting activation.
    immediate: true,
    onNeedRefresh() {
      updateServiceWorker?.(true).catch((error: unknown) => {
        console.warn('Unable to apply service worker update:', error);
      });
    },
  });

  return updateServiceWorker;
}
