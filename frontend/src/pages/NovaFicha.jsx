import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { formatarMoeda, dataHoje } from '../utils/format'
import { Plus, Trash2, Save, ArrowLeft, Calendar } from 'lucide-react'

export default function NovaFicha() {
  const navigate = useNavigate()
  const { usuario, isDono } = useAuth()

  const [unidades, setUnidades] = useState([])
  const [manobristas, setManobristas] = useState([])

  const [form, setForm] = useState({
    dataFicha: dataHoje(),
    unidadeId: '',
    valorInicial: '',
    valorFinal: '',
    quantidadeManobras: '',
    valorEmCartao: '',
    valorDinheiro: '',
    porcentagemCartao: '',
    observacoes: '',
  })

  const [lancamentos, setLancamentos] = useState([])
  const [despesas, setDespesas] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const formRef = useRef(null)

  useEffect(() => { carregarOpcoes() }, [])

  useEffect(() => {
    gsap.fromTo(formRef.current,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', delay: 0.05 }
    )
  }, [])

  async function carregarOpcoes() {
    try {
      const [u, m] = await Promise.all([api.get('/unidades'), api.get('/manobristas')])
      setUnidades(u.data)
      setManobristas(m.data)
      if (!isDono && usuario?.unidadeId) {
        setForm((f) => ({ ...f, unidadeId: usuario.unidadeId }))
      }
    } catch {
      setErro('Erro ao carregar dados')
    }
  }

  const calculos = useMemo(() => {
    const cartao = parseFloat(form.valorEmCartao) || 0
    const dinheiro = parseFloat(form.valorDinheiro) || 0
    const totalBruto = cartao + dinheiro

    const pctMaquina = parseFloat(form.porcentagemCartao) || 0
    const taxaMaquina = cartao * (pctMaquina / 100)

    const totalManobristas = lancamentos.reduce((acc, l) => acc + (parseFloat(l.valorPago) || 0), 0)
    const totalDespesas = despesas.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0)
    const liquido = totalBruto - taxaMaquina - totalManobristas - totalDespesas

    return { totalBruto, cartao, dinheiro, taxaMaquina, totalManobristas, totalDespesas, liquido }
  }, [form, lancamentos, despesas])

  function set(campo, valor) { setForm({ ...form, [campo]: valor }) }

  function addLancamento() {
    setLancamentos([...lancamentos, { manobristaId: '', tipoPagamento: 'DIARIA_FIXA', valorPago: '' }])
  }
  function setLanc(i, campo, valor) {
    const novos = [...lancamentos]
    novos[i] = { ...novos[i], [campo]: valor }
    setLancamentos(novos)
  }
  function removeLanc(i) { setLancamentos(lancamentos.filter((_, idx) => idx !== i)) }

  function addDespesa() { setDespesas([...despesas, { descricao: '', valor: '' }]) }
  function setDesp(i, campo, valor) {
    const novas = [...despesas]
    novas[i] = { ...novas[i], [campo]: valor }
    setDespesas(novas)
  }
  function removeDesp(i) { setDespesas(despesas.filter((_, idx) => idx !== i)) }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    if (!form.unidadeId) { setErro('Selecione a unidade'); return }
    if (form.valorInicial === '') { setErro('Informe o valor inicial da ficha'); return }
    if (form.valorFinal === '') { setErro('Informe o valor final da ficha'); return }
    if (form.quantidadeManobras === '') { setErro('Informe o total de carros'); return }
    if (lancamentos.some(l => !l.manobristaId)) { setErro('Selecione o manobrista em todos os lançamentos'); return }
    if (lancamentos.some(l => l.valorPago === '')) { setErro('Informe o valor pago em todos os lançamentos'); return }
    if (despesas.some(d => !d.descricao.trim())) { setErro('Informe a descrição em todas as despesas'); return }
    if (despesas.some(d => d.valor === '')) { setErro('Informe o valor em todas as despesas'); return }

    setSalvando(true)
    try {
      await api.post('/fichas', {
        dataFicha: form.dataFicha,
        unidadeId: parseInt(form.unidadeId),
        valorInicial: parseInt(form.valorInicial) || 0,
        valorFinal: parseInt(form.valorFinal) || 0,
        quantidadeManobras: parseInt(form.quantidadeManobras) || 0,
        porcentagemCartao: parseFloat(form.porcentagemCartao) || 0,
        valorEmCartao: parseFloat(form.valorEmCartao) || 0,
        valorDinheiro: parseFloat(form.valorDinheiro) || 0,
        observacoes: form.observacoes,
        lancamentos: lancamentos.map((l) => ({
          manobristaId: parseInt(l.manobristaId),
          tipoPagamento: l.tipoPagamento || 'DIARIA_FIXA',
          valorPago: parseFloat(l.valorPago) || 0,
        })),
        despesas: despesas.map((d) => ({
          descricao: d.descricao,
          valor: parseFloat(d.valor) || 0,
        })),
      })
      navigate('/fichas')
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao salvar ficha')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/fichas')}
        className="flex items-center gap-2 mb-5 text-sm transition-colors"
        style={{ color: '#555' }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = '#555'}>
        <ArrowLeft size={16} /> Voltar
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Nova ficha</h1>

      {erro && (
        <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2"
          style={{ background: 'rgba(212,48,42,0.1)', border: '1px solid rgba(212,48,42,0.3)', color: '#ff7070' }}>
          {erro}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

        {/* ── 1. DADOS DA FICHA ── */}
        <Bloco titulo="Dados da ficha">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Data" obrigatorio>
              <CampoData valor={form.dataFicha} onChange={(v) => set('dataFicha', v)} />
            </Campo>

            <Campo label="Unidade" obrigatorio>
              <select value={form.unidadeId}
                onChange={(e) => set('unidadeId', e.target.value)}
                required disabled={!isDono} className={inputCls + ' disabled:bg-gray-50'}>
                <option value="">Selecione...</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </Campo>

            <Campo label="Início da ficha" obrigatorio>
              <input type="text" inputMode="numeric" pattern="[0-9]*" min="0" value={form.valorInicial}
                onChange={(e) => set('valorInicial', e.target.value.replace(/\D/g, ''))}
                required placeholder="ex: 1500" className={inputCls} />
            </Campo>

            <Campo label="Fim da ficha" obrigatorio>
              <input type="text" inputMode="numeric" pattern="[0-9]*" min="0" value={form.valorFinal}
                onChange={(e) => set('valorFinal', e.target.value.replace(/\D/g, ''))}
                required placeholder="ex: 1800" className={inputCls} />
            </Campo>

            <Campo label="Total de carros" obrigatorio>
              <input type="text" inputMode="numeric" pattern="[0-9]*" min="0" value={form.quantidadeManobras}
                onChange={(e) => set('quantidadeManobras', e.target.value.replace(/\D/g, ''))}
                required placeholder="ex: 45" className={inputCls} />
            </Campo>
          </div>
        </Bloco>

        {/* ── 2. PAGAMENTOS ── */}
        <Bloco titulo="Forma de pagamento">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Valor em cartão">
              <InputR$ valor={form.valorEmCartao} onChange={(v) => set('valorEmCartao', v)} />
            </Campo>

            <Campo label="% da máquina">
              <InputPercent valor={form.porcentagemCartao} onChange={(v) => set('porcentagemCartao', v)} />
            </Campo>

            <Campo label="Valor em dinheiro">
              <InputR$ valor={form.valorDinheiro} onChange={(v) => set('valorDinheiro', v)} />
            </Campo>

            <Campo label="Taxa da máquina">
              <div className="input-dark text-sm flex items-center" style={{ color: 'var(--hp-red)', opacity: 0.9 }}>
                − {formatarMoeda(calculos.taxaMaquina)}
              </div>
            </Campo>
          </div>
        </Bloco>

        {/* ── 3. MANOBRISTAS ── */}
        <Bloco titulo="Manobristas" acao={
          <button type="button" onClick={addLancamento}
            className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--hp-red)' }}>
            <Plus size={15} /> Adicionar
          </button>
        }>
          {manobristas.length === 0 && (
            <div className="mb-3 p-3 rounded-lg text-sm flex items-center justify-between"
              style={{ background: 'rgba(212,48,42,0.07)', border: '1px solid rgba(212,48,42,0.2)', color: '#ff9090' }}>
              <span>Nenhum manobrista cadastrado ainda.</span>
              <a href="/manobristas" target="_blank"
                className="font-semibold underline ml-2" style={{ color: 'var(--hp-red)' }}>
                Cadastrar
              </a>
            </div>
          )}
          {lancamentos.length === 0
            ? <p className="text-sm text-center py-3" style={{ color: '#444' }}>Nenhum manobrista adicionado</p>
            : (
              <div className="space-y-3">
                {lancamentos.map((l, i) => (
                  <div key={i} className="rounded-xl p-3 space-y-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hp-border)' }}>
                    {/* Linha 1: nome + botão remover */}
                    <div className="flex gap-2 items-center">
                      <select value={l.manobristaId}
                        onChange={(e) => setLanc(i, 'manobristaId', e.target.value)}
                        className="input-dark text-sm flex-1">
                        <option value="">Selecione o manobrista...</option>
                        {manobristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                      </select>
                      <button type="button" onClick={() => removeLanc(i)}
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ color: '#555', background: 'rgba(212,48,42,0.08)', border: '1px solid rgba(212,48,42,0.15)' }}>
                        <Trash2 size={15} style={{ color: 'var(--hp-red)' }} />
                      </button>
                    </div>
                    {/* Linha 2: tipo de pagamento */}
                    <select value={l.tipoPagamento || 'DIARIA_FIXA'}
                      onChange={(e) => setLanc(i, 'tipoPagamento', e.target.value)}
                      className="input-dark text-xs" style={{ color: '#888' }}>
                      <option value="DIARIA_FIXA">Diária fixa</option>
                      <option value="VALOR_FIXO_POR_MANOBRA">Por manobra</option>
                      <option value="PORCENTAGEM">Porcentagem</option>
                    </select>
                    {/* Linha 3: valor pago */}
                    <InputR$ valor={l.valorPago} onChange={(v) => setLanc(i, 'valorPago', v)} />
                  </div>
                ))}
              </div>
            )}
        </Bloco>

        {/* ── 4. DESPESAS ── */}
        <Bloco titulo="Despesas adicionais" acao={
          <button type="button" onClick={addDespesa}
            className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--hp-red)' }}>
            <Plus size={15} /> Adicionar
          </button>
        }>
          {despesas.length === 0
            ? <p className="text-sm text-center py-3" style={{ color: '#444' }}>Nenhuma despesa adicionada</p>
            : (
              <div className="space-y-3">
                {despesas.map((d, i) => (
                  <div key={i} className="rounded-xl p-3 space-y-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hp-border)' }}>
                    <div className="flex gap-2 items-center">
                      <input type="text" placeholder="O que é essa despesa..."
                        value={d.descricao}
                        onChange={(e) => setDesp(i, 'descricao', e.target.value)}
                        className="input-dark text-sm flex-1" />
                      <button type="button" onClick={() => removeDesp(i)}
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ background: 'rgba(212,48,42,0.08)', border: '1px solid rgba(212,48,42,0.15)' }}>
                        <Trash2 size={15} style={{ color: 'var(--hp-red)' }} />
                      </button>
                    </div>
                    <InputR$ valor={d.valor} onChange={(v) => setDesp(i, 'valor', v)} />
                  </div>
                ))}
              </div>
            )}
        </Bloco>

        {/* ── 5. RESULTADO ── */}
        {/* Resultado */}
        <div className="card-dark p-5" style={{ border: '1px solid rgba(212,48,42,0.3)' }}>
          <h2 className="font-semibold text-white mb-4 text-sm uppercase tracking-wide">Resultado do dia</h2>
          <div className="space-y-2 mb-4">
            <LinhaCalculo label="Total bruto"      valor={calculos.totalBruto} />
            <LinhaCalculo label="Taxa da máquina"  valor={calculos.taxaMaquina}      desconto />
            <LinhaCalculo label="Manobristas"      valor={calculos.totalManobristas} desconto />
            <LinhaCalculo label="Despesas"         valor={calculos.totalDespesas}    desconto />
          </div>
          <div className="flex items-center justify-between pt-4"
            style={{ borderTop: '1px solid var(--hp-border)' }}>
            <span className="text-sm font-semibold" style={{ color: '#888' }}>Quanto ficou:</span>
            <span className="text-3xl font-bold"
              style={{ color: calculos.liquido >= 0 ? '#4ade80' : 'var(--hp-red)' }}>
              {formatarMoeda(calculos.liquido)}
            </span>
          </div>
        </div>

        <Campo label="Observações">
          <textarea value={form.observacoes}
            onChange={(e) => set('observacoes', e.target.value)}
            rows={2} placeholder="Alguma anotação sobre o dia..."
            className="input-dark text-sm resize-none" />
        </Campo>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/fichas')}
            className="px-5 py-2.5 rounded-lg text-sm transition-colors"
            style={{ border: '1px solid var(--hp-border)', color: '#666' }}
            onMouseEnter={e => { e.currentTarget.style.color='#fff'; e.currentTarget.style.background='rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#666'; e.currentTarget.style.background='transparent' }}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando} className="btn-red flex items-center gap-2 px-5 py-2.5 text-sm">
            <Save size={15} />
            {salvando ? 'Salvando...' : 'Salvar ficha'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Estilos ──
const inputCls = 'input-dark text-sm'

// ── Componentes auxiliares ──
function Bloco({ titulo, acao, children }) {
  return (
    <div className="card-dark">
      <div className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--hp-border)' }}>
        <h2 className="font-semibold text-white text-sm">{titulo}</h2>
        {acao}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Campo({ label, obrigatorio, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide"
        style={{ color: '#555' }}>
        {label} {obrigatorio && <span style={{ color: 'var(--hp-red)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function InputR$({ valor, onChange }) {
  function handleChange(e) {
    // Aceita só números e vírgula/ponto
    const raw = e.target.value.replace(/[^\d.,]/g, '')
    onChange(raw)
  }

  function handleBlur(e) {
    // Ao sair do campo, converte para número float limpo
    const num = parseFloat(e.target.value.replace(',', '.')) || ''
    onChange(num === '' ? '' : String(num))
  }

  return (
    <div className="relative flex items-center">
      <span className="absolute left-0 flex items-center justify-center h-full w-10 text-xs font-semibold pointer-events-none select-none"
        style={{
          color: '#fff',
          background: 'rgba(255,255,255,0.06)',
          borderRight: '1px solid var(--hp-border)',
          borderRadius: '8px 0 0 8px',
          height: '100%',
        }}>
        R$
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={handleChange}
        onBlur={handleBlur}
        className="input-dark text-sm"
        style={{ paddingLeft: '48px' }}
        placeholder="0,00"
      />
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

function LinhaCalculo({ label, valor, desconto }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: '#666' }}>{desconto ? `− ${label}` : label}</span>
      <span className="font-semibold" style={{ color: desconto ? 'var(--hp-red)' : '#ccc' }}>
        {formatarMoeda(valor)}
      </span>
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
      transition: 'border-color .18s',
    }}
      onFocus={e => e.currentTarget.style.borderColor = 'var(--hp-red)'}
      onBlur={e => e.currentTarget.style.borderColor = 'var(--hp-border)'}
    >
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
