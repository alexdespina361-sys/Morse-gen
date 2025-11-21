
import React from 'react';
import ReactDOM from 'react-dom/client';

// In the browser standalone environment, we grab App from the window object
// where it was attached by App.tsx
const App = (window as any).App;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
