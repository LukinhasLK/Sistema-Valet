import { useEffect, useState, useRef } from 'react'
import { gsap } from 'gsap'
import api from '../services/api'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { Plus, Trash2, Save, X, Users } from 'lucide-react'

export default function Manobristas() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [manobristas, setManobristas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm] = useState(null)
  const headerRef   = useRef(null)
  const listaRef    = useRef(null)
  const modalRef    = useRef(null)
  const modalAberto = useRef(false)

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setForm(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function carregar() {
    try {
      const { data } = await api.get('/manobristas')
      setManobristas(data)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (carregando) return
    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
    )
    gsap.fromTo(listaRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.15 }
    )
    gsap.fromTo('.mano-linha',
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.06, delay: 0.3 }
    )
  }, [carregando])

  useEffect(() => {
    if (form && !modalAberto.current && modalRef.current) {
      modalAberto.current = true
      gsap.fromTo(modalRef.current,
        { scale: 0.92, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
      )
    }
    if (!form) modalAberto.current = false
  }, [form])

  function abrirNovo() {
    setForm({ nome: '', cpf: '', telefone: '', ativo: true })
  }

  async function salvar(e) {
    e.preventDefault()
    try {
      if (form.id) {
        await api.put(`/manobristas/${form.id}`, form)
      } else {
        await api.post('/manobristas', form)
      }
      toast(form.id ? 'Manobrista atualizado' : 'Manobrista cadastrado')
      setForm(null)
      carregar()
    } catch (err) {
      toast(err.response?.data?.mensagem || 'Erro ao salvar', 'error')
    }
  }

  async function excluir(id) {
    const ok = await confirm('Desativar este manobrista?')
    if (!ok) return
    try {
      await api.delete(`/manobristas/${id}`)
      toast('Manobrista desativado')
      carregar()
    } catch {
      toast('Erro ao desativar', 'error')
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div ref={headerRef} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Manobristas</h1>
          <p className="text-sm mt-1" style={{ color: '#555' }}>Cadastro dos manobristas</p>
        </div>
        <button onClick={abrirNovo}
          className="btn-red flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg">
          <Plus size={15} /> Novo manobrista
        </button>
      </div>

      {/* Modal */}
      {form && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div ref={modalRef} className="card-dark w-full max-w-md rounded-xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="px-5 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <h2 className="font-semibold text-white text-sm">
                {form.id ? 'Editar' : 'Novo'} manobrista
              </h2>
              <button onClick={() => setForm(null)}
                className="p-1 rounded transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-4">
              <Campo label="Nome *">
                <input type="text" required value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="input-dark text-sm" />
              </Campo>
              <Campo label="CPF">
                <input type="text" value={form.cpf || ''}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  className="input-dark text-sm" />
              </Campo>
              <Campo label="Telefone">
                <input type="text" value={form.telefone || ''}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="input-dark text-sm" />
              </Campo>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setForm(null)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ border: '1px solid var(--hp-border)', color: '#666' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent' }}>
                  Cancelar
                </button>
                <button type="submit"
                  className="btn-red flex items-center gap-2 px-4 py-2 text-sm rounded-lg">
                  <Save size={14} /> Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista */}
      <div ref={listaRef} className="card-dark overflow-hidden overflow-x-auto">
        {carregando ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 rounded-full mx-auto animate-spin"
              style={{ borderColor: 'var(--hp-border)', borderTopColor: 'var(--hp-red)' }} />
          </div>
        ) : manobristas.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
            <p className="text-sm mb-4" style={{ color: '#555' }}>Nenhum manobrista cadastrado</p>
            <button onClick={abrirNovo} className="text-sm font-medium" style={{ color: 'var(--hp-red)' }}>
              + Adicionar primeiro
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                <Th>Nome</Th>
                <Th>Telefone</Th>
                <Th>CPF</Th>
                <Th right>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {manobristas.map((m) => (
                <tr key={m.id} className="mano-linha"
                  style={{ borderBottom: '1px solid var(--hp-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-4 py-3 text-sm font-medium text-white">{m.nome}</td>
                  <Td>{m.telefone || '—'}</Td>
                  <Td>{m.cpf || '—'}</Td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setForm(m)}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{ color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.3)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,48,42,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Editar
                      </button>
                      <button onClick={() => excluir(m.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#555' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--hp-red)'; e.currentTarget.style.background = 'rgba(212,48,42,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Th({ children, right }) {
  return (
    <th className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`}
      style={{ color: '#555' }}>
      {children}
    </th>
  )
}

function Td({ children }) {
  return <td className="px-4 py-3 text-sm" style={{ color: '#888' }}>{children}</td>
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
