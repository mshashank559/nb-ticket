import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import './App.css';
import AppEnhanced from './AppEnhanced';

// Configure API Base URL in production (e.g. Vercel pointing to AWS EC2 backend)
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
if (API_BASE) {
  const originalFetch = window.fetch;
  window.fetch = function (resource, init) {
    if (typeof resource === 'string' && resource.startsWith('/api')) {
      resource = `${API_BASE}${resource}`;
    }
    return originalFetch.call(this, resource, init);
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppEnhanced />
    </QueryClientProvider>
  </React.StrictMode>
);
