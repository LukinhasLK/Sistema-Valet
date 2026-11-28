// Gera as telas de celular usadas na apresentação (public/midia/conheca/celular-*.webp).
//
//   1. Suba o backend de demonstração e o front (como em e2e/rodar.mjs), por exemplo:
//        java -jar ../backend/target/parkflash-api-0.1.0.jar --server.port=18093   (pasta vazia, PUSH_ENVIAR=false)
//        API_ALVO=http://127.0.0.1:18093 npx vite --port 4321
//   2. node ferramentas/capturas-celular.mjs http://localhost:4321
//
// Usa só dados de demonstração (db/demo). Nada é enviado para fora da máquina.
import puppeteer from 'puppeteer-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const DESTINO = resolve(dirname(fileURLToPath(import.meta.url)), '../public/midia/conheca');
const esp = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

async function entrar(email) {
  const p = await (await b.createBrowserContext()).newPage();
  await p.setViewport({ width: 390, height: 800, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  // Tour já visto, para não aparecer o convite nas fotos.
  await p.evaluate(() => {
    const o = {};
    for (let i = 1; i < 60; i++) o[i] = { versao: 1, status: 'pulado', passo: 0, atualizadoEm: 'x', dicasVistas: [] };
    localStorage.setItem('parkflash.v3.onboarding', JSON.stringify(o));
  });
  await p.type('#identificador', email);
  await p.type('#senha', '123456');
  await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}), p.click('button[type=submit]')]);
  await esp(600);
  return p;
}

const clicar = (p, texto) => p.evaluate((t) => {
  const e = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === t);
  e?.click();
  return !!e;
}, texto);

async function foto(p, nome) {
  await esp(700);
  await p.screenshot({ path: `${DESTINO}/${nome}.webp`, type: 'webp', quality: 82 });
  console.log(`✔ ${nome}.webp`);
}

const dono = await entrar('lucasrodrigues.10@icloud.com');

await dono.goto(`${BASE}/app/dashboard?mes=6&ano=2026`, { waitUntil: 'networkidle0' });
await foto(dono, 'celular-painel');

await dono.goto(`${BASE}/app/fichas/nova`, { waitUntil: 'networkidle0' });
await foto(dono, 'celular-nova-ficha');

await dono.goto(`${BASE}/app/fichas?mes=6&ano=2026`, { waitUntil: 'networkidle0' });
await foto(dono, 'celular-lista');

// Conferência: a ficha enviada aberta no detalhe
await dono.goto(`${BASE}/app/fichas?mes=6&ano=2026&detalhe=2`, { waitUntil: 'networkidle0' });
await esp(500);
await clicar(dono, 'Enviar para conferência'); await esp(300);
await clicar(dono, 'Confirmar'); await esp(4800); // espera o aviso sumir
await dono.evaluate(() => document.querySelector('pf-ficha-detalhe')?.closest('[class*="corpo"], .modal__corpo, .sheet__corpo')?.scrollTo(0, 0));
await foto(dono, 'celular-conferencia');

// Fechamento: a ficha de papel
await clicar(dono, 'Confirmar fechamento'); await esp(600);
await dono.evaluate(() => document.querySelector('pf-ficha-papel')?.scrollIntoView({ block: 'center' }));
await foto(dono, 'celular-fechamento');

await dono.goto(`${BASE}/app/pagamentos-manobristas`, { waitUntil: 'networkidle0' });
await foto(dono, 'celular-pagamentos');

await dono.goto(`${BASE}/app/divisao-lucro?mes=6&ano=2026`, { waitUntil: 'networkidle0' });
await foto(dono, 'celular-lucro');

await dono.goto(`${BASE}/app/eventos`, { waitUntil: 'networkidle0' });
await foto(dono, 'celular-calendario');

const socio = await entrar('francisco@email.com');
await socio.goto(`${BASE}/app/sociedade`, { waitUntil: 'networkidle0' });
await esp(800);
await foto(socio, 'celular-sociedade');

await b.close();
