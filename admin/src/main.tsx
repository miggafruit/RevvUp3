import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSentry, Sentry } from './config/sentry';

initSentry();

const ErrorFallback = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px', fontFamily: 'sans-serif' }}>
    <h2>Something went wrong</h2>
    <p style={{ color: '#888' }}>We've been notified. Try reloading the page.</p>
    <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer' }}>
      Reload
    </button>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
