import { Component, Fragment, type ReactNode } from 'react';

interface StudyRouteErrorBoundaryProps {
  children: ReactNode;
  onBackToStudy: () => void;
}

interface StudyRouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryKey: number;
}

class StudyRouteErrorBoundary extends Component<
  StudyRouteErrorBoundaryProps,
  StudyRouteErrorBoundaryState
> {
  static getDerivedStateFromError(error: Error): Partial<StudyRouteErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  constructor(props: StudyRouteErrorBoundaryProps) {
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
    const { children, onBackToStudy } = this.props;
    const { hasError, error, retryKey } = this.state;

    if (hasError) {
      return (
        <section className="card retro-paper-panel mx-auto max-w-3xl space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-navy">Study hit a snag</h1>
            <p className="text-gray-600">
              Something went wrong in the study flow. You can retry this view or jump back to the
              main study dashboard.
            </p>
            {error?.message ? <p className="text-sm text-red-600">{error.message}</p> : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onBackToStudy}
              className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
            >
              Back to Study
            </button>
          </div>
        </section>
      );
    }

    return <Fragment key={retryKey}>{children}</Fragment>;
  }
}

export default StudyRouteErrorBoundary;
