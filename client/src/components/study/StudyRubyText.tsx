import { Fragment, useLayoutEffect, useRef, useState } from 'react';

import { parseRubySegments } from './studyTextUtils';

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

  fitFontSizeRef.current = fitFontSize;

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

        return (
          <ruby key={segment.key} className="study-ruby">
            {segment.base}
            <rt className={rtClassName}>{segment.reading}</rt>
          </ruby>
        );
      })}
    </Component>
  );
};

export default StudyRubyText;
