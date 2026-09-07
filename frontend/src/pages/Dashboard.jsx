import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatarMoeda, formatarData } from '../utils/format'
import { TrendingUp, FileText, Car, DollarSign, Plus, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function Dashboard() {
  const { usuario } = useAuth()
  const [relatorio, setRelatorio]           = useState(null)
  const [fichasRecentes, setFichasRecentes] = useState([])
  const [historico, setHistorico]           = useState([])
  const [carregando, setCarregando]         = useState(true)
  const [ocultarLucro, setOcultarLucro]     = useState(() => localStorage.getItem('ocultarLucro') === '1')
  const graficoRef   = useRef(null)
  const historicoRef = useRef(null)

  function toggleOcultar() {
    const novo = !ocultarLucro
    setOcultarLucro(novo)
    localStorage.setItem('ocultarLucro', novo ? '1' : '0')
  }

  const oculto = '••••'
  function val(v) { return ocultarLucro ? oculto : formatarMoeda(v) }

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    try {
      const hoje   = new Date()
      const params = { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() }
      if (usuario.tipo === 'GERENTE') params.unidadeId = usuario.unidadeId

      const [{ data: relat }, { data: fichas }] = await Promise.all([
        api.get('/relatorios/mensal', { params }),
        api.get('/fichas'),
      ])

      setRelatorio(relat)
      setFichasRecentes([...fichas].sort((a, b) => new Date(b.dataFicha) - new Date(a.dataFicha)).slice(0, 5))

      // Busca os últimos 6 meses em paralelo
      const meses6 = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1)
        return { mes: d.getMonth() + 1, ano: d.getFullYear(), label: d.toLocaleDateString('pt-BR', { month: 'short' }) }
      })
      const resultados = await Promise.all(
        meses6.map(m => {
          const p = { mes: m.mes, ano: m.ano }
          if (usuario.tipo === 'GERENTE') p.unidadeId = usuario.unidadeId
          return api.get('/relatorios/mensal', { params: p })
            .then(r => ({ ...m, liquido: r.data.valorLiquidoTotal || 0, bruto: r.data.totalBruto || 0 }))
            .catch(() => ({ ...m, liquido: 0, bruto: 0 }))
        })
      )
      setHistorico(resultados)
    } catch (err) {
      console.error(err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (carregando) return

    gsap.fromTo('.dash-header',
      { y: -18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
    )
    gsap.fromTo('.dash-card',
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', stagger: 0.08, delay: 0.1 }
    )
    gsap.fromTo(graficoRef.current,
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.45 }
    )
    if (historicoRef.current) {
      gsap.fromTo(historicoRef.current,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.55 }
      )
    }
    gsap.fromTo('.ficha-row',
      { x: -14, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.06, delay: 0.55 }
    )
    animarContadores()
  }, [carregando])

  function animarContadores() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const final   = parseFloat(el.dataset.count) || 0
      const isMoeda = el.dataset.moeda === '1'
      const obj     = { val: 0 }
      gsap.to(obj, {
        val: final, duration: 1.3, ease: 'power2.out',
        onUpdate() { el.textContent = isMoeda ? formatarMoeda(obj.val) : Math.round(obj.val) },
      })
    })
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: '#444' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 rounded-full mx-auto mb-3 animate-spin"
            style={{ borderColor: '#222', borderTopColor: 'var(--hp-red)' }} />
          <p className="text-xs tracking-widest uppercase" style={{ color: '#444' }}>Carregando</p>
        </div>
      </div>
    )
  }

  const fichasGrafico = (relatorio?.fichas || [])
    .slice().sort((a, b) => new Date(a.dataFicha) - new Date(b.dataFicha)).slice(-10)

  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="dash-header flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: 'var(--hp-red)' }}>
            {mesNome}
          </p>
          <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
            Olá, {usuario?.nome.split(' ')[0]}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleOcultar}
            className="p-2 rounded-lg transition-colors"
            style={{ color: ocultarLucro ? 'var(--hp-red)' : '#555', background: ocultarLucro ? 'rgba(212,48,42,0.1)' : 'transparent', border: '1px solid', borderColor: ocultarLucro ? 'rgba(212,48,42,0.3)' : 'var(--hp-border)', touchAction: 'manipulation' }}
            title={ocultarLucro ? 'Mostrar valores' : 'Ocultar valores'}>
            {ocultarLucro ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <Link to="/fichas/nova"
            className="btn-red flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg">
            <Plus size={14} /> Nova ficha
          </Link>
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard titulo="Total bruto"  valor={relatorio?.totalBruto || 0}       icone={TrendingUp} moeda ocultar={ocultarLucro} />
        <StatCard titulo="Fichas"       valor={relatorio?.quantidadeFichas || 0} icone={FileText} />
        <StatCard titulo="Carros"       valor={relatorio?.totalManobras || 0}    icone={Car} />
        <StatCard titulo="Quanto ficou" valor={relatorio?.valorLiquidoTotal || 0} icone={DollarSign} moeda destaque ocultar={ocultarLucro} />
      </div>

      {/* ── Gráfico ── */}
      {fichasGrafico.length > 0 && (
        <div ref={graficoRef} className="card-dark p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white text-sm" style={{ letterSpacing: '-0.02em' }}>
                Valor líquido por dia
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--hp-muted)' }}>Últimas fichas do mês</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(212,48,42,0.08)', border: '1px solid rgba(212,48,42,0.15)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--hp-red)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--hp-red)' }}>Líquido</span>
            </div>
          </div>
          <GraficoLinha fichas={fichasGrafico} />
        </div>
      )}

      {/* ── Histórico 6 meses ── */}
      {historico.length > 0 && (
        <div ref={historicoRef} className="card-dark p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white text-sm" style={{ letterSpacing: '-0.02em' }}>
                Evolução dos últimos 6 meses
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--hp-muted)' }}>Valor líquido mensal</p>
            </div>
          </div>
          <GraficoBarras meses={historico} />
        </div>
      )}

      {/* ── Fichas recentes ── */}
      <div className="card-dark">
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--hp-border)' }}>
          <h2 className="font-semibold text-white text-sm" style={{ letterSpacing: '-0.02em' }}>
            Fichas recentes
          </h2>
          <Link to="/fichas"
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: 'var(--hp-red)' }}>
            Ver todas <ArrowRight size={11} />
          </Link>
        </div>

        {fichasRecentes.length === 0 ? (
          <div className="p-14 text-center">
            <FileText size={34} className="mx-auto mb-3" style={{ color: '#2a2a2a' }} />
            <p className="text-sm mb-4" style={{ color: 'var(--hp-muted)' }}>Nenhuma ficha ainda</p>
            <Link to="/fichas/nova" className="text-sm font-medium" style={{ color: 'var(--hp-red)' }}>
              + Criar primeira ficha
            </Link>
          </div>
        ) : (
          fichasRecentes.map((ficha, i) => (
            <Link
              key={ficha.id}
              to={`/fichas/${ficha.id}`}
              className="ficha-row flex items-center justify-between px-5 py-3.5 transition-all duration-200"
              style={{
                borderBottom: i < fichasRecentes.length - 1 ? '1px solid #1a1a1a' : 'none',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.paddingLeft = '22px' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '20px' }}
            >
              <div className="flex items-center gap-3">
                {/* Indicador de data */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(212,48,42,0.08)', border: '1px solid rgba(212,48,42,0.12)' }}>
                  <FileText size={13} style={{ color: 'var(--hp-red)' }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white" style={{ letterSpacing: '-0.01em' }}>
                    {formatarData(ficha.dataFicha)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--hp-muted)' }}>
                    {ficha.unidadeNome} · {ficha.quantidadeManobras} carros
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold num"
                  style={{ color: ocultarLucro ? '#555' : parseFloat(ficha.valorLiquido) < 0 ? 'var(--hp-red)' : 'var(--hp-green)' }}>
                  {val(ficha.valorLiquido)}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#333' }}>líquido</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ titulo, valor, icone: Icone, moeda, destaque, ocultar }) {
  const el = useRef(null)

  function onEnter() {
    gsap.to(el.current, {
      y: -4, duration: 0.22, ease: 'power2.out',
      boxShadow: destaque
        ? '0 12px 40px rgba(212,48,42,0.3), 0 4px 12px rgba(0,0,0,0.5)'
        : '0 12px 32px rgba(0,0,0,0.6)',
    })
  }
  function onLeave() {
    gsap.to(el.current, {
      y: 0, duration: 0.3, ease: 'power2.out',
      boxShadow: destaque ? '0 0 24px rgba(212,48,42,0.12)' : 'none',
    })
  }

  return (
    <div
      ref={el}
      className="dash-card card-dark p-5 cursor-default"
      style={destaque ? {
        border: '1px solid rgba(212,48,42,0.3)',
        boxShadow: '0 0 24px rgba(212,48,42,0.12)',
        background: 'linear-gradient(135deg, #1a1010 0%, #141414 100%)',
      } : {}}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hp-muted)' }}>
          {titulo}
        </p>
        <div className="p-2 rounded-lg" style={{
          background: destaque ? 'rgba(212,48,42,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${destaque ? 'rgba(212,48,42,0.2)' : 'rgba(255,255,255,0.06)'}`,
        }}>
          <Icone size={13} style={{ color: destaque ? 'var(--hp-red)' : '#555' }} />
        </div>
      </div>
      <p
        className="text-2xl font-bold num"
        style={{ color: ocultar ? '#444' : destaque ? 'var(--hp-red)' : '#fff', letterSpacing: '-0.03em' }}
        data-count={ocultar ? 0 : valor}
        data-moeda={moeda ? '1' : '0'}
      >
        {ocultar ? '••••' : moeda ? formatarMoeda(valor) : valor}
      </p>
      {destaque && (
        <p className="text-xs mt-1.5 font-medium" style={{ color: 'rgba(212,48,42,0.6)' }}>
          este mês
        </p>
      )}
    </div>
  )
}

/* ── Gráfico barras 6 meses ── */
function GraficoBarras({ meses }) {
  const svgRef = useRef(null)
  const W = 560, H = 160
  const PL = 52, PR = 12, PT = 12, PB = 28
  const cW = W - PL - PR, cH = H - PT - PB

  const valores = meses.map(m => m.liquido)
  const maxVal  = Math.max(...valores, 1)
  const barW    = Math.floor(cW / meses.length * 0.55)
  const gap     = cW / meses.length

  useEffect(() => {
    svgRef.current?.querySelectorAll('.barra').forEach((el, i) => {
      const h = parseFloat(el.getAttribute('data-h')) || 0
      gsap.fromTo(el,
        { scaleY: 0, transformOrigin: 'bottom' },
        { scaleY: 1, duration: 0.5, ease: 'power2.out', delay: 0.1 + i * 0.07 }
      )
    })
  }, [meses])

  const ticks = [0, 0.5, 1].map(t => t * maxVal)

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 160 }}>
      {/* Grid */}
      {ticks.map((tick, i) => {
        const y = PT + cH - (tick / maxVal) * cH
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#1e1e1e" strokeWidth="1" strokeDasharray="3 4" />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#3a3a3a">
              {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
            </text>
          </g>
        )
      })}

      {/* Barras */}
      {meses.map((m, i) => {
        const cx  = PL + gap * i + gap / 2
        const h   = Math.max(((m.liquido / maxVal) * cH), 2)
        const y   = PT + cH - h
        const cor = m.liquido > 0 ? '#D4302A' : '#444'
        const lbl = m.liquido >= 1000 ? `${(m.liquido / 1000).toFixed(1)}k` : m.liquido.toFixed(0)

        return (
          <g key={i}>
            <rect
              className="barra"
              x={cx - barW / 2} y={y} width={barW} height={h}
              fill={cor} opacity="0.85" rx="3"
              data-h={h}
            />
            <rect x={cx - barW / 2} y={y} width={barW} height={Math.min(3, h)}
              fill={cor} rx="3" />
            <text x={cx} y={y - 5} textAnchor="middle" fontSize="8.5" fill={cor} fontWeight="700">
              {m.liquido > 0 ? lbl : ''}
            </text>
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill="#444">
              {m.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Gráfico ── */
function GraficoLinha({ fichas }) {
  const svgRef = useRef(null)

  const W = 600, H = 180
  const PL = 58, PR = 20, PT = 20, PB = 36
  const cW = W - PL - PR, cH = H - PT - PB

  const valores = fichas.map((f) => parseFloat(f.valorLiquido) || 0)
  const maxVal  = Math.max(...valores, 1)
  const minVal  = Math.min(Math.min(...valores), 0)
  const range   = maxVal - minVal || 1

  function px(i)   { return PL + (fichas.length === 1 ? cW / 2 : (i / (fichas.length - 1)) * cW) }
  function py(val) { return PT + cH - ((val - minVal) / range) * cH }

  const zeroY    = py(0)
  const pontos   = fichas.map((f, i) => `${px(i)},${py(valores[i])}`).join(' ')
  const areaPath =
    `M ${px(0)},${zeroY} ` +
    fichas.map((f, i) => `L ${px(i)},${py(valores[i])}`).join(' ') +
    ` L ${px(fichas.length - 1)},${zeroY} Z`

  const ticks = [0, 0.5, 1].map((t) => minVal + t * range)

  useEffect(() => {
    const polyline = svgRef.current?.querySelector('polyline')
    if (!polyline) return
    const len = polyline.getTotalLength?.() || 800
    gsap.fromTo(polyline,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', delay: 0.6 }
    )
    gsap.from(svgRef.current?.querySelectorAll('circle'), {
      scale: 0, opacity: 0, duration: 0.3, stagger: 0.07,
      transformOrigin: 'center', ease: 'back.out(2)', delay: 1.5,
    })
  }, [fichas])

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#D4302A" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#D4302A" stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background area */}
      <rect x={PL} y={PT} width={cW} height={cH} fill="rgba(255,255,255,0.015)" rx="6" />

      {/* Grid lines */}
      {ticks.map((tick, i) => {
        const y = py(tick)
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y}
              stroke="#1e1e1e" strokeWidth="1" strokeDasharray="3 4" />
            <text x={PL - 7} y={y + 4} textAnchor="end" fontSize="9" fill="#3a3a3a">
              {Math.abs(tick) >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick.toFixed(0)}
            </text>
          </g>
        )
      })}

      {/* Linha zero */}
      <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY}
        stroke="#2a2a2a" strokeWidth="1" />

      {/* Área */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Linha principal */}
      <polyline points={pontos}
        fill="none" stroke="#D4302A" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"
        filter="url(#glow)" />

      {/* Pontos */}
      {fichas.map((f, i) => {
        const val  = valores[i]
        const x    = px(i)
        const y    = py(val)
        const cor  = val >= 0 ? '#D4302A' : '#EF4444'
        const data = new Date(f.dataFicha + 'T00:00:00')
          .toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        const valLbl = Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)
        const lblY   = y > PT + 22 ? y - 9 : y + 17

        return (
          <g key={f.id}>
            <circle cx={x} cy={y} r="7"   fill={cor} opacity="0.08" />
            <circle cx={x} cy={y} r="3"   fill="#0d0d0d" stroke={cor} strokeWidth="2" />
            <text x={x} y={lblY} textAnchor="middle" fontSize="8.5" fill={cor} fontWeight="700">{valLbl}</text>
            <text x={x} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#3a3a3a">{data}</text>
          </g>
        )
      })}
    </svg>
  )
}
