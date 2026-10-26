import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initTracking, trackPageView } from './services/tracking';
import { captureUtmParams } from './utils/attribution';
import { normalizeLegacyHashUrl } from './utils/legacyHashRedirect';
import { shouldTrackPublicPageView } from './utils/sensitivePublicRoute';

const rootElement = document.getElementById('root');

if (rootElement) {
  normalizeLegacyHashUrl();
  captureUtmParams();
  initTracking();
  if (shouldTrackPublicPageView()) {
    trackPageView();
  }
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element");
}