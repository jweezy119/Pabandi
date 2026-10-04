import './polyfills';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';
import AuthHydrationGate from './components/AuthHydrationGate';
import './i18n';
// Root boundary. Deliberately the OUTERMOST element inside StrictMode: it has to sit above
// the router, the auth gate and every provider, because a throw in any of those — or in any of
// the ~258 lazy route chunks — currently unmounts the entire tree and leaves a blank page with
// nothing clickable and no way back.
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './index.css';
import { watchForStaleBuild, buildSha } from './utils/staleTab';

// Notice when this tab is running an older build than the server is serving, and reload.
//
// A customer reported a bug that had been fixed and deployed, and their console named a
// bundle hash that no longer existed: the tab had been open across several deploys.
// Firebase rewrites `**` to index.html, so a chunk that is gone comes back as HTML with a
// 200 rather than a 404, and nothing prompted a reload. See utils/staleTab.ts.
watchForStaleBuild();

// Record the build on <html data-build>.
//
// Two reasons. It is the quickest answer to "which version are you running?" when
// debugging a report — the bundle hash is unreadable, a short sha is not. And it keeps
// the compiled-in sha in the bundle: exported but unimported, Rollup tree-shook it, so
// the smoke check's "was this artifact built from the expected commit" assertion had
// nothing to find and would have failed forever.
document.documentElement.setAttribute('data-build', buildSha);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthHydrationGate>
            <App />
          </AuthHydrationGate>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
