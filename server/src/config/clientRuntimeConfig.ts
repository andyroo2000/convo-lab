import type { RequestHandler } from 'express';

export interface ClientRuntimeConfig {
  learningOsDirectAccountApi: boolean;
  learningOsDirectEpisodeApi: boolean;
  learningOsDirectCourseApi: boolean;
}

export const redirectClientIndexDocument: RequestHandler = (_req, res) => {
  res.redirect(308, '/');
};

export function getClientRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env
): ClientRuntimeConfig {
  return {
    learningOsDirectAccountApi:
      environment.LEARNING_OS_DIRECT_ACCOUNT_API_ENABLED?.trim().toLowerCase() === 'true',
    learningOsDirectEpisodeApi:
      environment.LEARNING_OS_DIRECT_EPISODE_API_ENABLED?.trim().toLowerCase() === 'true',
    learningOsDirectCourseApi:
      environment.LEARNING_OS_DIRECT_COURSE_API_ENABLED?.trim().toLowerCase() === 'true',
  };
}

export function injectClientRuntimeConfig(
  html: string,
  config: ClientRuntimeConfig = getClientRuntimeConfig()
): string {
  const serialized = JSON.stringify(config).replace(/[<>&\u2028\u2029]/gu, (character) => {
    const codePoint = character.codePointAt(0);
    return codePoint === undefined ? '' : `\\u${codePoint.toString(16).padStart(4, '0')}`;
  });
  const script = `<script>window.__CONVOLAB_RUNTIME_CONFIG__=${serialized};</script>`;

  return html.replace('</head>', `    ${script}\n  </head>`);
}
