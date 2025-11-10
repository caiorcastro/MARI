
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// This is the main entry point for the React application.

// Find the root DOM element where the React app will be mounted.
const rootElement = document.getElementById('root');
if (!rootElement) {
  // A failsafe to ensure the root element exists in index.html.
  throw new Error("Could not find root element to mount to");
}

// Create a React root for concurrent mode rendering.
const root = ReactDOM.createRoot(rootElement);

// Render the main App component into the root element.
// React.StrictMode is used to highlight potential problems in an application.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
