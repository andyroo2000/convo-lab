import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useKnownKanjiContext } from '../../contexts/KnownKanjiContext';
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
  const fitFontSizeRef = useRef<number | null>(null);
  const [fitFontSize, setFitFontSize] = useState<number | null>(null);
  const [revealedSegments, setRevealedSegments] = useState<ReadonlySet<string>>(new Set());
  const { active: knownKanjiActive, knownKanji } = useKnownKanjiContext();

  fitFontSizeRef.current = fitFontSize;

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

    let frameId = 0;

    const fit = () => {
      const scheduleFrame =
        typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : (callback: FrameRequestCallback) =>
              window.setTimeout(() => {
                callback(performance.now());
              }, 0);
      frameId = scheduleFrame(() => {
        const currentElement = elementRef.current;
        if (!currentElement) return;

        const availableWidth = currentElement.clientWidth;
        const previousInlineFontSize = currentElement.style.fontSize;
        currentElement.style.fontSize = '';
        const requiredWidthAtBase = currentElement.scrollWidth;
        const baseFontSize = Number.parseFloat(window.getComputedStyle(currentElement).fontSize);
        currentElement.style.fontSize = previousInlineFontSize;

        if (
          !availableWidth ||
          !requiredWidthAtBase ||
          !baseFontSize ||
          requiredWidthAtBase <= availableWidth
        ) {
          if (fitFontSizeRef.current !== null) setFitFontSize(null);
          return;
        }

        const fittedFontSize = Math.max(
          minFontSizePx,
          Math.floor(baseFontSize * (availableWidth / requiredWidthAtBase))
        );
        const nextFitFontSize = fittedFontSize < baseFontSize ? fittedFontSize : null;
        if (fitFontSizeRef.current !== nextFitFontSize) {
          setFitFontSize(nextFitFontSize);
        }
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
      const cancelFrame =
        typeof window.cancelAnimationFrame === 'function'
          ? window.cancelAnimationFrame.bind(window)
          : window.clearTimeout.bind(window);
      cancelFrame(frameId);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', fit);
      }
    };
  }, [autoFitSingleLine, minFontSizePx, text]);

  if (!text) {
    return null;
  }

  const segments = parseRubySegments(text);

  return (
    <Component
      ref={setElementRef}
      className={className}
      data-testid={testId}
      style={fitFontSize ? { fontSize: `${fitFontSize}px` } : undefined}
    >
      {segments.map((segment) => {
        if (segment.kind === 'text') {
          return <Fragment key={segment.key}>{segment.text}</Fragment>;
        }

        const base = segment.base ?? '';
        const kanji = Array.from(base).filter((character) => HAN_CHARACTER_PATTERN.test(character));
        const readingHidden =
          knownKanjiActive &&
          kanji.length > 0 &&
          kanji.every((character) => knownKanji.has(character)) &&
          !revealedSegments.has(segment.key);
        const revealReading = () => {
          if (!readingHidden) return;
          setRevealedSegments((current) => new Set(current).add(segment.key));
        };

        return (
          <span
            key={segment.key}
            className={readingHidden ? 'cursor-pointer' : undefined}
            data-known-furigana-hidden={readingHidden || undefined}
            onClick={(event) => {
              if (!readingHidden) return;
              event.stopPropagation();
              revealReading();
            }}
            onKeyDown={(event) => {
              if (!readingHidden || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              event.stopPropagation();
              revealReading();
            }}
            role={readingHidden ? 'button' : undefined}
            tabIndex={readingHidden ? 0 : undefined}
            title={readingHidden ? 'Reveal reading' : undefined}
          >
            <ruby className="study-ruby">
              {base}
              <rt
                aria-hidden={readingHidden || undefined}
                className={`${rtClassName ?? ''} ${readingHidden ? 'opacity-0' : ''}`.trim()}
              >
                {segment.reading ?? ''}
              </rt>
            </ruby>
          </span>
        );
      })}
    </Component>
  );
};

export default StudyRubyText;
