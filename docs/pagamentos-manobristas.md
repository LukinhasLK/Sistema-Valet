# Pagamentos de Manobristas

## Operação

Proprietários e gerentes acessam **Pagamentos de Manobristas** pela sidebar ou pelo menu **Mais** no celular. O cadastro de cada manobrista e o cadastro rápido na ficha permitem salvar a chave Pix junto com o nome. A gestão pode incluir ou atualizar a chave ao editar um cadastro existente.

Na etapa **Equipe** da nova ficha, **Falta pagar** inclui a diária no saldo ao salvar. A gestão também pode registrar **Pago no dia** e a forma utilizada. **Deixar para conferência** mantém a revisão manual. Em **Quem falta pagar**, cada pessoa tem um total e uma divisão por unidade, considerando as datas dos filtros.

1. Em **Conferir fichas**, revise a diária, a unidade, o turno e a data de trabalho. Informe o valor devido e confirme o reconhecimento. O custo operacional da ficha permanece como foi lançado.
2. Em **Diárias a pagar**, selecione uma ou mais diárias do mesmo manobrista, inclusive de unidades diferentes. Revise o total e, se pagar via Pix, consulte ou copie a chave cadastrada.
3. Faça o pagamento externamente. Confira o total selecionado. A tela começa com a data de hoje e a forma Pix. Abra os detalhes para alterar a data ou a forma ou anexar um PDF de até 2 MB. Use **Já paguei · confirmar** para registrar a quitação.
4. Em **Histórico**, confira o responsável, os lançamentos vinculados e o comprovante. Para corrigir um pagamento registrado indevidamente, use **Estornar registro** e informe o motivo. O estorno reabre o saldo e preserva o registro original. Qualquer devolução de dinheiro ocorre externamente.

As diárias reconhecidas recebem quitação integral por lançamento. É possível pagar apenas parte do conjunto de diárias de um manobrista, desde que cada diária selecionada seja quitada por inteiro.

## Corte e indicadores

A migração V3 grava a data da ativação do módulo no banco. A fila de conferência aceita fichas criadas após a ativação e com data de trabalho entre o corte e o dia atual. Registros existentes, lançamentos retroativos anteriores ao corte e fichas futuras ficam fora da fila. A conciliação de períodos anteriores depende de comprovantes ou de outra fonte de quitação.

O saldo e a quantidade de manobristas pendentes usam a data de trabalho. Os valores pagos e a quantidade de pagamentos vigentes usam a data de pagamento. As quebras seguem essas mesmas datas. Quando se filtra por unidade, o total pago do painel inclui apenas a parcela vinculada à unidade. O detalhe do histórico continua exibindo a quitação inteira e todos os seus itens.

## Arquitetura

| Camada | Implementação |
| --- | --- |
| Angular | Rota protegida com carregamento sob demanda, indicadores, filtros paginados, tabelas, cards para celular e formulários de conferência, Pix, confirmação e estorno |
| Componentes compartilhados | Layout, navegação, cabeçalho, indicadores, modal, avisos e formatadores do ParkFlash, com foco contido no modal e redução de movimento respeitada |
| Spring Boot | Controle de acesso por perfil, validação de entradas, consulta paginada e transações de reconhecimento, quitação e estorno |
| Persistência | Migração Flyway V3 compatível com H2 e PostgreSQL. As consultas financeiras usam JdbcClient. As fichas continuam usando Spring Data JPA |

A migração acrescenta o marcador de elegibilidade a `ficha` e cria `controle_diarias_inicio`, `diaria_a_pagar`, `pagamento_manobrista`, `pagamento_manobrista_item`, `pagamento_manobrista_comprovante`, `manobrista_pix` e `manobrista_pix_auditoria`.

A API usa uma chave de operação para reenvios idempotentes e uma revisão por diária para detectar seleções desatualizadas. A transação serializa quitações e estornos por manobrista. Fichas com diárias reconhecidas mantêm os vínculos, a data, a unidade, o turno e os custos reconhecidos. Confirmadores e estornadores ficam identificados mesmo após uma alteração no cadastro de usuários.

O Pix usa máscara na consulta padrão e criptografia AES-GCM para guardar a chave completa. Consultas à chave completa e alterações são auditadas. No perfil PostgreSQL, configure `PIX_SEGREDO` com pelo menos 32 caracteres para habilitar cadastro, atualização e consulta da chave completa. Mantenha o mesmo segredo para acessar as chaves já cadastradas. O padrão do H2 é exclusivo do desenvolvimento.

## Endpoints

As rotas abaixo são relativas a `/api/pagamentos-manobristas` e exigem autenticação como Proprietário ou Gerente.

| Método e rota | Operação |
| --- | --- |
| `GET /resumo` | Indicadores e totais por unidade e mês |
| `GET /diarias` | Diárias reconhecidas, saldos e situações |
| `GET /conferencia` | Diárias elegíveis para conferência |
| `POST /conferencia/{fichaId}` | Reconhecer o valor devido |
| `POST /` | Confirmar quitação manual por multipart, com PDF opcional |
| `GET /historico` · `GET /historico/{id}` | Listar pagamentos e consultar seus detalhes |
| `POST /historico/{id}/estorno` | Registrar estorno com motivo |
| `GET /historico/{id}/comprovante` | Baixar o comprovante |
| `GET /pix/{id}` · `PUT /pix/{id}` | Consultar a máscara e cadastrar ou atualizar a chave |
| `POST /pix/{id}/revelar` | Registrar a consulta e retornar a chave completa |

A validação local segue os formatos publicados pelo Banco Central e o cálculo de dígitos verificadores do CNPJ numérico e alfanumérico. A titularidade e a disponibilidade da chave são conferidas no canal bancário durante o pagamento. [Especificação do DICT](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/API-DICT.html) · [Cálculo do DV do CNPJ](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf)
