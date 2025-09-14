import React from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './AppRouter.jsx'
import './index.css'
import { Toaster } from 'sonner'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppRouter />
    <Toaster richColors expand={false} position="top-center" />
  </React.StrictMode>
)