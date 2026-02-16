/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_STRIPE_PRICE_TEST_MONTHLY?: string;
  readonly VITE_STRIPE_PRICE_PRO_MONTHLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
