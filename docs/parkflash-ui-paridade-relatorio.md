# Correção de interface e paridade do Park Flash

21 de novembro de 2026. O modal de fichas comporta as ações de conferência em telas estreitas, o financeiro e a contagem de carros exportam PDF diretamente, e os custos de equipe aceitam três modalidades com valor informado. O trabalho preserva os componentes, as cores e a navegação do Angular. A [matriz comparativa](valetgest-paridade-2026-11-21.md) registra as diferenças e o inventário de telas, rotas, APIs, serviços, formulários e entidades.

## Conferência da ficha

O componente compartilhado `pf-modal` passou a acomodar cabeçalho, corpo rolável e rodapé próprio. O rodapé da ficha distribui as ações em linhas quando falta espaço. O botão principal mantém o destaque e ocupa a última linha no celular. Em alturas muito limitadas todo o painel rola, preservando o acesso ao conteúdo e às ações. O botão de fechar recebe o foco inicial, Escape encerra o diálogo e o foco retorna ao acionador. As transições de confirmação levam o foco ao título da etapa ou à justificativa. A legenda da contagem de carros recebeu contraste adequado.

Com R$ 0,00 em dinheiro, cartão e Pix e custo de equipe de R$ 25,00, o servidor retorna saldo de –R$ 25,00. O aviso de saldo negativo aparece antes da confirmação. A gestão pode fechar e reabrir fichas autorizadas. A reabertura exige justificativa e o operador pode enviar para conferência. A fórmula vigente permanece em `CalculoFicha`. A confirmação de cancelamento informa que o registro será preservado no histórico.

A captura descrita no pedido não acompanhou o anexo de texto. O problema foi reproduzido a partir dos estilos do modal e de fichas sintéticas que percorrem os estados citados.

## Entregas por fluxo

| Tela | Alteração |
|---|---|
| Fichas e Nova ficha | Rodapé responsivo, confirmação de saldo negativo, foco por etapa, filtro por manobrista e modalidade de custo. |
| Manobristas | A ação Ver fichas abre o período e o profissional selecionados, mostrando o custo registrado e as fichas disponíveis ao usuário. |
| Relatórios | PDF direto com período, unidade, valores consolidados e fichas. O Excel continua disponível. |
| Carros por Mês | Filtro de mês, abertura da lista de fichas do recorte e PDF com totais mensais de carros e fichas. O gráfico anual permanece como referência. |
| Dashboard | Controle de privacidade para ocultar valores, gráficos e tabelas financeiras. A preferência é local e separada por conta. |
| Eventos | Exibe despesas previstas e resultado previsto quando há valor contratado e despesas informadas. |
| Login, navegação, notificações e avisos | Entradas discretas nos pontos de mudança de contexto, mantendo os componentes atuais. |

O cadastro rápido, a chave Pix autorizada, a confirmação manual, o histórico de pagamentos e a central de notificações foram confrontados com as rotas e a persistência existentes. O módulo de pagamentos conserva os controles de valor, momento do reconhecimento, escopo, duplicidade e registro da baixa.

## APIs e migração

| Contrato | Alteração |
|---|---|
| `GET /api/relatorios/financeiro/pdf` | Ano, mês opcional e unidade opcional. Reaproveita a consulta do financeiro com o escopo do usuário e entrega PDF como anexo. |
| `GET /api/relatorios/carros/pdf` | Ano, mês opcional e unidade opcional. Reaproveita o mesmo escopo e agrega as fichas autorizadas por mês. |
| `POST /api/fichas`, `PUT /api/fichas/{id}` e leitura de fichas | Cada linha da equipe aceita e retorna `modalidade`. Valores possíveis são `DIARIA_FIXA`, `VALOR_FIXO_POR_MANOBRA` e `PORCENTAGEM`. A ausência do campo conserva a modalidade existente e usa diária fixa em linhas novas. O custo em reais continua em `diaria`. |
| `V14__modalidade_custo_manobrista.sql` | Acrescenta uma coluna com valor padrão e uma restrição de domínio em `ficha_manobrista`. Os registros existentes preservam os custos e aparecem como diária fixa. |

A decisão operacional foi registrar o valor digitado nas três modalidades. Selecionar por manobra ou percentual não recalcula o custo nem altera o montante devido. A graduação de permissão continua na API, inclusive nos PDFs.

## Movimento e acessibilidade

O GSAP opera por meio de funções de entrada e saída e diretivas Angular. A navegação anima um título e até três indicadores. Modais têm entrada e saída, e o formulário de login, os avisos e o painel de preferências têm entrada. Cada movimento dura entre 140 e 200 ms, usa opacidade e transform e é cancelado ao desmontar o componente. A opção de movimento reduzido também desliga animações do Chart.js e mantém a versão estática do login. O menu inferior e os movimentos CSS que já funcionavam foram mantidos. Valores financeiros são exibidos conforme calculados. [GSAP e preferências de movimento](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/)

## Verificação

- Build otimizado do Angular dentro dos orçamentos do projeto. Bundle inicial de 405,55 kB e estimativa de transferência de 123,81 kB. Typecheck dos aplicativos e testes. O repositório não contém alvo nem configuração de lint.
- 39 testes Java passaram em H2, com cobertura de autenticação, cálculo, fechamento, escopo, relatórios, pagamentos e notificações. As exportações PDF foram lidas com PDFBox e testadas por papel e unidade.
- A V14 passou em PostgreSQL 16 descartável, incluindo um registro anterior com custo de R$ 25,00, o valor padrão e as duas novas modalidades.
- 31 testes Angular em Chrome Headless e 3 do service worker.
- Chrome com backend isolado em memória para cenários desktop, tablet, celular, janela curta e largura CSS equivalente a zoom de 200%. Foi verificada a visibilidade dos botões, rolagem, navegação por teclado, retorno de foco e ausência de infrações axe nas regras WCAG 2 A/AA aplicadas ao modal no cenário testado. A validação de zoom usou emulação de dimensões e escala. O ensaio também verificou a ativação e a recuperação da preferência do painel, a modalidade no formulário e a ausência de movimento quando solicitado.
- Os dois PDFs foram baixados pelo navegador, tiveram conteúdo conferido e foram renderizados localmente para inspeção visual.

## Pendências e integração futura

O resultado realizado de eventos precisa de vínculo definido entre receita do evento, recebimentos e despesas registradas. As listas extensas ainda dependem do carregamento do conjunto autorizado. A auditoria administrativa de unidades e o detalhamento de alterações de permissões precisam de complementos. A matriz também distingue funcionalidades substituídas pelo fluxo de conferência e pelo rateio com vigência.

Uma integração futura com o ValetGest precisa conciliar fórmulas diferentes de bruto, contagem informada versus contagem por tickets, identidade e escopo por unidade, e condições de pagamento histórico. A migração dos dados do ValetGest e a entrega física do push continuam pendentes de homologação. A validação desta entrega usou bases descartáveis. O backend local anterior continua em execução na porta 8080 com a versão 13. O repositório já tinha mudanças dependentes e arquivos no índice, por isso a aplicação das correções foi verificada arquivo por arquivo, sem criar commit.

## Atualização de 22 de novembro de 2026

### Conciliação e resultado realizado

Em **Eventos → Financeiro**, a gestão pode vincular fichas fechadas e despesas não canceladas da unidade, com data entre o início e o término do evento. Cada lançamento só pode pertencer a um evento. O realizado é a soma do líquido das fichas menos as despesas vinculadas. A tela orienta a selecionar despesas que ainda não estejam no líquido da ficha. Os valores previstos ficam no planejamento e não alimentam o realizado.

Uma ficha reaberta ou uma despesa cancelada sai do cálculo. O vínculo fica disponível para revisão. A remoção de vínculo altera apenas a conciliação do evento. A troca de unidade, a mudança das datas e o cancelamento do evento exigem remover os vínculos financeiros existentes. As rotas `GET /api/eventos/{id}/financeiro` e `PUT|DELETE /api/eventos/{id}/financeiro/{tipo}/{registro}` aplicam o escopo da gestão. A migração V16 estabelece exclusividade na base.

### Auditoria e listas

Unidades registram criação e alterações de nome, endereço, telefone e situação. Contas registram perfil, unidades concedidas, desativação e a ocorrência de redefinição de senha. O histórico exibe autor, horário e valores anterior e atual. A migração V15 inicia a trilha detalhada e preserva os registros anteriores. Os endpoints `/api/unidades/{id}/auditoria` e `/api/usuarios/{id}/auditoria` são exclusivos do proprietário e retornam até 25 alterações por consulta. O filtro de Usuários permite abrir também o histórico das contas desativadas.

Fichas, despesas e manobristas mostram 25 registros por página. Os totais acompanham todo o filtro. A paginação dessas telas limita a renderização, enquanto a sessão ainda carrega o conjunto autorizado usado pelos resumos.

### Evidências

- Build Angular de produção, typecheck do aplicativo e dos testes, 31 testes Angular e 3 do service worker.
- 41 testes Java em H2, incluindo autorização de auditoria, valores de antes e depois, exclusividade dos vínculos, recorte de unidade e exclusão de fichas reabertas do realizado.
- Todas as migrações de esquema verificadas em PostgreSQL 16 descartável.
- Chrome com backend isolado e dados demonstrativos. Foram verificados o avanço de página das fichas, o histórico das contas desativadas, o histórico das unidades e o resultado de R$ 55,00 após vincular uma ficha líquida de R$ 75,00 e uma despesa de R$ 20,00. O axe passou no diálogo financeiro no cenário testado, em desktop e na largura de celular.

## Atualização de 23 de novembro de 2026

Carros por Mês agora baixa XLSX com período, escopo de unidades, fichas, carros, receita e líquido. O endpoint `GET /api/relatorios/carros/excel` aceita ano, mês opcional e unidade opcional. O XLSX e o PDF usam os mesmos registros autorizados e a mesma agregação mensal. A tela calcula o resumo anual em uma passagem pelas fichas e exclui as canceladas. Nas exportações financeiras, o PDF identifica as linhas de subtotal e o Excel oferece a aba “Fichas por unidade”. Os subtotais incluem apenas os lançamentos das fichas. As despesas fixas entram no resultado consolidado.

A alteração reutiliza os componentes visuais, animações, dependências e esquema atuais. O build otimizado e as duas verificações TypeScript passaram. O Chrome Headless executou 32 testes Angular, e o Node executou os três testes do service worker. O ensaio de interface consumiu respostas sintéticas e verificou a ação de download, o rodapé do modal, o aviso de saldo negativo e o retorno de foco após Escape em 1440×900, 768×1024, 390×844, 640×320 e 320×380. O conteúdo real do XLSX e a autorização são verificados separadamente na suíte de integração Java. A largura reduzida exercita o rearranjo dos controles; o zoom nativo do navegador e o leitor de tela em dispositivo físico continuam para homologação.

Para integração real, continuam pendentes a evidência de quitação das fichas anteriores, o ensaio de migração e restauração com uma cópia autorizada e a entrega de push em aparelho físico. O carregamento inicial das listas ainda depende do volume de histórico autorizado. Não há alvo de lint configurado no projeto. A árvore já contém alterações de outras etapas no índice e na área de trabalho; esta entrega não consolida essas alterações em um commit.
