import { useEffect, useState, useRef } from 'react'
import { gsap } from 'gsap'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { formatarMoeda, formatarData, MESES } from '../utils/format'
import { FileDown, FileSpreadsheet, BarChart3 } from 'lucide-react'

export default function Relatorios() {
  const { isDono } = useAuth()
  const toast = useToast()

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [unidadeId, setUnidadeId] = useState('')
  const [unidades, setUnidades] = useState([])
  const [relatorio, setRelatorio] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const headerRef  = useRef(null)
  const filtrosRef = useRef(null)
  const conteudoRef = useRef(null)

  useEffect(() => {
    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
    )
    gsap.fromTo(filtrosRef.current,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', delay: 0.15 }
    )
    if (isDono) api.get('/unidades').then((r) => setUnidades(r.data))
    gerar()
  }, [])

  // Anima o conteúdo quando o relatório chega
  useEffect(() => {
    if (!relatorio || !conteudoRef.current) return
    gsap.fromTo('.relat-card',
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', stagger: 0.08 }
    )
    gsap.fromTo('.relat-linha',
      { x: -15, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.04, delay: 0.35 }
    )
  }, [relatorio])

  async function gerar() {
    setCarregando(true)
    setErro('')
    try {
      const params = { mes, ano }
      if (unidadeId) params.unidadeId = unidadeId
      const { data } = await api.get('/relatorios/mensal', { params })
      setRelatorio(data)
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao gerar relatório')
    } finally {
      setCarregando(false)
    }
  }

  async function baixar(formato) {
    try {
      const params = { mes, ano }
      if (unidadeId) params.unidadeId = unidadeId
      const response = await api.get(`/relatorios/mensal/${formato}`, { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      const ext = formato === 'pdf' ? 'pdf' : 'xlsx'
      link.setAttribute('download', `relatorio_${String(mes).padStart(2, '0')}_${ano}.${ext}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast('Erro ao baixar arquivo', 'error')
    }
  }

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i)

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div ref={headerRef} className="mb-6">
        <h1 className="text-2xl font-bold text-white">Relatórios</h1>
        <p className="text-sm mt-1" style={{ color: '#555' }}>Relatório mensal detalhado com todos os números do mês</p>
      </div>

      {/* Filtros */}
      <div ref={filtrosRef} className="card-dark p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Mês</label>
            <select value={mes} onChange={(e) => setMes(parseInt(e.target.value))} className="input-dark text-sm">
              {MESES.map((m) => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Ano</label>
            <select value={ano} onChange={(e) => setAno(parseInt(e.target.value))} className="input-dark text-sm">
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {isDono && (
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Unidade</label>
              <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="input-dark text-sm">
                <option value="">Todas</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={gerar} disabled={carregando}
              className="btn-red w-full py-2.5 text-sm rounded-lg disabled:opacity-50">
              {carregando ? 'Gerando...' : 'Gerar relatório'}
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
          {erro}
        </div>
      )}

      {!relatorio ? (
        <div className="card-dark p-16 text-center">
          <BarChart3 size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
          <p className="text-sm" style={{ color: '#555' }}>Selecione os filtros e clique em "Gerar relatório"</p>
        </div>
      ) : (
        <div ref={conteudoRef}>
          {/* Botões export */}
          <div className="relat-card flex justify-end gap-2 mb-4">
            <button onClick={() => baixar('pdf')}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: 'var(--hp-red)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,48,42,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,48,42,0.1)'}>
              <FileDown size={15} /> Baixar PDF
            </button>
            <button onClick={() => baixar('excel')}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.08)'}>
              <FileSpreadsheet size={15} /> Baixar Excel
            </button>
          </div>

          {/* Cabeçalho */}
          <div className="relat-card card-dark p-5 mb-4">
            <h2 className="text-xl font-bold text-white">{MESES[mes - 1].nome} de {ano}</h2>
            <p className="text-sm mt-1" style={{ color: '#555' }}>{relatorio.unidadeNome}</p>
          </div>

          {/* Cards totalizadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <CardNum titulo="Fichas"      valor={relatorio.quantidadeFichas} />
            <CardNum titulo="Carros"      valor={relatorio.totalManobras} />
            <CardNum titulo="Total bruto" valor={formatarMoeda(relatorio.totalBruto)} />
            <CardNum titulo="Líquido"     valor={formatarMoeda(relatorio.valorLiquidoTotal)} destaque />
          </div>

          {/* Composição */}
          <div className="relat-card card-dark p-5 mb-5">
            <h3 className="font-semibold text-white text-sm mb-4">Composição</h3>
            <div className="space-y-2.5 text-sm">
              <Linha label="Total bruto"          valor={formatarMoeda(relatorio.totalBruto)} />
              <Linha label="Pago aos manobristas" valor={formatarMoeda(relatorio.totalPagoManobristas)} negativo />
              <Linha label="Taxa de cartão"        valor={formatarMoeda(relatorio.totalTaxaCartao)} negativo />
              <Linha label="Despesas"              valor={formatarMoeda(relatorio.totalDespesas)} negativo />
              <div className="pt-3" style={{ borderTop: '1px solid var(--hp-border)' }}>
                <div className="flex justify-between">
                  <span className="font-semibold text-white">VALOR LÍQUIDO</span>
                  <span className="font-bold text-lg"
                    style={{ color: parseFloat(relatorio.valorLiquidoTotal) < 0 ? 'var(--hp-red)' : '#4ade80' }}>
                    {formatarMoeda(relatorio.valorLiquidoTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Por unidade */}
          {relatorio.resumoPorUnidade?.length > 0 && (
            <div className="relat-card card-dark overflow-hidden mb-5">
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--hp-border)' }}>
                <h3 className="font-semibold text-white text-sm">Por unidade</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                    <Th>Unidade</Th><Th right>Fichas</Th><Th right>Bruto</Th><Th right>Líquido</Th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.resumoPorUnidade.map((r) => (
                    <tr key={r.unidadeId} className="relat-linha"
                      style={{ borderBottom: '1px solid var(--hp-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-4 py-3 text-sm text-white font-medium">{r.unidadeNome}</td>
                      <Td right>{r.quantidadeFichas}</Td>
                      <Td right>{formatarMoeda(r.totalBruto)}</Td>
                      <td className="px-4 py-3 text-sm text-right font-bold"
                        style={{ color: parseFloat(r.valorLiquido) < 0 ? 'var(--hp-red)' : '#4ade80' }}>
                        {formatarMoeda(r.valorLiquido)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Fichas do mês */}
          <div className="relat-card card-dark overflow-hidden">
            <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <h3 className="font-semibold text-white text-sm">Fichas do mês</h3>
            </div>
            {relatorio.fichas.length === 0 ? (
              <p className="p-8 text-center text-sm" style={{ color: '#555' }}>Nenhuma ficha encontrada no período</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                    <Th>Data</Th><Th>Unidade</Th><Th right>Carros</Th><Th right>Bruto</Th><Th right>Líquido</Th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.fichas.map((f) => (
                    <tr key={f.id} className="relat-linha"
                      style={{ borderBottom: '1px solid var(--hp-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-4 py-3 text-sm text-white">{formatarData(f.dataFicha)}</td>
                      <Td>{f.unidadeNome}</Td>
                      <Td right>{f.quantidadeManobras}</Td>
                      <Td right>{formatarMoeda(f.totalBruto)}</Td>
                      <td className="px-4 py-3 text-sm text-right font-bold"
                        style={{ color: parseFloat(f.valorLiquido) < 0 ? 'var(--hp-red)' : '#4ade80' }}>
                        {formatarMoeda(f.valorLiquido)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CardNum({ titulo, valor, destaque }) {
  const el = useRef(null)
  const isNegativo = destaque && typeof valor === 'string' && valor.includes('-')
  const corValor = !destaque ? '#fff' : isNegativo ? 'var(--hp-red)' : '#4ade80'

  function onEnter() {
    gsap.to(el.current, { y: -3, duration: 0.2, ease: 'power2.out',
      boxShadow: destaque ? '0 8px 30px rgba(212,48,42,0.3)' : '0 8px 24px rgba(0,0,0,0.5)' })
  }
  function onLeave() {
    gsap.to(el.current, { y: 0, duration: 0.3, ease: 'power2.out',
      boxShadow: destaque ? '0 0 20px rgba(212,48,42,0.1)' : 'none' })
  }
  return (
    <div ref={el} className="relat-card card-dark p-5 cursor-default"
      style={destaque ? { border: '1px solid rgba(212,48,42,0.3)', boxShadow: '0 0 20px rgba(212,48,42,0.1)' } : {}}
      onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#555' }}>{titulo}</p>
      <p className="text-xl font-bold" style={{ color: corValor }}>{valor}</p>
    </div>
  )
}

function Linha({ label, valor, negativo }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: negativo ? '#666' : '#999' }}>{negativo ? `− ${label}` : label}</span>
      <span className="font-semibold" style={{ color: negativo ? 'var(--hp-red)' : '#ccc' }}>{valor}</span>
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
    <td className={`px-4 py-3 text-sm ${right ? 'text-right' : ''}`} style={{ color: '#888' }}>
      {children}
    </td>
  )
}
