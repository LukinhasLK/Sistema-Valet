import { useEffect, useState, useRef } from 'react'
import { gsap } from 'gsap'
import api from '../services/api'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { Plus, Trash2, Save, X, Users2, Percent } from 'lucide-react'

export default function Socios() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [socios, setSocios]     = useState([])
  const [unidades, setUnidades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm]   = useState(null)
  const [erro, setErro]   = useState('')
  const headerRef  = useRef(null)
  const listaRef   = useRef(null)
  const modalRef   = useRef(null)
  const modalAberto = useRef(false)   // controla se o modal JÁ foi animado

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') { setForm(null); setErro('') } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true)
    try {
      const [s, u] = await Promise.all([api.get('/socios'), api.get('/unidades')])
      setSocios(s.data)
      setUnidades(u.data)
    } catch {
      setErro('Erro ao carregar dados')
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }

  useEffect(() => {
    if (carregando) return
    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' })
    gsap.fromTo(listaRef.current,
      { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.15 })
    gsap.fromTo('.socio-linha',
      { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.06, delay: 0.3 })
  }, [carregando])

  useEffect(() => {
    if (form && !modalAberto.current && modalRef.current) {
      // Anima só na abertura do modal
      modalAberto.current = true
      gsap.fromTo(modalRef.current,
        { scale: 0.92, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' })
    }
    if (!form) modalAberto.current = false
  }, [form])

  function abrirNovo() {
    // Inicializa as participações com todas as unidades em 0
    const participacoes = unidades.map(u => ({ unidadeId: u.id, unidadeNome: u.nome, porcentagem: '' }))
    setForm({ nome: '', participacoes })
  }

  function abrirEditar(socio) {
    const participacoes = unidades.map(u => {
      const existente = socio.participacoes.find(p => p.unidadeId === u.id)
      return { unidadeId: u.id, unidadeNome: u.nome, porcentagem: existente ? String(existente.porcentagem) : '' }
    })
    setForm({ id: socio.id, nome: socio.nome, participacoes })
  }

  function setPct(unidadeId, valor) {
    setForm(f => ({
      ...f,
      participacoes: f.participacoes.map(p =>
        p.unidadeId === unidadeId ? { ...p, porcentagem: valor } : p
      )
    }))
  }

  const totalPct = form?.participacoes.reduce((acc, p) => acc + (parseFloat(p.porcentagem) || 0), 0) || 0

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    try {
      let socioId = form.id
      if (!socioId) {
        const { data } = await api.post('/socios', { nome: form.nome })
        socioId = data.id
      } else {
        await api.put(`/socios/${socioId}`, { nome: form.nome })
      }
      // Salva as porcentagens
      const porcentagens = form.participacoes
        .filter(p => parseFloat(p.porcentagem) > 0)
        .map(p => ({ unidadeId: p.unidadeId, porcentagem: parseFloat(p.porcentagem) }))
      await api.put(`/socios/${socioId}/porcentagens`, porcentagens)
      toast(form.id ? 'Sócio atualizado' : 'Sócio cadastrado')
      setForm(null)
      carregar(true)
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao salvar')
    }
  }

  async function excluir(id) {
    const ok = await confirm('Remover este sócio?')
    if (!ok) return
    try {
      await api.delete(`/socios/${id}`)
      toast('Sócio removido')
      carregar(true)
    } catch {
      toast('Erro ao remover sócio', 'error')
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div ref={headerRef} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sócios</h1>
          <p className="text-sm mt-1" style={{ color: '#555' }}>Porcentagem de cada sócio por estabelecimento</p>
        </div>
        <button onClick={abrirNovo}
          className="btn-red flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg">
          <Plus size={15} /> Novo sócio
        </button>
      </div>

      {erro && !form && (
        <div className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
          {erro}
        </div>
      )}

      {/* Modal */}
      {form && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div ref={modalRef} className="card-dark w-full max-w-lg rounded-xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="px-5 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <h2 className="font-semibold text-white text-sm">
                {form.id ? 'Editar' : 'Novo'} sócio
              </h2>
              <button onClick={() => { setForm(null); setErro('') }}
                style={{ color: '#555' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={salvar} className="p-5 space-y-5">
              {erro && (
                <div className="p-3 rounded-lg text-sm"
                  style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
                  {erro}
                </div>
              )}

              {/* Nome */}
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>
                  Nome do sócio *
                </label>
                <input type="text" required value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  className="input-dark text-sm" placeholder="Ex: João Carlos" />
              </div>

              {/* Porcentagens por unidade */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#555' }}>
                    % por estabelecimento
                  </label>
                  {/* Total */}
                  <span className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{
                      background: Math.abs(totalPct - 100) < 0.01 ? 'rgba(74,222,128,0.1)' : 'rgba(212,48,42,0.1)',
                      color: Math.abs(totalPct - 100) < 0.01 ? '#4ade80' : 'var(--hp-red)',
                      border: `1px solid ${Math.abs(totalPct - 100) < 0.01 ? 'rgba(74,222,128,0.2)' : 'rgba(212,48,42,0.2)'}`,
                    }}>
                    Total: {totalPct.toFixed(1)}%
                  </span>
                </div>

                {form.participacoes.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: '#444' }}>
                    Nenhum estabelecimento cadastrado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.participacoes.map(p => (
                      <div key={p.unidadeId} className="flex items-center gap-3">
                        <span className="flex-1 text-sm truncate" style={{ color: '#aaa' }}>{p.unidadeNome}</span>
                        <div className="w-32">
                          <InputPercent valor={p.porcentagem} onChange={v => setPct(p.unidadeId, v)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => { setForm(null); setErro('') }}
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
        ) : socios.length === 0 ? (
          <div className="p-12 text-center">
            <Users2 size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
            <p className="text-sm mb-4" style={{ color: '#555' }}>Nenhum sócio cadastrado</p>
            <button onClick={abrirNovo} className="text-sm font-medium" style={{ color: 'var(--hp-red)' }}>
              + Adicionar primeiro sócio
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-left" style={{ color: '#555' }}>Nome</th>
                {unidades.map(u => (
                  <th key={u.id} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-center" style={{ color: '#555' }}>
                    {u.nome}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {socios.map(socio => (
                <tr key={socio.id} className="socio-linha"
                  style={{ borderBottom: '1px solid var(--hp-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-4 py-3 text-sm font-semibold text-white">{socio.nome}</td>
                  {unidades.map(u => {
                    const p = socio.participacoes.find(x => x.unidadeId === u.id)
                    return (
                      <td key={u.id} className="px-4 py-3 text-center">
                        {p ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                            style={{ background: 'rgba(212,48,42,0.12)', color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.2)' }}>
                            <Percent size={9} />
                            {parseFloat(p.porcentagem).toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#333' }}>—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => abrirEditar(socio)}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{ color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.3)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,48,42,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        Editar
                      </button>
                      <button onClick={() => excluir(socio.id)}
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

function InputPercent({ valor, onChange }) {
  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={e => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        className="input-dark text-sm pr-12"
        placeholder="0"
      />
      <span className="absolute right-0 flex items-center justify-center h-full w-10 text-xs font-semibold pointer-events-none select-none"
        style={{
          color: '#fff',
          background: 'rgba(255,255,255,0.06)',
          borderLeft: '1px solid var(--hp-border)',
          borderRadius: '0 8px 8px 0',
        }}>
        %
      </span>
    </div>
  )
}
