import { useId, useState, type ReactNode } from 'react';
import JournalAvatar from './JournalAvatar';
import JournalEnglish from './JournalEnglish';
import JournalThinkingDelay from './JournalThinkingDelay';
import JournalThinkingOrnament, { ThinkingDots } from './JournalThinkingOrnament';
import { nextWaitingPhrase } from './journalThinkingContent';
import { journalTextStyle } from './journalTypography';
import './journalTutorText.css';

interface Props {
  avatar?: string;
  lastAnswer?: string;
  children?: ReactNode;
}

const JournalThinking = ({ avatar, lastAnswer, children }: Props) => {
  const [phrase] = useState(nextWaitingPhrase);
  const [english, setEnglish] = useState(true);
  const translationId = useId();
  return (
    <section
      aria-label="Your tutor is thinking"
      className="overflow-hidden rounded-2xl border border-[#d8e4f2]"
    >
      <div className="flex justify-end bg-[#e4effd] px-4 py-2">
        <JournalEnglish
          visible={english}
          translationId={translationId}
          onToggle={() => setEnglish(!english)}
        />
      </div>
      <div className="flex min-h-[390px] flex-col items-center bg-[#fffdf6] px-5 py-10 text-center text-[#542006] sm:py-12">
        <p role="status" className="sr-only">
          Your tutor is preparing your feedback. Your writing is saved.
        </p>
        <JournalThinkingOrnament />
        <JournalAvatar
          src={avatar}
          alt="Your tutor"
          className="mb-5 mt-7 h-20 w-20 object-contain"
        />
        <p
          lang="ja"
          className="text-lg leading-relaxed sm:text-[21px]"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {phrase.japanese}
        </p>
        {english && (
          <p id={translationId} lang="en" className="journal-tutor-translation">
            {phrase.english}
          </p>
        )}
        <ThinkingDots />
        <JournalThinkingDelay />
        {lastAnswer && (
          <p
            className="mt-9 w-full border-t border-[#ddd8c9] pt-5 text-left"
            style={journalTextStyle}
          >
            {lastAnswer}
          </p>
        )}
        {children}
      </div>
    </section>
  );
};
export default JournalThinking;
