import readApiError from './apiError';

type ScriptOperation = 'annotate' | 'segments' | 'render' | 'images' | 'status';

export interface ScriptApiContract {
  collection: string;
  operation: (episodeId: string, operation: ScriptOperation) => string;
  job: (jobId: string) => string;
  media: (mediaId: string) => string;
  audio: (episodeId: string, renderId: string) => string;
}

export function createScriptApiContract(apiUrl = ''): ScriptApiContract {
  const collection = `${apiUrl}/api/convolab/scripts`;
  const member = (episodeId: string) => `${collection}/${encodeURIComponent(episodeId)}`;

  return {
    collection,
    operation: (episodeId, operation) => `${member(episodeId)}/${operation}`,
    job: (jobId) => `${collection}/job/${encodeURIComponent(jobId)}`,
    media: (mediaId) => `${collection}/media/${encodeURIComponent(mediaId)}`,
    audio: (episodeId, renderId) => `${member(episodeId)}/audio/${encodeURIComponent(renderId)}`,
  };
}

export const readScriptApiError = readApiError;
export const scriptApi = createScriptApiContract();
