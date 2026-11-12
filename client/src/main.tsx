import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient,QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { restoreSession } from './lib'
const query=new QueryClient()
restoreSession().catch(() => undefined).finally(() => ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={query}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></React.StrictMode>))
