import { useEffect, useState, useRef, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { gsap } from 'gsap'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatarData, MESES } from '../utils/format'
import { Car, List, BarChart2, FileDown } from 'lucide-react'

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

export default function RelatorioCarros() {
  const { isDono, usuario } = useAuth()
  const navigate = useNavigate()
  const hoje = new Date()

  const [ano, setAno]           = useState(hoje.getFullYear())
  const [mes, setMes]           = useState(hoje.getMonth() + 1)
  const [unidadeId, setUnidade] = useState('')
  const [unidades, setUnidades] = useState([])
  const [dados, setDados]       = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro]         = useState('')
  const [visao, setVisao]       = useState('resumido') // 'resumido' | 'detalhado'
  const [baixando, setBaixando] = useState(false)

  const headerRef  = useRef(null)
  const filtrosRef = useRef(null)
  const conteudoRef = useRef(null)

  useEffect(() => {
    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' })
    gsap.fromTo(filtrosRef.current,
      { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', delay: 0.15 })

    if (isDono) {
      api.get('/unidades').then(r => setUnidades(r.data))
    } else {
      const uid = usuario?.unidadeId || ''
      setUnidade(uid)
      buscar(hoje.getFullYear(), hoje.getMonth() + 1, uid)
    }
  }, [])

  useEffect(() => {
    if (!dados || !conteudoRef.current) return
    gsap.fromTo('.carros-row',
      { x: -14, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.04, delay: 0.1 })
  }, [dados, visao])

  async function baixarPdf() {
    setBaixando(true)
    try {
      const params = { ano }
      if (mes) params.mes = mes
      if (unidadeId) params.unidadeId = unidadeId
      const unidade = unidades.find(u => String(u.id) === String(unidadeId))
      if (unidade) params.unidadeNome = unidade.nome
      const response = await api.get('/relatorios/carros/pdf', { params, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `carros_${ano}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // erro silencioso — o toast está disponível se quiser adicionar
    } finally {
      setBaixando(false)
    }
  }

  async function buscar(a = ano, m = mes, uid = unidadeId) {
    setErro(''); setCarregando(true); setDados(null)
    try {
      const params = { ano: a }
      if (m) params.mes = m
      if (uid) params.unidadeId = uid
      const { data } = await api.get('/relatorios/carros', { params })
      setDados(data)
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao carregar dados')
    } finally {
      setCarregando(false)
    }
  }

  // totais gerais
  const totalCarros  = useMemo(() => dados?.resumo.reduce((a, m) => a + m.totalCarros, 0) || 0, [dados])
  const totalFichas  = useMemo(() => dados?.resumo.reduce((a, m) => a + m.totalFichas, 0) || 0, [dados])
  const mediaMensal  = useMemo(() => {
    const mesesComFichas = dados?.resumo.filter(m => m.totalFichas > 0).length || 1
    return Math.round(totalCarros / mesesComFichas)
  }, [dados, totalCarros])

  // Opção do gráfico de barras
  const chartOption = useMemo(() => {
    if (!dados) return {}
    const meses   = dados.resumo.map(m => m.nomeMes.slice(0, 3))
    const valores = dados.resumo.map(m => m.totalCarros)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        textStyle: { color: '#e8e8e8', fontSize: 13 },
        formatter: p => `<b>${dados.resumo[p[0].dataIndex].nomeMes}</b><br/>🚗 ${p[0].value} carros`,
      },
      grid: { left: 40, right: 16, top: 20, bottom: 30 },
      xAxis: {
        type: 'category', data: meses,
        axisLine: { lineStyle: { color: '#2a2a2a' } },
        axisLabel: { color: '#555', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#1a1a1a' } },
        axisLabel: { color: '#555', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: valores,
        barMaxWidth: 40,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: p => p.value === Math.max(...valores) ? '#D4302A' : 'rgba(212,48,42,0.45)',
        },
        emphasis: { itemStyle: { color: '#D4302A' } },
      }],
    }
  }, [dados])

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div ref={headerRef} className="mb-6">
        <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
          Carros por Mês
        </h1>
        <p className="text-sm mt-1" style={{ color: '#555' }}>
          Total de carros manobrando por período
        </p>
      </div>

      {/* Filtros */}
      <div ref={filtrosRef} className="card-dark p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Mês</label>
            <select value={mes} onChange={e => setMes(parseInt(e.target.value))} className="input-dark text-sm">
              {MESES.map(m => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Ano</label>
            <select value={ano} onChange={e => setAno(parseInt(e.target.value))} className="input-dark text-sm">
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {isDono && (
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Unidade</label>
              <select value={unidadeId} onChange={e => setUnidade(e.target.value)} className="input-dark text-sm">
                <option value="">Todas</option>
                {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={() => buscar()} disabled={carregando}
              className="btn-red w-full py-2.5 text-sm rounded-lg disabled:opacity-50">
              {carregando ? 'Carregando...' : 'Buscar'}
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

      {carregando && (
        <div className="card-dark p-16 text-center">
          <div className="w-8 h-8 border-2 rounded-full mx-auto animate-spin"
            style={{ borderColor: '#222', borderTopColor: 'var(--hp-red)' }} />
        </div>
      )}

      {dados && !carregando && (
        <div ref={conteudoRef}>

          {/* Cards de totais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <CardInfo titulo="Total de carros" valor={totalCarros.toLocaleString('pt-BR')} destaque />
            <CardInfo titulo="Total de fichas" valor={totalFichas} />
            <CardInfo titulo="Média mensal"    valor={`${mediaMensal.toLocaleString('pt-BR')} carros`} />
          </div>

          {/* Toggle + botão PDF */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex gap-1 p-1 rounded-xl w-fit"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--hp-border)' }}>
            {[['resumido', BarChart2, 'Resumido'], ['detalhado', List, 'Detalhado']].map(([val, Icon, label]) => (
              <button key={val} onClick={() => setVisao(val)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: visao === val ? 'var(--hp-surface)' : 'transparent',
                  color: visao === val ? '#fff' : '#555',
                  border: visao === val ? '1px solid var(--hp-border)' : '1px solid transparent',
                }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <button onClick={baixarPdf} disabled={baixando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: 'var(--hp-red)' }}
            onMouseEnter={e => !baixando && (e.currentTarget.style.background = 'rgba(212,48,42,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,48,42,0.1)')}>
            <FileDown size={15} /> {baixando ? 'Gerando...' : 'Baixar PDF'}
          </button>
          </div>

          {/* ── VISÃO RESUMIDA ── */}
          {visao === 'resumido' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Gráfico de barras */}
              <div className="card-dark p-5">
                <h2 className="font-semibold text-white text-sm mb-4">Carros por mês — {ano}</h2>
                <ReactECharts option={chartOption} style={{ height: 280 }} theme="dark" opts={{ renderer: 'canvas' }} />
              </div>

              {/* Tabela resumo */}
              <div className="card-dark overflow-x-auto">
                <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--hp-border)' }}>
                  <h2 className="font-semibold text-white text-sm">Total por mês</h2>
                </div>
                <table className="w-full min-w-[380px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                      <Th>Mês</Th>
                      <Th right>Fichas</Th>
                      <Th right>Carros</Th>
                      <Th right>Média/dia</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.resumo.map(m => (
                      <tr key={m.mes} className="carros-row"
                        style={{ borderBottom: '1px solid var(--hp-border)', opacity: m.totalFichas === 0 ? 0.35 : 1 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="px-4 py-3 text-sm font-medium text-white">{m.nomeMes}</td>
                        <Td right>{m.totalFichas || '—'}</Td>
                        <td className="px-4 py-3 text-sm text-right font-bold"
                          style={{ color: m.totalCarros > 0 ? 'var(--hp-red)' : '#333' }}>
                          {m.totalCarros > 0 ? m.totalCarros.toLocaleString('pt-BR') : '—'}
                        </td>
                        <Td right>
                          {m.totalFichas > 0 ? Math.round(m.totalCarros / m.totalFichas) : '—'}
                        </Td>
                      </tr>
                    ))}
                    {/* Linha de total */}
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--hp-border)' }}>
                      <td className="px-4 py-3 text-sm font-bold text-white">Total {ano}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: '#888' }}>{totalFichas}</td>
                      <td className="px-4 py-3 text-sm text-right font-bold" style={{ color: 'var(--hp-red)' }}>
                        {totalCarros.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: '#888' }}>
                        {totalFichas > 0 ? Math.round(totalCarros / totalFichas) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── VISÃO DETALHADA ── */}
          {visao === 'detalhado' && (
            <div className="card-dark overflow-x-auto">
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--hp-border)' }}>
                <h2 className="font-semibold text-white text-sm">Detalhamento por ficha</h2>
                <span className="text-xs" style={{ color: '#555' }}>
                  {dados.detalhado.length} fichas
                </span>
              </div>
              {dados.detalhado.length === 0 ? (
                <p className="p-10 text-center text-sm" style={{ color: '#555' }}>
                  Nenhuma ficha encontrada em {ano}
                </p>
              ) : (
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hp-border)' }}>
                      <Th>Data</Th>
                      <Th>Mês</Th>
                      {isDono && <Th>Unidade</Th>}
                      <Th right>Carros</Th>
                      <Th right>Ver ficha</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.detalhado.map(d => (
                      <tr key={d.fichaId} className="carros-row"
                        style={{ borderBottom: '1px solid var(--hp-border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td className="px-4 py-3 text-sm text-white">{formatarData(d.data)}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#666' }}>
                          {MESES[new Date(d.data + 'T00:00:00').getMonth()].nome}
                        </td>
                        {isDono && <Td>{d.unidadeNome}</Td>}
                        <td className="px-4 py-3 text-sm text-right font-bold" style={{ color: 'var(--hp-red)' }}>
                          {d.totalCarros}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => navigate(`/fichas/${d.fichaId}`)}
                            className="text-xs px-3 py-1 rounded-lg transition-colors"
                            style={{ border: '1px solid rgba(212,48,42,0.3)', color: 'var(--hp-red)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,48,42,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {!dados && !carregando && !erro && (
        <div className="card-dark p-16 text-center">
          <Car size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
          <p className="text-sm" style={{ color: '#555' }}>
            Selecione o ano{isDono ? ' e a unidade' : ''} e clique em Buscar
          </p>
        </div>
      )}
    </div>
  )
}

function CardInfo({ titulo, valor, destaque }) {
  return (
    <div className="card-dark p-5"
      style={destaque ? { border: '1px solid rgba(212,48,42,0.3)' } : {}}>
      <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#555' }}>{titulo}</p>
      <p className="text-2xl font-bold" style={{ color: destaque ? 'var(--hp-red)' : '#fff', letterSpacing: '-0.03em' }}>
        {valor}
      </p>
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
