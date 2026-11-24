# Park Flash — Modernização visual (Etapas A a E)

Data: 24/11/2026 · Branch local `parkflash-2.0` · **Sem deploy e sem push.**
Escopo: só o front end em `frontend-react/`. Backend, banco, API e cálculos financeiros não foram alterados.

## 1. Etapas concluídas

| Etapa | Entrega |
|---|---|
| **A — Fundação** | Tokens novos (azul `#186A9D`, azul-marinho `#10283F`, superfícies, estados), Plus Jakarta Sans + Inter servidas pelo próprio site, escala tipográfica, ícones Lucide, linguagem de movimento, componentes reutilizáveis, ESLint. Remoção da dica da senha `123456` no login. |
| **B — Controle de Veículos** | Fichas: filtros em etiquetas guardados na URL, agrupamento por situação/dia com contadores e subtotais, painel lateral de detalhe com "talão" de tickets e etapas do fluxo, atalhos J/K/Enter/Esc/N//, estados vazios. Carros por Mês com os mesmos filtros na URL. |
| **C — Navegação** | Menu claro agrupado (Início, Operação, Equipe, Financeiro, Cadastros) com os **mesmos 14 itens e permissões**; recolhível (botão ou tecla `[`, lembrado no aparelho, automático em tablets) com dicas; paleta ⌘K/Ctrl+K; "Mais" do celular agrupado e com gesto de arrastar. |
| **D — Demais telas** | Sobretítulo pelo grupo do menu em todas as telas, indicadores com ícone e número que conta, estados vazios ilustrados, esqueletos de carregamento, Dashboard (saudação, filtros em etiquetas, pendências animadas), Pagamentos (atalhos "Chave Pix" e "Pagar"), Perfil (rever/continuar tour), cores antigas fixas trocadas por tokens. |
| **E — Apresentação** | Landing pública em `/conheca` com capturas reais da interface (nomes trocados por genéricos, aviso de dados de demonstração), GSAP + ScrollTrigger, responsiva. Não substitui a entrada do sistema (`/` continua levando ao app). |

## 2. Componentes criados ou refeitos

`compartilhado/`: `Dica` (tooltip acessível), `Situacao` + `IconeSituacao`, `EstadoVazio` + `Ilustracao` (6 ilustrações SVG originais), `Esqueleto`/`EsqueletoLista`/`EsqueletoKpis`, `BarraFiltros` + `FiltroPilula`, `useFiltrosUrl`, `Modal` (variante `lateral`, animação com Motion, mesma API), `CartaoKpi` (ícone + contagem), `CabecalhoPagina` (sobretítulo automático), `Aviso` (ícones e animação), `Icone` (Lucide com a mesma API `nome/tamanho/espessura`), `movimento.ts` (padrões de duração/curva).

`layout/`: `Sidebar` agrupada e recolhível, `PaletaComandos`, `TourGuiado` + `DicaContextual`, `BarraInferior` agrupada.

`nucleo/`: `estado/interface.ts` (menu e paleta), `onboarding/` (roteiros, progresso, ponto do mascote).

## 3. Animações — GSAP e Motion sem sobreposição

| Ferramenta | Onde |
|---|---|
| **Motion** | Presença de componentes: modais e painel lateral, paleta, avisos, dicas, pendências do painel, etiquetas de filtro, indicador do item ativo no menu e na barra inferior, folha "Mais", tour e convite. |
| **GSAP** | Sequências: entrada de cada tela (título → filtros/indicadores → cartões → linhas, ≤ 0,4 s), números dos indicadores, login, ilustrações, landing (ScrollTrigger). |
| **CSS** | Hover, foco, pressionar, recolher menu — com `--pf-dur-*` e `--pf-ease-*`. |

Durações e curvas vêm de um só lugar (`movimento.ts` e as variáveis CSS). "Reduzir movimento" é respeitado: `MotionConfig reducedMotion="user"`, `gsap.matchMedia()` e regra global no CSS. Toda animação GSAP devolve limpeza ao desmontar. Os gráficos usam a mesma curva.

## 4. Funcionalidades preservadas e verificação

Fichas, fechamentos, manobristas, pagamentos, chaves Pix, despesas, unidades, sócios, divisão de lucro, relatórios, eventos, escalas, usuários, permissões, notificações e histórico continuam com a mesma lógica: nenhuma chamada de API, cálculo ou regra de permissão foi alterada. A paleta e o tour usam a mesma função `podeAcessar`.

## 5. Testes executados (todos nesta sessão)

| Verificação | Resultado |
|---|---|
| `npm run lint` (ESLint novo) | 0 erros, 0 avisos |
| `npm run typecheck` | sem erros |
| `npm test` | **59 passaram** (35 anteriores + 24 novos: agrupamento, filtros na URL, menu com 14 itens/permissões, paleta, onboarding, sessão × push, vínculo do aparelho) |
| `npm run build` | ok; pacote inicial 97 kB (29 kB gzip), bibliotecas em pacotes próprios |
| 22 testes de uso real originais | **22/22** no servidor de desenvolvimento e **22/22** no build de produção |
| 22 testes de uso real novos (filtros na URL, J/K, painel, Ctrl+K, menu recolhido, tour retomado, paleta do operador, "Mais", landing, login sem a senha) | **22/22** no desenvolvimento e no build de produção |
| Prints | 50 de "antes" e 54 de "depois" (16 rotas + login + landing; 1366, 820 e 390 px), sem erros de console/API |

Os testes de uso real rodam num backend de demonstração local (H2, porta 18082, push desligado), com o banco zerado antes de cada rodada.

## 6. Problemas corrigidos no caminho

- **Sessão expirada revogava o push**: `logout()` também era chamado no 401, cancelando a inscrição do aparelho. Agora só o logout explícito revoga; a expiração mantém o aparelho autorizado.
- **Outro usuário no mesmo aparelho** depois de uma expiração receberia avisos do anterior: o login de um usuário diferente cancela a inscrição local (o servidor descarta a antiga ao receber 410).
- Convite do tour sobre o painel "Mais" no celular; convite reaparecendo após pausar o tour.
- Tabela de fichas cortando a coluna Líquido no tablet; valores negativos sem vermelho nas tabelas.
- Cores antigas fixas (âmbar em Pagamentos) e um SCSS quebrado durante a edição.

## 7. Notificações push — situação

**Verificado no código**: service worker (`public/push-worker.js`) mostra um aviso genérico, sem dados sensíveis, e abre a central ao tocar. Inscrição por aparelho (`push_dispositivo`). Fila com novas tentativas e descarte em 404/410. Preferências por categoria. Destinatários: proprietários e gerentes com acesso à unidade.

**Fluxo gerente registra ficha → financeiro avisado**: ao salvar uma ficha com diária marcada como pendente, o backend reconhece a diária e cria o evento `PAGAMENTO_PENDENTE`, que é distribuído a proprietários e gerentes da unidade (inclusive quem lançou). Ele deixa de ser entregue quando a diária é paga.

**O que não foi homologado** (depende de aparelho real e de produção):

- **Os scripts de `deploy/` não configuram `PUSH_VAPID_PUBLICA/PRIVADA/CONTATO`**. Sem elas, o servidor não envia push (`TransportePush.configurado()` = falso). Para conferir sem expor as chaves: `ssh root@srv1637921.hstgr.cloud "grep -c '^PUSH_VAPID' /etc/parkflash/parkflash.env"` (0 = não configurado).
- App fechado, tela bloqueada e navegador fechado: no Android, o Chrome costuma entregar em segundo plano. No iPhone, só com o app instalado na tela inicial (iOS 16.4+). Nada disso foi testado em aparelho.
- O passo a passo de homologação continua em `docs/notificacoes-push.md`.

## 8. Onboarding preparado

Roteiro de 9 passos filtrado por perfil (o operador não vê painel nem pagamentos), convite no primeiro acesso ("Fazer o tour", "Lembrar depois", "Não mostrar mais"), destaque do componente com recorte animado, setas do teclado, "Pular tour", "Continuar depois" (Esc), retomar e rever pelo Perfil ou pela paleta. Progresso salvo **por usuário e por aparelho** (localStorage, versionado). Há dica contextual por tela (Fichas). Para o mascote 3D: `registrarMascote(Componente)` em `nucleo/onboarding/mascote.ts`. O componente recebe `humor`, `falando`, `passo`, `lado` e `reduzirMovimento`; o tour já informa o humor de cada passo.

## 9. Segurança — senha `123456`

- **Removido**: a dica no login.
- **Backend do Park Flash**: não há senha padrão na criação de usuários. A senha é obrigatória (mínimo de 6 caracteres) e o primeiro administrador vem de `ADMIN_SENHA`. `123456` só existe na seed `db/demo/V2__dados_demonstracao.sql`, que **não roda em produção** (o perfil `postgres` usa só `db/migration`).
- **Risco real**: o ValetGest antigo criava `dono@valetgest.com` e `gerente1@valetgest.com` com `123456`. Essas contas já foram desativadas, mas os **hashes dos demais usuários foram importados como estavam**, então qualquer pessoa que ainda use `123456` continua com essa senha.
- **Propostas** (precisam de autorização, porque mexem em backend ou produção):
  1. conferência somente leitura dos hashes contra `123456`, sem trocar nada;
  2. forçar a troca de senha no próximo acesso para quem estiver nessa situação;
  3. limite de tentativas de login (hoje não existe);
  4. mínimo de 8 caracteres para senhas novas.

## 10. Pendências funcionais (próxima etapa de paridade)

- Notificações: chaves VAPID na produção e homologação em aparelhos.
- Despesas: comprovante anexado e trilha detalhada (já registrado em `parkflash-2-matriz.md`).
- Sócios: vigência do percentual e registro da distribuição.
- Eventos: resultado realizado (conciliação com caixa e despesas).
- Auditoria: alterações de permissões campo a campo e cadastro de unidades.
- Onboarding: guardar o progresso no servidor (exige endpoint novo) para valer entre aparelhos.

## 11. Riscos e próximos passos

- **Dependências novas**: `lucide-react` 1.70.0, `motion` 14.10.1, `@fontsource/*` 5.3.0 e ESLint 10. Fixadas em versões com mais de duas semanas.
- O Motion e o GSAP somam cerca de 85 kB gzip, num pacote separado que fica em cache.
- A pasta `public/` do React agora é própria (cópia da compartilhada), com favicon e manifest na cor nova. O Angular guardado não foi tocado.
- A landing fica em `/conheca`. Torná-la a página inicial de um domínio comercial é uma decisão sua.
- **Próximos passos sugeridos**:
  1. sua revisão visual;
  2. a conferência das senhas (item 9);
  3. a configuração das chaves VAPID e a homologação do push;
  4. o deploy, só com a sua autorização.

Capturas: `docs/screenshots/modernizacao/`.
