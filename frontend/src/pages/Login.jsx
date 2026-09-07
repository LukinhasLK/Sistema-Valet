import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { gsap } from 'gsap'
import { AlertCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro]      = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate  = useNavigate()

  const cardRef   = useRef(null)
  const logoRef   = useRef(null)
  const formRef   = useRef(null)

  useEffect(() => {
    const tl = gsap.timeline()
    tl.fromTo(cardRef.current,
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }
    )
    .fromTo(logoRef.current,
      { scale: 0.7, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' },
      '-=0.3'
    )
    .fromTo('.login-field',
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: 'power2.out' },
      '-=0.2'
    )
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    // Shake animation on repeated try
    try {
      await login(email, senha)
      // Flash verde antes de navegar
      gsap.to(cardRef.current, {
        boxShadow: '0 0 40px rgba(16,185,129,0.4)', duration: 0.3,
        onComplete: () => navigate('/dashboard'),
      })
    } catch (err) {
      const msg = err.response?.data?.mensagem || 'Email ou senha inválidos'
      setErro(msg)
      // Shake no card
      gsap.fromTo(cardRef.current,
        { x: -8 },
        { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' }
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--hp-bg)' }}
    >
      {/* Glow de fundo */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(212,48,42,0.07) 0%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        }}
      />

      <div
        ref={cardRef}
        className="relative w-full max-w-sm rounded-2xl p-8"
        style={{
          background: 'var(--hp-card)',
          border: '1px solid var(--hp-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          opacity: 1,
        }}
      >
        {/* Logo */}
        <div ref={logoRef} className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <img
              src="/logo.png"
              alt="Hitman Park"
              className="h-20 w-20 object-contain"
              onError={(e) => {
                e.target.replaceWith(Object.assign(document.createElement('div'), {
                  innerHTML: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect width="64" height="64" rx="12" fill="#1a1a1a"/>
                    <path d="M10 38 Q20 22 32 26 Q44 30 54 20" stroke="#D4302A" strokeWidth="3" fill="none" strokeLinecap="round"/>
                    <ellipse cx="20" cy="40" rx="5" ry="3" fill="#D4302A" opacity="0.7"/>
                    <ellipse cx="44" cy="36" rx="5" ry="3" fill="#D4302A" opacity="0.7"/>
                  </svg>`,
                }))
              }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wider">HITMAN PARK</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--hp-red)' }}>Gestão de manobristas</p>
        </div>

        {/* Erro */}
        {erro && (
          <div className="mb-4 p-3 rounded-lg flex items-start gap-2 text-sm"
            style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="login-field">
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-dark"
              placeholder="seu@email.com"
            />
          </div>

          <div className="login-field">
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#888' }}>
              SENHA
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="input-dark"
              placeholder="••••••"
            />
          </div>

          <div className="login-field pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-red w-full py-3"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
