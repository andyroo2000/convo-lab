export interface ScriptApiContract {
  media: (mediaId: string) => string;
  audio: (episodeId: string, renderId: string) => string;
}

export function createScriptApiContract(apiUrl = ''): ScriptApiContract {
  const collection = `${apiUrl}/api/convolab/scripts`;
  return {
    media: (mediaId: string) => `${collection}/media/${encodeURIComponent(mediaId)}`,
    audio: (episodeId: string, renderId: string) =>
      `${collection}/${encodeURIComponent(episodeId)}/audio/${encodeURIComponent(renderId)}`,
  };
}
