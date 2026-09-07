import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'
import { gsap } from 'gsap'
import api from '../services/api'
import {
  LayoutDashboard, FileText, Building2, Users,
  BarChart3, LogOut, ChevronRight, Users2, PieChart,
  UserCog, KeyRound, X, Save, Menu, MoreHorizontal, Receipt, Car
} from 'lucide-react'

export default function Layout({ children }) {
  const { usuario, logout, isDono } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const toast     = useToast()
  const sidebarRef = useRef(null)

  const [menuAberto, setMenuAberto] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [senhaForm, setSenhaForm]   = useState({ senhaAtual: '', novaSenha: '', confirmar: '' })
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const modalRef    = useRef(null)
  const modalAberto = useRef(false)

  const menuItens = [
    { path: '/dashboard',     label: 'Dashboard',        icon: LayoutDashboard },
    { path: '/fichas',        label: 'Fichas',           icon: FileText },
    { path: '/relatorios',    label: 'Relatórios',       icon: BarChart3 },
    { path: '/manobristas',   label: 'Manobristas',      icon: Users },
    { path: '/divisao-lucro', label: 'Divisão de Lucro', icon: PieChart },
    { path: '/despesas',      label: 'Despesas',         icon: Receipt },
    { path: '/carros',        label: 'Carros por Mês',   icon: Car },
    ...(isDono ? [
      { path: '/unidades', label: 'Unidades', icon: Building2 },
      { path: '/socios',   label: 'Sócios',   icon: Users2 },
      { path: '/usuarios', label: 'Usuários', icon: UserCog },
    ] : []),
  ]

  // Itens da barra inferior (mobile)
  const navBottom = [
    { path: '/dashboard',  label: 'Início',   icon: LayoutDashboard },
    { path: '/fichas',     label: 'Fichas',   icon: FileText },
    { path: '/despesas',   label: 'Despesas', icon: Receipt },
    { path: '/carros',     label: 'Carros',   icon: Car },
  ]

  // "Mais" fica ativo quando a página atual não está na barra inferior
  const maisAtivo = !navBottom.some(n => location.pathname.startsWith(n.path))

  // Fecha menu ao trocar de rota
  useEffect(() => { setMenuAberto(false) }, [location.pathname])

  // Bloqueia scroll do body quando menu mobile aberto
  useEffect(() => {
    document.body.style.overflow = menuAberto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuAberto])

  useEffect(() => {
    gsap.fromTo(sidebarRef.current,
      { x: -60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.55, ease: 'power3.out' }
    )
    gsap.fromTo('.menu-item',
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.38, ease: 'power2.out', stagger: 0.055, delay: 0.28 }
    )
  }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') { fecharModal(); setMenuAberto(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (modalSenha && !modalAberto.current && modalRef.current) {
      modalAberto.current = true
      gsap.fromTo(modalRef.current,
        { scale: 0.92, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
      )
    }
    if (!modalSenha) modalAberto.current = false
  }, [modalSenha])

  function fecharModal() {
    setModalSenha(false)
    setSenhaForm({ senhaAtual: '', novaSenha: '', confirmar: '' })
  }

  async function handleTrocarSenha(e) {
    e.preventDefault()
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      toast('As senhas não coincidem', 'error'); return
    }
    if (senhaForm.novaSenha.length < 6) {
      toast('Nova senha deve ter pelo menos 6 caracteres', 'error'); return
    }
    setSalvandoSenha(true)
    try {
      await api.put('/usuarios/senha', { senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha })
      toast('Senha alterada com sucesso')
      fecharModal()
    } catch (err) {
      toast(err.response?.data?.mensagem || 'Erro ao alterar senha', 'error')
    } finally {
      setSalvandoSenha(false)
    }
  }

  function handleLogout() { logout(); navigate('/login') }

  const iniciais = usuario?.nome
    ? usuario.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : '?'

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--hp-bg)' }}>

      {/* ─────────────────────────────────────────────
          SIDEBAR — só visível no desktop (md+)
      ───────────────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        className="hidden md:flex w-60 flex-col flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, #111111 0%, #0d0d0d 100%)',
          borderRight: '1px solid var(--hp-border)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Glow lateral */}
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
          background: 'linear-gradient(180deg, transparent 0%, rgba(212,48,42,0.15) 40%, rgba(212,48,42,0.08) 70%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3"
          style={{ borderBottom: '1px solid var(--hp-border)' }}>
          <img src="/logo.png" alt="Hitman Park" className="h-8 w-8 object-contain rounded-lg"
            onError={e => e.target.style.display = 'none'} />
          <div>
            <p className="text-white font-bold text-sm tracking-widest">HITMAN</p>
            <p className="text-xs tracking-wider" style={{ color: 'var(--hp-red)', marginTop: '-1px' }}>PARK</p>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {menuItens.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} className="menu-item"
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 9,
                fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : 'var(--hp-muted)',
                background: isActive ? 'rgba(212,48,42,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(212,48,42,0.2)' : '1px solid transparent',
                transition: 'all 0.18s', textDecoration: 'none',
              })}
              onMouseEnter={e => { if (!e.currentTarget.style.background.includes('rgba(212')) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!e.currentTarget.style.background.includes('rgba(212')) e.currentTarget.style.background = 'transparent' }}
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {isActive && <ChevronRight size={12} style={{ opacity: 0.5 }} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Usuário */}
        <div className="px-2.5 py-3" style={{ borderTop: '1px solid var(--hp-border)' }}>
          <div className="flex items-center gap-3 px-2.5 py-2 mb-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--hp-red), var(--hp-red-d))', color: '#fff' }}>
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{usuario?.nome}</p>
              <p className="text-xs truncate" style={{ color: 'var(--hp-red)', fontSize: 10.5 }}>
                {usuario?.tipo === 'DONO' ? 'Proprietário' : usuario?.unidadeNome}
              </p>
            </div>
            <button onClick={() => setModalSenha(true)} title="Trocar senha"
              className="p-1 rounded flex-shrink-0" style={{ color: '#444' }}
              onMouseEnter={e => e.currentTarget.style.color = '#888'}
              onMouseLeave={e => e.currentTarget.style.color = '#444'}>
              <KeyRound size={13} />
            </button>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all"
            style={{ color: 'var(--hp-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--hp-muted)'; e.currentTarget.style.background = 'transparent' }}>
            <LogOut size={13} /> Sair da conta
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────
          ÁREA PRINCIPAL
      ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar mobile */}
        <header className="md:hidden flex items-center px-4 py-3 sticky top-0 z-30"
          style={{ background: '#0d0d0d', borderBottom: '1px solid var(--hp-border)' }}>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="HP" className="h-7 w-7 object-contain rounded"
              onError={e => e.target.style.display = 'none'} />
            <span className="text-white font-bold text-sm tracking-widest">HITMAN PARK</span>
          </div>
        </header>

        {/* Conteúdo — padding bottom no mobile para não ficar atrás da barra */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0" style={{ background: 'var(--hp-bg)' }}>
          {children}
        </main>
      </div>

      {/* ─────────────────────────────────────────────
          BARRA INFERIOR MOBILE (navegação rápida)
      ───────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center"
        style={{
          background: '#0d0d0d',
          borderTop: '1px solid var(--hp-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {navBottom.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '10px 4px 8px',
              color: isActive ? 'var(--hp-red)' : '#555',
              textDecoration: 'none', touchAction: 'manipulation',
            })}>
            {({ isActive }) => (
              <>
                <Icon size={22} />
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {/* Botão "Mais" — abre menu completo; ativo quando fora da barra inferior */}
        <button
          onClick={() => setMenuAberto(true)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, padding: '10px 4px 8px',
            color: maisAtivo ? 'var(--hp-red)' : '#555',
            background: 'none', border: 'none',
            touchAction: 'manipulation',
          }}>
          <MoreHorizontal size={22} />
          <span style={{ fontSize: 10, fontWeight: maisAtivo ? 600 : 400 }}>Mais</span>
        </button>
      </nav>

      {/* ─────────────────────────────────────────────
          MENU DRAWER MOBILE (slide from bottom)
      ───────────────────────────────────────────── */}
      {menuAberto && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setMenuAberto(false)}
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          />
          {/* Drawer */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl"
            style={{
              background: '#111',
              border: '1px solid var(--hp-border)',
              borderBottom: 'none',
              maxHeight: '85vh',
              overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom)',
              animation: 'slideUp 0.28s ease-out',
            }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div style={{ width: 36, height: 4, background: '#333', borderRadius: 4 }} />
            </div>

            {/* Perfil */}
            <div className="flex items-center gap-3 px-5 py-3 mb-2"
              style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, var(--hp-red), var(--hp-red-d))', color: '#fff' }}>
                {iniciais}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{usuario?.nome}</p>
                <p className="text-xs" style={{ color: 'var(--hp-red)' }}>
                  {usuario?.tipo === 'DONO' ? 'Proprietário' : usuario?.unidadeNome}
                </p>
              </div>
              <button onClick={() => setMenuAberto(false)}
                style={{ color: '#555', background: 'none', border: 'none', padding: 8, touchAction: 'manipulation' }}>
                <X size={20} />
              </button>
            </div>

            {/* Links */}
            <div className="px-3 py-2 space-y-1">
              {menuItens.map(({ path, label, icon: Icon }) => (
                <NavLink key={path} to={path}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 16px', borderRadius: 12,
                    fontSize: 15, fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#fff' : '#888',
                    background: isActive ? 'rgba(212,48,42,0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(212,48,42,0.2)' : '1px solid transparent',
                    textDecoration: 'none', touchAction: 'manipulation',
                  })}>
                  {({ isActive }) => (
                    <>
                      <Icon size={18} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {isActive && <ChevronRight size={14} style={{ opacity: 0.4 }} />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Ações */}
            <div className="px-3 pt-2 pb-4 space-y-1" style={{ borderTop: '1px solid var(--hp-border)', marginTop: 8 }}>
              <button onClick={() => { setMenuAberto(false); setModalSenha(true) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 16px', borderRadius: 12, fontSize: 15,
                  color: '#888', background: 'none', border: 'none', touchAction: 'manipulation',
                }}>
                <KeyRound size={18} style={{ opacity: 0.6 }} />
                Trocar senha
              </button>
              <button onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 16px', borderRadius: 12, fontSize: 15,
                  color: '#ef4444', background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.15)', touchAction: 'manipulation',
                }}>
                <LogOut size={18} />
                Sair da conta
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal trocar senha ── */}
      {modalSenha && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div ref={modalRef} className="card-dark w-full max-w-sm rounded-xl"
            style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
            <div className="px-5 py-4 flex justify-between items-center"
              style={{ borderBottom: '1px solid var(--hp-border)' }}>
              <div>
                <h2 className="font-semibold text-white text-sm">Trocar senha</h2>
                <p className="text-xs mt-0.5" style={{ color: '#555' }}>{usuario?.nome}</p>
              </div>
              <button onClick={fecharModal} style={{ color: '#555' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTrocarSenha} className="p-5 space-y-4">
              <Campo label="Senha atual *">
                <input type="password" required value={senhaForm.senhaAtual}
                  onChange={e => setSenhaForm({ ...senhaForm, senhaAtual: e.target.value })}
                  className="input-dark text-sm" placeholder="Sua senha atual" />
              </Campo>
              <Campo label="Nova senha *">
                <input type="password" required minLength={6} value={senhaForm.novaSenha}
                  onChange={e => setSenhaForm({ ...senhaForm, novaSenha: e.target.value })}
                  className="input-dark text-sm" placeholder="Mínimo 6 caracteres" />
              </Campo>
              <Campo label="Confirmar nova senha *">
                <input type="password" required value={senhaForm.confirmar}
                  onChange={e => setSenhaForm({ ...senhaForm, confirmar: e.target.value })}
                  className="input-dark text-sm" placeholder="Repita a nova senha" />
              </Campo>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={fecharModal}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid var(--hp-border)', color: '#666' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoSenha}
                  className="btn-red flex items-center gap-2 px-4 py-2 text-sm rounded-lg disabled:opacity-50">
                  <Save size={14} /> {salvandoSenha ? 'Salvando...' : 'Salvar'}
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
