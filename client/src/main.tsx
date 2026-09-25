import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import { PrivyProvider } from './components/PrivyProvider'
import App from './App'
import AuthHydrationGate from './components/AuthHydrationGate'
import './i18n'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PrivyProvider>
          <AuthHydrationGate>
            <App />
          </AuthHydrationGate>
        </PrivyProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
