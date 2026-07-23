/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __CONVOLAB_RUNTIME_CONFIG__?: {
    learningOsDirectAccountApi?: boolean;
    learningOsDirectAuthApi?: boolean;
    learningOsDirectEpisodeApi?: boolean;
    learningOsDirectCourseApi?: boolean;
    learningOsDirectScriptApi?: boolean;
    learningOsDirectAdminApi?: boolean;
  };
}
