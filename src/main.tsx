import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Fontes auto-hospedadas (bundladas pelo Vite) — sem dependência do CDN do Google
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/jetbrains-mono';
import './styles/tokens.css';
import './styles/global.css';
import './styles/buttons.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
