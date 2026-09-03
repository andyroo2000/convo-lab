import JapaneseDatePracticeView from './JapaneseDatePracticeView';
import useJapaneseDateAutoplay from './useJapaneseDateAutoplay';
import useJapaneseDateNavigation from './useJapaneseDateNavigation';
import useJapaneseDatePlayback from './useJapaneseDatePlayback';
import useJapaneseDatePracticeState from './useJapaneseDatePracticeState';
import useJapaneseDateTimers from './useJapaneseDateTimers';

const JapaneseDateToolPage = () => {
  const state = useJapaneseDatePracticeState();
  const timers = useJapaneseDateTimers(state);
  const playback = useJapaneseDatePlayback(state);
  const navigation = useJapaneseDateNavigation(state, timers, playback);
  useJapaneseDateAutoplay(state, timers, playback, navigation);
  return <JapaneseDatePracticeView state={state} navigation={navigation} />;
};

export default JapaneseDateToolPage;
