import { useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { formatarMoeda, formatarData, MESES } from '../utils/format'
import { Plus, FileText, Trash2, Eye, ChevronLeft, ChevronRight, Filter, Search } from 'lucide-react'

const POR_PAGINA = 10

export default function ListaFichas() {
  const { isDono, usuario } = useAuth()
  const toast   = useToast()
  const confirm = useConfirm()

  const hoje = new Date()
  const [fichas, setFichas]       = useState([])
  const [unidades, setUnidades]   = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]           = useState('')

  // Filtros
  const [filtroMes,      setFiltroMes]      = useState('')
  const [filtroAno,      setFiltroAno]      = useState(String(hoje.getFullYear()))
  const [filtroUnidade,  setFiltroUnidade]  = useState('')
  const [busca,          setBusca]          = useState('')

  // Paginação
  const [pagina, setPagina] = useState(1)

  const headerRef = useRef(null)
  const tabelaRef = useRef(null)

  useEffect(() => {
    carregar()
    if (isDono) api.get('/unidades').then(r => setUnidades(r.data)).catch(() => {})
  }, [])

  async function carregar() {
    try {
      const { data } = await api.get('/fichas')
      setFichas([...data].sort((a, b) => new Date(b.dataFicha) - new Date(a.dataFicha)))
    } catch {
      setErro('Erro ao carregar fichas')
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
    gsap.fromTo(tabelaRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.15 }
    )
    gsap.fromTo('.ficha-linha',
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.05, delay: 0.3 }
    )
  }, [carregando])

  // Re-anima linhas ao mudar página/filtros
  useEffect(() => {
    if (carregando) return
    gsap.fromTo('.ficha-linha',
      { opacity: 0, x: -10 },
      { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out', stagger: 0.04 }
    )
  }, [pagina, filtroMes, filtroAno, filtroUnidade])

  async function excluir(id) {
    const ok = await confirm('Tem certeza que deseja excluir esta ficha? Essa ação não pode ser desfeita.')
    if (!ok) return
    try {
      await api.delete(`/fichas/${id}`)
      setFichas(prev => prev.filter(f => f.id !== id))
      toast('Ficha excluída com sucesso')
    } catch {
      toast('Erro ao excluir ficha', 'error')
    }
  }

  // Filtrar fichas
  const fichasFiltradas = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    return fichas.filter(f => {
      const [ano, mes] = f.dataFicha.split('-')
      if (filtroAno && ano !== filtroAno) return false
      if (filtroMes && mes !== filtroMes.padStart(2, '0')) return false
      if (filtroUnidade && String(f.unidadeId) !== filtroUnidade) return false
      if (termo) {
        const dataFormatada = formatarData(f.dataFicha).toLowerCase()
        const unidade = (f.unidadeNome || '').toLowerCase()
        if (!dataFormatada.includes(termo) && !unidade.includes(termo)) return false
      }
      return true
    })
  }, [fichas, filtroMes, filtroAno, filtroUnidade, busca])

  const totalPaginas = Math.max(1, Math.ceil(fichasFiltradas.length / POR_PAGINA))
  const fichasPagina = fichasFiltradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  // Resetar paginação ao mudar filtros
  useEffect(() => { setPagina(1) }, [filtroMes, filtroAno, filtroUnidade, busca])

  const anos = useMemo(() => {
    const set = new Set(fichas.map(f => f.dataFicha.split('-')[0]))
    const cur = String(hoje.getFullYear())
    set.add(cur)
    set.add(String(hoje.getFullYear() - 1))
    return [...set].sort((a, b) => b - a)
  }, [fichas])

  const temFiltro = filtroMes || filtroUnidade || filtroAno !== String(hoje.getFullYear()) || busca

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div ref={headerRef} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Fichas</h1>
          <p className="text-sm mt-1" style={{ color: '#555' }}>
            {fichasFiltradas.length} {fichasFiltradas.length === 1 ? 'ficha' : 'fichas'} encontradas
          </p>
        </div>
        <Link to="/fichas/nova" className="btn-red flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg">
          <Plus size={15} /> Nova ficha
        </Link>
      </div>

      {erro && (
        <div className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
          {erro}
        </div>
      )}

      {/* Filtros */}
      <div className="card-dark p-3 md:p-4 mb-4 flex flex-wrap items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2 mr-1">
          <Filter size={13} style={{ color: '#555' }} />
          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#555' }}>Filtros</span>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#444' }} />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar unidade ou data..."
            className="input-dark text-sm pl-8"
            style={{ minWidth: 200 }}
          />
        </div>

        {/* Mês */}
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
          className="input-dark text-sm" style={{ width: 'auto', minWidth: 130 }}>
          <option value="">Todos os meses</option>
          {MESES.map(m => (
            <option key={m.valor} value={String(m.valor)}>{m.nome}</option>
          ))}
        </select>

        {/* Ano */}
        <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)}
          className="input-dark text-sm" style={{ width: 'auto', minWidth: 100 }}>
          <option value="">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Unidade (só dono) */}
        {isDono && unidades.length > 0 && (
          <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}
            className="input-dark text-sm" style={{ width: 'auto', minWidth: 160 }}>
            <option value="">Todas as unidades</option>
            {unidades.map(u => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
          </select>
        )}

        {/* Limpar filtros */}
        {temFiltro && (
          <button
            onClick={() => { setFiltroMes(''); setFiltroAno(String(hoje.getFullYear())); setFiltroUnidade(''); setBusca('') }}
            className="text-xs font-medium transition-colors ml-auto"
            style={{ color: 'var(--hp-red)' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Limpar filtros
          </button>
        )}
      </div>

      {/* Resumo do período */}
      {!carregando && fichasFiltradas.length > 0 && (() => {
        const totalBruto   = fichasFiltradas.reduce((s, f) => s + parseFloat(f.totalBruto   || 0), 0)
        const totalLiquido = fichasFiltradas.reduce((s, f) => s + parseFloat(f.valorLiquido || 0), 0)
        const totalCarros  = fichasFiltradas.reduce((s, f) => s + (f.quantidadeManobras || 0), 0)
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <ResumoCard label="Fichas"       valor={fichasFiltradas.length} />
            <ResumoCard label="Carros"       valor={totalCarros} />
            <ResumoCard label="Total bruto"  valor={formatarMoeda(totalBruto)} />
            <ResumoCard label="Líquido"      valor={formatarMoeda(totalLiquido)} liquido={totalLiquido} />
          </div>
        )
      })()}

      {/* Lista */}
      <div ref={tabelaRef} className="card-dark overflow-hidden">
        {carregando ? (
          <div className="p-12 text-center">
            <div className="w-7 h-7 border-2 rounded-full mx-auto animate-spin"
              style={{ borderColor: 'var(--hp-border)', borderTopColor: 'var(--hp-red)' }} />
          </div>
        ) : fichasFiltradas.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
            <p className="text-sm mb-4" style={{ color: '#555' }}>
              {fichas.length === 0 ? 'Nenhuma ficha cadastrada' : 'Nenhuma ficha nesse período'}
            </p>
            {fichas.length === 0 && (
              <Link to="/fichas/nova" className="text-sm font-medium" style={{ color: 'var(--hp-red)' }}>
                + Criar primeira ficha
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile: cards ── */}
            <div className="md:hidden divide-y" style={{ borderColor: 'var(--hp-border)' }}>
              {fichasPagina.map((ficha) => (
                <div key={ficha.id} className="ficha-linha px-4 py-4">
                  {/* Linha superior: data + valor líquido */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-white font-semibold text-sm">{formatarData(ficha.dataFicha)}</span>
                      <p className="text-xs mt-0.5" style={{ color: '#666' }}>{ficha.unidadeNome}</p>
                    </div>
                    <span className="text-base font-bold" style={{ color: parseFloat(ficha.valorLiquido) < 0 ? 'var(--hp-red)' : '#4ade80' }}>
                      {formatarMoeda(ficha.valorLiquido)}
                    </span>
                  </div>
                  {/* Linha inferior: stats + botões */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-3 text-xs" style={{ color: '#555' }}>
                      <span>{ficha.quantidadeManobras} carros</span>
                      <span style={{ color: '#444' }}>·</span>
                      <span>Bruto {formatarMoeda(ficha.totalBruto)}</span>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link
                        to={`/fichas/${ficha.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#aaa', border: '1px solid var(--hp-border)', touchAction: 'manipulation' }}>
                        <Eye size={13} /> Ver
                      </Link>
                      <button
                        onClick={() => excluir(ficha.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(212,48,42,0.1)', color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.25)', touchAction: 'manipulation' }}>
                        <Trash2 size={13} /> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop: tabela ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                    <Th>Data</Th>
                    <Th>Unidade</Th>
                    <Th>Carros</Th>
                    <Th right>Bruto</Th>
                    <Th right>Líquido</Th>
                    <Th right>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {fichasPagina.map((ficha) => (
                    <tr key={ficha.id} className="ficha-linha"
                      style={{ borderBottom: '1px solid var(--hp-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-white font-medium">{formatarData(ficha.dataFicha)}</span>
                      </td>
                      <Td>{ficha.unidadeNome}</Td>
                      <Td>{ficha.quantidadeManobras}</Td>
                      <Td right>{formatarMoeda(ficha.totalBruto)}</Td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className="font-bold" style={{ color: parseFloat(ficha.valorLiquido) < 0 ? 'var(--hp-red)' : '#4ade80' }}>
                          {formatarMoeda(ficha.valorLiquido)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/fichas/${ficha.id}`}
                            className="p-2 rounded-lg transition-colors inline-flex"
                            style={{ color: '#555' }}
                            onMouseEnter={e => { e.currentTarget.style.color='var(--hp-red)'; e.currentTarget.style.background='rgba(212,48,42,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.color='#555'; e.currentTarget.style.background='transparent' }}>
                            <Eye size={15} />
                          </Link>
                          <button onClick={() => excluir(ficha.id)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#555' }}
                            onMouseEnter={e => { e.currentTarget.style.color='var(--hp-red)'; e.currentTarget.style.background='rgba(212,48,42,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.color='#555'; e.currentTarget.style.background='transparent' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--hp-border)' }}>
                <span className="text-xs" style={{ color: '#555' }}>
                  Página {pagina} de {totalPaginas} · {fichasFiltradas.length} fichas
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    style={{ color: '#555' }}
                    onMouseEnter={e => { if (pagina > 1) { e.currentTarget.style.color='var(--hp-red)'; e.currentTarget.style.background='rgba(212,48,42,0.1)' } }}
                    onMouseLeave={e => { e.currentTarget.style.color='#555'; e.currentTarget.style.background='transparent' }}>
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1)
                    .reduce((acc, n, i, arr) => {
                      if (i > 0 && n - arr[i - 1] > 1) acc.push('...')
                      acc.push(n)
                      return acc
                    }, [])
                    .map((item, i) =>
                      item === '...' ? (
                        <span key={`e${i}`} className="px-1 text-xs" style={{ color: '#444' }}>…</span>
                      ) : (
                        <button key={item}
                          onClick={() => setPagina(item)}
                          className="w-7 h-7 rounded text-xs font-medium transition-colors"
                          style={item === pagina
                            ? { background: 'rgba(212,48,42,0.15)', color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.3)' }
                            : { color: '#555' }}
                          onMouseEnter={e => { if (item !== pagina) e.currentTarget.style.color='#fff' }}
                          onMouseLeave={e => { if (item !== pagina) e.currentTarget.style.color='#555' }}>
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    style={{ color: '#555' }}
                    onMouseEnter={e => { if (pagina < totalPaginas) { e.currentTarget.style.color='var(--hp-red)'; e.currentTarget.style.background='rgba(212,48,42,0.1)' } }}
                    onMouseLeave={e => { e.currentTarget.style.color='#555'; e.currentTarget.style.background='transparent' }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ResumoCard({ label, valor, liquido }) {
  const temCor = liquido !== undefined
  const cor = temCor ? (liquido < 0 ? 'var(--hp-red)' : '#4ade80') : '#fff'
  const borda = temCor ? (liquido < 0 ? 'rgba(212,48,42,0.3)' : 'rgba(74,222,128,0.2)') : 'var(--hp-border)'
  return (
    <div className="card-dark p-4" style={{ border: `1px solid ${borda}` }}>
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#555' }}>{label}</p>
      <p className="text-lg font-bold num" style={{ color: cor }}>{valor}</p>
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

function Td({ children, right }) {
  return (
    <td className={`px-4 py-3 text-sm ${right ? 'text-right' : 'text-left'}`}
      style={{ color: '#888' }}>
      {children}
    </td>
  )
}
