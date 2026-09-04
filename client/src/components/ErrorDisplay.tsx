import { AlertTriangle, WifiOff, Lock, RefreshCw, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

type ErrorKind = 'connection' | 'auth' | 'generation' | 'generic';

interface ErrorDetails {
  icon: LucideIcon;
  iconClassName: string;
  color: string;
}

const ERROR_PATTERNS: Array<[Exclude<ErrorKind, 'generic'>, RegExp]> = [
  ['connection', /network|offline|fetch/i],
  ['auth', /unauthorized|401|forbidden|403/i],
  ['generation', /generation|generate/i],
];

const ERROR_DETAILS: Record<ErrorKind, ErrorDetails> = {
  connection: { icon: WifiOff, iconClassName: 'text-gray-400', color: 'text-gray-700' },
  auth: { icon: Lock, iconClassName: 'text-amber-500', color: 'text-amber-700' },
  generation: { icon: RefreshCw, iconClassName: 'text-indigo-500', color: 'text-indigo-700' },
  generic: { icon: AlertTriangle, iconClassName: 'text-red-500', color: 'text-red-700' },
};

function classifyError(errorMessage: string): ErrorKind {
  return ERROR_PATTERNS.find(([, pattern]) => pattern.test(errorMessage))?.[0] ?? 'generic';
}

const ErrorDisplay = ({ error, onRetry, title, description }: ErrorDisplayProps) => {
  const { t } = useTranslation(['errors']);
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorKind = classifyError(errorMessage);
  const errorDetails = ERROR_DETAILS[errorKind];
  const ErrorIcon = errorDetails.icon;
  const displayTitle = title || t(`errors:display.${errorKind}.title`);
  const displayDescription = description || t(`errors:display.${errorKind}.description`);

  return (
    <div className="card text-center py-12 px-6">
      <div className="flex justify-center mb-4">
        <ErrorIcon className={`w-12 h-12 ${errorDetails.iconClassName}`} />
      </div>
      <h3 className={`text-xl font-semibold mb-2 ${errorDetails.color}`}>{displayTitle}</h3>
      <p className="text-gray-600 mb-4 max-w-md mx-auto">{displayDescription}</p>
      {errorMessage && (
        <p className="text-sm text-gray-500 mb-6 font-mono max-w-lg mx-auto break-words">
          {errorMessage}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-primary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('errors:display.tryAgain')}
        </button>
      )}
    </div>
  );
};

export default ErrorDisplay;
