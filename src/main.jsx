import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import { initNative } from '@/lib/nativeSetup'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
)

// Configura barra de estado y splash screen solo en el APK nativo (no-op en web)
initNative();