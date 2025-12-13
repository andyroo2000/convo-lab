import { AlertTriangle, WifiOff, Lock, RefreshCw } from 'lucide-react';

interface ErrorDisplayProps {
  error: Error | string;
  onRetry?: () => void;
  title?: string;
  description?: string;
}

export default function ErrorDisplay({ error, onRetry, title, description }: ErrorDisplayProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  // Determine error type and icon
  const getErrorDetails = () => {
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('network') || lowerError.includes('offline') || lowerError.includes('fetch')) {
      return {
        icon: <WifiOff className="w-12 h-12 text-gray-400" />,
        title: 'Connection Error',
        description: 'Check your internet connection and try again',
        color: 'text-gray-700',
      };
    }

    if (lowerError.includes('unauthorized') || lowerError.includes('401') || lowerError.includes('forbidden') || lowerError.includes('403')) {
      return {
        icon: <Lock className="w-12 h-12 text-amber-500" />,
        title: 'Authentication Error',
        description: 'Please log in again to continue',
        color: 'text-amber-700',
      };
    }

    if (lowerError.includes('generation') || lowerError.includes('generate')) {
      return {
        icon: <RefreshCw className="w-12 h-12 text-indigo-500" />,
        title: 'Generation Failed',
        description: 'Content generation failed. Please try again',
        color: 'text-indigo-700',
      };
    }

    // Default error
    return {
      icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
      title: 'Error',
      description: 'Something went wrong. Please try again',
      color: 'text-red-700',
    };
  };

  const errorDetails = getErrorDetails();
  const displayTitle = title || errorDetails.title;
  const displayDescription = description || errorDetails.description;

  return (
    <div className="card text-center py-12 px-6">
      <div className="flex justify-center mb-4">
        {errorDetails.icon}
      </div>
      <h3 className={`text-xl font-semibold mb-2 ${errorDetails.color}`}>
        {displayTitle}
      </h3>
      <p className="text-gray-600 mb-4 max-w-md mx-auto">
        {displayDescription}
      </p>
      {errorMessage && (
        <p className="text-sm text-gray-500 mb-6 font-mono max-w-lg mx-auto break-words">
          {errorMessage}
        </p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-primary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
