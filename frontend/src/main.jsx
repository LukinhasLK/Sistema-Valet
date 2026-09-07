import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Ponto de entrada da aplicação
// Pega o div #root do index.html e renderiza o App lá dentro
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
