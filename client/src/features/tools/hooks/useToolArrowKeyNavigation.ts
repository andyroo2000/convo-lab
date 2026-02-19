import { useEffect } from 'react';

interface UseToolArrowKeyNavigationOptions {
  onNext: () => void;
  onPrevious: () => void;
  isEnabled?: boolean;
}

const isInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const { tagName } = target;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.closest('[contenteditable="true"]') !== null;
};

const useToolArrowKeyNavigation = ({
  onNext,
  onPrevious,
  isEnabled = true,
}: UseToolArrowKeyNavigationOptions): void => {
  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled, onNext, onPrevious]);
};

export default useToolArrowKeyNavigation;
