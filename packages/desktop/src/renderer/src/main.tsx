import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { RelayViewerPage } from './components/viewer/RelayViewerPage.js';
import { agenticApi } from './lib/agentic-api.js';
import { webAgenticApi } from './lib/web-agentic-api.js';
import { isTauriRuntime } from './lib/is-tauri.js';
import './index.css';
import { applyDefaultWallpaperTone } from './lib/wallpaper-tone.js';
import { applyUiTheme, getUiThemePreference } from './lib/ui-theme.js';

applyDefaultWallpaperTone();
applyUiTheme(getUiThemePreference());

window.agenticApi = isTauriRuntime() ? agenticApi : webAgenticApi;

const isViewerRoute =
  window.location.pathname === '/viewer' || window.location.pathname.endsWith('/viewer');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isViewerRoute ? <RelayViewerPage /> : <App />}
  </React.StrictMode>
);
