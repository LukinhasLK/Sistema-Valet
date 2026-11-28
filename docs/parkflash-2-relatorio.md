# Park Flash 2.0 · Relatório de implementação

20 de novembro de 2026 • Base Park Flash `faee57b` com alterações locais de pagamentos, navegação e formulários.

## Resultado

A implementação evoluiu o aplicativo Angular e a API Spring Boot existentes. A fundação de segurança, os recebimentos via Pix, o ciclo de conferência das fichas, a distribuição de 100% por unidade, a agenda e o relatório financeiro passaram a ter persistência e autorização no servidor. O resultado é uma entrega parcial da Missão Master. A [matriz comparativa](parkflash-2-matriz.md) descreve o diagnóstico inicial e o plano de migração futura.

A base de dados do ValetGest, o checkout do ValetGest, os bancos locais do Park Flash, a infraestrutura e a produção ficaram fora da execução. A implementação foi preparada em cópia isolada, usando dependências já disponíveis localmente e bancos H2 em memória para a verificação.

## Funcionalidades, telas e UX

| Tela e necessidade | Implementação e evidência |
|---|---|
| Usuários. Um proprietário precisa conceder o acesso certo e enxergar seu alcance. | Formulário de conta com seleção explícita por unidade e explicação do escopo vazio. A lista mostra unidades autorizadas e desativação com confirmação. O cartão mobile oferece ações em botões acessíveis pelo teclado. `src/app/features/usuarios/`. |
| Perfil. A troca de senha deve encerrar sessões anteriores sem ambiguidade. | Reautenticação após troca e retorno à tela de login com feedback. `src/app/features/perfil/`, `seguranca/JwtService.java`, `seguranca/FiltroJwt.java`. |
| Unidades e despesas. A gestão precisa desativar locais sem perder informações dos meses anteriores. | Status ativo/inativo, reativação no cadastro, unidade histórica nos filtros e bloqueio de novos lançamentos em unidade inativa. Despesas e fichas filtradas na API conforme o papel e a unidade. O cancelamento de despesa exige motivo na tela e mantém as versões consultáveis no histórico. `src/app/features/{unidades,despesas}/`, `servico/{UnidadeService,DespesaService}.java`. |
| Fichas. O operador distingue tickets, caixa, receita e estado da conferência. | Recebimentos em dinheiro, cartão e Pix no mesmo bloco. Valores de abertura e fechamento de caixa e observações ficam em campos próprios. Estado no cartão e na tabela. Histórico acessível no detalhe, ação conforme a etapa, confirmação de fechamento e justificativa para devolver ou reabrir. A mesma estrutura foi reaproveitada no assistente mobile. `src/app/features/fichas/`. |
| Manobristas e pagamentos. Selecionar o profissional exige menos dados que administrar o cadastro ou confirmar pagamento. | Campos pessoais ficam fora da listagem para perfis operacionais. O catálogo retorna identificação, nome e status para selecionar o profissional. Status e observações podem ser mantidos pelo proprietário, e a desativação preserva o histórico. Manutenção de Pix exige proprietário; gerente consulta Pix de profissional com diária reconhecida em uma unidade autorizada. Diárias e resumos aplicam filtro de unidade; detalhes, estornos e comprovantes multiunidade exigem acesso a todos os itens. O fluxo existente de baixa manual, comprovante e estorno foi reaproveitado. `src/app/features/{manobristas,pagamentos-manobristas}/`, `repositorio/PagamentoManobristaConsultas.java`, `servico/{PagamentoManobristaService,PixManobristaService}.java`. |
| Sócios e divisão. O proprietário precisa configurar todos os percentuais juntos e consultar o mês com a regra daquele período. | Formulário por unidade com prévia do total e competência, histórico de vigência e bloqueio de distribuição inferior ou superior a 100%. O gráfico e a lista exibem o cálculo do servidor. Rótulos diferenciam estimativa e repasse. `src/app/features/{socios,divisao-lucro}/`. |
| Agenda. A gestão precisa planejar locais e equipes e corrigir conflitos antes do turno. | Eventos e Escalas usam cartões, navegação e modais do design existente. Campos de data, equipes, situação e observações. Validação dos intervalos, bloqueio de alocação repetida ou simultânea, vínculo opcional com evento da mesma unidade, filtro de período e paginação de 50. Alterações de escala registram a escala e a equipe. Os valores de evento são de planejamento. `src/app/features/agenda/`, `servico/AgendaService.java`. |
| Dashboard. A gestão precisa ver receita, custos e baixas em contextos diferentes. | Filtros por mês, ano e unidade e uma chamada para indicadores, comparação com mês anterior e alertas. Gráficos e componentes Angular existentes preservados. Estados de carga e erro são distintos. `src/app/features/dashboard/`, `servico/PainelService.java`. |
| Relatórios. Tela e exportação precisam usar o mesmo filtro e regra. | Relatório financeiro retorna linhas e totais do servidor. A impressão usa a tela gerada e o Excel exporta o mesmo contrato de consulta, com identificação de unidade, período e valores numéricos. Mudança de filtro cancela consulta anterior; botões ficam indisponíveis durante a carga. `src/app/features/relatorios/`, `servico/RelatorioExcel.java`. |

Decisões de interface partiram dos três papéis operacionais. O proprietário precisa administrar acesso, conferir valores e recuperar históricos. O gerente precisa agir dentro da unidade e distinguir pendência de confirmação. O operador precisa lançar fichas e enviá-las à conferência em poucos passos. As alternativas escolhidas reaproveitam cabeçalhos, filtros, cartões, modais com contenção de foco, padrões de erro, navegação, tabelas e componentes de moeda do Park Flash. Foi preservada a identidade visual. Nenhuma biblioteca de animação foi adicionada.

## APIs e alterações de banco

| Contrato | Alteração |
|---|---|
| `/api/usuarios`, `/api/auth` | Vínculos `unidadeIds`; desativação mantém o usuário no banco e interrompe seu acesso; alterações de senha invalidam sessões anteriores. Trilha de criação, alteração, redefinição e desativação da conta. |
| `/api/fichas` | Recebe `valorPix`, abertura/fechamento de caixa e observações. Devolve responsável, estado e dados do fechamento. `POST /{id}/transicao`, `GET /{id}/historico`. Cancelamento de rascunho mantém registro e histórico; ficha com diárias reconhecidas é protegida. |
| `/api/unidades`, `/api/despesas`, `/api/pagamentos-manobristas` | Listas e operações de recursos financeiros com escopo. Unidade e manobrista podem ser desativados preservando o histórico. Despesas têm `POST /{id}/cancelamento` e `GET /{id}/historico`. Comprovantes e histórico envolvendo várias unidades exigem escopo integral. |
| `GET /api/relatorios/painel`, `GET /api/relatorios/financeiro`, `GET /api/relatorios/financeiro/excel` | Indicadores e comparação mensal, relatório com resumo e linhas, exportação XLSX. O endpoint de divisão usa competência mensal explícita. |
| `GET/POST /api/socios/rateio/{unidadeId}`, `GET /api/socios/rateio/{unidadeId}/historico` | Consulta por data, configuração atômica de 100% e consulta da trilha de vigências. Gestão exclusiva do proprietário. |
| `GET/POST /api/eventos`, `PUT /api/eventos/{id}`, `GET/POST /api/escalas`, `PUT /api/escalas/{id}`, `GET /api/escalas/{id}/historico` | Planejamento operacional, autorização de unidade, histórico da equipe e detecção de conflito. |

Migrações em `backend/src/main/resources/db/migration/`: **V4** recebimento Pix; **V5** contas ativas, vínculos e trilha administrativa; **V6** unidades ativas; **V7** fechamento, valores de caixa e histórico; **V8** rateio e histórico de vigências; **V9** evento, escala, alocações e histórico; **V10** revogação de JWT ao alterar senha; **V11** cancelamento e histórico de despesas; **V12** status e observações de manobristas. São aditivas. H2 em memória validou o esquema com a carga de demonstração existente. PostgreSQL 16 descartável validou as migrações de esquema de uma base vazia e executou a suíte de pagamentos em uma base de teste separada. Uma atualização incremental sobre uma cópia autorizada da base real ainda exige homologação. Seu perfil usa as migrações de esquema por padrão, com dados de demonstração fora desse perfil. A exportação XLSX usa Apache POI, pois precisa de uma planilha com células numéricas e abas. Não foram acrescentadas dependências ao frontend.

## Regras financeiras e decisões de implementação

- Bruto = dinheiro + cartão + Pix, conforme aprovação. Taxa incide somente sobre cartão; despesas e custos de manobristas continuam no cálculo do líquido. A migração inicializa Pix em zero nos registros anteriores e conserva seus totais. Edição de cliente antigo que omite Pix conserva o valor persistido.
- Relatórios preservam o critério anterior de somar as fichas lançadas, incluindo as que aguardam conferência. Fichas e despesas canceladas ficam fora dos totais. Abertura e fechamento de caixa são informativos. A diferença entre eles não altera a receita. A conciliação automática aguarda regra oficial.
- Proprietário e gerente da unidade podem fechar e reabrir. O operador pode encaminhar para conferência. Fechamento exige estado de conferência; devolução e reabertura exigem motivo. As datas de vigência usam mês de competência no fuso de São Paulo.
- Uma nova configuração de sócios exige exatamente 100%, com vigência explícita no mês atual ou futuro. Cotas calculadas são arredondadas em centavos pelo maior resto, com desempate por ID do sócio. A regra garante que o total das cotas seja igual ao resultado mensal. Os registros históricos sem distribuição de 100% ficam sem rateio calculado. Nenhum repasse foi registrado.
- O calendário informa eventos nos próximos sete dias. Resultado por unidade no painel é o saldo das fichas; despesas fixas entram no resultado mensal consolidado do escopo. Pendências usam mês do trabalho; confirmações usam mês da baixa. A competência dos valores é indicada na interface.
- Contas de gerente e operador começam sem unidades se não houver vínculo explícito. Proprietário tem acesso consolidado. Novas concessões têm efeito nas próximas requisições. O catálogo nominal histórico de manobristas permanece compartilhado para seleção, sem CPF ou telefone para perfis operacionais.

## Testes e verificações

- Backend: 29 testes passaram em H2 em memória. Cobrem login, troca e revogação de senha, autorização, Pix de receita, conferência, fechamento, reabertura, cancelamento auditado de despesas, rateio vigente, Excel, eventos, escalas e integridade de pagamentos e comprovantes. Evidências em `backend/src/test/java/com/parkflash/`.
- Frontend: 31 testes passaram com Jasmine/Karma e Chrome headless. Build Angular de desenvolvimento gerado. Usado o modo application também no Karma para compartilhar o empacotador Angular e evitar a incompatibilidade do PostCSS no modo browser. Evidência em `angular.json` e arquivos `*.spec.ts`.
- PostgreSQL 16 descartável executou as migrações de esquema V1 e V3 a V12 sem carregar a demonstração no perfil postgres. Uma base separada de teste aprovou os 7 testes da suíte de pagamentos, incluindo quitação concorrente.
- O ensaio de navegador usou login real, criação de unidade, ficha com Pix e valores de caixa, conferência, fechamento e histórico, consulta de evento, relatório e painel. Com viewport de 1.440 px e 390 px, painel e agenda passaram na verificação de largura. O teclado permaneceu dentro do modal de evento durante a navegação. Nenhum teste ou migração alcançou a produção.

## Pendências e riscos remanescentes

| Tema | O que falta para completar |
|---|---|
| Pagamentos | Confirmar quando o custo vira obrigação no fluxo futuro, a regra de vencimento, pagamentos parciais e evidências válidas para passivo anterior. O gatilho preexistente de reconhecimento não foi trocado. Os custos antigos permanecem sem classificação automática. |
| Eventos | Cadastro e escala estão funcionais. Checklist, ocorrências, veículos efetivos, vínculo com ficha/despesa e fechamento financeiro ainda precisam evoluir. Contratos, adicionais, horas extras, cancelamentos e tributos requerem critérios antes de apurar resultado de evento. |
| Escalas | Conflitos de alocação e substituição por edição com histórico estão cobertos. Indisponibilidade declarada, vínculo direto de escala a fichas/custos e histórico visual detalhado de equipes são pendências. |
| Despesas e manobristas | Faltam comprovantes de despesas e vínculos estruturados das despesas com fichas e eventos. Unidades de atuação de manobristas e histórico individual completo ainda pendentes. |
| Sócios | Existe estimativa mensal por competência. Falta razão de repasses, relatório completo por sócio e regras para corrigir vigência já registrada. |
| Alertas e relatórios | Fichas para conferir, diárias pendentes e eventos próximos aparecem no painel. Vencimentos, divergências conciliáveis e revisão de despesas dependem de regras. PDF via impressão; faltam downloads PDF via API e exportações dedicadas aos demais relatórios. |
| Homologação e acesso | Validar restauração e migração incremental em uma cópia autorizada do esquema, carga e paginação das listas legadas, exercício de backup/reversão, contraste e leitores de tela. Contas existentes precisam receber unidades explicitamente. Logs, retenção e monitoramento ainda exigem revisão de ambiente. |

## Migração futura e homologação

O plano detalhado está na [matriz](parkflash-2-matriz.md). Antes da homologação, revisar vínculos de papéis com dados sintéticos, ensaiar atualização incremental e reversão em PostgreSQL, reconciliar fichas de referência com os três meios de recebimento e revisar fluxos ainda dependentes de decisão. Para uma futura migração, preservar IDs de origem, estado de desativação e valores históricos como registrados; conciliar por competência e unidade e manter a situação de pagamento histórica indeterminada sem evidência. Ensaiar reversão antes de qualquer acesso a dados ou ambiente real.
