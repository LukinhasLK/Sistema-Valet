import { useEffect, useState, useRef, useMemo } from 'react'
import { gsap } from 'gsap'
import api from '../services/api'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { formatarMoeda, formatarData } from '../utils/format'
import { Plus, Trash2, Save, X, Receipt } from 'lucide-react'

export default function Despesas() {
  const toast   = useToast()
  const confirm = useConfirm()

  const [despesas, setDespesas]   = useState([])
  const [fichas, setFichas]       = useState([])
  const [carregando, setCarregando] = useState(true)
  const [form, setForm]           = useState(null)
  const [salvando, setSalvando]   = useState(false)

  // filtros
  const [filtroMes, setFiltroMes]     = useState('')
  const [filtroUnidade, setFiltroUnidade] = useState('')

  const headerRef = useRef(null)
  const listaRef  = useRef(null)
  const modalRef  = useRef(null)
  const modalAberto = useRef(false)

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') fecharForm() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (carregando) return
    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' })
    gsap.fromTo(listaRef.current,
      { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.15 })
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

  async function carregar() {
    try {
      const [{ data: d }, { data: f }] = await Promise.all([
        api.get('/despesas'),
        api.get('/fichas'),
      ])
      setDespesas(d)
      setFichas(f)
    } catch {
      toast('Erro ao carregar despesas', 'error')
    } finally {
      setCarregando(false)
    }
  }

  function abrirForm() {
    setForm({ fichaId: '', descricao: '', valor: '' })
  }

  function fecharForm() {
    setForm(null)
  }

  async function salvar(e) {
    e.preventDefault()
    if (!form.fichaId) { toast('Selecione a ficha', 'error'); return }
    if (!form.descricao.trim()) { toast('Informe a descrição', 'error'); return }
    if (!form.valor) { toast('Informe o valor', 'error'); return }

    setSalvando(true)
    try {
      await api.post(`/fichas/${form.fichaId}/despesas`, {
        descricao: form.descricao.trim(),
        valor: parseFloat(String(form.valor).replace(',', '.')),
      })
      toast('Despesa adicionada')
      fecharForm()
      carregar()
    } catch (err) {
      toast(err.response?.data?.mensagem || 'Erro ao salvar despesa', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(despesa) {
    const ok = await confirm(`Remover a despesa "${despesa.descricao}"?`)
    if (!ok) return
    try {
      await api.delete(`/fichas/${despesa.fichaId}/despesas/${despesa.id}`)
      toast('Despesa removida')
      carregar()
    } catch {
      toast('Erro ao remover despesa', 'error')
    }
  }

  // unidades únicas para o filtro
  const unidades = useMemo(() => {
    const set = new Set(despesas.map(d => d.unidadeNome))
    return [...set].sort()
  }, [despesas])

  // meses únicos para o filtro
  const meses = useMemo(() => {
    const set = new Set(despesas.map(d => d.fichaData?.slice(0, 7)))
    return [...set].sort().reverse()
  }, [despesas])

  const despesasFiltradas = useMemo(() => {
    return despesas.filter(d => {
      if (filtroMes && !d.fichaData?.startsWith(filtroMes)) return false
      if (filtroUnidade && d.unidadeNome !== filtroUnidade) return false
      return true
    })
  }, [despesas, filtroMes, filtroUnidade])

  const totalFiltrado = useMemo(() =>
    despesasFiltradas.reduce((acc, d) => acc + parseFloat(d.valor || 0), 0),
    [despesasFiltradas])

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div ref={headerRef} className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Despesas</h1>
          <p className="text-sm mt-1" style={{ color: '#555' }}>Todas as despesas registradas nas fichas</p>
        </div>
        <button onClick={abrirForm}
          className="btn-red flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg whitespace-nowrap shrink-0">
          <Plus size={15} /> <span className="hidden sm:inline">Nova</span> despesa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          className="input-dark text-sm" style={{ width: 'auto', minWidth: 150 }}>
          <option value="">Todos os meses</option>
          {meses.map(m => (
            <option key={m} value={m}>{formatarMesAno(m)}</option>
          ))}
        </select>

        <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}
          className="input-dark text-sm" style={{ width: 'auto', minWidth: 140 }}>
          <option value="">Todas as unidades</option>
          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        {(filtroMes || filtroUnidade) && (
          <button onClick={() => { setFiltroMes(''); setFiltroUnidade('') }}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: '1px solid var(--hp-border)', color: '#666' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#666'}>
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Total */}
      {despesasFiltradas.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl flex items-center justify-between"
          style={{ background: 'rgba(212,48,42,0.07)', border: '1px solid rgba(212,48,42,0.2)' }}>
          <span className="text-sm" style={{ color: '#888' }}>
            {despesasFiltradas.length} despesa{despesasFiltradas.length !== 1 ? 's' : ''}
          </span>
          <span className="text-sm font-bold" style={{ color: 'var(--hp-red)' }}>
            Total: {formatarMoeda(totalFiltrado)}
          </span>
        </div>
      )}

      {/* Lista */}
      <div ref={listaRef} className="card-dark overflow-x-auto">
        {carregando ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 rounded-full mx-auto animate-spin"
              style={{ borderColor: 'var(--hp-border)', borderTopColor: 'var(--hp-red)' }} />
          </div>
        ) : despesasFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
            <p className="text-sm mb-4" style={{ color: '#555' }}>
              {despesas.length === 0 ? 'Nenhuma despesa registrada' : 'Nenhuma despesa nesse filtro'}
            </p>
            {despesas.length === 0 && (
              <button onClick={abrirForm} className="text-sm font-medium" style={{ color: 'var(--hp-red)' }}>
                + Adicionar primeira despesa
              </button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-left" style={{ color: '#555' }}>Data</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-left" style={{ color: '#555' }}>Unidade</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-left" style={{ color: '#555' }}>Descrição</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-right" style={{ color: '#555' }}>Valor</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#555' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {despesasFiltradas.map(d => (
                <tr key={d.id}
                  style={{ borderBottom: '1px solid var(--hp-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-4 py-3 text-sm" style={{ color: '#aaa' }}>
                    {formatarData(d.fichaData)}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#aaa' }}>
                    {d.unidadeNome}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">
                    {d.descricao}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: 'var(--hp-red)' }}>
                    {formatarMoeda(d.valor)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => excluir(d)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#555' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--hp-red)'; e.currentTarget.style.background = 'rgba(212,48,42,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nova despesa */}
      {form && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) fecharForm() }}>
          <div ref={modalRef} className="card-dark w-full max-w-md rounded-xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="px-5 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <h2 className="font-semibold text-white text-sm">Nova despesa</h2>
              <button onClick={fecharForm} style={{ color: '#555' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={salvar} className="p-5 space-y-4">

              {/* Ficha */}
              <Campo label="Ficha *">
                <select value={form.fichaId}
                  onChange={e => setForm(f => ({ ...f, fichaId: e.target.value }))}
                  className="input-dark text-sm">
                  <option value="">Selecione a ficha...</option>
                  {fichas.map(f => (
                    <option key={f.id} value={f.id}>
                      {formatarData(f.dataFicha)} — {f.unidadeNome}
                    </option>
                  ))}
                </select>
              </Campo>

              {/* Descrição */}
              <Campo label="Descrição *">
                <input type="text" placeholder="Ex: Gasolina, alimentação..."
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  className="input-dark text-sm" />
              </Campo>

              {/* Valor */}
              <Campo label="Valor *">
                <div className="relative flex items-center">
                  <span className="absolute left-0 flex items-center justify-center h-full w-10 text-xs font-semibold pointer-events-none"
                    style={{
                      color: '#fff',
                      background: 'rgba(255,255,255,0.06)',
                      borderRight: '1px solid var(--hp-border)',
                      borderRadius: '8px 0 0 8px',
                    }}>
                    R$
                  </span>
                  <input type="text" inputMode="decimal" placeholder="0,00"
                    value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value.replace(/[^\d.,]/g, '') }))}
                    className="input-dark text-sm" style={{ paddingLeft: 48 }} />
                </div>
              </Campo>

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={fecharForm}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ border: '1px solid var(--hp-border)', color: '#666' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="btn-red flex items-center gap-2 px-4 py-2 text-sm rounded-lg disabled:opacity-50">
                  <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
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

function formatarMesAno(mesAno) {
  if (!mesAno) return ''
  const [ano, mes] = mesAno.split('-')
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${nomes[parseInt(mes) - 1]} ${ano}`
}
