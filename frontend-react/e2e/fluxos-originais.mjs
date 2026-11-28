// Testes de uso real no React (backend de demonstração local).
import puppeteer from 'puppeteer-core';
const BASE = process.argv[2] ?? 'http://localhost:4300';
const navegador = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--disable-features=PasswordLeakDetection,PasswordManagerOnboarding,AutofillServerCommunication', '--password-store=basic'] });
const resultados = [];
const ok = (nome, cond, extra = '') => { resultados.push(`${cond ? '✅' : '❌'} ${nome}${extra ? ' — ' + extra : ''}`); };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// Data de hoje no fuso do negócio. O banco de teste é novo a cada rodada e só reconhece
// diárias a partir do dia em que foi criado, então a ficha do roteiro tem de ser de hoje.
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const [ANO_HOJE, MES_HOJE] = HOJE.split('-').map(Number);

async function abrir(usuario, largura = 1366) {
  const contexto = await navegador.createBrowserContext();
  const p = await contexto.newPage();
  await p.setViewport({ width: largura, height: 900 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  p.erros = [];
  p.on('pageerror', (e) => p.erros.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('status of 4')) p.erros.push(m.text()); });
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await p.type('#identificador', usuario);
  await p.type('#senha', '123456');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), p.click('button[type=submit]')]);
  await espera(500);
  return p;
}
const clicarTexto = async (p, texto, seletor = 'button, a') => {
  const ok = await p.evaluate((t, s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent.trim().replace(/\s+/g, ' ') === t && !e.disabled);
    if (el) { el.click(); return true; } return false;
  }, texto, seletor);
  if (!ok) throw new Error(`não achei "${texto}"`);
  await espera(400);
};
const aviso = async (p) => (await p.$eval('pf-aviso .aviso__texto', (e) => e.textContent).catch(() => ''));
// Preenche como o usuário: dispara 'input' no campo (o Chrome de teste perde o teclado após o login).
const definir = async (p, seletor, valor) => {
  await p.$eval(seletor, (el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }, String(valor));
  await espera(80);
};

try {
  // ===== Dono =====
  const p = await abrir('lucasrodrigues.10@icloud.com');
  ok('Login do dono leva ao painel', p.url().endsWith('/app/dashboard'));

  // Nova ficha
  await p.goto(`${BASE}/app/fichas/nova`, { waitUntil: 'networkidle0' });
  const unidade = await p.$eval('#unidade option:not([disabled])', (o) => o.value);
  await p.select('#unidade', unidade);
  await definir(p, '#data', HOJE);
  await p.$eval('input[type=radio][value=noite]', (r) => r.click());
  await definir(p, '#fichaInicio', 1000);
  await definir(p, '#fichaFim', 1040);
  await definir(p, '#canceladas', 2);
  const total = await p.$eval('#totalCarros', (e) => e.value);
  ok('Total de carros calculado (1040−1000−2)', total === '38', `mostrou ${total}`);
  const mano = await p.$eval('.linha--equipe select option:not([disabled])', (o) => o.value);
  await p.select('.linha--equipe select', mano);
  await p.select('.linha__pagamento select', 'PENDENTE');
  await definir(p, '#dinheiro', 500);
  await definir(p, '#cartao', 300);
  await definir(p, '#taxa', 2);
  const saldo = await p.$eval('.resumo__saldo strong', (e) => e.textContent.trim());
  ok('Prévia do saldo (500 + 300 − 6 − 80)', saldo.replace(/\s/g, ' ') === 'R$ 714,00', `mostrou ${saldo}`);
  await clicarTexto(p, 'Lançar Ficha');
  await p.waitForFunction(() => location.pathname === '/app/fichas', { timeout: 5000 }).catch(() => {});
  ok('Ficha lançada e volta para a lista', p.url().endsWith('/app/fichas'), await aviso(p));

  // Detalhe + transição
  await p.goto(`${BASE}/app/fichas?mes=${MES_HOJE}&ano=${ANO_HOJE}`, { waitUntil: 'networkidle0' });
  await clicarTexto(p, 'Ver');
  const titulo = await p.$eval('pf-modal .sheet__title', (e) => e.textContent).catch(() => '');
  ok('Detalhe da ficha abre', titulo.startsWith('Ficha de'), titulo);
  await clicarTexto(p, 'Enviar para conferência');
  await clicarTexto(p, 'Confirmar');
  await espera(700);
  const situacao = await p.$$eval('pf-modal .det__linha', (l) => l.map((x) => x.textContent).find((t) => t.startsWith('Situação')) ?? '');
  ok('Enviar para conferência muda a situação', situacao.includes('Pronta para conferência'), situacao);
  await p.$eval('pf-modal .sheet', (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await espera(500);
  ok('Esc fecha o modal', !(await p.$('pf-modal')));

  // Calendário
  await p.goto(`${BASE}/app/despesas`, { waitUntil: 'networkidle0' });
  await clicarTexto(p, 'Nova despesa');
  await p.$eval('pf-calendario .gatilho', (b) => b.click());
  await espera(300);
  const aberto = await p.$eval('pf-calendario .painel', (e) => e.matches(':popover-open'));
  ok('Calendário abre', aberto);
  await p.evaluate(() => [...document.querySelectorAll('pf-calendario .grade button')].find((b) => b.textContent === '10').click());
  await espera(300);
  const dataEscolhida = await p.$eval('#d-data', (e) => e.value);
  ok('Escolher dia no calendário preenche o campo', /^\d{4}-\d{2}-10$/.test(dataEscolhida), dataEscolhida);

  // Despesa
  await p.select('#d-unidade', unidade);
  await definir(p, '#d-descricao', 'Aluguel teste React');
  await definir(p, '#d-valor', '1234.56');
  await clicarTexto(p, 'Salvar despesa');
  ok('Despesa salva', (await aviso(p)) === 'Despesa salva.', await aviso(p));

  // Validação: valor zero
  await clicarTexto(p, 'Nova despesa');
  await clicarTexto(p, 'Salvar despesa');
  const erros = await p.$$eval('pf-modal .pf-error', (l) => l.map((e) => e.textContent));
  ok('Validação mostra erros ao salvar vazio', erros.length >= 2, erros.join(' | '));
  await p.$eval('pf-modal .sheet', (el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await espera(500);

  // Manobrista com máscara
  await p.goto(`${BASE}/app/manobristas`, { waitUntil: 'networkidle0' });
  await clicarTexto(p, 'Novo manobrista');
  await definir(p, '#m-nome', 'Teste React');
  await definir(p, '#m-cpf', '52998224725');
  await definir(p, '#m-telefone', '11987654321');
  const cpf = await p.$eval('#m-cpf', (e) => e.value);
  const tel = await p.$eval('#m-telefone', (e) => e.value);
  ok('Máscaras de CPF e telefone', cpf === '529.982.247-25' && tel === '(11) 98765-4321', `${cpf} ${tel}`);
  await clicarTexto(p, 'Salvar');
  ok('Manobrista salvo', (await aviso(p)) === 'Manobrista salvo.', await aviso(p));

  // Pagamentos: reconhecer + pagar
  await p.goto(`${BASE}/app/pagamentos-manobristas`, { waitUntil: 'networkidle0' });
  await clicarTexto(p, 'Conferir fichas');
  await espera(600);
  const temCandidato = await p.$$eval('button', (b) => b.some((x) => x.textContent.trim() === 'Conferir'));
  if (temCandidato) {
    await clicarTexto(p, 'Conferir');
    await clicarTexto(p, 'Reconhecer diária');
    await espera(600);
    ok('Diária reconhecida', (await aviso(p)).startsWith('Diária reconhecida'), await aviso(p));
  }
  {
    await clicarTexto(p, 'Diárias a pagar');
    await espera(700);
    const marcou = await p.evaluate(() => { const c = [...document.querySelectorAll('input[type=checkbox]')].find((x) => !x.disabled); if (c) c.click(); return !!c; });
    await espera(300);
    if (marcou) {
      await clicarTexto(p, 'Revisar pagamento');
      await clicarTexto(p, 'Já paguei · confirmar');
      await espera(900);
      const tituloPg = await p.$eval('pf-modal .sheet__title', (e) => e.textContent).catch(() => '');
      ok('Pagamento registrado e detalhe aberto', tituloPg.startsWith('Pagamento #'), `${tituloPg} · ${await aviso(p)}`);
    } else ok('Havia diária para selecionar', false);
  }
  ok('Sem erros de JavaScript (dono)', p.erros.length === 0, p.erros.join(' | '));
  await p.close();

  // ===== Gerente =====
  const g = await abrir('pedro@email.com');
  await g.goto(`${BASE}/app/usuarios`, { waitUntil: 'networkidle0' });
  ok('Gerente não abre Usuários (volta ao painel)', g.url().endsWith('/app/dashboard'), g.url());
  const menuG = await g.$$eval('pf-sidebar .nav-item span:not(.nav-item__contador)', (l) => l.map((e) => e.textContent));
  ok('Menu do gerente sem Sócios/Usuários/Divisão', !menuG.includes('Sócios') && !menuG.includes('Usuários') && !menuG.includes('Divisão de Lucro'), menuG.join(', '));
  await g.close();

  // ===== Operador =====
  const o = await abrir('dario@email.com');
  ok('Operador entra direto em Fichas', o.url().endsWith('/app/fichas'), o.url());
  await o.goto(`${BASE}/app/dashboard`, { waitUntil: 'networkidle0' });
  ok('Operador não abre o painel', o.url().endsWith('/app/fichas'), o.url());
  await o.close();

  // ===== Celular: menu "Mais" e sair =====
  const m = await abrir('lucasrodrigues.10@icloud.com', 390);
  await clicarTexto(m, 'Mais');
  const itensMais = await m.$$eval('.mais__item span', (l) => l.length);
  ok('Celular: painel "Mais" abre', itensMais > 3, `${itensMais} itens`);
  await clicarTexto(m, 'Sair da conta');
  await espera(500);
  ok('Sair da conta volta ao login', m.url().endsWith('/login'), m.url());
  await m.goto(`${BASE}/app/fichas`, { waitUntil: 'networkidle0' });
  ok('Sem sessão, /app/fichas manda ao login', m.url().includes('/login?redirectTo='), m.url());
  await m.close();
} catch (e) {
  resultados.push(`❌ ERRO NO ROTEIRO: ${e.message}`);
}
console.log(resultados.join('\n'));
await navegador.close();
