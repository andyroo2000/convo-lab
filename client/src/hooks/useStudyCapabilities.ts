import { useQuery } from '@tanstack/react-query';

import { requestJson } from '../lib/apiClient';
import { decodeStudyClientCapabilities } from '../lib/learningOsContractDecoders';
import { studyApiPath } from '../lib/studyApi';

export const studyCapabilitiesQueryKey = ['study', 'capabilities'] as const;

export async function fetchStudyCapabilities() {
  return decodeStudyClientCapabilities(await requestJson<unknown>(studyApiPath('/capabilities')));
}

export function useStudyCapabilities(enabled = true) {
  return useQuery({
    queryKey: studyCapabilitiesQueryKey,
    queryFn: fetchStudyCapabilities,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
