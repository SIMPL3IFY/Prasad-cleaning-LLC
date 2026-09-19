import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* SCRUM 172: Makes the restored login session available throughout the application. */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)
