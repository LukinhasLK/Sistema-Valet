import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
export function useToast() { return useContext(ToastContext) }

const ESTILOS = {
  success: { border: 'rgba(74,222,128,0.3)',  cor: '#4ade80', Icone: CheckCircle },
  error:   { border: 'rgba(212,48,42,0.4)',   cor: '#ff6b6b', Icone: XCircle   },
  info:    { border: 'rgba(96,165,250,0.3)',  cor: '#60a5fa', Icone: Info      },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const contador = useRef(0)

  const toast = useCallback((mensagem, tipo = 'success') => {
    const id = ++contador.current
    setToasts(p => [...p, { id, mensagem, tipo }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }, [])

  function remover(id) { setToasts(p => p.filter(t => t.id !== id)) }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'flex-end', pointerEvents: 'none',
      }}>
        {toasts.map(t => <ToastItem key={t.id} {...t} onClose={() => remover(t.id)} />)}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ mensagem, tipo, onClose }) {
  const el = useRef(null)

  useEffect(() => {
    gsap.fromTo(el.current,
      { x: 50, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.32, ease: 'back.out(1.4)' }
    )
  }, [])

  const { border, cor, Icone } = ESTILOS[tipo] || ESTILOS.info

  return (
    <div ref={el} style={{
      pointerEvents: 'all',
      background: '#111',
      border: `1px solid ${border}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 10,
      padding: '11px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minWidth: 260,
      maxWidth: 380,
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    }}>
      <Icone size={15} style={{ color: cor, flexShrink: 0 }} />
      <span style={{ color: '#ddd', fontSize: 13, flex: 1, lineHeight: 1.4 }}>{mensagem}</span>
      <button onClick={onClose} style={{ color: '#444', cursor: 'pointer', flexShrink: 0, background: 'none', border: 'none' }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = '#444'}>
        <X size={13} />
      </button>
    </div>
  )
}
