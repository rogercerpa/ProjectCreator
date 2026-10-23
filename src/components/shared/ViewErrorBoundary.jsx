import React from 'react';
import errorReportingService from '../../services/ErrorReportingService';

/**
 * Keeps a crash in one page from blanking the whole app. Give it `key={viewName}`
 * so navigating to another page clears the error state.
 */
export default class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  async componentDidCatch(error, errorInfo) {
    const errorId = await errorReportingService.reportError({
      category: 'ui',
      userMessage: `The "${this.props.viewName}" page crashed.`,
      error,
      context: { view: this.props.viewName, componentStack: errorInfo?.componentStack }
    });
    this.setState({ errorId });
  }

  render() {
    const { error, errorId } = this.state;
    if (!error) return this.props.children;

    const isChunkLoadError = /Failed to fetch dynamically imported module|Loading chunk/i.test(error.message || '');

    return (
      <div role="alert" className="mx-auto mt-16 max-w-xl rounded-2xl border border-error-200 bg-error-50 p-8 text-center dark:border-error-800 dark:bg-error-900/20">
        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
          {isChunkLoadError ? 'This page could not be loaded' : 'Something went wrong on this page'}
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          {error.message || 'An unexpected error occurred.'}
          {errorId && <span className="mt-2 block text-xs text-gray-500">Saved to Settings → Error Report ({errorId}).</span>}
        </p>
        <div className="flex justify-center gap-3">
          {this.props.onGoHome && (
            <button type="button" className="btn btn-secondary" onClick={this.props.onGoHome}>
              Go to Home
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
