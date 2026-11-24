// Auditoria automática de acessibilidade (axe-core, regras WCAG 2.0/2.1 A e AA) nas telas principais.
//   node e2e/acessibilidade.mjs http://localhost:4300
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] ?? 'http://localhost:4300';
const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const ROTAS_PUBLICAS = ['/conheca', '/planos', '/login'];
const ROTAS = ['/app/dashboard', '/app/fichas', '/app/fichas/nova', '/app/carros-por-mes', '/app/pagamentos-manobristas',
  '/app/despesas', '/app/relatorios', '/app/eventos', '/app/manobristas', '/app/notificacoes', '/app/sociedade', '/app/perfil'];

const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
let total = 0;

async function auditar(p, rota) {
  await p.goto(`${BASE}${rota}`, { waitUntil: 'networkidle0' });
  await esp(700);
  await p.evaluate(axe);
  const atual = new URL(p.url()).pathname;
  if (atual !== rota) throw new Error(`${rota} redirecionou para ${atual}: a auditoria não está logada`);
  // .logo__flash: âmbar da marca. WCAG 1.4.3 isenta logotipos do requisito de contraste.
  const r = await p.evaluate(async () => (await window.axe.run({ exclude: [['.logo__flash']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations
    .map((v) => ({ id: v.id, impacto: v.impact, ajuda: v.help, alvos: v.nodes.slice(0, 3).map((n) => n.target.join(' ')), qtd: v.nodes.length })));
  total += r.length;
  console.log(`${r.length ? '❌' : '✅'} ${rota}${r.length ? '' : ' — sem violações'}`);
  for (const v of r) console.log(`   • [${v.impacto}] ${v.id} (${v.qtd}): ${v.ajuda}\n     ${v.alvos.join(' | ')}`);
}

for (const largura of [1366, 390]) {
  console.log(`\n=== ${largura}px ===`);
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: largura, height: 900, isMobile: largura < 700 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const rota of ROTAS_PUBLICAS) await auditar(p, rota);
  // Entra como um usuário que volta ao sistema: token obtido pela API (mesma origem, via proxy do Vite).
  const { token } = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador: 'lucasrodrigues.10@icloud.com', senha: '123456' }) })).json();
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await p.evaluate((t) => {
    const o = {}; for (let i = 1; i < 60; i++) o[i] = { versao: 1, status: 'pulado', passo: 0, atualizadoEm: 'x', dicasVistas: [] };
    localStorage.setItem('parkflash.v3.onboarding', JSON.stringify(o));
    localStorage.setItem('parkflash.v3.token', JSON.stringify(t));
  }, token);
  for (const rota of ROTAS) await auditar(p, rota);
  await ctx.close();
}
await b.close();
console.log(total ? `\n✖ ${total} tipo(s) de violação encontrados.` : '\n✔ Nenhuma violação WCAG A/AA detectada pelo axe.');
process.exit(total ? 1 : 0);
