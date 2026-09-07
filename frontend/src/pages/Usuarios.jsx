import { useEffect, useState, useRef } from 'react'
import { gsap } from 'gsap'
import api from '../services/api'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { Plus, Trash2, Save, X, UserCog, KeyRound } from 'lucide-react'

export default function Usuarios() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [usuarios, setUsuarios]   = useState([])
  const [unidades, setUnidades]   = useState([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm]           = useState(null)
  const [formSenha, setFormSenha] = useState(null) // { id, nome }

  const headerRef    = useRef(null)
  const listaRef     = useRef(null)
  const modalRef     = useRef(null)
  const modalSenhaRef = useRef(null)
  const modalAberto  = useRef(false)
  const modalSenhaAberto = useRef(false)

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setForm(null); setFormSenha(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function carregar() {
    try {
      const [u, un] = await Promise.all([api.get('/usuarios'), api.get('/unidades')])
      setUsuarios(u.data)
      setUnidades(un.data)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (carregando) return
    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' })
    gsap.fromTo(listaRef.current,
      { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.15 })
    gsap.fromTo('.usr-linha',
      { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.06, delay: 0.3 })
  }, [carregando])

  useEffect(() => {
    if (form && !modalAberto.current && modalRef.current) {
      modalAberto.current = true
      gsap.fromTo(modalRef.current,
        { scale: 0.92, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' })
    }
    if (!form) modalAberto.current = false
  }, [form])

  useEffect(() => {
    if (formSenha && !modalSenhaAberto.current && modalSenhaRef.current) {
      modalSenhaAberto.current = true
      gsap.fromTo(modalSenhaRef.current,
        { scale: 0.92, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' })
    }
    if (!formSenha) modalSenhaAberto.current = false
  }, [formSenha])

  function abrirNovo() {
    setForm({ nome: '', email: '', senha: '', tipo: 'GERENTE', unidadeId: '' })
  }

  function abrirEditar(u) {
    setForm({ id: u.id, nome: u.nome, email: u.email, senha: '', tipo: u.tipo, unidadeId: u.unidadeId || '' })
  }

  async function salvar(e) {
    e.preventDefault()
    try {
      const payload = { nome: form.nome, email: form.email, tipo: form.tipo, unidadeId: form.unidadeId || null }
      if (!form.id) payload.senha = form.senha
      if (form.id) {
        await api.put(`/usuarios/${form.id}`, payload)
        toast('Usuário atualizado')
      } else {
        await api.post('/usuarios', payload)
        toast('Usuário criado')
      }
      setForm(null)
      carregar()
    } catch (err) {
      toast(err.response?.data?.mensagem || 'Erro ao salvar', 'error')
    }
  }

  async function salvarSenha(e) {
    e.preventDefault()
    try {
      await api.put(`/usuarios/${formSenha.id}/senha`, { novaSenha: formSenha.novaSenha })
      toast('Senha redefinida com sucesso')
      setFormSenha(null)
    } catch (err) {
      toast(err.response?.data?.mensagem || 'Erro ao redefinir senha', 'error')
    }
  }

  async function excluir(id) {
    const ok = await confirm('Desativar este usuário? Ele não conseguirá mais fazer login.')
    if (!ok) return
    try {
      await api.delete(`/usuarios/${id}`)
      toast('Usuário desativado')
      carregar()
    } catch (err) {
      toast(err.response?.data?.mensagem || 'Erro ao desativar', 'error')
    }
  }

  const tipoLabel = t => t === 'DONO' ? 'Proprietário' : 'Gerente'

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div ref={headerRef} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-sm mt-1" style={{ color: '#555' }}>Gerencie os acessos ao sistema</p>
        </div>
        <button onClick={abrirNovo}
          className="btn-red flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg">
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      {/* Modal cadastro/edição */}
      {form && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div ref={modalRef} className="card-dark w-full max-w-md rounded-xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="px-5 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <h2 className="font-semibold text-white text-sm">
                {form.id ? 'Editar' : 'Novo'} usuário
              </h2>
              <button onClick={() => setForm(null)} style={{ color: '#555' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-4">
              <Campo label="Nome *">
                <input type="text" required value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  className="input-dark text-sm" placeholder="Nome completo" />
              </Campo>
              <Campo label="Email *">
                <input type="email" required value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-dark text-sm" placeholder="email@exemplo.com" />
              </Campo>
              {!form.id && (
                <Campo label="Senha *">
                  <input type="password" required value={form.senha}
                    onChange={e => setForm({ ...form, senha: e.target.value })}
                    className="input-dark text-sm" placeholder="Mínimo 6 caracteres" minLength={6} />
                </Campo>
              )}
              <Campo label="Tipo *">
                <select value={form.tipo}
                  onChange={e => setForm({ ...form, tipo: e.target.value, unidadeId: '' })}
                  className="input-dark text-sm">
                  <option value="GERENTE">Gerente</option>
                  <option value="DONO">Proprietário</option>
                </select>
              </Campo>
              {form.tipo === 'GERENTE' && (
                <Campo label="Unidade *">
                  <select value={form.unidadeId}
                    onChange={e => setForm({ ...form, unidadeId: e.target.value })}
                    required className="input-dark text-sm">
                    <option value="">Selecione a unidade...</option>
                    {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </Campo>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setForm(null)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ border: '1px solid var(--hp-border)', color: '#666' }}
                  onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.color='#666'; e.currentTarget.style.background='transparent' }}>
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

      {/* Modal reset senha */}
      {formSenha && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div ref={modalSenhaRef} className="card-dark w-full max-w-sm rounded-xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="px-5 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <div>
                <h2 className="font-semibold text-white text-sm">Redefinir senha</h2>
                <p className="text-xs mt-0.5" style={{ color: '#555' }}>{formSenha.nome}</p>
              </div>
              <button onClick={() => setFormSenha(null)} style={{ color: '#555' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={salvarSenha} className="p-5 space-y-4">
              <Campo label="Nova senha *">
                <input type="password" required minLength={6}
                  value={formSenha.novaSenha || ''}
                  onChange={e => setFormSenha({ ...formSenha, novaSenha: e.target.value })}
                  className="input-dark text-sm" placeholder="Mínimo 6 caracteres" />
              </Campo>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setFormSenha(null)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ border: '1px solid var(--hp-border)', color: '#666' }}
                  onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.color='#666'; e.currentTarget.style.background='transparent' }}>
                  Cancelar
                </button>
                <button type="submit"
                  className="btn-red flex items-center gap-2 px-4 py-2 text-sm rounded-lg">
                  <KeyRound size={14} /> Redefinir
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
        ) : usuarios.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
            <p className="text-sm mb-4" style={{ color: '#555' }}>Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                <Th>Nome</Th>
                <Th>Email</Th>
                <Th>Tipo</Th>
                <Th>Unidade</Th>
                <Th right>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="usr-linha"
                  style={{ borderBottom: '1px solid var(--hp-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-4 py-3 text-sm font-medium text-white">{u.nome}</td>
                  <Td>{u.email}</Td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={u.tipo === 'DONO'
                        ? { background: 'rgba(212,48,42,0.12)', color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.2)' }
                        : { background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                      {tipoLabel(u.tipo)}
                    </span>
                  </td>
                  <Td>{u.unidadeNome || '—'}</Td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setFormSenha({ id: u.id, nome: u.nome })}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#555' }}
                        title="Redefinir senha"
                        onMouseEnter={e => { e.currentTarget.style.color='#60a5fa'; e.currentTarget.style.background='rgba(96,165,250,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color='#555'; e.currentTarget.style.background='transparent' }}>
                        <KeyRound size={14} />
                      </button>
                      <button onClick={() => abrirEditar(u)}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{ color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.3)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,48,42,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Editar
                      </button>
                      <button onClick={() => excluir(u.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#555' }}
                        onMouseEnter={e => { e.currentTarget.style.color='var(--hp-red)'; e.currentTarget.style.background='rgba(212,48,42,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color='#555'; e.currentTarget.style.background='transparent' }}>
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
