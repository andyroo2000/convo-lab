import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { withTranslation, WithTranslation } from 'react-i18next';

interface Props extends WithTranslation {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  static isChunkLoadError(error: Error): boolean {
    const chunkFailedMessage =
      /Failed to fetch dynamically imported module|Loading chunk.*failed|ChunkLoadError/i;
    return chunkFailedMessage.test(error.message) || chunkFailedMessage.test(error.name);
  }

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // If this is a chunk loading error, it's likely due to a deployment
    // Prompt user to reload to get the latest version
    if (ErrorBoundary.isChunkLoadError(error)) {
      console.warn('Chunk loading error detected - likely due to new deployment');
    }
  }

  handleReset = () => {
    const { error } = this.state;
    // If it's a chunk loading error, do a hard reload to get fresh files
    if (error && ErrorBoundary.isChunkLoadError(error)) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  // eslint-disable-next-line class-methods-use-this
  handleGoToLibrary = () => {
    window.location.assign('/app/library');
  };

  render() {
    const { t, children } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      const isChunkError = error && ErrorBoundary.isChunkLoadError(error);
      const title = isChunkError ? 'Update Available' : t('errors:boundary.title');
      const message = isChunkError
        ? 'A new version of ConvoLab is available. Please reload to get the latest updates.'
        : error?.message || t('errors:boundary.defaultMessage');
      const buttonText = isChunkError ? 'Reload Now' : t('errors:boundary.tryAgain');

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {buttonText}
              </button>
              {!isChunkError && (
                <button
                  type="button"
                  onClick={this.handleGoToLibrary}
                  className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t('errors:boundary.goToLibrary')}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

const ErrorBoundaryWithTranslation = withTranslation()(ErrorBoundary);
ErrorBoundaryWithTranslation.displayName = 'ErrorBoundaryWithTranslation';

export default ErrorBoundaryWithTranslation;
