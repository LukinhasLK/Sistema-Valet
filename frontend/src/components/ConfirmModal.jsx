import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { AlertTriangle } from 'lucide-react'

const ConfirmContext = createContext(null)
export function useConfirm() { return useContext(ConfirmContext) }

export function ConfirmProvider({ children }) {
  const [estado, setEstado] = useState(null)
  const modalRef = useRef(null)

  function pedir(mensagem) {
    return new Promise(resolve => setEstado({ mensagem, resolve }))
  }

  useEffect(() => {
    if (estado && modalRef.current) {
      gsap.fromTo(modalRef.current,
        { scale: 0.88, opacity: 0, y: 16 },
        { scale: 1, opacity: 1, y: 0, duration: 0.28, ease: 'back.out(1.5)' }
      )
    }
  }, [estado])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && estado) responder(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [estado])

  function responder(sim) {
    estado?.resolve(sim)
    setEstado(null)
  }

  return (
    <ConfirmContext.Provider value={pedir}>
      {children}
      {estado && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', zIndex: 9998 }}
          onClick={e => { if (e.target === e.currentTarget) responder(false) }}>
          <div ref={modalRef} className="card-dark rounded-xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.8)', border: '1px solid rgba(212,48,42,0.25)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.2)' }}>
                <AlertTriangle size={16} style={{ color: 'var(--hp-red)' }} />
              </div>
              <p className="text-sm font-semibold text-white">Confirmar ação</p>
            </div>
            <p className="text-sm mb-6" style={{ color: '#aaa', lineHeight: 1.6 }}>{estado.mensagem}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => responder(false)}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ border: '1px solid var(--hp-border)', color: '#666' }}
                onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.color='#666'; e.currentTarget.style.background='transparent' }}>
                Cancelar
              </button>
              <button onClick={() => responder(true)}
                className="btn-red px-4 py-2 text-sm rounded-lg">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
