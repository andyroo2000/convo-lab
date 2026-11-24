import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useKnownKanjiContext } from '../../contexts/KnownKanjiContext';
import { studyReadingSize } from './studyReadingSize';
import { parseRubySegments } from './studyTextUtils';

const HAN_CHARACTER_PATTERN = /\p{Unified_Ideograph}/u;

interface StudyRubyTextProps {
  autoFitSingleLine?: boolean;
  as?: 'span' | 'div' | 'p';
  className?: string;
  minFontSizePx?: number;
  rtClassName?: string;
  text?: string | null;
  testId?: string;
}

function measuredFontSize(element: HTMLElement, minimum: number): number | null {
  const availableWidth = element.clientWidth;
  const { style } = element;
  const previousSize = style.fontSize;
  style.fontSize = '';
  const requiredWidth = element.scrollWidth;
  const baseSize = Number.parseFloat(window.getComputedStyle(element).fontSize);
  style.fontSize = previousSize;

  if (availableWidth === 0 || requiredWidth <= availableWidth) return null;
  const fittedSize = Math.max(minimum, Math.floor(baseSize * (availableWidth / requiredWidth)));
  return fittedSize < baseSize ? fittedSize : null;
}

function observeTextWidth(element: HTMLElement, measure: () => void) {
  const scheduleFrame =
    typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0);
  const cancelFrame =
    typeof window.cancelAnimationFrame === 'function'
      ? window.cancelAnimationFrame.bind(window)
      : window.clearTimeout.bind(window);
  let frameId: number | undefined;
  const fit = () => {
    if (frameId !== undefined) return;
    frameId = scheduleFrame(() => {
      frameId = undefined;
      measure();
    });
  };

  fit();

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
  if (resizeObserver) {
    resizeObserver.observe(element);
  } else {
    window.addEventListener('resize', fit);
  }

  return () => {
    if (frameId !== undefined) cancelFrame(frameId);
    if (resizeObserver) {
      resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', fit);
    }
  };
}

function hasOnlyKnownKanji(word: string, knownKanji: ReadonlySet<string>) {
  const kanji = Array.from(word).filter((character) => HAN_CHARACTER_PATTERN.test(character));
  return kanji.length > 0 && kanji.every((character) => knownKanji.has(character));
}

interface StudyRubyReadingProps {
  base: string;
  reading: string;
  hidden: boolean;
  rtClassName?: string;
  onReveal: () => void;
}

const StudyRubyReading = ({
  base,
  reading,
  hidden,
  rtClassName = '',
  onReveal,
}: StudyRubyReadingProps) => {
  const ruby = (
    <ruby className="study-ruby">
      {base}
      <rt
        aria-hidden={hidden || undefined}
        className={`${rtClassName} ${hidden ? 'opacity-0' : ''}`.trim()}
      >
        {reading}
      </rt>
    </ruby>
  );
  if (!hidden) return <span>{ruby}</span>;
  return (
    <span
      className="cursor-pointer"
      data-known-furigana-hidden
      role="button"
      tabIndex={0}
      title="Reveal reading"
      onClick={(event) => {
        event.stopPropagation();
        onReveal();
      }}
      onKeyDown={(event) => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        onReveal();
      }}
    >
      {ruby}
    </span>
  );
};

const StudyRubyText = ({
  autoFitSingleLine = false,
  as: Component = 'span',
  className,
  minFontSizePx = 18,
  rtClassName,
  text,
  testId,
}: StudyRubyTextProps) => {
  const elementRef = useRef<HTMLElement | null>(null);
  const [fitFontSize, setFitFontSize] = useState<number | null>(null);
  const [revealedSegments, setRevealedSegments] = useState<ReadonlySet<string>>(new Set());
  const { active: knownKanjiActive, knownKanji } = useKnownKanjiContext();

  useEffect(() => {
    setRevealedSegments(new Set());
  }, [text]);

  const setElementRef = (node: HTMLElement | null) => {
    elementRef.current = node;
  };

  useLayoutEffect(() => {
    if (!autoFitSingleLine || !text) {
      setFitFontSize(null);
      return undefined;
    }

    const element = elementRef.current;
    if (!element) return undefined;

    return observeTextWidth(element, () =>
      setFitFontSize(measuredFontSize(element, minFontSizePx))
    );
  }, [autoFitSingleLine, minFontSizePx, text]);

  if (!text) {
    return null;
  }

  const segments = parseRubySegments(text);

  return (
    <Component
      ref={setElementRef}
      className={className}
      data-reading-size={studyReadingSize(
        segments.map((segment) => segment.base ?? segment.text).join('')
      )}
      data-testid={testId}
      style={fitFontSize ? { fontSize: `${fitFontSize}px` } : undefined}
    >
      {segments.map((segment) => {
        if (segment.kind === 'text') {
          return <Fragment key={segment.key}>{segment.text}</Fragment>;
        }

        const base = segment.base ?? '';
        const readingHidden =
          knownKanjiActive &&
          !revealedSegments.has(segment.key) &&
          hasOnlyKnownKanji(base, knownKanji);
        const revealReading = () => {
          setRevealedSegments((current) => new Set(current).add(segment.key));
        };

        return (
          <StudyRubyReading
            key={segment.key}
            base={base}
            reading={segment.reading ?? ''}
            hidden={readingHidden}
            rtClassName={rtClassName}
            onReveal={revealReading}
          />
        );
      })}
    </Component>
  );
};

export default StudyRubyText;
