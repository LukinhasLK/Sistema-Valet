# Park Flash 2.0

Diagnóstico de 20 de novembro de 2026. Base local do Park Flash: `faee57b` com alterações locais de pagamentos, formulários, navegação e login. Referências: *ValetGest-Documentacao.pdf* (19 páginas, cópias idênticas na Mesa e em Downloads), *Auditoria-Hitman-Park-ValetGest-2026-11-20.pdf* (14 páginas, commit `e3cc5ce`) e auditoria anterior do Park Flash na Mesa. O Park Flash usa Angular 19.2, Java 17 / Spring Boot 3.5.6, JPA e JdbcClient, H2/PostgreSQL e Flyway. Sua identidade visual usa Inter, azul-marinho, âmbar, Chart.js e componentes compartilhados. GSAP e Motion não foram encontrados no manifesto.

A tabela descreve o ponto de partida. Caminhos `features/` são relativos a `src/app/`; classes Java ficam em `backend/src/main/java/com/parkflash/`.

| Área | ValetGest auditado | Park Flash antes das mudanças | Evidência e dependência |
|---|---|---|---|
| Identidade | DONO e GERENTE, com lacunas em ações administrativas | Login, perfil, proprietário, gerente e operador. Papéis na API, sem vínculo de usuários por unidade | `config/SecurityConfig.java`, `seguranca/FiltroJwt.java`, `features/usuarios/`, migração V1 |
| Caixa | Ficha por unidade e data, contagem informada | Ficha por unidade, data e turno, contagem por tickets e cancelamentos. Dinheiro e cartão. Sem ciclo de conferência e bloqueio formal | `servico/FichaService.java`, `servico/CalculoFicha.java`, `features/fichas/` |
| Manobristas | Cadastro global, status e três modalidades de custo | Cadastro global, diária na ficha, Pix integrado; situação e unidades de atuação ainda incompletas | `servico/ManobristaService.java`, `servico/PixManobristaService.java`, `features/manobristas/` |
| Pagamentos | Custo registrado, situação histórica indeterminada | Reconhecimento, confirmação manual, comprovante PDF, histórico, Pix cifrado e estorno. Implementação local em andamento | `servico/PagamentoManobristaService.java`, `V3__pagamentos_manobristas.sql`, `features/pagamentos-manobristas/` |
| Unidades | Cadastro com desativação | Cadastro, exclusão impedida se houver fichas ou despesas, sem status | `servico/UnidadeService.java`, `features/unidades/` |
| Despesas | Anexadas à ficha, leitura global na API auditada | Despesas de ficha e despesas fixas categorizadas e vinculadas à unidade. Falta comprovante e trilha | `servico/DespesaService.java`, `features/despesas/` |
| Sócios | Percentual por unidade, cálculo com valor atual | Percentual por unidade e rateio calculado. Vigência e distribuição registrada ausentes | `servico/RelatorioService.java`, `features/divisao-lucro/` |
| Dashboard e relatórios | Mensal, veículos agregados, PDF e XLSX | Dashboard, resumo de período, relatórios e carros por mês. Parte dos agregados no Angular. PDF via impressão; XLSX ausente | `web/RelatorioController.java`, `features/{dashboard,relatorios,carros-por-mes}/` |
| Escalas, eventos e central de alertas | Ausentes no código auditado | Sem módulos dedicados identificados | `src/app/app.routes.ts`, migrações V1 e V3 |
| Auditoria | Criação e atualização parcial; exclusão física das fichas | Histórico de pagamentos e consultas Pix; sem trilha geral | `V3__pagamentos_manobristas.sql`, `servico/PixManobristaService.java` |

## Regras e sequência

1. Proteger papéis e unidades no servidor, com escopo vazio para contas operacionais sem vínculo e administração das permissões pelo proprietário. Preservar a interface Angular, as rotas e a API em uso onde compatível com a regra.
2. O manual do ValetGest (pp. 6 e 8) descreve bruto como valor final menos inicial; o código auditado usa cartão mais dinheiro. O proprietário confirmou a soma de dinheiro, cartão e Pix para fichas novas. Manter abertura e fechamento monetários independentes e o histórico intacto. A taxa continua incidindo sobre cartão e a soma dos custos registrados continua reduzindo o resultado da ficha.
3. Separar data de trabalho, custo, reconhecimento da obrigação e baixa manual. Antes de mudar o gatilho de reconhecimento, confirmar o evento de negócio. Não classificar lançamentos antigos automaticamente.
4. Especificar conferência, fechamento, reabertura e correções; definir vigência/percentuais de sócios e contratos de eventos antes de automatizar seus efeitos. Escalas são planejamento e não geram dívida. Adicionar módulos usando o layout e os componentes existentes.
5. Consolidar consultas de dashboard e exportações com o mesmo contrato de filtros. Homologar teclado, telas estreitas, movimento reduzido, permissões, operações concorrentes e cálculos com dados sintéticos.

## Plano futuro de migração

Identificar versão e esquema de origem mediante autorização futura. Exportar uma amostra anonimizada e preservar IDs de origem, unidade, data, vínculos e indicadores de desativação. Migrar primeiro unidades, profissionais e sócios; associar identidades por IDs mapeados e conceder unidades explicitamente. Migrar fichas, despesas e custos depois; conservar valores monetários e contadores em campos distintos. Registrar modalidade e valor bruto/líquido de origem para conciliação. Atribuir situação de pagamento indeterminada ao histórico sem evidência. Comparar quantidades e valores por período/unidade, documentar diferenças de fórmula e validar uma amostra de fichas. Ensaiar carga repetível em banco de teste, após backup e com reversão por lote, antes de solicitar acesso ou implantação.
