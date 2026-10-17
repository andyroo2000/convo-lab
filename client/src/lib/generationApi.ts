import readApiError from './apiError';

export interface GenerationApiContract {
  audio: {
    generate: string;
    generateAllSpeeds: string;
    job: (jobId: string) => string;
  };
  images: {
    generate: string;
    job: (jobId: string) => string;
  };
}

export function createGenerationApiContract(apiUrl = ''): GenerationApiContract {
  const root = `${apiUrl}/api/convolab`;
  const job = (collection: string, jobId: string) =>
    `${root}/${collection}/job/${encodeURIComponent(jobId)}`;

  return {
    audio: {
      generate: `${root}/audio/generate`,
      generateAllSpeeds: `${root}/audio/generate-all-speeds`,
      job: (jobId) => job('audio', jobId),
    },
    images: {
      generate: `${root}/images/generate`,
      job: (jobId) => job('images', jobId),
    },
  };
}

export const generationApi = createGenerationApiContract();
export const readGenerationApiError = readApiError;
