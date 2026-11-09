import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './index.css'
import App from './App.jsx'
import RouteErrorBoundary from './components/RouteErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouteErrorBoundary scope="app">
      <App />
    </RouteErrorBoundary>
  </StrictMode>,
)
