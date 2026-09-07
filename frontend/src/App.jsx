import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmModal'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ListaFichas from './pages/ListaFichas'
import NovaFicha from './pages/NovaFicha'
import DetalheFicha from './pages/DetalheFicha'
import Relatorios from './pages/Relatorios'
import Manobristas from './pages/Manobristas'
import Unidades from './pages/Unidades'
import Socios from './pages/Socios'
import DivisaoLucro from './pages/DivisaoLucro'
import Usuarios from './pages/Usuarios'
import Despesas from './pages/Despesas'
import RelatorioCarros from './pages/RelatorioCarros'

/**
 * App principal — define todas as rotas da aplicação.
 *
 * Estrutura:
 * - AuthProvider envolve tudo: estado de login disponível em qualquer lugar
 * - BrowserRouter ativa o roteamento
 * - PrivateRoute protege rotas que precisam de login
 *
 * Rotas:
 *   /login                 → tela de login
 *   /                      → redireciona pra dashboard
 *   /dashboard             → resumo
 *   /fichas                → lista de fichas
 *   /fichas/nova           → nova ficha
 *   /fichas/:id            → detalhe
 *   /relatorios            → relatórios mensais
 *   /manobristas           → cadastro
 *   /unidades              → cadastro (só dono)
 */
export default function App() {
  return (
    <ToastProvider>
    <ConfirmProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<Login />} />

          {/* Protegidas */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />

          <Route path="/fichas" element={
            <PrivateRoute><ListaFichas /></PrivateRoute>
          } />
          <Route path="/fichas/nova" element={
            <PrivateRoute><NovaFicha /></PrivateRoute>
          } />
          <Route path="/fichas/:id" element={
            <PrivateRoute><DetalheFicha /></PrivateRoute>
          } />

          <Route path="/relatorios" element={
            <PrivateRoute><Relatorios /></PrivateRoute>
          } />

          <Route path="/manobristas" element={
            <PrivateRoute><Manobristas /></PrivateRoute>
          } />

          <Route path="/unidades" element={
            <PrivateRoute><Unidades /></PrivateRoute>
          } />

          <Route path="/socios" element={
            <PrivateRoute><Socios /></PrivateRoute>
          } />

          <Route path="/divisao-lucro" element={
            <PrivateRoute><DivisaoLucro /></PrivateRoute>
          } />

          <Route path="/despesas" element={
            <PrivateRoute><Despesas /></PrivateRoute>
          } />

          <Route path="/carros" element={
            <PrivateRoute><RelatorioCarros /></PrivateRoute>
          } />

          <Route path="/usuarios" element={
            <PrivateRoute><Usuarios /></PrivateRoute>
          } />

          {/* Qualquer outra rota → dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ConfirmProvider>
    </ToastProvider>
  )
}
