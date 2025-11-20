import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tailwind.css';
import { ThemeProvider } from './contexts/ThemeContext';

console.log('=== REACT INDEX.JS STARTING ===');
console.log('React version:', React.version);
console.log('createRoot available:', typeof createRoot);

// Lazy load the App component with error boundary
const App = React.lazy(() => {
  console.log('=== LOADING APP COMPONENT ===');
  return import('./App').then(module => {
    console.log('App component loaded successfully:', module);
    return module;
  }).catch(error => {
    console.error('=== FAILED TO LOAD APP COMPONENT ===', error);
    throw error;
  });
});

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    console.log('=== ERROR BOUNDARY CONSTRUCTOR ===');
  }

  static getDerivedStateFromError(error) {
    console.log('=== ERROR BOUNDARY getDerivedStateFromError ===', error);
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    console.log('=== ERROR BOUNDARY RENDER ===', this.state.hasError);
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'white',
          textAlign: 'center',
          background: 'var(--brand-gradient)',
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          padding: '2rem'
        }}>
          <h1>❌ Application Error</h1>
          <p>Something went wrong in the React application.</p>
          <details style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Error Details</summary>
            <pre style={{ fontSize: '0.8rem', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading fallback component
function LoadingFallback() {
  console.log('=== LOADING FALLBACK RENDER ===');
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'white',
      textAlign: 'center',
      background: 'var(--brand-gradient)',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <h1>Project Creator</h1>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid rgba(255,255,255,0.3)',
        borderTop: '4px solid white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '2rem 0'
      }}></div>
      <p>Loading React components...</p>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
}

// Create root and render the app
console.log('=== LOOKING FOR ROOT CONTAINER ===');
const container = document.getElementById('root');
console.log('Root container found:', container);
console.log('Container innerHTML length:', container ? container.innerHTML.length : 'N/A');

if (container) {
  try {
    console.log('=== CREATING REACT ROOT ===');
    const root = createRoot(container);
    console.log('React root created successfully:', root);
    console.log('=== RENDERING APP WITH ERROR BOUNDARY ===');
    
    // Clear any existing content
    container.innerHTML = '';
    console.log('Container cleared, innerHTML length:', container.innerHTML.length);
    
    root.render(
      <ErrorBoundary>
        <ThemeProvider>
          <React.Suspense fallback={<LoadingFallback />}>
            <App />
          </React.Suspense>
        </ThemeProvider>
      </ErrorBoundary>
    );
    console.log('=== APP RENDERED SUCCESSFULLY ===');
  } catch (error) {
    console.error('=== FATAL ERROR RENDERING REACT APP ===', error);
    // Show error message to user
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        color: white;
        text-align: center;
        background: var(--brand-gradient);
        padding: 2rem;
      ">
        <h1>❌ Fatal Error</h1>
        <p>Failed to initialize React application</p>
        <div style="color: #ff6b6b; font-size: 0.9rem; max-width: 80%; word-wrap: break-word; margin: 1rem 0; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 4px;">
          <strong>Error:</strong> ${error.message}<br/><br/>
          <strong>Stack:</strong><br/>
          <pre style="font-size: 0.8rem; text-align: left; white-space: pre-wrap;">${error.stack}</pre>
        </div>
        <button onclick="location.reload()" style="
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          border-radius: 4px;
          cursor: pointer;
        ">Reload Application</button>
      </div>
    `;
  }
} else {
  console.error('=== ROOT CONTAINER NOT FOUND ===');
  // Show error message
  document.body.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: white;
      text-align: center;
      background: var(--brand-gradient);
    ">
      <h1>❌ Critical Error</h1>
      <p>Root container element not found</p>
      <button onclick="location.reload()" style="
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        border-radius: 4px;
        cursor: pointer;
      ">Reload Application</button>
    </div>
  `;
}

console.log('=== REACT INDEX.JS COMPLETED ===');
