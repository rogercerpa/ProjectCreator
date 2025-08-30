import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log('React index.js is loading...');

// Create root and render the app
const container = document.getElementById('root');
console.log('Root container found:', container);

if (container) {
  try {
    console.log('Creating React root...');
    const root = createRoot(container);
    console.log('React root created, rendering App...');
    
    // Clear any existing content
    container.innerHTML = '';
    
    root.render(<App />);
    console.log('App rendered successfully');
  } catch (error) {
    console.error('Error rendering React app:', error);
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
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      ">
        <h1>Error Loading Application</h1>
        <p>Failed to render React application</p>
        <p style="color: #ff6b6b; font-size: 0.9rem;">${error.message}</p>
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
  console.error('Root container not found!');
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    ">
      <h1>Critical Error</h1>
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
