# Central de notificações e Web Push do Park Flash

Proprietários e gerentes têm uma central persistente no Park Flash. O menu mostra o total de notificações não lidas. Na central, é possível filtrar, marcar um aviso ou a lista como lida e abrir o registro relacionado. A área de preferências controla os novos avisos por categoria para a conta. Cada navegador ou instalação tem sua própria inscrição para push.

## Eventos

| Categoria | Origem e destino |
|---|---|
| Ficha registrada | Gravação da ficha. Abre o detalhe da ficha. |
| Aguardando fechamento | Transição para conferência. Uma nova submissão depois de uma devolução é outra ocorrência. Abre a ficha. |
| Pagamento pendente | Reconhecimento de uma diária pelo fluxo existente. Abre sua ficha. Se a diária for quitada antes da distribuição, o aviso pendente é descartado. Uma ficha com custo sem reconhecimento não gera aviso de dívida. |
| Pagamento confirmado | Registro de uma nova baixa. Abre seu histórico de pagamento. Uma repetição idempotente da baixa não gera outro aviso. |
| Divergência financeira | Proprietário ou gerente autorizado sinaliza uma divergência na ficha e informa o motivo. O motivo permanece no histórico da ficha. Há um aviso por ficha, sem alterar valores nem presumir uma regra automática de conciliação. |
| Evento próximo | Evento planejado ou confirmado que começa nas próximas 24 horas, pelo horário de São Paulo. Há um lembrete por evento. |
| Escala alterada | Edição efetiva dos dados ou da equipe de uma escala. Reenviar o mesmo conteúdo não cria novo alerta. |

O backend exige que gerentes tenham acesso a todas as unidades envolvidas em cada aviso, inclusive baixas que reúnem unidades diferentes. A permissão é verificada ao distribuir, consultar e preparar um envio. Os links voltam a passar pela autorização do recurso. As preferências valem para novos avisos e para envios ainda na fila. O histórico que já chegou à central continua consultável enquanto houver acesso à unidade.

## Interface e instalação

A central reaproveita navegação, cartões, cabeçalhos e controles do Park Flash. O filtro destaca o que precisa de leitura. O link abre a ficha, o pagamento ou o registro de agenda sem exigir uma busca. A tela distingue ausência de avisos, carregamento, erro, permissão bloqueada e envio pausado. As opções usam controles nativos de teclado e foco. A interface mantém a navegação existente e não acrescenta animações.

- Em desktop e Android, abra o Park Flash em um navegador que ofereça Service Workers, Push API e Notifications API. A disponibilidade de instalação e entrega depende do navegador e das configurações do dispositivo. [PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
- Em iPhone e iPad com iOS/iPadOS 16.4 ou posterior, use o menu Compartilhar para adicionar o Park Flash à Tela de Início. Abra pelo ícone instalado e toque em **Notificações → Preferências → Ativar neste dispositivo**. O navegador pede permissão após esse toque. Se o acesso foi bloqueado, ajuste a permissão do dispositivo antes de tentar outra vez. [WebKit sobre Web Push em iOS e iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- O aviso na tela bloqueada é genérico e abre a central. Identidades, CPF, chaves Pix, valores, motivos e identificadores internos ficam fora da mensagem entregue ao provedor. Um aceite do provedor não comprova entrega, exibição ou leitura. A central mantém os avisos mesmo com push indisponível.

## Configuração e diagnóstico

O deploy de homologação precisa servir o aplicativo em HTTPS, com manifesto, ícones e `/push-worker.js` na própria origem. O proxy deve preservar `/api` e o fallback do Angular para `/app/notificacoes`. O worker não intercepta requisições nem cria cache. Sirva seu script com revalidação para permitir atualizações. Loopback foi usado apenas nos ensaios locais. [Web Push HTTP](https://www.rfc-editor.org/rfc/rfc8030.html)

Use um par estável de chaves VAPID P-256 do ambiente. `PUSH_VAPID_PUBLICA` recebe o ponto público não comprimido de 65 bytes em Base64url. `PUSH_VAPID_PRIVADA` recebe PKCS#8 DER em Base64url e deve ficar no gerenciador de segredos. `PUSH_VAPID_CONTATO` recebe um endereço `mailto:` ou URL HTTPS oficial. O servidor valida o par antes de habilitar as inscrições. Alterar a chave requer reativar os dispositivos. [VAPID e restrição de inscrições](https://www.rfc-editor.org/rfc/rfc8292.html)

O dispatcher tenta entregar até quatro vezes, com espera de 1, 2 e 4 minutos para erros transitórios. Respostas 404 e 410 removem a inscrição. As reservas expiram se um worker cair. Os logs guardam ID interno, tentativa, estado e código, sem registrar o URL da inscrição. Na interface, **Ver atividade de envio** mostra os resultados recentes da própria conta. A origem de envio é limitada aos endpoints permitidos de FCM, Mozilla Autopush e Apple Push, com HTTPS e sem redirecionamentos. O aviso do celular pode substituir avisos anteriores com o mesmo identificador visual. A central conserva cada ocorrência e destinatário de forma idempotente.

`PUSH_ENVIAR=false` pausa o despacho e mantém a central e o cadastro de dispositivos funcionando. Sem as três variáveis VAPID válidas, o push fica indisponível e a central continua funcionando. As fichas e as baixas gravam apenas o evento na transação local. O envio ao provedor ocorre em tarefa assíncrona, fora dessa transação.

## Arquivos e testes

- A migração `backend/src/main/resources/db/migration/V13__notificacoes_push.sql` cria a fila de eventos, o escopo por unidade, a caixa de entrada, as preferências, os dispositivos e as tentativas.
- `backend/src/main/java/com/parkflash/notificacao/` implementa a fila, distribuição, segurança de destinatários e entrega VAPID. `web/NotificacaoController.java` expõe as rotas `/api/notificacoes`. `FichaService`, `PagamentoManobristaService` e `AgendaService` registram os eventos transacionais.
- `src/app/features/notificacoes/` contém a central e as preferências. `src/app/core/services/` integra contador, inscrições e sessão. `public/manifest.webmanifest`, `public/push-worker.js` e `public/pwa/` complementam a PWA.
- 37 testes Java passaram em H2, incluindo 6 de integração da central e 2 de VAPID e transporte sem payload. A migração V13 e os 6 cenários da central passaram também em PostgreSQL 16 descartável. Os cenários incluem preferências, escopo, deduplicação, leitura, vencimento de inscrição e retentativa com provedor simulado.
- O build Angular de desenvolvimento, os 31 testes do frontend em Chrome headless e os 3 testes do worker passaram. Os testes do worker cobrem o aviso genérico, o clique seguro e a ausência de interceptação de requisições. Execute-os com `node --test tests/push-worker.test.cjs`.
- O ensaio local no Chrome, em larguras de 1.440 e 390 px, passou por login, reconhecimento de diária, contador e leitura, abertura da ficha, preferências persistentes, ativação explícita e desativação. O Chrome executou o service worker e exibiu o aviso genérico a partir de um evento push injetado pelo DevTools. O provedor de inscrição foi simulado e o despacho externo ficou desativado.

## Homologação em 21/11/2026

O ensaio usou HTTPS temporário, dados sintéticos, banco H2 em memória e chaves VAPID exclusivas de teste. O Chrome Android em emulador e o Chrome desktop registraram inscrições reais. A primeira rodada no Android recebeu HTTP 403. O provedor recusou o JWT porque o campo `aud` estava serializado como uma lista. O transporte passou a usar uma string com a origem do provedor e o teste de regressão verifica o tipo no JSON antes de validar a assinatura. Os 37 testes Java passaram após a correção. [Exemplo de JWT VAPID no RFC 8292](https://www.rfc-editor.org/rfc/rfc8292.html#section-2.4)

- **Despacho real.** O Firebase Cloud Messaging aceitou na primeira tentativa os alertas gerados por fichas e lembretes de eventos sintéticos para as inscrições Android e desktop, com HTTP 201. A gravação e a distribuição interna funcionaram também na rodada em que o provedor recusou o pedido.
- **Android.** A instalação pela tela de início abriu o Park Flash no modo de aplicativo. Com o navegador em segundo plano, uma injeção controlada pelo DevTools exibiu o aviso genérico na bandeja do sistema. O toque retornou à central. Nesse ambiente, a exibição de um aviso vindo pela rede do FCM permaneceu sem confirmação.
- **Expiração e reativação.** Um envio real retornou HTTP 410 e o cadastro do Chrome desktop foi removido. A ação Ativar agora solicita uma nova inscrição ao navegador. Um teste isolado no Chrome verificou o descarte da inscrição antiga e o registro da nova para o mesmo dispositivo. Depois da reativação no Chrome desktop, o FCM voltou a aceitar o envio real.
- **Desktop.** O aceite do provedor foi verificado. O perfil isolado do Chrome registrou falha de autenticação no canal de recebimento GCM, portanto a exibição de um aviso vindo pela rede permaneceu sem confirmação.
- **iPhone.** Nenhum aparelho físico estava conectado. A entrega e o toque no alerta precisam ser testados em um aparelho físico com o Park Flash instalado pela Tela de Início. Nos testes finais em aparelhos físicos, valide também tela bloqueada, troca de conta, revogação de permissão e reativação da inscrição.

O build de desenvolvimento, os 31 testes Angular e os 3 testes do service worker passaram após a correção de reativação. O ensaio usou somente a infraestrutura isolada de homologação.

## Novo ensaio em 22/11/2026

Foi criado outro ambiente HTTPS temporário, com banco sintético e chaves próprias. O Chrome desktop, em janela normal e perfil isolado, criou uma inscrição FCM válida. O canal de recebimento GCM voltou a registrar falha de autenticação. O provedor aceitou o primeiro pedido (HTTP 201) e, em seguida, informou inscrição expirada (HTTP 410). O Park Flash removeu o cadastro vencido. A exibição de um aviso vindo pela rede ficou sem confirmação nesse perfil. A confirmação em iPhone e Android físicos depende da ativação e da observação da bandeja nos aparelhos.

## Central única e teste por aparelho

O sino do celular e o item da barra lateral do desktop levam à central. O painel tem o botão **Pendências** para seus indicadores e ações. A central oferece atualização manual e recarrega quando volta à tela.

A inscrição é preparada ao abrir as preferências. O toque em **Ativar neste dispositivo** inicia `PushManager.subscribe()` diretamente, mantendo o gesto exigido pelos navegadores. A assinatura VAPID é reutilizada por origem enquanto estiver válida. [Ativação e envio Web Push da Apple](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)

O botão **Enviar aviso de teste** usa apenas a inscrição do aparelho atual e devolve o resultado do provedor. O servidor aplica um intervalo de 30 segundos por conta. O teste é genérico e não cria item na central. Se a inscrição expirar, ela é removida e o aparelho pode ser reativado. A migração V17 guarda o intervalo do teste. Em uma prévia com push pausado ou sem chaves, a central continua disponível.

Em 22/11/2026, o emulador Android recebeu na bandeja tanto o aviso de teste quanto um aviso da fila de uma ficha sintética, com o aplicativo em segundo plano. O provedor aceitou os três pedidos associados à ficha. O texto exibido na bandeja permaneceu genérico. A visualização em iPhone e Android físicos depende da confirmação no aparelho.

No novo teste do Chrome desktop, o botão recebeu aceite do FCM. O canal GCM registrou erro de autenticação e o navegador não exibiu o aviso durante a verificação. O build, 42 testes Java, 31 testes Angular e 3 testes do worker passaram. A migração V17 foi verificada em PostgreSQL descartável.
