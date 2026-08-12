import { useEffect } from 'react';
import { shouldIgnoreGlobalShortcut } from '../../../lib/keyboardShortcuts';

interface UseToolArrowKeyNavigationOptions {
  onNext: () => void;
  onPrevious: () => void;
  isEnabled?: boolean;
}

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
      if (shouldIgnoreGlobalShortcut(event)) return;

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
