import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure newest version is always loaded and stale service worker/caches are purged
(function ensureLatestVersion() {
  try {
    const LAST_BUILD_KEY = 'stereocraft_build_time';
    const lastBuild = localStorage.getItem(LAST_BUILD_KEY);
    
    // Store current build time
    if (typeof __BUILD_TIME__ !== 'undefined') {
      if (lastBuild && lastBuild !== __BUILD_TIME__) {
        // Build changed, clear browser storage caches and unregister any legacy service workers
        if ('caches' in window) {
          caches.keys().then((names) => {
            for (const name of names) caches.delete(name);
          });
        }
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (const reg of registrations) reg.unregister();
          });
        }
      }
      localStorage.setItem(LAST_BUILD_KEY, __BUILD_TIME__);
    }
  } catch {
    // Ignore storage errors in restrictive environments
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

