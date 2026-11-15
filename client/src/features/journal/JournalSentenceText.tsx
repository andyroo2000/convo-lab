import JournalRuby from './JournalRuby';
import { sentenceKeyDown, useJournalPlayback } from './useJournalPlayback';
import { sentenceAt } from './journalTimedAudio';

import sentenceReadings from './journalSentenceReadings';

const JournalSentenceText = ({ text }: { text: string }) => {
  const playback = useJournalPlayback();
  const parts = sentenceReadings(text, playback?.sentences.map((s) => s.text) ?? []);
  if (!playback || !parts) return <JournalRuby text={text} />;
  const current = playback.engaged ? sentenceAt(playback.sentences, playback.position) : -1;
  return (
    <>
      {/* Native buttons are atomic inline boxes and reflow whole sentences. */}
      {parts.map((part, index) => (
        <span
          role="button"
          tabIndex={0}
          data-journal-playback-control
          onKeyDown={(event) => {
            sentenceKeyDown(event, playback);
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!event.repeat) playback.seek(playback.sentences[index].start);
            }
          }}
          key={playback.sentences[index].start}
          aria-label={`Seek to sentence ${index + 1}`}
          aria-current={current === index ? 'true' : undefined}
          onClick={() => playback.seek(playback.sentences[index].start)}
          className={`inline cursor-pointer rounded border-0 p-0 text-left font-inherit text-inherit hover:bg-indigo/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo ${current === index ? 'bg-indigo/10' : 'bg-transparent'}`}
        >
          <JournalRuby text={part} />
        </span>
      ))}
    </>
  );
};
export default JournalSentenceText;
