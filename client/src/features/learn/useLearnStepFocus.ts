import { useEffect, useRef } from 'react';
import type { LearnSession } from './types';

export default function useLearnStepFocus(session?: LearnSession) {
  const previous = useRef<string>();
  const step = session ? `${session.state.phase}:${session.state.index}` : undefined;
  useEffect(() => {
    if (previous.current && step !== previous.current) {
      document
        .getElementById('learn-current-step')
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    previous.current = step;
  }, [step]);
}
