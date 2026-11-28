import {
  ArrowRight, ArrowUpRight, Banknote, EyeOff, Bell, BellOff, BellRing, Building2, CalendarClock, CalendarDays, CarFront, ChartColumn,
  ChartPie, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, CircleX, Clock, Command, Compass, Copy,
  CornerDownLeft, CreditCard, Download, Eye, FileText, GraduationCap, HandCoins, Handshake, History, Inbox, Info, KeyRound,
  LayoutDashboard, Lightbulb, ListFilter, LogOut, LucideIcon, MapPin, Menu, Moon, PanelLeftClose, PanelLeftOpen, Pencil,
  Plus, Printer, QrCode, Receipt, RefreshCw, RotateCcw, Search, Send, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles,
  Sun, Ticket, Trash2, TrendingUp, TriangleAlert, Undo2, UserCog, UserRound, Users, Wallet, X, Zap,
} from 'lucide-react';
import './icone.scss';

/**
 * Nomes do Park Flash → ícones Lucide. As telas continuam usando `<Icone nome="fichas" />`;
 * só este mapa sabe qual desenho é usado (troca de biblioteca sem tocar nas telas).
 */
const ICONES: Record<string, LucideIcon> = {
  // Navegação
  dashboard: LayoutDashboard,
  sino: Bell,
  fichas: Ticket,
  relatorios: ChartColumn,
  manobristas: Users,
  pagamentos: HandCoins,
  lucro: ChartPie,
  despesas: Receipt,
  carros: CarFront,
  eventos: CalendarDays,
  escalas: CalendarClock,
  unidades: Building2,
  socios: Handshake,
  usuarios: UserCog,
  perfil: UserRound,
  // Ações
  mais: Menu,
  plus: Plus,
  busca: Search,
  sair: LogOut,
  voltar: ChevronLeft,
  avancar: ChevronRight,
  abrir: ChevronDown,
  baixar: Download,
  local: MapPin,
  editar: Pencil,
  excluir: Trash2,
  ver: Eye,
  ocultar: EyeOff,
  check: Check,
  fechar: X,
  copiar: Copy,
  imprimir: Printer,
  atualizar: RefreshCw,
  desfazer: Undo2,
  reabrir: RotateCcw,
  enviar: Send,
  filtro: ListFilter,
  ajustes: SlidersHorizontal,
  historico: History,
  seta: ArrowRight,
  externo: ArrowUpRight,
  enter: CornerDownLeft,
  comando: Command,
  recolher: PanelLeftClose,
  expandir: PanelLeftOpen,
  // Estados e conteúdo
  alerta: TriangleAlert,
  info: Info,
  sucesso: CircleCheck,
  erro: CircleX,
  ajuda: CircleHelp,
  tendencia: TrendingUp,
  caixa: Inbox,
  relogio: Clock,
  dia: Sun,
  noite: Moon,
  dinheiro: Banknote,
  cartao: CreditCard,
  pix: QrCode,
  carteira: Wallet,
  chave: KeyRound,
  celular: Smartphone,
  seguro: ShieldCheck,
  documento: FileText,
  brilho: Sparkles,
  raio: Zap,
  dica: Lightbulb,
  tour: Compass,
  aprender: GraduationCap,
  sinoAtivo: BellRing,
  sinoDesligado: BellOff,
};

interface Props {
  nome: string;
  tamanho?: number;
  espessura?: number;
  className?: string;
}

export function Icone({ nome, tamanho = 20, espessura = 1.8, className }: Props) {
  const Desenho = ICONES[nome];
  return (
    <pf-icon className={className}>
      {Desenho && <Desenho size={tamanho} strokeWidth={espessura} aria-hidden="true" focusable="false" />}
    </pf-icon>
  );
}
