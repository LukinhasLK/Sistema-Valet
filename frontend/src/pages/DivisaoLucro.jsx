import { useEffect, useState, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import { gsap } from 'gsap'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatarMoeda, MESES } from '../utils/format'
import { PieChart, TrendingUp, Users2 } from 'lucide-react'

export default function DivisaoLucro() {
  const { isDono, usuario } = useAuth()
  const hoje = new Date()

  const [mes, setMes]           = useState(hoje.getMonth() + 1)
  const [ano, setAno]           = useState(hoje.getFullYear())
  const [unidadeId, setUnidade] = useState('')
  const [unidades, setUnidades] = useState([])
  const [dados, setDados]       = useState(null)   // { liquido, socios: [{nome, porcentagem, valor}] }
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro]         = useState('')

  const headerRef  = useRef(null)
  const filtrosRef = useRef(null)
  const conteudoRef = useRef(null)

  useEffect(() => {
    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' })
    gsap.fromTo(filtrosRef.current,
      { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', delay: 0.15 })

    if (isDono) api.get('/unidades').then(r => setUnidades(r.data))
    else {
      setUnidade(usuario?.unidadeId || '')
      gerar(mes, ano, usuario?.unidadeId || '')
    }
  }, [])

  useEffect(() => {
    if (!dados || !conteudoRef.current) return
    gsap.fromTo('.lucro-card',
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', stagger: 0.07 }
    )
    gsap.fromTo('.socio-row',
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.06, delay: 0.3 }
    )
  }, [dados])

  async function gerar(m = mes, a = ano, uid = unidadeId) {
    if (!uid && isDono) { setErro('Selecione um estabelecimento'); return }
    setErro('')
    setCarregando(true)
    setDados(null)
    try {
      const params = { mes: m, ano: a }
      if (uid) params.unidadeId = uid

      const [{ data: relat }, { data: sociosList }] = await Promise.all([
        api.get('/relatorios/mensal', { params }),
        uid ? api.get(`/socios/unidade/${uid}`) : Promise.resolve({ data: [] }),
      ])

      const liquido = parseFloat(relat.valorLiquidoTotal) || 0

      const socios = sociosList.map(s => ({
        nome: s.nome,
        porcentagem: parseFloat(s.porcentagem),
        valor: (liquido * parseFloat(s.porcentagem)) / 100,
      }))

      const totalPct   = socios.reduce((acc, s) => acc + s.porcentagem, 0)
      const naoAlocado = 100 - totalPct
      if (naoAlocado > 0.01) {
        socios.push({ nome: 'Não alocado', porcentagem: naoAlocado, valor: (liquido * naoAlocado) / 100, naoAlocado: true })
      }

      setDados({ liquido, socios, unidadeNome: relat.unidadeNome, fichas: relat.quantidadeFichas })
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao gerar relatório')
    } finally {
      setCarregando(false)
    }
  }

  function handleGerar() { gerar() }

  const anos = Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i)

  // ── ECharts option ──
  const chartOption = dados ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1a1a1a',
      borderColor: '#2a2a2a',
      textStyle: { color: '#e8e8e8', fontSize: 13 },
      formatter: p => `<b>${p.name}</b><br/>${p.percent.toFixed(1)}% — ${formatarMoeda(p.value)}`,
    },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'center',
      textStyle: {
        color: '#888',
        fontSize: 12,
        rich: {
          name: { color: '#ccc', fontSize: 12 },
          pct:  { color: '#D4302A', fontSize: 11, fontWeight: 700 },
        },
      },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 12,
      formatter: name => {
        const s = dados.socios.find(x => x.nome === name)
        return s ? `{name|${name}}  {pct|${s.porcentagem.toFixed(1)}%}` : name
      },
    },
    series: [{
      name: 'Divisão',
      type: 'pie',
      radius: ['42%', '70%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: '#141414',
        borderWidth: 3,
      },
      label: {
        show: false,
      },
      emphasis: {
        scale: true,
        scaleSize: 8,
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(212,48,42,0.5)',
        },
        label: {
          show: true,
          fontSize: 13,
          fontWeight: 700,
          color: '#fff',
          formatter: p => `${p.percent.toFixed(1)}%`,
        },
      },
      data: dados.socios.map((s, i) => ({
        value: parseFloat(s.valor.toFixed(2)),
        name: s.nome,
        itemStyle: {
          color: s.naoAlocado
            ? '#2a2a2a'
            : CORES[i % CORES.length],
        },
      })),
    }],
  } : {}

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div ref={headerRef} className="mb-6">
        <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
          Divisão de Lucro
        </h1>
        <p className="text-sm mt-1" style={{ color: '#555' }}>
          Distribuição do valor líquido entre os sócios por período
        </p>
      </div>

      {/* Filtros */}
      <div ref={filtrosRef} className="card-dark p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Mês</label>
            <select value={mes} onChange={e => setMes(parseInt(e.target.value))} className="input-dark text-sm">
              {MESES.map(m => <option key={m.valor} value={m.valor}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Ano</label>
            <select value={ano} onChange={e => setAno(parseInt(e.target.value))} className="input-dark text-sm">
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {isDono && (
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#555' }}>Estabelecimento</label>
              <select value={unidadeId} onChange={e => setUnidade(e.target.value)} className="input-dark text-sm">
                <option value="">Selecione...</option>
                {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={handleGerar} disabled={carregando}
              className="btn-red w-full py-2.5 text-sm rounded-lg disabled:opacity-50">
              {carregando ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
          {erro}
        </div>
      )}

      {/* Loading */}
      {carregando && (
        <div className="card-dark p-16 text-center">
          <div className="w-8 h-8 border-2 rounded-full mx-auto animate-spin"
            style={{ borderColor: '#222', borderTopColor: 'var(--hp-red)' }} />
        </div>
      )}

      {/* Sem sócios */}
      {dados && dados.socios.filter(s => !s.naoAlocado).length === 0 && (
        <div className="card-dark p-12 text-center">
          <Users2 size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
          <p className="text-sm mb-2" style={{ color: '#555' }}>Nenhum sócio cadastrado para este estabelecimento</p>
          <p className="text-xs" style={{ color: '#444' }}>Cadastre os sócios e suas porcentagens na página "Sócios"</p>
        </div>
      )}

      {/* Conteúdo */}
      {dados && dados.socios.filter(s => !s.naoAlocado).length > 0 && (
        <div ref={conteudoRef}>

          {/* Cards de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="lucro-card card-dark p-5">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#555' }}>
                Valor líquido
              </p>
              <p className="text-2xl font-bold" style={{ color: dados.liquido < 0 ? 'var(--hp-red)' : '#4ade80', letterSpacing: '-0.03em' }}>
                {formatarMoeda(dados.liquido)}
              </p>
              <p className="text-xs mt-1" style={{ color: '#444' }}>{MESES[mes-1].nome} de {ano}</p>
            </div>
            <div className="lucro-card card-dark p-5">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#555' }}>
                Sócios
              </p>
              <p className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
                {dados.socios.filter(s => !s.naoAlocado).length}
              </p>
              <p className="text-xs mt-1" style={{ color: '#444' }}>{dados.unidadeNome}</p>
            </div>
            <div className="lucro-card card-dark p-5 md:col-span-1 col-span-2"
              style={{ border: '1px solid rgba(212,48,42,0.25)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#555' }}>
                Fichas no período
              </p>
              <p className="text-2xl font-bold" style={{ color: 'var(--hp-red)', letterSpacing: '-0.03em' }}>
                {dados.fichas}
              </p>
              <p className="text-xs mt-1" style={{ color: '#444' }}>fichas registradas</p>
            </div>
          </div>

          {/* Gráfico + Tabela */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Gráfico pizza */}
            <div className="lucro-card card-dark p-5">
              <div className="mb-4">
                <h2 className="font-semibold text-white text-sm" style={{ letterSpacing: '-0.02em' }}>
                  Distribuição por sócio
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#555' }}>{MESES[mes-1].nome} / {ano}</p>
              </div>
              <ReactECharts
                option={chartOption}
                style={{ height: 300 }}
                theme="dark"
                opts={{ renderer: 'canvas' }}
              />
            </div>

            {/* Tabela de sócios */}
            <div className="lucro-card card-dark overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--hp-border)' }}>
                <h2 className="font-semibold text-white text-sm" style={{ letterSpacing: '-0.02em' }}>
                  Detalhamento
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#555' }}>Valor líquido por sócio</p>
              </div>
              <div className="divide-y" style={{ borderColor: '#1a1a1a' }}>
                {dados.socios.filter(s => !s.naoAlocado).map((s, i) => (
                  <div key={s.nome} className="socio-row flex items-center gap-4 px-5 py-4">
                    {/* Cor do sócio */}
                    <div className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: CORES[i % CORES.length] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {/* Barra de progresso */}
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#222' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${s.porcentagem}%`, background: CORES[i % CORES.length] }} />
                        </div>
                        <span className="text-xs font-bold flex-shrink-0"
                          style={{ color: CORES[i % CORES.length] }}>
                          {s.porcentagem.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold num" style={{ color: s.valor < 0 ? 'var(--hp-red)' : '#4ade80' }}>
                        {formatarMoeda(s.valor)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-sm font-semibold" style={{ color: '#888' }}>Total distribuído</span>
                  {(() => {
                    const total = dados.socios.filter(s => !s.naoAlocado).reduce((acc, s) => acc + s.valor, 0)
                    return (
                      <span className="text-base font-bold num" style={{ color: total < 0 ? 'var(--hp-red)' : '#4ade80' }}>
                        {formatarMoeda(total)}
                      </span>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado inicial */}
      {!dados && !carregando && !erro && (
        <div className="card-dark p-16 text-center">
          <PieChart size={40} className="mx-auto mb-3" style={{ color: '#333' }} />
          <p className="text-sm" style={{ color: '#555' }}>
            Selecione o período{isDono ? ' e o estabelecimento' : ''} para ver a divisão
          </p>
        </div>
      )}
    </div>
  )
}

const CORES = [
  '#D4302A',
  '#4ade80',
  '#60a5fa',
  '#f59e0b',
  '#a78bfa',
  '#f472b6',
  '#34d399',
  '#fb923c',
]
