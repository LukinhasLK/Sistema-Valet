import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from './Layout'

/**
 * "Wrapper" pra rotas que exigem login.
 *
 * Se o usuário não estiver logado, manda pra página de login.
 * Se estiver logado, mostra a página dentro do Layout.
 */
export default function PrivateRoute({ children }) {
  const { usuario, carregando } = useAuth()

  // Enquanto verifica o localStorage, mostra um loading
  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Carregando...</div>
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}
