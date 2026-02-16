const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? '';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let isInitialized = false;

const hasMeasurementId = (): boolean => GA_MEASUREMENT_ID.length > 0;

export const isGoogleAnalyticsEnabled = (): boolean => hasMeasurementId();

export const initializeGoogleAnalytics = (): void => {
  if (!hasMeasurementId() || isInitialized) return;

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`
  );

  if (!existingScript) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      // Match Google's official gtag bootstrap shape.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });

  isInitialized = true;
};

export const trackPageView = (pagePath: string): void => {
  if (!hasMeasurementId() || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
};
