import React from 'react';

/**
 * Error Boundary specifically designed for wizard steps
 * Provides graceful error handling and recovery options
 */
class WizardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: Date.now().toString()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('WizardErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Report error to error tracking service if available
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.send('wizard-error', {
        error: error.toString(),
        errorInfo: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        step: this.props.step,
        formData: this.props.formData ? Object.keys(this.props.formData) : null
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleGoBack = () => {
    if (this.props.onGoBack) {
      this.props.onGoBack();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { step, stepName } = this.props;
      
      return (
        <div className="wizard-error-boundary">
          <div className="error-container">
            <div className="error-header">
              <h3>🚨 Something went wrong in {stepName || `Step ${step}`}</h3>
              <p className="error-subtitle">
                We're sorry, but there was an unexpected error. Here are your options:
              </p>
            </div>

            <div className="error-actions">
              <button
                onClick={this.handleRetry}
                className="btn btn-primary"
              >
                🔄 Try Again
              </button>
              
              {this.props.onGoBack && (
                <button
                  onClick={this.handleGoBack}
                  className="btn btn-secondary"
                >
                  ← Go Back
                </button>
              )}
              
              <button
                onClick={this.handleReload}
                className="btn btn-outline"
              >
                🔄 Reload Page
              </button>
            </div>

            {/* Development error details - Always show for debugging */}
            {this.state.error && (
              <details className="error-details" open>
                <summary>🔍 Developer Details</summary>
                <div className="error-stack">
                  <h4>Error:</h4>
                  <pre>{this.state.error.toString()}</pre>
                  
                  {this.state.errorInfo && (
                    <>
                      <h4>Component Stack:</h4>
                      <pre>{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="error-help">
              <h4>💡 Troubleshooting Tips:</h4>
              <ul>
                <li>Check that all required fields are properly filled</li>
                <li>Verify your internet connection is stable</li>
                <li>Try refreshing the page and starting over</li>
                <li>If the problem persists, contact support with Error ID: {this.state.errorId}</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WizardErrorBoundary;

