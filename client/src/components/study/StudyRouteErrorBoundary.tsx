import { Component, Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StudyRouteErrorBoundaryBaseProps {
  children: ReactNode;
  onBackToStudy: () => void;
}

interface StudyRouteErrorBoundaryImplProps extends StudyRouteErrorBoundaryBaseProps {
  backLabel: string;
  description: string;
  retryLabel: string;
  title: string;
}

interface StudyRouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

class StudyRouteErrorBoundaryImpl extends Component<
  StudyRouteErrorBoundaryImplProps,
  StudyRouteErrorBoundaryState
> {
  static getDerivedStateFromError(error: Error): Partial<StudyRouteErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  constructor(props: StudyRouteErrorBoundaryImplProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryKey: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('StudyRouteErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState((current) => ({
      hasError: false,
      error: null,
      retryKey: current.retryKey + 1,
    }));
  };

  render() {
    const { backLabel, children, description, onBackToStudy, retryLabel, title } = this.props;
    const { hasError, error, retryKey } = this.state;

    if (hasError) {
      return (
        <section className="card retro-paper-panel mx-auto max-w-3xl space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-navy">{title}</h1>
            <p className="text-gray-600">{description}</p>
            {error?.message ? <p className="text-sm text-red-600">{error.message}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              {retryLabel}
            </button>
            <button
              type="button"
              onClick={onBackToStudy}
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
            >
              {backLabel}
            </button>
          </div>
        </section>
      );
    }

    return <Fragment key={retryKey}>{children}</Fragment>;
  }
}

const StudyRouteErrorBoundary = ({ children, onBackToStudy }: StudyRouteErrorBoundaryBaseProps) => {
  const { t } = useTranslation('study');

  return (
    <StudyRouteErrorBoundaryImpl
      onBackToStudy={onBackToStudy}
      title={t('routeError.title')}
      description={t('routeError.description')}
      retryLabel={t('routeError.retry')}
      backLabel={t('routeError.back')}
    >
      {children}
    </StudyRouteErrorBoundaryImpl>
  );
};

export default StudyRouteErrorBoundary;
