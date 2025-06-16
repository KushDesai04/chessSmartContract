import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SecretJsContextProvider } from './secretjs/SecretJsContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SecretJsContextProvider>
      <App />
    </SecretJsContextProvider>
  </StrictMode>,
)
