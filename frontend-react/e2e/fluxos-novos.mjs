// Testes de uso real das funções novas (modernização).
import puppeteer from 'puppeteer-core';
const BASE = process.argv[2] ?? 'http://localhost:4300';
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-features=PasswordLeakDetection'] });
const r = []; const ok = (n, c, x = '') => r.push(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`);
const esp = (ms) => new Promise((s) => setTimeout(s, ms));
async function abrir(usuario, largura = 1366, tour = false) {
  const p = await (await b.createBrowserContext()).newPage();
  await p.setViewport({ width: largura, height: 900, isMobile: largura < 700, hasTouch: largura < 700 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  p.erros = []; p.on('pageerror', (e) => p.erros.push(e.message));
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  if (!tour) await p.evaluate(() => { const o = {}; for (let i = 1; i < 60; i++) o[i] = { versao: 1, status: 'pulado', passo: 0, atualizadoEm: 'x', dicasVistas: [] }; localStorage.setItem('parkflash.v3.onboarding', JSON.stringify(o)); });
  await p.type('#identificador', usuario); await p.type('#senha', '123456');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), p.click('button[type=submit]')]);
  await esp(500);
  return p;
}
const rotuloPilula = (p, r, escopo = '') => p.$eval(`${escopo} button[aria-haspopup=listbox][aria-label^="${r} "]`, (b) => b.getAttribute('aria-label'));
async function escolher(p, r, opcao, escopo = '') {
  await p.click(`${escopo} button[aria-haspopup=listbox][aria-label^="${r} "]`); await esp(250);
  const ok = await p.evaluate((o) => { const el = [...document.querySelectorAll('[role=option]')].find((x) => x.textContent.trim() === o); el?.click(); return !!el; }, opcao);
  await esp(300); return ok;
}
const clicar = (p, t) => p.evaluate((t) => { const e = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim().replace(/\s+/g, ' ') === t); e?.click(); return !!e; }, t);
try {
  // Login sem a dica da senha padrão
  const l = await (await b.createBrowserContext()).newPage();
  await l.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await clicar(l, 'Esqueci minha senha'); await esp(200);
  const texto = await l.evaluate(() => document.body.innerText);
  ok('Login não exibe mais a senha padrão', !texto.includes('123456') && texto.includes('proprietário'), '');

  const p = await abrir('lucasrodrigues.10@icloud.com');
  // Filtros na URL
  await p.goto(`${BASE}/app/fichas?mes=6&ano=2026&situacao=EM_EDICAO`, { waitUntil: 'networkidle0' }); await esp(400);
  const mesSel = await rotuloPilula(p, 'Mês');
  const sitSel = await rotuloPilula(p, 'Situação');
  ok('Filtros lidos da URL', mesSel === 'Mês Junho' && sitSel === 'Situação Em edição', `${mesSel} | ${sitSel}`);
  await p.click('button[aria-haspopup=listbox][aria-label^="Unidade "]'); await esp(250);
  ok('Seletor próprio abre a lista (sem menu nativo)', !!(await p.$('[role=listbox][aria-label="Unidade"]')));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await esp(300);
  ok('Filtro escolhido vai para a URL', /unidadeId=\d+/.test(p.url()), p.url());
  ok('Etiqueta ativa ganha botão de remover', !!(await p.$('button[aria-label="Remover filtro Unidade"]')));
  await p.click('button[aria-label="Remover filtro Unidade"]'); await esp(300);
  ok('Remover etiqueta tira o filtro da URL', !p.url().includes('unidadeId'), p.url());
  // Agrupamento e contadores
  const grupos = await p.$$eval('.grupo-cab__titulo', (g) => g.map((x) => x.textContent));
  ok('Lista agrupada por situação com contador', grupos.length >= 1 && !!(await p.$('.grupo-cab__contador')), grupos.join(', '));
  // J/K + Enter abre o painel lateral
  await p.keyboard.press('j'); await p.keyboard.press('j'); await esp(150);
  const cursor = await p.$eval('.linha-ficha--cursor', (t) => t.dataset.cursor).catch(() => null);
  ok('J move o cursor na lista', cursor === '1', String(cursor));
  await p.keyboard.press('Enter'); await esp(500);
  ok('Enter abre o painel lateral com ?detalhe na URL', !!(await p.$('pf-modal .sheet--lateral')) && p.url().includes('detalhe='), p.url());
  const antes = new URL(p.url()).searchParams.get('detalhe');
  await p.keyboard.press('j'); await esp(400);
  const depois = new URL(p.url()).searchParams.get('detalhe');
  ok('J no painel troca para a próxima ficha', antes !== depois, `${antes} → ${depois}`);
  await p.keyboard.press('Escape'); await esp(400);
  ok('Esc fecha o painel e limpa ?detalhe', !(await p.$('pf-modal')) && !p.url().includes('detalhe='));
  // Paleta
  await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control'); await esp(300);
  ok('Ctrl+K abre a paleta', !!(await p.$('[aria-label="Paleta de comandos"]')));
  await p.keyboard.type('relat'); await esp(150); await p.keyboard.press('Enter'); await esp(600);
  ok('Paleta navega pela busca', p.url().endsWith('/app/relatorios'), p.url());
  // Menu recolhido persistente
  await p.keyboard.press('['); await esp(300);
  await p.reload({ waitUntil: 'networkidle0' }); await esp(300);
  ok('Menu recolhido e lembrado após recarregar', !!(await p.$('pf-sidebar[data-recolhido]')));
  await p.keyboard.press('['); await esp(200);
  // Carros por mês com filtro na URL
  await p.goto(`${BASE}/app/carros-por-mes?ano=2026&mes=6`, { waitUntil: 'networkidle0' });
  ok('Carros por Mês lê filtros da URL', (await rotuloPilula(p, 'Mês')) === 'Mês Junho');
  const linhasDia = await p.$$eval('.tabela-dias tbody tr', (l) => l.map((x) => x.textContent));
  ok('Mês escolhido mostra carros por dia na tela', linhasDia.length > 2 && linhasDia.at(-1).startsWith('Total do mês'), `${linhasDia.length} linhas`);
  const pdf = await p.evaluate(async () => {
    const token = JSON.parse(localStorage.getItem('parkflash.v3.token'));
    const r = await fetch('/api/relatorios/carros/pdf?ano=2026&mes=6', { headers: { Authorization: `Bearer ${token}` } });
    const b = new Uint8Array(await r.arrayBuffer());
    return { status: r.status, inicio: String.fromCharCode(...b.slice(0, 4)), tamanho: b.length };
  });
  ok('PDF do mês gerado pela API', pdf.status === 200 && pdf.inicio === '%PDF', JSON.stringify(pdf));
  await p.goto(`${BASE}/app/despesas`, { waitUntil: 'networkidle0' });
  await clicar(p, 'Nova despesa'); await esp(400);
  const categorias = await p.$$eval('pf-modal select[name="categoria"] option:not([disabled])', (l) => l.map((o) => o.textContent.trim()));
  const okCampo = await escolher(p, 'Categoria', categorias[0], 'pf-modal');
  ok('Campo de formulário usa o seletor próprio', okCampo && (await rotuloPilula(p, 'Categoria', 'pf-modal')).endsWith(categorias[0]), await rotuloPilula(p, 'Categoria', 'pf-modal'));
  await p.keyboard.press('Escape'); await esp(400);
  await p.goto(`${BASE}/app/eventos`, { waitUntil: 'networkidle0' }); await esp(500);
  ok('Eventos abre no calendário do mês', !!(await p.$('pf-calendario-agenda .cal__grade')) && (await p.$$('pf-calendario-agenda .dia')).length === 42);
  await clicar(p, 'Evento neste dia'); await esp(500);
  const inicioNovo = await p.$eval('pf-modal input[type="datetime-local"]', (e) => e.value).catch(() => '');
  ok('"Evento neste dia" abre o formulário com a data do dia', /^[0-9]{4}-[0-9]{2}-[0-9]{2}T08:00$/.test(inicioNovo), inicioNovo);
  await p.keyboard.press('Escape'); await esp(400);
  const diaAlvo = await p.$eval('pf-calendario-agenda .dia:not(.dia--fora)', (b) => b.getAttribute('data-dia'));
  await p.click(`pf-calendario-agenda [data-dia="${diaAlvo}"]`); await esp(500);
  const inicioClique = await p.$eval('pf-modal input[type="datetime-local"]', (e) => e.value).catch(() => '');
  ok('Clicar no dia abre o cadastro com a data', inicioClique === `${diaAlvo}T08:00`, `${diaAlvo} → ${inicioClique}`);
  await p.keyboard.press('Escape'); await esp(400);
  await clicar(p, 'Lista'); await esp(400);
  ok('Alterna para a lista e guarda na URL', p.url().includes('ver=lista'), p.url());
  ok('Sem erros de JavaScript (novas funções)', p.erros.length === 0, p.erros.join(' | '));

  // Tour: progresso salvo e retomada
  const t = await abrir('pedro@email.com', 1366, true);
  await esp(1300);
  ok('Convite do tour no primeiro acesso', await clicar(t, 'Fazer o tour'));
  await esp(400); await t.keyboard.press('ArrowRight'); await t.keyboard.press('ArrowRight'); await esp(300);
  await t.keyboard.press('Escape'); await esp(300);
  await t.goto(`${BASE}/app/perfil`, { waitUntil: 'networkidle0' }); await esp(300);
  await clicar(t, 'Continuar'); await esp(600);
  const passo = await t.$eval('.tour__passo', (e) => e.textContent).catch(() => '');
  ok('Tour retoma do passo onde parou', passo.startsWith('Passo 3'), passo);
  await clicar(t, 'Pular tour'); await esp(300);
  ok('Pular fecha o tour', !(await t.$('.tour__cartao')));

  // Operador: paleta não oferece telas restritas
  const o = await abrir('dario@email.com');
  await o.keyboard.down('Control'); await o.keyboard.press('k'); await o.keyboard.up('Control'); await esp(300);
  const opcoes = await o.$$eval('[role=option]', (l) => l.map((x) => x.textContent));
  ok('Paleta do operador respeita permissões', !opcoes.some((x) => /Relatórios|Usuários|Despesas/.test(x)), `${opcoes.length} opções`);

  // Celular: "Mais" agrupado
  const m = await abrir('lucasrodrigues.10@icloud.com', 390);
  await clicar(m, 'Mais'); await esp(400);
  const titulos = await m.$$eval('.mais__title', (l) => l.map((x) => x.textContent));
  ok('Celular: "Mais" agrupado por contexto', titulos.includes('Financeiro') && titulos.includes('Cadastros'), titulos.join(', '));

  // Rascunho automático da Nova Ficha
  const r = await abrir('dario@email.com');
  await r.goto(`${BASE}/app/fichas/nova`, { waitUntil: 'networkidle0' });
  await r.$eval('#fichaInicio', (el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '500'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await r.$eval('#fichaFim', (el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '537'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await esp(1200);
  ok('Rascunho salvo enquanto digita', !!(await r.$('.rascunho-salvo')));
  await r.reload({ waitUntil: 'networkidle0' }); await esp(600);
  ok('Ao voltar, oferece continuar o rascunho', !!(await r.$('.rascunho')));
  await clicar(r, 'Continuar'); await esp(400);
  ok('Continuar recupera o que foi digitado', (await r.$eval('#fichaFim', (e) => e.value)) === '537');
  await r.reload({ waitUntil: 'networkidle0' }); await esp(500);
  await clicar(r, 'Descartar'); await esp(300);
  await r.reload({ waitUntil: 'networkidle0' }); await esp(500);
  ok('Descartar apaga o rascunho', !(await r.$('.rascunho')));

  // Página inicial pública e planos
  const inicio = await (await b.createBrowserContext()).newPage();
  await inicio.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  ok('Sem login, o site abre no login', new URL(inicio.url()).pathname === '/login', inicio.url());
  await inicio.goto(`${BASE}/conheca`, { waitUntil: 'networkidle0' });
  ok('A apresentação continua em /conheca', !!(await inicio.$('pf-conheca .heroi')));
  ok('Apresentação mostra o Google Calendar', !!(await inicio.$('#agenda .agenda__exemplo')));
  ok('Sem faixa de celulares', (await inicio.$$('.faixa')).length === 0);
  const capturas = (await inicio.$$('img[src*="/midia/conheca/"]')).length;
  ok('No máximo 2 capturas de tela na apresentação', capturas <= 2, `${capturas}`);

  // Demo interativa do "Como funciona": tudo local, sem chamar a API.
  const chamadasApi = [];
  const vigiar = (req) => { if (req.url().includes('/api')) chamadasApi.push(req.url()); };
  inicio.on('request', vigiar);
  await inicio.evaluate(() => document.querySelector('#como-funciona .demo-reserva')?.scrollIntoView({ block: 'center' }));
  await inicio.waitForSelector('.demo', { timeout: 8000 }).catch(() => {});
  ok('Demo interativa aparece ao chegar em "Como funciona"', !!(await inicio.$('#como-funciona .demo')));
  const passoDemo = () => inicio.$eval('.demo__palco', (e) => e.getAttribute('data-passo')).catch(() => '');
  const tocar = async (nome) => {
    const h = await inicio.evaluateHandle((n) => [...document.querySelectorAll('.demo button, .demo a')].find((b) => b.textContent.trim() === n), nome);
    const el = h.asElement();
    if (el) await el.click();
    await esp(350);
    return !!el;
  };
  ok('Demo: selo de dados fictícios visível', !!(await inicio.$('.demo__selo')));
  await inicio.type('#demo-ticket-final', '1342'); await esp(300);
  ok('Demo: 1342 resulta em 140 carros', (await inicio.$eval('.demo__total output', (o) => o.textContent)) === '140');
  ok('Demo: Enviar para conferência', await tocar('Enviar para conferência') && (await passoDemo()) === '2');
  ok('Demo: Conferir', await tocar('Conferir') && (await passoDemo()) === '3');
  await tocar('Fechar caixa');
  ok('Demo: ficha fecha (papel carimbado)', !!(await inicio.$('.demo .papel--fechada')));
  await tocar('Ir para o pagamento');
  ok('Demo: passo de pagamento', (await passoDemo()) === '4');
  await tocar('Marcar como pago'); await tocar('Marcar como pago');
  ok('Demo: os 2 manobristas pagos mostram o fim', !!(await inicio.$('.demo__fim')) && (await inicio.$$('.demo__equipe li[data-pago]')).length === 2);
  await tocar('Recomeçar');
  ok('Demo: Recomeçar volta ao passo 1 com foco no título', (await passoDemo()) === '1' && (await inicio.evaluate(() => document.activeElement?.textContent ?? '')).startsWith('Etapa 1 de 4'));
  inicio.off('request', vigiar);
  ok('Demo não chama a API', chamadasApi.length === 0, chamadasApi.join(' '));
  const linksTopo = await inicio.$$eval('.topo__nav a', (l) => l.map((x) => x.getAttribute('href')));
  ok('Menu da apresentação sem links para a raiz', linksTopo.includes('/google-calendar') && !linksTopo.some((h) => h?.startsWith('/#')), linksTopo.join(' '));
  await inicio.goto(`${BASE}/google-calendar`, { waitUntil: 'networkidle0' });
  const tituloGc = await inicio.$eval('h1', (e) => e.textContent).catch(() => '');
  ok('Página do Google Calendar', tituloGc.includes('agenda da operação'), tituloGc);
  ok('Página do Google Calendar explica iPhone e Outlook', await inicio.evaluate(() => [...document.querySelectorAll('.gc__app h3')].map((h) => h.textContent).join(',') === 'Google Calendar,iPhone,Outlook'));
  ok('Navegação da apresentação tem Planos', await inicio.evaluate(() => [...document.querySelectorAll('.topo__nav a')].some((a) => a.textContent === 'Planos')));
  await inicio.goto(`${BASE}/planos`, { waitUntil: 'networkidle0' });
  const planos = await inicio.$$eval('.plano h2', (l) => l.map((x) => x.textContent));
  ok('Página de planos lista os planos', planos.length === 3, planos.join(', '));
  const precos = await inicio.$$eval('.plano__preco', (l) => l.map((x) => x.textContent));
  ok('Planos sem preço inventado (sob consulta)', precos.every((t) => t === 'Sob consulta'), precos.join(' | '));
  const logado = await abrir('lucasrodrigues.10@icloud.com');
  await logado.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  ok('Com login, a página inicial leva ao sistema', logado.url().includes('/app/'), logado.url());

  // Landing
  const lp = await (await b.createBrowserContext()).newPage();
  await lp.goto(`${BASE}/conheca`, { waitUntil: 'networkidle0' });
  await esp(200);
  const h1 = await lp.$eval('h1', (e) => e.textContent);
  // A demo usa valores fictícios em R$ que não são preço: fica fora da checagem.
  const corpo = await lp.evaluate(() => {
    const demo = document.querySelector('.demo')?.innerText ?? '';
    return demo ? document.body.innerText.split(demo).join('') : document.body.innerText;
  });
  ok('Landing pública com o slogan', h1.includes('Seu estacionamento') && h1.includes('sob controle'), h1);
  ok('Landing sem preços nem depoimentos', !/R\$\s?\d|depoimento|clientes atendidos/i.test(corpo));

  // Google Calendar: link de agenda no Perfil
  const g = await abrir('pedro@email.com');
  await g.goto(`${BASE}/app/perfil`, { waitUntil: 'networkidle0' }); await esp(400);
  ok('Perfil do gerente oferece o Google Calendar', await clicar(g, 'Gerar link da agenda'));
  await g.waitForSelector('#perfil-agenda-url', { timeout: 5000 }).catch(() => {});
  const link = await g.$eval('#perfil-agenda-url', (e) => e.value).catch(() => '');
  ok('Link da agenda gerado', /\/api\/agenda\/[A-Za-z0-9_-]{40,}\.ics$/.test(link), link.replace(/agenda\/.{6}.*\.ics/, 'agenda/…ics'));
  const ics = link ? await (await fetch(link)).text() : '';
  ok('O link abre a agenda sem login', ics.startsWith('BEGIN:VCALENDAR') && ics.includes('X-WR-CALNAME:Park Flash'));
  ok('Botão leva ao Google Calendar', await g.$eval('a[href*="calendar.google.com"]', (a) => a.target === '_blank').catch(() => false));
  const op = await abrir('dario@email.com');
  await op.goto(`${BASE}/app/perfil`, { waitUntil: 'networkidle0' }); await esp(300);
  ok('Operador não vê o Google Calendar', !(await op.$('#perfil-agenda')));

  // Sócio: entra direto na própria sociedade e não vê a operação
  const sc = await abrir('francisco@email.com');
  await esp(600);
  ok('Sócio entra em Minha sociedade', sc.url().endsWith('/app/sociedade'), sc.url());
  await sc.waitForSelector('.unidade', { timeout: 8000 }).catch(() => {});
  const titulo = await sc.$eval('h1', (e) => e.textContent).catch(() => '');
  ok('Título da tela do sócio', titulo.includes('Minha sociedade'), titulo);
  const menuSocio = await sc.$$eval('nav a', (l) => l.map((a) => a.getAttribute('href')));
  ok('Menu do sócio sem fichas nem equipe', !menuSocio.some((h) => /fichas|manobristas|despesas|relatorios/.test(h ?? '')), menuSocio.join(' '));
  await sc.goto(`${BASE}/app/fichas`, { waitUntil: 'networkidle0' }); await esp(300);
  ok('Sócio que digita /app/fichas volta para a sociedade', sc.url().endsWith('/app/sociedade'), sc.url());
  ok('Sem erros de JavaScript (sócio)', sc.erros.length === 0, sc.erros.join(' | '));
  const dono = await abrir('lucasrodrigues.10@icloud.com');
  await dono.goto(`${BASE}/app/sociedade`, { waitUntil: 'networkidle0' }); await esp(500);
  ok('Proprietário escolhe o sócio na Sociedade', !!(await dono.$('button[aria-label^="Sócio "]')));
  // Usuários com sócios cadastrados (a tela quebrava só para o proprietário, que vê os sócios)
  await dono.goto(`${BASE}/app/usuarios`, { waitUntil: 'networkidle0' }); await esp(500);
  const telaUsuarios = await dono.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, quebrou: document.body.innerText.includes('Unexpected Application Error') }));
  ok('Proprietário abre Usuários com sócios cadastrados', telaUsuarios.h1 === 'Usuários' && !telaUsuarios.quebrou, JSON.stringify(telaUsuarios));

  // Fechamento com a ficha de papel
  await dono.goto(`${BASE}/app/fichas?mes=6&ano=2026&detalhe=10`, { waitUntil: 'networkidle0' }); await esp(500);
  await clicar(dono, 'Enviar para conferência'); await esp(250);
  await clicar(dono, 'Confirmar'); await esp(900);
  await clicar(dono, 'Confirmar fechamento'); await esp(500);
  ok('Fechamento mostra a ficha de papel', !!(await dono.$('pf-ficha-papel .papel__picote')));
  ok('Fechamento sem espaço de assinatura', !(await dono.$('pf-ficha-papel canvas')));
  await clicar(dono, 'Fechar ficha'); await esp(400);
  ok('O canhoto rasga ao fechar', !!(await dono.$('.papel--fechada')));
  await esp(1800);
  const situacao = await dono.$eval('.det', (d) => d.textContent).catch(() => '');
  ok('Ficha fica fechada', situacao.includes('Fechada'), situacao.slice(0, 60));
  ok('Sem erros de JavaScript (fechamento)', dono.erros.length === 0, dono.erros.join(' | '));

  // Perdidinho ajudante: painel "Precisa da sua atenção" (gestão vê as pendências do nível, operador não)
  const criada = await dono.evaluate(async () => {
    const token = JSON.parse(localStorage.getItem('parkflash.v3.token'));
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const r = await fetch('/api/fichas', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: hoje, unidadeId: 1, turno: 'noite', fichaInicio: 100, fichaFim: 150, fichasCanceladas: 0, valorDinheiro: 100, valorCartao: 50, taxaMaquininha: 2, manobristas: [], despesasAdicionais: [], totalBruto: 0, totalLiquido: 0, totalCarros: 0 }) });
    return r.status;
  });
  ok('Ficha aberta do mês disponível para o teste do ajudante', criada === 201 || criada === 409, `${criada} (409 = o dia já tem ficha de outro passo)`);
  await dono.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle0' }); await esp(700);
  const botaoAj = 'pf-ajudante-perdidinho[data-variante=barra] button.ajud__botao';
  const rotuloAj = await dono.$eval(botaoAj, (e) => e.getAttribute('aria-label')).catch(() => '');
  ok('Ajudante na barra do topo com número de pendências', /Pendências: [1-9]/.test(rotuloAj), rotuloAj);
  const lugar = await dono.evaluate((sel) => {
    const e = document.querySelector(sel); const r = e.getBoundingClientRect();
    const barra = e.closest('header.barra-topo'); const br = barra?.getBoundingClientRect();
    const main = document.querySelector('main');
    const sino = barra?.querySelector('a[href="/app/notificacoes"]');
    const fixos = [...document.querySelectorAll('pf-ajudante-perdidinho, pf-balao-companheiro')].filter((x) => getComputedStyle(x).position === 'fixed');
    return { dentroDaBarra: !!barra, altura: br && Math.round(br.height), topo: br && Math.round(br.top), pos: barra && getComputedStyle(barra).position,
      antesDoMain: !!barra && !!main && !!(barra.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
      l: Math.round(r.width), a: Math.round(r.height), direita: Math.round(innerWidth - r.right), nome: barra?.getAttribute('aria-label'),
      sinoNaBarra: !!sino, sinoNaSidebar: !!document.querySelector('aside a[href="/app/notificacoes"]'),
      sinoDepois: !!sino && !!(e.compareDocumentPosition(sino) & Node.DOCUMENT_POSITION_FOLLOWING), fixos: fixos.length, rodape: parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom) };
  }, botaoAj);
  ok('Ajudante dentro da barra superior de 48 px, colada no topo, antes do main', lugar.dentroDaBarra && lugar.altura === 48 && lugar.topo === 0 && lugar.pos === 'sticky' && lugar.antesDoMain && lugar.nome === 'Barra do topo', JSON.stringify(lugar));
  ok('Botão do Perdidinho com alvo de 44 px, sino logo depois (e fora da sidebar), nada fixo no canto', lugar.l >= 44 && lugar.a >= 44 && lugar.sinoNaBarra && lugar.sinoDepois && !lugar.sinoNaSidebar && lugar.fixos === 0, JSON.stringify(lugar));
  ok('Sem reserva de rodapé no conteúdo desktop (antigo padding-bottom de 68 px)', lugar.rodape < 60, String(lugar.rodape));
  await dono.click(botaoAj); await esp(500);
  const painelAj = await dono.evaluate(() => {
    const d = document.querySelector('pf-painel-atencao [role=dialog]');
    const c = d && getComputedStyle(d); const r = d?.getBoundingClientRect();
    return d ? { foco: document.activeElement?.tagName === 'H2' && d.contains(document.activeElement), modal: d.getAttribute('aria-modal'),
      gaveta: { pos: c.position, largura: Math.round(r.width), direita: Math.round(innerWidth - r.right), topo: Math.round(r.top), baixo: Math.round(innerHeight - r.bottom), borda: c.borderLeftWidth },
      barraVisivel: (() => { const b = document.querySelector('button.ajud__botao').getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('button.ajud__botao') !== null; })(),
      textos: [...d.querySelectorAll('li a')].map((a) => a.textContent), expandido: document.querySelector('button.ajud__botao')?.getAttribute('aria-expanded') } : null;
  });
  ok('Gaveta fixa à direita (380 px, colada na borda, abaixo da barra), sem cobrir o botão do Perdidinho', !!painelAj && painelAj.gaveta.pos === 'fixed' && painelAj.gaveta.largura === 380 && painelAj.gaveta.direita === 0 && painelAj.gaveta.topo >= 0 && painelAj.gaveta.topo <= 48 && painelAj.gaveta.baixo === 0 && painelAj.barraVisivel, JSON.stringify(painelAj?.gaveta));
  ok('Painel abre, não modal, com foco no título', !!painelAj && painelAj.foco && painelAj.modal === null && painelAj.expandido === 'true', JSON.stringify(painelAj));
  // A ficha do mês ainda não fechada aparece como "não enviada" (em edição) ou "esperando conferência" (pronta), nunca nas duas.
  ok('Painel lista a ficha do mês ainda não fechada', !!painelAj && painelAj.textos.some((t) => /ainda não enviadas? travam? a divisão de lucro|esperando sua conferência/.test(t)), (painelAj?.textos ?? []).join(' | '));
  await dono.keyboard.press('Escape'); await esp(400);
  const aposEsc = await dono.evaluate(() => ({ painel: !!document.querySelector('pf-painel-atencao [role=dialog]'), foco: document.activeElement?.classList.contains('ajud__botao') }));
  ok('Esc fecha o painel e devolve o foco ao botão', !aposEsc.painel && aposEsc.foco, JSON.stringify(aposEsc));
  ok('Sem erros de JavaScript (ajudante)', dono.erros.length === 0, dono.erros.join(' | '));

  const opAj = await abrir('dario@email.com');
  await opAj.goto(`${BASE}/app/fichas`, { waitUntil: 'networkidle0' }); await esp(600);
  const rotuloOp = await opAj.$eval(botaoAj, (e) => e.getAttribute('aria-label')).catch(() => '');
  ok('Operador não vê pendências de gestão', rotuloOp.includes('Pendências: nenhuma'), rotuloOp);

  const celAj = await abrir('lucasrodrigues.10@icloud.com', 390);
  await celAj.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle0' }); await esp(700);
  const alvoCel = await celAj.$eval('pf-ajudante-perdidinho[data-variante=topo] button.ajud__botao', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).catch(() => null);
  ok('Celular: botão do ajudante no topo com alvo de 44 px', !!alvoCel && alvoCel[0] >= 44 && alvoCel[1] >= 44, String(alvoCel));
  await celAj.click('pf-ajudante-perdidinho[data-variante=topo] button.ajud__botao'); await esp(600);
  const folhaCel = await celAj.evaluate(() => { const d = document.querySelector('pf-painel-atencao [role=dialog]'); return d ? d.getAttribute('aria-modal') : null; });
  ok('Celular: abre folha inferior modal', folhaCel === 'true', String(folhaCel));
  await celAj.keyboard.press('Escape'); await esp(500);
  ok('Celular: Esc fecha a folha', !(await celAj.$('pf-painel-atencao [role=dialog]')));

  // ===== Falas do Perdidinho (etapa 1) =====
  const ontemSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - 24 * 3600_000));
  // O gerente de demonstração não tem unidades (não vê fichas); o escopo dele é coberto no teste de integração do backend.
  const gerente = await abrir('lucasrodrigues.10@icloud.com');
  const fichaOntem = await gerente.evaluate(async (data) => {
    const token = JSON.parse(localStorage.getItem('parkflash.v3.token'));
    const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const unidades = await (await fetch('/api/unidades', { headers: h })).json();
    const r = await fetch('/api/fichas', { method: 'POST', headers: h, body: JSON.stringify({
      data, unidadeId: unidades[0].id, turno: 'noite', fichaInicio: 5000, fichaFim: 5021, fichasCanceladas: 0, totalCarros: 21,
      valorDinheiro: 210, valorCartao: 0, valorPix: 0, taxaMaquininha: 2, manobristas: [], despesasAdicionais: [], totalBruto: 210, totalLiquido: 210,
    }) });
    return r.status;
  }, ontemSP);
  await gerente.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle0' }); await esp(3500);
  const balao = await gerente.$eval('pf-balao-companheiro', (e) => e.textContent).catch(() => null);
  await gerente.click('button.ajud__botao'); await esp(600);
  const disse = await gerente.evaluate(() => {
    const s = document.querySelector('pf-painel-atencao [aria-labelledby$="-disse"]');
    return s ? [...s.querySelectorAll('li')].map((l) => l.textContent) : null;
  });
  ok('Painel (gestão): resumo de ontem no balão ou em "Hoje o Perdidinho disse"',
    (!!balao && /Ontem: \d+ carros?/.test(balao)) || (!!disse && disse.some((t) => /Ontem: \d+ carros?/.test(t))),
    `ficha ontem HTTP ${fichaOntem}; balão=${balao}; histórico=${JSON.stringify(disse)}`);
  ok('Resumo de ontem não tem valor vazio nem "undefined"', !(disse ?? []).some((t) => /undefined|null|\{/.test(t)) && !/undefined|null/.test(balao ?? ''));
  ok('Sem erros de JavaScript (falas, painel)', gerente.erros.length === 0, gerente.erros.join(' | '));

  const oper = await abrir('dario@email.com');
  await oper.goto(`${BASE}/app/fichas/nova`, { waitUntil: 'networkidle0' }); await esp(500);
  // O operador de demonstração não tem unidades: o aviso de recebimentos não depende da unidade.
  await oper.type('#fichaInicio', '1000'); await oper.type('#fichaFim', '1010');
  await oper.click('#dinheiro'); await oper.type('#dinheiro', '0'); await oper.keyboard.press('Tab'); await esp(500);
  const aviso10 = await oper.$eval('.resumo__fala pf-perdidinho-diz', (e) => e.textContent).catch(() => null);
  ok('Operador: aviso inline sobre recebimentos zerados, acima de "Lançar Ficha"', !!aviso10 && aviso10.includes('Nenhum recebimento lançado para 10 carros'), String(aviso10));
  const posicao = await oper.evaluate(() => {
    const fala = document.querySelector('.resumo__fala'); const botao = [...document.querySelectorAll('.resumo__card button')].find((b) => b.textContent.includes('Lançar'));
    return !!fala && !!botao && !!(fala.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  ok('O aviso vem antes do botão Lançar e não bloqueia', posicao);
  ok('Sem erros de JavaScript (falas, operador)', oper.erros.length === 0, oper.erros.join(' | '));
} catch (e) { r.push(`❌ ERRO NO ROTEIRO: ${e.message}`); }
console.log(r.join('\n'));
await b.close();
