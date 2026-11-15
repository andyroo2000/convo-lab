import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { shuffled } from './journalThinkingContent';
import { illustrationStyle, thinkingIllustrations } from './journalThinkingIllustrations';

const Illustration = ({ items, slot }: { items: number[]; slot: number }) => {
  const [turn, setTurn] = useState(0);
  const reduced = useReducedMotion();
  const duration = turn === 0 ? (slot + 1) * 3 : 9;
  return (
    <span className="flex h-[41px] w-[49px] items-center justify-center sm:h-[47px] sm:w-14">
      <motion.span
        key={turn}
        className="block"
        style={illustrationStyle(items[turn % items.length])}
        initial={{ opacity: 0 }}
        animate={{ opacity: reduced ? 1 : [0, 1, 1, 0] }}
        transition={{ duration, times: [0, 0.15, 0.85, 1], ease: 'easeInOut' }}
        onAnimationComplete={() => {
          if (!reduced) setTurn((value) => value + 1);
        }}
      />
    </span>
  );
};

const JournalThinkingOrnament = () => {
  const [deck] = useState(() => shuffled(thinkingIllustrations.map((_, index) => index)));
  return (
    <div aria-hidden="true" className="flex w-full max-w-sm items-center justify-center gap-5">
      <span className="h-1 flex-1 border-y border-[#9b9486]/50" />
      {[0, 1, 2].map((slot) => (
        <Illustration
          key={slot}
          slot={slot}
          items={deck.filter((_, index) => index % 3 === slot)}
        />
      ))}
      <span className="h-1 flex-1 border-y border-[#9b9486]/50" />
    </div>
  );
};

export const ThinkingDots = () => {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden="true" className="mt-6 flex h-3 justify-center gap-2.5">
      {[0, 1, 2].map((dot) => (
        <motion.span
          key={dot}
          className="h-[7px] w-[7px] bg-[#635d53]"
          style={{ borderRadius: `${45 + dot * 4}% ${55 - dot * 3}% 48% 52%` }}
          animate={{ opacity: reduced ? 0.65 : [0.15, 0.15, 0.8, 0.8, 0.15] }}
          transition={{
            duration: 2.85,
            repeat: Infinity,
            times: [0, 0.03 + dot * 0.19, 0.09 + dot * 0.19, 0.78, 1],
          }}
        />
      ))}
    </div>
  );
};

export default JournalThinkingOrnament;
