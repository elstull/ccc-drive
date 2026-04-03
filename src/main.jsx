import React from 'react';
import ReactDOM from 'react-dom/client';

// Toggle between demo mode (user selector) and real auth
// Set VITE_AUTH_MODE=real in env vars to enable Supabase Auth
const useAuth = import.meta.env.VITE_AUTH_MODE === 'real';

async function loadApp() {
  const { default: App } = useAuth
    ? await import('./AppWithAuth.jsx')
    : await import('./App.jsx');
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}

loadApp();
