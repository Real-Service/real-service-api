import React from 'react'
import ReactDOM from 'react-dom/client'
import DevelopmentPreview from './preview-app'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DevelopmentPreview />
  </React.StrictMode>,
)