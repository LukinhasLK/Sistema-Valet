import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

/**
 * AuthContext = "estado global" de autenticação.
 *
 * Usar Context evita ter que passar o usuário/token de componente em
 * componente (prop drilling). Qualquer componente da aplicação pode
 * acessar o usuário logado com useAuth().
 */
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  // Ao carregar a página, recupera o usuário do localStorage
  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuario')
    if (usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo))
    }
    setCarregando(false)
  }, [])

  // Corrige bug do iOS bfcache: quando o usuário volta com gesto de swipe,
  // o Safari restaura a página com o estado antigo. Verificamos o token
  // e deslogamos se não existir mais.
  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted) {
        const token = localStorage.getItem('token')
        if (!token) {
          setUsuario(null)
        }
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha })

    // Salva no localStorage pra persistir entre reloads
    localStorage.setItem('token', data.token)
    localStorage.setItem('usuario', JSON.stringify(data))
    setUsuario(data)

    return data
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }

  const valor = {
    usuario,
    login,
    logout,
    carregando,
    isDono: usuario?.tipo === 'DONO',
    isGerente: usuario?.tipo === 'GERENTE',
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// Hook personalizado pra acessar o contexto
// Em qualquer componente: const { usuario, logout } = useAuth()
export function useAuth() {
  return useContext(AuthContext)
}
