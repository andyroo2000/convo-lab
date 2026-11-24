import { createContext, type RefCallback } from 'react';

export const StudyReplayHost = createContext<HTMLDivElement | null>(null);
export const StudyReplayMount = createContext<RefCallback<HTMLDivElement> | null>(null);
