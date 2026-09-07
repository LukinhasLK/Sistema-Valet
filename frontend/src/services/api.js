import axios from 'axios'

/**
 * Cliente HTTP centralizado.
 *
 * Em vez de configurar headers e baseURL em cada chamada,
 * fazemos isso uma vez aqui.
 */
const api = axios.create({
  baseURL: '/api', // o proxy do Vite redireciona pro backend
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor: roda ANTES de cada requisição
// Adiciona automaticamente o token JWT no header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor: roda DEPOIS de cada resposta
// Se der 401 (token inválido/expirado), desloga o usuário
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
