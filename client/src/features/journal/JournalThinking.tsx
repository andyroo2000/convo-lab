import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import JournalAvatar from './JournalAvatar';
import JournalThinkingDelay from './JournalThinkingDelay';
import JournalThinkingOrnament, { ThinkingDots } from './JournalThinkingOrnament';
import { nextWaitingPhrase } from './journalThinkingContent';
import './journalTutorText.css';

interface Props {
  avatar?: string;
  lastAnswer?: string;
  children?: ReactNode;
}

const JournalThinking = ({ avatar, lastAnswer, children }: Props) => {
  const [phrase] = useState(nextWaitingPhrase);
  return (
    <section
      aria-label="Your tutor is thinking"
      className="overflow-hidden rounded-2xl border border-[#d8e4f2]"
    >
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
        <p lang="en" className="journal-tutor-translation">
          {phrase.english}
        </p>
        <ThinkingDots />
        <JournalThinkingDelay />
        {lastAnswer && (
          <p
            className="mt-9 flex w-full items-center gap-3 border-t border-[#ddd8c9] pt-5 text-left text-base leading-relaxed text-[#594c44]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <Check size={16} className="shrink-0 text-[#6a8267]" aria-hidden="true" />
            <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
              {lastAnswer}
            </span>
          </p>
        )}
        {children}
      </div>
    </section>
  );
};
export default JournalThinking;
