import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import api from '../services/api'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { formatarMoeda, formatarData } from '../utils/format'
import { ArrowLeft, Trash2, Pencil, Check, X, Calendar, Plus, UserPlus } from 'lucide-react'

export default function DetalheFicha() {
  const { id } = useParams()
  const navigate = useNavigate()

  const toast   = useToast()
  const confirm = useConfirm()

  const [ficha, setFicha]       = useState(null)
  const [socios, setSocios]     = useState([])
  const [manobristas, setManobristas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]         = useState('')
  const [editandoData, setEditandoData] = useState(false)
  const [novaData, setNovaData] = useState('')
  const [salvandoData, setSalvandoData] = useState(false)

  const [editandoCarros, setEditandoCarros] = useState(false)
  const [novosCarros, setNovosCarros] = useState('')
  const [salvandoCarros, setSalvandoCarros] = useState(false)

  // estado do form de adicionar manobrista
  const [addManobra, setAddManobra] = useState(false)
  const [modoAdd, setModoAdd] = useState('existente') // 'existente' | 'novo'
  const [formManobra, setFormManobra] = useState({ manobristaId: '', nomeNovo: '', tipoPagamento: 'DIARIA_FIXA', valorPago: '' })
  const [salvandoManobra, setSalvandoManobra] = useState(false)

  const headerRef    = useRef(null)
  const resultadoRef = useRef(null)

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    try {
      const [{ data }, { data: m }] = await Promise.all([
        api.get(`/fichas/${id}`),
        api.get('/manobristas'),
      ])
      setFicha(data)
      setManobristas(m)
      try {
        const { data: s } = await api.get(`/socios/unidade/${data.unidadeId}`)
        setSocios(s)
      } catch { /* sem sócios */ }
    } catch {
      setErro('Ficha não encontrada')
    } finally {
      setCarregando(false)
    }
  }

  // Animações ao carregar
  useEffect(() => {
    if (carregando || !ficha) return

    gsap.fromTo(headerRef.current,
      { y: -20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
    )
    gsap.fromTo('.detalhe-bloco',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', stagger: 0.09, delay: 0.15 }
    )
    gsap.fromTo('.detalhe-linha',
      { x: -14, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.05, delay: 0.5 }
    )

    if (resultadoRef.current) {
      gsap.fromTo(resultadoRef.current,
        { scale: 0.85, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)', delay: 0.7 }
      )
      const el = resultadoRef.current.querySelector('[data-liquido]')
      if (el) {
        const final = parseFloat(ficha.valorLiquido) || 0
        const obj   = { val: 0 }
        gsap.to(obj, {
          val: final, duration: 1.2, ease: 'power2.out', delay: 0.8,
          onUpdate() { el.textContent = formatarMoeda(obj.val) },
        })
      }
    }
  }, [carregando, ficha])

  async function salvarData() {
    if (!novaData) return
    setSalvandoData(true)
    try {
      const { data } = await api.patch(`/fichas/${id}/data`, { dataFicha: novaData })
      setFicha(data)
      setEditandoData(false)
      toast('Data alterada com sucesso')
    } catch {
      toast('Erro ao alterar data', 'error')
    } finally {
      setSalvandoData(false)
    }
  }

  async function excluir() {
    const ok = await confirm('Tem certeza que deseja excluir esta ficha? Essa ação não pode ser desfeita.')
    if (!ok) return
    try {
      await api.delete(`/fichas/${id}`)
      toast('Ficha excluída com sucesso')
      navigate('/fichas')
    } catch {
      toast('Erro ao excluir ficha', 'error')
    }
  }

  async function salvarCarros() {
    if (novosCarros === '' || parseInt(novosCarros) < 0) return
    setSalvandoCarros(true)
    try {
      const { data } = await api.patch(`/fichas/${id}/carros`, { quantidadeManobras: parseInt(novosCarros) })
      setFicha(data)
      setEditandoCarros(false)
      toast('Quantidade de carros atualizada')
    } catch {
      toast('Erro ao atualizar carros', 'error')
    } finally {
      setSalvandoCarros(false)
    }
  }

  async function adicionarLancamento() {
    if (modoAdd === 'existente' && !formManobra.manobristaId) {
      toast('Selecione um manobrista', 'error'); return
    }
    if (modoAdd === 'novo' && !formManobra.nomeNovo.trim()) {
      toast('Informe o nome do manobrista', 'error'); return
    }
    if (!formManobra.valorPago) {
      toast('Informe o valor pago', 'error'); return
    }

    setSalvandoManobra(true)
    try {
      let manobristaId = formManobra.manobristaId

      if (modoAdd === 'novo') {
        const { data: novoMan } = await api.post('/manobristas', { nome: formManobra.nomeNovo.trim() })
        manobristaId = novoMan.id
        setManobristas(prev => [...prev, novoMan])
      }

      const { data } = await api.post(`/fichas/${id}/lancamentos`, {
        manobristaId: parseInt(manobristaId),
        tipoPagamento: formManobra.tipoPagamento,
        valorPago: parseFloat(String(formManobra.valorPago).replace(',', '.')),
      })
      setFicha(data)
      setAddManobra(false)
      setFormManobra({ manobristaId: '', nomeNovo: '', tipoPagamento: 'DIARIA_FIXA', valorPago: '' })
      toast('Manobrista adicionado')
    } catch (err) {
      toast(err.response?.data?.mensagem || 'Erro ao adicionar manobrista', 'error')
    } finally {
      setSalvandoManobra(false)
    }
  }

  async function removerLancamento(lancId) {
    const ok = await confirm('Remover este manobrista da ficha?')
    if (!ok) return
    try {
      const { data } = await api.delete(`/fichas/${id}/lancamentos/${lancId}`)
      setFicha(data)
      toast('Manobrista removido')
    } catch {
      toast('Erro ao remover manobrista', 'error')
    }
  }

  function cancelarAdd() {
    setAddManobra(false)
    setModoAdd('existente')
    setFormManobra({ manobristaId: '', nomeNovo: '', tipoPagamento: 'DIARIA_FIXA', valorPago: '' })
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-7 h-7 border-2 rounded-full mx-auto mb-3 animate-spin"
            style={{ borderColor: '#222', borderTopColor: 'var(--hp-red)' }} />
          <p className="text-xs tracking-widest uppercase" style={{ color: '#444' }}>Carregando</p>
        </div>
      </div>
    )
  }

  if (erro || !ficha) {
    return (
      <div className="p-8">
        <button onClick={() => navigate('/fichas')}
          className="flex items-center gap-2 mb-4 text-sm" style={{ color: '#555' }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="p-4 rounded-lg text-sm"
          style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
          {erro || 'Ficha não encontrada'}
        </div>
      </div>
    )
  }

  const valorDinheiro = ficha.valorDinheiro || 0

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div ref={headerRef} className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate('/fichas')}
            className="flex items-center gap-2 mb-3 text-sm transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}>
            <ArrowLeft size={15} /> Voltar
          </button>
          {editandoData ? (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div style={{ minWidth: 230 }}>
                <CampoData valor={novaData} onChange={setNovaData} />
              </div>
              <button onClick={salvarData} disabled={salvandoData || !novaData}
                className="p-1.5 rounded-lg disabled:opacity-50"
                style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                <Check size={15} />
              </button>
              <button onClick={() => setEditandoData(false)}
                className="p-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#666', border: '1px solid var(--hp-border)' }}>
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
                Ficha de {formatarData(ficha.dataFicha)}
              </h1>
              <button onClick={() => { setNovaData(ficha.dataFicha); setEditandoData(true) }}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#444' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.background = 'transparent' }}>
                <Pencil size={13} />
              </button>
            </div>
          )}
          <p className="text-sm mt-1" style={{ color: '#555' }}>{ficha.unidadeNome}</p>
        </div>
        <button onClick={excluir}
          className="px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors mt-6"
          style={{ color: '#555' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--hp-red)'; e.currentTarget.style.background = 'rgba(212,48,42,0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent' }}>
          <Trash2 size={15} /> Excluir
        </button>
      </div>

      {/* Ficha do dia */}
      <Bloco titulo="Ficha do dia">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoItem label="Início da ficha" valor={ficha.valorInicial ?? '—'} />
          <InfoItem label="Fim da ficha"    valor={ficha.valorFinal ?? '—'} />
          <div>
            <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: '#555' }}>Total de carros</p>
            {editandoCarros ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="text" inputMode="numeric"
                  value={novosCarros}
                  onChange={e => setNovosCarros(e.target.value.replace(/\D/g, ''))}
                  className="input-dark text-sm font-bold"
                  style={{ width: 70, padding: '4px 8px' }}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') salvarCarros(); if (e.key === 'Escape') setEditandoCarros(false) }}
                />
                <button onClick={salvarCarros} disabled={salvandoCarros || novosCarros === ''}
                  className="p-1.5 rounded-lg disabled:opacity-50"
                  style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
                  <Check size={13} />
                </button>
                <button onClick={() => setEditandoCarros(false)}
                  className="p-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#666', border: '1px solid var(--hp-border)' }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-base font-bold num" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
                  {ficha.quantidadeManobras} carros
                </p>
                <button onClick={() => { setNovosCarros(String(ficha.quantidadeManobras)); setEditandoCarros(true) }}
                  className="p-1 rounded transition-colors"
                  style={{ color: '#444' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#444'; e.currentTarget.style.background = 'transparent' }}>
                  <Pencil size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </Bloco>

      {/* Pagamentos */}
      <Bloco titulo="Pagamentos" className="mt-4">
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Total bruto"       valor={formatarMoeda(ficha.totalBruto)} destaque />
          <InfoItem label="Valor em cartão"   valor={formatarMoeda(ficha.valorEmCartao)} />
          <InfoItem label="Valor em dinheiro" valor={formatarMoeda(valorDinheiro)} />
          <InfoItem label={`Taxa da máquina (${ficha.porcentagemCartao}%)`}
                    valor={`− ${formatarMoeda(ficha.taxaCartao)}`} vermelho />
        </div>
      </Bloco>

      {/* Manobristas */}
      <Bloco titulo="Manobristas" className="mt-4" acao={
        !addManobra && (
          <button onClick={() => setAddManobra(true)}
            className="text-sm font-medium flex items-center gap-1"
            style={{ color: 'var(--hp-red)' }}>
            <Plus size={14} /> Adicionar
          </button>
        )
      }>
        {ficha.lancamentos.length === 0 && !addManobra
          ? <p className="text-sm text-center py-3" style={{ color: '#444' }}>Nenhum manobrista</p>
          : (
            <div>
              {ficha.lancamentos.map((l) => (
                <div key={l.id} className="detalhe-linha flex justify-between items-center py-2.5"
                  style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <span className="text-sm font-medium text-white">{l.manobristaNome}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: '#aaa' }}>{formatarMoeda(l.valorPago)}</span>
                    <button onClick={() => removerLancamento(l.id)}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#444' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--hp-red)'}
                      onMouseLeave={e => e.currentTarget.style.color = '#444'}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {ficha.lancamentos.length > 0 && (
                <div className="detalhe-linha flex justify-between items-center pt-3">
                  <span className="text-sm" style={{ color: '#666' }}>Total manobristas</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--hp-red)' }}>
                    − {formatarMoeda(ficha.totalPagoManobristas)}
                  </span>
                </div>
              )}
            </div>
          )}

        {/* Form inline para adicionar */}
        {addManobra && (
          <div className="mt-3 rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hp-border)' }}>

            {/* Tabs: existente / novo */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
              {[['existente', 'Manobrista existente'], ['novo', 'Novo manobrista']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setModoAdd(val)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-md transition-colors"
                  style={{
                    background: modoAdd === val ? 'var(--hp-surface)' : 'transparent',
                    color: modoAdd === val ? '#fff' : '#555',
                    border: modoAdd === val ? '1px solid var(--hp-border)' : '1px solid transparent',
                  }}>
                  {val === 'novo' && <UserPlus size={11} style={{ display: 'inline', marginRight: 4 }} />}
                  {label}
                </button>
              ))}
            </div>

            {/* Campo: selecionar ou nome novo */}
            {modoAdd === 'existente' ? (
              <select value={formManobra.manobristaId}
                onChange={e => setFormManobra(f => ({ ...f, manobristaId: e.target.value }))}
                className="input-dark text-sm w-full">
                <option value="">Selecione o manobrista...</option>
                {manobristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            ) : (
              <input type="text" placeholder="Nome do novo manobrista"
                value={formManobra.nomeNovo}
                onChange={e => setFormManobra(f => ({ ...f, nomeNovo: e.target.value }))}
                className="input-dark text-sm w-full" />
            )}

            {/* Tipo de pagamento */}
            <select value={formManobra.tipoPagamento}
              onChange={e => setFormManobra(f => ({ ...f, tipoPagamento: e.target.value }))}
              className="input-dark text-xs w-full" style={{ color: '#888' }}>
              <option value="DIARIA_FIXA">Diária fixa</option>
              <option value="VALOR_FIXO_POR_MANOBRA">Por manobra</option>
              <option value="PORCENTAGEM">Porcentagem</option>
            </select>

            {/* Valor pago */}
            <div className="relative flex items-center">
              <span className="absolute left-0 flex items-center justify-center h-full w-10 text-xs font-semibold pointer-events-none select-none"
                style={{
                  color: '#fff',
                  background: 'rgba(255,255,255,0.06)',
                  borderRight: '1px solid var(--hp-border)',
                  borderRadius: '8px 0 0 8px',
                }}>
                R$
              </span>
              <input type="text" inputMode="decimal" placeholder="0,00"
                value={formManobra.valorPago}
                onChange={e => setFormManobra(f => ({ ...f, valorPago: e.target.value.replace(/[^\d.,]/g, '') }))}
                className="input-dark text-sm w-full" style={{ paddingLeft: 48 }} />
            </div>

            {/* Botões */}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={cancelarAdd}
                className="px-4 py-1.5 rounded-lg text-xs transition-colors"
                style={{ border: '1px solid var(--hp-border)', color: '#666' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}>
                Cancelar
              </button>
              <button type="button" onClick={adicionarLancamento} disabled={salvandoManobra}
                className="btn-red px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50">
                <Check size={13} />
                {salvandoManobra ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </Bloco>

      {/* Despesas */}
      {ficha.despesas.length > 0 && (
        <Bloco titulo="Despesas adicionais" className="mt-4">
          <div>
            {ficha.despesas.map((d) => (
              <div key={d.id} className="detalhe-linha flex justify-between items-center py-2.5"
                style={{ borderBottom: '1px solid #1a1a1a' }}>
                <span className="text-sm" style={{ color: '#aaa' }}>{d.descricao}</span>
                <span className="text-sm font-semibold" style={{ color: '#aaa' }}>{formatarMoeda(d.valor)}</span>
              </div>
            ))}
            <div className="detalhe-linha flex justify-between items-center pt-3">
              <span className="text-sm" style={{ color: '#666' }}>Total despesas</span>
              <span className="text-sm font-bold" style={{ color: 'var(--hp-red)' }}>
                − {formatarMoeda(ficha.totalDespesas)}
              </span>
            </div>
          </div>
        </Bloco>
      )}

      {/* Resultado */}
      {(() => {
        const liquido = parseFloat(ficha.valorLiquido) || 0
        const negativo = liquido < 0
        return (
          <div ref={resultadoRef} className="mt-4 card-dark p-5"
            style={{
              border: negativo
                ? '1px solid rgba(212,48,42,0.6)'
                : '1px solid rgba(74,222,128,0.25)',
              background: negativo
                ? 'linear-gradient(135deg, #1a1010 0%, #141414 100%)'
                : 'linear-gradient(135deg, #0d1a10 0%, #141414 100%)',
            }}>
            <div className="space-y-2.5 mb-4 text-sm">
              <div className="detalhe-linha flex justify-between">
                <span style={{ color: '#666' }}>Total bruto</span>
                <span className="font-semibold text-white">{formatarMoeda(ficha.totalBruto)}</span>
              </div>
              <div className="detalhe-linha flex justify-between">
                <span style={{ color: '#666' }}>− Taxa da máquina</span>
                <span className="font-semibold" style={{ color: 'var(--hp-red)' }}>{formatarMoeda(ficha.taxaCartao)}</span>
              </div>
              <div className="detalhe-linha flex justify-between">
                <span style={{ color: '#666' }}>− Manobristas</span>
                <span className="font-semibold" style={{ color: 'var(--hp-red)' }}>{formatarMoeda(ficha.totalPagoManobristas)}</span>
              </div>
              {ficha.totalDespesas > 0 && (
                <div className="detalhe-linha flex justify-between">
                  <span style={{ color: '#666' }}>− Despesas</span>
                  <span className="font-semibold" style={{ color: 'var(--hp-red)' }}>{formatarMoeda(ficha.totalDespesas)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-4"
              style={{ borderTop: '1px solid var(--hp-border)' }}>
              <div>
                <span className="text-sm font-semibold" style={{ color: '#888' }}>
                  {negativo ? 'Resultado:' : 'Quanto ficou:'}
                </span>
                {negativo && (
                  <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--hp-red)' }}>
                    Despesas maiores que o bruto
                  </p>
                )}
              </div>
              <span className="text-3xl font-bold num" data-liquido
                style={{ color: negativo ? 'var(--hp-red)' : '#4ade80', letterSpacing: '-0.03em' }}>
                {formatarMoeda(liquido)}
              </span>
            </div>
          </div>
        )
      })()}

      {/* Divisão por sócios */}
      {socios.length > 0 && (
        <Bloco titulo="Divisão entre sócios" className="mt-4">
          <div>
            {socios.map((s) => {
              const valor = (ficha.valorLiquido * s.porcentagem) / 100
              return (
                <div key={s.id} className="detalhe-linha flex justify-between items-center py-2.5"
                  style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{s.nome}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(212,48,42,0.1)', color: 'var(--hp-red)', border: '1px solid rgba(212,48,42,0.2)' }}>
                      {parseFloat(s.porcentagem).toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#4ade80' }}>
                    {formatarMoeda(valor)}
                  </span>
                </div>
              )
            })}
          </div>
        </Bloco>
      )}

      {/* Observações */}
      {ficha.observacoes && (
        <Bloco titulo="Observações" className="mt-4">
          <p className="text-sm" style={{ color: '#aaa' }}>{ficha.observacoes}</p>
        </Bloco>
      )}

    </div>
  )
}

function Bloco({ titulo, children, className = '', acao }) {
  return (
    <div className={`detalhe-bloco card-dark ${className}`}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hp-border)' }}>
        <h2 className="font-semibold text-white text-sm">{titulo}</h2>
        {acao}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoItem({ label, valor, destaque, vermelho }) {
  return (
    <div>
      <p className="text-xs mb-1 uppercase tracking-wide" style={{ color: '#555' }}>{label}</p>
      <p className="text-base font-bold num" style={{
        color: destaque ? 'var(--hp-red)' : vermelho ? '#ff6b6b' : '#fff',
        letterSpacing: '-0.02em',
      }}>
        {valor}
      </p>
    </div>
  )
}

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const selectStyle = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: 'var(--hp-text)',
  fontSize: 13,
  cursor: 'pointer',
  padding: '0 2px',
  minWidth: 0,
}

function CampoData({ valor, onChange }) {
  const partes = valor ? valor.split('-') : ['', '', '']
  const anoVal = partes[0] || ''
  const mesVal = partes[1] || ''
  const diaVal = partes[2] || ''

  function update(novoAno, novoMes, novoDia) {
    if (novoAno && novoMes && novoDia) {
      onChange(`${novoAno}-${String(novoMes).padStart(2,'0')}-${String(novoDia).padStart(2,'0')}`)
    } else {
      onChange('')
    }
  }

  const dias = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))

  return (
    <div className="flex items-center gap-1" style={{
      background: 'var(--hp-surface)',
      border: '1px solid var(--hp-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '0 12px',
      height: 42,
    }}>
      <Calendar size={13} style={{ color: 'var(--hp-red)', flexShrink: 0, marginRight: 6 }} />
      <select value={diaVal} onChange={e => update(anoVal, mesVal, e.target.value)}
        style={{ ...selectStyle, flex: '0 0 44px' }}>
        <option value="">Dia</option>
        {dias.map(d => <option key={d} value={d}>{parseInt(d)}</option>)}
      </select>
      <span style={{ color: 'var(--hp-border)', margin: '0 2px' }}>/</span>
      <select value={mesVal} onChange={e => update(anoVal, e.target.value, diaVal)}
        style={{ ...selectStyle, flex: '0 0 90px' }}>
        <option value="">Mês</option>
        {MESES_NOMES.map((nome, i) => (
          <option key={i} value={String(i + 1).padStart(2, '0')}>{nome}</option>
        ))}
      </select>
      <span style={{ color: 'var(--hp-border)', margin: '0 2px' }}>/</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="Ano"
        maxLength={4}
        value={anoVal}
        onChange={e => update(e.target.value.replace(/\D/g, ''), mesVal, diaVal)}
        style={{ ...selectStyle, flex: '0 0 50px', background: 'transparent', border: 'none', outline: 'none' }}
      />
    </div>
  )
}
